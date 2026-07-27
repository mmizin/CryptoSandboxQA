# Gate access on a server-side session record, not on JWT validity alone

**Status:** Accepted

**Provenance note:** this ADR backfills rationale for a mechanism already
built and in production use — it is Accepted in the sense that the
*mechanism* is not being proposed for future adoption, not in the sense
that a review confirmed its unresolved consequences are acceptable. The
negatives recorded under Consequences and Risks (unindexed lookup,
unbounded table growth, undefined fail-open/fail-closed behavior,
incomplete revocation on ending impersonation) are stated as open,
unresolved facts about the current system — carrying an "Accepted" status
on this ADR does not mean those specific items have been accepted as
permanent; they remain tracked against their own PRD Open Question IDs
(FC-002/Q-004, FC-003/Q-002/Q-005/Q-007, FR-005), each still unowned as of
this writing.

**Date:** 2026-07-27

## Context

Every authenticated request in the backend passes two checks in sequence:
`JwtAuthGuard` (Passport JWT strategy — verifies the bearer token's
signature and its own `expiresIn` claim) and `SessionGuard` (queries
`user_sessions` for a row matching the token's SHA-256 hash with an
unexpired `expiresAt`). Both must pass; `SessionGuard` performs its own
database `findFirst` on every protected request, independent of whether the
JWT itself is still valid (`backend/src/auth/session.guard.ts`).

This means the system already made a specific tradeoff: it accepted a
**second** per-request database query on the authentication path in
exchange for being able to revoke access before a token's signed expiry.
`JwtAuthGuard`'s own Passport strategy already performs one such query on
every authenticated request, independent of `SessionGuard` —
`JwtStrategy.validate()` calls `UsersService.findById(payload.sub)`
(`backend/src/auth/jwt.strategy.ts:21-22`), a `prisma.user.findUnique()`,
to resolve the request's user object. `SessionGuard` therefore does not
introduce the *first* database dependency on the authentication path; it
adds a second, unindexed one on top of an already-present, indexed one
(primary key lookup). This ADR states the tradeoff on that basis, not on
the assumption that the alternative would have zero database cost.

A JWT alone cannot be "un-issued" — anyone holding a validly-signed token
can use it until it expires, with no way for the server to intervene.
Seven flows create the session-backing record: `AuthService
.issueTokenAndSession()` (`login`, `verify2Fa`, `register`, `createAdmin`,
`registerWithProfile`, `endImpersonation` — six callers) and
`AuthService.impersonate()` (a seventh, separate call site) and two
operations delete it early (`POST /auth/logout`,
`resetPasswordWithCode()`).

This decision was never recorded. No ADR among the current set
(`docs/architecture/adr/0008`, `0009`) or the legacy set
(`docs/architecture/history/legacy-adr/0001`–`0007`) addresses session
revocation or the stateless-vs-stateful authentication tradeoff. The
mechanism is fully built and has been in use; this ADR documents the
decision implicitly made when it was built, rather than proposing a new
one — consistent with how this project backfills rationale for
undocumented existing decisions (see `docs/features/session-management/PRD.md`
BR-001, and the discovery that surfaced this gap,
`docs/features/session-management/DISCOVERY.md`, Candidate ADR 1).

The tradeoff has a cost that is currently unmanaged: `user_sessions.tokenHash`
carries no database index (`backend/prisma/schema.prisma:78-90` — contrast
`UserPasswordReset.userId`, which is indexed at `:102`), and no process
exists to remove expired rows (`SessionGuard`'s `expiresAt` check is a
read-time filter, not a deletion trigger). The table can only grow. This is
recorded here as a known consequence of the chosen model, not resolved by
this ADR (see Consequences, Negative, and PRD FC-003/Q-002/Q-005/Q-007).

## Decision Drivers

- **Revocability** — the product needs a way to invalidate an issued
  token before its signed expiry: on logout, on password change, and
  (intendedly, though not yet fully implemented — see PRD FR-005) when
  impersonation ends. A purely stateless JWT cannot provide this.
- **Simplicity of the mechanism itself** — the chosen approach (a row per
  session, checked by a guard) requires no additional service, token
  format, or cryptographic scheme beyond what the stack (NestJS, Prisma,
  Postgres) already provides.
- **Marginal performance cost paid on every request** — whatever is chosen
  here is paid on the hot path of every authenticated endpoint, on top of
  the indexed user lookup `JwtAuthGuard` already performs. This is the
  central tension in the decision, but it is a tension over a *second*
  query, not the *only* one — see Context.
- **Existing architecture** — the system already has a request-scoped
  Postgres connection via Prisma on every request; adding one lookup to an
  already-present dependency is a smaller architectural change than
  introducing a new component (e.g. a cache layer or a separate token
  service).
