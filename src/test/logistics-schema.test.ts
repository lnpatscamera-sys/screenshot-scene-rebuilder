import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const sql = readFileSync("drizzle/migrations/0008_stage_logistics_records.sql", "utf8");
const tables = ["inventory_movements", "asset_assignments", "asset_transfers", "asset_maintenance", "store_receipts", "store_issues", "vehicle_bookings", "fuel_logs", "maintenance_logs", "stock_reconciliation"];

describe("staged logistics access and compatibility", () => {
  it.each(tables)("%s remains administrator-only and audited", (table) => {
    expect(sql).toContain(`CREATE TABLE public.${table}`);
    expect(sql).toContain(`GRANT SELECT, INSERT, UPDATE, DELETE ON public.${table} TO authenticated`);
    expect(sql).toContain(`GRANT ALL ON public.${table} TO service_role`);
    expect(sql).toContain(`ALTER TABLE public.${table} ENABLE ROW LEVEL SECURITY`);
    expect(sql).toContain(`ON public.${table} FOR ALL TO authenticated USING (public.has_role(auth.uid(),'system_admin')) WITH CHECK (public.has_role(auth.uid(),'system_admin'))`);
    expect(sql).toContain(`AFTER INSERT OR UPDATE OR DELETE ON public.${table} FOR EACH ROW EXECUTE FUNCTION public.audit_trigger()`);
  });

  it("supplier aliases use the existing vendor identity", () => {
    expect(sql).toMatch(/CREATE VIEW public\.suppliers WITH \(security_invoker=true\)[^;]+FROM public\.vendors;/);
    expect(sql).not.toMatch(/CREATE TABLE public\.suppliers/);
    expect(sql).not.toMatch(/GRANT (?:ALL|INSERT|UPDATE|DELETE)[^;]*ON public\.suppliers/);
  });

  it("equipment line items reflect existing requests without bypassing approvals", () => {
    expect(sql).toMatch(/CREATE VIEW public\.equipment_request_items WITH \(security_invoker=true\) AS SELECT id, id AS request_id, item_id, item_name, quantity, unit, description FROM public\.supply_requests;/);
    expect(sql).not.toMatch(/GRANT (?:ALL|INSERT|UPDATE|DELETE)[^;]*ON public\.equipment_request_items/);
    expect(sql).not.toMatch(/(?:CREATE OR REPLACE FUNCTION public\.act_on_supply|UPDATE public\.inventory_items)/);
  });
});