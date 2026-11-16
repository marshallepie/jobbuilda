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
