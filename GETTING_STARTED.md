# Getting Started with JobBuilda

## Quick Start (One Command!)

```bash
pnpm start
```

That's it! This single command will:
1. ✅ Start Docker infrastructure (PostgreSQL, NATS, Grafana)
2. ✅ Run database migrations
3. ✅ Build MCP services
4. ✅ Start the Coordinator API (port 3000)
5. ✅ Start the Admin Dashboard (port 3002)

## Alternative Startup Methods

### Method 1: Shell Script (Recommended)
```bash
./start.sh
```
- Comprehensive startup with migrations
- Color-coded output
- Error handling

### Method 2: NPM Script
```bash
pnpm start
```
- Alias for `./start.sh`
- Works on macOS/Linux

### Method 3: Core Services Only (Fastest)
```bash
pnpm dev:core
```
- Starts only Coordinator + Admin
- MCP services start automatically when needed
- Skips migrations (assumes DB is already set up)

## Access Points

After running `pnpm start`:

- **Client Portal**: http://localhost:3001 (for customers)
- **Admin Dashboard**: http://localhost:3002 (for contractors)
- **Coordinator API**: http://localhost:3000
- **Grafana (Observability)**: http://localhost:3003

## Stopping Services

### Stop Application Services
Press `Ctrl+C` in the terminal

### Stop Docker Infrastructure
```bash
pnpm docker:down
```

## Troubleshooting

### "Too many open files" Error
Use `pnpm start` or `pnpm dev:core` instead of `pnpm dev`.

### Docker Services Won't Start
```bash
pnpm docker:down && pnpm docker:up
```
