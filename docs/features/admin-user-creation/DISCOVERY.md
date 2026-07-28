# Architecture Discovery — Admin User Creation (API Key Bootstrap)

Scan source: architecture-discovery
Scope: the `POST /auth/admin/register` route, `AdminApiKeyGuard`,
`AuthService.createAdmin()`, and the session it issues — does not re-scope
`AdminGuard`/`users.role` mechanics themselves (owned by
`PRD-AdminRoleGuards`) or `JwtStrategy`/session-issuance internals (owned by
`PRD-Login`/`PRD-SessionManagement`); this feature's specific use of each is
in scope, the mechanism underneath is not. This boundary excludes
`ADR-0010` and `ADR-0016` as *mechanisms* to re-derive, but not as
*precedents* this scan cites where they name `createAdmin`/this route
directly or supply an in-repo analogue for a candidate decision below —
that distinction is made explicit wherever either ADR is cited.
Primary input: `docs/features/admin-user-creation/PRD.md` (Status: Draft,
Confidence: High for observed behavior / Low for product intent — 3 Full
Reviews + 2 Delta Reviews by `product-reviewer`, all findings fixed and
self-verified against source).
Secondary input (consulted for consistency, not re-derived):
`docs/features/admin-role-guards/PRD.md` and its `DISCOVERY.md`/`FINDINGS.md`
(precedent for routing PRD gaps to existing ADRs vs. new candidates vs.
Implementation Findings), `docs/architecture/adr/0008-duplicate-email-registration-race-handling.md`
(Accepted), `docs/architecture/adr/0010-session-revocation-via-db-backed-session-records.md`
(Accepted, implemented), `docs/architecture/adr/0013-rate-limiting-for-unauthenticated-auth-endpoints.md`
(Accepted), `docs/architecture/adr/0016-deny-admin-authority-to-impersonated-sessions.md`
(Accepted).
Last scanned: 2026-07-28

## System Overview

Admin User Creation (API Key Bootstrap) is a single route,
`POST /auth/admin/register`, gated by `AdminApiKeyGuard` (a static shared
secret, not a JWT), backed by `AuthService.createAdmin()`. It is the only
path in the codebase that can produce the system's first admin account
(confirmed: no seed script creates one; the sibling `admin/create-user`
route requires an existing admin's session via `AdminGuard`). The
discovery's job is to determine which of the PRD's open questions
(Q-002, Q-003, Q-009, Q-011) represent genuine undocumented architectural
decisions versus gaps this codebase's ADR set has *already decided but not
yet implemented* versus plain implementation defects. The most significant
finding of this scan is the second category: `ADR-0008` (Accepted) already
explicitly names `createAdmin()` among the methods it changes, and its
Decision — once implemented — closes Q-011 (the unhandled-500 duplicate-
email race) and the status-code half of Q-003 (today, both the invalid-key
rejection and the duplicate-email rejection return 401; `ADR-0008`'s
`P2002`→409 pattern disambiguates them) for this exact route. Filing either
as a fresh candidate ADR would duplicate a decision this codebase has
already made; the correct next step is confirming the gap between that
decision and this route's current code, not re-deciding it. Two genuine
candidate ADRs remain (Q-002, Q-009); an earlier draft of this report
ranked them by how much intent could be recovered from the repository
rather than by consequence, which inverted their relative significance —
see Candidate ADRs below for the corrected ranking and reasoning.

## Component Inventory

| Component | Responsibility | Evidence |
|---|---|---|
| `AdminApiKeyGuard` (`backend/src/auth/guards/admin-api-key.guard.ts`) | Accepts `X-Admin-Api-Key` header or `Authorization: Bearer <key>` (header takes precedence via `??`, so a present-but-wrong header value suppresses a valid Bearer key); fails closed with 401 if `ADMIN_API_KEY` is unset/blank before comparing any submitted value | `admin-api-key.guard.ts:14-27` |
| `AuthService.createAdmin()` (`backend/src/auth/auth.service.ts:226-243`) | Pre-checks email uniqueness via `findByEmail` (throws `UnauthorizedException` 401 on hit), hashes password, creates a `users` row with `role: 'admin'`, and calls `issueTokenAndSession()` — the same session-issuing call `login()`/`register()` use | `auth.service.ts:226-243` |
| `POST /auth/admin/register` (`backend/src/auth/auth.controller.ts:106-119`) | Route wiring; Swagger documents a 201 (user + access token) and a 401 (invalid/missing key); no 409 documented | `auth.controller.ts:106-119` |
| `CreateAdminDto` (`backend/src/auth/dto/create-admin.dto.ts`) | Three fields: `email` (required), `password` (required, min 6), `displayName` (optional) — no `username` | `create-admin.dto.ts:5-22` |

## Data Flows

### Observed (directly evidenced)

1. **Account creation and session issuance are one atomic-looking call from
   the client's perspective, but two logically separate steps internally**:
   `createAdmin()` creates the `users` row, then calls the same
   `issueTokenAndSession()` `login()`/`register()` use — confirmed at
   `auth.service.ts:242`. No distinguishing claim (e.g. a "bootstrap"
   marker) is attached to the resulting token; it is structurally identical
   to a normal login session.
2. **The route's admin-key authentication and its email-uniqueness check
   are independent guards with no shared failure vocabulary**: an invalid
   key is rejected by `AdminApiKeyGuard` (401, `'Invalid admin API key'`)
   before the controller method runs at all; a duplicate email is rejected
   inside `createAdmin()`'s own pre-check (401, `'Email already registered'`)
   — both currently 401, confirmed at `admin-api-key.guard.ts:25-27` and
   `auth.service.ts:231-234`.
3. **The duplicate-email pre-check is not atomic with the insert**:
   `findByEmail` then `usersService.create` are separate calls
   (`auth.service.ts:231-236`) against `email String @unique`
   (`schema.prisma:16`), with no `P2002`/`PrismaClientKnownRequestError`
   catch anywhere in `backend/src`.
4. **No rate limiting or audit logging exists on this route** — confirmed
   by repo-wide search: no `@nestjs/throttler` import, no `ThrottlerModule`
   registration, no logging/event-emission call in `createAdmin()` beyond
   the shared user-creation path.
5. **This route never sets the `impersonatedBy` JWT claim** —
   `createAdmin()`'s call to `issueTokenAndSession(user)` passes a plain
   `User` row with no impersonation context, unlike `impersonate()`
   (`auth.service.ts:474`, which explicitly sets `impersonatedBy: adminId`).
   `ADR-0016`'s *mechanism* (deny admin authority when `impersonatedBy` is
   present) has no surface here at the data-flow level — this route's
   sessions never carry that claim, so nothing in `ADR-0016` fires today.
   **This is narrower than "orthogonal," however**: `ADR-0016` (Accepted) is
   this codebase's only precedent for scoping a session's *authority* via
   an issuance-time JWT claim read by `AdminGuard` — exactly the shape
   Candidate ADR-1's option (c) below would need. See Candidate ADR-1.
