# JobBuilda v2.0 - Implementation Plan

## Context

JobBuilda is currently in the planning phase with comprehensive PRD documentation but **zero production code**. The user has confirmed readiness to start building the MCP-based modular job management system for electrical contractors. Tech stack choices have been made:
- **Turborepo** for monorepo management
- **Fastify** for MCP servers (lightweight, fast)
- **NATS** for event bus (cloud-native messaging)
- **PostgreSQL** per-service databases
- **OpenTelemetry** for distributed tracing

This plan builds the foundational infrastructure: monorepo setup, shared packages, first MCP server (identity), coordinator orchestration layer, and complete local development environment.

## Implementation Phases

### Phase 0: Repository Foundation (2-3 hours)

**Goal:** Establish monorepo structure with Turborepo and TypeScript.

**Key Files to Create:**
- `/package.json` - Root workspace with pnpm, Turborepo scripts
- `/turbo.json` - Build pipeline configuration (build, dev, test, lint)
- `/tsconfig.base.json` - Shared TypeScript config for all workspaces
- `/.gitignore` - Exclude node_modules, dist, .env files
- `/.nvmrc` - Pin Node.js 20.11.0
- `/README.md` - Developer onboarding guide

**Directory Structure:**
```
/
├── apps/          (coordinator, portal - empty for now)
├── services/      (MCP servers - empty for now)
├── packages/      (shared libs - empty for now)
├── infra/         (Docker configs - create in Phase 1)
└── scripts/       (helper scripts)
```

**Verification:**
- `pnpm install` succeeds
- `pnpm turbo --version` works
- Empty workspace directories created

---

### Phase 1: Docker Infrastructure (1-2 hours)

**Goal:** Local development environment with PostgreSQL, NATS, Grafana Tempo.

**Key Files to Create:**
- `/infra/docker-compose.dev.yml` - PostgreSQL (identity_mcp DB), NATS with JetStream, Tempo, Grafana
- `/infra/tempo.yaml` - Tempo configuration for OTLP traces
- `/infra/grafana-datasources.yml` - Auto-configure Tempo datasource
- `/infra/.env.example` - Template for database/NATS/OTEL env vars

**Services:**
- PostgreSQL on port 5432 (database: identity_mcp)
- NATS on port 4222 (client), 8222 (HTTP management)
- Tempo on port 4317 (OTLP gRPC), 4318 (OTLP HTTP)
- Grafana on port 3000 (trace visualization)

**Verification:**
- `pnpm docker:up` starts all containers healthy
- `psql -h localhost -U jobbuilda -d identity_mcp` connects
- `curl http://localhost:8222/healthz` returns OK (NATS)
- Grafana accessible at http://localhost:3000

---

### Phase 2: Shared Contracts Package (2-3 hours)

**Goal:** Define JSON Schemas for DTOs, events, and MCP tool inputs/outputs.

**Package:** `/packages/contracts`

**Key Files to Create:**
- `package.json` - Dependencies: ajv, ajv-formats for validation
- `src/validator.ts` - AJV-based schema validator
- `src/schemas/shared/auth-context.ts` - AuthContext interface (tenant_id, user_id, scopes, x_request_id)
- `src/schemas/events/base-event.ts` - Standard event envelope
- `src/schemas/identity/user.ts` - User DTO schema
- `src/schemas/identity/tenant.ts` - Tenant DTO schema
- `src/schemas/identity/portal-token.ts` - Portal token payload schema
- `src/index.ts` - Main export file

**Critical Pattern:** All schemas are JSON Schema (JSONSchemaType<T>) with AJV validation.

**Verification:**
- `pnpm build` compiles TypeScript
- Can import: `import { UserSchema, AuthContext } from '@jobbuilda/contracts'`

---

### Phase 3: Pricing Utils Package (1-2 hours)

**Goal:** HMRC-compliant VAT calculations with consistent rounding.

**Package:** `/packages/pricing-utils`

**Key Files to Create:**
- `package.json` - Pure TypeScript package
- `src/vat.ts` - `calculateVAT()`, `addVAT()`, `removeVAT()`, `extractVAT()` with half-up rounding to nearest penny
- `src/markup.ts` - `applyMarkup()`, `calculateMarkupAmount()`, `removeMarkup()`
- `src/vat.test.ts` - Unit tests for VAT calculations
- `src/index.ts` - Export all functions

**Critical:** All calculations use `Math.round(amount * 100) / 100` for HMRC compliance.

