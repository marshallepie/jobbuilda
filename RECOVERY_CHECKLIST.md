# JobBuilda Operational Recovery Checklist

## Purpose and status

This is the fixed, non-production recovery-release checklist for restoring the established JobBuilda operational flows. It is a verification and release-gating record, not a claim that the flows currently work.

**Current factual baseline:** `apps/coordinator/src/lib/auth.ts` implements server-verified Supabase bearer-token authentication and an active staff-membership lookup, while rejecting caller-selected tenant, user, and scope headers. The required `public.auth_tenant_memberships` schema has not passed its disposable-provider rehearsal or been applied, so production staff access remains fail-closed until R01/R01a/R03 have recorded the required non-production evidence. `apps/coordinator/test/account-isolation-containment.test.ts` verifies the current containment response for unavailable tenant access and for paused registration. The client-portal implementation and its focused test remain in the tree. Therefore all authenticated admin workflows below remain **release blockers** until the stated tests pass.

### Required checklist item structure

Every item below has the following fixed fields:

- **Scope** — bounded existing behaviour to restore; no feature redesign.
- **Observable completion criterion** — externally observable pass condition.
- **Implementation evidence / source area** — current repository areas to inspect or change only when needed.
- **Validation method** — repeatable non-production evidence required before release.
- **Classification** — **release blocker** or **deferred**.

## Release-blocker checklist

### R01 — Admin authentication and authorization

- **Scope:** Restore sign-in, sign-out, session restoration, and server-side authorization for existing administrative users only.
- **Observable completion criterion:** A valid existing administrator can sign in and use permitted routes after reload; an unauthenticated, expired, revoked, or insufficiently privileged request receives an authentication/authorization response without invoking a tenant handler. Server-derived identity, tenant, and scopes are used; caller-supplied tenant, user, or scope headers/query values do not establish authority.
- **Implementation evidence / source area:** `apps/admin/src/contexts/AuthContext.tsx`, `apps/admin/src/components/ProtectedRoute.tsx`, `apps/admin/src/lib/api.ts`, `apps/coordinator/src/lib/auth.ts`, `apps/coordinator/src/lib/account-isolation-containment.ts`, coordinator routes, `services/identity-mcp/`.
- **Validation method:** Non-production integration tests with a real server-verified session and at least one non-admin/expired-or-revoked session; safe route probes for unauthenticated and forged-context requests; browser sign-in/reload/sign-out check. Keep the existing containment test passing until replacement authorization tests prove the safe path.
- **Classification:** **release blocker**.

### R01a — Provider-owned membership schema gate

- **Scope:** Prepare the server-owned staff membership schema without introducing a competing application migration ledger or a browser-readable identity mapping.
- **Observable completion criterion:** The one provider script at `docs/provider-sql/20261107_add_auth_tenant_memberships.sql` has passed a disposable Supabase SQL Editor rehearsal and its required readback. Production application remains blocked until a named Supabase SQL Editor preflight, verified backup, one complete raw-script application, and required readback are recorded. The script is not present in `services/identity-mcp/migrations/`, and public registration remains closed.
- **Implementation evidence / source area:** `docs/provider-sql/20261107_add_auth_tenant_memberships.sql`, `docs/AUTH_TENANT_MEMBERSHIPS_RUNBOOK.md`, `services/identity-mcp/test/membership-migration-artifact.test.mjs`.
- **Validation method:** Run `pnpm --filter @jobbuilda/identity-mcp test:migration-artifact`; in the approved disposable provider project follow the runbook's named SQL Editor preflight, complete-script rehearsal, repeat-run idempotency check, and readback. No database migration is applied from this branch or through node-pg-migrate.
- **Classification:** **release blocker**.

### R02 — Public registration remains closed

- **Scope:** Keep new public registration, free trials, customer creation, and subscription checkout closed while recovery is in progress; do not change existing-account access.
- **Observable completion criterion:** Every public registration entry point returns the documented maintenance response and creates no identity, tenant, Stripe customer, subscription, checkout, payment intent, or other persistent account record. Existing authorized users can still reach the login path.
- **Implementation evidence / source area:** `apps/coordinator/src/routes/subscription.ts`, `apps/coordinator/test/account-isolation-containment.test.ts`, `apps/admin/src/app/signup/page.tsx`, `apps/web/src/app/signup/page.tsx`, `apps/admin/src/contexts/AuthContext.tsx`.
- **Validation method:** Route inventory plus non-production request tests for each registration/onboarding endpoint and UI entry point; spy or disposable-provider assertions that no user/customer/checkout creation call occurs. Do not use real payment credentials.
- **Classification:** **release blocker**.

