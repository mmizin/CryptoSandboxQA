# Architecture Discovery — User Login

**Feeds:** `PRD-Login` (docs/features/login/PRD.md)
**Scope:** Feature-scoped, PRD-primary. Implementation inspected only to
verify architectural behavior and resolve ambiguity the PRD already flagged
(per `docs/foundation/DOCUMENTATION-STANDARDS.md`) — this is not a
full-repo scan.
**Produced by:** `architecture-toolkit:architecture-discovery`
**Date:** 2026-07-26

## System overview (scoped to this feature)

Login is one endpoint inside the same single-process NestJS `auth` module as
Registration, backed directly by Prisma/PostgreSQL — no queue, no separate
identity service. `POST /auth/login` runs entirely in-request: validate →
look up account by email → compare password hash → branch on whether 2FA is
enabled → either return a short-lived temporary token (2FA path) or issue a
JWT and create a session row (direct path) → respond. It shares its
session/token issuance mechanism (`issueTokenAndSession`) with Registration
and four other call sites (see Data flow below for the corrected count and
a caveat about `impersonate()`'s separate inline copy of the same
sequence) — the sharing itself was already established in
`docs/features/registration/DISCOVERY.md` and is not re-derived here.

## Component inventory

| Component | Responsibility (as observed) |
|---|---|
| `AuthController.login()` (`auth.controller.ts:61-70`) | HTTP boundary; `POST /auth/login` maps `LoginDto` straight to `AuthService.login()` with no extra logic |
| `AuthService.login()` (`auth.service.ts:79-106`) | Orchestrates: credential validation, 2FA branch, session/token issuance |
| `AuthService.validateUser()` (`auth.service.ts:70-77`) | Looks up the account by email, compares the password against the stored bcrypt hash; returns `null` on either a missing account or a wrong password — same return shape either way |
| `TwoFactorService.is2FaEnabled()` | Determines the 2FA branch; not read in detail here — owned by the not-yet-produced `PRD-TwoFactorAuth` |
| `AuthService.issueTokenAndSession()` (`auth.service.ts:440-455`) | Signs the JWT (`jwtService.sign`, 7-day expiry), then calls `SessionsService.createSession()`; shared across six call sites including Registration (`login`, `verify2Fa`, `register`, `createAdmin`, `registerWithProfile`, `endImpersonation`) — `impersonate()` notably does **not** call this method; it inlines an identical sequence separately (`auth.service.ts:476-482`) |
| `SessionsService.createSession()` (`sessions.service.ts:13-22`) | Hashes the token (SHA-256) and inserts a `user_sessions` row; no expiry enforcement beyond the stored `expiresAt` field |
| `JwtStrategy.validate()` (`jwt.strategy.ts:21-31`) | Looks up the user by `payload.sub` and returns it; does **not** inspect any `temp2fa` claim on the payload |
| `SessionGuard` (`session.guard.ts`) | Hashes the presented bearer token and requires a matching, unexpired `user_sessions` row; this is the only guard-level check that distinguishes a full session token from the 2FA temporary token |
| `frontend/app/page.tsx` | Landing page; hosts the actual sign-in form and the 2FA verification modal |
| `frontend/app/login/page.tsx` | 14-line client component whose entire body is `router.replace('/')` — a redirect alias, not an independent sign-in surface |

## Data flow

**Observed** (traced directly from source, not inferred):

```
Account Holder → POST /auth/login
  → LoginDto validated (class-validator, global ValidationPipe)
  → AuthService.login():
      1. validateUser(email.toLowerCase(), password):
           - usersService.findByEmail(email)             [read]
           - if not found → return null
           - bcrypt.compare(password, user.passwordHash)  [only reached if found]
           - if mismatch → return null
      2. if null → throw UnauthorizedException('Invalid email or password')
      3. twoFactorService.is2FaEnabled(user.id)           [read]
      4. if 2FA enabled:
           - jwtService.sign(tempPayload, { expiresIn: '5m' })  [temp2fa: true]
           - return { requires2FA: true, tempToken }       [no session row created]
      5. else:
           - usersService.findByIdWithProfile(user.id)    [read — auth.service.ts:104]
           - issueTokenAndSession(userWithProfile!):
               - jwtService.sign(payload, { expiresIn: '7d' })
               - sessionsService.createSession(...)        [write: user_sessions row]
  → response: { access_token, user }  OR  { requires2FA: true, tempToken }
```

Note on step 5's `!` (non-null assertion, `auth.service.ts:105`): the two
sibling paths performing the identical `findByIdWithProfile` lookup
null-check it and throw a clean `UnauthorizedException` —
`verify2Fa` (`auth.service.ts:207-210`, "User not found") and `impersonate`
(`auth.service.ts:466-469`, "Target user not found"). Login is the only one
of the three that asserts instead of checking, so the same not-found
condition that produces a clean 401 in the sibling paths would produce an
unhandled `TypeError` (500) here. Narrow window — the user row was just
read successfully by `validateUser` moments earlier — but it is a
within-file inconsistency across three copies of the same pattern.

