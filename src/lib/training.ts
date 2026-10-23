import { queryOptions, type QueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import type { AppRole } from "./auth";

export type Cadet = Database["public"]["Tables"]["cadets"]["Row"];
export type TrainingProgram = Database["public"]["Tables"]["training_programs"]["Row"];
export type Course = Database["public"]["Tables"]["courses"]["Row"];
export type Instructor = Database["public"]["Tables"]["instructors"]["Row"];
export type Enrollment = Database["public"]["Tables"]["program_enrollments"]["Row"];
export type AttendanceRecord = Database["public"]["Tables"]["attendance_records"]["Row"];
export type Assessment = Database["public"]["Tables"]["assessments"]["Row"];
export type AssessmentResult = Database["public"]["Tables"]["assessment_results"]["Row"];
export type Graduation = Database["public"]["Tables"]["graduations"]["Row"];
export type Certificate = Database["public"]["Tables"]["certificates"]["Row"];

export const PROGRAM_NAMES = [
  "Basic Police Recruit Training",
  "Refresher Courses",
  "Leadership Training",
  "Investigations Training",
  "Traffic Management",
  "Community Policing",
  "ICT Training",
  "Firearms Training",
  "Tactical Operations",
];
export const ASSESSMENT_TYPES = ["Written Test", "Practical Examination", "Physical Fitness Test", "Firearms Qualification", "Scenario Evaluation", "Final Examination"];
export const ATTENDANCE_STATUSES = ["Present", "Absent", "Excused", "Late"];
export const CADET_STATUSES = ["Active", "Suspended", "Deferred", "Graduated", "Withdrawn"];

export const TRAINING_ADMIN_ROLES: AppRole[] = ["dc_academy"];
export const INSTRUCTOR_ROLES: AppRole[] = ["dc_academy", "section_head"];
export const GRADUATION_ROLES: AppRole[] = ["dc_academy", "commandant"];

export const trainingOptions = queryOptions({
  queryKey: ["training"],
  queryFn: async () => {
    const responses = await Promise.all([
      supabase.from("cadets").select("*").order("cadet_number"),
      supabase.from("training_programs").select("*").order("program_code"),
      supabase.from("courses").select("*").order("course_name"),
      supabase.from("instructors").select("*").order("name"),
      supabase.from("program_enrollments").select("*"),
      supabase.from("attendance_records").select("*").order("attendance_date", { ascending: false }),
      supabase.from("assessments").select("*").order("exam_date", { ascending: false }),
      supabase.from("assessment_results").select("*"),
      supabase.from("graduations").select("*").order("created_at", { ascending: false }),
      supabase.from("certificates").select("*").order("created_at", { ascending: false }),
      supabase.from("officers").select("id,full_name,rank,service_number,user_id").order("full_name"),
    ]);
    for (const result of responses) if (result.error) throw result.error;
    const [cadets, programs, courses, instructors, enrollments, attendance, assessments, results, graduations, certificates, officers] = responses;
    return {
      cadets: cadets.data ?? [],
      programs: programs.data ?? [],
      courses: courses.data ?? [],
      instructors: instructors.data ?? [],
      enrollments: enrollments.data ?? [],
      attendance: attendance.data ?? [],
      assessments: assessments.data ?? [],
      results: results.data ?? [],
      graduations: graduations.data ?? [],
      certificates: certificates.data ?? [],
      officers: officers.data ?? [],
    };
  },
});

export function refreshTraining(qc: QueryClient) {
  return qc.invalidateQueries({ queryKey: ["training"] });
}

export function cadetName(c: Pick<Cadet, "first_name" | "last_name">) {
  return [c.first_name, c.last_name].filter(Boolean).join(" ") || "Unnamed cadet";
}

export function gradeFor(score: number, max: number) {
  const pct = max > 0 ? (score / max) * 100 : 0;
  return pct >= 80 ? "A" : pct >= 70 ? "B" : pct >= 60 ? "C" : pct >= 50 ? "D" : "F";
}

export function attendanceRate(records: Pick<AttendanceRecord, "status">[]) {
  if (!records.length) return 100;
  const present = records.filter((r) => r.status === "Present" || r.status === "Late").length;
  return Math.round((present / records.length) * 100);
}

export function excessiveAbsences(records: Pick<AttendanceRecord, "status">[]) {
  if (!records.length) return false;
  const absent = records.filter((r) => r.status === "Absent").length;
  return absent >= 5 || absent / records.length > 0.2;
}

export function cadetAverage(cadetId: string, results: AssessmentResult[], assessments: Assessment[]) {
  const mine = results.filter((r) => r.cadet_id === cadetId);
  if (!mine.length) return null;
  const pcts = mine.map((r) => {
    const a = assessments.find((x) => x.id === r.assessment_id);
    return a && Number(a.max_score) > 0 ? (Number(r.score) / Number(a.max_score)) * 100 : 0;
  });
  return Math.round(pcts.reduce((s, p) => s + p, 0) / pcts.length);
}

export function graduationEligible(cadetId: string, attendance: AttendanceRecord[], results: AssessmentResult[], assessments: Assessment[]) {
  const rate = attendanceRate(attendance.filter((a) => a.cadet_id === cadetId));
  const avg = cadetAverage(cadetId, results, assessments);
  return rate >= 80 && (avg === null || avg >= 50);
}
