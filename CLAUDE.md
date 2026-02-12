# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Status

**JobBuilda is currently in the planning phase with no implementation yet.** The repository contains comprehensive PRD (Product Requirements Documents) but zero production code. When working in this repo, you'll be building from scratch following the documented MCP-based architecture.

## Architecture Overview

JobBuilda v2.0 is designed as a **modular, event-driven ecosystem powered by the Model Context Protocol (MCP)**. Each functional area becomes its own MCP Server exposing standard MCP resources, tools, and prompts.

### Core Components

- **Coordinator** (`/apps/coordinator`): REST + GraphQL façade that orchestrates workflows across all MCP servers. Acts as the single entry point for frontend applications.
- **MCP Servers** (`/services/*-mcp`): Independent microservices, each owning its data and exposing MCP resources/tools:
  - `identity-mcp`: Auth, tenants, RBAC, portal tokens
  - `clients-mcp`: Clients, sites, GDPR compliance
  - `suppliers-mcp`: Supplier catalog & live pricing
  - `quoting-mcp`: Leads, quotes, approvals
  - `jobs-mcp`: Job scheduling & time tracking
  - `materials-mcp`: Planned/used materials
  - `variations-mcp`: Job variations approval
  - `tests-mcp`: Compliance tests, certificates
  - `invoicing-mcp`: Invoice assembly & sending
  - `payments-mcp`: Stripe checkout, reconciliation
  - `reporting-mcp`: P&L, VAT, exports
- **Shared Packages** (`/packages/*`):
  - `contracts`: JSON Schemas for DTOs & events
  - `pricing-utils`: VAT + markup calculations (HMRC-compliant rounding)
  - `mcp-sdk`: Typed SDK for MCP clients
- **Portal** (`/apps/portal`): Public client portal (Next.js PWA)

### Planned Directory Structure

```
/apps
  /coordinator          # Orchestrator + REST/GraphQL API
  /portal               # Client-facing Next.js app
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
  /contracts
  /pricing-utils
  /mcp-sdk
/infra
  /helm
  /terraform
  /actions
```

## Tech Stack

| Layer | Technology |
|-------|------------|
| MCP Runtime | Node.js / TypeScript (Fastify / NestJS) |
| Database | PostgreSQL (one per MCP server) |
| Messaging | NATS / Kafka for event bus |
| Observability | OpenTelemetry + Grafana Tempo |
| Auth | Supabase Auth + service tokens |
| Storage | S3 / Supabase Storage |
| Deployment | Docker + Kubernetes + GitHub Actions |
| Portal | Next.js (React PWA) |
| Payments | Stripe |

## Key Architectural Principles

### Data Ownership
- Each MCP server owns its data; **no cross-table reads**
- Read data via MCP `resources`, write via MCP `tools`
- Use events for derived data and reporting
- Coordinator handles joins/compositions at API layer

### Security & Compliance
- Auth context `{tenant_id, user_id, scopes}` propagates on every MCP call
- **GDPR**: `clients-mcp` exposes `export` and `delete` tools for client data
- **HMRC VAT**: Centralized pricing library `/packages/pricing-utils` ensures consistent tax rounding
- **Portal tokens**: JWTs with 15-60 min TTL, single-purpose claims
- **Media uploads**: Presigned URLs only, validated after upload

### Event Model
Standard envelope for all domain events:
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

### Cross-Cutting Concerns
- **Observability**: OpenTelemetry spans; `x-request-id` and `tenant_id` propagate across all servers
- **Secrets**: Use Vault / Cloud KMS; never commit secrets to `.env` files
- **Migrations**: Each MCP server maintains its own database migrations
- **Transport**: stdio for local dev, streamable HTTP for production, mTLS for internal MCP auth

## Development Workflow

### Standard Flow (when code exists)
1. **Define schemas** in `/packages/contracts` (JSON Schema)
2. **Expose resources & tools** in respective MCP server
3. **Orchestrate flows** in Coordinator
4. **Emit events** to event bus for async updates
5. **Trace** via OpenTelemetry for debugging

### Example MCP Orchestration Pattern
```typescript
const ctx = {tenant_id, user_id, x_request_id};

// Step 1: Create quote
const quote = await mcp.quoting.tools.create_quote.invoke(ctx, payload);

// Step 2: Enrich material prices from suppliers-mcp
for (const i of quote.items.filter(it => it.kind === 'material')) {
  const price = await mcp.suppliers.resources.get(`res://prices/${i.sku}`, ctx);
  i.unit_price = price.price_ex_vat * (1 + (i.markup_percent || 0)/100);
}

// Step 3: Send to client
await mcp.quoting.tools.send_quote.invoke(ctx, {quote_id: quote.id});
```

## Migration Plan (5 Phases)

| Phase | Focus | Description |
|-------|-------|-------------|
| 1 | Wrapping | Wrap existing REST modules as MCP servers (Identity, Quoting) |
| 2 | Extraction | Extract Jobs, Invoicing, Payments as new MCP servers |
| 3 | Coordination | Introduce Coordinator orchestration for Quote→Job→Invoice→Payment |
| 4 | Full Eventing | Implement event bus; Reporting consumes all events |
| 5 | Refactor Portal | Portal reads via Coordinator REST façade only |

## Core Workflows

The system orchestrates the following high-level business flows:

1. **Lead Management**: Capture leads with initial client info
2. **Quoting**: Create quotes with materials/labor, send to clients for approval
3. **Job Execution**: Convert approved quotes to jobs, track time, scan materials used
4. **Variations**: Handle scope changes with client approval
5. **Testing**: Record compliance test results, generate certificates
6. **Invoicing**: Assemble invoices from jobs + variations + materials
7. **Payment**: Stripe checkout, reconcile payments
8. **Accounting**: Generate P&L, VAT returns (HMRC MTD compliant)

## Important Context

### User Types
- **Admin/Tradesman**: Primary user (electrician) managing jobs end-to-end
- **Additional Technicians**: Field workers tracking time, scanning materials
- **Clients**: View job progress, approve quotes/variations, pay invoices via portal

### Compliance Requirements
- **GDPR**: Full export/delete capability for client data
- **HMRC VAT**: Consistent rounding rules for VAT calculations (must match UK HMRC rules)
- **Electrical Testing**: Store compliance test results with certificate generation

### Storage Patterns
- **Media/Photos**: Presigned S3 uploads; metadata stored in respective MCP server DBs
- **Certificates**: Generated PDFs stored in S3, references in `tests-mcp`
- **Invoices**: Generated PDFs stored in S3, references in `invoicing-mcp`

## Future Implementation Notes

When implementing this system, prioritize:

1. **Monorepo Setup**: Choose a monorepo tool (Nx, Turborepo, etc.) for workspace management
2. **Shared Packages First**: Implement `/packages/contracts` and `/packages/pricing-utils` before MCP servers
3. **Start with Identity**: `identity-mcp` must be implemented first as it handles auth for all other services
4. **Coordinator Early**: Build Coordinator skeleton early to validate orchestration patterns
5. **Event Bus**: Set up NATS/Kafka early for async communication between services
6. **OpenTelemetry Baseline**: Instrument all services from the start for distributed tracing

## Reference Documentation

- `JobBuilda_MCP_PRD_FRD_v2.0.md`: Comprehensive MCP architecture specification (primary reference)
- `JobBuilda_PRD_FRD_v1.0.md`: Original MVP product requirements (legacy reference)
