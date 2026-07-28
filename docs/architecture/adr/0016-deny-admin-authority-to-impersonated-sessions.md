# ADR-0016: Deny admin authority to any impersonated session, unconditionally

## Status

Accepted

**Revision 2:** 2026-07-28 — a second `architecture-reviewer` Full Review
(of Revision 1) returned "Accept with changes": F-1 (audit-surface claim
in Consequences was inaccurate — an audit mechanism partially exists),
F-2 (a residual 2FA-enrollment harm was missing from Context), F-3 (a
materially realistic option — resolving authority from the impersonating
admin's own current role — was missing from Considered Options), F-4
(Risks' fallback pointed at the wrong option), F-5 (two unstated
operational consequences: chained impersonation now blocked, frontend
admin-UI mismatch during impersonation), F-6 (Q-007 part 3's auditing
question left unnamed), F-7 (a stale line citation and imprecise stub
wording in `ADR-0017`). All seven addressed in this revision (Option E
added to Considered Options; Consequences, Risks, and References
updated) and self-verified directly against source. Status moved to
Accepted as part of the same action, per the reviewer's own guidance
that items 1-4 gate Accepted status.

**Revision 1:** 2026-07-28 — an `architecture-reviewer` Full Review of this
ADR's original two-ADR split (this ADR plus a since-retired `ADR-0017`)
found: (1) a materially cheaper, more robust option was missing from both
option sets — denying admin authority to any impersonated session using
the `impersonatedBy` claim already attached to `request.user` on every
request, requiring no schema change; (2) the original ADR-0016's central
premise ("actor and subject are always different accounts") was false —
`PATCH/PUT /users/:id` (`users.controller.ts:101-127`) has no check
against the caller demoting themselves, so `ADR-0014`'s
current-session-preserving complication does apply and was wrongly
excluded; (3) the original ADR-0016 claimed to close a PRD consequence
and Open Question (`FC-006`'s stranded-`back_to_admin`-token case,
`Q-007` part 2) it never addressed; (4) the original decision (session
invalidation) directly contradicted `PRD-AdminRoleGuards` G-002/FR-002's
stated "no re-login required" design with no acknowledgment. This
revision replaces both original ADRs' decisions with the single option
the review surfaced, which resolves all four findings by construction
(it needs no session invalidation, so points 2 and 4 no longer apply; it
closes the impersonation-derived consequences in full, addressing point
1; point 3's gap is now explicitly named as out of scope rather than
silently miscited — see Consequences). The original `ADR-0017` file is
retired; see its stub for the redirect.

## Date

2026-07-28 (original); revised 2026-07-28

## Context

Two related gaps in `AuthService.impersonate()`
(`backend/src/auth/auth.service.ts:457-495`), originally drafted as two
separate ADRs, both trace to `PRD-AdminRoleGuards` FC-006 and Q-007 and
both concern the same underlying property:

1. **`impersonate()` validates the caller is an admin (`:461-464`) but
   the target only for existence (`:466-469`)** — nothing stops an admin
   from impersonating another admin. The resulting session, created for
   the target (`:480-482`), carries whatever role the target currently
   holds — including `'admin'` — because role is resolved fresh per
   request from the database (`JwtStrategy.validate()`,
   `jwt.strategy.ts:21-31`), not from any claim fixed at issuance. An
   impersonating admin therefore gains a second, independent path to
   admin authority for the life of that session (up to `JWT_EXPIRY`,
   7 days).
2. **That authority does not track the impersonating admin's own current
   role, in either direction.** If the impersonating admin is later
   demoted, the impersonated session is unaffected — the demoted admin
   retains admin authority through it. Symmetrically (and missed by both
   original drafts of this ADR pair), if a *non-admin* target is later
   **promoted** to admin while the impersonation session is still live,
   that session starts granting admin authority it never had at
   issuance — the same fresh-per-request resolution that makes a
   deliberate role change take effect immediately (`PRD-AdminRoleGuards`
   BR-002, G-002) applies identically to an impersonated session, since
   `AdminGuard` has no way to distinguish one from an ordinary session.

Both cases share one root fact: `JwtStrategy.validate()` already computes
and attaches `impersonatedBy` to `request.user` whenever the session is
impersonation-derived (`jwt.strategy.ts:27-29`, `if (payload.impersonatedBy)
{ result.impersonatedBy = payload.impersonatedBy }`) — this is present on
**every** request through an impersonated session, already, with no
schema change or additional tracking required to detect it.

**Not in this ADR's scope**, confirmed against source and named
explicitly so it is not silently dropped: `PRD-AdminRoleGuards` FC-006
also names (a) a demoted admin's own, non-impersonated session surviving
their demotion, and (b) a demoted admin's in-flight `back_to_admin` token
becoming permanently stranded (`endImpersonation()`'s `role !== 'admin'`
re-check, `auth.service.ts:512-515`). (a) is not a defect — it is
`PRD-AdminRoleGuards` FR-002/G-002's stated design (role re-resolves
fresh on the next request; no re-login required), and the original
drafts of this ADR pair were wrong to close it by invalidating the
session, which directly contradicts G-002 as written. (b) is `Q-007`
part 2, and belongs with `ADR-0011`'s scope (the `end-impersonation`
redemption path), not `impersonate()`'s issuance logic this ADR covers —
currently unowned, flagged in Risks below.

