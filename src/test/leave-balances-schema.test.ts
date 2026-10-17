import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const sql = readFileSync("drizzle/migrations/0003_add_leave_balances.sql", "utf8");

describe("leave balance records", () => {
  it.each([
    ["annual_leave_allocated", 30],
    ["annual_leave_used", 0],
    ["annual_leave_balance", 30],
    ["sick_leave_used", 0],
    ["emergency_leave_used", 0],
  ])("%s defaults to %i days", (column, value) => {
    expect(sql).toMatch(new RegExp(`${column} INTEGER DEFAULT ${value}\\s*[,)]`, "i"));
  });

  it("defaults the update timestamp to now", () => {
    expect(sql).toMatch(/updated_at TIMESTAMP DEFAULT NOW\(\)/i);
  });

  it("limits staged records to system administrators and audits changes", () => {
    expect(sql).toContain("ALTER TABLE public.leave_balances ENABLE ROW LEVEL SECURITY");
    expect(sql).toContain("USING (public.has_role(auth.uid(), 'system_admin')) WITH CHECK (public.has_role(auth.uid(), 'system_admin'))");
    expect(sql).toContain("GRANT SELECT, INSERT, UPDATE, DELETE ON public.leave_balances TO authenticated");
    expect(sql).toContain("GRANT ALL ON public.leave_balances TO service_role");
    expect(sql).toContain("AFTER INSERT OR UPDATE OR DELETE ON public.leave_balances FOR EACH ROW EXECUTE FUNCTION public.audit_trigger()");
  });
});