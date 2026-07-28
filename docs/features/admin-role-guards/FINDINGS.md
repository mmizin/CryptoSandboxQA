# Implementation Findings — Admin Role & Guards

Scan source: architecture-discovery
Last scanned: 2026-07-28

### IF-001 — `AdminGuard` fails open for a non-access-token credential when `SessionGuard` is omitted, the same root cause `ADR-0011` already scoped and deferred

- **Source:** architecture-discovery
- **Status:** Open
- **Observation:** `JwtStrategy.validate()` inspects only `payload.sub` —
  it does not check `temp2fa` or `purpose` claims, and every token kind
  this codebase issues (ordinary access token, 2FA temp token,
  `backToAdminToken`) is signed with one shared secret. A route pairing
  `JwtAuthGuard` and `AdminGuard` without `SessionGuard` would resolve an
  admin's own 5-minute 2FA temp token or `backToAdminToken` to a full
  admin `User` record, and `AdminGuard`'s `role === 'admin'` check would
  pass. `SessionGuard` (requiring a `user_sessions` row, which neither
  token has) is the only thing preventing this today, and it is applied
  by convention at every one of the 13 current `AdminGuard` sites, not by
  any structural guarantee.
- **Evidence:** `backend/src/auth/jwt.strategy.ts:21-31` (no `temp2fa`/
  `purpose` inspection); `backend/src/auth/auth.service.ts:23-27`
  (`JwtPayload`, no distinguishing claim), `:29-33` (`Temp2FaPayload`),
  `:484` (`backToAdminPayload`); `backend/src/auth/session.guard.ts:27-36`
  (the only check that would reject either token). Cross-referenced:
  `docs/architecture/adr/0011-end-impersonation-authentication-boundary.md`
  Context (`:66-75`) independently documents the identical mechanism for
  `backToAdminToken` against `end-impersonation`, and names it as the
  reason that ADR's Option D ("scope tokens cryptographically") would
  close the gap for every route, not only the ones ADR-0011 addresses.
- **Impact:** If a future route applies `AdminGuard` without
  `SessionGuard` at the same or an enclosing scope, an admin holding a
  live 2FA temp token (issued before their second factor is verified) or
  their own `backToAdminToken` (normally scoped to restoring a session
  after impersonation) could use it to reach that route as if it were a
  full, valid admin session — a materially higher-value target than the
  authenticated-route-only impact `docs/features/login/FINDINGS.md`
  IF-001 describes for the same mechanism against non-admin routes. Not
  currently exploitable: all 13 `AdminGuard` sites audited pair
  `SessionGuard`.
- **Confidence:** High
- **Related:** PRD-AdminRoleGuards FC-004b, `ADR-0011` (Option D,
  deferred — this finding widens that option's known scope), `login/
  FINDINGS.md` IF-001 (same mechanism, non-admin routes)

### IF-002 — `GET /users/:id` returns any account's full profile with no admin gate or self-ownership check

- **Source:** architecture-discovery
- **Status:** Open
- **Observation:** `UsersController.getById()` carries only the
  controller's class-level `JwtAuthGuard, SessionGuard` pair — no
  `AdminGuard`, and no check that the requested `id` matches the
  requesting user's own ID. It calls `findByIdWithProfile(id)` for the
  `id` path parameter as given and returns the full `User` record (minus
  `passwordHash`) plus the joined `UserProfile`.
- **Evidence:** `backend/src/users/users.controller.ts:79-89` (route
  definition, no `AdminGuard`, no ownership check); `:37` (class-level
  `JwtAuthGuard, SessionGuard` only); contrast with `GET /users`
  (`:41-48`), which does carry `AdminGuard`.
- **Impact:** Any authenticated account can retrieve any other account's
  email, role, display name, and profile fields (birthday, location,
  website, preferences) by requesting an arbitrary user ID.
- **Confidence:** High
- **Related:** PRD-AdminRoleGuards FC-005, G-001, Q-006