**Inferred** (not directly observed, reasoned from absence of evidence):

- **No rate limiting or lockout on `/auth/login`.** Searched for
  `ThrottlerModule`, `@Throttle`, and any bull/queue dependency in
  `backend/package.json` and `backend/src` — found none. Every login attempt
  that reaches an existing account runs a real `bcrypt.compare` at cost
  factor 10 (confirmed: `bcrypt.hash(..., 10)` used consistently across
  `auth.service.ts` for every password-hashing call site, and `compare`
  targets a hash produced at that cost). Inference: an attacker (or a
  misbehaving client) can drive unbounded CPU load by repeatedly targeting
  existing accounts, and can also attempt unlimited credential guesses
  against any single account, with no code-level backstop.
- **Session record creation is not atomic with token issuance, and the
  sign-then-create-session sequence is duplicated outside the shared
  method.** `issueTokenAndSession()` (`auth.service.ts:440-455`) signs the
  JWT first, then calls `sessionsService.createSession()`. It has **six**
  call sites, not three as an earlier draft of this document stated:
  `login` (`:105`), `verify2Fa` (`:212`), `register` (`:223`), `createAdmin`
  (`:242`), `registerWithProfile` (`:287`), and `endImpersonation` (`:517`).
  Separately, `impersonate()` (`:476-482`) is **not** a call site of
  `issueTokenAndSession` — it inlines its own copy of the identical
  sequence (`jwtService.sign()` then `sessionsService.createSession()`)
  rather than calling the shared method. No `try/catch` wraps any
  `createSession()` call, in the shared method or in `impersonate`'s inline
  copy (confirmed by reading all seven sites — six through the shared
  method, one inline). Inference: if the `user_sessions` insert fails (DB
  error) after the JWT is already signed, the exception would propagate
  unhandled up through the controller at any of these seven sites; whether
  the already-signed JWT ever reaches the client before that failure is a
  question of NestJS's response-serialization timing, not reasoned further
  here — the code path itself has no recovery or rollback logic regardless
  of when the failure surfaces. The duplication in `impersonate()` is
  itself notable independent of the failure-handling question: it means
  "fix it in one place" is not available as an option without first
  addressing why `impersonate()` doesn't call the shared method it
  otherwise mirrors exactly.
- **Login's own credential-comparison timing is a second, code-level
  enumeration channel, alongside registration's disclosure.**
  `validateUser()` (`auth.service.ts:70-77`) returns early when no account
  matches the email, and only reaches `bcrypt.compare()` when an account is
  found — so a request against a registered email takes measurably longer
  than one against an unregistered email, independent of the identical
  response message (`PRD-Login` FC-001/Q-005 already flags this). Notably,
  `requestPasswordReset()` in the same file carries the comment "Same
  response whether or not the email exists (avoid account enumeration)"
  (`auth.service.ts:108`) and is deliberately built to avoid exactly this
  class of leak. Inference: the codebase holds two different postures on
  account-existence disclosure across two auth endpoints in the same
  service — one deliberately closes the channel, the other does not
  address it — which reads as an inconsistency in applied intent, not
  necessarily an oversight specific to login.
- **The 2FA temporary token's restricted scope is enforced by guard-pairing
  convention, not by a payload check.** `JwtStrategy.validate()` (the
  strategy backing `JwtAuthGuard`) only reads `payload.sub` and
  `payload.impersonatedBy` — it does not inspect `temp2fa`. No
  `@UseGuards` site in `backend/src` applies `JwtAuthGuard` without
  `SessionGuard` also present at the same or an enclosing scope (class-level
  and method-level guards compose — e.g. `users.controller.ts` pairs
  `JwtAuthGuard, SessionGuard` at the class level and layers `AdminGuard` at
  the method level; the single admin-bootstrap route that skips the JWT
  pipeline entirely, `POST /auth/admin/register`
  (`auth.controller.ts:107`, `AdminApiKeyGuard` alone), uses a different
  credential and is not part of this comparison). Since the temp token has no backing
  `user_sessions` row, `SessionGuard` is what actually rejects it today.
  Inference: if a future protected route were guarded with `JwtAuthGuard`
  alone at every applicable scope (omitting `SessionGuard` entirely), the
  2FA temporary token would be accepted as a valid credential for that
  route — this has not been observed to happen (no such route exists
  today), it is a structural risk in how the two guards' responsibilities
  are split.

## Candidate ADRs

Ranked by significance — these are **candidates requiring confirmation**,
not settled decisions. None of the three has a recorded rationale anywhere
in the repo.

