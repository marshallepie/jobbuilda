# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Status

JobBuilda v2.0 MVP is **deployed and running in production**:
- **Coordinator API**: Railway (https://jobbuilda-production.up.railway.app)
- **Admin Dashboard**: Vercel (`apps/admin`)
- **Client Portal**: Vercel (`apps/portal`)
- **Database**: Supabase PostgreSQL (shared across all MCP services in MVP)
- **Deployed**: February 2026

## Commands

```bash
# Install dependencies
pnpm install

# Run everything (coordinator + admin + portal) with Docker services
pnpm dev:core

# Run individual apps
pnpm -F @jobbuilda/coordinator dev      # API on :3000
pnpm -F @jobbuilda/admin dev            # Admin on :3002
pnpm -F @jobbuilda/portal dev           # Portal on :3001

# Build
pnpm build                              # all packages via Turbo
pnpm -F @jobbuilda/coordinator build    # coordinator only

# Type-check a specific package
pnpm -F @jobbuilda/coordinator exec tsc --noEmit
pnpm -F @jobbuilda/admin exec tsc --noEmit

# Lint
pnpm lint                               # all via Turbo
pnpm -F @jobbuilda/admin lint

# Docker (NATS + local DB for development)
pnpm docker:up
pnpm docker:down
pnpm docker:logs
```

**Port assignments:** coordinator `:3000` · portal `:3001` · admin `:3002`

## Architecture

### Request Flow

```
Browser (admin/portal)
  → Coordinator (Fastify REST API, port 3000)
    → MCPClient (stdio transport, child process per service)
      → MCP Server (reads/writes its own DB tables)
```

The coordinator is the **only** entry point. Frontends never call MCP services directly. The coordinator exposes REST routes; each route delegates to one or more MCP services via `fastify.mcp.<service>.readResource(uri, context)` or `fastify.mcp.<service>.callTool(toolName, args, context)`.

### MCP Services (`/services/*-mcp`)

Each service owns its own DB tables and exposes:
- **Resources** (`src/resources/`) — read data via URI pattern `res://service-name/resource-type[/id]`
- **Tools** (`src/tools/`) — write operations registered in `src/tools/index.ts`
- **Migrations** (`migrations/`) — numbered SQL files, run manually against Supabase

The `query()` helper in each service's `src/lib/database.ts` handles connection pooling and OTel tracing. All services share a single Supabase instance in this MVP (future: per-service databases).

### Adding to an MCP Service

1. **New resource:** add a URI pattern match in `src/resources/<name>.ts`, register in `src/resources/index.ts`
2. **New tool:** add handler in `src/tools/<name>.ts`, register in `src/tools/index.ts` (both `ListToolsRequestSchema` and `CallToolRequestSchema` switch)
3. **New migration:** add `services/<name>-mcp/migrations/NNN_description.sql`, run manually against Supabase
4. **New coordinator route:** add `src/routes/<name>.ts`, import in `src/server.ts`, call `fastify.register()`

### Coordinator Route Pattern

```typescript
fastify.get<{ Params: { id: string } }>('/api/resource/:id', async (request, reply) => {
  const context = extractAuthContext(request);
  const result = await fastify.mcp.serviceName.readResource(`res://service/resource/${id}`, context);
  return result.data;
});
```

`extractAuthContext` pulls `tenant_id`, `user_id`, and `scopes` from the JWT header and passes them on every MCP call — this is how multi-tenancy is enforced.

### Admin Frontend Pattern

Every admin page starts with mock auth (real Supabase auth not yet wired):

```typescript
api.setAuth({
  token: 'mock-jwt-token',
  tenant_id: '550e8400-e29b-41d4-a716-446655440000',
  user_id: '550e8400-e29b-41d4-a716-446655440001',
});
const data = await api.request('/api/endpoint') as any;
```

`api` is the singleton `ApiClient` from `apps/admin/src/lib/api.ts`. It sets auth in `localStorage` and sends it as a Bearer token header.

### Shared Utilities

| Utility | Location | Purpose |
|---------|----------|---------|
| `formatCurrency(amount)` | `apps/admin/src/lib/utils.ts` | GBP formatting, accepts `string \| number` |
| `formatDate(date)` | same | en-GB date formatting, null-safe |
| `getStatusColor(status)` | same | Tailwind badge classes for all entity statuses |
| `calculateVAT / addVAT` | `packages/pricing-utils/src/vat.ts` | HMRC-compliant VAT rounding |
| `applyMarkup` | `packages/pricing-utils/src/markup.ts` | Markup calculations |
| `MCPClient` | `packages/mcp-sdk/src/client.ts` | Typed stdio MCP client with auth propagation |

### Quote → Invoice Balance Ledger

Invoices have a `quote_id` FK (migration 009) linking them to their originating quote. The `res://invoicing/quote-invoices/{quote_id}` resource computes: total invoiced, total paid, outstanding, and remaining balance (quote total − total invoiced). Always pass `quote_id` when creating invoices from a quote.

### Portal Share Flow

Clients access quotes/invoices via a signed token URL. The coordinator's `/api/share/*` routes generate tokens; the portal decodes them client-side and calls `/api/share/<type>/<id>/details` to fetch document data without requiring a full login.

## Key Architectural Constraints

- **No cross-service DB queries.** Read another service's data via its MCP resource, never by querying its tables directly.
- **Auth context on every MCP call.** `{tenant_id, user_id, scopes}` must propagate so each service can enforce tenant isolation.
- **HMRC VAT rounding.** Always use `packages/pricing-utils` — never write raw `* 0.2` calculations.
- **Presigned URLs for files.** Media, PDFs, and certificates use presigned S3 URLs — never serve binaries through the coordinator.
- **NATS is disabled.** Events are logged but not published in the MVP. Don't add code that depends on NATS being available.

## Environment Variables

Each app/service has its own `.env.example`. Key variables:

| Variable | Where | Notes |
|----------|-------|-------|
| `DATABASE_URL` | each `*-mcp` service | Supabase connection string |
| `ANTHROPIC_API_KEY` | coordinator | Required for AI features; returns 503 if missing at request time |
| `RESEND_API_KEY` | coordinator | Use `re_123` for dev (emails won't send) |
| `STRIPE_SECRET_KEY` | coordinator | `sk_test_...` for dev |
| `STRIPE_QUOTE_WEBHOOK_SECRET` | coordinator | Webhook validation |
| `JWT_SECRET` | coordinator + MCP services | Must match across all |
| `NEXT_PUBLIC_API_URL` | admin + portal | Points to coordinator (`http://localhost:3000` in dev) |

## MCP Services Reference

| Service | Owns |
|---------|------|
| `identity-mcp` | Tenants, users, RBAC, business profiles, portal tokens |
| `clients-mcp` | Clients, sites, GDPR export/delete |
| `suppliers-mcp` | Supplier catalogue, live pricing |
| `quoting-mcp` | Leads, quotes, quote items, approvals |
| `jobs-mcp` | Jobs, time tracking |
| `materials-mcp` | Planned and used materials |
| `variations-mcp` | Scope change approvals |
| `tests-mcp` | Compliance tests, certificates |
| `invoicing-mcp` | Invoices, invoice items, payments, quote balance ledger |
| `payments-mcp` | Stripe checkout, reconciliation |
| `reporting-mcp` | P&L, VAT returns (HMRC MTD) |
