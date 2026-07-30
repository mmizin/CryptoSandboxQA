# ADR-0021: Fallback path when an impersonation restore attempt is correctly refused

## Status

Accepted

## Date

2026-07-30

## Context

`POST /auth/end-impersonation` (`backend/src/auth/auth.controller.ts:226-232`,
`backend/src/auth/auth.service.ts:497-518`) restores an admin's own session
by redeeming a `backToAdminToken`. Redemption re-checks, fresh against the
DB, that the token's subject still holds `role = 'admin'`
(`auth.service.ts:512-515`). If the admin's role was changed away from
`admin` at any point between starting impersonation and attempting to end
it, this check correctly refuses the restore — that refusal itself is not
in question; it is exactly what an authorization check re-verified at
redemption time is supposed to do.

The gap this ADR addresses is what happens **after** that correct refusal.
Today, nothing does. On the frontend, `returnToAdmin()`
(`frontend/lib/useAuth.ts:97-125`) removes `backToAdminToken` from
`localStorage` unconditionally, regardless of outcome, immediately after
the request completes (`useAuth.ts:109`) — before its failure branch
(`:111-117`) runs. That failure branch then, on any non-`2xx` response,
also clears the `token` key, nulls `user`/`impersonating` state, and
redirects to `/login`. There is no partial or intermediate state — a
refused restore fully logs the admin out of the browser session in one
step. `ImpersonationBanner`
(`frontend/components/ImpersonationBanner.tsx:6-8`), the only UI that can
invoke `returnToAdmin()`, unmounts as soon as `impersonating` is cleared,
so no retry affordance survives the refusal either. The impersonated
session itself is untouched by any of this and remains live for the rest
of its own 7-day lifetime (`JWT_EXPIRY`, `auth.service.ts:53`) —
`endImpersonation()` never looks it up or acts on it; `PRD-Impersonation`
tracks that as its own gap (`FC-005`), scoped explicitly to the case where
`end-impersonation` **succeeds** — the refusal case this ADR is about is
disjoint from that scope, not a subset of it, and so not literally covered
by that tracker entry.

`PRD-Impersonation`'s `FC-008` describes this condition and states its
Expected behavior as **"Not established"** — it is an open product
question, not a settled intent this ADR can appeal to as already decided.
`FC-008`'s own text also asserts a retry mitigation this ADR's Context
above disproves: it says a retry would succeed "if the admin is
re-promoted to `admin` before the restore token's own 1-hour expiry" — but
the token is already removed from `localStorage`
(`useAuth.ts:109`) immediately after any redemption attempt completes,
success or failure alike (see above), so no retry is reachable after even
one refused attempt regardless of later re-promotion. This ADR does not
correct
`FC-008`'s text (a `PRD-Impersonation` edit, outside this ADR's scope) but
records the discrepancy here so the Decision below is not read as
confirming that mitigation exists.

Its owning question, `Q-001b`, asks plainly: *"Should ending impersonation
be made possible even after the admin's own role changes mid-impersonation
… or is forced re-authentication in that case an accepted outcome?"* This
ADR answers that question; it does not inherit an answer from elsewhere.

This gap is explicitly named, and explicitly left unowned as to the
*server-side redemption mechanism*, by `ADR-0016` — the only one of the two
sibling decisions on this endpoint whose own text mentions it (see below):

- **`ADR-0016`** (Accepted — denies `AdminGuard` authority to any
  impersonated session via the `impersonatedBy` claim, regardless of the
  session's current role) states in its own Risks section: *"`Q-007` part
  2 (stranded `back_to_admin` token) remains unowned.
  `docs/features/admin-role-guards/DISCOVERY.md` Candidate ADR 1 originally
  scoped this in; this revision explicitly scopes it out (Context) because
  it belongs with `end-impersonation`'s redemption logic (`ADR-0011`'s
  territory), not `impersonate()`'s issuance logic — but no ADR currently
  claims it."* That statement is one-directional: `ADR-0011` itself,
  dated one day before `ADR-0016`'s current revision, makes no mention of
  this gap, the `FC-004` role-change case, or `ADR-0016` anywhere in its
  own text. (Note: `ADR-0011` uses `FC-004`/`FC-005` to mean distinct
  entries in `PRD-SessionManagement`, not the `PRD-Impersonation` entries
  this ADR cites throughout — every bare `FC-004`/`FC-005` in this
  document refers to `PRD-Impersonation` unless a different PRD is named
  explicitly. Separately, `FC-006` collides between the two PRDs this ADR
  bridges: `PRD-Impersonation` `FC-006` is the impersonated-session-
  retains-admin-authority case `ADR-0016` closed, while `PRD-AdminRoleGuards`
  `FC-006` is the three-consequence entry discussed just below. Every bare
  `FC-006` in this document is `PRD-AdminRoleGuards`'s, unless
  `PRD-Impersonation` is named explicitly, as it is in Consequences →
  Negative below. `Q-007` collides the same way: `PRD-Impersonation`
  `Q-007` is about audit coverage (cited in Risks below), while
  `PRD-AdminRoleGuards` `Q-007` is the three-part question this passage
  discusses, disambiguated throughout by its "part N" suffix.)
