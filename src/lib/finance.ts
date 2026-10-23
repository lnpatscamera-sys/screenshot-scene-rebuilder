import { queryOptions, type QueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import type { AppRole } from "./auth";

type T = Database["public"]["Tables"];
export type Budget = T["budgets"]["Row"];
export type Expense = T["expenses"]["Row"];
export type Revenue = T["revenues"]["Row"];
export type CashRequest = T["cash_requests"]["Row"];
export type ProcurementRequest = T["procurement_funding"]["Row"];
export type FinanceApproval = T["finance_approvals"]["Row"];

export const BUDGET_CATEGORIES = ["Personnel", "Training", "Operations", "Logistics", "ICT", "Transport", "Infrastructure", "Procurement", "Maintenance", "Administration"];
export const REVENUE_SOURCES = ["Government Appropriation", "Tuition and Training Fees", "Grants", "Donations", "Other Income"];
export const PAYMENT_METHODS = ["Bank Transfer", "Cheque", "Cash", "Mobile Money"];
export const FUNDING_SOURCES = ["Government of Liberia", "Donor Grant", "Internal Revenue", "Partner Support"];
export const ATTACHMENT_TYPES = ["Invoice", "Receipt", "Contract", "Approval Letter"];

/** Expenses above this amount need Commandant approval after Finance (mirrors finance_workflow). */
export const HIGH_VALUE_THRESHOLD = 10000;
export const LOW_BUDGET_PERCENT = 80;
export const EXPIRING_DAYS = 60;

export const FINANCE_STAFF: AppRole[] = ["finance_admin", "finance_officer"];
export const FINANCE_READERS: AppRole[] = ["finance_admin", "finance_officer", "commandant", "deputy_commandant", "auditor"];
export const BUDGET_APPROVERS: AppRole[] = ["finance_admin", "commandant"];

export const CASH_STAGES = ["Draft", "Supervisor", "Finance", "Commandant", "Approved", "Funds Released", "Closed"];
export const CASH_STAGE_ROLES: Record<number, AppRole[]> = { 1: ["section_head"], 2: FINANCE_STAFF, 3: ["commandant"] };
export const PROCUREMENT_STAGES = ["Draft", "Department Head", "Procurement", "Finance", "Chief of ICT", "Commandant", "Approved"];
export const PROCUREMENT_STAGE_ROLES: Record<number, AppRole[]> = { 1: ["section_head"], 2: ["procurement_officer"], 3: FINANCE_STAFF, 4: ["ict_admin"], 5: ["commandant"] };
export const EXPENSE_STAGE_ROLES: Record<number, AppRole[]> = { 1: FINANCE_STAFF, 2: ["commandant"] };

/** Next stage after an approval; non-ICT procurement skips the Chief of ICT step. */
export function nextProcurementStage(stage: number, isIct: boolean) {
  const next = stage + 1;
  return next === 4 && !isIct ? 5 : next;
}
export function expenseNeedsCommandant(amount: number) {
  return amount > HIGH_VALUE_THRESHOLD;
}

export function utilization(allocated: number, used: number) {
  return allocated > 0 ? Math.round((used / allocated) * 1000) / 10 : 0;
}
export type BudgetAlert = "Budget Exceeded" | "Low Budget" | "Expiring";
export function budgetAlerts(b: { allocated_amount: number | null; used_amount: number | null; fiscal_year: number | null }, today = new Date()): BudgetAlert[] {
  const out: BudgetAlert[] = [];
  const pct = utilization(Number(b.allocated_amount ?? 0), Number(b.used_amount ?? 0));
  if (pct > 100) out.push("Budget Exceeded");
  else if (pct >= LOW_BUDGET_PERCENT) out.push("Low Budget");
  if (b.fiscal_year) {
    const end = new Date(b.fiscal_year, 11, 31);
    const days = (end.getTime() - today.getTime()) / 86400000;
    if (days >= 0 && days <= EXPIRING_DAYS) out.push("Expiring");
  }
  return out;
}

export const money = (n: number | null | undefined) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(Number(n ?? 0));

export function monthly<Tr>(rows: Tr[], date: (r: Tr) => string | null, amount: (r: Tr) => number, year: number) {
  const months = Array.from({ length: 12 }, (_, i) => ({ month: new Date(year, i, 1).toLocaleString("en", { month: "short" }), total: 0 }));
  for (const r of rows) {
    const d = date(r);
    if (!d) continue;
    const dt = new Date(d);
    if (dt.getFullYear() === year) months[dt.getMonth()]!.total += amount(r);
  }
  return months;
}

export const financeOptions = queryOptions({
  queryKey: ["finance"],
  queryFn: async () => {
    const r = await Promise.all([
      supabase.from("budgets").select("*").order("created_at", { ascending: false }),
      supabase.from("expenses").select("*").order("expense_date", { ascending: false }),
      supabase.from("revenues").select("*").order("received_date", { ascending: false }),
      supabase.from("cash_requests").select("*").order("created_at", { ascending: false }),
      supabase.from("procurement_funding").select("*").order("created_at", { ascending: false }),
      supabase.from("finance_approvals").select("*").order("created_at", { ascending: true }),
      supabase.from("sections").select("id,name").order("name"),
      supabase.from("vendors").select("id,company_name").order("company_name"),
      supabase.from("officers").select("id,full_name,user_id,section_id").order("full_name"),
    ]);
    for (const x of r) if (x.error) throw x.error;
    const [budgets, expenses, revenues, cash, procurement, approvals, sections, vendors, officers] = r;
    return {
      budgets: budgets.data ?? [], expenses: expenses.data ?? [], revenues: revenues.data ?? [], cash: cash.data ?? [],
      procurement: procurement.data ?? [], approvals: approvals.data ?? [], sections: sections.data ?? [],
      vendors: vendors.data ?? [], officers: officers.data ?? [],
    };
  },
});
export const refreshFinance = (qc: QueryClient) => qc.invalidateQueries({ queryKey: ["finance"] });

export async function financeAction(module: "budgets" | "expenses" | "cash_requests" | "procurement_funding", id: string, action: string, note?: string, amount?: number) {
  const { error } = await supabase.rpc("finance_workflow", { _module: module, _id: id, _action: action, ...(note ? { _note: note } : {}), ...(amount !== undefined ? { _amount: amount } : {}) });
  if (error) throw error;
}
