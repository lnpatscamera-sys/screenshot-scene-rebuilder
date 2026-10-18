# LNPATS ERP Roadmap

## Phase 1 (now)
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
- [ ] Phase 2 email notices — templates and workflow send triggers pending; delivery waits for sender DNS verification.
- [ ] Cryptographic document signatures — currently recorded signer names only; requires the organization's signing identity/certificate provider.
- [x] Extend ERP schema from supplied SQL without replacing existing workflows; match the supplied offices and sections.
- [ ] Training, Finance, Procurement, Transport, HR, ICT helpdesk (outside Phase 2 scope)
