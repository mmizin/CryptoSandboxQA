# ADR-0019: `POST /auth/admin/register` continues issuing a live session in the same call

## Status

Accepted

**Revision note:** 2026-07-28 — this ADR went through five review rounds.
The first two (Full Reviews) found 16 then 7 defects in the reasoning,
all fixed. The third and fourth (Delta Reviews) found progressively
smaller follow-on inconsistencies, and the fourth additionally flagged
that incremental patching had left the Decision section hard to read
despite each individual claim being accurate — a durability defect in its
own right. Rather than patch further, the Decision, Consequences, Risks,
Alternatives Rejected, and supporting sections were rewritten as a single
consolidated pass. A fifth Full Review on that rewrite found the evidence
base sound but two remaining substantive issues: the Sibling-route-
precedent driver was conceded to favor the rejected option on a
classification that did not survive inspection (the sibling routes
withhold a session for a structurally different reason — a third party's
account, an already-authenticated caller — that does not apply here, and
`AuthService.impersonate()` is this codebase's actual precedent for a
route in this one's position); and the stated cost of the rejected option
did not account for `ADR-0008` (Accepted), which already requires most of
the same Swagger/`openapi.json` change on this route. Both were corrected
directly, without a further review round, given the accumulated review
cost; the Decision's primary rationale was also reframed around
reversibility under current usage uncertainty rather than resting on the
cost comparison alone. Required PRD follow-through (below) has been
carried out in `PRD-AdminUserCreation`. Status moves to Accepted.

## Date

2026-07-28

## Context

`AuthService.createAdmin()` (`backend/src/auth/auth.service.ts:226-243`)
creates a `role='admin'` account and, on its last line, calls
`issueTokenAndSession(user)` — a private method shared by six call sites
in total: `login()`, `verify2Fa()`, `register()`, `createAdmin()`,
`registerWithProfile()`, and `endImpersonation()`
(`auth.service.ts:105,212,223,242,287,517`; `auth.service.ts:440-455`,
enumerated at `ADR-0010:45-48`). That method signs a JWT (`{sub, email}`
payload, no distinguishing claim for this route), creates a
7-day-expiring, DB-backed `user_sessions` row via
`sessionsService.createSession()`, and returns the token to the caller.
`POST /auth/admin/register` therefore returns a fully authenticated admin
session in the same response that creates the account — no separate login
call, no password re-entry, no 2FA challenge.

No ADR, code comment, or Swagger annotation states whether this is
deliberate for this specific route. The controller's own annotation
(`@ApiJsonExample(201, 'Returns admin user and access token', ...)`,
`auth.controller.ts:115`) documents the response shape, not
intent — it is equally consistent with a deliberate design and with
`createAdmin()` simply reusing `issueTokenAndSession()` because
`register()` does. What *is* an author's deliberate statement, by
contrast, sits on the sibling `admin/create-user` route: its annotation
explicitly says "Does not create a session for the new user"
(`auth.controller.ts:128`). No such statement exists for `admin/register`,
and its absence does not by itself establish intent either way — that is
exactly what makes this a candidate ADR rather than a documentation gap:
the code's behavior is observed and unambiguous; the intent behind it is
not.

`PRD-AdminUserCreation` Q-002 asks this question directly: "Is minting a
live admin session (with no password login and no 2FA step) for a
just-created account the intended product design, or an artifact of
`createAdmin()` reusing `issueTokenAndSession()` from `register()`/`login()`
without a design decision being made for this specific path?" This ADR is
this codebase's answer: going forward, session issuance here is a
deliberate, decided design, regardless of what it originally was.

**Scope note, following `ADR-0018` (Accepted, not yet implemented):** that
ADR decided `POST /auth/admin/register` should be restricted to the
window before any admin account exists — it did not decide this question.
As of this writing `createAdmin()` performs no admin-count check
(`auth.service.ts:226-243`; confirmed absent repo-wide), so the route is
in fact reachable at any admin count today; this ADR reasons about the
target state `ADR-0018` describes, not the current one, and that gap is
carried through this ADR's Risks and Open Questions below rather than
assumed away. This ADR concerns session-issuance behavior *within* `ADR-0018`'s
window once implemented, not whether the route should exist or when it is
reachable — the two decisions compose: `ADR-0018` answers "when can this
route be called," this one answers "what happens in the response when it
is."

**What this decision does not change, regardless of outcome:** because
`createAdmin()` rejects a duplicate email (`auth.service.ts:231-234`),
this route can never be pointed at an *existing* account — it only ever
issues a session for the account it just created in the same call. So
whatever this ADR decides, it cannot grant a login-free or 2FA-free
session for an account that already has 2FA enrolled; that account has
nothing enrolled yet. `PRD-AdminUserCreation` BR-001 narrows the practical
significance of this bound further: an account created here has authority
"indistinguishable, for authorization purposes," from any other admin
account, since `AdminGuard` checks only the current `role` value
(`admin.guard.ts:16`), not how it was set. A caller who wants admin
authority without navigating an existing admin's login/2FA does not need
this route's session-issuance behavior to get it — creating the account
at all already grants that authority; session issuance only removes one
extra `POST /auth/login` call. **The decision below is therefore about
whether that one extra call should be required, not about a 2FA/login
bypass** — every option and risk statement that follows should be read
against that one-request scale, not a larger one.

Out of scope for this ADR:
- Whether `POST /auth/admin/register` should be restricted to the
  zero-admin window — decided by `ADR-0018` (Accepted, not yet
  implemented); this ADR does not revisit it.
- Whether this route should be rate-limited — `ADR-0013` (Accepted, not
  yet implemented) already decides a global default covering this route;
  a tighter per-route limit remains a separate open question, not this
  ADR's to decide.
- Auditing/logging account creation via this route (`PRD-AdminUserCreation`
  Q-006) — no existing ADR decides this; out of scope here.
- The non-atomic duplicate-email race and 401-status ambiguity
  (`FINDINGS.md` IF-001, owned by `ADR-0008`, Accepted) and the
  non-constant-time key comparison (`FINDINGS.md` IF-003) —
  implementation defects, not decisions this ADR resolves. `ADR-0008`'s
  own scope does bear on Option B's cost — see Decision Drivers.
- A caller-controlled opt-out of session issuance (e.g. an optional
  `CreateAdminDto` field, or a second no-session route) — see Alternatives
  Rejected; not adopted here.

## Decision Drivers

- **Implementation cost asymmetry.** Option A costs nothing to implement.
  Option B's marginal cost is smaller than a bare Swagger/`openapi.json`
  change would suggest: `ADR-0008` (Accepted) already requires a `409`
  Swagger decorator added at `auth.controller.ts:116` and an
  `openapi.json` regeneration for this same route (`FINDINGS.md` IF-001,
  not yet implemented) — the regeneration Option B needs is already
  required work, and ADR-0008's own Consequences already accept "a
  visible, if directionally-correct, breaking change to document" on this
  endpoint, with no `frontend/` code found to depend on the response body
  (`ADR-0008:494-497`). Option B's cost beyond that baseline is
  repointing one shared example constant (`OA.auth.adminAccessToken`,
  also used by `end-impersonation`'s `200` response,
  `auth.controller.ts:115,229`) to a variant without `access_token`. This
  is real but small, not the open-ended "contract break" it might first
  appear to be.
- **Sibling-route precedent — does not transfer.** `admin/create-user`'s
  annotation states "Does not create a session for the new user," but the
  analogy to `admin/register` does not hold on inspection.
  `createUserWithProfileAsAdmin()` (behind `admin/create-user`,
  `auth.service.ts:293-340`) never sets `role` (confirmed absent;
  `ADR-0018:170-173`), so that route creates a *third-party, non-admin*
  account on behalf of someone else, for a caller who is already
  authenticated via `JwtAuthGuard`/`SessionGuard`/`AdminGuard`
  (`auth.controller.ts:122`) — withholding a session for an account that
  is not the caller's own is the obviously correct choice there, not
  evidence about what this route should do. `admin/register` creates the
  *caller's own* account, and the caller holds no prior session by
  construction (`AdminApiKeyGuard` only, `auth.controller.ts:107`). The
  codebase's actual precedent for an operator-initiated route minting its
  own session in the same call is `AuthService.impersonate()`
  (`auth.service.ts:457-482`), which this ADR's Option C already cites —
  so "operator-initiated implies no session" does not describe this
  codebase. This driver is neutral, not a point in Option B's favor.
- **Unused-session accumulation.** Every call mints a 7-day session
  whether or not the caller uses the returned token. `ADR-0010` (Accepted,
  implemented) confirms these are ordinary DB-backed `user_sessions` rows,
  deletable via `SessionsService.deleteSessionByToken()` — but only by a
  caller who retains and presents the token; the only other deletion
  path, `deleteAllUserSessions()`, is reached solely from password reset
  (`auth.service.ts:179`). An operator who discards the token reaches
  neither; the session simply expires after 7 days. `ADR-0010` itself
  records unbounded `user_sessions` table growth and no expired-row
  cleanup as an open, unresolved fact tracked against its own unowned PRD
  questions, not something its Accepted status has settled as permanent
  (`ADR-0010:5-16`). How often this actually happens is unknown: no
  in-repo automation calls this route (`ADR-0018:163-165,338-341`), but
  that bounds automation, not operator behavior — it does not establish
  that accumulation is rare.
- **Blast radius of a leaked, shared, or inferred `ADMIN_API_KEY`.** Per
  `PRD-AdminUserCreation` A-002 (unenforced trust assumption) and
  `FINDINGS.md` IF-002/IF-003 (no rate limiting; non-constant-time key
  comparison, Medium confidence), whether a successful unauthorized call
  yielding an immediately usable session — rather than only an account
  requiring a separate, itself-unrate-limited login — meaningfully
  changes an attacker's cost. As established in Context, it does not
  change *what* is exposed (full admin authority either way), only
  whether one extra request stands between the attacker and using it.
- **Session provenance and future auditability.** The token payload is
  `{sub, email}` only, with no claim distinguishing a bootstrap-issued
  session from an ordinary login session (`DISCOVERY.md`, Candidate
  ADR-1). Keeping sessions unmarked forecloses ever scoping, expiring, or
  auditing bootstrap sessions differently from ordinary ones without a
  retroactive change, since no marker exists on sessions already issued.

## Assumptions

- No operator workflow is currently known to depend on the returned
  session token specifically (as opposed to depending on the account
  having been created) — `ADR-0018` found no in-repo automation calling
  this route, and no documented runbook. This bounds automation, not
  operator behavior: the caller is a human operator with an environment
  secret, which an in-repo search has little power to observe either way.
  Call frequency and how often the token goes unused are therefore
  unknown in both directions — this cuts against Option A's accumulation
  cost and against Option B's contract-break cost equally (see Decision
  Drivers). If a workflow does rely on the token, that is new evidence
  not reflected here.
