# R01a Migration Safety Notice

This document correction is **not migration approval** and does not state or imply that any schema has been applied.

## Prohibited legacy paths

Do **not** use `MASTER_MIGRATION.sql`, `psql`, any CLI or service migration runner, destructive resets, seed or test data, signup or manual identity linking, public grants, or production `curl`/test-data activity. Do not run partial scripts, substitute procedures, or attempt a migration or repair from this notice.

## Canonical R01a references

The canonical R01a references are:

- `docs/AUTH_TENANT_MEMBERSHIPS_RUNBOOK.md`
- `docs/provider-sql/20261107_add_auth_tenant_memberships.sql`

This notice confers **no authorization** to rehearse or apply the script. Each execution requires separately recorded approval and an approved change window, plus completion of all gates required by the runbook and change process.

Any other migration, database repair, identity mapping, grant, reset, seed, test, or recovery request is a stop condition: do not proceed; escalate through the approved change process.
