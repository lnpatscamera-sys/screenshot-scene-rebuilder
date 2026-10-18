import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { DOCUMENT_ROLES, DOCUMENT_TYPES, REGISTRY_ROLES } from "@/lib/phase2";
import { LEAVE_STAGE_ROLES, LEAVE_TYPES } from "@/lib/workflow";
const sql = readFileSync("drizzle/migrations/0005_phase2_workflows.sql", "utf8");
const guards = readFileSync("drizzle/migrations/0006_phase2_access_guards.sql", "utf8");
describe("Phase 2 workflow rules", () => {
  it("includes Study alongside the five required leave types", () => { expect(LEAVE_TYPES).toEqual(["Annual","Sick","Emergency","Maternity","Special","Study"]); expect(sql).toContain("'Annual','Sick','Emergency','Maternity','Special','Study'"); });
  it("requires HR at leave stage five before terminal approval", () => { expect(LEAVE_STAGE_ROLES[5]).toEqual(["hr_officer"]); expect(sql).toContain("WHEN r.stage=5 THEN 'Approved' ELSE 'Pending'"); expect(sql).toContain("WHEN 5 THEN ARRAY['hr_officer']"); });
  it("routes registry review through Deputy Commandant then Commandant", () => { expect(REGISTRY_ROLES[1]).toEqual(["deputy_commandant"]); expect(REGISTRY_ROLES[2]).toEqual(["commandant"]); expect(sql).toContain("WHEN 1 THEN ARRAY['deputy_commandant']"); });
  it("generates direction-specific annual registry references", () => { expect(sql).toContain("RETURN 'LNPATS/'||_direction||'/'||y||'/'||lpad(n::text,4,'0')"); expect(sql).toContain("PRIMARY KEY(direction,year)"); });
  it("publishes only at Commandant document stage", () => { expect(DOCUMENT_ROLES[4]).toEqual(["commandant"]); expect(sql).toContain("WHEN d.stage=4 THEN 'Published' ELSE 'Pending'"); expect(guards).toContain("NEW.stage NOT BETWEEN 1 AND 4"); });
  it("preserves rollback as a new version rather than overwriting history", () => { expect(sql).toContain("_id,d.current_version+1"); expect(sql).toContain("CASE WHEN _action='rollback' THEN v.file_path ELSE path END"); });
  it("includes all eleven document categories", () => { expect(DOCUMENT_TYPES).toHaveLength(11); expect(DOCUMENT_TYPES).toContain("Cadet Files"); expect(DOCUMENT_TYPES).toContain("Personnel Documents"); });
  it("requires exact attachment paths and uploaded-file ownership", () => { expect(guards).toContain("f->>'path'=name"); expect(guards).not.toContain("attachments::text LIKE"); expect(guards).toContain("Attachment must be your uploaded file"); });
});