- No admin-facing "revoke this session" surface exists beyond
  `deleteSessionByToken()` (token-gated) and `deleteAllUserSessions()`
  (password-reset-gated) via the HTTP API. An operator holding
  `ADMIN_API_KEY` could still delete the `user_sessions` row directly via
  this project's documented DB-access workflows (`npm run prisma:studio`;
  `docker exec crypto-postgres psql`, per `CLAUDE.md` and `ADR-0018`), so
  the accumulation cost below is bounded by that higher-friction fallback
  as well as by the 7-day expiry, not solely by the expiry. If
  `PRD-SessionManagement` adds an HTTP-level surface, re-check this ADR's
  framing against it.

## Considered Options

### Option A — Keep issuing a session (no change to current behavior)

`createAdmin()` continues calling `issueTokenAndSession()` exactly as
`register()`/`login()` do.

- **Advantages:** Zero implementation cost. One fewer request
  (`POST /auth/login`) for a caller who wants to use the account
  immediately.
- **Disadvantages:** Every call mints a session whether or not the caller
  uses it, with no caller-side opt-out and no admin-facing revocation
  without the token. No distinguishing marker exists, foreclosing a
  retroactive scoping/expiry/audit distinction later.
- **Risks:** If `PRD-AdminUserCreation` A-002 (key held only by trusted
  operators) is false in some deployment, a successful unauthorized call
  yields an immediately usable session with no login step to fail at —
  though the same caller could reach the same authority by logging in
  with the password they just set, so the marginal exposure over Option B
  is one HTTP request, not a qualitative difference in what is exposed.