### Candidate ADR 1 — Rate limiting / lockout policy for authentication endpoints

**Significance: High.** This is a genuine, unmade decision with a direct
security consequence (credential-guessing exposure, plus the
CPU-amplification angle noted above). PRD-Login's `FC-003` explicitly states
`Applies to: (system-level)`, not just `/auth/login` — and
`PRD-Registration` independently raised the identical question for
`/auth/register` (its own `Q-002`). Scoping this decision to one route would
produce an ADR superseded by the next backlog item that hits the same gap;
the decision genuinely on the table is whether this system adopts a
rate-limiting/lockout mechanism for authentication endpoints generally, with
`/auth/login` as the forcing case rather than the boundary. It is flagged as
a candidate ADR — not filed purely as an Implementation Finding — because
closing it requires choosing among architecturally distinct approaches (see
options below), not just adding a missing check.

**Adjacent, currently unowned by any PRD:** `POST /auth/2fa/verify`
(`auth.controller.ts:247`, handled by `verify2Fa`,
`auth.service.ts:191-213`) is itself unguarded and unthrottled, and neither
counts failed attempts nor invalidates the 5-minute temp token on a wrong
code — making it an unlimited-guess window against the second factor,
renewable indefinitely since login itself is unthrottled. `PRD-Login`
explicitly treats 2FA verification as a Non Goal, and `PRD-TwoFactorAuth`
does not yet exist, so this specific instance of the rate-limiting question
currently has no PRD tracking it — noted here so it isn't lost in the seam
between the two features when `adr-expert` or `PRD-TwoFactorAuth` picks this
up.

Candidate options observed as generally available in this stack (not a
recommendation):
- Add `@nestjs/throttler` (or equivalent) scoped to the relevant
  authentication endpoints (at minimum `/auth/login`; `/auth/2fa/verify` is
  the same class of risk once that feature exists) — smallest change, does
  not touch the session/token model.
- Add a persistent failed-attempt counter (e.g. a new column or table) to
  support account-level lockout after N failures — larger change, needs a
  decision on lockout duration and reset conditions.
- Explicitly accept the current unbounded-attempt behavior as a deliberate
  tradeoff for a QA-training sandbox with no real financial assets at risk —
  a valid outcome of this decision, not a default to assume.

### Candidate ADR 2 — Session-creation failure handling and the duplicated issuance sequence

**Significance: Medium.** Registration's discovery flagged a related but
distinct sibling gap (unhandled `P2002` on duplicate email, concurrency-
specific) as its own Candidate ADR 1 — since resolved and accepted as
`ADR-0008`. This candidate is about a different failure mode: a bare
infrastructure failure (DB unavailable, or any other error) when
`sessionsService.createSession()` is called, after a JWT has already been
signed, across the six call sites of `issueTokenAndSession()` plus
`impersonate()`'s separate inline copy of the same sequence (see Data flow
above — seven sites total, not three). `PRD-Login`'s `FC-004`/`Q-006` left
ownership of this gap unresolved between `PRD-Login` and
`PRD-SessionManagement`.

