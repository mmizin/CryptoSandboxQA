# Implementation Findings — User Login

Scan source: architecture-discovery
Last scanned: 2026-07-26

### IF-001 — 2FA temporary token's restricted scope is enforced only by guard-pairing convention

- **Source:** architecture-discovery
- **Status:** Open
- **Observation:** The temporary token issued when login detects 2FA is
  enabled (`AuthService.login()`, `auth.service.ts:90-101`, `temp2fa: true`
  claim, 5-minute expiry) is signed with the same JWT secret as a full
  session token and carries no session record. `JwtStrategy.validate()`
  (`jwt.strategy.ts:21-31`), the strategy backing `JwtAuthGuard`, reads only
  `payload.sub` and `payload.impersonatedBy` — it does not inspect the
  `temp2fa` claim. The only reason the temp token cannot currently reach an
  authenticated endpoint is that no `@UseGuards` site in `backend/src`
  applies `JwtAuthGuard` without `SessionGuard` also present at the same or
  an enclosing scope, and `SessionGuard` (`session.guard.ts`) requires a
  matching, unexpired `user_sessions` row — which the temp token never has.
- **Evidence:** `backend/src/auth/jwt.strategy.ts:21-31` (no `temp2fa`
  check in `validate()`); `backend/src/auth/auth.service.ts:88-101` (temp
  token issuance, no session created). Precise claim, since a bare grep for
  `@UseGuards` alone is not sufficient evidence (class-level and
  method-level guards compose, and a naive read of the grep output includes
  routes on a different credential entirely): every `@UseGuards` site
  either (a) pairs `JwtAuthGuard` with `SessionGuard` directly (most
  controllers), or (b) applies a guard at the method level (e.g.
  `AdminGuard` in `users.controller.ts:42,61,102,116`) that composes with a
  `JwtAuthGuard, SessionGuard` pair already applied at the class level
  (`users.controller.ts:37`), or (c) uses `AdminApiKeyGuard` alone
  (`auth.controller.ts:107`) — a route on the admin API-key credential, not
  the JWT pipeline at all, and outside this finding's scope. No site was
  found where `JwtAuthGuard` applies at any scope with no `SessionGuard`
  at the same or an enclosing scope.
- **Impact:** If a future protected route were guarded with `JwtAuthGuard`
  alone (omitting `SessionGuard`), the 2FA temporary token would be accepted
  by that route as a valid credential, since nothing in the JWT validation
  path distinguishes it from a full session token. This has not been
  observed to happen — no such route exists today — but the guarantee that
  it can't happen rests on every future route author independently
  reproducing the same guard pairing, not on a check in the shared
  validation path itself.
- **Confidence:** High
- **Related:** PRD-Login C-002, PRD-Login FR-003
