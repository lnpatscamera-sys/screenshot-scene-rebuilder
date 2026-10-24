import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
export const ICT_PRIORITIES = ["Low", "Medium", "High", "Critical"];
export const TICKET_STATUSES = ["Open", "Assigned", "In Progress", "Pending", "Resolved", "Closed"];
export const INCIDENT_CATEGORIES = [
  "Hardware Failure",
  "Software Failure",
  "Network Outage",
  "Internet Failure",
  "Security Incident",
  "Email Problem",
  "Server Problem",
  "Website Problem",
  "ERP Problem",
];
export const SERVICE_TYPES = [
  "Computer Setup",
  "Printer Installation",
  "Software Installation",
  "Email Account Creation",
  "Password Reset",
  "Internet Access",
  "Network Connection",
  "CCTV Support",
  "Website Support",
  "ERP Support",
];
export const ASSET_TYPES = [
  "Desktop Computers",
  "Laptops",
  "Printers",
  "Scanners",
  "Routers",
  "Switches",
  "Servers",
  "CCTV Equipment",
  "UPS Devices",
  "Projectors",
];
export function resolutionHours(created: string, resolved: string | null) {
  if (!resolved) return null;
  return Math.max(0, (Date.parse(resolved) - Date.parse(created)) / 3600000);
}
export function ticketActions(status: string, staff: boolean, owner: boolean) {
  return [
    ...(staff || owner ? ["note"] : []),
    ...(staff && status !== "Closed" ? ["assign", "status"] : []),
    ...(status === "Resolved" && (staff || owner) ? ["close"] : []),
    ...(["Resolved", "Closed"].includes(status) && (staff || owner) ? ["reopen"] : []),
  ];
}
async function fetchICT() {
  const read = async <T>(q: {
    range: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>;
  }) => {
    const rows: T[] = [];
    for (let from = 0; ; from += 500) {
      const r = await q.range(from, from + 499);
      if (r.error) throw r.error;
      rows.push(...(r.data ?? []));
      if ((r.data?.length ?? 0) < 500) return rows;
    }
  };
  const [
    tickets,
    records,
    assets,
    maintenance,
    assignments,
    transfers,
    offices,
    sections,
    directory,
  ] = await Promise.all([
    read(supabase.from("tickets").select("*").order("created_at", { ascending: false })),
    read(supabase.from("ict_records").select("*").order("created_at", { ascending: false })),
    read(supabase.from("assets").select("*").eq("ict_managed", true).order("asset_number")),
    read(supabase.from("asset_maintenance").select("*").order("created_at", { ascending: false })),
    read(supabase.from("asset_assignments").select("*").order("created_at", { ascending: false })),
    read(supabase.from("asset_transfers").select("*").order("created_at", { ascending: false })),
    read(supabase.from("offices").select("id,name")),
    read(supabase.from("sections").select("id,name,office_id")),
    supabase.rpc("ict_directory"),
  ]);
  if (directory.error) throw directory.error;
  return {
    tickets,
    records,
    assets,
    maintenance: maintenance.filter((m) => assets.some((a) => a.id === m.asset_id)),
    assignments,
    transfers,
    offices,
    sections,
    directory: directory.data ?? [],
  };
}
export const ictOptions = queryOptions({ queryKey: ["ict"], queryFn: fetchICT });
export type ICTData = Awaited<ReturnType<typeof fetchICT>>;
export type ICTRecord = ICTData["records"][number];
export async function ictAction(
  module: string,
  id: string | null,
  action: string,
  payload: Json = {},
) {
  const r = await supabase.rpc("ict_action", {
    _module: module,
    _id: id ?? "00000000-0000-0000-0000-000000000000",
    _action: action,
    _payload: payload,
  });
  if (r.error) throw r.error;
  return r.data;
}
export function recordDetails(value: Json): Record<string, string> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? Object.fromEntries(Object.entries(value).map(([k, v]) => [k, String(v ?? "")]))
    : {};
}
