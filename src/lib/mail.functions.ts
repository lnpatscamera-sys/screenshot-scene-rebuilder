import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const box = z.enum(["inbox", "sent"]);
const addr = z.string().trim().email().max(254);

type Ctx = { supabase: any; userId: string };
async function account({ supabase, userId }: Ctx) {
  const { data } = await supabase.from("mail_accounts").select("email, secret").eq("user_id", userId).maybeSingle();
  if (!data) throw new Error("Connect your mailbox first");
  const { decryptSecret } = await import("./mail.server");
  return { email: data.email as string, pass: await decryptSecret(data.secret) };
}
const friendly = (e: unknown) => new Error(e instanceof Error ? e.message : "Mail server unavailable");

export const getMailAccount = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase.from("mail_accounts").select("email").eq("user_id", context.userId).maybeSingle();
    return { email: (data?.email as string | undefined) ?? null };
  });

export const connectMailbox = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ email: addr.refine((e) => e.toLowerCase().endsWith("@lnpats.net"), "Use your @lnpats.net address"), password: z.string().min(1).max(200) }).parse(d))
  .handler(async ({ data, context }) => {
    const { verifyMailbox, encryptSecret } = await import("./mail.server");
    try { await verifyMailbox(data.email, data.password); } catch (e) { throw friendly(e); }
    const secret = await encryptSecret(data.password);
    const { error } = await context.supabase.from("mail_accounts")
      .upsert({ user_id: context.userId, email: data.email.toLowerCase(), secret, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
    if (error) throw new Error("Could not save mailbox");
    return { email: data.email.toLowerCase() };
  });

export const disconnectMailbox = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await context.supabase.from("mail_accounts").delete().eq("user_id", context.userId);
    return { ok: true };
  });

export const listMail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ box }).parse(d))
  .handler(async ({ data, context }) => {
    const a = await account(context);
    const { listMessages } = await import("./mail.server");
    try { return await listMessages(a.email, a.pass, data.box); } catch (e) { throw friendly(e); }
  });

export const readMail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ box, uid: z.number().int().positive() }).parse(d))
  .handler(async ({ data, context }) => {
    const a = await account(context);
    const { readMessage } = await import("./mail.server");
    try { return await readMessage(a.email, a.pass, data.box, data.uid); } catch (e) { throw friendly(e); }
  });

export const sendMail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    to: z.array(addr).min(1).max(20), cc: z.array(addr).max(20).default([]),
    subject: z.string().trim().max(250), body: z.string().max(50000), inReplyTo: z.string().max(500).nullish(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const a = await account(context);
    const { sendMessage } = await import("./mail.server");
    try { await sendMessage(a.email, a.pass, data); } catch (e) { throw friendly(e); }
    return { ok: true };
  });
