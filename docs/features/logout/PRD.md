# Logout

| Field | Value |
|---|---|
| Status | Draft |
| Mode | Existing Feature |
| Discovery | Initial |
| Confidence | Low |
| Owner | |
| Last updated | 2026-07-27 |
| Slug | PRD-Logout |

## Overview

Logout is the user-facing action, triggered from the header menu or a
protected-route redirect, that ends a signed-in session. The mechanism it
relies on — deleting the backing `user_sessions` record so the presented
token stops granting access — is `PRD-SessionManagement`'s FR-003, not
restated here. This PRD scopes what is specific to Logout as a feature: where
the user triggers it, and what the client does in response.

## Current Behavior

- `useAuth().logout()` (`frontend/lib/useAuth.ts:62-68`) removes `token` and
  `back_to_admin` from `localStorage`, resets in-memory `user`/`impersonating`
  state, and navigates to `/`. It does not distinguish whether an
  impersonation (`back_to_admin` present) was active — both keys are cleared
  and the destination is `/` either way.
- `logout()` has more than one caller. The header menu
  (`frontend/components/Header.tsx:391`) is the primary, user-initiated
  trigger this PRD scopes to. It is also called internally by
  `returnToAdmin()` (`useAuth.ts:97-102`) when no `back_to_admin` token is
  present — reachable from the "Return to Admin Account" button
  (`frontend/components/ImpersonationBanner.tsx:17-21`). A third path,
  `returnToAdmin()`'s error branch (`useAuth.ts:111-117`), performs the same
  clearing but navigates to `/login`, not `/`. The banner is shown/hidden
  based on `back_to_admin`'s presence at mount and on a same-tab
  `auth:changed` event only (no cross-tab `storage` listener), so a logout in
  one tab can leave the banner rendered in another against already-cleared
  storage; clicking it there falls through to this same `logout()` path. See
  A-001, C-001, Q-005.
- **`logout()` makes no network request.** `frontend/lib/api.ts:143` defines
  `authApi.logout()` against `POST /auth/logout`, but no code path in
  `frontend/` calls it — confirmed independently while producing this PRD,
  matching `PRD-SessionManagement`'s FC-007 finding. The session row backing
  the cleared token is not deleted by this action.
- `POST /auth/logout`'s own behavior (deleting the `user_sessions` row for
  the presented token) is `PRD-SessionManagement`'s FR-003; this PRD does not
  restate it.
- No confirmation step (e.g. a dialog) precedes logout in the current UI —
  the header menu action fires `logout()` directly.
- Protected routes redirect to `/` on an auth failure (`refreshUser()`'s
  catch branch, `useAuth.ts:42-48`, and `requireAuth` handling) — this clears
  the same `token`/`back_to_admin` keys but is a *response to* an already
  invalid session, not a user-initiated logout call; whether this shares
  enough behavior with FR-001 below to be considered the same requirement or
  a separate one is Q-002.

## Problem Statement

A signed-in user needs a way to end their session from the client — clearing
local credentials and returning to a logged-out view — whether they choose to
do so or land there after their access stops being valid. Today that
client-side action does not reach the backend mechanism
(`PRD-SessionManagement` FR-003) that would actually revoke the session
server-side, so the two halves of "logging out" are disconnected.

## Goals

- G-001: A user can end their signed-in client state (locally-held token
  cleared, redirected to a logged-out view) from the header menu at any time
  while authenticated.
- G-002: Logout leaves no locally-held credential fragment that still grants
  access to the account or an impersonated session. Today this is achieved by
  clearing `back_to_admin` together with the primary token unconditionally
  (Current Behavior) — whether that is the right mechanism during an *active*
  impersonation, where `back_to_admin` is the only remaining route back to the
  admin account (see Q-001), is unresolved, not asserted here as correct.

## Non Goals

- Server-side session revocation semantics (session record deletion, 401 on
  reuse) — owned by `PRD-SessionManagement` FR-003/FC-007/G-002/US-001; this
  PRD does not re-derive them.
- Ending impersonation via `POST /auth/end-impersonation` and
  `returnToAdmin()`'s **success path** — a separate flow from logout,
  not covered here. `returnToAdmin()`'s **fallback to `logout()`** (no
  `back_to_admin` token present, or the end-impersonation call fails) is in
  scope as one of this feature's trigger points — see Current Behavior,
  A-001, C-001.
