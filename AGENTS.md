<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## LNPATS ERP rules
- AuthProvider owns the single auth-state listener and notifies the router only on identity changes or user updates; repeated SIGNED_IN events must not invalidate routes. Why: protected route validation can emit SIGNED_IN and otherwise cause a request loop.
- Approval workflows (leave, supply) advance only via SECURITY DEFINER functions `act_on_leave`/`act_on_supply`; stage→role maps are mirrored in `src/lib/workflow.ts` — keep both in sync. Why: clients cannot update workflow rows directly.
- Attach `audit_trigger` to every business table. Why: all actions must be audited.
- Roles live in `user_roles`; `system_admin` passes every `has_any_role` check.
- Keep existing identity, names, inventory, and workflow columns canonical; alternate uploaded SQL names are generated read-only columns or security-invoker views. Why: no duplicate state/bypasses.
- Newly staged ERP modules are system-admin-only with RLS, explicit grants, and audit triggers until module-specific permissions are implemented. Why: schema preparation must not expose personnel, financial, or disciplinary records.
- Preserve full names without automatic splitting. Why: no invented data.
- Share police rank choices via `src/lib/police-ranks.ts`; retain historical values and separate ranks from roles. Why: consistency.
- Phase 2 correspondence/documents mutate via authorized RPCs, share query/report controls and one registry for both directions; private attachments use exact path membership and signed links. Why: read access never implies approval or file access.
- App emails use the managed server-only template sender, with no local queue or generic send endpoint; email preview routes bypass app guards and authenticate themselves. Why: central delivery.
- Receipts, issues, and reconciliations post stock atomically under inventory row locks and generate immutable source-linked movements; supply collection creates its issue only through its authorized workflow RPC. Other logistics histories remain staged; suppliers and equipment request items stay read-only projections. Why: prevents duplicate stock changes, approval bypasses, and divergent identities.
- Logistics: supplier edits target vendors, equipment requests reuse the supply workflow; supplier/asset/booking writes stay system-admin-only. Why: no parallel identities or permission expansion.
- Stock AI analysis checks storekeeper access server-side, uses item-scoped evidence and never posts stock.
- Inventory totals equal the sum of warehouse_stock balances; warehouse-aware posting and transfer RPCs lock the canonical item, and registration posts opening stock as a receipt. Item codes are immutable and items with stock/history cannot be deleted. Inventory uses shared paginated query options; unit_cost is a manual valuation input, not receipt costing. Why: preserves atomic balances and audit evidence without inventing accounting rules.
- Training module reads share `trainingOptions`; graduation decisions and certificate issuance happen only through the `graduate_cadet` RPC, and result grades are computed by the `compute_assessment_grade` trigger (mirrored by `gradeFor` in `src/lib/training.ts`). Why: keeps certificates atomic with approvals and grades consistent between UI and database.
- Finance workflow state (status, stage, history, approved/used amounts) changes only through the SECURITY DEFINER `finance_workflow` RPC, enforced by `guard_finance_state`; stage→role maps and the high-value threshold are mirrored in `src/lib/finance.ts`. Why: clients cannot self-approve or alter balances.
- Procurement screens share paginated procurementOptions; requests use finance_workflow, and order/receipt/contract transitions use procurement_action. Why: preserves canonical approvals and atomic inventory/expense posting without parallel state.
- HR extends canonical officers, attendance, promotions and disciplinary_actions; hrOptions feeds its protected screens and hr_action authorizes personnel decisions. Private hr-files use exact parent-record membership, with no file deletion; HR leave uses workflow_kind on canonical leave_requests and act_on_leave. Why: avoids duplicate personnel, file loss and approval bypasses.
- ICT uses canonical tickets/assets and source-linked assignment/transfer/maintenance histories; ict_action authorizes all module writes, and ictOptions shares paginated reads. Private knowledge attachments require exact record membership; network check-ins and external account actions are registry records until providers are connected. Why: prevents approval bypasses, duplicate equipment identities and fabricated monitoring or account changes.
- Command reporting snapshots named reviewers from canonical personnel supervisors/section heads and protected command appointments; reports, compilations and versioned command supplies mutate only through authorized RPCs, with exact-membership private files. Why: later assignment changes cannot rewrite approvals or expose subordinate records.
- Command supplies reserve canonical stock after final approval, retain Legacy stage behavior, and use the existing procurement/GRN and stock-issue posting paths; pickup requires requester acknowledgment and Logistics confirmation. Why: prevents duplicate purchasing, stock posting and collection bypasses.
- Command oversight uses protected aggregate RPCs, not widened policies; timed notifications are per-recipient and idempotent. Why: oversight never implies sensitive-record access.
- Facility work orders change state only via `facility_action`; ISS records are iss_officer-writable, command-readable. Why: no self-completed work; restricted security logs.
- Only HR opens accounts via `enrollStaff` (signup disabled); `signInWithLnpId` resolves email server-side, never returning it; `must_change_password` metadata gates the app. Why: HR-controlled enrollment without exposing emails.
- Biometric devices push to /api/public/attendance/hikvision/$deviceId with a hashed per-device token; punches are immutable, roster status derives from src/lib/attendance.ts. Why: cloud can't poll LAN; no manual edits.
