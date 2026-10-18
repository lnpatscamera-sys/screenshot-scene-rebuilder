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
- Approval workflows (leave, supply) advance only via SECURITY DEFINER functions `act_on_leave`/`act_on_supply`; stage→role maps are mirrored in `src/lib/workflow.ts` — keep both in sync. Why: clients cannot update workflow rows directly.
- Audit logging is done by the `audit_trigger` DB trigger on every business table; attach it to new tables. Why: guarantees every action is logged.
- Roles live in `user_roles`; `system_admin` passes every `has_any_role` check; first signup becomes system_admin.
- Keep existing identity, names, inventory, and workflow columns canonical; alternate uploaded SQL names are generated read-only columns or security-invoker views. Why: prevents duplicate state and approval bypasses.
- Newly staged ERP modules are system-admin-only with RLS, explicit grants, and audit triggers until module-specific permissions are implemented. Why: schema preparation must not expose personnel, financial, or disciplinary records.
- Store optional officer name parts without automatically splitting existing full names. Why: parsing names would invent personal data.
- Phase 2 correspondence and document mutations use database-authorized RPCs; private attachments use exact path membership and signed links. Why: read access never implies approval or file access.
- Phase 2 screens share query options and PDF/Excel report controls; registry is canonical for both correspondence directions. Why: consistent reads and preserved revision histories.
- App emails use the managed server-only template sender, with no local queue or generic send endpoint; email preview routes bypass app guards and authenticate themselves. Why: delivery and suppression are managed centrally.