- **Purpose-token discrimination** — this codebase signs three token
  "kinds" (ordinary access tokens, the 2FA temporary token, and
  `backToAdminToken`) with one shared secret and no `audience`/`purpose`
  claim enforced by `JwtStrategy.validate()`. `SessionGuard` is therefore
  not only the revocation mechanism — it is, today, the *only* check that
  rejects a temporary or restore token presented as if it were an ordinary
  access token, since `JwtAuthGuard` alone would accept any of them. See
  Consequences.

## Assumptions

- Request volume in this sandbox is low enough that an unindexed,
  per-request `findFirst` is not observed as a production-grade
  bottleneck today. This ADR does not assume it would remain acceptable at
  materially higher scale — that question is carried forward as a
  consequence, not assumed away (see PRD FC-003).
- No requirement exists today for authentication to survive a Postgres
  outage independent of the rest of the application — the application
  already depends on Postgres for essentially every other request, so
  adding a dependency on it for auth does not introduce a new single point
  of failure relative to the rest of the system.

## Considered Options

### Option A — Stateless JWT only (no server-side session record)

- **Advantages:** No *second* per-request database lookup — removes
  `SessionGuard`'s query, leaving only the user lookup `JwtAuthGuard`
  already performs. Simplest mechanism relative to the current one:
  removes a whole component (`SessionsService`, `SessionGuard`,
  `user_sessions`) rather than adding one.
- **Disadvantages:** No revocation is possible before a token's signed
  expiry. Logout, password-change invalidation, and ending impersonation
  cleanly would all be unachievable — a "logged out" token remains fully
  valid until it expires on its own. Also removes the only current check
  that discriminates an ordinary access token from a 2FA temp token or
  `backToAdminToken` (see Decision Drivers) — those would need a
  replacement check (e.g. `purpose`/`audience` validation in
  `JwtStrategy`) to avoid becoming directly usable as access tokens.
- **Risks:** A leaked or stolen token remains usable for its entire
  lifetime with no way to cut it off — a significant exposure window
  for a training sandbox that also runs an admin-impersonation feature.

### Option B — Short JWT expiry + refresh tokens

- **Advantages:** Bounds the exposure window of a stolen access token to
  the short-lived token's lifetime (typically minutes); only the
  (infrequent) refresh call needs to consult persistent state beyond the
  user lookup `JwtAuthGuard` already performs, so the *steady-state*
  per-request cost is lower than Option D's (no *second* query on most
  requests, versus one extra query on every request).
- **Disadvantages:** Requires a second token type, a refresh endpoint, and
  a client-side refresh flow (silent renewal or interactive re-auth on
  expiry) — meaningfully more moving parts than the current mechanism.
  Still does not provide *immediate* revocation: a stolen short-lived
  access token remains valid until it expires, even if the corresponding
  refresh token is revoked in the same instant.
- **Risks:** Migrating the frontend to a refresh flow is a larger, harder
  to reverse change than the current single-token model; getting refresh
  token rotation and reuse-detection wrong is a known source of security
  bugs in this pattern.

### Option C — Revocation denylist (blocklist revoked tokens, rather than allowlist live sessions)

- **Advantages:** Same *second*-query dependency as the chosen option, but
  a smaller table in the common case — only revoked tokens are stored, not
  every live session. Existing valid tokens need no row at all.
- **Disadvantages:** Every protected request still needs the second
  database check (to confirm the token is *not* on the list), so it does
  not remove the marginal request-path cost this decision is weighing.
  Requires the denylist entry to carry the token's own expiry so it can
  eventually be pruned — essentially the same bookkeeping burden as the
  session-row approach, just inverted. Loses the audit/attribution surface
  a session-row model can provide (which login created it, from what
  device) — relevant to PRD Q-010's open question about whether
  `user_sessions` was also meant to serve that purpose.
- **Risks:** Same unbounded-growth risk as the chosen option unless
  actively pruned, with an added subtlety: a denylist that outlives the
  token it revoked also outlives its usefulness and must itself be
  cleaned up on the token's own expiry, not indefinitely.

### Option D — Server-side session record gates every request (the option in use)

- **Advantages:** Immediate, per-token revocation on logout, password
  change, and (once fully implemented) ending impersonation — a deleted
  row stops authenticating on the very next request, with no dependency on
  the token's own expiry, and without the all-or-nothing granularity
  Option E accepts. No new token type or client-side flow required beyond
  what already exists. Naturally extensible to future session-management
  features (viewing active sessions, revoking a specific device) without a
  mechanism change, only a UI/endpoint addition.
