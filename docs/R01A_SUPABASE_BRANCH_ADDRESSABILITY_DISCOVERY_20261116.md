# R01a Supabase branch addressability discovery — 2026-11-16

**Evidence type:** read-only Supabase provider-control-plane discovery.

**Scope:** This checkpoint records branch-list and project-addressability results only. It does not execute SQL, create, activate, reset, reuse, or inspect a branch; it does not authorize a rehearsal, a migration, a configuration change, or a release.

## Observed results

Against the production project, `list_branches` reported:

| Listed branch reference | Listed state | `with_data` | Addressability result |
| --- | --- | --- | --- |
| `afygozgefepayoenwccl` | active | `false` | `get_project` on this reference returned `NotFound`. |
| `jwnfweldmfdeapfzfunq` | inactive | not established by this checkpoint | `get_project` on this reference likewise returned `NotFound`. |

## Decision and release boundary

Neither listed preview is addressable for the R01a disposable rehearsal. The listing does not authorize reuse, activation, reset, inspection, or any other action on either reference. In particular, `afygozgefepayoenwccl` remains retired and forbidden under `docs/AUTH_TENANT_MEMBERSHIPS_RUNBOOK.md`; this discovery does not change that rule.

A new disposable branch decision still requires **explicit fresh provider cost approval** before creating a new `with_data=false` branch. After that approval, provider discovery must establish that the newly created target is addressable and satisfies the runbook's parent, health, and `with_data=false` gates before any rehearsal action. Until then, R01a remains blocked and no fallback to a listed preview, parent, or production is authorized.

## Read-only confirmation — 2026-11-17

The current provider branch listing still reports the retired
`afygozgefepayoenwccl` preview with parent `jnwxueomquywrqcgbgfd`,
`with_data=false`, provider branch status `FUNCTIONS_DEPLOYED`, and preview
project status `ACTIVE_HEALTHY`. A same-day read-only `get_project` lookup for
that exact preview ref returned `NotFound`.

This does not make the retired preview addressable or approved. No action was
taken against the preview beyond the read-only listing and addressability lookup:
no SQL Editor query, Auth Admin operation, connection attempt, activation, reset,
reuse, creation, deletion, configuration change, deployment, or production write.
Its apparent active lifecycle state must not be interpreted as rehearsal
eligibility or as authority to incur a new branch charge. R01a therefore remains
blocked pending a newly approved disposable-branch decision with explicit cost
approval and the fresh addressability evidence required by the runbook.

## Read-only cost checkpoint — 2026-11-17

A same-day provider `get_cost` check for a branch in organization
`qhqdwevvwetgukdkcigv` returned an hourly amount of `0.01344`. This read-only
price discovery does not approve a charge, creation, or any provider action.
Explicit fresh owner cost approval remains required before creating a new
`with_data=false` disposable branch.

## Current read-only addressability checkpoint — 2026-11-17

The production project `jnwxueomquywrqcgbgfd` is `ACTIVE_HEALTHY`; its only
recorded migration is `20261101175356 remote_schema`.

`list_branches` reported the non-default, `with_data=false` branch
`jobbuilda-membership-rehearsal-20261114` (branch ID
`db2270ab-99e4-4a2c-98e2-2d8a1fd582e0`, ref `afygozgefepayoenwccl`) with preview
project status `ACTIVE_HEALTHY`. However, `get_project` for that exact ref
returned `NotFoundException: Project not found`. The branch therefore remains
unaddressable and must not be used or reused for rehearsal.

A read-only `list_migrations` call against the same ref returned three records:
`remote_schema`, `corrected_fresh`, and `corrected_idempotent_repeat`. That
record does not establish project addressability, a supported Auth Admin
lifecycle, valid target binding, or usable runtime credentials. It does not
change the block, approval requirement, or prohibition on using the listed
preview.