- **`ADR-0011`** (Proposed — governs `end-impersonation`'s redemption
  mechanics: declared guard, single-use enforcement, and binding the
  restore token to the impersonated JWT via Option C2) decides only how a
  *valid* restore attempt is authenticated. Its adopted decision does not
  address what happens once redemption is *correctly refused* because the
  subject's role has changed.

**`PRD-AdminRoleGuards`'s `Q-007` part 2 / `FC-006`** is the identifier
`ADR-0016`'s quoted sentence above actually refers to — a distinct tracker
entry in a different PRD from `PRD-Impersonation`'s own `Q-001b`/`FC-008`,
tracking the same underlying gap. `FC-006` (`docs/features/admin-role-guards/PRD.md`)
names three consequences of an admin's role changing mid-impersonation: (1)
a session minted via `impersonate()` for the *target* outliving the minting
admin's own demotion, (2) the demoted admin's `back_to_admin` token
becoming permanently stranded, and (3) an impersonated session retaining
admin authority when the target is also an admin. `ADR-0016` already
closed (3). This ADR addresses (2) only.

Consequence (1) is a separate question from this ADR's, and its ownership
is unsettled independent of anything decided here: `ADR-0016`'s own Context
section names, as explicitly out of its scope, **a different item** — "a
demoted admin's own, non-impersonated session surviving their
demotion" — and routes *that* item to `PRD-AdminRoleGuards` FR-002/G-002
("role re-resolves fresh on the next request"). That is the admin's own
session, not the target's session `FC-006` consequence (1) actually names,
so `ADR-0016`'s routing does not straightforwardly cover consequence (1)
either, despite `ADR-0016` citing `FC-006` as its source for it. Consequence
(1) is separately tracked as `PRD-AdminRoleGuards` `Q-007` part 1 ("should
revoking an admin's role invalidate sessions that admin already issued via
`impersonate()`?") — so it is not an untracked gap, but it is un-adjudicated
by any ADR, which `ADR-0016`'s mismatched routing does not change. This ADR
does not adjudicate `Q-007` part 1 either; consequence (1) remains without
an ADR-level owner, regardless of this decision.

**Explicitly out of scope:** `ADR-0011`'s own redemption-mechanics decision
(guard placement, single-use enforcement, JWT binding) — assumed as given,
not re-argued here. `ADR-0016`'s decision to deny admin authority to
impersonated sessions — unaffected either way. Self-impersonation
(`FC-009`), admin-to-admin impersonation targeting (`ADR-0016`'s deferred
Option C), the 2FA bypass during impersonation, the restore token's
general 1-hour lifetime policy (`Q-001a`), and voluntary logout during
active impersonation (`PRD-Logout` `Q-006`/`PRD-Impersonation` `Q-010`, a
different trigger reaching a similar stranded state) are unrelated or
separately-tracked questions and are not addressed.

This is drafted as a standalone ADR rather than an amendment to
`ADR-0011`, even though `ADR-0011` is still Proposed and therefore still
editable: the two questions are logically separable (one is about how a
*valid* restore is authenticated; this one is about what happens once
redemption is *correctly refused*), and keeping them as separate documents
lets either be revised — `ADR-0011`'s redemption mechanics, or this ADR's
post-refusal answer — without disturbing the other's acceptance status.

## Decision Drivers

- **Security** — no option may grant a *demoted* admin a path back to
  admin authority.
- **Availability / operability** — how much cost is acceptable to spare a
  demoted admin a full password re-authentication, for what is expected to
  be an infrequent event (role changes mid-impersonation), with no usage
  or incident data currently available either way (`PRD-Impersonation`'s
  Success Metrics section records none exists).
- **Consistency with the existing model** — a fallback-to-password outcome
  is already an accepted pattern in this same mechanism, from an adopted
  (not merely deferred) decision: `ADR-0011`'s **adopted** Option B (single-use
  enforcement) states its own cost plainly — "a lost response after a
  successful redemption now requires the admin to re-authenticate with
  their password rather than retry" (`0011-...md`, Decision) — for a
  different trigger (a lost success response) than this ADR's (a role
  change), but the same accepted fallback shape.