**Verification:**
- `pnpm build` compiles
- `pnpm test` passes all VAT calculation tests

---

### Phase 4: MCP SDK Package (2-3 hours)

**Goal:** Typed SDK for MCP client connections used by Coordinator.

**Package:** `/packages/mcp-sdk`

**Key Files to Create:**
- `package.json` - Dependencies: @modelcontextprotocol/sdk, @jobbuilda/contracts
- `src/types.ts` - MCPResource, MCPToolCall, MCPServerConnection interfaces
- `src/client.ts` - MCPClient class wrapping MCP SDK Client with AuthContext propagation
- `src/index.ts` - Export client and types

**Critical Pattern:** MCPClient automatically injects `_meta: { context: AuthContext }` on all resource reads and tool calls.

**Verification:**
- `pnpm build` compiles
- Can import: `import { MCPClient } from '@jobbuilda/mcp-sdk'`

---

### Phase 5: Identity MCP Server - Database Schema (2-3 hours)

**Goal:** Set up PostgreSQL schema and migration tooling for identity-mcp.

**Service:** `/services/identity-mcp`

**Key Files to Create:**
- `package.json` - Dependencies: Fastify, pg, NATS, jsonwebtoken, node-pg-migrate
- `.env.example` - DATABASE_URL, NATS_URL, JWT_SECRET, OTEL config
- `migrations/1_init.sql` - Schema: tenants, users, permissions, event_outbox tables with UUID primary keys, tenant isolation, RLS ready
- `migrations/.migrate.json` - node-pg-migrate configuration

**Database Tables:**
- `tenants` (id, name, plan, timestamps)
- `users` (id, tenant_id, email, name, role, timestamps)
- `permissions` (id, user_id, scope)
- `event_outbox` (id, event_type, tenant_id, payload, published_at)

**Verification:**
- `pnpm db:migrate` runs successfully
- `psql` shows all tables created with correct schema

---

### Phase 6: Identity MCP Server - Application Code (3-4 hours)

**Goal:** Implement identity-mcp MCP server with tools, resources, and event publishing.

**Service:** `/services/identity-mcp`

**Key Files to Create:**
- `src/index.ts` - Entry point with OpenTelemetry initialization
- `src/server.ts` - MCP server setup with stdio transport
- `src/lib/database.ts` - PostgreSQL connection pool with traced queries
- `src/lib/event-bus.ts` - NATS event publishing with outbox pattern
- `src/lib/tracing.ts` - OpenTelemetry SDK initialization
- `src/tools/index.ts` - Tool registration
- `src/tools/issue-portal-token.ts` - Generate JWT portal tokens (15-60 min TTL)
- `src/tools/check-permission.ts` - Verify user permissions
- `src/resources/index.ts` - Resource registration
- `src/resources/user.ts` - `res://identity/users/{id}` handler
- `src/resources/tenant.ts` - `res://identity/tenants/{id}` handler

**MCP Tools Exposed:**
- `issue_portal_token` - Create short-lived JWT for client portal
- `check_permission` - Verify user has required scope

**MCP Resources Exposed:**
- `res://identity/users/{id}` - Get user by ID (tenant-isolated)
- `res://identity/tenants/{id}` - Get tenant by ID

**Critical Patterns:**
- Every request extracts AuthContext from `_meta.context`
- All database queries include `tenant_id` for isolation
- All operations create spans with OpenTelemetry
- Events published to NATS on subject `events.{event_type}`

**Verification:**
- `pnpm dev` starts server on stdio transport
- Logs show "identity-mcp server running on stdio"
- Traces appear in Grafana with service name "identity-mcp"

---

### Phase 7: Coordinator Skeleton (2-3 hours)

**Goal:** Create Coordinator with Fastify REST API and MCP client connections.

**App:** `/apps/coordinator`

**Key Files to Create:**
- `package.json` - Dependencies: Fastify, @fastify/cors, @jobbuilda/mcp-sdk, OpenTelemetry
- `.env.example` - PORT, OTEL config, MCP server command/args
- `src/index.ts` - Entry point
- `src/server.ts` - Fastify server with MCP client initialization
- `src/lib/tracing.ts` - OpenTelemetry with Fastify instrumentation
- `src/lib/auth.ts` - Extract AuthContext from request headers (dev: x-tenant-id, x-user-id, x-scopes)
- `src/routes/health.ts` - Health check endpoint
- `src/routes/identity.ts` - Identity API routes

