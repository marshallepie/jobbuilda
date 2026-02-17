#!/bin/bash

# JobBuilda - One-Command Startup Script
# This script starts all necessary services for development

set -e

echo "🚀 Starting JobBuilda..."
echo ""

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Step 1: Start Docker infrastructure
echo -e "${BLUE}📦 Starting Docker infrastructure (PostgreSQL, NATS, Grafana)...${NC}"
pnpm docker:up
echo -e "${GREEN}✓ Docker services started${NC}"
echo ""

# Wait for PostgreSQL to be ready
echo -e "${YELLOW}⏳ Waiting for PostgreSQL to be ready...${NC}"
sleep 3
echo -e "${GREEN}✓ PostgreSQL ready${NC}"
echo ""

# Step 2: Run database migrations
echo -e "${BLUE}🗄️  Running database migrations...${NC}"
cd services/identity-mcp && pnpm db:migrate && cd ../..
cd services/clients-mcp && pnpm db:migrate && cd ../..
cd services/suppliers-mcp && pnpm db:migrate && cd ../..
cd services/quoting-mcp && pnpm db:migrate && cd ../..
cd services/jobs-mcp && pnpm db:migrate && cd ../..
cd services/materials-mcp && pnpm db:migrate && cd ../..
cd services/variations-mcp && pnpm db:migrate && cd ../..
cd services/tests-mcp && pnpm db:migrate && cd ../..
cd services/invoicing-mcp && pnpm db:migrate && cd ../..
cd services/payments-mcp && pnpm db:migrate && cd ../..
cd services/reporting-mcp && pnpm db:migrate && cd ../..
echo -e "${GREEN}✓ Migrations complete${NC}"
echo ""

# Step 3: Build MCP services
echo -e "${BLUE}🔨 Building MCP services...${NC}"
pnpm build --filter='./services/*'
echo -e "${GREEN}✓ MCP services built${NC}"
echo ""

# Step 4: Start core services
echo -e "${BLUE}🌟 Starting core services...${NC}"
echo -e "${YELLOW}   - Coordinator API (port 3000)${NC}"
echo -e "${YELLOW}   - Admin Dashboard (port 3002)${NC}"
echo ""

# Start only coordinator and admin (they will start MCP services as needed)
pnpm dev --filter=coordinator --filter=admin

echo ""
echo -e "${GREEN}✨ JobBuilda is running!${NC}"
echo -e "${GREEN}   Admin: http://localhost:3002${NC}"
echo -e "${GREEN}   API: http://localhost:3000${NC}"