- **Simplicity** — `end-impersonation`'s existing mechanism is a stateless
  JWT check with no schema-level record (`ADR-0011`'s Context), though
  `ADR-0011`'s own adopted Option B (single-use enforcement) already
  introduces persistent state on this exact route — "no persistent state
  anywhere on this endpoint" is not an invariant this ADR can rely on
  post-`ADR-0011`.

## Assumptions

- The admin's role change (demotion) during an active impersonation is a
  legitimate event that should stick — this ADR does not create a path
  that lets the demoted admin regain admin authority. If that assumption
  is wrong (i.e., demotion during impersonation should itself be blocked
  or delayed), that is a different decision belonging to
  `PRD-AdminRoleGuards`'s role-management surface (demotion is that PRD's
  FR-003, not `PRD-AdminUserCreation`'s — that PRD's own Non Goals disclaim
  role changes as out of its scope), not this one.
- Demotion mid-impersonation is treated as an infrequent event. No
  evidence (audit data, support tickets) exists to confirm or refute this
  — `PRD-Impersonation`'s Success Metrics section records none is
  available, and no test suite exercises either endpoint
  (`DISCOVERY.md`). If this assumption is wrong, the balance struck by
  this decision should be revisited with that evidence — see Risks.
- `ADR-0011` (Proposed, not Accepted) is treated as a stable dependency for
  several supports in this ADR — the Consistency driver's precedent, the
  Simplicity driver's persistent-state caveat, and the inherited rejection
  of the "own original session" alternative (see Alternatives Rejected) —
  plus Option B's current pricing, which is separately dependent on
  `ADR-0011` in a different way (see Risks). If `ADR-0011` is materially
  revised before acceptance, each of these should be re-checked against
  whatever it ultimately decides — see Risks.

## Considered Options

### Option A — No change; forced re-authentication is the accepted outcome

- **Advantages:** No new authentication path, no new expiry concept, no
  schema change, no code change of any kind. Cannot leak admin authority
  to a demoted account under any circumstance, since nothing about what
  redemption accepts changes. Matches the same fallback-to-password shape
  `ADR-0011`'s **adopted** Option B already accepts as a cost on this
  endpoint, for a different trigger (a lost success response rather than
  a role change) — see Decision Drivers.
- **Disadvantages:** The admin is fully logged out of the browser (not
  merely denied one action) the moment a restore is refused for this
  reason, with no distinction shown between "your role changed" and any
  other rejection reason (`:506` expired/malformed, `:509` wrong purpose,
  `:514` no longer admin or account not found).
- **Risks:** None beyond the UX cost already named — this is the current
  behavior.

### Option B — Grace/override path back to the admin's own (now non-admin) account

- **Description:** On `FC-004` refusal, instead of a bare rejection, issue
  the admin a fresh session **as themselves, at their current (demoted)
  role** — not as an admin — so they land on their own current account
  rather than being forced through `/login`. What exactly would be
  time-boxed is a real open design question this option does not resolve
  on its own — see Disadvantages.
- **Advantages:** Removes the forced-password-reauth step for the common
  case (the admin still knows who they are; they just aren't an admin
  anymore).
- **Disadvantages:**
  - **Security — unauthenticated-endpoint exposure, not analyzed by
    "grants no admin authority" alone.** `POST /auth/end-impersonation`
    carries no `@UseGuards` decorator today (`auth.controller.ts:226-232`)
    — `backToAdminToken` in the request body is the only credential
    checked. Currently, a stolen `backToAdminToken` belonging to a
    demoted admin is worthless: `auth.service.ts:513-515` refuses it.
    Under this option, that same stolen token becomes a working credential
    that mints a full session **for the demoted admin's own account** —
    account takeover, from the same token this endpoint already trusts
    unconditionally. The compromise channels involved are exactly the
    ones `ADR-0011`'s Threat Model driver names for this token:
    `localStorage`/client-side exposure as the **dominant** vector, and
    request logs or error-reporting payloads as a **secondary** one it
    calls out separately. If the
    demotion itself was triggered by suspected compromise (one of the
    scenarios Option C's rejection below names), this option would hand
    the compromising party a session as that same user. This is not
    disqualifying by itself the way it is for Option C — no admin
    authority is granted — but it is a real, unanalyzed cost that
    "grants no admin authority" does not capture on its own.
  - **Pricing depends on which side of `ADR-0011` it lands on.**
    Against *current* source, `issueTokenAndSession()`
    (`auth.service.ts:440-455`) is already role-agnostic and takes no role
    parameter, so removing the `role !== 'admin'` gate at `:513-515` and
    branching to call that same helper is a small change. But `ADR-0011`'s
    adopted Option A moves this exact signature/purpose/role check into a
    declared guard — and a guard can only permit or deny a request, not
    branch to issue a different kind of session. Once `ADR-0011` lands as
    drafted, this option requires restructuring `end-impersonation` away
    from a pure guard, which is a larger change than priced above. This
    ADR does not resolve that sequencing question; see Risks.
  - **Ambiguous scope.** `issueTokenAndSession()` hardcodes a 7-day JWT
    and session row with no expiry parameter (`JWT_EXPIRY`, `:53`;
    `:446-448`). If this option issues an ordinary 7-day session, the
    "time-boxed" framing is inaccurate and the security cost above extends
    for up to 7 days, not the restore token's 1-hour window; if instead
    the *issued* session itself must be capped to the restore token's
    remaining lifetime, `issueTokenAndSession()` cannot be reused as-is and
    the cost above under-prices it further. This ADR does not resolve
    which reading is intended.
  - No usage/incident/support data justifies the cost either way today.
- **Risks:** Expands the set of states this endpoint can produce, from
  exactly two (admin session or refusal) to three. Also only partially
  answers `PRD-AdminRoleGuards` `Q-007` part 2's literal proposal (see
  Alternatives Rejected) — it lands the admin on a *fresh* non-admin
  session for themselves, not their own original (pre-impersonation)
  session.

