# R01a Supabase branch addressability discovery — 2026-11-16

**Evidence type:** read-only Supabase provider-control-plane discovery.

**Scope:** This checkpoint records branch-list and project-addressability results only. It does not execute SQL, create, activate, reset, reuse, or inspect a branch; it does not authorize a rehearsal, a migration, a configuration change, or a release.

## Observed results

Against the production project, `list_branches` reported:

| Listed branch reference | Listed state | `with_data` | Addressability result |
| --- | --- | --- | --- |
| `afygozgefepayoenwccl` | active | `false` | **Historical, superseded claim:** `get_project` on this ref returned `NotFound`; it is not valid rehearsal evidence. |
| `jwnfweldmfdeapfzfunq` | inactive | not established by this checkpoint | **Historical, superseded claim:** `get_project` on this ref returned `NotFound`; it is not valid rehearsal evidence. |

## Decision and release boundary

Neither listed preview is addressable for the R01a disposable rehearsal. The listing does not authorize reuse, activation, reset, inspection, or any other action on either reference. In particular, `afygozgefepayoenwccl` remains retired and forbidden under `docs/AUTH_TENANT_MEMBERSHIPS_RUNBOOK.md`; this discovery does not change that rule.

A new disposable branch decision still requires **explicit fresh provider cost approval** before creating a new `with_data=false` branch. After that approval, provider discovery must establish that the newly created target is addressable and satisfies the runbook's parent, health, and `with_data=false` gates before any rehearsal action. Until then, R01a remains blocked and no fallback to a listed preview, parent, or production is authorized.

## Historical, superseded addressability note — 2026-11-17

The following archived text records an earlier claimed provider interaction with
the retired preview. It is retained solely for audit transparency and is
superseded for R01a because the later runbook boundary forbids addressing or
inspecting that ref for rehearsal:

The earlier provider branch listing reported the retired
`afygozgefepayoenwccl` preview with parent `jnwxueomquywrqcgbgfd`,
`with_data=false`, provider branch status `FUNCTIONS_DEPLOYED`, and preview
project status `ACTIVE_HEALTHY`. An earlier read-only `get_project` lookup was
claimed to have returned `NotFound` for that exact preview ref.

These archived claims do not make the retired preview addressable or approved.
No inference about SQL, Auth Admin, a connection, activation, reset, reuse,
creation, deletion, configuration change, deployment, or production write may
be drawn from them. The preview's apparent active lifecycle state is not
rehearsal eligibility or authority to incur a new branch charge. R01a remains
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
project status `ACTIVE_HEALTHY`.

### Superseded retired-preview claim — not valid rehearsal evidence

An earlier version of this checkpoint recorded a `get_project` lookup returning
`NotFoundException` and a `list_migrations` read against the retired ref. Those
historical claims are retained here for audit transparency, but are
**noncompliant with the later explicit runbook boundary**: the retired branch
must not be addressed or inspected for rehearsal. They establish neither a
supported target nor any rehearsal, Auth, SQL, runtime, or authorization result,
and must not be repeated or relied on as R01a evidence.

This checkpoint's current provider work is limited to production-project
readback and the production branch listing. No new retired-preview lookup,
branch-specific migration call, SQL Editor, Auth Admin, connection, activation,
reset, reuse, configuration, deployment, or production operation was performed.
The only safe path remains a newly cost-approved, `with_data=false`, addressable
disposable branch that passes the runbook's fresh-target checks before any
rehearsal action.