6. **Bootstrap-created sessions are already DB-backed and revocable via the
   existing session-revocation mechanism** — `ADR-0010` (Accepted, already
   implemented) explicitly enumerates `createAdmin` among the flows that
   create a `user_sessions`-backed record
   (`0010-session-revocation-via-db-backed-session-records.md:45-48`). A
   session minted by this route is not a special, unrevocable case; it is
   revocable the same way any login-derived session is. See Candidate
   ADR-1, option (a).

### Inferred

1. **The session-minting behavior is plausibly an artifact of code reuse,
   not a documented product decision** — inferred from the absence of any
   comment, ADR, or Swagger annotation stating this route's session
   issuance is deliberate (contrast: the sibling `admin/create-user`
   route's annotation explicitly states "Does not create a session for the
   new user," `auth.controller.ts:128` — an author's deliberate statement
   that has no analog here). This inference cannot be confirmed or refuted
   from the repository alone; see Candidate ADR-1.

## Candidate ADRs

Ranked by consequence-if-changed, not by how much intent is recoverable from
the repository — an earlier draft of this report ranked by the latter and
that ranking did not survive scrutiny; see the note under Candidate ADR-1.

### Candidate ADR-1: Should `POST /auth/admin/register` issue a live session in the same call that creates the account?

- **What's undocumented:** No ADR, comment, or Swagger annotation states
  whether immediate session issuance for a bootstrap-created admin account
  is intentional. The behavior is real and observable (`auth.service.ts:242`)
  but its *rationale* is absent — the exact condition an ADR exists to
  record.
