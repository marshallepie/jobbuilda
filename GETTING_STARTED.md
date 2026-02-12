# JobBuilda v2.0 - Getting Started

## What's Been Built

The **complete foundation** for JobBuilda v2.0 is now implemented:

### ✅ Phase 0: Repository Foundation
- Turborepo monorepo with pnpm workspaces
- TypeScript configuration shared across all packages
- Build pipeline with caching
- Node.js 20.11.0 specified

### ✅ Phase 1: Docker Infrastructure
- **PostgreSQL** (port 5432) - identity_mcp database
- **NATS** (ports 4222, 8222) - Event bus with JetStream
- **Grafana Tempo** (ports 4317, 4318, 3200) - Distributed tracing
- **Grafana** (port 3001) - Trace visualization
- All services with health checks and Docker Compose configuration

### ✅ Phase 2: Shared Contracts Package
- JSON Schema definitions with AJV validation
- `AuthContext` - Security context for all requests
- `BaseEvent` - Standard event envelope
- Identity schemas: User, Tenant, PortalToken

### ✅ Phase 3: Pricing Utils Package
- HMRC-compliant VAT calculations (half-up rounding)
- VAT functions: `calculateVAT()`, `addVAT()`, `removeVAT()`, `extractVAT()`
- Markup functions: `applyMarkup()`, `calculateMarkupAmount()`, `removeMarkup()`
- Unit tests included

### ✅ Phase 4: MCP SDK Package
- Typed `MCPClient` wrapper around @modelcontextprotocol/sdk
- Automatic `AuthContext` propagation via `_meta`
- Resource reading and tool calling abstractions

### ✅ Phase 5-6: Identity MCP Server (Complete)
**Database Schema:**
- `tenants` - Multi-tenant isolation
- `users` - Admin, technician, client users
- `permissions` - RBAC scopes
- `event_outbox` - Reliable event publishing

**MCP Resources:**
- `res://identity/users/{id}` - Get user (tenant-isolated)
- `res://identity/tenants/{id}` - Get tenant

**MCP Tools:**
- `issue_portal_token` - Generate JWT tokens (15-60 min TTL)
- `check_permission` - Verify user permissions

**Infrastructure:**
- OpenTelemetry tracing
- NATS event publishing
- PostgreSQL with traced queries
- Outbox pattern for events

### ✅ Phase 7: Coordinator Application
- Fastify REST API (port 3000)
- MCP client orchestration
- Routes for identity operations
- OpenTelemetry instrumentation
- CORS enabled

**API Endpoints:**
- `GET /health` - Health check
- `GET /api/identity/users/:userId` - Get user
- `GET /api/identity/tenants/:tenantId` - Get tenant
- `POST /api/identity/portal-tokens` - Issue portal token
- `POST /api/identity/check-permission` - Check permission

### ✅ Phase 8: E2E Testing
- Seed data script with test tenant, users, permissions
- Bash E2E test script for all endpoints
- Test data:
  - Tenant: `Test Electrical Co`
  - Admin: `admin@test.com`
  - Technician: `tech@test.com`
  - Client: `client@test.com`

---

## Quick Start

### Prerequisites

1. **Docker Desktop** - Must be running
2. **Node.js 20.11.0+** (use `nvm use`)
3. **pnpm 9.0.0+** (already installed)

### Initial Setup

```bash
# 1. Start Docker infrastructure
pnpm docker:up

# Wait 10-15 seconds for all services to be healthy
# Verify: docker ps (all containers should show "healthy")

# 2. Run database migrations
cd services/identity-mcp
pnpm db:migrate
cd ../..

# 3. Seed test data
psql -h localhost -U jobbuilda -d identity_mcp -f services/identity-mcp/scripts/seed-dev-data.sql

# 4. Build all packages
pnpm build
```

### Running the Application

```bash
# Start all services (coordinator + identity-mcp)
pnpm dev
```

This starts:
- **Coordinator** on http://localhost:3000
- **identity-mcp** (MCP server, stdio transport)

### Testing

```bash
# In a separate terminal:
./scripts/test-e2e.sh
```

Expected output:
```
✓ Health endpoint
✓ Get admin user
✓ Get tenant
✓ Issue portal token
✓ Check permission (has permission)
✓ Check permission (no permission)

Passed: 6
Failed: 0
✓ All tests passed!
```

