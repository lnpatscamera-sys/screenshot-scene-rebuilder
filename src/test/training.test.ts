import { describe, expect, it } from "vitest";
import {
  ASSESSMENT_TYPES,
  ATTENDANCE_STATUSES,
  GRADUATION_ROLES,
  INSTRUCTOR_ROLES,
  PROGRAM_NAMES,
  TRAINING_ADMIN_ROLES,
  attendanceRate,
  cadetAverage,
  excessiveAbsences,
  gradeFor,
  graduationEligible,
} from "@/lib/training";

describe("training module constants", () => {
  it("lists the nine required training programs", () => {
    expect(PROGRAM_NAMES).toHaveLength(9);
    expect(PROGRAM_NAMES).toContain("Basic Police Recruit Training");
    expect(PROGRAM_NAMES).toContain("Tactical Operations");
  });
  it("lists the six required assessment types", () => {
    expect(ASSESSMENT_TYPES).toHaveLength(6);
    expect(ASSESSMENT_TYPES).toContain("Final Examination");
  });
  it("supports the four attendance statuses", () => {
    expect(ATTENDANCE_STATUSES).toEqual(["Present", "Absent", "Excused", "Late"]);
  });
  it("gives the Deputy Commissioner Academy training administration", () => {
    expect(TRAINING_ADMIN_ROLES).toContain("dc_academy");
  });
  it("lets instructors manage attendance and scores", () => {
    expect(INSTRUCTOR_ROLES).toContain("section_head");
    expect(INSTRUCTOR_ROLES).toContain("dc_academy");
  });
  it("lets the Commandant approve graduation", () => {
    expect(GRADUATION_ROLES).toContain("commandant");
    expect(GRADUATION_ROLES).toContain("dc_academy");
  });
});

describe("gradeFor", () => {
  it("grades score boundaries against the maximum", () => {
    expect(gradeFor(80, 100)).toBe("A");
    expect(gradeFor(79, 100)).toBe("B");
    expect(gradeFor(60, 100)).toBe("C");
    expect(gradeFor(50, 100)).toBe("D");
    expect(gradeFor(49, 100)).toBe("F");
    expect(gradeFor(0, 0)).toBe("F");
  });
});

describe("attendanceRate", () => {
  it("counts Present and Late as attended", () => {
    expect(attendanceRate([{ status: "Present" }, { status: "Late" }, { status: "Absent" }, { status: "Excused" }])).toBe(50);
  });
  it("returns 100 with no records", () => {
    expect(attendanceRate([])).toBe(100);
  });
});

describe("excessiveAbsences", () => {
  it("flags five or more absences", () => {
    const records = Array.from({ length: 20 }, (_, i) => ({ status: i < 5 ? "Absent" : "Present" }));
    expect(excessiveAbsences(records)).toBe(true);
  });
  it("flags absence rates above 20 percent", () => {
    expect(excessiveAbsences([{ status: "Absent" }, { status: "Present" }, { status: "Present" }, { status: "Present" }])).toBe(true);
    expect(excessiveAbsences([{ status: "Absent" }, ...Array.from({ length: 9 }, () => ({ status: "Present" }))])).toBe(false);
  });
});

describe("graduation eligibility", () => {
  const assessments = [
    { id: "a1", max_score: 100 },
    { id: "a2", max_score: 50 },
  ] as never[];
  it("computes the overall average across assessments", () => {
    const results = [
      { cadet_id: "c1", assessment_id: "a1", score: 80 },
      { cadet_id: "c1", assessment_id: "a2", score: 30 },
    ] as never[];
    expect(cadetAverage("c1", results, assessments)).toBe(70);
  });
  it("requires 80 percent attendance and a 50 percent average", () => {
    const attendance = Array.from({ length: 10 }, (_, i) => ({ cadet_id: "c1", status: i < 8 ? "Present" : "Absent" })) as never[];
    const results = [{ cadet_id: "c1", assessment_id: "a1", score: 60 }] as never[];
    expect(graduationEligible("c1", attendance, results, assessments)).toBe(true);
    const poor = Array.from({ length: 10 }, (_, i) => ({ cadet_id: "c1", status: i < 7 ? "Present" : "Absent" })) as never[];
    expect(graduationEligible("c1", poor, results, assessments)).toBe(false);
  });
});
