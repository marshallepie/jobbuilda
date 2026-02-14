-- Create all MCP service databases
-- This script runs automatically when PostgreSQL container starts

-- Identity MCP (already created as POSTGRES_DB, but include for completeness)
SELECT 'CREATE DATABASE identity_mcp' WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'identity_mcp')\gexec

-- Clients MCP
CREATE DATABASE clients_mcp;

-- Suppliers MCP
CREATE DATABASE suppliers_mcp;

-- Quoting MCP
CREATE DATABASE quoting_mcp;

-- Jobs MCP
CREATE DATABASE jobs_mcp;

-- Materials MCP
CREATE DATABASE materials_mcp;

-- Variations MCP
CREATE DATABASE variations_mcp;

-- Tests MCP
CREATE DATABASE tests_mcp;

-- Invoicing MCP
CREATE DATABASE invoicing_mcp;

-- Payments MCP
CREATE DATABASE payments_mcp;

-- Reporting MCP
CREATE DATABASE reporting_mcp;