**REST Endpoints:**
- `GET /health` - Health check
- `GET /api/identity/users/:userId` - Get user (calls identity-mcp resource)
- `POST /api/identity/portal-tokens` - Issue portal token (calls identity-mcp tool)

**Critical Patterns:**
- MCPClient connects to identity-mcp via stdio transport
- All routes extract AuthContext from headers using `extractAuthContext()`
- AuthContext propagated to MCP servers automatically by mcp-sdk
- All routes create OpenTelemetry spans

**Verification:**
- `pnpm dev` starts Fastify on port 3000
- `curl http://localhost:3000/health` returns `{"status": "ok"}`
- Identity endpoints respond (with proper headers)
- Traces show coordinator → identity-mcp spans in Grafana

---

### Phase 8: End-to-End Integration Test (1-2 hours)

**Goal:** Verify entire stack works with seeded test data.

**Key Files to Create:**
- `/services/identity-mcp/scripts/seed-dev-data.sql` - Test tenant, admin user, permissions
- `/scripts/test-e2e.sh` - Bash script to test all coordinator endpoints with curl

**Test Data:**
- Test tenant: `00000000-0000-0000-0000-000000000001` (Test Electrical Co)
- Admin user: `00000000-0000-0000-0000-000000000101` (admin@test.com)
- Permissions: identity:issue_portal_token, identity:read_users

**E2E Test Flow:**
1. Health check
2. GET user by ID (verify resource read)
3. POST portal token (verify tool invocation)
4. Verify traces in Grafana

**Verification:**
- `./scripts/test-e2e.sh` passes all tests
- All responses return expected JSON
- Grafana shows complete trace from coordinator through identity-mcp
- NATS receives `identity.portal_token_issued` event

---

## Critical Files & Patterns

### Architectural Foundation Files

1. **`/turbo.json`** - Monorepo build pipeline (all future services follow this)
2. **`/packages/contracts/src/schemas/shared/auth-context.ts`** - Security context propagated everywhere
3. **`/packages/mcp-sdk/src/client.ts`** - MCP communication abstraction
4. **`/services/identity-mcp/src/server.ts`** - Template for all future MCP servers
5. **`/apps/coordinator/src/server.ts`** - Orchestration pattern for composing MCP servers

### Reusable Patterns

**MCP Server Structure (repeat for all 10+ future servers):**
```
/services/{service}-mcp/
├── src/
│   ├── index.ts           # Entry point + tracing init
│   ├── server.ts          # MCP server setup
│   ├── lib/
│   │   ├── database.ts    # PostgreSQL pool
│   │   ├── event-bus.ts   # NATS publishing
│   │   └── tracing.ts     # OpenTelemetry setup
│   ├── tools/             # MCP tool handlers
│   ├── resources/         # MCP resource handlers
│   └── prompts/           # MCP prompts (optional)
├── migrations/            # SQL migrations
└── package.json
```

**Event Publishing Pattern:**
```typescript
await eventBus.publish({
  id: randomUUID(),
  type: 'domain.event_name',
  tenant_id: ctx.tenant_id,
  occurred_at: new Date().toISOString(),
  actor: { user_id: ctx.user_id },
  data: { ...event_payload },
  schema: 'urn:jobbuilda:events:domain.event_name:1'
});
```

**Coordinator Orchestration Pattern:**
```typescript
const ctx = extractAuthContext(request);

// Read data via resources
const resource = await fastify.mcp.service.resources.get('res://path', ctx);

// Write data via tools
const result = await fastify.mcp.service.tools.tool_name.invoke(ctx, input);

return result;
```

---

## Post-Implementation: Next MCP Servers

After Phase 8, the foundation supports rapid addition of new MCP servers following the identity-mcp pattern:

**Phase 9: clients-mcp** (Client/site management, GDPR)
**Phase 10: suppliers-mcp** (Supplier catalog, live pricing)
**Phase 11: quoting-mcp** (Leads, quotes, approval workflow)
**Phase 12: jobs-mcp** (Job scheduling, time tracking)
**Phase 13+:** Materials, variations, tests, invoicing, payments, reporting

Each new MCP server follows the same structure as identity-mcp with:
- Own PostgreSQL database
- MCP tools/resources/prompts
- Event outbox for NATS publishing
- OpenTelemetry instrumentation
- Coordinator adds new MCPClient and routes

---

## Developer Experience

**Quick Start:**
```bash
# One-time setup
pnpm install
pnpm docker:up

# Seed test data
psql -h localhost -U jobbuilda -d identity_mcp -f services/identity-mcp/scripts/seed-dev-data.sql

# Start all services (hot reload enabled)
pnpm dev

# Run E2E tests (separate terminal)
./scripts/test-e2e.sh
```