**Residual harm within scope, not previously named:** several
`AdminGuard`-independent routes are guarded only by `SessionGuard`/
`JwtAuthGuard` — notably `2fa/setup`, `2fa/enable`, `2fa/disable`
(`auth.controller.ts:264-284`). An impersonated session reaches these
today regardless of this decision, since they never checked `role` in
the first place. This is not a new gap this ADR introduces, but it is a
concrete instance of consequence 1 above worth naming: an admin
impersonating any account (not only an admin target) could enroll a new
2FA method on that account. Containment: `UpdateProfileDto` has no
`email` field (`backend/src/users/dto/update-profile.dto.ts`) and no
session-authenticated password-change route exists, so this stops short
of full account takeover — but it is a real residual risk this decision
does not close, since it isn't an `AdminGuard` question at all.
redemption path) or session management generally, not with
`impersonate()`'s issuance-time logic this ADR addresses — it remains an
open, currently unowned question.

## Decision Drivers

- **Closing both directions of the authority-drift problem** (demote-
  survives-impersonation and promote-during-impersonation) with one
  mechanism, since both stem from the same cause (role resolved fresh
  per request, `AdminGuard` blind to session provenance) and a fix
  addressing only one direction leaves the other symmetric gap open —
  exactly what happened when this was drafted as two separate ADRs.
- **Minimal cost, given a zero-cost option exists.** `impersonatedBy` is
  already computed and attached on every request; a decision requiring
  schema changes, session tracking, or invalidation cascades needs to
  justify why it's preferred over the option that needs none of that.
- **Preserve impersonation's legitimate purpose** (support/debugging) —
  this decision denies *admin authority* through an impersonated
  session, not impersonation itself; an admin can still impersonate and
  see what the target sees.
- **Consistency with `PRD-AdminRoleGuards` BR-002/G-002** — authority
  resolved fresh per request is this feature's own design property; the
  chosen option extends that property rather than contradicting it with
  a session-lifecycle mechanism layered on top.
- **Training-sandbox scope** (`CLAUDE.md`) — the guard-check addition
  below is a proportionate, small change; this ADR does not introduce
  audit-logging infrastructure or a session-tracking schema, both larger
  and separately justifiable if ever needed.

## Assumptions

- No existing or planned workflow requires an impersonated session to
  exercise admin authority — not verified against real usage (none
  exists for this codebase), only against the absence of any documented
  need. If wrong (e.g. a support workflow genuinely needs an admin to
  act with a target admin's privileges while impersonating), this
  decision blocks it with no fallback, and should be revisited with that
  workflow's actual requirements in hand.
- `request.user.impersonatedBy`'s presence is a reliable signal that the
  current request is impersonation-derived — confirmed directly:
  `JwtStrategy.validate()` sets it if and only if the token's
  `impersonatedBy` claim is present, and only `impersonate()` sets that
  claim (`auth.service.ts:471-475`).

## Considered Options

### Option A (original ADR-0017's Option A) — Reject `impersonate()` calls where the target holds the admin role

A target-role check at impersonation start.

- **Advantages:** Prevents an admin-target session from ever being
  minted.
- **Disadvantages:** Start-time-only — does not close the
  promote-during-impersonation direction (Context, point 2's second
  case): a non-admin target promoted after impersonation starts still
  grants admin authority through the already-live session, since the
  check ran once, at issuance, not on every request. Also does not touch
  the demote-survives-impersonation direction at all.
- **Risks:** Presents as though it closes "both consequences" (as the
  original `ADR-0017` draft claimed) when it structurally cannot cover
  either direction that depends on a *later* role change.

### Option B (this ADR's chosen option) — Deny admin authority unconditionally whenever a request is impersonation-derived

`AdminGuard` (`admin.guard.ts:8-20`) gains one additional condition:
reject if `request.user.impersonatedBy` is present, regardless of
`request.user.role`. An impersonated session can never pass `AdminGuard`,
no matter what role the target currently holds, and regardless of the
impersonating admin's own current role.

- **Advantages:** Closes both directions in Context with one check, at
  the point authority is actually exercised (every request), not only at
  issuance — immune to a later role change in either direction, the same
  way `AdminGuard`'s existing check is already immune to a stale JWT
  claim (`PRD-AdminRoleGuards` BR-002). Requires no schema change, no new
  tracking, no session invalidation, and therefore does not raise any of
  `ADR-0014`'s current-session-preservation complications (nothing is
  invalidated) and does not require `deleteAllUserSessions()`'s
  all-or-nothing collateral (nothing is deleted). Symmetric with the
  codebase's existing fresh-per-request authority model rather than
  layering a session-lifecycle mechanism on top of it.