### Option B — Create the account only; require a separate login

`createAdmin()` stops calling `issueTokenAndSession()` and returns only
the created account (matching the sibling `admin/create-user` route's
stated behavior).

- **Advantages:** Matches the sibling route's explicit, stated design —
  makes this route's behavior a deliberate, documented parallel on the
  operator-initiated side of the codebase, rather than an unstated
  divergence. Removes Option A's accumulation cost entirely: no session
  exists until the operator logs in and wants one.
- **Disadvantages:** Adds one request (`POST /auth/login`, using the
  password just supplied) for an operator who wants to use the account
  immediately — not a login as any other admin, since none is required to
  exist. `/auth/login` is itself unrate-limited today (`ADR-0013`
  Accepted, not yet implemented; `FINDINGS.md` IF-002), so this does not
  reduce a leaked key's attacker-facing cost by much. Changes the
  documented `201` response shape, requiring a Swagger update and
  `openapi.json` regeneration — a one-time, mechanically small change (one
  call site, one shared annotation also used by `end-impersonation`) with
  no identified consumer, but a real cost against Option A's zero.
- **Risks:** None beyond the implementation change itself.

### Option C — Issue a session, but scope or distinguish it at issuance

Two distinct variants, both via a separate call site (not the shared
`issueTokenAndSession()` helper), following the pattern
`AuthService.impersonate()` already uses for its own `impersonatedBy`
claim (`auth.service.ts:457-482`; claim set at `:474`, propagated at
`jwt.strategy.ts:27-29`):