- **Disadvantages:** A second database round-trip is paid on every
  authenticated request, on top of the lookup `JwtAuthGuard` already
  performs, and that marginal cost currently compounds with an unindexed
  lookup column and no row-cleanup process (see Context). Requires the
  application to maintain state (the session table) that Options A and E
  would not need.
- **Risks:** Without the index/cleanup work named in Consequences, the
  per-request cost degrades as the table grows, with no ceiling.

### Option E — User-level revocation counter (`tokenVersion`)

Store a monotonically-increasing `tokenVersion` on the `users` row, embed
it as a JWT claim at issuance, and compare it against the current row
value in `JwtStrategy.validate()` — which already loads that row for every
request, so the comparison is free once the column is selected.

- **Advantages:** Immediate revocation with **no additional query** —
  reuses the lookup `JwtAuthGuard` already performs rather than adding a
  second one. Simplest mechanism that still provides revocation.
- **Disadvantages:** Granularity is per-user, not per-token: bumping
  `tokenVersion` invalidates *every* outstanding token for that account at
  once. Read as a contrast with FR-004 (all-sessions invalidation, which
  this satisfies), FR-003's "the matching record is deleted" implies
  per-token granularity, though FR-003 does not state multi-device
  semantics explicitly — PRD Non-Goals parks that question and Q-003
  leaves it formally open. Under the FR-003/FR-004 contrast as the more
  plausible reading, this scheme cannot target a single token for
  revocation. Also carries the same purpose-token-discrimination gap named
  in Decision Drivers: a `tokenVersion` comparison, like a bare signature
  check, does not distinguish an ordinary access token from a 2FA temp
  token or `backToAdminToken` presented as one.
- **Risks:** The granularity limitation above (contingent on how FR-003 is
  ultimately read); the purpose-discrimination gap, which makes this
  option's surface larger than Option D's on that axis, not smaller — a
  correction to how this was first assessed.

## Decision

**Option D** — every protected request must present a JWT with a live,
matching `user_sessions` row, in addition to a valid signature. This is
the mechanism already built and in production use; this ADR ratifies it as
the recorded decision rather than proposing an alternative be adopted.

Chosen over Option A because immediate revocability is a stated product
requirement (PRD FR-003: logout must revoke immediately; FR-004: password
change must invalidate every outstanding session), which Option A cannot
provide by construction. Chosen over Option B because it delivers
immediate revocation, which Option B does not (a stolen short-lived token
is still valid until its own expiry, however short), without the
additional client-side refresh-flow complexity Option B would require —
and no evidence exists that request volume in this sandbox currently
justifies that complexity in exchange for a smaller steady-state
performance win. Chosen over Option C because a denylist does not remove
the second-query cost this decision is weighing, while giving up the
session-row model's audit/attribution surface, without a correspondingly
large offsetting benefit. Chosen over Option E because FR-003's "the
matching record is deleted" is read here as implying per-token
(single-device) logout — an inference from the FR-003/FR-004 contrast, not
an explicit statement, and PRD Q-003 leaves multi-device semantics
formally open — but under that reading a user-level counter cannot provide
it by construction. Option E remains a materially better fit if that
requirement is ever relaxed to "log out everywhere," since it would remove
the second query entirely and also close the purpose-discrimination gap
Option D leaves open (see Decision Drivers), but it does not satisfy
FR-003 as currently read.

## Consequences

### Positive

- Logout and password-change revocation work as specified without any
  additional infrastructure (PRD FR-003, FR-004).
- The mechanism is uniform across every authenticated flow — Login, 2FA
  verification, Registration, Admin Bootstrap, Impersonation, and Ending
  Impersonation all create sessions through the same two call sites
  (`issueTokenAndSession()`, `impersonate()`), and every protected route
  is validated through the same guard.
- No new token type, client library, or refresh flow is required — the
  frontend already only needs to hold and present a single bearer token.
- `SessionGuard` currently also serves, incidentally, as the sole
  discriminator between an ordinary access token and the 2FA temp token /
  `backToAdminToken` on any route where it is applied — see Decision
  Drivers. This is a consequence of the model, not something it was
  designed for, and should not be relied on as a substitute for explicit
  purpose validation (see Negative, below).

### Negative

- **The per-request cost is currently unmanaged.** `user_sessions.tokenHash`
  has no index, and no cleanup process removes expired rows — both real,
  open questions this ADR does not resolve (PRD FC-003, Q-002, Q-005,
  Q-007). As the table grows, `SessionGuard`'s lookup cost grows with it,
  on every authenticated request in the system, not only for the accounts
  driving the growth.
- **Revocability is currently incomplete, not by this decision's design
  but by implementation gap.** Ending impersonation is specified to revoke
  the impersonated session (PRD FR-005) but does not do so today, and the
  shipped frontend does not call the logout endpoint at all (PRD FC-007) —
  both are implementation defects against the model this ADR describes,
  not evidence against the model itself, and are tracked separately
  (`docs/features/session-management/FINDINGS.md` IF-002; PRD FC-004,
  FC-005, FC-007).