### Option C — Re-validate against a more permissive signal than live `role='admin'`

- **Description:** Instead of requiring `role === 'admin'` at redemption
  time, accept the restore if the subject *held* `admin` at the moment
  impersonation started (e.g. by embedding a snapshot claim or timestamp
  in `backToAdminToken` at issuance) even if it has since changed.
- **Advantages:** Would let the admin regain admin authority even after
  demotion, closing the "stranded" feeling entirely.
- **Disadvantages:** A demoted-admin's role change is frequently the
  direct reason to want their access curtailed (e.g. a compromised
  account, a terminated engagement) — trusting a stale snapshot at
  redemption time would let exactly that admin regain a full admin session
  for up to the restore token's remaining lifetime after the demotion.
  This is the same "demote-survives" failure mode `ADR-0016`'s Context
  names as a reason that ADR exists at all, applied here to the *restore*
  side of the same feature instead of the *authority-check* side.
- **Risks:** Reopens a demote-survives gap on this feature from a
  different entry point than the one `ADR-0016` closed. Rejected without a
  UX cost/benefit analysis, since the security regression alone is
  disqualifying regardless of magnitude.

### Option D — Suppress the logout-and-redirect on this specific refusal, with no retry affordance and no new credential

- **Description:** On `FC-004` refusal specifically, the frontend shows the
  reason (role no longer admin) without clearing the `token` key or
  redirecting to `/login`, suppressing only that part of the failure
  branch (`useAuth.ts:112-115`, retaining the `:116` `return`). No token
  is retained for a future retry
  (unlike the abandoned drafting idea below) and no new session is issued
  (unlike Option B).
- **Advantages:** Removes Option A's full-logout cost at effectively zero
  implementation cost — a frontend conditional, no backend change, no new
  credential, no new expiry concept. Distinct in kind from both Option B
  (issues nothing) and the abandoned retain-token idea (retries nothing).
- **Disadvantages:** `backToAdminToken` is still removed from
  `localStorage` unconditionally one line earlier (`useAuth.ts:109`,
  before the branch this option suppresses), so `impersonating` clears on
  the next `refreshUser()` regardless and `ImpersonationBanner` unmounts —
  the admin is left holding a live impersonated session with **no visible
  indication they are impersonating and no route back except manually
  logging out themselves**, a larger and stranger-feeling cost than "stays
  logged in a little longer" first suggests, and close in kind to the
  stale-state problem the abandoned drafting idea produces from the
  opposite direction (there, a stale credential outlives its usefulness;
  here, a live one becomes invisible). Achieving the more modest "stays in
  the same visible state, decides to leave later" version this option was
  originally meant to describe would additionally require retaining
  `back_to_admin` past `:109` for this specific failure, which reintroduces
  the retained-token defect the abandoned idea documents. Also carries
  Option A's other named Disadvantage (no distinct messaging for this
  refusal reason vs. any other), unless the frontend change also adds
  such messaging, which this option does not itself require.
- **Risks:** Grants no new authority and issues no new token, so no
  security regression — but the practical UX benefit over Option A is
  smaller than a first read suggests, given the Disadvantages above.

## Considered and abandoned during drafting