- **(c1) Authority-scoping** — the session carries a `bootstrap`-style
  claim `AdminGuard` checks to deny admin authority, the shape
  `DISCOVERY.md`'s Candidate ADR-1 option (c) describes and `ADR-0016`
  (Accepted, **not yet implemented** — `AdminGuard`, `admin.guard.ts:16`,
  still checks only `user.role`) already decided for impersonated
  sessions.
- **(c2) Marking/shorter lifetime** — the session carries a marker and/or
  a shorter expiry, with no authority change.

- **Advantages:** Available from issuance, with no retroactive gap. (c1)
  would directly close the session-provenance driver. (c2) preserves
  Option A's one-call convenience while bounding how long an unused
  session stays valid.
- **Disadvantages:** (c1) is largely self-defeating for this route: a
  bootstrap session whose authority `AdminGuard` denied could not perform
  the bootstrap actions the route exists for, and the guard-side check it
  would need does not exist yet regardless. (c2) requires a new call
  site — a materially larger change than Options A or B — for a benefit
  (session provenance) no current product requirement mandates
  addressing now; it is not what `PRD-AdminUserCreation` Q-009 asks
  (Q-009's open half is scoped to a credential policy or expiry on the
  **account**, per `PRD.md` Non Goals, not the session), and not what
  Q-002 asks either, since Q-002 is answered by this Decision regardless
  of which option is chosen — the concern (c2) would address is
  `DISCOVERY.md`'s foreclosure concern specifically.
- **Risks:** A new session variant is the kind of change most likely to
  interact with future authentication work (e.g. step-up auth extended to
  this route) in ways not analyzed here.

## Decision

**Option A — keep issuing a session in the same call.**

As Context establishes, the real cost of Option B is not "no admin
session to fall back on" (none is available either way, by construction,
at zero admins) — it is one additional `POST /auth/login` request, using
the password just supplied.

**Option A is adopted primarily because it is the fully reversible choice
under current uncertainty, at zero cost today.** Whether any operator
workflow consumes the returned token cannot be settled from this
repository (Assumptions; Open Questions), and that uncertainty can only
be resolved by observing actual usage while Option A remains in place —
switching to Option B first forecloses collecting that evidence for free.
Moving from A to B later costs the same small, mostly `ADR-0008`-already-
required change it would cost now (Implementation cost asymmetry driver);
nothing about staying on Option A accrues cost or lock-in that a later
move to B would have to undo. This matches `CLAUDE.md`'s simplicity
policy: make the smaller, reversible change now, not the one that forecloses
information for a benefit (avoiding one request) that no observed usage
currently calls for.

