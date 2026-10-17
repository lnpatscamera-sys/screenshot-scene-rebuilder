import type { AppRole } from "./auth";

export const LEAVE_STAGES = ["Section Head", "Assistant Commissioner", "Deputy Commissioner", "Commandant", "Approved"];
export const LEAVE_STAGE_ROLES: Record<number, AppRole[]> = {
  1: ["section_head"],
  2: ["assistant_commissioner"],
  3: ["dc_admin", "dc_academy"],
  4: ["commandant"],
};

export const SUPPLY_STAGES = [
  "Assistant Commissioner review",
  "Deputy Commissioner review",
  "Commandant approval",
  "Deputy Commissioner forwards",
  "Logistics receives",
  "Storekeeper prepares",
  "Ready — awaiting collection",
  "Collected",
];
export const SUPPLY_STAGE_ROLES: Record<number, AppRole[]> = {
  1: ["assistant_commissioner"],
  2: ["dc_admin"],
  3: ["commandant"],
  4: ["dc_admin"],
  5: ["storekeeper"],
  6: ["storekeeper"],
  7: ["storekeeper"],
};
export const SUPPLY_ACTION_LABEL: Record<number, string> = {
  1: "Recommend",
  2: "Recommend",
  3: "Approve",
  4: "Forward to Logistics",
  5: "Receive request",
  6: "Mark items ready",
  7: "Confirm collection",
};

export function leaveDays(start: string, end: string) {
  return Math.round((new Date(end).getTime() - new Date(start).getTime()) / 86400000) + 1;
}

export const LEAVE_ENTITLEMENT: Record<string, number> = { Annual: 30, Sick: 14, Emergency: 5, Maternity: 90, Special: 10 };