- **Disadvantages:** An admin impersonating another admin purely to
  triage/observe (not to exercise admin authority) cannot use any
  `AdminGuard`-protected route while impersonating, even if that were a
  legitimate, narrow support need — this decision does not distinguish
  "view as" from "act as" within the impersonated session; it denies
  admin-authority routes uniformly.
- **Risks:** If a future legitimate need for "impersonate an admin and
  retain admin authority" surfaces, this option has no partial-allowance
  path built in — same posture as the original `ADR-0017`'s Option A,
  carried forward deliberately (see Decision).

### Option C — Reject admin-target impersonation at issuance AND deny admin authority per-request (A + B combined)

- **Advantages:** Belt-and-suspenders — closes the target-selection
  question explicitly (no admin-target session is ever minted at all,
  addressing repudiation/attribution concerns even for non-privileged
  actions taken against an admin's account) in addition to Option B's
  per-request denial.
- **Disadvantages:** Option B alone already closes every harm Context
  identifies (no impersonated session can exercise admin authority,
  regardless of target or timing); Option A's start-time check adds
  target-selection prevention on top, which has independent value
  (misattribution of *non-privileged* actions taken against an admin
  target's identity) but is not required to close FC-006's named
  consequences.
- **Risks:** None beyond A and B's own, combined.

### Option D — Do nothing

Leave `impersonate()` and `AdminGuard` as they are today.

- **Advantages:** No code change.
- **Disadvantages:** Leaves both directions in Context open.
- **Risks:** None new; status quo.

### Option E — Resolve admin authority from the impersonating admin's own current role, not the target's

When `request.user.impersonatedBy` is present, `AdminGuard` looks up the
*impersonating admin's* current role (a fresh `usersService.findById(
impersonatedBy)` call) and grants or denies based on that, instead of the
resolved `request.user.role` (the target's role).

- **Advantages:** The only option in this set that *preserves* an
  act-as-admin-while-impersonating workflow if the Assumption that no
  such workflow exists turns out to be wrong — Options A/B/C all deny
  unconditionally and have no fallback for that case. Closes both
  directions in Context: a demoted impersonator is denied on their very
  next request (the demotion is checked, same as any other request, just
  against a different user ID); a target promoted mid-session grants
  nothing extra, since the target's role no longer feeds the decision at
  all. Requires no schema change, same as Option B.
- **Disadvantages:** `AdminGuard.canActivate` is currently synchronous
  (`admin.guard.ts:9-21`); this option requires an additional DB lookup,
  making it async — a larger change to the guard than Option B's
  single-field check, though still no schema change. Does not close the
  attribution/misattribution concern Option A/C address (the impersonator
  still acts under the target's identity for non-privileged actions).
- **Risks:** If the impersonating admin's own role lookup fails to
  exclude the case where *they* are the one being impersonated
  (nested/chained impersonation — see Consequences), the check needs to
  resolve against the *original* admin, not an intermediate one; this
  option's implementation would need to get that right, which Option B's
  simpler unconditional denial does not need to reason about at all.

**Not chosen**, evaluated against this ADR's own Decision Drivers: the
"minimal cost, given a zero-cost option exists" driver sets the bar at
whether an option needs schema changes, session tracking, or
invalidation cascades to justify itself over one that needs none of
those — Option E clears that bar (no schema change either), so it is
rejected on a different basis: the Assumption this ADR states (no
verified need for admin authority during impersonation) is judged, on
balance, more likely true than not for this training-sandbox codebase,
and Option B is simpler to reason about and audit than a second,
target-dependent authority-resolution path layered next to the existing
one. If that Assumption is later shown false, Option E — not Option C —
is the fallback to implement (see Risks).

## Decision

**Option B**, with Option A's target-side check deliberately **not**
added now (see Alternatives Rejected) — tracked as a possible future
hardening (Option C) if the attribution concern below is judged worth
its own decision later, not bundled into this one.

Chosen over Option A alone because Option A cannot close the
promote-during-impersonation direction by construction (a start-time
check has no way to react to a role change that happens after
impersonation begins), which was the exact gap that caused this ADR pair
to be revised. Chosen over Option C (A+B combined) because Option B
alone already closes every consequence `PRD-AdminRoleGuards` FC-006
names for this ADR's scope — Option A's marginal value (preventing
non-privileged-action misattribution against an admin target
specifically) is real but narrower than what justified this ADR, and
bundling it in now would re-introduce a second, less-clearly-justified
decision into what should be one focused fix. If misattribution against
admin targets specifically is later judged worth addressing, that is
Option C's remaining half, evaluable on its own terms. Chosen over Option
D because both directions in Context are real, evidenced gaps.

## Consequences

### Positive

- Closes the demote-survives-impersonation direction (an ex-admin
  retaining admin authority through a session they created while still
  an admin) and the promote-during-impersonation direction (a session
  gaining admin authority it never had at issuance) with one mechanism,
  at the point authority is exercised.
- No schema change, no session tracking, no invalidation cascade, no
  collateral effect on the impersonated account's other sessions.
- Symmetric with `PRD-AdminRoleGuards`'s own fresh-per-request authority
  model (BR-002) rather than introducing a session-lifecycle exception
  to it.
- **Chained impersonation is blocked as a side effect.** `POST
  /auth/impersonate` is itself `AdminGuard`-protected
  (`auth.controller.ts:215-216`), so once an impersonated session is
  denied admin authority, it can no longer call `impersonate()` a second
  time — an admin cannot impersonate through another impersonated
  session. `POST /auth/end-impersonation` carries no guards
  (`auth.controller.ts:226`), so this does not risk stranding anyone in
  an impersonated session with no way back.

### Negative

- An admin impersonating an admin target for observation only, with no
  intent to exercise admin authority, is blocked from every
  `AdminGuard`-protected route during that impersonation — this decision
  does not offer a narrower "view as" allowance.
- Does not address misattribution: non-privileged actions taken while
  impersonating an admin target are still attributed to the target's
  identity for **routes with no audit surface**. An audit mechanism does
  exist today for a subset of state-changing routes — deposits, orders,
  and wallet operations record `performedByAdmin`/`adminId` metadata
  keyed off `request.user.impersonatedBy`
  (`backend/src/deposits/deposits.controller.ts:40-47`,
  `backend/src/orders/orders.controller.ts:25-30,55-61`,
  `backend/src/wallets/wallets.controller.ts:42-44,59-61`, persisted at
  `backend/src/wallets/wallets.service.ts:370,436`) — but it is opt-in
  per controller, not a structural guarantee, and read-access or
  non-transactional routes (e.g. profile reads, the 2FA routes named in
  Context) have no equivalent. Option A/C would have narrowed this by
  preventing admin-target impersonation outright; this decision does
  not.
- Does not address the two items named out of scope in Context: the
  demoted admin's own (non-impersonated) session, and the stranded
  `back_to_admin` token — both remain open, the latter with no clear
  current owner.
- **Frontend admin UI does not reflect this decision.** `isAdmin` is
  computed client-side from `user?.role === 'admin'`
  (`frontend/lib/useAuth.ts:134`), which still resolves the target's
  role, not the new backend-enforced denial — the admin navigation menu,
  including the `/admin/impersonate` link
  (`frontend/components/Header.tsx:332-336`), continues to render during
  impersonation of an admin target even though every `AdminGuard`-backed
  action it links to will now be rejected server-side. No frontend
  change is included in this decision; the mismatch is a known,
  unaddressed consequence.

## Risks

- **Assumption dependency**: this decision assumes no legitimate need
  exists for an impersonated session to retain admin authority — if
  that's wrong, the fix is Option E's territory (resolve authority from
  the impersonating admin's own current role, evaluated and rejected
  above on the current evidence, not because it's technically
  unworkable), not a silent bypass of the check added here. Option C
  (A+B) does not serve as a fallback here — it is strictly more
  restrictive than Option B, not less, so it cannot recover a workflow
  Option B blocks.
- **`Q-007` part 3 (admin-to-admin impersonation auditing) is answered
  only as to authority, not as to auditing.** This decision closes
  whether an admin-target impersonation *grants* extra authority (no,
  after this change) but does not add or require an audit record of the
  impersonation itself — whether admin-to-admin impersonation should be
  logged is a separate, still-open question, distinct from the
  authority question this ADR resolves.
- **`Q-007` part 2 (stranded `back_to_admin` token) remains unowned.**
  `docs/features/admin-role-guards/DISCOVERY.md` Candidate ADR 1
  originally scoped this in; this revision explicitly scopes it out
  (Context) because it belongs with `end-impersonation`'s redemption
  logic (`ADR-0011`'s territory), not `impersonate()`'s issuance logic —
  but no ADR currently claims it. Flagged so it is not lost between the
  two.
- **Interacts with `PRD-SessionManagement` FR-005** (ending impersonation
  doesn't revoke the impersonated session) and `ADR-0011`'s deferred
  Option C1 — both concern the impersonated session's lifecycle after
  impersonation ends, a different point in time than this ADR's
  per-request check during impersonation. No conflict, but worth reading
  together if either is picked up.

## Alternatives Rejected

- **Option A alone** (original `ADR-0017`'s decision): rejected as
  insufficient on its own — cannot close the promote-during-impersonation
  direction, the exact gap this revision exists to fix.
- **Option C (A+B combined):** not rejected, deferred — Option B alone
  closes this ADR's named consequences; Option A's additional
  misattribution-prevention value is real but independently justifiable,
  and bundling it now would reintroduce the scope ambiguity this
  revision was written to resolve. Revisit if attribution against admin
  targets specifically is raised as its own concern.
- **Option D (do nothing):** rejected — both directions in Context are
  real, evidenced gaps with no mitigation today.
- **The original ADR-0016 decision (invalidate sessions on role
  revocation):** rejected on revision — see the Revision 1 note above;
  it contradicted `PRD-AdminRoleGuards` G-002 as written, misattributed
  its infrastructure precedent, and its central premise about
  actor/subject always differing was false.

## Related ADRs

- Related: `ADR-0010` (session revocation model) — not used by this
  decision (no session is invalidated), noted because the original draft
  of this ADR pair relied on it and that reliance is now removed.
- Related: `ADR-0011` (end-impersonation authentication boundary,
  Proposed) — scoped to the redemption/restore path
  (`end-impersonation`), not to `impersonate()`'s issuance-time logic
  this ADR addresses; the stranded-`back_to_admin`-token question this
  ADR scopes out (Risks) is closer to `ADR-0011`'s territory than to
  this one's.
- Related: `ADR-0014` (session revocation on 2FA enrollment, Accepted) —
  not used by this decision; noted because the original draft of this
  ADR pair incorrectly claimed `ADR-0014`'s current-session-preservation
  complication did not apply here (it does, for self-demotion via
  `PATCH/PUT /users/:id`) — moot under this revision since no session is
  invalidated.
- Supersedes: the original, retired `ADR-0017` (`0017-restrict-
  impersonation-of-admin-accounts.md`) — its Option A is incorporated
  here as a rejected-for-now alternative (Option C's remaining half), not
  discarded.

## References

- `docs/features/admin-role-guards/PRD.md` — FC-006, Q-007
- `docs/features/admin-role-guards/DISCOVERY.md` — Candidate ADR 1,
  Candidate ADR 2
- `backend/src/auth/auth.service.ts:457-495` — `impersonate()`
- `backend/src/auth/jwt.strategy.ts:21-31` — `JwtStrategy.validate()`,
  the `impersonatedBy` attachment this decision relies on
- `backend/src/auth/guards/admin.guard.ts:9-21` — `AdminGuard`, where
  this decision's check is added
- `backend/src/users/users.controller.ts:101-127` — `PATCH`/`PUT
  /users/:id`, confirming self-demotion is reachable (corrects the
  original draft's premise)