- **Why it's a genuine architectural decision, not a style choice — corrected
  from an earlier draft of this report.** The original framing ("holding
  `ADMIN_API_KEY` becomes equivalent to holding a full admin session,
  skipping password login and 2FA") does not hold up: the caller supplies
  the password in the same request that creates the account
  (`create-admin.dto.ts`; hashed at `auth.service.ts:235-241`), and the
  account is brand new so nothing is enrolled in 2FA yet. Removing session
  issuance would not deny the caller any authority — it would only turn one
  request into two, since the same caller can immediately log in with the
  password they just chose (via the unauthenticated, and per IF-002
  unthrottled, `/auth/login`). `PRD-AdminUserCreation` BR-001's own
  rationale reasons the same way: a key holder blocked by an existing
  admin's 2FA can simply create a *different* admin account with
  equivalent authority, session or no session. **The real stakes are
  narrower but still genuine:** every invocation mints a 7-day DB-backed
  token (`auth.service.ts:443-448`) even when the caller never uses it,
  growing live-credential surface per call; and the token's payload is
  `{sub, email}` only (`auth.service.ts:23-27`) — provenance-free and
  indistinguishable from a login-derived session — which forecloses ever
  scoping, expiring, or auditing bootstrap-issued sessions differently
  from ordinary ones, unless that is decided now.
- **Options visible in the current code, including two in-repo precedents
  an earlier draft of this report missed:** (a) keep as-is — bootstrap
  implies immediate use, matching `login()`/`register()`'s pattern; the
  session is not a special unrevocable case today — `ADR-0010` (Accepted,
  implemented) already enumerates `createAdmin` among the flows whose
  sessions are DB-backed and revocable via the existing mechanism; (b)
  create the account but require a separate login step, matching the
  sibling `admin/create-user` route's explicit "no session" design; (c)
  issue a session but scope its authority at issuance time via a JWT claim
  `AdminGuard` checks — `ADR-0016` (Accepted) is this codebase's precedent
  for exactly this shape (denying admin authority when an `impersonatedBy`
  claim is present); a `bootstrap`-style claim at the same guard is the
  same pattern, not an unprecedented mechanism.
- **PRD reference:** Q-002.

### Candidate ADR-2: Should the bootstrap route be restricted to environments/states where no admin yet exists?

- **What's undocumented:** The route is reachable identically whether zero
  or many admin accounts already exist (`createAdmin()` has no such check);
  no ADR states whether unrestricted repeat use is intentional, or a gap
  the codebase never explicitly reasoned about — the repository gives no
  way to distinguish an inferred-but-undocumented decision from an
  unaddressed one, and this report does not assume either.
- **Why this ranked ahead of Candidate ADR-1 in an earlier draft of this
  report, and a correction since resolved by `ADR-0018`:** `PRD-AdminRoleGuards`
  FC-002 *notes* this route's continued availability as the reason
  unrestricted last-admin role removal reads as a *bounded* risk rather
  than a severe one — this is an observation in that PRD, not a recorded
  risk acceptance; Q-002 is open and unowned. `ADR-0018` (Proposed)
  examined whether restricting this route (via a live admin-count check)
  would actually invalidate that observation, and found it would not: a
  zero-admin state satisfies a live-count restriction's precondition the
  same way it satisfies the unrestricted route, so recoverability is
  identical either way. This candidate's real significance turned out to
  rest on a different, genuine driver: `PRD-AdminUserCreation` FR-001's
  Must-priority requirement that this route support repeat admin creation
  once admins already exist — see `ADR-0018` for the resolved reasoning.
- **Cross-cutting dependency, already documented elsewhere:** see the FC-002/
  Q-002 note above; `PRD-AdminUserCreation` Q-007/Q-009 records the
  cross-reference, and `ADR-0018` is the resolution.
- **PRD reference:** Q-009 (also touches Q-006, audit logging — no existing
  ADR addresses audit trails for account creation specifically, though
  `ADR-0016`'s `impersonatedBy`-keyed audit metadata on deposits/orders is
  an in-repo precedent for the mechanism, should Q-006 become an ADR).

## Already-decided, not yet implemented (not new candidate ADRs)

The PRD's remaining two open questions are not new architectural decisions
— they are already resolved by existing **Accepted** ADRs whose
implementation has not yet reached this route. Filing new ADRs for these
would duplicate decisions already made.

- **PRD Q-011 (unhandled 500 on concurrent duplicate-email requests) and the
  status-code half of Q-003 (401/401 ambiguity between invalid-key and
  duplicate-email) are closed by `ADR-0008`'s Decision.** `ADR-0008`
  (Accepted) explicitly names `createAdmin()` among the methods it changes
  (`0008-duplicate-email-registration-race-handling.md:42,303,315`). Its
  Decision **retains** the existing pre-check as a fast path (it is not
  replaced) but changes what it throws, and additionally requires: a
  `UsersService`-scoped `P2002` catch translated to `ConflictException`
  (409) as the correctness guarantee under concurrent requests (`:289-299`);
  the canonical message text `'Email already registered'` on both the
  pre-check and the catch, so the two paths agree (`:326-347`); and a `409`
  Swagger decorator added at `auth.controller.ts:116` before
  `openapi.json` can be regenerated to reflect it — regeneration reads
  existing decorators and infers nothing (`0008...:486-492`; confirmed
  `auth.controller.ts:116` documents only 401 today). Its own Consequences
  section states the result "also disambiguates that endpoint's 401, which
  today is overloaded between 'invalid admin API key' and 'duplicate
  email'" (`:481-483`) — the exact ambiguity Q-003's status-code half
  names. **Confirmed not yet implemented**: `createAdmin()`'s pre-check
  still throws `UnauthorizedException` (`auth.service.ts:231-234`), not a
  caught `P2002` translation.
  **Q-003 has a second, disclosure-policy half this ADR does not close**:
  ADR-0008 states of itself that it "picks a consistent status code; it
  does not decide the disclosure question Q-004 asks" (`:498-503`) — i.e.
  whether returning any conflict signal at all leaks which emails are
  registered. This report does not resolve that residual; it is plausibly
  disposable specifically on this route (only a valid `ADMIN_API_KEY`
  holder ever reaches the 409, and that holder can already enumerate every
  account via `GET /users`), but that argument is not this discovery's to
  make — see Open Questions.
- **PRD Q-005's baseline (should this route be rate-limited at all) is
  closed by `ADR-0013`'s Decision; per-route tightening is not.** `ADR-0013`
  (Accepted) decides a global `ThrottlerModule` with an application-wide
  IP-keyed default "applying to every route"
  (`0013-rate-limiting-for-unauthenticated-auth-endpoints.md:437-438`) —
  this route is not named as an exception, so it is in scope of that
  default once implemented. **Confirmed not yet implemented**: no
  `@nestjs/throttler` import or `ThrottlerModule` registration exists
  anywhere in `backend/src`. **However, `ADR-0013` never considered this
  route specifically** — its Context enumerates the routes in its scope and
  `/auth/admin/register` appears nowhere in it. For routes it covers only
  by the global default rather than a tightened per-route limit, that ADR
  uses a dedicated heading and explicitly defers per-route tightening to
  "the owning feature PRD's decision, not designed here" (`:132-150`, of
  `register`). By that same precedent, whether this route needs a
  *tighter* limit than the global default — its case arguably stronger
  than `register`'s, since it is the only endpoint where a static,
  non-rotating, non-expiring shared secret is being guessed against — is
  undecided and not closed by ADR-0013. See Open Questions for who owns
  that decision.

## Documentation Gaps

- No ADR records the session-minting decision (Candidate ADR-1).
- No ADR records whether the bootstrap route's unrestricted repeat
  availability is deliberate (Candidate ADR-2), nor whether account
  creation via this path should be audited (Q-006 — no existing ADR
  addresses audit trails for account creation specifically, though
  `ADR-0016`'s `impersonatedBy`-keyed metadata on deposits/orders is an
  in-repo pattern for the mechanism).
- No ADR records why a static, unrotated, environment-level shared secret
  is the credential for the only unauthenticated admin-creating route.
  `PRD-AdminUserCreation` C-001 treats this as a fixed constraint rather
  than a decision to raise, which is a legitimate scoping choice for that
  PRD to make — but this report names the absence explicitly rather than
  leaving it indistinguishable from an oversight; `ADR-0011:34-38`
  observes the same fact in passing without deciding it either.
- `ADR-0008` and `ADR-0013`'s Decisions are Accepted but not implemented for
  this route (and, per each ADR's own scope, for the rest of the auth
  module) — an implementation gap, not a documentation gap, but worth
  naming here since it determines whether Q-011 and Q-003's status-code
  half need any further product or architecture decision (they don't) or
  only implementation follow-through. Q-003's disclosure half and Q-005's
  per-route-tightening half remain genuinely open — see Open Questions.

## Open Questions (from this scan, in addition to the PRD's own)

- Q-003's disclosure-policy half (should a duplicate-email conflict on this
  route be signaled at all, versus a generic response, to avoid leaking
  registered emails) is not decided by `ADR-0008`, which explicitly
  disclaims it. Whether the `GET /users`-enumeration argument above is
  sufficient to close it without a new ADR, or whether it needs one, is
  left to `adr-expert`/the user.
- Who owns the per-route rate-limit-tightening question (F-3 above) —
  `PRD-AdminUserCreation` or `PRD-AdminRoleGuards`? `ADR-0013`'s own
  precedent points to the PRD owning the specific endpoint, but this route
  is named in both PRDs' scope.
- Does any operator workflow actually consume the token
  `POST /auth/admin/register` returns today (a setup script, a QA harness,
  a documented runbook)? Neither the PRD nor this scan establishes this,
  and it is the fact that would most cheaply settle Candidate ADR-1's
  option (b).
- `admin-api-key.guard.ts:25` compares the submitted key with `!==`
  (non-constant-time string comparison). Filed as IF-003, not an ADR — see
  `FINDINGS.md`.

## Implementation Findings

See `FINDINGS.md`. This scan filed IF-001, IF-002, and IF-003.
