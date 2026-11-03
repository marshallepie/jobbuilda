# Environment Configuration Guide

JobBuilda uses multiple environment files across different services. This guide shows where each file is located and what it configures.

## Quick Start (Development)

**All services are pre-configured with sensible defaults!** You can start developing immediately:

```bash
pnpm dev:core
```

No .env configuration required for local development.

## Environment Files Location

### Frontend Applications

#### Admin Dashboard
**Location:** `apps/admin/.env.local`

```bash
# API endpoint
NEXT_PUBLIC_API_URL=http://localhost:3000

# Supabase (optional - uses mock auth if not set)
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

#### Client Portal
**Location:** `apps/portal/.env.local`

```bash
# API endpoint
NEXT_PUBLIC_API_URL=http://localhost:3000

# Supabase (optional - portal tokens used if not set)
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

### Backend Services

#### Coordinator (Main API)
**Location:** `apps/coordinator/.env`

```bash
PORT=3000
NODE_ENV=development
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318
OTEL_SERVICE_NAME=coordinator
DATABASE_URL=postgresql://jobbuilda:jobbuilda@127.0.0.1:5432/identity_mcp
NATS_URL=nats://localhost:4222
JWT_SECRET=dev-secret-change-in-production
```

#### MCP Services
Each MCP service has its own `.env` file in `services/<service-name>/.env`:

- `services/identity-mcp/.env` - Auth, tenants, users
- `services/clients-mcp/.env` - Clients and sites
- `services/quoting-mcp/.env` - Quotes and leads
- `services/jobs-mcp/.env` - Job management
- `services/materials-mcp/.env` - Materials catalog
- `services/invoicing-mcp/.env` - Invoice generation
- `services/variations-mcp/.env` - Job variations
- `services/tests-mcp/.env` - Compliance tests
- `services/suppliers-mcp/.env` - Supplier pricing

**Common structure:**
```bash
DATABASE_URL=postgresql://jobbuilda:jobbuilda@127.0.0.1:5432/<service_name>
NATS_URL=nats://localhost:4222
JWT_SECRET=dev-secret-change-in-production
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318
OTEL_SERVICE_NAME=<service-name>
NODE_ENV=development
```

### Infrastructure

**Location:** `infra/.env.example`

Contains example Docker environment variables for PostgreSQL, NATS, etc.

## What's Gitignored

The following patterns are gitignored (see `.gitignore`):
- `.env`
- `.env.local`
- `.env.*.local`

**Example files are committed:**
- `.env.example`
- `.env.local.example`

## Production Configuration

For production deployment, you'll need to configure:

### 1. Supabase Authentication
Set in `apps/admin/.env.local`:
```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

See `SUPABASE_SETUP.md` for detailed instructions.

### 2. Database URLs
Update all `DATABASE_URL` values in service .env files to point to your production PostgreSQL instances.

**Multi-database approach:** Each MCP service has its own database for data isolation.

### 3. NATS Message Bus
Update `NATS_URL` in all services to point to your production NATS cluster.

### 4. JWT Secret
**CRITICAL:** Change `JWT_SECRET` from the dev default to a strong secret:
```bash
JWT_SECRET=$(openssl rand -base64 32)
```

Update this in:
- `apps/coordinator/.env`
- All `services/*-mcp/.env` files

### 5. OpenTelemetry
Update `OTEL_EXPORTER_OTLP_ENDPOINT` to point to your production tracing backend (Grafana Cloud, Honeycomb, etc.)

## Environment Variables by Service

### Frontend (Public Variables Only)
- `NEXT_PUBLIC_API_URL` - Coordinator endpoint
- `NEXT_PUBLIC_SUPABASE_URL` - Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Supabase anon/public key
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` - Stripe test/live key

### Backend (Server-Side)
- `DATABASE_URL` - PostgreSQL connection string
- `NATS_URL` - NATS message bus URL
- `JWT_SECRET` - Token signing secret
- `OTEL_EXPORTER_OTLP_ENDPOINT` - OpenTelemetry collector
- `OTEL_SERVICE_NAME` - Service identifier for tracing
- `NODE_ENV` - Environment (development/production)

## Checking Your Configuration

Run this command to verify all .env files exist:

```bash
# Check if all required .env files exist
ls apps/admin/.env.local \
   apps/portal/.env.local \
   apps/coordinator/.env \
   services/identity-mcp/.env \
   services/clients-mcp/.env \
   services/quoting-mcp/.env \
   services/jobs-mcp/.env
```

All paths should exist. If any are missing, copy from the corresponding `.env.example` file.

## Troubleshooting

### "Connection refused" errors
- Ensure Docker services are running: `docker ps`
- Check `DATABASE_URL` and `NATS_URL` point to localhost

### "Unauthorized" or auth errors
- Verify `JWT_SECRET` matches across coordinator and MCP services
- Check Supabase credentials if using real auth

### Services can't connect
- Ensure all services use the same `NATS_URL`
- Check firewall isn't blocking port 4222 (NATS)

### Database errors
- Verify PostgreSQL is running: `docker ps | grep postgres`
- Check database names match in `DATABASE_URL`
- Run migrations: `cd services/<service> && pnpm db:migrate`

## Security Best Practices

1. **Never commit .env files** - They're gitignored for security
2. **Use strong secrets in production** - Don't use dev defaults
3. **Rotate secrets regularly** - Especially JWT_SECRET
4. **Use environment variables in production** - Not .env files
5. **Enable MFA** - For Supabase admin accounts
6. **Restrict database access** - Use strong passwords, firewall rules

## Need Help?

- Development setup: `pnpm dev:core` should "just work"
- Supabase setup: See `SUPABASE_SETUP.md`
- General docs: See `README.md`
- Issues: Check GitHub issues or create a new one
