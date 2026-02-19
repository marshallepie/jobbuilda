#!/bin/bash

# ====================================
# JobBuilda Production Setup Script
# ====================================

set -e

echo "🚀 JobBuilda Production Setup"
echo "=============================="
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if openssl is available
if ! command -v openssl &> /dev/null; then
    echo -e "${RED}Error: openssl is required but not installed.${NC}"
    exit 1
fi

echo -e "${YELLOW}Step 1: Generate Production Secrets${NC}"
echo "======================================"

# Generate JWT secret
JWT_SECRET=$(openssl rand -base64 32)
echo -e "${GREEN}✓ Generated JWT Secret:${NC} $JWT_SECRET"
echo ""

echo -e "${YELLOW}Step 2: Supabase Configuration${NC}"
echo "======================================"
echo "Please provide your Supabase JWT Secret:"
echo "Get it from: https://supabase.com/dashboard/project/jnwxueomquywrqcgbgfd/settings/api"
echo ""
read -p "Supabase JWT Secret: " SUPABASE_JWT_SECRET

if [ -z "$SUPABASE_JWT_SECRET" ]; then
    echo -e "${RED}Error: Supabase JWT Secret is required${NC}"
    exit 1
fi

echo ""
echo -e "${YELLOW}Step 3: Domain Configuration${NC}"
echo "======================================"
read -p "Your production domain (e.g., jobbuilda.com): " DOMAIN

if [ -z "$DOMAIN" ]; then
    echo -e "${RED}Error: Domain is required${NC}"
    exit 1
fi

API_URL="https://api.$DOMAIN"
ADMIN_URL="https://admin.$DOMAIN"
PORTAL_URL="https://portal.$DOMAIN"

echo ""
echo -e "${GREEN}Your configuration:${NC}"
echo "  API: $API_URL"
echo "  Admin: $ADMIN_URL"
echo "  Portal: $PORTAL_URL"
echo ""

echo -e "${YELLOW}Step 4: Database Configuration${NC}"
echo "======================================"
echo "Choose your database option:"
echo "1) Use Supabase PostgreSQL (recommended for easy setup)"
echo "2) Use separate PostgreSQL service (Neon, Railway, etc.)"
echo ""
read -p "Choice (1 or 2): " DB_CHOICE

if [ "$DB_CHOICE" == "1" ]; then
    DATABASE_URL="postgresql://postgres:cWmXWvNZ%245BF3JQ@db.jnwxueomquywrqcgbgfd.supabase.co:5432/postgres"
    echo -e "${GREEN}✓ Using Supabase PostgreSQL${NC}"
elif [ "$DB_CHOICE" == "2" ]; then
    read -p "Enter your PostgreSQL connection string: " DATABASE_URL
    if [ -z "$DATABASE_URL" ]; then
        echo -e "${RED}Error: Database URL is required${NC}"
        exit 1
    fi
else
    echo -e "${RED}Invalid choice${NC}"
    exit 1
fi

echo ""
echo -e "${YELLOW}Step 5: Creating Configuration Files${NC}"
echo "======================================"

# Create coordinator production env
cat > apps/coordinator/.env.production <<EOF
# JobBuilda Coordinator - Production
# Generated on $(date)

PORT=3000
NODE_ENV=production

# Supabase Configuration
SUPABASE_URL=https://jnwxueomquywrqcgbgfd.supabase.co
SUPABASE_JWT_SECRET=$SUPABASE_JWT_SECRET

# Database Configuration
DATABASE_URL=$DATABASE_URL

# NATS Configuration
NATS_URL=nats://localhost:4222

# JWT Configuration
JWT_SECRET=$JWT_SECRET

# OpenTelemetry Configuration (optional - configure later)
OTEL_EXPORTER_OTLP_ENDPOINT=
OTEL_SERVICE_NAME=coordinator

# Log Level
LOG_LEVEL=warn
EOF

echo -e "${GREEN}✓ Created apps/coordinator/.env.production${NC}"

# Create admin production env
cat > apps/admin/.env.production <<EOF
# JobBuilda Admin Dashboard - Production
# Generated on $(date)

NEXT_PUBLIC_API_URL=$API_URL
NEXT_PUBLIC_SUPABASE_URL=https://jnwxueomquywrqcgbgfd.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impud3h1ZW9tcXV5d3JxY2diZ2ZkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEzMzYzNTYsImV4cCI6MjA4NjkxMjM1Nn0.t0RIYPcAshnbM2wowTh3NccW2JVojpN2V63oveYfiMQ
NEXT_PUBLIC_USE_MOCK_DATA=false
EOF

echo -e "${GREEN}✓ Created apps/admin/.env.production${NC}"

# Create portal production env
cat > apps/portal/.env.production <<EOF
# JobBuilda Client Portal - Production
# Generated on $(date)

NEXT_PUBLIC_API_URL=$API_URL
NEXT_PUBLIC_SUPABASE_URL=https://jnwxueomquywrqcgbgfd.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impud3h1ZW9tcXV5d3JxY2diZ2ZkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEzMzYzNTYsImV4cCI6MjA4NjkxMjM1Nn0.t0RIYPcAshnbM2wowTh3NccW2JVojpN2V63oveYfiMQ
EOF

echo -e "${GREEN}✓ Created apps/portal/.env.production${NC}"

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}✅ Production Setup Complete!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo "📋 Next Steps:"
echo ""
echo "1. Review configuration files:"
echo "   - apps/coordinator/.env.production"
echo "   - apps/admin/.env.production"
echo "   - apps/portal/.env.production"
echo ""
echo "2. Configure Supabase settings:"
echo "   - Site URL: $ADMIN_URL"
echo "   - Redirect URLs: $ADMIN_URL/auth/callback"
echo ""
echo "3. Deploy services:"
echo "   See PRODUCTION_DEPLOYMENT.md for detailed deployment steps"
echo ""
echo "4. Configure DNS:"
echo "   - admin.$DOMAIN → Vercel/Netlify"
echo "   - portal.$DOMAIN → Vercel/Netlify"
echo "   - api.$DOMAIN → Railway/Render"
echo ""
echo "🔑 Important: Save these secrets securely!"
echo "   JWT_SECRET: $JWT_SECRET"
echo "   SUPABASE_JWT_SECRET: $SUPABASE_JWT_SECRET"
echo ""
echo "🚀 Ready to deploy! Follow PRODUCTION_DEPLOYMENT.md for hosting setup."
echo ""
