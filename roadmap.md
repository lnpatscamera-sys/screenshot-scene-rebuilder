# LNPATS ERP Roadmap

## Phase 1 (now)
- [x] Fix login session request loop and verify signed-in access.
- [x] Logo, theme (LNP navy/gold), favicon
- [x] Sign-in, roles table, offices & sections
- [x] Dashboard with live stats + recent activity
- [x] Officer management (profiles, ID card)
- [x] Leave requests + 5-step approval chain
- [x] Supply requests + approval/collection workflow, inventory
- [x] Audit log

## Later phases
- [ ] Expand inventory: required categories, generated item codes, unit costs, dashboard/search, warehouse CRUD, audited adjustments/transfers, PDF/Excel exports, and signed-in verification.
- [x] Protected logistics management screens for items, movements, equipment requests, receipts, issues, suppliers, assets, and vehicle bookings; supplier/asset/booking writes remain system-admin-only.
- [x] Inventory-staff AI discrepancy analysis grounded in audited movements and reconciliations; signed-in gateway analysis and supplier create/update/delete verified.
- [x] Automatically post receipts, issues, and reconciliations to stock with audit history, staff controls, immutable entries, and signed-in verification.
- [x] Add the listed logistics records with protected access, auditing, and compatibility with existing stock and equipment workflows; operational screens and automated logistics posting are not part of this schema stage.
- [x] Phase 2: connected leave HR processing, registry chain, document approvals/revisions/rollback, global search, private uploads, in-app notifications, audit activity, PDF/Excel/print reports and role-aware summaries.
- [x] Managed email infrastructure for notify.lnpats.net; protected preview verified.
- [ ] Phase 2 email notices — templates and workflow send triggers pending; sender domain is verified.
- [ ] Cryptographic document signatures — currently recorded signer names only; requires the organization's signing identity/certificate provider.
- [x] Extend ERP schema from supplied SQL without replacing existing workflows; match the supplied offices and sections.
- [x] Training module: cadet registration, programs & courses, instructors, attendance registers with absence flags, assessments & results, graduation decisions with certificates and QR verification, dashboards and PDF/Excel reports.
- [x] Finance module: budgets, monitoring alerts, expenses with documents, revenue receipts, cash advances, procurement funding, approval timelines, reports and audit trail.
- [x] Procurement screens: vendors, requisitions, RFQs/comparison, orders, goods receipts, contracts, ratings, dashboard/reports; signed-in request → quotation → approved/sent order → approved receipt → completion/rating and contract renewal verified; PDF/Excel downloaded; temporary operational records removed, audit retained.
- [x] Purchase-order email action connected to verified notify.lnpats.net; delivery not exercised because no recipient was authorized for a test email.
- [ ] Conditional Director procurement approval — waits for the Director role and approval trigger from the organization.
- [x] HR screens: canonical employee registry/files, recruitment, manual/self/QR attendance, two-stage HR leave and recall, appraisals, promotion/transfer decisions, training, discipline, payroll summaries and PDF/Excel/print reports. Signed-in employee/vacancy/attendance/promotion/leave/recall/payroll/appraisal/export verified; temporary records removed and audit retained; 119 tests passed.
- [ ] HR recall entitlement restoration — organizational policy needed; recall currently records the event without crediting unused leave days.
- [ ] External payroll provider linkage — provider and payroll calculation rules needed; current HR payroll is a manually entered salary summary, not payment execution.
- [ ] ICT Helpdesk: tickets, supervisor-approved service requests, incidents, canonical ICT assets, network/account registries, maintenance, knowledge base and reports; verify permissions and signed-in flows.
- [ ] Transport (outside Phase 2 scope)
