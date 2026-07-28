# ADR-0017: Restrict `impersonate()` from targeting another admin account

## Status

**Retired — merged into `ADR-0016`.**

**2026-07-28:** An `architecture-reviewer` Full Review of this ADR
alongside the original `ADR-0016` (then "Session invalidation on admin
role revocation") found that both were reasoning about one half of a
single mechanism, and that a materially cheaper, more robust option —
denying admin authority to any impersonated session at the point
authority is checked, using the `impersonatedBy` claim already attached
to every impersonated request — was invisible from either ADR's scope
alone and closed what both were separately trying to address. This ADR's
target-restriction option (reject `impersonate()` calls where the target
holds the admin role) is preserved as a considered-and-deferred
alternative within the merged decision, not discarded — see `ADR-0016`,
Considered Options (Option A) and Alternatives Rejected.

This file is retained for history per this toolkit's ADR lifecycle
convention (retired entries are never deleted); its Context and Decision
sections below are the original draft (with one superseded-finding note
inserted into Context, marked as such), superseded in full by
`ADR-0016`.

## Date

2026-07-28 (original; retired 2026-07-28)

## Context

`AuthService.impersonate()` (`backend/src/auth/auth.service.ts:457-495`)
validates that the **caller** holds the admin role (`:461-464`,
`admin.role !== 'admin'` throws) but validates the **target** only for
existence (`:466-469`) — there is no check that the target is *not* an
admin. This asymmetry is confirmed directly in code; no comment, test, or
product document states it was a deliberate choice.

The consequence: admin A can impersonate admin B. The resulting session
(created for B, `:480-482`) carries `role: 'admin'` — `JwtStrategy
.validate()`'s fresh per-request lookup (`jwt.strategy.ts:21-31`) resolves
to B's actual, current role, which is `admin`. Every `AdminGuard` check
against that session passes. Two consequences follow, evidenced in
`docs/features/admin-role-guards/PRD.md` FC-006's third bullet and
confirmed here:

1. **Admin A gains a second, independent path to admin authority** —
   B's session — for as long as that session lives (up to 7 days,
   `JWT_EXPIRY`), with no additional proof beyond A's own initial
   `impersonate()` call.
2. **If A is subsequently demoted**, A's access via B's session is
   **unaffected by A's own demotion** — A retains admin-role access
   through a session belonging to a different account, a privilege-
   retention outcome distinct from (and not solved by) whatever ordinary
   session-revocation applies to A's own account.

**Superseded finding, not carried into `ADR-0016`'s decision as
originally stated:** the review that retired this ADR also found this
draft's "closes both consequences" claim did not survive the codebase's
own fresh-per-request role resolution — a target promoted to admin
*after* impersonation starts would still grant admin authority through
an already-live session, since this ADR's check ran only once, at
issuance. `ADR-0016`'s merged decision closes that direction too.

## Decision (retired)

The original decision (Option A: reject `impersonate()` calls where the
target holds the admin role, at issuance time) is preserved as a
considered alternative in `ADR-0016` — see that ADR for the current,
active decision and full reasoning.

## References

- Superseded by: `ADR-0016`
- `docs/features/admin-role-guards/PRD.md` — FC-006 (third consequence),
  Q-007 (part 3)
- `docs/features/admin-role-guards/DISCOVERY.md` — Candidate ADR 2
