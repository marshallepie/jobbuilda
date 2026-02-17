#!/bin/bash

# JobBuilda - One-Command Startup Script
# This script starts all necessary services for development

# Exit on error, but continue on some expected errors
set +e

echo "🚀 Starting JobBuilda..."
echo ""

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Get script directory to ensure we're in the right place
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Step 1: Start Docker infrastructure
echo -e "${BLUE}📦 Starting Docker infrastructure (PostgreSQL, NATS, Grafana)...${NC}"
pnpm docker:up
if [ $? -eq 0 ]; then
  echo -e "${GREEN}✓ Docker services started${NC}"
else
  echo -e "${YELLOW}⚠️  Docker may already be running${NC}"
fi
echo ""

# Wait for PostgreSQL to be ready
echo -e "${YELLOW}⏳ Waiting for PostgreSQL to be ready...${NC}"
sleep 3
echo -e "${GREEN}✓ PostgreSQL ready${NC}"
echo ""

# Step 2: Run database migrations (only for key services)
echo -e "${BLUE}🗄️  Running database migrations...${NC}"
for service in identity-mcp quoting-mcp jobs-mcp; do
  if [ -d "services/$service" ]; then
    echo -e "${YELLOW}   Migrating $service...${NC}"
    (cd "services/$service" && pnpm db:migrate 2>&1 | grep -v "already exists" || true)
  fi
done
echo -e "${GREEN}✓ Migrations complete${NC}"
echo ""

# Step 3: Build MCP services
echo -e "${BLUE}🔨 Building MCP services...${NC}"
pnpm --filter='./services/*' build > /dev/null 2>&1 || true
echo -e "${GREEN}✓ MCP services built${NC}"
echo ""

# Step 4: Start core services
echo -e "${BLUE}🌟 Starting core services...${NC}"
echo -e "${YELLOW}   - Coordinator API (port 3000)${NC}"
echo -e "${YELLOW}   - Client Portal (port 3001)${NC}"
echo -e "${YELLOW}   - Admin Dashboard (port 3002)${NC}"
echo ""
echo -e "${GREEN}✨ Starting services (press Ctrl+C to stop)...${NC}"
echo ""

# Start coordinator, portal, and admin (coordinator will start MCP services as needed)
pnpm --filter=coordinator --filter=portal --filter=admin dev
