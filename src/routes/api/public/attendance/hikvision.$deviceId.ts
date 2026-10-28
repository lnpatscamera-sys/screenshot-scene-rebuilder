import { createFileRoute } from '@tanstack/react-router';
import { punchDirection, verifyMethod, sha256Hex, isLate } from '@/lib/attendance';

type HikEvent = { dateTime?: string; ipAddress?: string; eventType?: string; AccessControllerEvent?: { employeeNoString?: string; attendanceStatus?: string; currentVerifyMode?: string; serialNo?: number; majorEventType?: number; subEventType?: number } };

async function readEvents(request: Request): Promise<HikEvent[]> {
  const type = request.headers.get('content-type') ?? '';
  const parse = (t: string) => { try { const j = JSON.parse(t); return Array.isArray(j) ? j : [j]; } catch { return []; } };
  if (type.includes('multipart/form-data')) {
    const form = await request.formData();
    const out: HikEvent[] = [];
    for (const [, v] of form) if (typeof v === 'string') out.push(...parse(v));
    return out;
  }
  return parse(await request.text());
}

export const Route = createFileRoute('/api/public/attendance/hikvision/$deviceId')({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        const token = new URL(request.url).searchParams.get('token') ?? '';
        if (!/^[0-9a-f-]{36}$/.test(params.deviceId) || token.length < 32 || token.length > 128) return new Response('Unauthorized', { status: 401 });
        const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
        const { data: device } = await supabaseAdmin.from('attendance_devices').select('id,name,status,token_hash').eq('id', params.deviceId).maybeSingle();
        if (!device || device.token_hash !== (await sha256Hex(token))) return new Response('Unauthorized', { status: 401 });
        const ip = request.headers.get('cf-connecting-ip') ?? request.headers.get('x-forwarded-for');
        const now = new Date().toISOString();
        if (device.status !== 'Online') await supabaseAdmin.from('attendance_sync_logs').insert({ device_id: device.id, event: 'Online', detail: device.status === 'Offline' ? 'Connection restored' : 'First contact', ip_address: ip });
        let saved = 0;
        try {
          const events = (await readEvents(request)).slice(0, 200);
          for (const ev of events) {
            const a = ev.AccessControllerEvent;
            if (!a || ev.eventType === 'heartBeat') continue;
            const employee = a.employeeNoString?.trim().slice(0, 64);
            const at = ev.dateTime && !Number.isNaN(Date.parse(ev.dateTime)) ? new Date(ev.dateTime).toISOString() : now;
            if (!employee) {
              if (a.majorEventType === 5) await supabaseAdmin.rpc('attendance_alert', { _title: 'Unauthorized biometric attempt', _body: `${device.name} rejected an unknown person at ${at.slice(11, 16)}`, _key: `${device.id}:unauth:${a.serialNo ?? at}` });
              continue;
            }
            const { data: map } = await supabaseAdmin.from('biometric_users').select('officer_id').eq('biometric_user_id', employee).maybeSingle();
            let direction = punchDirection(a.attendanceStatus);
            if (!direction && map) {
              const since = new Date(Date.parse(at) - 16 * 3600_000).toISOString();
              const { data: last } = await supabaseAdmin.from('attendance_punches').select('direction').eq('officer_id', map.officer_id).gte('punched_at', since).lt('punched_at', at).order('punched_at', { ascending: false }).limit(1).maybeSingle();
              direction = last?.direction === 'Check In' ? 'Check Out' : 'Check In';
            }
            const { error } = await supabaseAdmin.from('attendance_punches').insert({ device_id: device.id, officer_id: map?.officer_id ?? null, biometric_user_id: employee, punched_at: at, direction: direction ?? 'Check In', method: verifyMethod(a.currentVerifyMode), event_key: `${device.id}:${a.serialNo ?? `${employee}:${at}`}`, raw: ev as never });
            if (error) { if (error.code !== '23505') throw error; continue; }
            saved++;
            if (!map) await supabaseAdmin.rpc('attendance_alert', { _title: 'Unlinked biometric user', _body: `Biometric ID ${employee} signed in on ${device.name} but is not linked to an employee`, _key: `unlinked:${employee}` });
            else if (direction !== 'Check Out' && isLate(new Date(at))) {
              const { data: lates } = await supabaseAdmin.from('attendance_punches').select('punched_at').eq('officer_id', map.officer_id).eq('direction', 'Check In').gte('punched_at', new Date(Date.parse(at) - 7 * 86400_000).toISOString());
              const lateCount = (lates ?? []).filter(p => isLate(new Date(p.punched_at))).length;
              if (lateCount >= 3) await supabaseAdmin.rpc('attendance_alert', { _title: 'Repeated lateness', _body: `An officer (biometric ID ${employee}) was late ${lateCount} times in 7 days`, _key: `late:${map.officer_id}:${at.slice(0, 10)}` });
            }
          }
        } catch (e) {
          console.error('attendance sync failed', e);
          await supabaseAdmin.from('attendance_sync_logs').insert({ device_id: device.id, event: 'Sync failed', detail: 'Event could not be saved', ip_address: ip });
          await supabaseAdmin.rpc('attendance_alert', { _title: 'Attendance sync failed', _body: `${device.name} sent data that could not be saved`, _key: `${device.id}:fail:${now.slice(0, 13)}` });
          return new Response('Error', { status: 500 });
        }
        await supabaseAdmin.from('attendance_devices').update({ status: 'Online', last_seen_at: now, offline_alerted: false, ...(saved ? { last_sync_at: now } : {}) }).eq('id', device.id);
        if (saved) await supabaseAdmin.from('attendance_sync_logs').insert({ device_id: device.id, event: 'Synced', detail: `${saved} record(s) received`, ip_address: ip });
        return new Response('OK');
      },
    },
  },
});