The Sibling-route-precedent driver is neutral, not a point for either
option: the sibling routes withhold a session because they create a
*different person's* account for an *already-authenticated* caller, which
this route does not do, and `impersonate()` is this codebase's actual
precedent for an operator-initiated route minting its own session in the
same call. This driver does not need to be outweighed, because it does
not favor Option B on inspection.

Option A's own downside — an unused session accumulating, with no
admin-facing HTTP revocation without the token — is real and only
partially mitigated: bounded by the 7-day expiry and by the DB-access
fallback described in Assumptions, but of unknown frequency, since no
in-repo automation calling this route bounds operator behavior, not just
automation.

Neither Option C variant is adopted. (c1) is rejected on its own merits,
independent of cost: it would be self-defeating for this route and
additionally needs `ADR-0016`'s unbuilt guard change. (c2) is deferred,
not rejected on the merits: it targets a genuine concern
(`DISCOVERY.md`'s foreclosure concern) via a bounded, known implementation
path (`impersonate()`'s non-shared-call-site precedent), but no product
requirement currently forces resolving that concern now, and it is a
broader surface than this ADR's narrow question warrants deciding
unilaterally. Revisiting (c2) specifically is the natural next step if
session provenance becomes a live requirement, or if the accumulation
downside above turns out to matter in practice (see Open Questions); (c1)
would additionally need `ADR-0016` built first, whenever it is revisited.

A caller-controlled opt-out (an optional `CreateAdminDto` field, or a
second no-session route) was not adopted: it is more implementation than
either Option A or B (a new field plus branching logic, versus nothing or
one deleted call), so it loses on the same Implementation cost asymmetry
driver that decided between A and B, and `CLAUDE.md`'s "no flexibility
that wasn't requested" policy weighs against building it speculatively.

This decision does not change what authority a successful call grants (see
Context) — only whether one extra request is required to use it.

## Consequences

### Positive

- No implementation cost.
- A caller who wants to use the account immediately avoids one additional
  `POST /auth/login` request.

### Negative

- Every call mints a session whether or not the caller uses it, with no
  caller-side opt-out and no admin-facing HTTP revocation without the
  token — bounded by the 7-day expiry and the DB-access fallback, not
  eliminated.
- A leaked, shared, or inferred `ADMIN_API_KEY` yields an immediately
  usable session without a login step to fail at, though the marginal
  cost over Option B is one HTTP request, not a qualitative difference in
  what is exposed.
- No distinguishing marker exists on sessions issued under this Decision —
  a future move to (c2) cannot retroactively scope, expire, or audit them
  differently from ordinary ones.

## Risks

- **Assumption risk:** if `PRD-AdminUserCreation` A-002 is false in some
  deployment, this Decision means a successful unauthorized call yields a
  session without a login step to fail at — a real, if one-HTTP-request-
  bounded, escalation.
- **Dependency risk:** this Decision reasons about the route once
  `ADR-0018`'s zero-admin restriction is implemented. Until then, the
  route (and this Decision's exposure) is reachable at any admin count,
  not only the bootstrap scenario described above.
- **No schema-migration risk:** this Decision changes no schema and
  preserves the current response shape. Moving to Option B or (c2) later
  does not require migrating past sessions — those already issued
  continue to exist, unmarked, until their 7-day expiry.

## Alternatives Rejected

- **Option B** — rejected: it would eliminate Option A's accumulation
  downside entirely, a real benefit, but forecloses collecting usage
  evidence for free and can be adopted later at the same small cost it
  would cost now, so nothing is gained by choosing it under today's
  uncertainty rather than revisiting it once usage evidence exists. The
  Sibling-route-precedent driver does not support choosing it either: on
  inspection the sibling routes withhold a session for a structurally
  different reason (a third party's account, an already-authenticated
  caller) that doesn't apply here, and `impersonate()` is this codebase's
  actual precedent for a route in this route's position.
- **Option C, (c1) authority-scoping** — rejected on the merits:
  self-defeating for the route it would apply to, and additionally
  depends on `ADR-0016`'s unimplemented guard check.
- **Option C, (c2) marking/shorter-lifetime** — deferred, not rejected on
  the merits: targets a real, still-open concern via a bounded
  implementation path, but no requirement currently forces resolving it
  as part of this narrow ADR.
- **Caller-controlled opt-out** — not adopted: more implementation than
  either A or B (a new field plus branching logic), and speculative
  flexibility against no current request for it, per `CLAUDE.md`.

## Open Questions

- **Does any operator workflow actually consume the returned token?**
  Neither this ADR nor `ADR-0018` can settle this from the repository.
  This is the primary revisit trigger: if usage evidence emerges, redo
  the Implementation-cost-asymmetry and Unused-session-accumulation
  weighing against it, not the current unknown.
- **Is an admin-facing HTTP session-revocation surface planned under
  `PRD-SessionManagement`?** If so, Option A's accumulation downside
  narrows further beyond the DB-access fallback already assumed here.
- **Once `ADR-0013` is implemented**, its global rate-limit default
  covers both `/auth/login` and this route itself — narrowing Option B's
  disadvantage and Option A's blast-radius driver together, not
  necessarily shifting the balance. Redo the weighing against the
  implemented state, not in advance.
- **Once `ADR-0018` is implemented**, re-confirm this Decision's framing
  of the route as reachable only in the zero-admin bootstrap scenario —
  today that framing describes the target state, not the current one.

## Required PRD follow-through — complete

`PRD-AdminUserCreation` Q-002 was the question this ADR resolves; the PRD
was contingent on it at FR-001's Description/first acceptance criterion,
at G-001, and in Current Behavior/Non Goals. `PRD.md` has been updated to
record the session-issuance behavior as a deliberate, decided design **as
of this ADR** — not a claim about `createAdmin()`'s original historical
intent, which Context states cannot be established either way — and
Q-002's status moved from open to answered-by-decision.

## Related ADRs

- Related: `ADR-0018` (Accepted, not yet implemented — restricts this
  route to the zero-admin window once built; this ADR decides
  session-issuance behavior within that window and does not revisit when
  the route is reachable)
- Related: `ADR-0010` (session revocation via DB-backed session records —
  enumerates all six `issueTokenAndSession()` call sites, including
  `createAdmin`; this ADR's Decision relies on that mechanism only to the
  extent it actually reaches this scenario, per Context and Assumptions)
- Related: `ADR-0013` (Accepted, not yet implemented — rate limiting; this
  route's and `/auth/login`'s exposure both remain unmitigated until it
  is)
- Related: `ADR-0008` (Accepted, not yet implemented on this route —
  requires a `409` Swagger decorator at `auth.controller.ts:116` and an
  `openapi.json` regeneration for this route's duplicate-email handling,
  already accepting a documented breaking response change here; Option
  B's marginal cost in this ADR's Decision is priced against that
  already-required baseline, not from zero)
- Related: `ADR-0016` (Accepted, not yet implemented — decides guards
  should deny admin authority on an issuance-time `impersonatedBy` claim;
  the claim-issuance mechanism itself already works in-repo via
  `impersonate()`'s non-shared call site, the precedent Option C's (c2)
  variant would follow at no further dependency; only (c1) additionally
  needs the guard-side check, which does not exist yet)

## References

- `docs/features/admin-user-creation/PRD.md` (Q-002, BR-001, FR-001, G-001,
  Q-009, Non Goals, Current Behavior, A-002)
- `docs/features/admin-user-creation/DISCOVERY.md` (Candidate ADR-1)
- `docs/features/admin-user-creation/FINDINGS.md` (IF-001, IF-002, IF-003)
- `docs/architecture/adr/0008-duplicate-email-registration-race-handling.md`
- `docs/architecture/adr/0010-session-revocation-via-db-backed-session-records.md`
- `docs/architecture/adr/0013-rate-limiting-for-unauthenticated-auth-endpoints.md`
- `docs/architecture/adr/0016-deny-admin-authority-to-impersonated-sessions.md`
- `docs/architecture/adr/0018-admin-bootstrap-route-restricted-to-zero-admin-window.md`
