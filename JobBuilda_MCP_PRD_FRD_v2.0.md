# 🧩 JobBuilda MCP Architecture – Product & Functional Requirements (PRD + FRD)

**Version:** v2.0 (MCP Modular Design)  
**Date:** October 2025  
**Owner:** Marshall Epie  
**Repository:** [github.com/marshallepie/jobbuilda](https://github.com/marshallepie/jobbuilda)

---

## 📘 Table of Contents
1. [Overview](#1-overview)
2. [MCP-Based Vision](#2-mcp-based-vision)
3. [System Goals](#3-system-goals)
4. [Architecture Summary](#4-architecture-summary)
5. [Core MCP Servers (Modules)](#5-core-mcp-servers-modules)
6. [Coordinator Client](#6-coordinator-client)
7. [Cross-Cutting Concerns](#7-cross-cutting-concerns)
8. [Security & Compliance](#8-security--compliance)
9. [Data Ownership & APIs](#9-data-ownership--apis)
10. [Transport & Deployment](#10-transport--deployment)
11. [Event Model](#11-event-model)
12. [Repo Layout](#12-repo-layout)
13. [Development Flow](#13-development-flow)
14. [Example MCP Server Manifest](#14-example-mcp-server-manifest)
15. [Coordinator Orchestration Example](#15-coordinator-orchestration-example)
16. [Migration Plan](#16-migration-plan)
17. [Tech Stack](#17-tech-stack)
18. [Next Steps](#18-next-steps)

---

## 1. Overview
JobBuilda v2.0 transitions from a monolithic REST system into a **fully modular, event-driven ecosystem** powered by the **Model Context Protocol (MCP)**.  
Each functional area (Auth, Clients, Quotes, Jobs, Invoicing, etc.) becomes its own **MCP Server**, exposing standard MCP resources, tools, and prompts.

The Coordinator (main backend) connects to all MCP servers, orchestrates workflows, and ensures tenant-level security and policy enforcement.

---

## 2. MCP-Based Vision
> "Each module in JobBuilda is an autonomous agent exposing tools and resources via MCP — orchestrated together through a Coordinator."

- Each module = independent MCP server with local database + event stream.
- Coordinator = single MCP client (orchestrator) managing workflow + context propagation.
- Communication = REST + MCP streams + event bus.
- Client app and portal only talk to the Coordinator (never directly to modules).

---

## 3. System Goals
| Goal | Description |
|------|--------------|
| **Autonomy** | Each module runs, scales, and deploys independently. |
| **Composability** | Modules can be reused or extended without breaking others. |
| **Observability** | Trace every request end-to-end using OpenTelemetry. |
| **Compliance** | Built-in GDPR export/delete; HMRC VAT consistency. |
| **Extensibility** | New modules or external agents can join via MCP spec. |

---

## 4. Architecture Summary
**Modules = MCP Servers**  
**Coordinator = MCP Client + REST façade**  
**Event bus = NATS/Kafka for async workflows**  
**Frontend = PWA / Portal consuming REST endpoints only**

---

## 5. Core MCP Servers (Modules)

| MCP Server | Key Responsibilities | Example Tools |
|-------------|----------------------|----------------|
| **identity-mcp** | Auth, tenants, RBAC, portal tokens | `issue_portal_token`, `check_permission` |
| **clients-mcp** | Clients, sites, GDPR compliance | `create_client`, `export_client`, `delete_client` |
| **suppliers-mcp** | Supplier catalog & live pricing | `refresh_price`, `search_catalog` |
| **quoting-mcp** | Leads, quotes, approvals | `create_quote`, `send_quote`, `approve_quote` |
| **jobs-mcp** | Job scheduling & time tracking | `create_job`, `assign_job`, `start_timer`, `complete_job` |
| **materials-mcp** | Planned/used materials | `scan_material`, `add_material` |
| **variations-mcp** | Job variations approval | `propose`, `approve` |
| **tests-mcp** | Compliance tests, certificates | `record_result`, `generate_certificate` |
| **invoicing-mcp** | Invoice assembly & sending | `assemble_invoice`, `send_invoice` |
| **payments-mcp** | Stripe checkout, reconciliation | `create_checkout`, `reconcile_payment` |
| **reporting-mcp** | P&L, VAT, exports | `export_csv`, `generate_report` |

---

## 6. Coordinator Client
Acts as the **conductor** of the system.

- Connects to all MCP servers via stdio or HTTP transports.
- Manages **tenant context**, **auth propagation**, and **workflow orchestration**.
- Implements higher-level flows (Quote → Job → Invoice → Payment).
- Provides REST + GraphQL façade for frontend and external integrations.

---

## 7. Cross-Cutting Concerns
| Concern | Implementation |
|----------|----------------|
| **Observability** | OpenTelemetry spans; `x-request-id` and `tenant_id` propagate across all servers. |
| **Secrets** | Vault / Cloud KMS; no secrets in `.env`. |
| **Rate limits** | Enforced at Coordinator gateway; internal network policies limit inter-service calls. |
| **Migrations** | Each MCP server maintains its own migrations; blue-green deployment with pre-migrate hook. |
| **Compliance** | GDPR export/delete; VAT rounding shared library. |
| **Security** | Signed short-lived portal tokens; presigned S3 uploads only. |

---

## 8. Security & Compliance
- **Auth context** includes `{tenant_id, user_id, scopes}` on every MCP call.
- **GDPR:** clients-mcp exposes `export` and `delete` tools for client data.  
- **HMRC VAT:** centralized pricing library `/packages/pricing-utils` ensures consistent tax rounding.
- **Portal tokens:** JWTs with 15–60 min TTL, single-purpose claim.  
- **Media uploads:** presigned URLs validated by Media service after upload.

---

## 9. Data Ownership & APIs
- Each MCP server owns its data; no cross-table reads.  
- Read → via `resources`; write → via `tools`.  
- Events used for derived data and reporting.  
- Coordinator handles joins/compositions at the API layer.

---

## 10. Transport & Deployment
| Environment | Transport | Notes |
|--------------|------------|-------|
| Local dev | `stdio` | Fast iteration and debugging |
| Production | Streamable HTTP | Resilient to network timeouts |
| Event bus | NATS / Kafka | Async domain events |
| Auth | mTLS / service tokens | Internal MCP authentication |

---

## 11. Event Model
Standard envelope for all events:
```json
{
  "id": "uuid",
  "type": "quote.approved",
  "tenant_id": "uuid",
  "occurred_at": "2025-10-21T16:20:00Z",
  "actor": {"user_id": "uuid"},
  "data": { ... },
  "schema": "urn:jobbuilda:events:quote.approved:1"
}
```

---

## 12. Repo Layout
```
/apps
  /coordinator          # REST + GraphQL façade; orchestrator
  /portal               # Public client portal (Next.js)
/services
  /identity-mcp
  /clients-mcp
  /suppliers-mcp
  /quoting-mcp
  /jobs-mcp
  /materials-mcp
  /variations-mcp
  /tests-mcp
  /invoicing-mcp
  /payments-mcp
  /reporting-mcp
/packages
  /contracts            # Shared JSON Schemas for DTOs & events
  /pricing-utils        # VAT + markup calculations
  /mcp-sdk              # Typed SDK for MCP clients
/infra
  /helm /terraform /actions
```

---

## 13. Development Flow
1. **Define schemas** → `/packages/contracts` (JSON Schema).  
2. **Expose resources & tools** in each MCP server.  
3. **Orchestrate** flows in Coordinator.  
4. **Emit events** to event bus for async updates.  
5. **Trace** via OpenTelemetry for debugging and metrics.

---

## 14. Example MCP Server Manifest (Quoting)
```json
{
  "name": "quoting-mcp",
  "version": "1.0.0",
  "resources": [
    {"uri": "res://quoting/quotes/{id}", "schema": "urn:jobbuilda:quote:1"}
  ],
  "tools": [
    {"name": "create_quote", "input_schema": "urn:jobbuilda:create_quote_input:1"},
    {"name": "approve_quote", "input_schema": "urn:jobbuilda:approve_quote_input:1"},
    {"name": "send_quote", "input_schema": "urn:jobbuilda:send_quote_input:1"}
  ],
  "prompts": [
    {"name": "draft_quote_from_notes", "input_schema": "urn:jobbuilda:draft_prompt_input:1"}
  ]
}
```

---

## 15. Coordinator Orchestration Example
```ts
const ctx = {tenant_id, user_id, x_request_id};

// Step 1: Create quote
const quote = await mcp.quoting.tools.create_quote.invoke(ctx, payload);

// Step 2: Enrich material prices
for (const i of quote.items.filter(it => it.kind === 'material')) {
  const price = await mcp.suppliers.resources.get(`res://prices/${i.sku}`, ctx);
  i.unit_price = price.price_ex_vat * (1 + (i.markup_percent || 0)/100);
}

// Step 3: Send to client
await mcp.quoting.tools.send_quote.invoke(ctx, {quote_id: quote.id});

return {quote_id: quote.id, status: 'SENT'};
```

---

## 16. Migration Plan
| Phase | Focus | Description |
|--------|--------|-------------|
| **1** | Wrapping | Wrap existing REST modules as MCP servers (Identity, Quoting). |
| **2** | Extraction | Extract Jobs, Invoicing, Payments as new MCP servers. |
| **3** | Coordination | Introduce Coordinator orchestration for Quote→Job→Invoice→Payment. |
| **4** | Full Eventing | Implement event bus; Reporting consumes all events. |
| **5** | Refactor Portal | Portal reads via Coordinator REST façade only. |

---

## 17. Tech Stack
| Layer | Technology |
|--------|-------------|
| MCP Runtime | Node.js / TypeScript (Fastify / NestJS) |
| Database | Postgres per module |
| Messaging | NATS / Kafka |
| Observability | OpenTelemetry + Grafana Tempo |
| Auth | Supabase Auth + service tokens |
| Storage | S3 / Supabase Storage |
| Deployment | Docker + k8s + CI/CD (GitHub Actions) |

---

## 18. Next Steps
1. Generate `/packages/contracts` with schemas for quotes, jobs, invoices, and events.  
2. Create skeleton MCP servers: **quoting-mcp**, **jobs-mcp**, **invoicing-mcp**.  
3. Implement **Coordinator** with initial workflow orchestration.  
4. Set up **OpenTelemetry + Vault** baseline for all modules.  
5. Define **event catalog** (`/docs/events.md`) shared by all servers.

---

**End of Document – JobBuilda v2 MCP PRD/FRD**
