import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const sql = readFileSync("drizzle/migrations/0002_extend_lnpats_erp_records.sql", "utf8");
const tables = [...sql.matchAll(/CREATE TABLE public\.(\w+)/g)].map((match) => match[1]);

describe("staged ERP schema security", () => {
  it.each(tables)("%s is explicitly granted, RLS-protected, and audited", (table) => {
    expect(sql).toContain(`GRANT SELECT, INSERT, UPDATE, DELETE ON public.${table} TO authenticated`);
    expect(sql).toContain(`GRANT ALL ON public.${table} TO service_role`);
    expect(sql).toContain(`ALTER TABLE public.${table} ENABLE ROW LEVEL SECURITY`);
    expect(sql).toMatch(new RegExp(`CREATE POLICY [^;]+ ON public\\.${table} FOR ALL TO authenticated USING \\(public\\.has_role\\(auth\\.uid\\(\\),'system_admin'\\)\\) WITH CHECK \\(public\\.has_role\\(auth\\.uid\\(\\),'system_admin'\\)\\)`));
    expect(sql).toContain(`AFTER INSERT OR UPDATE OR DELETE ON public.${table} FOR EACH ROW EXECUTE FUNCTION public.audit_trigger()`);
  });
  it("equipment compatibility remains read-only and follows canonical supply requests", () => {
    expect(sql).toContain("CREATE VIEW public.equipment_requests WITH (security_invoker=true)");
    expect(sql).toContain("FROM public.supply_requests r");
    expect(sql).not.toMatch(/GRANT (?:ALL|INSERT|UPDATE|DELETE)[^;]*ON public\.(equipment_requests|approvals)/);
  });
  it("leave compatibility derives status and days instead of creating competing state", () => {
    expect(sql).toContain("total_days integer GENERATED ALWAYS AS (end_date - start_date + 1) STORED");
    expect(sql).toContain("approval_status text GENERATED ALWAYS AS (status) STORED");
  });
});