### R03 — Tenant and client isolation

- **Scope:** Restore access only when the server-verified principal has an active durable membership for the selected tenant; preserve client-level boundaries for all reads and writes.
- **Observable completion criterion:** Two tenants and two clients can operate their own records, while cross-tenant/client list, direct-ID, write, PDF, receipt, export, payment, and download attempts are denied or return no resource. Forged client context cannot select another tenant.
- **Implementation evidence / source area:** `packages/contracts/src/schemas/shared/auth-context.ts`, `apps/coordinator/src/lib/auth.ts`, `apps/coordinator/src/lib/account-isolation-containment.ts`, `apps/coordinator/src/routes/`, `services/*/src/resources/`, `services/*/src/tools/`, tenant-scoped migrations.
- **Validation method:** Database-backed non-production authorization matrix covering each coordinator route and affected MCP tool/resource with two tenants/two clients; retain and extend `apps/coordinator/test/account-isolation-containment.test.ts` with positive authorized cases before removing containment.
- **Classification:** **release blocker**.

### R04 — Admin dashboard, clients, and sites

- **Scope:** Restore existing dashboard and client/site list, detail, create, edit, and delete/manage behaviours for authorized tenant staff.
- **Observable completion criterion:** An authorized user can complete the current dashboard, client, and site workflows and see only their tenant's records; invalid/cross-tenant identifiers are rejected; existing records remain unchanged except for deliberate test records in a disposable environment.
- **Implementation evidence / source area:** `apps/admin/src/app/dashboard/page.tsx`, `apps/admin/src/app/clients/`, `apps/admin/src/components/CreateClientModal.tsx`, `apps/admin/src/components/CreateSiteModal.tsx`, `apps/coordinator/src/routes/clients.ts`, `services/clients-mcp/`.
- **Validation method:** Browser and API tests in a disposable non-production dataset, including tenant isolation cases and existing-record read checks. Do not use production records for write testing.
- **Classification:** **release blocker**.

### R05 — Jobs, time, and materials

- **Scope:** Restore existing job create/manage/status workflows plus time logging and material assignment/usage without changing established financial or lifecycle rules.
- **Observable completion criterion:** An authorized tenant user can create and manage a job, log time, and record/assign materials; resulting job, time, and material records are tenant-scoped and reflect the expected status/quantities. Unauthorized or cross-tenant operations fail.
- **Implementation evidence / source area:** `apps/admin/src/app/jobs/`, `apps/admin/src/app/materials/page.tsx`, `apps/coordinator/src/routes/jobs.ts`, `apps/coordinator/src/routes/materials.ts`, `services/jobs-mcp/`, `services/materials-mcp/`.
- **Validation method:** Disposable-data workflow test through the admin UI and coordinator/MCP integration tests, including direct-ID and forged-context negative cases; verify a pre-existing record is not mutated by recovery tests.
- **Classification:** **release blocker**.

### R06 — Quotes: create, send, and approve

- **Scope:** Restore established quote creation, editing, item management, sending, viewing, and approval paths, including any existing client-facing approval link flow.
- **Observable completion criterion:** An authorized tenant user can create and send a quote; the intended recipient can use the established authorized/link path to view and approve it once; quote status and related job conversion behaviour, where configured, are correct and isolated. No real client receives a recovery test email.
- **Implementation evidence / source area:** `apps/admin/src/app/quotes/`, `apps/coordinator/src/routes/quoting.ts`, `apps/coordinator/src/routes/share.ts`, `apps/coordinator/src/routes/email.ts`, `services/quoting-mcp/`, `apps/portal/src/app/view/page.tsx`.
- **Validation method:** Disposable-data integration/browser test using a local capture mailbox or approved non-production email sink; test replay/expired/foreign link and cross-tenant quote access; inspect status transitions and associated records.
- **Classification:** **release blocker**.

### R07 — Invoices: create, edit, send, and history

