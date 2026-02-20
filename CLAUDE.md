# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Status

**JobBuilda v2.0 MVP is DEPLOYED and RUNNING in production!** 🚀

- **Backend**: Railway (https://jobbuilda-production.up.railway.app)
- **Admin Dashboard**: Vercel
- **Client Portal**: Vercel
- **Database**: Supabase PostgreSQL
- **Status**: All 11 MCP services built and operational
- **Deployed**: February 19, 2026

### MVP Architecture Simplifications

The current MVP deployment uses pragmatic simplifications for faster time-to-market:
- **Single Container**: All MCP services run as child processes in the coordinator container (not distributed)
- **Optional NATS**: Event bus is optional/disabled for MVP (events logged but not distributed)
- **Shared Database**: All services use single Supabase PostgreSQL instance (not one DB per service)
- **stdio Transport**: Services communicate via stdio in same container (not HTTP)

These simplifications will be migrated to the full distributed architecture as the system scales.

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

### Current Directory Structure

```
/apps
  /admin                # Admin dashboard (Next.js)
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

| Layer | Technology | MVP Status |
|-------|------------|------------|
| MCP Runtime | Node.js / TypeScript + Fastify | ✅ Deployed |
| Database | Supabase PostgreSQL (shared) | ✅ Configured |
| Messaging | NATS (optional for MVP) | ⚠️ Disabled |
| Observability | OpenTelemetry (code ready) | ⚠️ No backend |
| Auth | Supabase Auth + JWT | ✅ Configured |
| Storage | Supabase Storage | ✅ Available |
| Deployment | Railway (backend) + Vercel (frontend) | ✅ Live |
| Admin | Next.js dashboard | ✅ Deployed |
| Portal | Next.js PWA | ✅ Deployed |
| Email | Resend | ⚠️ Test key |
| PDF | Puppeteer | ✅ Built-in |
| Payments | Stripe | ⚠️ Not configured |

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
- **Secrets**: Railway/Vercel environment variables; never commit secrets to `.env` files
- **Migrations**: Each MCP server maintains its own database migrations (not yet run in production)
- **Transport**: stdio for MVP (services as child processes); HTTP transport available for future scaling

## Development Workflow

### Standard Flow
1. **Define schemas** in `/packages/contracts` (JSON Schema)
2. **Expose resources & tools** in respective MCP server
3. **Orchestrate flows** in Coordinator
4. **Emit events** (logged for MVP; will publish to NATS when enabled)
5. **Trace** via OpenTelemetry (when observability backend is configured)

### Local Development
1. Connect to Supabase for database access
2. Run coordinator with `tsx src/index.ts` (starts all MCP services)
3. Frontend apps connect to local coordinator or Railway API
4. See `.env.example` files for required environment variables

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

| Phase | Focus | Description | Status |
|-------|-------|-------------|--------|
| 1 | Wrapping | Wrap existing REST modules as MCP servers (Identity, Quoting) | ✅ Done |
| 2 | Extraction | Extract Jobs, Invoicing, Payments as new MCP servers | ✅ Done |
| 3 | Coordination | Introduce Coordinator orchestration for Quote→Job→Invoice→Payment | ✅ Done |
| 4 | Full Eventing | Implement event bus; Reporting consumes all events | ⚠️ Events logged, not published |
| 5 | Refactor Portal | Portal reads via Coordinator REST façade only | ✅ Done |

**Current Phase**: MVP deployed! All phases complete except full event distribution (Phase 4).

## Next Steps for Production

### Immediate (Required for Go-Live)
1. **Run Database Migrations**: Initialize all MCP service schemas
2. **Test API Health**: Verify `/api/health` endpoint responds
3. **Test Authentication**: Login to admin dashboard
4. **Configure Custom Domains**: Set up DNS for admin/portal/api subdomains
5. **Production Email Key**: Replace Resend test key with production key

### Short-Term (First Week)
6. **Test Core Workflows**: Quote creation, job tracking, invoicing
7. **Stripe Configuration**: Add production Stripe keys for payments
8. **User Acceptance Testing**: Run through full business workflows
9. **Performance Testing**: Load test API endpoints
10. **Monitoring Setup**: Configure error tracking (Sentry) and uptime monitoring

### Long-Term (Future Scaling)
11. **Enable NATS**: Set up event bus for distributed events
12. **Observability**: Configure Grafana/Tempo for distributed tracing
13. **Scale Architecture**: Migrate to independent service deployments
14. **Database Separation**: Split into per-service databases
15. **CI/CD Pipeline**: Automated testing and deployment

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

## Implementation Status

### ✅ Completed
1. **Monorepo Setup**: ✅ pnpm workspaces
2. **Shared Packages**: ✅ contracts, mcp-sdk, pricing-utils
3. **All 11 MCP Services**: ✅ Built and deployed
4. **Coordinator**: ✅ Orchestrates all services via MCP
5. **Authentication**: ✅ Supabase Auth + JWT validation
6. **Frontend**: ✅ Admin dashboard + client portal
7. **Deployment**: ✅ Railway (backend) + Vercel (frontend)

### ⚠️ Configured but Not Tested
- Database migrations (need to run)
- End-to-end workflows (quote → job → invoice)
- Email sending (using test API key)
- PDF generation (built but not tested)

### 🔮 Future Enhancements
1. **NATS Event Bus**: Enable distributed events for real-time features
2. **Observability Backend**: Configure Grafana/Tempo for tracing
3. **Distributed Services**: Migrate from monolithic container to independent deployments
4. **Per-Service Databases**: Split shared database into service-specific schemas
5. **Stripe Payments**: Configure production Stripe keys
6. **Custom Domains**: Set up admin/portal/api subdomains

## Reference Documentation

- `JobBuilda_MCP_PRD_FRD_v2.0.md`: Comprehensive MCP architecture specification (describes ideal/future architecture)
- `DEPLOYMENT_STATUS_*.md`: Current deployment status and what's actually running (updated regularly)
- `DOCUMENTATION_ALIGNMENT_REVIEW.md`: Comparison of docs vs reality (explains MVP simplifications)
- `PRODUCTION_DEPLOYMENT.md`: Deployment checklist (partially completed)
- `JobBuilda_PRD_FRD_v1.0.md`: Original MVP product requirements (legacy reference)

**Note**: The PRD describes the ideal distributed architecture. The MVP uses simplified deployment (single container, optional NATS, shared DB) for faster time-to-market. See deployment status docs for current reality.
