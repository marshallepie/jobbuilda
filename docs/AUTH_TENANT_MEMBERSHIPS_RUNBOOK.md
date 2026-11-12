# Staff auth membership operator runbook

Prerequisite: apply `services/identity-mcp/migrations/5_add_auth_tenant_memberships.sql` through the approved production migration process after backup and schema review. The migration is forward-only and creates **no** mappings.

## Authorize one existing staff principal

1. Obtain the three UUIDs from independent, approved records: Supabase `auth.users.id`, existing `public.users.id`, and that user's existing `public.users.tenant_id`. Do not derive any value from email, JWT metadata, browser storage, headers, or a request body.
2. Confirm the application principal is staff/admin and belongs to the intended tenant:

```sql
SELECT id, tenant_id, role
FROM public.users
WHERE id = :'application_user_id'
  AND tenant_id = :'tenant_id'
  AND role = 'admin';
```

3. Confirm there is no active binding for either identity or application user:

```sql
SELECT auth_user_id, user_id, tenant_id, status, revoked_at
FROM public.auth_tenant_memberships
WHERE (auth_user_id = :'supabase_auth_user_id' OR user_id = :'application_user_id')
  AND status = 'active' AND revoked_at IS NULL;
```

4. In one transaction, insert the exact reviewed tuple. The composite foreign key independently enforces that the application user belongs to the tenant.

```sql
BEGIN;
INSERT INTO public.auth_tenant_memberships (auth_user_id, user_id, tenant_id)
VALUES (:'supabase_auth_user_id', :'application_user_id', :'tenant_id');
COMMIT;
```

5. Read the inserted row back by all three UUIDs and perform an authenticated coordinator rehearsal. Never paste service-role credentials or JWTs into tickets, logs, or this runbook.

## Revoke access

```sql
UPDATE public.auth_tenant_memberships
SET status = 'revoked', revoked_at = now(), revoked_reason = :'approved_reason'
WHERE auth_user_id = :'supabase_auth_user_id'
  AND status = 'active' AND revoked_at IS NULL;
```

Read back the row. A revoked binding must produce a coordinator `403`; do not delete history or alter the application user/tenant records.
