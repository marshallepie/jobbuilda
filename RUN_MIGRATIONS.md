# 🗄️ Database Migration Instructions

## Quick Start

Run the master migration script in Supabase to create all database tables.

---

## Method 1: Supabase SQL Editor (Recommended)

### Step 1: Open Supabase SQL Editor
1. Go to https://supabase.com/dashboard
2. Select your project: `jnwxueomquywrqcgbgfd`
3. Click **SQL Editor** in the left sidebar
4. Click **New Query**

### Step 2: Copy Migration Script
1. Open `MASTER_MIGRATION.sql` in this repository
2. Copy the entire contents (Ctrl+A, Ctrl+C)

### Step 3: Run Migration
1. Paste into Supabase SQL Editor
2. Click **Run** (or press Ctrl+Enter)
3. Wait for completion (~10-30 seconds)

### Step 4: Verify Success
You should see:
```
status: Migration completed successfully!
info: Tables created: 20+ tables
```

---

## Method 2: psql Command Line

If you prefer command line:

```bash
# Connect to Supabase PostgreSQL
psql "postgresql://postgres:cWmXWvNZ%245BF3JQ@db.jnwxueomquywrqcgbgfd.supabase.co:5432/postgres"

# Run migration
\i MASTER_MIGRATION.sql

# Verify tables created
\dt
```

---

## What Gets Created

### Core Tables (20+ tables across 7 services)

#### Identity Service
- ✅ `tenants` - Multi-tenant isolation
- ✅ `users` - Users with roles (admin, technician, client)
- ✅ `permissions` - RBAC permission scopes
- ✅ `event_outbox` - Event publishing outbox

#### Clients Service
- ✅ `clients` - Client management
- ✅ `sites` - Job site addresses

#### Quoting Service
- ✅ `leads` - Lead tracking
- ✅ `quotes` - Quote management
- ✅ `quote_items` - Quote line items

#### Jobs Service
- ✅ `jobs` - Job tracking
- ✅ `time_entries` - Time tracking
- ✅ `job_materials` - Materials used on jobs

#### Invoicing Service
- ✅ `invoices` - Invoice management
- ✅ `invoice_items` - Invoice line items

#### Payments Service
- ✅ `payment_transactions` - Payment tracking

#### Supporting Services
- ✅ `materials` - Materials catalog
- ✅ `variations` - Job variations
- ✅ `tests` - Compliance testing
- ✅ `suppliers` - Supplier management

### Additional Features
- ✅ Auto-updating timestamps (triggers)
- ✅ Foreign key relationships
- ✅ Indexes for performance
- ✅ Check constraints for data validation
- ✅ Test tenant seed data

---

## Seed Data Created

A test tenant is automatically created:

```
ID: 00000000-0000-0000-0000-000000000001
Name: Test Electrical Ltd
Plan: trial
Email: test@testelectrical.co.uk
```

You can use this for testing, or create your own tenant.

---

## After Migration

### Test the Database Connection

```bash
# Test API with database
curl https://jobbuilda-production.up.railway.app/api/clients
```

Should return:
```json
[]
```
(Empty array because no clients exist yet - but no error!)

### Create Your First User

You'll need to:
1. Sign up via Supabase Auth (admin dashboard)
2. Link the auth user to the `users` table
3. Test authenticated API calls

---

## Troubleshooting

### Error: "relation already exists"
- Tables already created, safe to ignore
- Script uses `CREATE TABLE IF NOT EXISTS`

### Error: "permission denied"
- Make sure you're using the postgres superuser
- URL should start with `postgresql://postgres:...`

### Error: "syntax error"
- Make sure you copied the entire script
- Check for any copy/paste formatting issues

### Verify Migration Success
```sql
-- Check tables exist
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;

-- Check test tenant exists
SELECT * FROM tenants LIMIT 1;
```

---

## Rolling Back (if needed)

If you need to start over:

```sql
-- WARNING: This deletes ALL data!
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;
GRANT ALL ON SCHEMA public TO postgres;
GRANT ALL ON SCHEMA public TO public;

-- Then re-run MASTER_MIGRATION.sql
```

---

## Next Steps After Migration

1. ✅ **Test API Endpoints** - Try fetching clients, quotes, etc.
2. ✅ **Create Users** - Set up your admin account
3. ✅ **Test Frontend** - Connect admin dashboard to API
4. ✅ **Create Test Data** - Add a client, create a quote
5. ✅ **Test Workflows** - Quote → Job → Invoice flow

---

**Questions?** Check the main README or API_LIVE_STATUS.md
