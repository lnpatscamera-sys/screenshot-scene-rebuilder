import { describe, it, expect } from "vitest";
import { LEAVE_STAGE_ROLES, SUPPLY_STAGE_ROLES, leaveDays } from "@/lib/workflow";

describe("approval chains", () => {
  it("leave goes Section Head → AC → DC → Commandant", () => {
    expect(LEAVE_STAGE_ROLES[1]).toEqual(["section_head"]);
    expect(LEAVE_STAGE_ROLES[2]).toEqual(["assistant_commissioner"]);
    expect(LEAVE_STAGE_ROLES[3]).toContain("dc_admin");
    expect(LEAVE_STAGE_ROLES[4]).toEqual(["commandant"]);
    expect(LEAVE_STAGE_ROLES[5]).toEqual(["hr_officer"]);
  });
  it("supply: commandant approves at stage 3, storekeeper confirms collection at 7", () => {
    expect(SUPPLY_STAGE_ROLES[3]).toEqual(["commandant"]);
    expect(SUPPLY_STAGE_ROLES[7]).toEqual(["storekeeper"]);
  });
  it("counts leave days inclusively", () => {
    expect(leaveDays("2026-10-01", "2026-10-05")).toBe(5);
  });
});
