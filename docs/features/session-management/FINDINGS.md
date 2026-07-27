# Implementation Findings — Session Management

Scan source: architecture-discovery
Last scanned: 2026-07-26

### IF-001 — Session token hashing is implemented independently in two places, and the shared service's own validation method is unused

- **Source:** architecture-discovery
- **Status:** Open
- **Observation:** `SessionsService.hashToken()` computes `SHA-256(token)`
  for session creation and deletion. `SessionGuard.canActivate()` computes
  the identical `SHA-256(token)` inline rather than calling
  `SessionsService`. `SessionsService` additionally exposes
  `isSessionValid(tokenHash)` and `getTokenHash(token)` — methods whose
  names and signatures match what `SessionGuard` would need to delegate
  validation to the service — but neither method has any caller anywhere
  in the repository.
- **Evidence:** `backend/src/auth/sessions.service.ts:9-11` (`hashToken`,
  private), `:32-40` (`isSessionValid`), `:42-44` (`getTokenHash`);
  `backend/src/auth/session.guard.ts:26` (inline
  `createHash('sha256').update(token).digest('hex')`, duplicating
  `hashToken`'s logic rather than calling it). Repo-wide search for
  `isSessionValid` and `getTokenHash` (`grep -rn` across `backend/src`)
  returns only their own definitions — no call sites.
- **Impact:** The value that identifies a session (`tokenHash`) is computed
  by two independent implementations, whose outputs currently agree only
  because both compute plain unsalted `SHA-256(token)`. FR-002 (session
  validation), FR-001 (session creation), and FR-003 (session deletion)
  depend on that agreement to reference the same row for a given token. A
  change to either
  implementation (e.g. adding a pepper, as `hashResetCode()` already does
  for a different value at `auth.service.ts:183-189`, establishing
  precedent for this codebase) without a matching change to the other would
  silently break session lookup for all subsequently issued or
  subsequently validated tokens, with no compiler or type-level signal
  connecting the two sites.
- **Confidence:** High
- **Related:** PRD C-002 (same divergence-risk shape, for `expiresAt`
  rather than `tokenHash`)

### IF-002 — The shipped frontend never invokes the session-revoking logout endpoint

- **Source:** architecture-discovery
- **Status:** Open
- **Observation:** `frontend/lib/api.ts` defines a client function for
  `POST /auth/logout`, but no code path in the frontend calls it. The UI's
  logout action clears client-side storage and navigates away without
  making a network request.
- **Evidence:** `frontend/lib/api.ts:143` (`logout: () => api<{ success:
  boolean }>('/auth/logout', { method: 'POST' })`). Repo-wide search for
  `authApi.logout` and `\.logout(` across `frontend/` returns only this
  definition and the unrelated local `logout` closure in
  `frontend/lib/useAuth.ts:62-68`, which performs
  `localStorage.removeItem('token')`,
  `localStorage.removeItem(BACK_TO_ADMIN_KEY)`, and `router.push('/')` —
  no `fetch`/`api()` call of any kind. The endpoint this bypasses is
  correct in isolation: `backend/src/auth/auth.controller.ts:234-245`
  (`POST /auth/logout`, `@UseGuards(JwtAuthGuard, SessionGuard)`) calls
  `SessionsService.deleteSessionByToken()` on the presented token, and
  session `expiresAt` is set to 7 days from creation
  (`backend/src/auth/auth.service.ts:446-447`).
- **Impact:** A user who logs out through the product's own UI does not
  cause the backend to delete the corresponding `user_sessions` row. The
  same token, if retained or replayed (e.g. recovered from browser storage
  before the client-side clear), continues to authenticate against
  `SessionGuard` until its 7-day `expiresAt` or an unrelated password
  reset — the backend endpoint that would prevent this
  (`POST /auth/logout`, guarded, deletes on call) is correct in isolation
  but is not reachable from the shipped product surface.
- **Confidence:** High
- **Related:** PRD FC-007, G-002, US-001
