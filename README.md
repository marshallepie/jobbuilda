# JobBuilda v2.0

MCP-based job management system for electrical contractors.

## Architecture

JobBuilda v2.0 is a modular, event-driven system powered by the Model Context Protocol (MCP). Each functional area is an independent MCP server exposing standard MCP resources, tools, and prompts.

### Tech Stack

- **Monorepo:** Turborepo + pnpm workspaces
- **MCP Servers:** Node.js + TypeScript + Fastify
- **Database:** PostgreSQL (one per service)
- **Messaging:** NATS with JetStream
- **Observability:** OpenTelemetry + Grafana Tempo
- **Coordinator:** Fastify REST/GraphQL API
- **Portal:** Next.js PWA

## Quick Start

### Prerequisites

- Node.js 20.11.0+ (use nvm: `nvm use`)
- pnpm 9.0.0+
- Docker & Docker Compose

### Initial Setup

```bash
# Install dependencies
pnpm install

# Start local infrastructure (PostgreSQL, NATS, Tempo, Grafana)
pnpm docker:up

# Run database migrations
cd services/identity-mcp
pnpm db:migrate

# Seed test data
psql -h localhost -U jobbuilda -d identity_mcp -f scripts/seed-dev-data.sql
```

### Development

```bash
# Start all services (hot reload enabled)
pnpm dev

# Run tests
pnpm test

# Build all packages
pnpm build
```

### Useful Commands

```bash
# View Docker logs
pnpm docker:logs

# Stop infrastructure
pnpm docker:down

# Clean all build artifacts
pnpm clean
```

## Project Structure

```
/
├── apps/                   # Applications
│   ├── coordinator/        # REST/GraphQL orchestration layer
│   └── portal/             # Client-facing Next.js PWA
├── services/               # MCP Servers
│   ├── identity-mcp/       # Auth, tenants, RBAC
│   ├── clients-mcp/        # Clients, sites, GDPR
│   ├── suppliers-mcp/      # Supplier catalog, pricing
│   ├── quoting-mcp/        # Leads, quotes, approvals
│   ├── jobs-mcp/           # Job scheduling, time tracking
│   ├── materials-mcp/      # Material management
│   ├── variations-mcp/     # Job variations
│   ├── tests-mcp/          # Compliance tests
│   ├── invoicing-mcp/      # Invoice generation
│   ├── payments-mcp/       # Stripe integration
│   └── reporting-mcp/      # P&L, VAT, exports
├── packages/               # Shared libraries
│   ├── contracts/          # JSON Schemas, DTOs
│   ├── pricing-utils/      # VAT calculations
│   └── mcp-sdk/            # MCP client SDK
├── infra/                  # Infrastructure
│   └── docker-compose.dev.yml
└── scripts/                # Helper scripts
```

## Services

### Current Status

- ✅ **identity-mcp** - Authentication and authorization
- 🚧 **clients-mcp** - Client/site management (coming soon)
- 🚧 **suppliers-mcp** - Supplier catalog (coming soon)
- 🚧 **quoting-mcp** - Quote management (coming soon)

### Local Access

- **Coordinator API:** http://localhost:3000
- **Grafana (Traces):** http://localhost:3001 (admin/admin)
- **NATS Management:** http://localhost:8222
- **PostgreSQL:** localhost:5432 (jobbuilda/jobbuilda)

## Key Concepts

### MCP Architecture

Each MCP server exposes:
- **Resources:** Read-only data access (e.g., `res://identity/users/{id}`)
- **Tools:** Write operations (e.g., `issue_portal_token`)
- **Prompts:** AI assistant templates (optional)

### Security Context

Every request carries an `AuthContext`:
```typescript
{
  tenant_id: string;
  user_id: string;
  scopes: string[];
  x_request_id: string;
}
```

This context is automatically propagated across all MCP servers for tenant isolation and audit trails.

### Event-Driven

Services publish domain events to NATS:
```typescript
{
  id: "uuid",
  type: "quote.approved",
  tenant_id: "uuid",
  occurred_at: "2025-10-21T16:20:00Z",
  actor: { user_id: "uuid" },
  data: { ... },
  schema: "urn:jobbuilda:events:quote.approved:1"
}
```

### Observability

All services emit OpenTelemetry traces. View distributed traces in Grafana:
1. Open http://localhost:3001
2. Navigate to Explore → Tempo
3. Search by `service.name` or `trace_id`

## Development Workflow

1. **Define schemas** in `/packages/contracts`
2. **Implement MCP server** in `/services/{service}-mcp`
3. **Add orchestration** in `/apps/coordinator`
4. **Emit events** for async updates
5. **Trace & debug** via Grafana

## Testing

```bash
# Run all tests
pnpm test

# Test specific package
pnpm --filter @jobbuilda/contracts test

# E2E integration tests
./scripts/test-e2e.sh
```

## Deployment

**JobBuilda is currently LIVE and operational! 🚀**

- **Admin Dashboard:** https://admin.jobbuilda.co.uk
- **Client Portal:** https://portal.jobbuilda.co.uk
- **API Backend:** https://api.jobbuilda.co.uk

See [DEPLOYMENT_STATUS.md](./DEPLOYMENT_STATUS.md) for full deployment details including:
- Custom domain configuration
- Environment variables
- Database schema status
- Health checks and monitoring

For deployment guides to other platforms, see [DEPLOYMENT_PLATFORMS.md](./DEPLOYMENT_PLATFORMS.md).

## Documentation

- `CLAUDE.md` - Claude Code instructions
- `DEPLOYMENT_STATUS.md` - Current deployment status and configuration
- `DEPLOYMENT_PLATFORMS.md` - Platform deployment guides
- `JobBuilda_MCP_PRD_FRD_v2.0.md` - Full architecture specification
- Individual service READMEs in `services/*/README.md`

## Contributing

This is a private project for electrical contractor job management. For issues or questions, refer to the project documentation.

## License

Proprietary - All rights reserved