- **Scope:** Restore existing invoice create/edit/send/detail/history behaviour while preserving issued and reconciled record rules.
- **Observable completion criterion:** An authorized tenant user can create and edit an invoice only in states permitted by the established application, send it through the configured non-production delivery path, and retrieve accurate tenant/client-scoped history. Draft, void, and foreign records are not exposed where the existing rules exclude them.
- **Implementation evidence / source area:** `apps/admin/src/app/invoices/`, `apps/coordinator/src/routes/invoicing.ts`, `apps/coordinator/src/routes/email.ts`, `services/invoicing-mcp/`, `services/invoicing-mcp/migrations/`.
- **Validation method:** Disposable-data browser/API workflow tests; state-transition and cross-tenant direct-ID tests; delivery captured in a test sink. Compare calculated totals/balances before and after permitted edits. Do not send to a real client.
- **Classification:** **release blocker**.

### R08 — Payments, recorded balances, and payment history

- **Scope:** Restore manual payment recording and existing payment/balance/history displays; assess provider checkout/reconciliation only where an existing workflow depends on it.
- **Observable completion criterion:** A permitted payment record updates the invoice amount paid, amount due, status, and history exactly once; duplicate/replayed/manual unauthorized actions do not double-apply a payment. Provider-backed checkout/reconciliation is available only after its configured non-production path passes its own verification gate.
- **Implementation evidence / source area:** `apps/coordinator/src/routes/payments.ts`, `apps/coordinator/src/routes/invoicing.ts`, `services/invoicing-mcp/src/tools/record-payment.ts`, `services/invoicing-mcp/src/tools/void-payment.ts`, `services/payments-mcp/`, `apps/coordinator/src/lib/stripe.ts`.
- **Validation method:** Database-backed disposable-data tests for full, partial, duplicate, void/correction (if implemented), and cross-tenant cases; provider tests use a disposable/sandbox configuration only. Confirm accounting totals and history directly from the non-production database and API.
- **Classification:** **release blocker**.

### R09 — Existing client portal and link access

- **Scope:** Preserve and restore existing client portal access, magic-link handling, legacy-link compatibility where configured, invoice visibility/download, and invoice payment initiation.
- **Observable completion criterion:** A client with an active membership can request and redeem a single-use expiring access link, restore a session after reload, view only allowed non-draft/non-void invoices for the selected membership, download only those PDFs, and initiate payment only for an eligible balance. Revoked, expired, replayed, foreign-client, and forged-header attempts fail.
- **Implementation evidence / source area:** `apps/coordinator/migrations/001_client_portal.sql`, `apps/coordinator/src/routes/client-portal.ts`, `apps/coordinator/test/client-portal.test.ts`, `apps/portal/src/app/auth/page.tsx`, `apps/portal/src/app/invoices/`, `apps/portal/src/app/payment/`, `apps/portal/src/components/ProtectedLayout.tsx`.
- **Validation method:** Database-backed portal tests with two tenants/two clients plus browser reload/session/CSRF checks; test access-link non-enumeration, expiry, consumption/replay, revocation, direct-ID invoice/PDF access, membership selection, and checkout eligibility. Use a non-production mailbox sink and payment sandbox only.
- **Classification:** **release blocker**.

### R10 — Receipts, PDFs, and operational email delivery

- **Scope:** Restore existing receipt handling, generated invoice/quote PDF paths, and operational email delivery required by the restored flows.
- **Observable completion criterion:** Authorized and appropriately scoped users/clients can obtain only their permitted PDF/receipt artifacts; generated documents contain the intended record data; required send actions reach the configured non-production capture destination without exposing tokens, cross-tenant data, or real recipients.
- **Implementation evidence / source area:** `apps/coordinator/src/routes/receipts.ts`, `apps/coordinator/src/routes/pdf.ts`, `apps/coordinator/src/routes/email.ts`, `apps/coordinator/src/lib/pdf.ts`, `apps/coordinator/src/lib/email.ts`, `apps/coordinator/src/routes/client-portal.ts`, `apps/admin/src/components/ReceiptScanModal.tsx`.
- **Validation method:** Safe unauthenticated and cross-tenant route probes; disposable-data document generation and content review; non-production email sink inspection, including attachments/links and recipient selection. Do not send recovery tests to real client addresses.
- **Classification:** **release blocker**.

### R11 — Event delivery dependency assessment (no NATS provisioning)

