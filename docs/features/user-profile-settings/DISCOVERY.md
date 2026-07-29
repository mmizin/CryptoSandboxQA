# Architecture Discovery — User Profile & Settings

Input: `docs/features/user-profile-settings/PRD.md` (Status: Review). This
scan reuses the PRD's Current Behavior evidence (already cited to
file:line and independently verified across four product-reviewer rounds)
rather than re-deriving it — see the PRD for underlying citations.

## System overview

`GET`/`PATCH /users/me` (`backend/src/users/users.controller.ts`,
`UsersService`) is a small CRUD extension of the existing `UsersController`
boundary already used by Registration, Admin Role & Guards, and Admin User
Creation. It reads/writes the `User` and `UserProfile` Prisma models. No new
container, service, or external integration is introduced. The frontend
surfaces for it (`/profile`, `/profile/settings`) are non-functional stubs
with no live caller — this is a documentation-completeness pass over a
partially-shipped feature, not new construction.

## Component inventory

| Component | Responsibility | New? |
|---|---|---|
| `UsersController` (`GET`/`PATCH /users/me`) | HTTP entrypoints | No — extends existing controller |
| `UsersService.updateProfile()` / `findByIdWithProfile()` | Read/write `User`+`UserProfile` | No — extends existing service |
| `UserProfile` (Prisma model) | Profile field storage | No — pre-existing table |
| `/profile`, `/profile/settings` (frontend) | UI surfaces | No — pre-existing stub pages, unauthored by this feature |

## Data flows

- Observed: `PATCH /users/me` → `UsersService.updateProfile()` →
  `prisma.userProfile.upsert()` + `prisma.user.update()` (two unwrapped
  statements, not transactional — PRD FR-002 AC3, Q-015).
- Observed: two other write paths (`registerWithProfile`,
  `createUserWithProfileAsAdmin`) converge on the same
  `UsersService.createWithProfile()` code, conditionally creating the same
  `UserProfile` row at registration time (PRD Current Behavior).
- No queue, cache, or external service touches this data. Integration
  surface is PostgreSQL only (PRD Integration Requirements).

## Candidate ADRs

Ranked by significance. All are genuine decision points already surfaced as
Open Questions in the PRD — discovery's job here is to confirm which
deserve promotion to ADR rather than staying PRD-level questions.

1. **Username identity normalization (case, whitespace, empty string).**
   PRD Q-014. `ADR-0008` (Accepted) explicitly declines to decide this and
   names the profile-endpoints PRD as the undecided owner. This is
   ADR-worthy: it's a genuine either/or decision (normalize at
   write-time vs. leave exact-match) with schema/validation consequences
   either way, not an implementation detail. **Recommend promoting to ADR.**
2. **Admin-impersonation audit metadata for profile writes.** PRD Q-013.
   `ADR-0016` (Accepted) already decided the containment *shape* (no
   `email` field, no password route) but explicitly left auditability of
   profile reads/writes unresolved for "non-transactional routes." Whether
   to add `performedByAdmin`-equivalent metadata to `UsersService`, matching
   deposits/orders/wallets, is a real decision with an existing precedent
   pattern to extend or deliberately not extend. **Recommend promoting to
   ADR** — likely a narrow one, since the precedent (existing
   `performedByAdmin` field usage elsewhere) constrains the design space.
3. **Null-write/failure-mechanism handling for non-nullable profile
   fields (`languageCode`, `timezone`, `preferences`).** PRD FC-003, Q-012.
   This is narrower than the two above — it's arguably a validation-layer
   fix (reject `null` in the DTO before it reaches Prisma) rather than an
   architectural decision. **Recommend NOT an ADR** — routine defect fix,
   implementation-level.
4. **Username-collision response code/atomicity.** PRD FC-001, Q-002.
   Already decided by `ADR-0008` (Accepted) — this feature's remaining gap
   is implementation (the `P2002` catch doesn't exist yet on
   `updateProfile()`), not a new decision. **Not ADR-worthy** — it's an
   implementation gap against an existing ADR, appropriately an
   Implementation Finding (see below) rather than a new candidate.
5. **FR-002's unenforced all-or-nothing update guarantee.** PRD Q-015.
   `ADR-0008`'s own Risks section already discusses this exact
   ordering-dependency risk and deliberately chose not to wrap the writes in
   `$transaction`. Revisiting that choice specifically for `updateProfile()`
   could be a small ADR amendment or addendum, but is more likely resolved
   as an implementation task once Q-014/Q-013 above are settled (both would
   touch `updateProfile()` anyway). **Recommend deferring** — bundle with
   whichever of #1/#2 above is actioned first, rather than a standalone ADR.

## C4 diagram assessment

**Not warranted**, consistent with every prior feature back through
Registration. No new container, service, or component boundary — this
feature extends `UsersController`/`UsersService`, already diagrammed (or
confirmed not to need diagramming) under `PRD-AdminUserCreation` and
`PRD-AdminRoleGuards`. The PRD's own Architecture Impact section reaches the
same conclusion; this scan confirms it rather than re-deriving it.

## Documentation gaps

- `PRD-UserProfileExtended` (backlog #10) does not exist yet, but its
  behavior — profile-row creation at registration via
  `POST /auth/register-with-profile` — is already shipped and referenced by
  three separate documents (this PRD's Q-009, `PRD-Registration` C-001, and
  now this discovery report). This is the same gap PRD-UserProfileSettings'
  Q-009 already names; no new gap to file.
- No test suite exists in this repo (`ADR-0008` Context notes this
  repo-wide), which is why PRD Q-015 (all-or-nothing update guarantee) has
  no automated verification path available — a repo-wide condition, not
  specific to this feature.

## Implementation Findings

No new Implementation Finding filed this scan. The candidate defects visible
in source (unhandled `P2002` on `updateProfile()`, unhandled null-write
failure, unaudited impersonation reach) are already captured either as PRD
Failure Conditions (FC-001, FC-003) with Open Questions naming the gap, or
as candidate ADRs above — filing them again as Implementation Findings would
duplicate the PRD's own tracking rather than add new evidence. Per this
skill's R-005 filing check, an Implementation Finding is for evidence not
already owned by an existing decision/gap record; here, the PRD already
owns all of it.

## Recommendation

Two candidate ADRs recommended for promotion (username normalization,
impersonation audit metadata). Given this session's token budget, recommend
pausing here for user go-ahead before invoking `adr-expert` on either —
consistent with the Review escalation gate now recorded in
`DOCUMENTATION_IMPLEMENTATION_PLAN.md`.