**Retain `backToAdminToken` on `FC-004` refusal specifically, so a later
retry (after re-promotion, within the token's remaining lifetime) can
succeed, without any other change.** This was evaluated as a cheap,
frontend-only alternative to Option B, on the premise that it merely fixes
a bug preventing an already-intended retry path. On inspection this
premise does not hold, and the actual mechanism is more specific — and
worse — than "it just doesn't help":

- `FC-008`'s Expected behavior is "Not established" (see Context) — there
  is no already-intended retry path to restore; adopting this would be
  *deciding* a new behavior, not fixing a defect.
- **The retained token does not silently do nothing — it produces a
  stale banner, and briefly a working button, after the admin's next
  ordinary login.** Once `token` is cleared and the admin is redirected to
  `/login` (`useAuth.ts:112-116`), the next page load's `refreshUser()`
  hits its early-return branch for a missing `token`
  (`useAuth.ts:26-31`) and never reaches its `.catch` handler — so
  `back_to_admin` is **not** deleted at that point, contrary to an earlier
  reading of this option, though it is not retained indefinitely either:
  `logout()` (`useAuth.ts:63-64`), any subsequent `/users/me` failure
  (`:44`), or the admin's own next `returnToAdmin()` call each clear it
  independently. When the admin logs back in through the normal `/login`
  flow (as themselves, demoted) before any of those fire,
  `refreshUser()`'s success path (`useAuth.ts:38-40`) finds `back_to_admin`
  still present and sets `impersonating` — which is exactly
  `PRD-Impersonation` BR-002's two-condition definition of "active
  impersonation" (`back_to_admin` present **and** the current token's
  identity check succeeded). `ImpersonationBanner` then renders, falsely
  announcing "You are currently logged in as \<the admin's own email\>,"
  with a "Return to Admin Account" button that only actually works if the
  admin has, by that point, also been re-promoted **and** the restore
  token's own 1-hour lifetime (`BACK_TO_ADMIN_EXPIRY`) has not yet
  elapsed — a narrower window than "now actually works" suggests, but
  reachable, and still a stale, misleading banner regardless of whether
  the button itself would succeed. This is a materially different, and
  worse, defect than "no effect": a stale credential surviving an
  unrelated login, not a no-op.
- Making the *intended* retry (during the original session, without a
  fresh login) actually reachable would require suppressing the
  logout-and-redirect on this specific failure and presenting dedicated UI
  to retry from — at which point the admin is being kept in an
  authenticated, signed-in state pending a possible future retry, which is
  the same shape of change as Option B, not a strictly cheaper alternative
  to it.

Recorded here so a future reader does not re-derive and re-propose the
same apparently-cheap fix without re-discovering that it does not reduce
to less work than Option B, and introduces its own stale-credential defect
along the way.

## Decision

**Option A.** Forced re-authentication remains the accepted outcome when a
restore attempt is correctly refused because the admin's role has changed.
This answers `Q-001b`/`FC-008` and `PRD-AdminRoleGuards` `Q-007` part
2/`FC-006`'s stranded-token consequence as **decided**, not merely left
open: no fallback beyond full re-authentication is provided, by choice.

