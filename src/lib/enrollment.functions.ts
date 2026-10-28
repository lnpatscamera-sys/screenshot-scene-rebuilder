import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { ENROLL_ROLES, generatePassword, normalizeLnpId } from './enrollment';

const enrollSchema = z.object({
  fullName: z.string().trim().min(2).max(150),
  lnpId: z.string().trim().min(2).max(40).regex(/^[A-Za-z0-9/_-]+$/, 'LNP ID may use letters, numbers, - / _'),
  phone: z.string().trim().min(5).max(30),
  classNumber: z.string().trim().min(1).max(40),
  email: z.string().trim().email().max(200),
});

export const enrollStaff = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => enrollSchema.parse(input))
  .handler(async ({ data, context }) => {
    const allowed = await context.supabase.rpc('has_any_role', { _user_id: context.userId, _roles: [...ENROLL_ROLES] });
    if (allowed.error || !allowed.data) throw new Error('Only Human Resources can enroll staff.');
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    const lnpId = normalizeLnpId(data.lnpId);
    const email = data.email.toLowerCase();

    const existing = await supabaseAdmin.from('officers').select('id,user_id').ilike('service_number', lnpId).maybeSingle();
    if (existing.data?.user_id) throw new Error('This LNP ID Number already has an account.');

    const password = generatePassword();
    const created = await supabaseAdmin.auth.admin.createUser({
      email, password, email_confirm: true,
      user_metadata: { full_name: data.fullName, lnp_id: lnpId, must_change_password: true },
    });
    if (created.error || !created.data.user) {
      throw new Error(/already/i.test(created.error?.message ?? '') ? 'This email address already has an account.' : 'The account could not be created.');
    }
    const userId = created.data.user.id;

    const fields = { full_name: data.fullName, phone: data.phone, email, lnp_class_number: data.classNumber, user_id: userId };
    const officer = existing.data
      ? await supabaseAdmin.from('officers').update(fields).eq('id', existing.data.id).select('id').single()
      : await supabaseAdmin.from('officers').insert({ ...fields, service_number: lnpId, rank: 'Officer' }).select('id').single();
    if (officer.error) {
      await supabaseAdmin.auth.admin.deleteUser(userId);
      throw new Error('The staff record could not be saved, so no account was opened.');
    }
    await supabaseAdmin.from('audit_logs').insert({
      user_id: context.userId, action: 'staff_enrolled', table_name: 'officers', record_id: officer.data.id,
      details: { lnp_id: lnpId, email, class_number: data.classNumber },
    } as never);

    let emailed = false;
    try {
      const { sendTemplateEmail } = await import('@/lib/email-templates/send-email');
      const r = await sendTemplateEmail('staff-account', email, {
        idempotencyKey: `staff-account-${userId}`,
        templateData: { name: data.fullName, username: lnpId, password, loginUrl: 'https://lnpats-erp.lovable.app/auth' },
      });
      emailed = r.sent;
    } catch (e) { console.error('staff-account email failed', e); }
    return { emailed, lnpId, email, password: emailed ? null : password };
  });

/** Resolves an LNP ID to its account email server-side, then signs in; never returns the email. */
export const signInWithLnpId = createServerFn({ method: 'POST' })
  .inputValidator((input: unknown) => z.object({ lnpId: z.string().trim().min(2).max(40), password: z.string().min(1).max(200) }).parse(input))
  .handler(async ({ data }) => {
    const fail = { error: 'Invalid LNP ID Number or password.' } as const;
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    const o = await supabaseAdmin.from('officers').select('user_id').ilike('service_number', normalizeLnpId(data.lnpId)).not('user_id', 'is', null).maybeSingle();
    if (!o.data?.user_id) return fail;
    const u = await supabaseAdmin.auth.admin.getUserById(o.data.user_id);
    const email = u.data.user?.email;
    if (!email) return fail;
    const { createClient } = await import('@supabase/supabase-js');
    const key = process.env['SUPABASE_PUBLISHABLE_KEY']!;
    const client = createClient(process.env['SUPABASE_URL']!, key, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { fetch: (input, init) => { const h = new Headers(init?.headers); if (key.startsWith('sb_') && h.get('Authorization') === `Bearer ${key}`) h.delete('Authorization'); h.set('apikey', key); return fetch(input, { ...init, headers: h }); } },
    });
    const s = await client.auth.signInWithPassword({ email, password: data.password });
    if (s.error || !s.data.session) return fail;
    return { access_token: s.data.session.access_token, refresh_token: s.data.session.refresh_token };
  });