**Development Workflow:**
- All services use `tsx watch` for hot reload
- Docker Compose for local dependencies
- Grafana for trace debugging
- Single monorepo, single `pnpm dev` command

---

## Estimated Timeline

| Phase | Hours |
|-------|-------|
| Phase 0: Repository Foundation | 2-3 |
| Phase 1: Docker Infrastructure | 1-2 |
| Phase 2: Contracts Package | 2-3 |
| Phase 3: Pricing Utils | 1-2 |
| Phase 4: MCP SDK | 2-3 |
| Phase 5: Identity DB Schema | 2-3 |
| Phase 6: Identity MCP Server | 3-4 |
| Phase 7: Coordinator Skeleton | 2-3 |
| Phase 8: E2E Integration | 1-2 |
| **Total** | **16-25 hours** |

With buffer for debugging: **20-30 hours** (3-4 full workdays)

---

## Success Criteria

Foundation is complete when:
- ✅ Turborepo monorepo builds all packages/services
- ✅ Docker Compose runs PostgreSQL, NATS, Tempo, Grafana
- ✅ identity-mcp exposes 2 tools, 2 resources via MCP
- ✅ Coordinator orchestrates identity-mcp via REST API
- ✅ E2E tests pass (health, user fetch, portal token issuance)
- ✅ Distributed traces visible in Grafana
- ✅ Events published to NATS (verifiable in NATS logs)
- ✅ Developer can run `pnpm dev` and immediately start building next MCP server

This foundation provides the patterns for scaling to all 11 MCP servers in the JobBuilda architecture.

---

## Phase: Subscription Monetization (February 2026)

### Overview

Adds a subscription model to monetize the platform: 14-day free trial (card required upfront), then £29/month. Additional team members £9/month each. Includes public marketing site, multi-step signup with Stripe card collection, and API-level subscription enforcement.

### Components

| Component | Description |
|-----------|-------------|
| DB migration | `services/identity-mcp/migrations/4_add_subscription_fields.sql` |
| Stripe client | `apps/coordinator/src/lib/stripe.ts` |
| Subscription routes | `apps/coordinator/src/routes/subscription.ts` |
| Server gating | `apps/coordinator/src/server.ts` — 402 hook for lapsed subscriptions |
| Admin 402 page | `apps/admin/src/app/subscription-required/page.tsx` |
| Marketing + signup | `apps/web/` — Next.js app at `jobbuilda.co.uk` |

### Stripe Configuration (Manual)

1. Create product **"JobBuilda Standard"** → £29/month → `STRIPE_PRICE_ID`
2. Create product **"Additional Seat"** → £9/month → `STRIPE_SEAT_PRICE_ID`
3. Webhook: `https://jobbuilda-production.up.railway.app/api/subscription/webhook`
   - Events: `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed`, `invoice.payment_succeeded`
   - Secret → `STRIPE_WEBHOOK_SECRET`

### Railway Env Vars Required

```
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_ID=price_...
STRIPE_SEAT_PRICE_ID=price_...
SUPABASE_URL=https://jnwxueomquywrqcgbgfd.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

### Vercel Env Vars for apps/web

```
NEXT_PUBLIC_API_URL=https://jobbuilda-production.up.railway.app
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...
NEXT_PUBLIC_SUPABASE_URL=https://jnwxueomquywrqcgbgfd.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
```

### Supabase Auth Configuration

- Site URL: `https://jobbuilda.co.uk`
- Redirect URL: `https://jobbuilda.co.uk/onboarding`

### Signup Flow

1. `/signup` → POST /api/auth/register → returns SetupIntent client secret
2. `/verify` → holding page, email link redirects to `/onboarding?token_hash=...`
3. `/onboarding` → Stripe CardElement → POST /api/auth/confirm-subscription
4. `/welcome` → success, link to admin dashboard

### Verification Checklist

- [ ] Run `4_add_subscription_fields.sql` in Supabase SQL editor
- [ ] Set Stripe env vars in Railway + redeploy coordinator
- [ ] Create Vercel project for `apps/web`, set domain `jobbuilda.co.uk`
- [ ] Visit landing page → complete full signup flow
- [ ] Verify Stripe dashboard: customer, SetupIntent, subscription with trial
- [ ] Trigger `invoice.payment_failed` webhook → confirm 402 in admin
- [ ] Confirm Stripe portal session redirects correctly