`ADR-0008` constrains the option space here even though it resolved a
different bug: it explicitly **rejected** an application-wide interception
mechanism on blast-radius grounds ("scope the fix to the boundary that owns
the invariant," "one fix pattern needs to cover the known call sites without
being re-derived at each one, but 'cover' must not mean silently reinterpret
every unique constraint") and required that any fix preserve exception-type
contracts for in-process callers, not just HTTP responses. Both drivers
would constrain a fix here if one existed: `issueTokenAndSession` currently
has no in-process caller that catches its exceptions and branches on their
type (unlike `bulkImportUsersFromFile`'s `instanceof ConflictException`
check, ADR-0008's Context) — all six call sites are `AuthService` methods
reached only from HTTP handlers in `auth.controller.ts`, with no
in-process consumer. The exception-type-contract driver is therefore
prospective here, not a constraint on existing behavior: it bears on
whatever a future in-process caller of this path might expect, not on a
caller that exists today.

Candidate options observed as generally available in this stack:
- Wrap `jwtService.sign()` + `sessionsService.createSession()` in a
  try/catch inside `issueTokenAndSession()` itself — covers six of the seven
  sites in one place, consistent with `ADR-0008`'s "scope to the boundary
  that owns the invariant" driver. Does **not**, on its own, cover
  `impersonate()`'s inline duplicate — that would need either a second,
  identical catch there, or `impersonate()` being changed to call the
  shared method instead of duplicating it (a separate, prior decision this
  candidate does not make for you).
- Reorder to create the session row first and sign the JWT only after it
  succeeds — changes the method's current sequencing but removes the
  window where a token exists with no backing session. Would need to be
  applied to `impersonate()`'s inline copy as well to actually close the
  gap everywhere it appears.
- Leave unhandled and treat as an accepted operational risk, on the
  reasoning that a `user_sessions` insert failing while the DB is otherwise
  healthy enough to have just completed a read is a narrow window — a valid
  outcome of this decision, not assumed here.

### Candidate ADR 3 — Account-existence disclosure posture across auth endpoints

**Significance: Medium.** `PRD-Login`'s `FC-001`/`G-002`/`Q-005` already
raise whether application-wide anti-enumeration is a real product
commitment. Discovery's contribution here is the evidence that the
codebase currently holds two different, seemingly independent postures on
this question within the same `AuthService`: `requestPasswordReset()`
carries an explicit comment and design ("Same response whether or not the
email exists (avoid account enumeration)," `auth.service.ts:108`) while
`register()` discloses account existence directly ("Email already
registered") and `login()`'s timing (bcrypt only runs for existing
accounts) leaks it independent of the identical response message. This
reads as an unresolved product-wide posture, not a login-specific defect —
flagged as a candidate ADR because closing it requires a single,
cross-feature decision (see options), not a per-endpoint fix.

Candidate options observed as generally available in this stack:
- Adopt uniform-timing comparison (e.g. compare against a dummy hash on the
  not-found path in `validateUser()`) to close login's own channel — but
  note this interacts with Candidate ADR 1: doing so makes every login
  attempt pay the full bcrypt cost, including ones targeting non-existent
  emails, which changes the shape of the CPU-amplification risk that
  Candidate ADR 1 is also about. These two candidates cannot be decided
  independently.
- Decide anti-enumeration is not a real product goal for this
  training sandbox (visible account existence may even be pedagogically
  acceptable, or irrelevant, given there's no real financial asset behind
  an account) — and retire `PRD-Login` Q-005/G-002's residual-channel
  language accordingly, rather than carrying it as an open gap indefinitely.
- Treat `register()`'s disclosure as the outlier to fix (align it with
  `requestPasswordReset()`'s posture) rather than treating login's timing
  as the thing to change — a decision `PRD-Registration`'s own `Q-004`
  already surfaces from that feature's side.

## Implementation Findings

One finding filed this scan — see `docs/features/login/FINDINGS.md`: IF-001
(2FA temporary token is only prevented from reaching authenticated endpoints
by a guard-pairing convention, not an explicit payload check).

## Documentation gaps

- No ADR exists for any of the three candidates above, and no other doc in
  the repo mentions rate limiting, the session-creation failure gap, or the
  account-existence disclosure inconsistency — genuinely undocumented, not
  just undocumented here. (`ADR-0008` and `ADR-0009` — both `Accepted`,
  produced from Registration's discovery — resolve Registration's own
  candidates and are cited above where they constrain Candidate ADR 2; they
  do not cover any of Login's three.)
- No C4 diagram exists anywhere in the repo beyond the single System Context
  diagram (`docs/architecture/c4/C4-CONTEXT.md`). At that level, the check
  is whether Login adds a new `Person` or `System_Ext` to the diagram: it
  does not. The account holder is the same `Person(learner, ...)`/
  `Person(admin, ...)` already on the diagram; the 2FA path introduces no
  external system reference (the human transcribes a TOTP code — no
  relationship crosses the system boundary for it; the 2FA secret's
  provisioning is a separate, out-of-scope setup step). At the
  Container/Component level (which no diagram in this repo currently
  covers, System Context being the only one that exists), Login also
  introduces no new container or component boundary — it reuses the same
  `auth` module, the same `issueTokenAndSession` path (bar the
  `impersonate()` duplication noted above, which is an internal-method
  concern, not a component boundary), and the same
  `SessionsService`/`SessionGuard` pair already touched by Registration.
  Consistent with Registration's discovery conclusion at the same level.
  Flagging for `c4-expert` to confirm rather than deciding unilaterally
  here.

## What this hands off to

- Candidate ADR 1 (rate limiting / lockout for authentication endpoints),
  Candidate ADR 2 (session-creation failure handling), and Candidate ADR 3
  (account-existence disclosure posture) → `adr-expert`, if you confirm
  they're worth formalizing. Note Candidate ADR 1 and Candidate ADR 3 are
  coupled (see Candidate ADR 3's first option) and should likely be decided
  together, not sequentially.
- Implementation Finding IF-001 (2FA temp-token guard-pairing risk, see
  `FINDINGS.md`) → `adr-expert`, if its resolution is judged to need a
  recorded decision rather than a direct code fix.
- No new C4 diagram recommended for this feature specifically — flagged
  above for `c4-expert` to confirm.
- No `arc42-expert` write-up scoped to a single feature — whole-system
  exercise per the plan's phase ordering, not per-feature.
