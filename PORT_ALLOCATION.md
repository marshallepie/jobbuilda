# Port Allocation - JobBuilda

## Overview

This document lists all ports used by JobBuilda services to prevent conflicts.

## Port Map

| Port | Service | Type | Purpose |
|------|---------|------|---------|
| **3000** | Coordinator | App | Backend REST/GraphQL API |
| **3001** | Portal | App | Client-facing web app (customers) |
| **3002** | Admin | App | Admin dashboard (contractors) |
| **3003** | Grafana | Infrastructure | Observability dashboard |
| **3200** | Tempo | Infrastructure | Tempo HTTP API |
| **4222** | NATS | Infrastructure | Event bus (client connections) |
| **4317** | Tempo | Infrastructure | OTLP gRPC (traces) |
| **4318** | Tempo | Infrastructure | OTLP HTTP (traces) |
| **5432** | PostgreSQL | Infrastructure | Database |
| **8222** | NATS | Infrastructure | HTTP monitoring |

## MCP Services (No Ports!)

The following MCP services run as **stdio processes** (child processes of the Coordinator) and **do NOT bind to ports**:

- identity-mcp
- clients-mcp
- suppliers-mcp
- quoting-mcp
- jobs-mcp
- materials-mcp
- variations-mcp
- tests-mcp
- invoicing-mcp
- payments-mcp
- reporting-mcp

They communicate with the Coordinator via stdin/stdout using the Model Context Protocol (MCP), which is why they don't cause port conflicts.

## Port Conflict Check

✅ **No conflicts detected!**

- **3000-3003**: Web applications (Coordinator, Portal, Admin, Grafana)
- **4000-5000**: Infrastructure (NATS, Tempo)
- **5432**: PostgreSQL (standard port)
- **8222**: NATS monitoring

All ports are well-separated and follow standard conventions.

## Starting Services

All services start automatically with:

```bash
pnpm start
```

## Port Configuration

### Changing Default Ports

If you need to change ports (e.g., port 3000 is already in use):

1. **Coordinator** - Set `PORT` in `apps/coordinator/.env`:
   ```
   PORT=3010
   ```

2. **Portal** - Update `apps/portal/package.json`:
   ```json
   "dev": "next dev -p 3011"
   ```

3. **Admin** - Update `apps/admin/package.json`:
   ```json
   "dev": "next dev -p 3012"
   ```

4. **Docker Services** - Edit `infra/docker-compose.dev.yml`:
   ```yaml
   ports:
     - "5433:5432"  # Maps host:5433 to container:5432
   ```

## Firewall Rules

For production deployment, expose only:
- **3000** (Coordinator API)
- **3001** (Portal - public)
- **3002** (Admin - restrict to internal network)

Block all other ports from external access.

## Health Check Endpoints

| Service | Health Check URL |
|---------|------------------|
| Coordinator | http://localhost:3000/health |
| NATS | http://localhost:8222/healthz |
| Tempo | http://localhost:3200/ready |
| Grafana | http://localhost:3003/api/health |

## Troubleshooting

### Check What's Running on a Port

```bash
# macOS/Linux
lsof -i :3000

# Check all JobBuilda ports
lsof -i :3000,:3001,:3002,:3003,:4222,:5432
```

### Kill Process on Port

```bash
# Find process
lsof -ti :3000

# Kill it
kill $(lsof -ti :3000)
```

### Port Already in Use

If you see "port already in use" errors:

1. Check if previous services are still running:
   ```bash
   lsof -i :3000
   ```

2. Stop Docker services:
   ```bash
   pnpm docker:down
   ```

3. Kill any orphaned processes:
   ```bash
   pkill -f "node.*coordinator"
   pkill -f "next-server"
   ```

## Reserved Ports

The following standard ports are avoided:
- **80/443**: HTTP/HTTPS (system)
- **3306**: MySQL (common)
- **5000**: Flask/Python apps (common)
- **8080**: Common dev server port
- **27017**: MongoDB (common)