- **Scope:** Determine, from actual restored workflow execution, whether event delivery is a prerequisite for each release-blocking workflow; do not provision, reconfigure, or require NATS merely because event-bus code exists.
- **Observable completion criterion:** For each R04–R10 workflow, the release record identifies the concrete synchronous dependency and any emitted/consumed event dependency, with evidence from code and non-production execution. A workflow that does not rely on event consumption to complete may release without NATS; a workflow that does rely on it remains blocked until its existing configured delivery path is verified.
- **Implementation evidence / source area:** `docs/R11_EVENT_DELIVERY_DEPENDENCY_ASSESSMENT.md` (source-only assessment record), `apps/coordinator/src/server.ts`, `services/*/src/lib/event-bus.ts`, `services/*/src/index.ts`, relevant tools/routes, `infra/docker-compose.dev.yml`, and emitted-event/outbox migrations where present.
- **Validation method:** Trace each workflow from route/UI through tool/service to completion; collect non-production logs/traces and event/outbox evidence only for workflows found to depend on it. Record the result per workflow in the release evidence, not by inference from `README.md`.
- **Classification:** **release blocker** for assessment and for any workflow proven event-dependent; **deferred** for NATS provisioning itself.

## Deferred items

### D01 — NATS infrastructure provisioning

- **Scope:** New or replacement NATS/JetStream provisioning, topology changes, and operational tuning.
- **Observable completion criterion:** Not part of this recovery release. It may be scheduled only after R11 identifies a concrete production workflow dependency and an approved infrastructure change plan exists.
- **Implementation evidence / source area:** `infra/docker-compose.dev.yml`, deployment/infrastructure documentation, `services/*/src/lib/event-bus.ts`.
- **Validation method:** No action in this branch. Re-open as a separate infrastructure change with environment-specific review and verification.
- **Classification:** **deferred**.

### D02 — Product redesign or net-new functionality

- **Scope:** UI redesign, changes to product rules, new portal capabilities, new registration/onboarding, payment product changes, data-model redesign, or unrelated performance/observability work.
- **Observable completion criterion:** Excluded from this recovery release; no acceptance criterion may be substituted with a redesigned flow.
- **Implementation evidence / source area:** Entire repository; changes require separate scoped work.
- **Validation method:** Review the recovery diff against R01–R11 and reject unrelated feature work.
- **Classification:** **deferred**.

## Explicit non-goals

- Do not reopen public registration, trials, or subscription checkout.
- Do not weaken containment or restore caller-controlled identity headers as an authorization mechanism.
- Do not create, delete, reset, or modify production records as a test shortcut.
- Do not send recovery-test email to real client addresses or create a real payment/checkout session.
- Do not provision NATS or make NATS availability a blanket release requirement; use R11's workflow-specific evidence.
- Do not redesign the admin, client portal, data model, permissions, financial lifecycle, or user journeys while restoring established behaviour.
- Do not apply migrations, deploy, or alter provider configuration from this recovery branch without separately approved operational execution.

## Release safeguards

1. **No destructive reset:** preserve existing records; no destructive database reset, truncate, broad delete, or production seed operation. Recovery tests use a disposable non-production dataset.
2. **Backup and rollback first:** before a production migration or deploy, take and verify a restorable backup; document the exact application/database versions and a tested rollback procedure. Do not begin production execution without both.
3. **Migration discipline:** for the staff-membership schema, use only the named Supabase SQL Editor procedure in `docs/AUTH_TENANT_MEMBERSHIPS_RUNBOOK.md`: backup, named provider preflight, disposable raw-script rehearsal, one complete raw transaction, then required readback. Do not run it through node-pg-migrate or create a competing ledger. Production migration and compatible application release must be coordinated; no migration is applied by this checklist document.
4. **Provider safety:** use only test/disposable email and payment configurations for validation; confirm environment separation before every test.
5. **Authorization before availability:** no contained tenant route may be reopened until R01 and R03 have passed their server-side, database-backed checks.
6. **Evidence before release:** record the command/test result, environment, fixture identifiers, and reviewer for every R01–R11 release-blocking item. Unknowns remain explicit verification gates and block release rather than being inferred as passing.
7. **Deployment controls:** use a staged non-production deployment first, verify safe unauthenticated route probes and authorized workflows, and retain a rollback window before production exposure.

## Release decision

Release is permitted only when every release-blocking item above has recorded passing non-production evidence and all safeguards have been satisfied. Deferred items are not implicitly approved; they remain outside this branch's recovery scope.