- **The purpose-token discrimination described above is incidental, not
  designed.** `JwtStrategy.validate()` never inspects a `purpose`/`audience`
  claim; a 2FA temp token or `backToAdminToken` would pass `JwtAuthGuard`
  alone as a fully valid access token. `SessionGuard` blocks this today
  only because those tokens have no backing `user_sessions` row — but
  guard-pairing itself is an unenforced per-route convention (PRD C-001) —
  this is not only a hypothetical future risk: `POST
  /auth/end-impersonation` already applies neither guard today
  (`auth.controller.ts:226-232`), and is the subject of ADR-0011. This
  decision does not itself close that gap; it only happens to mask it,
  incompletely, as a side effect.
- The application already depends on Postgres for authentication on every
  request, independent of this decision — `JwtAuthGuard`'s own user
  lookup (`JwtStrategy.validate()`) means a Postgres outage already blocks
  already-authenticated users from any protected route under Option A or
  E, not only under the chosen Option D. This decision does not introduce
  that dependency or change its blast radius; it adds a second query on
  top of an outage exposure that was already there (see Decision
  Drivers). No fail-open/fail-closed behavior is currently defined for
  when either lookup fails (PRD FC-002, Q-004) — a related, separately
  unresolved question this ADR's model creates the need to answer, but
  does not itself answer.

## Risks

- **Technical — unindexed hot-path query.** Every authenticated request
  performs a `findFirst` on an unindexed column. This degrades gradually,
  not suddenly, so it is likely to go unnoticed until session-table size
  is large enough to matter — the kind of risk that is easy to defer
  indefinitely because nothing forces attention to it.
- **Technical — unbounded table growth.** No expired-row cleanup exists.
  Table size is monotonically non-decreasing over the life of a
  deployment.
- **Operational — Postgres is already a hard dependency for authenticated
  requests, and this decision adds a second query rather than a first.**
  A Postgres outage already blocks already-authenticated users under
  Option A or E (via `JwtAuthGuard`'s own lookup); this decision does not
  change that exposure. What it does add is a second failure point on the
  same path: two independent database calls must both succeed per request
  instead of one, and (per Consequences) no fail-open/fail-closed behavior
  is defined for when the second one specifically fails.
- **Future migration:** if the project ever needs authentication to
  survive a database outage (e.g. a read-only degraded mode), this
  decision would need to be revisited — the mechanism as built provides no
  such fallback.

## Alternatives Rejected

- **Option A** (stateless JWT only) — rejected: cannot provide the
  per-token revocability PRD FR-003/FR-004 require; a leaked token would
  remain valid for its full signed lifetime with no mitigation available.
- **Option B** (short expiry + refresh tokens) — rejected: still does not
  provide immediate revocation of the short-lived access token itself, and
  requires meaningfully more infrastructure (a second token type, a
  refresh endpoint, a client-side refresh flow) than the chosen option, for
  a benefit (reduced steady-state per-request database load) not currently
  evidenced as necessary at this system's request volume.
- **Option C** (revocation denylist) — rejected: does not remove the
  second-query cost that Option D also carries, while additionally losing
  the audit/attribution surface a session-row model can offer, without a
  compensating advantage large enough to justify the switch.
- **Option E** (`tokenVersion` counter) — rejected as specified: cannot
  provide FR-003's per-token (single-device) logout by construction, since
  it revokes at user granularity. Would need to be paired with a
  per-session mechanism to satisfy FR-003, at which point it stops being a
  simpler alternative to Option D and becomes an addition to it — not
  evaluated further here, but worth revisiting if FR-003's granularity
  requirement is ever relaxed.

## Related ADRs

- Related: ADR-0011 (end-impersonation authentication boundary) — narrows
  a gap in how this ADR's guard-pairing model is enforced on one specific
  route (`POST /auth/end-impersonation`), which today applies neither
  `JwtAuthGuard` nor `SessionGuard`. ADR-0011 does not change the model
  this ADR describes.

## References

- `docs/features/session-management/PRD.md` — BR-001 (governing rule this
  ADR ratifies), FC-001 through FC-007, Q-002, Q-004, Q-005, Q-007, Q-010
- `docs/features/session-management/DISCOVERY.md` — Candidate ADR 1,
  evidence trail this ADR is based on
- `docs/features/session-management/FINDINGS.md` — IF-001, IF-002
- `docs/features/login/PRD.md`, `docs/features/login/DISCOVERY.md` — the
  companion Login PRD/discovery, which shares the same session-issuance
  mechanism at its own call sites