- "Log out of all devices" / multi-session management — not found in the
  current implementation; tracked as `PRD-SessionManagement` Q-002/Q-003.

## Users / Actors

| Actor | Type | Description |
|---|---|---|
| Account Holder | Human | A signed-in user who triggers logout via the header menu, or is redirected to a logged-out view after an auth failure |
| Auth Client | System | `useAuth()` hook (`frontend/lib/useAuth.ts`) — owns clearing local credential state and navigation on logout |

## User Stories

- US-001: As an account holder, I want to end my session from the header
  menu, so that my locally-held credential is cleared and I return to a
  logged-out view. **Does not currently guarantee the shared-device
  security outcome** ("no one else can use my session after I leave") — the
  server-side session remains valid and would still authenticate a replayed
  token; see FC-001, `PRD-SessionManagement` FC-007.
- US-002: As an account holder, I want logout to clear any impersonation
  state along with my token, so that a stale `back_to_admin` marker doesn't
  persist after I log out.

## Functional Requirements

### FR-001: Clear local session state and redirect on logout

- **Description:** The system must, when the account holder triggers logout,
  remove the locally-held access token and any impersonation marker, and
  navigate the user to a logged-out view.
- **Actor:** Account Holder (via Auth Client)
- **Priority:** Must
- **Acceptance Criteria:**
  - Given a signed-in user, when they trigger logout from the header menu,
    then the locally-held token and `back_to_admin` marker are removed and
    the user is navigated to `/`.
  - Given a signed-in user with an active impersonation marker, when they
    trigger logout, then the impersonation marker is removed along with the
    token (see Q-001 for whether this is the intended outcome versus routing
    through end-impersonation first).
  - Given `returnToAdmin()` falls through to `logout()` (no `back_to_admin`
    token present, or the end-impersonation call fails), when that path
    executes, then the same local-state clearing occurs — noting the error
    branch (`useAuth.ts:111-117`) navigates to `/login` rather than `/`, a
    destination inconsistency this criterion records but does not resolve
    (see Q-005).
- **Related:** US-001, US-002, G-001, G-002

## Failure Conditions

### FC-001: Client-side logout does not revoke the server-side session

- **Applies to:** FR-001
- **Condition:** `logout()` clears local state and redirects without calling
  `POST /auth/logout`, so the `user_sessions` record backing the cleared
  token is never deleted.
- **Expected behavior:** Not currently defined by the product. Concretely:
  the token remains valid server-side and would still authenticate requests
  if replayed, until its natural 7-day expiry or an unrelated password reset
  — this is `PRD-SessionManagement`'s FC-007, restated here only to record
  that it is this feature's own trigger point that fails to close the loop.
  Whether this is a defect or an intentional training gap is
  `PRD-SessionManagement` Q-011, not re-opened here.

## Non Functional Requirements

None measurable at this time — no threshold exists today for logout
responsiveness or reliability. See Open Questions.

## Business Rules

None specific to this feature. Session revocation semantics (BR-001) belong
to `PRD-SessionManagement`.

## Data Requirements

| Entity | Owned by | Retention | Sensitivity |
|---|---|---|---|
| Locally-held token / `back_to_admin` marker (browser `localStorage`) | this feature (client-side lifecycle only) | Cleared on logout action; the server-side `user_sessions` record it corresponds to is owned by `PRD-SessionManagement` | Internal — a bearer credential while present |

## Integration Requirements

| System | Direction | Purpose | Criticality |
|---|---|---|---|
| Session Management (`PRD-SessionManagement`) | outbound (intended, not realized) | `POST /auth/logout` (FR-003 there) is meant to be called on logout to revoke the server-side session; today it is not called — see FC-001 | degraded (feature functions client-side without it, but its own revocation guarantee is unmet) |

## Constraints