**Why:** Option C is rejected outright — it reopens a demote-survives gap
on the restore side of this feature, for no stated benefit strong enough
to justify the regression, independent of exactly how `ADR-0016`
implements its own check on the authority side. Option B is not rejected
on principle — it grants no *admin* authority — but it is rejected **for
now**, on two grounds together: an unanalyzed security cost (it converts
a currently-worthless stolen restore token into a working credential for
the demoted admin's own account, on an endpoint with no guard at all —
see Option B), and the absence of any usage data, incident, or support
cost establishing that the convenience it provides is worth that cost plus
the added authentication-boundary surface. It also only partially
satisfies `Q-007` part 2's literal ask in any case (see Alternatives
Rejected). The frontend-only "retain the token" idea considered during
drafting turned out not to be a cheaper variant of anything — it
introduces its own stale-banner/stale-credential defect (see "Considered
and abandoned during drafting") and, done properly instead, becomes
Option B.

**Option A over Option D:** Option D is not rejected on safety grounds — it
grants no new authority either, same as Option A. But on inspection (see
Option D's Disadvantages) it does not deliver the improvement it was
proposed for: `backToAdminToken` is removed from `localStorage`
unconditionally one line before the branch Option D would suppress, so the
impersonation banner disappears regardless — Option D trades Option A's
one named cost (full, visible logout) for a worse one (the admin silently
loses all indication they are impersonating, with no route back except a
manual logout they must think to perform themselves), not a smaller cost
for a smaller one. Achieving the originally-intended, milder version of
this option would require also retaining `back_to_admin` past that removal
for this specific failure — which reintroduces the abandoned drafting
idea's stale-credential defect from the opposite direction. Deferred
rather than adopted or discarded outright — see Alternatives Rejected —
since a differently-scoped version (one that also preserves the banner)
remains a live possibility this ADR has not fully evaluated.

Option A is chosen because it is the simpler of the two options that grant
no new authority and require no backend change, its cost is precisely
named and bounded (Option D's is not, once traced through source), and it
matches the same fallback-to-password precedent named in Decision Drivers
and Option A's own Advantages.

**Why now:** This gap has been explicitly flagged as unowned by `ADR-0016`
(with `ADR-0011` silent on it rather than co-flagging it — see Context) and
separately tracked in two PRDs — `PRD-Impersonation` (`Q-001b`/`FC-008`)
and `PRD-AdminRoleGuards` (`Q-007` part 2/`FC-006`). Leaving it
perpetually referenced-but-undecided across those is worse than recording
a deliberate "no change" decision.

## Consequences

### Positive

- Answers `PRD-Impersonation` `Q-001b`/`FC-008` and closes
  `PRD-AdminRoleGuards` `Q-007` part 2/`FC-006`'s stranded-token
  consequence (2) specifically — `FC-006`'s other two named consequences
  are unaffected by this ADR: (3) admin-target authority retention was
  already decided, though not yet implemented in source, by `ADR-0016`
  (see Negative below); (1) (the target's session outliving the admin's
  demotion) remains without an ADR-level owner, as discussed in Context —
  this ADR does not newly close or newly open that gap either way.
- No code change, no new authentication path, no new expiry policy to
  reason about or secure.
- Preserves a live-role-check principle on the restore side, consistent
  in spirit with `ADR-0016`'s treatment of the impersonated side, without
  depending on a precise restatement of that ADR's mechanism.

### Negative

- **`G-001`** ("an admin can begin acting as any target user's account …
  and can end that and return to their own admin session") does not hold
  unconditionally: it holds only while the admin retains the admin role
  through the point they attempt to end impersonation. `PRD-Impersonation`
  should record this as `G-001`'s stated qualifier, not as a defect this
  ADR failed to close.
- An admin demoted while actively impersonating must fully re-authenticate
  with their password to regain access to their own (now non-admin)
  account — the most expensive available path in the system, for what is
  assumed, without direct evidence, to be an infrequent event.
- **This does not contradict `PRD-AdminRoleGuards` G-002** ("a role change
  takes effect without requiring the affected account to re-authenticate"),
  even though the outcome is forced re-authentication. G-002 governs
  whether the role change itself *takes effect* without re-authentication —
  it does, immediately, server-side: nothing about the admin's own
  `user_sessions` row is invalidated by this decision (see Alternatives
  Rejected), and any request the admin's still-live original session makes
  would already re-resolve the demoted role fresh, exactly as G-002
  requires. The forced re-authentication this ADR accepts is a
  *client-side* artifact of `useAuth.ts` discarding the admin's original
  token the moment impersonation started (see Alternatives Rejected,
  "Resolve to the admin's own original session") — a consequence of the
  impersonation mechanism's token handling, not of the role change failing
  to take effect. `ADR-0016`'s original decision was revised specifically
  because an earlier draft *did* invalidate a session to enforce a role
  change, contradicting G-002 as written (see `ADR-0016`'s Revision 1
  note) — this decision does not repeat that error, since it invalidates
  nothing.
- The refusal is presented to the admin identically to any other
  rejection reason (expired token, malformed token, demotion) — no
  distinct messaging is introduced by this decision. This is a plain,
  low-cost UX gap, not an authentication-boundary question; it does not
  have a tracker ID today and this ADR does not create one, since doing so
  is a documentation action for `PRD-Impersonation` to take, not an
  architectural decision.
- This decision does not touch, in either direction, the separate
  exposure that the target's impersonated session survives a *refused*
  restore attempt untouched. This is disjoint from `FC-005`'s stated
  condition (which covers only a *successful* end-impersonation), not a
  subset of it — and, by the same scoping test applied to `FC-005` above,
  it is likewise disjoint from `PRD-SessionManagement` FR-005's stated
  trigger ("when impersonation **ends**"), which a refusal does not
  satisfy. This exposure is therefore not cleanly owned by either tracker
  as currently worded. Note
  `ADR-0011`'s deferred Option C1 (session-bound redemption) does **not**
  close this exposure — C1 only *requires* the impersonated session to
  still be live in order to permit a restore; it introduces no mechanism
  that revokes anything. Actually closing this gap would need a
  revocation step of the same shape `PRD-SessionManagement` FR-005 already
  describes, extended to cover the refusal case as well as the success
  case — a scope widening for that PRD to consider, not something this
  ADR resolves.
- This decision does not touch the separate, already-known exposure that
  `ADR-0016` is Accepted but not yet implemented in source
  (`backend/src/auth/guards/admin.guard.ts:9-21` has no `impersonatedBy`
  check) — an admin who was impersonating an admin target and is then
  demoted retains a session that still passes `AdminGuard` until that
  implementation lands, independent of whatever happens to the restore
  token. Tracked by `PRD-Impersonation` `FC-006`, not duplicated here.

## Risks

- **Assumption dependency:** this decision assumes demotion during active
  impersonation is rare enough that the re-authentication cost is
  acceptable. If usage or support data later shows role changes during
  impersonation are common, or that admins are materially inconvenienced
  by this in practice, revisit Option B against that evidence.
- **Revisit trigger:** the first support-reported occurrence of an admin
  stranded by this gap — nothing today logs impersonation start/end or a
  refused restore attempt (`PRD-Impersonation` `Q-007`), so a "real-world
  occurrence" is not independently observable, only one that generates a
  support report — or `Q-007` resolving in a way that makes frequency data
  available going forward, whichever comes first. Absent either, this
  decision is not revisited on a schedule. If it is revisited, evaluate a
  properly-scoped version of Option D (see Alternatives Rejected) before
  Option B — it costs less, if a version can be specified that actually
  preserves the impersonation banner through the refusal.
- **`ADR-0011` dependency:** several supports in this ADR (the Consistency
  driver's precedent, the Simplicity driver's persistent-state caveat, and
  the inherited Option E rejection in Alternatives Rejected) rest on
  `ADR-0011` as currently drafted, which is Proposed, not Accepted, plus
  Option B's current pricing, which depends on it in a different way (see
  the next bullet). If `ADR-0011` is materially revised before acceptance,
  re-check each of these against whatever it ultimately decides.
- **Option B sequencing risk:** if Option B is ever revisited and adopted
  after `ADR-0011` is accepted as drafted, its cost is higher than priced
  in this ADR — `ADR-0011`'s adopted guard-based mechanism can only permit
  or deny a request, not branch to issue an alternate session, so Option B
  would require restructuring `end-impersonation` away from a pure guard.
  Re-price Option B against whichever of `ADR-0011`'s mechanics has
  actually landed at that time, not against this ADR's current-source
  pricing.

## Alternatives Rejected

- **This ADR's Option D** (suppress the logout-and-redirect on this
  refusal only — not to be confused with `ADR-0011`'s own Option D
  or `ADR-0016`'s Option D, both unrelated decisions on the same
  identifier): not rejected — **deferred**, on the same footing as
  `ADR-0011`'s "Alternatives Rejected and Deferred" entries. As specified,
  it does not achieve its intended benefit (`backToAdminToken` is
  discarded one line before the branch it suppresses, so the
  impersonation banner disappears regardless — see Option D's
  Disadvantages). A differently-scoped version that also preserves the
  banner has not been fully evaluated here; the obvious way to preserve
  it — retaining `back_to_admin` past that removal — is already ruled out,
  since it reintroduces the abandoned drafting idea's stale-credential
  defect, so a viable version would need a banner mechanism that doesn't
  depend on the token itself. Revisit ahead of Option B if this gap is
  ever reopened — see Risks.
- **Option B** (grace/override to the demoted admin's own account): grants
  no admin authority, so not rejected on the same grounds as Option C —
  but not adopted either, on an unanalyzed security cost (this
  unauthenticated endpoint's stolen restore token, worthless today when it
  belongs to a demoted admin specifically, becomes a working
  account-takeover credential for that same admin under this option)
  combined with the absence of any usage/evidence case for taking on that
  cost. Revisit per the Risks trigger above, and only after that security
  cost has been analyzed on its own terms.
- **Option C** (accept a stale role snapshot at redemption): rejected
  outright — reopens a demote-survives gap on this feature's restore path.
- **"Resolve to the admin's own original (pre-impersonation) session"**
  (the literal proposal in `PRD-AdminRoleGuards` `Q-007` part 2): the
  admin's own `user_sessions` row is in fact never touched by
  `impersonate()` and typically remains live throughout impersonation
  (`ADR-0011`'s Context — independent revocation, e.g. a password reset
  from another device, remains possible); the obstacle is that the
  admin's original JWT
  for that session is discarded client-side the moment impersonation
  starts (`useAuth.ts` overwrites the `token` key), so nothing server-side
  can hand it back without the client having retained it. Retaining the
  admin's own live token in browser storage for the full duration of
  impersonation is exactly `ADR-0011`'s **Option E**, already evaluated
  and rejected there on Threat Model grounds ("a materially worse outcome
  under the same client-side compromise vector \[ADR-0011\] treats as
  dominant"). This ADR inherits that rejection rather than re-evaluating
  it; Option B is the nearest available substitute that avoids Option E's
  standing-exposure cost, at the price of not literally being the admin's
  original session.
- **Retain `backToAdminToken` on `FC-004` refusal only (frontend-only
  fix):** see "Considered and abandoned during drafting" above — does not
  work as a low-cost alternative; collapses into Option B's shape if made
  to actually function.

## Follow-ups this decision requires

This ADR does not edit either PRD it cites directly, but its acceptance
makes documentation actions necessary in both — listed together, each
with a named owner, so they are not left as scattered asides for a future
reader to re-discover independently:

**Owner: `PRD-Impersonation` (`docs/features/impersonation/PRD.md`)**

1. **Correct `FC-008`'s text.** Its Expected behavior currently asserts a
   retry mitigation this ADR's Context disproves (the restore token is
   removed from `localStorage` on any outcome, so no re-promotion-then-retry
   path is actually reachable). Remove or correct that sentence.
2. **Close `Q-001b`/`FC-008` as decided**, citing this ADR, rather than
   leaving them recorded as open.
3. **Add `G-001`'s stated qualifier** — the goal holds only while the
   admin retains the admin role through the point they attempt to end
   impersonation (see Consequences → Negative).
4. **Give the undifferentiated-refusal-messaging gap a tracker ID**
   (see Consequences → Negative) — currently recorded there as a
   documentation action for this PRD to take, but not yet assigned one.

**Owner: `PRD-AdminRoleGuards` (`docs/features/admin-role-guards/PRD.md`)**

5. **Close `Q-007` part 2 / `FC-006` consequence (2) (the stranded
   `back_to_admin` token) as decided**, citing this ADR — per-consequence
   only. `FC-006`'s Expected behavior ("Not currently defined by the
   product") and `Q-007`'s three parts currently read as a single
   undifferentiated block; this edit closes part 2/consequence (2) alone.
   Consequence (1) (the target's session outliving the admin's demotion,
   `Q-007` part 1) remains undefined — see this ADR's Context — and should
   not be closed as a side effect of this edit.

**Owner: `architecture-librarian` (cross-document consistency, not a
reasoning question)**

6. **Update `ADR-0016`'s Risks section**, which currently states this gap
   "remains unowned … no ADR currently claims it" — that becomes stale
   once this ADR is Accepted, and its Related-ADRs-equivalent framing
   should point at `ADR-0021`.

## Related ADRs

- Related: `ADR-0011` (end-impersonation authentication boundary,
  Proposed) — governs redemption mechanics for the same endpoint
  (`FC-003`/`FC-004`'s rejection cases, per `PRD-Impersonation`'s
  Integration Requirements table); this ADR governs the distinct
  post-refusal question for `FC-004`'s already-correct role-check outcome.
  Neither reopens the other. This ADR's rejection of the
  "own-original-session" alternative inherits `ADR-0011`'s Option E
  rejection rather than re-arguing it.
- Related: `ADR-0016` (deny admin authority to impersonated sessions,
  Accepted) — this ADR does not alter, and is not altered by, that
  decision. This ADR also resolves `ADR-0016`'s own Risks-section
  reference to `PRD-AdminRoleGuards` `Q-007` part 2/`FC-006`'s
  stranded-token consequence specifically — see Decision.

## References

- `docs/features/impersonation/PRD.md` — FC-004, FC-005, FC-006, FC-008,
  FC-009, Q-001a, Q-001b, Q-010, G-001, BR-002
- `docs/features/admin-role-guards/PRD.md` — Q-007, FC-006, FR-002, G-002
- `docs/features/session-management/PRD.md` — FR-005
- `docs/features/logout/PRD.md` — Q-006
- `docs/features/impersonation/DISCOVERY.md` — Candidate ADR entry for
  Q-001b
- `docs/architecture/adr/0011-end-impersonation-authentication-boundary.md`
  (Proposed) — redemption mechanics of the same endpoint; Option E
  (rejected); Option B's fallback-to-password consequence
- `docs/architecture/adr/0016-deny-admin-authority-to-impersonated-sessions.md`
  (Accepted) — Risks section naming this gap unowned
- `docs/features/admin-role-guards/DISCOVERY.md` — Candidate ADR 1,
  originally scoping this gap into `ADR-0016` before it was scoped out
- `backend/src/auth/auth.service.ts:440-455` — `issueTokenAndSession()`
- `backend/src/auth/auth.service.ts:497-518` — `endImpersonation()`
- `backend/src/auth/guards/admin.guard.ts:9-21` — `AdminGuard`
- `frontend/lib/useAuth.ts:97-125` — `returnToAdmin()`
- `frontend/lib/useAuth.ts` — `refreshUser()`'s early-return (no `token`)
  and error-handling branches (the latter clears `token` and
  `back_to_admin` together on any `/users/me` failure; the former does
  not)
- `frontend/components/ImpersonationBanner.tsx:6-8` — sole caller of
  `returnToAdmin()`, unmounts when `impersonating` is cleared