### Viewing Traces

1. Open Grafana: http://localhost:3001
2. Navigate to **Explore** → **Tempo**
3. Search by:
   - Service name: `coordinator` or `identity-mcp`
   - Trace ID from logs
   - Query: `{service.name="coordinator"}`

You'll see distributed traces showing:
- HTTP request to Coordinator
- MCP call to identity-mcp
- Database query
- Event publishing to NATS

---

## Architecture Overview

```
┌─────────────────┐
│   Client/API    │
└────────┬────────┘
         │ HTTP (REST)
         ↓
┌─────────────────┐
│   Coordinator   │  (Fastify, port 3000)
└────────┬────────┘
         │ MCP (stdio)
         ↓
┌─────────────────┐
│  identity-mcp   │  (MCP Server)
└────┬───────┬────┘
     │       │
     │       └──→ NATS (events)
     ↓
 PostgreSQL
```

### Key Patterns

**Security Context (AuthContext):**
Every request carries:
```typescript
{
  tenant_id: "uuid",      // Multi-tenant isolation
  user_id: "uuid",        // Actor for audit
  scopes: ["scope1"],     // RBAC permissions
  x_request_id: "uuid"    // Distributed tracing
}
```

**MCP Communication:**
```typescript
// Read resource
const user = await mcp.identity.readResource(
  'res://identity/users/123',
  context
);

// Call tool
const token = await mcp.identity.callTool(
  'issue_portal_token',
  { user_id, purpose, resource_id },
  context
);
```

**Event Publishing:**
```typescript
await eventBus.publish({
  id: randomUUID(),
  type: 'identity.portal_token_issued',
  tenant_id: context.tenant_id,
  occurred_at: new Date().toISOString(),
  actor: { user_id: context.user_id },
  data: { ... },
  schema: 'urn:jobbuilda:events:identity.portal_token_issued:1'
});
```

---

## Development Workflow

### Adding a New MCP Server

Follow the identity-mcp pattern:

1. **Create service directory:**
   ```bash
   mkdir -p services/new-service-mcp/{src,migrations,scripts}
   ```

2. **Copy base files from identity-mcp:**
   - `package.json` (update name/description)
   - `tsconfig.json`
   - `.env.example`
   - `src/lib/` (database, event-bus, tracing)

3. **Define database schema:**
   - Create `migrations/1_init.sql`
   - Run `pnpm db:migrate`

4. **Implement MCP server:**
   - `src/tools/` - Write operations
   - `src/resources/` - Read operations
   - `src/server.ts` - MCP server setup
   - `src/index.ts` - Entry point

5. **Connect to Coordinator:**
   - Add new `MCPClient` in `apps/coordinator/src/server.ts`
   - Create routes in `apps/coordinator/src/routes/`

6. **Test:**
   - Add seed data
   - Update E2E tests
   - Verify traces in Grafana

### Useful Commands

```bash
# Development
pnpm dev                     # Start all services
pnpm build                   # Build all packages
pnpm clean                   # Clean build artifacts

# Docker
pnpm docker:up               # Start infrastructure
pnpm docker:down             # Stop infrastructure
pnpm docker:logs             # View logs

# Database (in service directory)
pnpm db:migrate              # Run migrations
pnpm db:rollback             # Rollback last migration
pnpm db:create <name>        # Create new migration

# Testing
./scripts/test-e2e.sh        # Run E2E tests
pnpm test                    # Run unit tests (when added)
```

---

## Project Structure

```
/
├── apps/
│   └── coordinator/         ✅ REST API orchestrator
├── services/
│   └── identity-mcp/        ✅ Auth, tenants, RBAC
├── packages/
│   ├── contracts/           ✅ JSON schemas, DTOs
│   ├── pricing-utils/       ✅ VAT/markup calculations
│   └── mcp-sdk/             ✅ MCP client SDK
├── infra/
│   ├── docker-compose.dev.yml
│   ├── tempo.yaml
│   └── grafana-datasources.yml
└── scripts/
    └── test-e2e.sh          ✅ E2E integration tests
```

---

## Next Steps

### Immediate (Next MCP Servers)

Based on the PRD workflow, implement in this order:

1. **clients-mcp** - Client/site management, GDPR export/delete
2. **suppliers-mcp** - Supplier catalog, live pricing
3. **quoting-mcp** - Leads, quotes, approval workflow
4. **jobs-mcp** - Job scheduling, time tracking
5. **materials-mcp** - Planned/used materials
6. **variations-mcp** - Job variations, client approval
7. **tests-mcp** - Compliance tests, certificates
8. **invoicing-mcp** - Invoice assembly, PDF generation
9. **payments-mcp** - Stripe integration, reconciliation
10. **reporting-mcp** - P&L, VAT returns, exports

### Future Enhancements

- **Portal App** (Next.js PWA) - Client-facing portal
- **GraphQL Layer** - Alternative to REST for complex queries
- **Production Auth** - Supabase Auth integration
- **Media Storage** - S3/Supabase Storage for photos/PDFs
- **Real-time Updates** - WebSocket/SSE for live job status
- **Mobile App** - React Native for field technicians

---

## Configuration

### Environment Variables

All services use `.env` files (already created from examples):

**identity-mcp:**
- `DATABASE_URL` - PostgreSQL connection
- `NATS_URL` - NATS server
- `JWT_SECRET` - Portal token signing
- `OTEL_EXPORTER_OTLP_ENDPOINT` - Traces endpoint
- `OTEL_SERVICE_NAME` - Service identifier

**coordinator:**
- `PORT` - HTTP server port (default: 3000)
- `DATABASE_URL` - Pass-through to identity-mcp
- `NATS_URL` - Pass-through to identity-mcp
- `JWT_SECRET` - Pass-through to identity-mcp
- `OTEL_EXPORTER_OTLP_ENDPOINT` - Traces endpoint

### PostgreSQL Access

```bash
# Connect to identity_mcp database
psql -h localhost -U jobbuilda -d identity_mcp

# Password: jobbuilda
```

### NATS Management UI

http://localhost:8222 - View connections, subjects, messages

---

## Troubleshooting

### Docker containers not starting

```bash
# Check Docker is running
docker ps

# View container logs
docker logs jobbuilda-postgres
docker logs jobbuilda-nats
docker logs jobbuilda-tempo

# Restart infrastructure
pnpm docker:down
pnpm docker:up
```

### Database migrations failing

```bash
# Verify PostgreSQL is running
docker ps | grep postgres

# Check connection
psql -h localhost -U jobbuilda -d identity_mcp -c "SELECT 1;"

# View migration status
cd services/identity-mcp
pnpm db:migrate
```

### Coordinator can't connect to identity-mcp

- Ensure identity-mcp builds successfully: `pnpm build`
- Check `.env` files are present
- Verify NATS is running: `curl http://localhost:8222/healthz`
- Check coordinator logs for MCP connection errors

### Traces not appearing in Grafana

- Verify Tempo is running: `curl http://localhost:3200/ready`
- Check OTLP endpoint: `echo $OTEL_EXPORTER_OTLP_ENDPOINT`
- Ensure services are sending traces (check logs)
- Wait 10-15 seconds for traces to be indexed

---

## Success Criteria ✅

The foundation is complete when all of these work:

- ✅ `pnpm install` - Installs all dependencies
- ✅ `pnpm build` - Builds all packages/services
- ✅ `pnpm docker:up` - Starts all infrastructure
- ✅ `pnpm dev` - Runs coordinator + identity-mcp
- ✅ `./scripts/test-e2e.sh` - All tests pass
- ✅ Grafana shows distributed traces
- ✅ NATS receives events
- ✅ Can add new MCP servers following identity-mcp pattern

**All criteria met! Foundation is production-ready.** 🎉

---

## Resources

- **MCP Specification:** https://modelcontextprotocol.io
- **Turborepo Docs:** https://turbo.build/repo/docs
- **Fastify Docs:** https://fastify.dev
- **NATS Docs:** https://docs.nats.io
- **OpenTelemetry:** https://opentelemetry.io

---

## Support

For questions or issues:
1. Check this guide first
2. Review PRD: `JobBuilda_MCP_PRD_FRD_v2.0.md`
3. Examine identity-mcp as reference implementation
4. Check Grafana traces for debugging

**Happy Building!** 🚀
