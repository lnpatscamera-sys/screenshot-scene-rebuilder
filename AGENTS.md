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
- Roles live in `user_roles`; `system_admin` passes every `has_any_role` check; first signup becomes system_admin.
- Keep existing identity, names, inventory, and workflow columns canonical; alternate uploaded SQL names are generated read-only columns or security-invoker views. Why: prevents duplicate state and approval bypasses.
- Newly staged ERP modules are system-admin-only with RLS, explicit grants, and audit triggers until module-specific permissions are implemented. Why: schema preparation must not expose personnel, financial, or disciplinary records.
- Preserve full names without automatic splitting. Why: avoid invented personal data.
- Share police rank choices via `src/lib/police-ranks.ts`; retain historical values and separate ranks from roles. Why: consistent choices without reclassification or privilege changes.
- Phase 2 correspondence and document mutations use database-authorized RPCs; private attachments use exact path membership and signed links. Why: read access never implies approval or file access.
- Phase 2 shares query/report controls and canonical registry for both directions. Why: consistent reads and revision history.
- App emails use the managed server-only template sender, with no local queue or generic send endpoint; email preview routes bypass app guards and authenticate themselves. Why: delivery and suppression are managed centrally.
- Receipts, issues, and reconciliations post stock atomically under inventory row locks and generate immutable source-linked movements; supply collection creates its issue only through its authorized workflow RPC. Other logistics histories remain staged; suppliers and equipment request items stay read-only projections. Why: prevents duplicate stock changes, approval bypasses, and divergent identities.
- Logistics pages share protected query options; supplier edits target vendors, equipment requests reuse the supply workflow, and supplier/asset/booking writes remain system-admin-only. Why: avoids parallel identities and unapproved permission expansion.
- Stock AI analysis verifies storekeeper access server-side, reads item-scoped evidence, calls server-only Responses helpers, never posts stock, and durably pauses gateway access blocks. Why: keeps recommendations advisory, evidence-scoped, and protected.
- Inventory totals equal the sum of warehouse_stock balances; warehouse-aware posting and transfer RPCs lock the canonical item, and registration posts opening stock as a receipt. Item codes are immutable and items with stock/history cannot be deleted. Why: preserves atomic balances and audit evidence across locations.
- Inventory management uses shared paginated query options and existing report helpers; unit_cost is a manually maintained valuation input, not receipt costing. Why: avoids truncated summaries and inventing financial accounting rules.
- Training module reads share `trainingOptions`; graduation decisions and certificate issuance happen only through the `graduate_cadet` RPC, and result grades are computed by the `compute_assessment_grade` trigger (mirrored by `gradeFor` in `src/lib/training.ts`). Why: keeps certificates atomic with approvals and grades consistent between UI and database.
- Finance workflow state (status, stage, history, approved/used amounts) changes only through the SECURITY DEFINER `finance_workflow` RPC, enforced by `guard_finance_state`; stage→role maps and the high-value threshold are mirrored in `src/lib/finance.ts`. Why: clients cannot self-approve or alter balances.
- Procurement screens share paginated procurementOptions; requests use finance_workflow, and order/receipt/contract transitions use procurement_action. Why: preserves canonical approvals and atomic inventory/expense posting without parallel state.
- HR extends canonical officers, attendance, promotions and disciplinary_actions; hrOptions feeds its protected screens and hr_action authorizes personnel decisions. Private hr-files use exact parent-record membership, with no file deletion; HR leave uses workflow_kind on canonical leave_requests and act_on_leave. Why: avoids duplicate personnel, file loss and approval bypasses.
- ICT uses canonical tickets/assets and source-linked assignment/transfer/maintenance histories; ict_action authorizes all module writes, and ictOptions shares paginated reads. Private knowledge attachments require exact record membership; network check-ins and external account actions are registry records until providers are connected. Why: prevents approval bypasses, duplicate equipment identities and fabricated monitoring or account changes.
- Command reporting snapshots named reviewers from canonical personnel supervisors/section heads and protected command appointments; reports, compilations and versioned command supplies mutate only through authorized RPCs, with exact-membership private files. Why: later assignment changes cannot rewrite approvals or expose subordinate records.
- Command supplies reserve canonical stock after final approval, retain Legacy stage behavior, and use the existing procurement/GRN and stock-issue posting paths; pickup requires requester acknowledgment and Logistics confirmation. Why: prevents duplicate purchasing, stock posting and collection bypasses.
- Command inventory and decision evidence use protected aggregate RPCs rather than widened finance/personnel policies; timed report notifications are per-recipient and idempotent. Why: oversight access does not imply access to unrelated sensitive records.
- Facility work orders change state only through the SECURITY DEFINER `facility_action` RPC; ISS records (visitors, gate logs, roster, occurrence book) are writable by iss_officer and readable by command staff. Why: requesters cannot self-assign or self-complete work, and security logs stay restricted.
