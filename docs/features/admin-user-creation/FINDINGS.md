# Implementation Findings — Admin User Creation (API Key Bootstrap)

Scan source: architecture-discovery
Last scanned: 2026-07-28

### IF-001 — `POST /auth/admin/register`'s duplicate-email handling has not caught up to `ADR-0008`'s accepted decision: still a non-atomic pre-check returning an ambiguous 401

- **Source:** architecture-discovery
- **Status:** Open
- **Observation:** `createAdmin()` checks email uniqueness via a
  `findByEmail` call, then separately calls `usersService.create` — the two
  are not atomic. On a hit, the pre-check throws `UnauthorizedException`
  (401, message `'Email already registered'`) — the same status code
  `AdminApiKeyGuard` uses for an invalid API key, so a client cannot
  distinguish the two failure modes from status code alone. `ADR-0008`
  (Accepted) already names `createAdmin()` as one of the methods its
  Decision changes. That Decision **retains** the pre-check as a fast path
  (it is not replaced) but changes what it throws, and additionally
  requires: a `UsersService`-scoped `P2002` catch translated to
  `ConflictException` (409) as the correctness guarantee under concurrent
  requests; the canonical message text `'Email already registered'` used
  consistently by both the pre-check and the catch; and a `409` Swagger
  decorator added to this route before `openapi.json` regeneration can
  reflect it (regeneration reads existing decorators and infers nothing).
  None of these three changes has been made for this route.
- **Evidence:** `backend/src/auth/auth.service.ts:231-236` (non-atomic
  `findByEmail`-then-`create`, `UnauthorizedException` thrown at :233); no
  `P2002` or `PrismaClientKnownRequestError` catch anywhere in
  `backend/src` (repo-wide search); `backend/src/auth/auth.controller.ts:116`
  (documents only a 401 response today, no 409);
  `docs/architecture/adr/0008-duplicate-email-registration-race-handling.md:42,303,315`
  (names `createAdmin()` in scope), `:289-299` (pre-check retained as fast
  path, not replaced), `:326-347` (canonical message text requirement),
  `:481-483` (states the 401 status-code disambiguation as a stated
  consequence of the decision), `:486-492` (409 Swagger decorator must be
  added before `openapi.json` regeneration can reflect it), `:510-523`
  (Risk: an incorrect `meta.target` assumption in the `P2002` catch would
  make the translation a silent no-op — this repo has no test suite to
  catch that regression).
- **Impact:** Two concurrent requests with the same email may both reach
  the insert; the losing request fails with an unmapped database
  constraint violation, surfacing as an unhandled HTTP 500 rather than any
  specified response. Separately, and independent of concurrency: a client
  cannot currently tell "your API key is wrong" from "that email is already
  an admin" using status code alone, since both return 401.
- **Confidence:** High
- **Related:** FC-002 (`PRD-AdminUserCreation`), Q-003, Q-011, `ADR-0008`

### IF-002 — `POST /auth/admin/register` has no rate limiting, matching `ADR-0013`'s described pre-decision state, not yet its accepted post-decision state

- **Source:** architecture-discovery
- **Status:** Open
- **Observation:** No throttling mechanism of any kind applies to this
  route. `ADR-0013` (Accepted) decides a global `ThrottlerModule` with an
  application-wide IP-keyed default applying to every route, which would
  cover this one once implemented — but no `@nestjs/throttler` dependency,
  `ThrottlerModule` registration, or route-level `@Throttle()` decorator
  exists anywhere in the backend.
- **Evidence:** No `ThrottlerModule` import or registration found in
  `backend/src` (repo-wide search, including `app.module.ts`); no
  `@nestjs/throttler` entry in `backend/package.json`;
  `docs/architecture/adr/0013-rate-limiting-for-unauthenticated-auth-endpoints.md:437-438`
  (Decision: global default "applying to every route").
- **Impact:** This route is reachable at unlimited request volume by
  anyone able to reach the network endpoint, regardless of whether they
  hold a valid `ADMIN_API_KEY` — an unlimited number of invalid-key attempts
  can be made with no backoff or lockout. Note: `ADR-0013`'s Context does
  not enumerate this specific route among the endpoints it considered: it
  would only inherit the global default once implemented, not any
  tightened per-route limit — whether a tighter, route-specific limit is
  warranted here is a separate, still-open question (see `DISCOVERY.md`).
- **Confidence:** High
- **Related:** Q-005 (`PRD-AdminUserCreation`), `ADR-0013`

### IF-003 — API key comparison in `AdminApiKeyGuard` is not constant-time

- **Source:** architecture-discovery
- **Status:** Open
- **Observation:** The guard compares the submitted key against the
  configured `ADMIN_API_KEY` using JavaScript's `!==` string inequality
  operator, not a constant-time comparison function.
- **Evidence:** `backend/src/auth/guards/admin-api-key.guard.ts:25`
  (`if (!apiKey || apiKey !== expectedKey.trim())`); no
  `crypto.timingSafeEqual` or equivalent constant-time comparison anywhere
  in `backend/src/auth` (repo-wide search).
- **Impact:** A timing side-channel is theoretically available to an
  attacker measuring response latency across many requests to infer the
  correct key byte-by-byte. This compounds IF-002's unlimited-attempt
  surface, since nothing currently bounds how many timing samples an
  attacker can collect against a route protected by a single static,
  non-rotating secret.
- **Confidence:** Medium
- **Related:** IF-002
