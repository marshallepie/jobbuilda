# Tenant membership mapping: manual backfill and revocation

## Scope and safety boundary

This is a **manual, human-reviewed** procedure for `public.auth_tenant_memberships`, owned by Identity MCP. Apply `services/identity-mcp/migrations/5_add_auth_tenant_memberships.sql` manually through the approved Supabase SQL workflow before using this runbook.

Only an authorized identity source may supply a reviewed tuple of:

- `auth_user_id` — the verified external Auth user UUID;
- `user_id` — the JobBuilda application-principal UUID; and
- `tenant_id` — the tenant UUID that principal belongs to.

Never infer or backfill a tuple from email address, Auth metadata, browser claims, headers, UUID shape, or a broad database search. Do not paste credentials, access tokens, email addresses, or production identifiers into tickets, this document, or command history.

Containment remains in place. It must **not** be removed until two synthetic-account, real-handler reciprocal tests have passed: synthetic account A must be denied access to B's tenant/resource, and synthetic account B must be denied access to A's tenant/resource.

## Preflight

1. Obtain the three UUIDs from the authorized identity source and have a second authorized reviewer approve the exact tuple and intended action.
2. Confirm the migration completed successfully. Its preflight deliberately stops on an incompatible pre-existing `public.auth_tenant_memberships` relation; reconcile that error manually rather than bypassing it.
3. Work on one approved tuple at a time. Do not run exploratory queries over users, identities, emails, or tenants.
4. Use a privileged, approved server/admin SQL connection. Browser roles are intentionally denied access to the mapping table.

## Create one mapping transactionally

Replace only the three angle-bracket UUID placeholders below with the approved tuple in the approved SQL console. The lock and insert are one transaction; the composite foreign key ensures that the application user belongs to the approved tenant.

```sql
BEGIN;

SELECT 1
FROM public.users
WHERE id = '<approved-app-user-uuid>'::uuid
  AND tenant_id = '<approved-tenant-uuid>'::uuid
FOR KEY SHARE;

INSERT INTO public.auth_tenant_memberships (
  auth_user_id,
  user_id,
  tenant_id,
  status,
  activated_at
)
VALUES (
  '<approved-auth-user-uuid>'::uuid,
  '<approved-app-user-uuid>'::uuid,
  '<approved-tenant-uuid>'::uuid,
  'active',
  now()
);

-- Both checks must return 1 before COMMIT.
SELECT count(*) AS active_mapping_count
FROM public.auth_tenant_memberships
WHERE auth_user_id = '<approved-auth-user-uuid>'::uuid
  AND user_id = '<approved-app-user-uuid>'::uuid
  AND tenant_id = '<approved-tenant-uuid>'::uuid
  AND status = 'active'
  AND revoked_at IS NULL;

SELECT count(*) AS membership_lookup_ready_count
FROM public.auth_tenant_memberships AS membership
JOIN public.users AS app_user
  ON app_user.id = membership.user_id
 AND app_user.tenant_id = membership.tenant_id
WHERE membership.auth_user_id = '<approved-auth-user-uuid>'::uuid
  AND membership.user_id = '<approved-app-user-uuid>'::uuid
  AND membership.tenant_id = '<approved-tenant-uuid>'::uuid
  AND membership.status = 'active'
  AND membership.revoked_at IS NULL;

COMMIT;
```

If either count is not exactly `1`, or the insert reports a uniqueness or foreign-key conflict, issue `ROLLBACK` and investigate the approved tuple through the authorized identity source. Do not work around a conflict by changing tenant/user values or revoking an unknown mapping.

## Revoke one mapping transactionally

Revocation retains the audit row and immediately prevents active membership lookup. Supply an approved non-sensitive operational reason; never put a secret or email address in `revoked_reason`.

```sql
BEGIN;

UPDATE public.auth_tenant_memberships
SET status = 'revoked',
    revoked_at = now(),
    revoked_reason = '<approved-non-sensitive-reason>'
WHERE auth_user_id = '<approved-auth-user-uuid>'::uuid
  AND user_id = '<approved-app-user-uuid>'::uuid
  AND tenant_id = '<approved-tenant-uuid>'::uuid
  AND status = 'active'
  AND revoked_at IS NULL;

-- This must return 0: the coordinator's active lookup is no longer ready.
SELECT count(*) AS membership_lookup_ready_count
FROM public.auth_tenant_memberships AS membership
JOIN public.users AS app_user
  ON app_user.id = membership.user_id
 AND app_user.tenant_id = membership.tenant_id
WHERE membership.auth_user_id = '<approved-auth-user-uuid>'::uuid
  AND membership.user_id = '<approved-app-user-uuid>'::uuid
  AND membership.tenant_id = '<approved-tenant-uuid>'::uuid
  AND membership.status = 'active'
  AND membership.revoked_at IS NULL;

COMMIT;
```

Before committing, confirm that the `UPDATE` affected exactly one approved active mapping. If it affected zero or more than one row, `ROLLBACK`; do not convert this into a broad query or bulk revocation.

## Recordkeeping

Record the approved tuple reference, action, reviewer, timestamp, transaction outcome, and the exact verification counts in the authorized change record. Keep the record access-controlled and do not copy actual identifiers into this runbook or source control.