- C-001: `useAuth().logout()` is the sole client-side implementation of the
  clearing behavior this feature relies on. It has three reachable call
  sites: the header menu (primary, user-initiated), `returnToAdmin()`'s
  fallback path, and `returnToAdmin()`'s error branch (which redirects to
  `/login` instead of `/`) — see Current Behavior. The protected-route
  auth-failure redirect performs equivalent clearing but is a distinct
  trigger (a reaction to an already-invalid session, not a logout call).
- C-002: This PRD's Overview, Non Goals, FC-001, Business Rules, Data
  Requirements, and Integration Requirements reference
  `PRD-SessionManagement` requirement IDs (FR-003, FC-007, G-002, US-001,
  Q-011, BR-001) rather than restating their content. `PRD-SessionManagement`
  is currently Status: Review, Confidence: Low, with open questions (Q-001,
  Q-006) that could change its FR set. This PRD's cross-references are only
  as stable as that document; see A-002.

## Assumptions

| ID | Assumption | Impact if wrong | Owner |
|---|---|---|---|
| A-001 | The three call sites recorded in Current Behavior/C-001 (header menu, `returnToAdmin()` fallback, `returnToAdmin()` error branch) are the complete set of `logout()` triggers in the shipped frontend — verified via a repo-wide search for `logout` and `useAuth` usages, not file-by-file reading (this corrects an earlier, narrower inspection that missed the two `returnToAdmin()` paths) | If another call site exists that this search did not surface, Current Behavior and FR-001's acceptance criteria are incomplete | |
| A-002 | `PRD-SessionManagement`'s referenced IDs (FR-003, FC-007, G-002, US-001, Q-011, BR-001) remain stable while this PRD is in Draft/Review | If `PRD-SessionManagement` changes those IDs' meaning or retires them before this PRD is finalized, this PRD's cross-references (Overview, Non Goals, FC-001, Business Rules, Integration Requirements) would point at stale or incorrect content — see C-002 | |

## Open Questions

| ID | Question | Blocks | Owner | Status |
|---|---|---|---|---|
| Q-001 | Should logout with an active impersonation (`back_to_admin` present) route through end-impersonation semantics first, or is clearing both markers together (current behavior) the intended outcome? | FR-001, G-002 | | open |
| Q-002 | Is the protected-route auth-failure redirect (clearing the same keys, navigating away on a failed `/users/me` check) considered part of this feature, or a separate mechanism that happens to share client-side cleanup code? | Non Goals, Current Behavior | | open |
| Q-003 | Is there a confirmation step planned for logout, or is immediate action on click the intended UX? | FR-001 | | open |
| Q-004 | Should `logout()` be wired to call `POST /auth/logout` (closing FC-001 / `PRD-SessionManagement` FC-007), and if so, should the client wait for that call before clearing local state and redirecting, or clear optimistically regardless of the call's outcome? | FC-001 | | open |
| Q-005 | `returnToAdmin()`'s error branch clears the same local state as `logout()` but redirects to `/login` instead of `/` (Current Behavior). Is this destination difference intentional, or should both paths converge on the same logged-out route? | FR-001 | | open |
| Q-006 | Is the header-menu logout button intentionally available/enabled during an active impersonation? If so, G-002's current unconditional-clear behavior strands the admin (no remaining route back to the admin account other than re-authenticating) — this is a genuine product question, not only a wording question, and bears on whether G-002/Q-001 describe a defect or an accepted tradeoff. | G-002, Q-001 | | open |
| Q-007 | Is `PRD-SessionManagement` (Status: Review, Confidence: Low as of this writing) expected to reach Done before this PRD leaves Draft, given C-002/A-002's dependency on its ID stability? | C-002, A-002 | | open |

## Success Metrics

Not measured today. No logout-specific metric (logout rate, time-to-redirect)
is currently instrumented.

## Architecture Impact

- Requirements likely to drive decisions: FC-001 (whether/how to wire the
  client to `POST /auth/logout`, and whether that call should be
  synchronous-blocking or fire-and-forget relative to the redirect) — this is
  the same integration gap `PRD-SessionManagement` records as FC-007/Q-011,
  viewed from the client trigger side.
- Suspected new components or boundaries: None — `useAuth()` and
  `authApi.logout()` already exist; closing FC-001 is a wiring change, not a
  new boundary.
- Known architectural risk: None beyond what `PRD-SessionManagement` already
  records (FC-007).
