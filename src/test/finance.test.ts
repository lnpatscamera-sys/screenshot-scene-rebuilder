import { describe, expect, it } from "vitest";
import { BUDGET_CATEGORIES, REVENUE_SOURCES, budgetAlerts, expenseNeedsCommandant, nextProcurementStage, utilization, CASH_STAGE_ROLES, PROCUREMENT_STAGE_ROLES } from "@/lib/finance";

describe("finance rules", () => {
  it("has the ten budget categories and five revenue sources", () => {
    expect(BUDGET_CATEGORIES).toHaveLength(10);
    expect(REVENUE_SOURCES).toEqual(["Government Appropriation", "Tuition and Training Fees", "Grants", "Donations", "Other Income"]);
  });
  it("routes cash requests Supervisor → Finance → Commandant", () => {
    expect(CASH_STAGE_ROLES[1]).toEqual(["section_head"]);
    expect(CASH_STAGE_ROLES[2]).toContain("finance_officer");
    expect(CASH_STAGE_ROLES[3]).toEqual(["commandant"]);
  });
  it("skips Chief of ICT for non-ICT procurement", () => {
    expect(nextProcurementStage(3, false)).toBe(5);
    expect(nextProcurementStage(3, true)).toBe(4);
    expect(PROCUREMENT_STAGE_ROLES[4]).toEqual(["ict_admin"]);
  });
  it("requires Commandant approval only above 10,000", () => {
    expect(expenseNeedsCommandant(10000)).toBe(false);
    expect(expenseNeedsCommandant(10000.01)).toBe(true);
  });
  it("flags low, exceeded and expiring budgets", () => {
    expect(utilization(1000, 250)).toBe(25);
    expect(budgetAlerts({ allocated_amount: 1000, used_amount: 850, fiscal_year: 2030 }, new Date(2030, 0, 1))).toEqual(["Low Budget"]);
    expect(budgetAlerts({ allocated_amount: 1000, used_amount: 1200, fiscal_year: 2030 }, new Date(2030, 0, 1))).toEqual(["Budget Exceeded"]);
    expect(budgetAlerts({ allocated_amount: 1000, used_amount: 0, fiscal_year: 2030 }, new Date(2030, 10, 15))).toEqual(["Expiring"]);
  });
});
