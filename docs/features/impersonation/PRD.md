# Impersonation (Admin → User)

| Field | Value |
|---|---|
| Status | Draft |
| Mode | Existing Feature |
| Discovery | Initial |
| Confidence | High (observed behavior, read directly from source) / Low (product intent on every open question — this feature sits at the intersection of three other PRDs' unresolved boundaries) |
| Owner | |
| Last updated | 2026-07-29 |
| Slug | PRD-Impersonation |

## Overview

Impersonation lets an admin act as another user's account — without that
user's password — by exchanging their own admin session for a session as
the target user, plus a short-lived token to restore the admin session
afterward. It exists so admins/QA can reproduce and verify user-facing
behavior without needing user credentials.

This feature sits downstream of three already-produced PRDs/ADRs that
already analyze parts of its mechanism in detail: `PRD-SessionManagement`
(session revocation model, and its own open FR-005/Q-006 naming this
feature), `ADR-0011` (the `end-impersonation` authentication boundary,
Proposed), `ADR-0016` (denying admin authority to impersonated sessions,
Accepted), `PRD-TwoFactorAuth` (this feature's 2FA-bypass behavior,
already discovered there), and `PRD-Logout` (the `returnToAdmin()` call
sites that fall through to `logout()`). This PRD references all five
rather than re-deriving their content, and does not resolve any question
one of those five documents already owns on its own. **Corrected (Delta
Review round 1) — this stance is narrower than "does not resolve any of
their open questions," which no longer matches this document's body.**
Two questions those five documents name but leave unowned by any of
them — the restore token's lifetime policy, and the fallback-free
stranding gap once a demoted admin's restore is refused — are explicitly
claimed by this PRD instead of left implied (Non Functional Requirements,
FC-007/FC-008, Q-001a/Q-001b), since leaving an unowned question
unclaimed is a different failure than re-deciding an owned one.

## Current Behavior

Read directly from source (`backend/src/auth/auth.controller.ts:215-232`,
`backend/src/auth/auth.service.ts:457-518`,
`backend/src/auth/jwt.strategy.ts`, `backend/src/auth/guards/admin.guard.ts`,
`backend/src/auth/session.guard.ts`, `backend/prisma/schema.prisma:78-90`,
`frontend/lib/useAuth.ts`, `frontend/components/ImpersonationBanner.tsx`,
`frontend/app/admin/impersonate/page.tsx`), per this plan's
inventory-primary rule (inventory entry at `FEATURES_INVENTORY.md:175-188`
consulted first; source read to verify architecture, resolve the
Definition-of-Ready open questions, and — per explicit instruction —
trace the full lifecycle before any requirement was drafted).

- **Starting impersonation: `POST /auth/impersonate`, gated by
  `JwtAuthGuard, SessionGuard, AdminGuard`** (`auth.controller.ts:215-216`),
  body `{ targetUserId }` (UUID, `impersonate.dto.ts`). `impersonate()`
  (`auth.service.ts:457-495`) re-checks the caller's role fresh from the
  DB (`admin.role !== 'admin'` → `401`) and that the target user exists
  (`404`-equivalent `401` if not) — consistent with `PRD-AdminRoleGuards`'s
  documented guard model.
- **A new session is created for the target user; the admin's own session
  is untouched.** `impersonate()` calls `sessionsService.createSession()`
  for the *target* user's new impersonated JWT — a full 7-day session,
  identical in kind to an ordinary login session (`JWT_EXPIRY = '7d'`,
  `auth.service.ts:53`). It performs **no operation of any kind** on the
  admin's own `user_sessions` row — that row remains live, unexpired, and
  fully usable via `JwtAuthGuard`+`SessionGuard` (with its own original
  JWT) for the entire impersonation window, and for its own remaining
  7-day lifetime regardless of whether impersonation is later ended. This
  exact fact is independently confirmed and analyzed in depth by
  `ADR-0011`'s Context section — not re-derived here.
- **Two tokens are returned, of different kinds.** `access_token` is an
  ordinary session-backed JWT for the target user, with one addition: its
  payload carries `impersonatedBy: <adminId>` (`auth.service.ts:471-475`).
  `backToAdminToken` is a **separate, non-session-backed** JWT
  (`{ sub: adminId, purpose: 'back_to_admin' }`, `auth.service.ts:484-487`)
  with a 1-hour expiry (`BACK_TO_ADMIN_EXPIRY = '1h'`, `auth.service.ts:55`)
  — no `user_sessions` row, no other server-side record, backs it at all.
- **Ending impersonation: `POST /auth/end-impersonation` has no
  `@UseGuards` decorator of any kind** (`auth.controller.ts:226-232`).
  Authentication is performed entirely inline inside
  `endImpersonation()` (`auth.service.ts:497-518`): verify the
  `backToAdminToken`'s JWT signature/expiry, check `purpose ===
  'back_to_admin'`, look up the subject and re-check `role === 'admin'`
  fresh. There is no session lookup, no nonce, no single-use marker — the
  token can be redeemed more than once within its 1-hour window. This
  entire mechanism, including its relationship to the identical pattern on
  `POST /auth/2fa/verify`, is `ADR-0011`'s subject; this PRD states the
  observed behavior and defers the "should this change" question to that
  ADR rather than re-analyzing it.
- **Ending impersonation does not invalidate the target user's
  impersonated session.** `endImpersonation()` only mints a fresh session
  for the *admin* (`issueTokenAndSession(admin)`, `auth.service.ts:517`) —
  it never deletes or otherwise touches the target user's `user_sessions`
  row created when impersonation started. That row remains valid,
  independent of the frontend's client-side token swap, until its own
  natural 7-day expiry. **This is `PRD-SessionManagement`'s own FR-005**
  ("Invalidate the impersonated session when impersonation ends"),
  recorded there as "Not currently implementable as specified — blocked,
  not merely unbuilt," and that PRD's **Q-006 asks, unresolved, whether
  closing this gap is `PRD-SessionManagement`'s responsibility or this
  PRD's.** This PRD does not answer Q-006 — see Open Questions.
- **No database field records impersonation linkage on the *session*
  itself.** `UserSession` (`schema.prisma:78-90`) has no `impersonated_by`,
  no flag, and no reference of any kind connecting a session to the admin
  who created it via impersonation, or marking a session as
  impersonation-derived at all. **This directly contradicts the
  inventory's claim** ("Database: `user_sessions` tracks impersonation
  state," `FEATURES_INVENTORY.md:186`). **Precision correction (Full
  Review round 1) — this is narrower than "never persisted anywhere,"
  which the prior draft of this bullet incorrectly stated.** Impersonation
  provenance *is* persisted, but only as opt-in, per-action audit
  metadata on financial writes, not as session state: the deposits,
  orders, and wallets controllers each build `{ performedByAdmin: true,
  adminId: user.impersonatedBy }` off the same claim
  (`deposits.controller.ts:43-44,101-102`, `orders.controller.ts:28-29,
  58-59`, `wallets.controller.ts:43-44,60-61`), which `WalletsService`
  writes into `balance_transactions.metadata`
  (`wallets.service.ts:370`) — a fact `ADR-0016`'s own Consequences
  section states directly. This is a **coverage asymmetry**, not an
  absence: financial state-changing routes attribute impersonated actions;
  the impersonation session itself, and non-financial routes, do not. See
  Q-007 (corrected) and Q-009 for the inventory-correction question this
  raises.
- **`AdminGuard` does not check the `impersonatedBy` claim.**
  `admin.guard.ts:8-20` rejects only on `!user` or `user.role !==
  'admin'`; it has no condition on `request.user.impersonatedBy`. Since
  `impersonate()` performs no check preventing an admin from targeting
  another admin account (see below), an admin impersonating another admin
  retains full `AdminGuard`-gated authority for the duration of that
  impersonation, under current code. **`ADR-0016` (Accepted)** decided
  this should not be the case — its Decision section specifies adding
  exactly this check to `AdminGuard` — but the guard's current source, as
  read directly for this PRD, does not yet contain it. This PRD records
  the gap as **Accepted (by ADR-0016) + Not Yet Implemented**, the same
  status pattern `PRD-AdminUserCreation` recorded for `ADR-0018`; it does
  not re-argue the decision itself.
- **No server-side check prevents self-impersonation or
  impersonating another admin.** `impersonate()` (`auth.service.ts:
  457-495`) validates only that the caller is an admin and the target
  exists — it does not compare `targetUserId` to the caller's own id, and
  it does not check the target's `role`. The frontend blocks both cases
  only in the UI: self-impersonation is rejected client-side
  (`frontend/app/admin/impersonate/page.tsx:41-44`, "You cannot
  impersonate yourself"), and the admin-targeting case is not filtered
  from the user list shown at all — nothing in `page.tsx` excludes
  admin-role rows from the picker. A direct API call bypasses both.
- **Impersonation unconditionally bypasses the target account's 2FA.**
  `impersonate()` issues a full session with no `is2FaEnabled()` check of
  any kind. **This is not a new finding of this PRD** — `PRD-TwoFactorAuth`
  already discovered and recorded this exact fact (its retired A-002,
  FC-006, FC-010), and that PRD's **Q-003 already asks, unresolved,
  whether this is an intended safety valve or a gap that should require
  step-up handling.** This PRD references that question rather than
  re-opening it under a new ID.
- **Frontend token handling.** `impersonate()` (`useAuth.ts:70-95`) stores
  `backToAdminToken` under a fixed `localStorage` key
  (`back_to_admin`) and overwrites the `token` key (previously the admin's
  own token) with the impersonated user's `access_token` — a **client-side
  discard**, not a server-side invalidation; the admin's original token
  remains valid against its still-live session the whole time, as noted
  above. Both the impersonated token and `backToAdminToken` then coexist in
  the same `localStorage` origin for the rest of the impersonation window
  — the exact condition `ADR-0011`'s Risks section names as the dominant
  client-side compromise vector, and which none of that ADR's adopted
  options close.
- **`returnToAdmin()`'s three paths are already documented by
  `PRD-Logout`, not re-derived here**: when no `back_to_admin` token is
  present, it falls through to `logout()` (`useAuth.ts:99-102`); on a
  failed `end-impersonation` call, it clears local state and redirects to
  `/login` (`useAuth.ts:111-116`) — a different destination than
  `logout()`'s redirect to `/`, which `PRD-Logout`'s Q-005 already asks
  about; on success, it stores the new admin `access_token` and clears
  `impersonating` state (`useAuth.ts:119-124`).
- **UI**: `ImpersonationBanner` renders "You are currently logged in as
  `<email>`" with a "Return to Admin Account" button whenever a
  `back_to_admin` token is present in `localStorage`
  (`ImpersonationBanner.tsx`), mounted globally in the app layout
  (`frontend/app/layout.tsx:36`). **Correction (Full Review round 1) —
  this does not match the inventory's description**, which was
  incorrectly certified as matching in an earlier draft of this bullet:
  the inventory describes a "user dropdown" indicator
  (`FEATURES_INVENTORY.md:187`); the shipped UI is a full-width banner,
  not a dropdown. See widened Q-009.
  `/admin/impersonate` lists users via `usersApi.list(search)` with a
  per-row "Impersonate" action; listing/searching users is otherwise
  `PRD-AdminUserList`'s territory (backlog #13, not yet produced) and is
  treated here only as the entry point to this feature's action, not
  specified in its own right.

## Problem Statement

An admin (or QA engineer acting as one) who needs to reproduce or verify a
specific user's experience — a reported bug, a support request, a training
exercise — cannot do so without that user's password, and creating a
temporary shared credential is worse for audit and safety than a
purpose-built path. Nothing in the inventory documents how frequently this
is used or by whom in practice; this PRD does not invent that context.

## Goals

- G-001: An admin can begin acting as any target user's account without
  needing that user's password, and can end that and return to their own
  admin session.
- G-002: While impersonating, the system clearly signals to the admin
  (in the UI) that they are acting as another user, and offers a direct
  path back to their own account.

## Non Goals

- Redesigning the `end-impersonation` authentication boundary (guard
  presence, single-use enforcement, token binding strength) — that
  decision belongs to `ADR-0011`, which already evaluates it in depth; this
  PRD states the current behavior and does not re-litigate the ADR.
- Deciding whether `AdminGuard` should deny authority to impersonated
  sessions — already decided by `ADR-0016` (Accepted); this PRD records
  its current (not-yet-implemented) status, not a second decision.
- Closing the impersonated-session-not-revoked-on-end gap
  (`PRD-SessionManagement` FR-005) — ownership between that PRD and this
  one is itself the open `PRD-SessionManagement` Q-006; this PRD does not
  claim it unilaterally.
- Deciding whether impersonation's unconditional 2FA bypass is acceptable
  — already an open question owned by `PRD-TwoFactorAuth` (Q-003); not
  re-opened here.
- User/account listing, search, or pagination on the impersonation picker
  page — that surface belongs to `PRD-AdminUserList` (backlog #13, not yet
  produced); this PRD treats the picker only as this feature's entry
  point.
- Correcting `FEATURES_INVENTORY.md`'s stale claims about this feature —
  **widened (Delta Review round 1) from the single "database tracks
  impersonation state" line to all four divergences Q-009 now lists** (UI
  description, request body field name, audit-trail claim, and the
  database claim) — recorded as Q-009 (a documentation-maintenance
  question), not performed as a side effect of writing this PRD.

## Users / Actors

| Actor | Type | Description |
|---|---|---|
| Admin | Human | Holds an authenticated session with `role = 'admin'`; starts and ends impersonation of a target user. |
| Target user | Human | The account being impersonated; not an active participant. **Corrected (Full Review round 1) — this was previously stated as settled fact; it is current, observed behavior with open questions attached, not a design decision. Further corrected (Delta Review round 1) — the specific 2FA risk named below was wrong; restated against the actual mechanism.** No mechanism currently notifies the target user during or after impersonation (Q-011). Routes guarded only by `JwtAuthGuard`/`SessionGuard` (not `AdminGuard`) mean an impersonated session can reach `2fa/setup` and `2fa/enable` — **enrolling a new 2FA method on the target's account**, not disabling an existing one (`disable()` requires the caller to already supply a valid TOTP code or unused backup code, `two-factor.service.ts:96-139`, which an impersonator without the target's authenticator cannot produce). `ADR-0016`'s Context section names this enrollment scenario explicitly ("an admin impersonating any account … could enroll a new 2FA method on that account") as "a real residual risk this decision does not close, since it isn't an `AdminGuard` question at all" (see Q-012). |
| Backend (`AuthService`, guards) | System | Validates the impersonation request, issues/redeems tokens, creates/reads sessions. |

## User Stories

- US-001: As an admin investigating a user-reported bug, I want to act as
  that user's account without needing their password, so that I can see
  exactly what they see.
- US-002: As an admin who is done impersonating, I want a clear, one-click
  way back to my own admin account, so that I don't have to log in again.
- US-003: As an admin currently impersonating, I want the UI to make it
  obvious I'm not acting as myself, so that I don't mistake the target
  user's account for my own.

## Functional Requirements

### FR-001: Start impersonating a target user

- **Description:** The system must let an authenticated admin begin acting
  as a target user's account, given only the target's user ID.
- **Actor:** Admin
- **Priority:** Must
- **Acceptance Criteria:**
  - Given a valid admin session and an existing target user ID, when
    `POST /auth/impersonate` is called, then a new session and access
    token are issued for the target user, and a separate restore token is
    returned to the caller.
  - Given a target user ID that does not exist, when impersonation is
    attempted, then the request is rejected and no session is created.
- **Governed by:** BR-001
- **Related:** US-001, G-001, FC-001, FC-002, FC-009

### FR-002: End impersonation and restore the admin session

- **Description:** The system must let the holder of a valid restore token
  exchange it for a fresh session as the original admin.
- **Actor:** Admin
- **Priority:** Must
- **Acceptance Criteria:**
  - Given a valid, unexpired restore token whose subject is still an
    admin, when `POST /auth/end-impersonation` is called, then a fresh
    admin session and access token are issued.
  - Given an invalid, expired, or malformed restore token, when
    end-impersonation is attempted, then the request is rejected and no
    session is issued.
- **Related:** US-002, G-001, FC-003, FC-004, FC-007, FC-008

### FR-003: Signal impersonation state in the UI

- **Description:** The system must make it visually clear to an admin,
  throughout an active impersonation, that they are acting as a different
  account, and must offer a direct control to end it.
- **Actor:** Admin
- **Priority:** Must
- **Acceptance Criteria:** Per BR-002, "active impersonation" means both
  conditions hold together — `back_to_admin` present, and the current
  `token`'s `/users/me` check has succeeded — not either alone (see
  BR-002 for the two other candidate meanings, target-session-live and
  restore-token-valid, that diverge from this in ordinary use, and
  FC-010 for the specific divergence cases this creates).
  - Given `back_to_admin` is present in this tab's `localStorage` and the
    current `token`'s `/users/me` check has succeeded, when any page is
    viewed, then a banner displays the impersonated user's email (sourced
    from that `/users/me` response, not from any impersonation-specific
    record) and a "Return to Admin Account" control.
  - Given `back_to_admin` is absent from this tab's `localStorage`, or the
    current `token`'s `/users/me` check has failed, when any page is
    viewed, then no such banner is displayed.
- **Related:** US-003, G-002, FC-010

## Failure Conditions

### FC-001: Caller is not an admin

- **Applies to:** FR-001
- **Condition:** The `POST /auth/impersonate` caller's role is not
  `admin` (checked fresh against the DB, not from the JWT alone).
- **Expected behavior:** The request is refused; no session is created for
  any target user.

### FC-002: Target user does not exist

- **Applies to:** FR-001
- **Condition:** The submitted `targetUserId` does not correspond to any
  existing user.
- **Expected behavior:** The request is refused; no session is created.

### FC-009: Admin targets their own account (added, Full Review round 1 — gives Q-002 a real anchor)

- **Applies to:** FR-001
- **Condition:** `targetUserId` equals the calling admin's own id.
- **Expected behavior:** **Not established as a server-side behavior.**
  `impersonate()` performs no comparison of `targetUserId` against the
  caller's own id (Current Behavior) — only the frontend UI blocks this
  case ("You cannot impersonate yourself",
  `frontend/app/admin/impersonate/page.tsx:41-44`), so a direct API call
  bypasses it and a redundant session plus a self-referential restore
  token would be created. Unlike FC-006/Q-003 (admin-targets-admin),
  **no ADR currently addresses this specific case** — see Q-002.

### FC-010: Banner state diverges from actual impersonation state (added, Full Review round 1; condition corrected Delta Review round 1)

- **Applies to:** FR-003
- **Condition:** Per BR-002's (corrected) two-condition definition, the
  banner still tracks only client-visible state — never the restore
  token's own validity — which can diverge from the other two candidate
  meanings of "active impersonation" in at least two documented,
  reachable ways: (a) **cross-tab staleness, narrower than first
  recorded** — `PRD-Logout`'s Current Behavior notes the banner updates
  only on mount and on a same-tab `auth:changed` event, with no cross-tab
  `storage` listener; **correction (Delta Review round 1):** `useAuth.ts`
  also re-runs `refreshUser()` on every `pathname` change
  (`useAuth.ts:52-54`), so a stale banner in another tab clears on that
  tab's next client-side navigation, not only on a full remount — the
  staleness window is real but shorter-lived than originally stated; (b)
  **expired restore token** — per FC-007, the banner and its "Return to
  Admin Account" button continue rendering normally after the 1-hour
  restore window closes (BR-002's condition (2) checks the *impersonated*
  token against `/users/me`, which still succeeds; it does not check the
  *restore* token), with nothing to indicate the button no longer works
  until it is pressed.
- **Expected behavior:** **Not established for either sub-case.** Per
  BR-002's definition, neither is a violation of FR-003 as clarified (the
  banner is doing exactly what it's defined to do) — but both mean the
  banner's implied promise ("this control will return you to your admin
  account") is not always true. Whether the banner should reflect
  restore-token validity (tying it to FC-007/Q-001a's resolution) or
  cross-tab state is an open product question, not decided here.

### FC-003: Restore token invalid, expired, or malformed

- **Applies to:** FR-002
- **Condition:** The `backToAdminToken` fails signature verification, has
  expired, or its `purpose` claim is not `back_to_admin`.
- **Expected behavior:** The request is refused with no admin session
  issued. The precise mechanics of this check, and whether it should
  change (guard placement, single-use enforcement, additional binding),
  are `ADR-0011`'s subject — not re-specified here.

### FC-004: Restore token's subject is no longer an admin

- **Applies to:** FR-002
- **Condition:** The account named in the restore token's `sub` claim no
  longer has `role = 'admin'` at redemption time (e.g. role was revoked
  between impersonation start and end).
- **Expected behavior:** The request is refused with no admin session
  issued. **Consequence added (Full Review round 1) — the refusal itself
  was previously stated with no downstream effect recorded.** This
  leaves the admin stranded in the impersonated session with no working
  route back — see FC-008, which claims this scenario's ownership since
  `ADR-0016` names it as currently unowned by any ADR.

### FC-005: Target's impersonated session outlives the impersonation (gap, not a defect this PRD asks to fix)

- **Applies to:** (system-level)
- **Condition:** After `end-impersonation` succeeds, the target user's
  session record from FR-001 remains valid and unrevoked.
- **Expected behavior:** **Not established — recorded as a gap, per
  `PRD-SessionManagement` FR-005/Q-006, not resolved by this PRD.** See
  Open Questions Q-001.

### FC-006: Impersonated session retains admin authority when the target is also an admin (gap, decided but not yet implemented)

- **Applies to:** (system-level)
- **Condition:** An admin impersonates another admin account.
- **Expected behavior:** Per `ADR-0016` (Accepted), an impersonated
  session should never pass `AdminGuard`, regardless of the target's
  role. Current source does not yet implement that check (see Current
  Behavior). This PRD records the gap; it does not re-decide it.

### FC-007: Restore token expires while the impersonated session is still live (added, Full Review round 1 — this PRD's own gap, not deferred further)

- **Applies to:** FR-002, G-001
- **Condition:** The restore token's fixed 1-hour lifetime
  (`BACK_TO_ADMIN_EXPIRY`) elapses before the admin ends impersonation,
  while the impersonated session itself remains live for up to 7 days
  (`JWT_EXPIRY`). This is ordinary usage crossing an hour, not an error
  condition — nothing informs the admin as the window closes.
- **Expected behavior:** **Not established — this PRD claims the
  question rather than leaving it unowned (see Non Functional
  Requirements, Q-001a).** Today, this state is indistinguishable from
  FC-003 (an already-expired token is rejected the same way regardless of
  cause) — the admin's only recourse is `returnToAdmin()`'s failure branch,
  which clears local state and forces re-authentication
  (`useAuth.ts:111-116`), while the target's session continues unaffected
  for the rest of its own 7-day lifetime.

### FC-008: No fallback path exists once FC-004 refuses the restore (added, Full Review round 1; re-scoped Delta Review round 1 to avoid restating FC-004's trigger)

- **Applies to:** FR-002, G-001
- **Condition:** **Correction (Delta Review round 1) — this FC previously
  restated FC-004's own condition (admin demoted mid-impersonation) with
  a contradictory "not established" verdict on the same trigger FC-004
  already establishes.** FC-004's refusal is not this FC's subject; the
  refusal itself is established (see FC-004). This FC's subject is
  narrower: **after** FC-004 refuses, no mechanism of any kind exists in
  source to let that admin return to their own account other than
  re-authenticating from scratch — no fallback token, no alternate
  restore path, nothing.
- **Expected behavior:** **Not established.** `ADR-0016` names this
  post-refusal gap as "`Q-007` part 2 (stranded `back_to_admin` token)"
  (that ADR's Risks section: *"remains unowned … belongs with
  `end-impersonation`'s redemption logic (`ADR-0011`'s territory) … but
  no ADR currently claims it"*) — and `ADR-0011` does not claim it
  either. Since this directly determines whether this PRD's own G-001
  ("can end that and return to their own admin session") holds, and no
  other document currently owns it, this PRD claims it as its own gap
  rather than leaving it implied — see Q-001b. Note the block is not
  permanent in every case: if the admin is re-promoted to `admin` before
  the restore token's own 1-hour expiry (FC-007), a retry would succeed;
  the gap is the absence of any path back once both have lapsed, not an
  unconditional lockout.

## Non Functional Requirements

None could be established with a measurable threshold from source or the
inventory. **Ownership correction (Full Review round 1):** the restore
token's *redemption mechanics* (guard placement, single-use enforcement,
token binding) are `ADR-0011`'s subject and are not restated here — but
the restore token's **1-hour lifetime itself** is explicitly *not*
addressed by that ADR (its own Assumptions section states the lifetime
"is not being revisited by this ADR") and is explicitly assigned to this
PRD by `PRD-SessionManagement`'s Non Goals ("`backToAdminToken`'s
issuance policy (why it exists, its 1-hour lifetime) — covered by
`PRD-Impersonation`"). This PRD claims that question rather than
deferring it further — see FC-007 and Q-001a, since no third document
will catch it if this one declines it too.

## Business Rules

### BR-001: An impersonated session is a session like any other, with one added claim

- **Rule:** The session and access token issued to a target user during
  impersonation share two mechanical properties with a session issued by
  ordinary login — the same expiry, and the same `user_sessions` row
  shape — plus one addition: the `impersonatedBy` claim in the JWT
  payload. **This rule makes no claim about which guards an impersonated
  session passes** — that is `ADR-0016`'s territory (see FC-006), and is
  deliberately excluded here rather than asserted.
- **Rationale:** `impersonate()` calls the same `sessionsService.
  createSession()` and the same `JWT_EXPIRY` constant `issueTokenAndSession()`
  uses for login/registration (`auth.service.ts:440-455` vs. `:471-482`);
  the only structural difference is the added claim. This is the fact
  `ADR-0016`'s fix and `ADR-0011`'s Option C2 both build on. **Correction
  (Delta Review round 1) — a prior fix pass edited only this Rationale to
  describe the Rule as narrowed, without actually editing the Rule text
  itself; the Rule above has now actually been rewritten to drop "same
  guards apply to it."** That clause was directly falsified by the
  Accepted `ADR-0016` (its Decision makes `AdminGuard` reject any session
  carrying `impersonatedBy`, regardless of role, once implemented).

### BR-002: "Active impersonation" means a `back_to_admin` token present AND the current token's identity check has succeeded — not any server-side state

- **Rule:** For the purpose of the impersonation banner (FR-003), "active
  impersonation" is defined client-side, per-tab, and by **two**
  conditions together, not the `back_to_admin` key alone: (1) that key is
  present in this tab's `localStorage`, **and** (2) the most recent
  `GET /users/me` call made with the current `token` succeeded
  (`useAuth.ts:24-50`). **Correction (Delta Review round 1) — an earlier
  draft of this rule stated condition (1) alone, which a direct test
  falsifies:** if `token` is absent, `refreshUser()` returns early and
  never sets `impersonating` regardless of `back_to_admin`
  (`useAuth.ts:26-31`); if `/users/me` fails for the current `token`,
  `back_to_admin` is actively removed as part of the same failure handler
  (`useAuth.ts:42-48`). The banner itself renders off `impersonating`
  state (`ImpersonationBanner.tsx:8`), not off `localStorage` directly.
  This two-condition definition is **not** equivalent to "the target's
  session is still live" (which can remain true for up to 7 days after
  local state is cleared, per FC-005) nor to "the restore token is still
  valid" (which can become false after 1 hour, per FC-007, while the
  banner and its button keep rendering as if it weren't — condition (2)
  above checks the *impersonated* token against `/users/me`, not the
  *restore* token's own validity).
- **Rationale:** These conditions are the ones a reverse-engineering
  reading of the system could plausibly conflate; keeping them distinct is
  what makes FR-003's acceptance criteria testable at all, and is why
  FC-010 exists — the definition here is a client-side UI state, and its
  divergence from the other two is a documented, reachable condition, not
  a hypothetical.

## Data Requirements

| Entity | Owned by | Retention | Sensitivity |
|---|---|---|---|
| `user_sessions` row for the target user (per impersonation) | this feature (creation) / `PRD-SessionManagement` (ongoing lifecycle, revocation gap tracked as its FR-005) | Same 7-day expiry as any session; not revoked on end-impersonation today (FC-005) | Grants full account access for the target user |
| `backToAdminToken` (in-flight only, never persisted server-side) | this feature | No server-side record exists to retain — see `ADR-0011` | Grants a fresh admin session on redemption |
| JWT `impersonatedBy` claim | this feature (issuance) / read by `JwtStrategy`, `AdminGuard` (pending `ADR-0016`) | Lives inside the signed token for its lifetime; **corrected (Full Review round 1)** — not written to any session-linked table, but **is** copied into `balance_transactions.metadata` (`performedByAdmin`, `adminId`) whenever the impersonated session performs a deposit, order, or wallet-affecting action, opt-in per controller (see Current Behavior) | Signals impersonation provenance for the token's lifetime; additionally persists indefinitely inside financial audit metadata for the subset of actions that record it |

## Integration Requirements

| System | Direction | Purpose | Criticality |
|---|---|---|---|
| `PRD-SessionManagement` (session model, FR-005/Q-006/Q-008) | bidirectional | This feature creates the sessions that PRD's revocation model governs; that PRD's FR-005 names the gap this feature's end-impersonation leaves, with ownership open between the two (Q-006). **Added (Delta Review round 1):** that PRD's Q-008 (open, undrafted Candidate ADR 4) and this PRD's Q-001a both concern the restore token's lifetime, each naming the other as owner per `ADR-0011`'s Assumptions vs. `PRD-SessionManagement`'s Non Goals — Q-001a resolves the mutual pointer by claiming it here. | blocking — FC-005 cannot close without a decision there; Q-001a/Q-008 should not be answered independently in both documents. |
| `ADR-0011` (end-impersonation authentication boundary) | inbound | Governs the exact authentication mechanics of `POST /auth/end-impersonation`; this PRD states current behavior and defers changes to it. | blocking — FC-003/FC-004's precise mechanics track that ADR's Decision, not this PRD. |
| `ADR-0016` (deny admin authority to impersonated sessions) | inbound | Governs whether `AdminGuard` should reject impersonated sessions; Accepted but not yet implemented in source. | blocking — FC-006 depends on that ADR's implementation, not a decision made here. |
| `PRD-TwoFactorAuth` (Q-003, FC-006, FC-010) | inbound | That PRD already discovered and owns the open question of whether this feature's unconditional 2FA bypass is acceptable. | blocking — this PRD does not decide it. |
| `PRD-Logout` (`returnToAdmin()` call sites, Q-006) | inbound | That PRD already documents `returnToAdmin()`'s fallback-to-`logout()` and error-redirect paths; not re-derived here. **Criticality corrected (Full Review round 1) — was rated informational, which understated it.** `PRD-Logout` Q-006 asks whether logging out during active impersonation is intentional, since it unconditionally strands the admin the same way FC-008 does — this directly bears on whether G-001 holds, so it is not merely informational. | blocking — G-001's "can end that and return" is void under both `PRD-Logout` Q-006's scenario and this PRD's own FC-008, neither yet resolved. |
| `PRD-AdminUserList` (not yet produced, backlog #13) | inbound | The user picker this feature's entry point uses for listing/searching target users belongs to that future PRD's scope. | informational — this feature only consumes that surface, doesn't specify it. |

## Constraints

- C-001: Impersonation reuses the existing session/JWT issuance mechanism
  (`issueTokenAndSession()`/`sessionsService.createSession()`) as-is — this
  feature cannot introduce a different session model without diverging
  from every other authenticated flow in the codebase.
- C-002: The restore token (`backToAdminToken`) is currently a plain,
  non-session-backed JWT with no schema-level record — any change to
  *how it is checked at redemption* (single-use marker, session binding)
  is `ADR-0011`'s decision to make, not this PRD's. **Scope correction
  (Full Review round 1):** this does not extend to *how long it is valid
  for* — the 1-hour lifetime is this PRD's own question (Q-001a, FC-007),
  not `ADR-0011`'s, per that ADR's own Assumptions and per
  `PRD-SessionManagement`'s Non Goals.

## Assumptions

| ID | Assumption | Impact if wrong | Owner |
|---|---|---|---|
| A-001 | Impersonation is used by trusted admins for support/debugging/QA purposes in a training sandbox, not as a production-grade account-recovery or security-boundary mechanism — consistent with `PRD-TwoFactorAuth`'s framing of it as "not built for" being a recovery path | If impersonation is relied upon as a hardened security boundary (e.g. for real account recovery), the gaps recorded in FC-003–FC-004 and FC-006–FC-010 are more severe than this PRD treats them. **Extended (Full Review round 1):** this assumption is also what makes Q-011 (target notification) and Q-012 (impersonated-session write-access to target security settings) plausible to leave open rather than fixed — it is not itself an answer to either question. | |

## Open Questions

| ID | Question | Blocks | Owner | Status |
|---|---|---|---|---|
| Q-001 | Cross-reference: is closing the impersonated-session-not-revoked-on-end gap (FC-005) this PRD's responsibility or `PRD-SessionManagement`'s? That PRD's Q-006 asks the identical question and is not resolved here — this PRD does not claim FR-005 unilaterally. | FC-005 | | open (tracked in `PRD-SessionManagement` Q-006) |
| Q-001a | (New, Full Review round 1 — explicitly claimed, not deferred) What is the intended maximum duration of a single impersonation session? Should the restore token's 1-hour lifetime match the impersonated session's 7-day lifetime, be independently renewable, or should an impersonation nearing the restore window's expiry warn the admin before it becomes unusable (FC-007)? This is this PRD's own question — `ADR-0011` explicitly does not address restore-token *lifetime* (only its redemption mechanics), and `PRD-SessionManagement`'s Non Goals name this PRD as the owner of that lifetime/issuance-policy question. **Added (Delta Review round 1) — the ownership claim needs one more layer stated, not suppressed:** `ADR-0011`'s own Assumptions continue past the sentence quoted above to say lifetime-*appropriateness* is left to `docs/features/session-management/DISCOVERY.md` Candidate ADR 4 and that PRD's own **Q-008** (open, undrafted). So two documents each point the lifetime question at the other's owner — `PRD-SessionManagement`'s Non Goals name this PRD, while `ADR-0011`'s Assumptions name `PRD-SessionManagement` Q-008/Candidate ADR 4. This PRD resolves that mutual routing by claiming it here rather than leaving both pointers standing, and flags `PRD-SessionManagement` Q-008 as the question to close or retire once this one is answered, so it isn't answered twice, differently, in two places. | FC-007, G-001, `PRD-SessionManagement` Q-008 | | open |
| Q-001b | (New, Full Review round 1 — explicitly claimed, since `ADR-0016` names it as currently unowned by any ADR) Should ending impersonation be made possible even after the admin's own role changes mid-impersonation (FC-004/FC-008) — e.g. via a fallback that does not depend on the admin still holding `role='admin'` — or is forced re-authentication in that case an accepted outcome? `ADR-0016`'s Risks section names this scenario as "`Q-007` part 2 (stranded `back_to_admin` token) … remains unowned … but no ADR currently claims it" and confirms it belongs with `end-impersonation`'s redemption logic, which `ADR-0011` also does not claim. This PRD claims it here since it directly determines whether G-001 holds. | FC-008, G-001 | | open |
| Q-002 | Should `impersonate()` reject a `targetUserId` equal to the caller's own id at the server layer, rather than relying on the frontend's client-side check? **Corrected (Full Review round 1):** now anchored to FC-009 (previously mis-linked to FC-002, the wrong-condition case). Unlike Q-003's admin-target case, no ADR currently addresses self-impersonation on its own terms. | FC-009 | | open |
| Q-003 | **Corrected to a cross-reference (Full Review round 1) — this was previously written as a new question; it is not.** Should `impersonate()` reject targeting another admin account at the point of starting impersonation? `ADR-0016` (Accepted) already evaluates exactly this as "Option C (A+B combined)" and deliberately defers it, not rejects it: *"not rejected, deferred — Option B alone closes this ADR's named consequences; Option A's additional misattribution-prevention value is real but independently justifiable … Revisit if attribution against admin targets specifically is raised as its own concern."* This PRD does not re-open Option C under a new ID. **Has the trigger fired? (added, Delta Review round 1, since this question was raised but left unanswered):** arguably yes — this PRD's own Q-007 (audit coverage) and Q-008 (excluding admin accounts from the impersonation picker) both raise attribution-against-admin-targets as a concern in their own right, which is the trigger's stated condition. This PRD records that observation rather than deciding it triggers Option C's adoption — that judgment belongs with whoever revisits `ADR-0016`. (See Q-002 for the closely related but distinct self-impersonation case, which no ADR addresses.) | FC-006 | | open (tracked in `ADR-0016` Alternatives Rejected and Deferred — Option C) |
| Q-004 | Cross-reference: is impersonation's unconditional 2FA bypass an intended safety valve or a gap requiring step-up handling? Owned by `PRD-TwoFactorAuth` Q-003, not answered here. | (see `PRD-TwoFactorAuth` Q-003) | | open (tracked externally) |
| Q-005 | Cross-reference: should `end-impersonation` gain a guard, single-use enforcement, and/or impersonated-token binding? Owned by `ADR-0011`, whose Decision already adopts a partial answer (Option A+B+C2); this PRD does not re-open it. | FC-003 | | open (tracked in `ADR-0011`) |
| Q-006 | Cross-reference: should `AdminGuard` deny authority to impersonated sessions? Already decided (`ADR-0016`, Accepted) but not yet implemented in source — this PRD tracks implementation status, not the decision. | FC-006 | | answered-by-decision (implementation pending) |
| Q-007 | **Re-framed (Full Review round 1) — this is a coverage-asymmetry question, not a greenfield one.** Deposit, order, and wallet-affecting actions performed during impersonation already record `performedByAdmin`/`adminId` in `balance_transactions.metadata`, opt-in per controller (see Current Behavior). Nothing records impersonation start/end itself, and nothing attributes non-financial actions (profile changes, 2FA changes, admin-facing routes reached during impersonation) the same way. Should this coverage be extended to impersonation start/end as its own event, and/or to the currently-unattributed action types? **Note:** `ADR-0016`'s Consequences separately state this same audit question (its "`Q-007` part 3," referring to `PRD-AdminRoleGuards` Q-007) "is answered only as to authority, not as to auditing" — that is a different Q-007 in a different document; this PRD's Q-007 is its own, though the two concern related territory. | (would become an FR if answered) | | open |
| Q-008 | Should the impersonation user-picker exclude admin-role accounts from the list shown to the initiating admin, independent of Q-003's server-side-rejection question — i.e. as a UI-level prevention layer? | Non Goals (picker itself belongs to `PRD-AdminUserList`) | | open |
| Q-009 | **Widened (Full Review round 1) — the inventory entry has more than one divergence from source.** `FEATURES_INVENTORY.md:175-188`'s entry for this feature has at least three inaccuracies beyond the database claim, all confirmed against source: it describes the UI as a "user dropdown" indicator (`:187`) when the shipped UI is a full-width banner mounted globally (`frontend/app/layout.tsx:36`, `ImpersonationBanner.tsx`), not a dropdown; it gives the request body as `{ userId }` (`:182`) when the actual field name is `targetUserId` (`impersonate.dto.ts`); and it claims "audit trail in session records" (`:188`) which Current Behavior's corrected finding shows is false as stated (no session-level record exists; only opt-in, per-action financial-write metadata does). Should all of these be corrected together? | (documentation only) | | open |
| Q-010 | (New, Full Review round 1) Cross-reference: `PRD-Logout` Q-006 asks whether the header-menu logout button is intentionally available during active impersonation — since `logout()` unconditionally clears `back_to_admin` alongside the token, using it while impersonating stands the admin exactly as FC-008 describes, but via a different path (voluntary logout instead of a role change). Not resolved here; tracked as `PRD-Logout`'s question, cross-referenced because it bears directly on this PRD's G-001. | G-001 | | open (tracked in `PRD-Logout` Q-006) |
| Q-011 | (New, Full Review round 1) Should a target user ever be notified — at the time, or after the fact — that their account was impersonated? No such mechanism currently exists (Users/Actors, Data Requirements). Under this feature's training-sandbox framing (A-001) the answer may reasonably be "no," but that has not been stated as a decision anywhere prior to this PRD. | Users/Actors | | open |
| Q-012 | **Corrected (Delta Review round 1) — previously named the wrong 2FA capability (disable, which is in practice gated by a code the impersonator cannot produce); restated around enrollment, the capability `ADR-0016` actually names.** Should an impersonated session's ability to enroll a new 2FA method on the target's account (`2fa/setup` + `2fa/enable`, reachable via `JwtAuthGuard`/`SessionGuard` alone, no `AdminGuard`) be restricted? `ADR-0016`'s Context section names this exact scenario as "a real residual risk this decision does not close, since it isn't an `AdminGuard` question at all" — not resolved by that ADR, and not resolved here either. Separately: `ADR-0015` (Accepted) added password step-up to `enable()` specifically against a *hijacked-session* threat model, but is not yet implemented in source (`auth.controller.ts:273-281`, `two-factor.service.ts:57-94` still take only `dto.code`) — and even once implemented, nobody has asked whether an *impersonated* session (the admin's own valid credential, not a hijacked one) is the same threat model that step-up is meant to stop. | Users/Actors | | open |

## Success Metrics

| Metric | Baseline | Target | Source |
|---|---|---|---|
| (unknown) | (unknown) | (unknown) | No usage/audit data found for impersonation start/end (see Q-007) — no metric can currently be sourced. |

## Architecture Impact

- Requirements likely to drive decisions: FC-005 (session-revocation
  ownership, `PRD-SessionManagement` Q-006), FC-006 (`ADR-0016`
  implementation), FC-003/FC-004 (`ADR-0011`'s already-decided
  authentication-boundary mechanics), FC-007/Q-001a (restore-token
  lifetime, claimed by this PRD), FC-008/Q-001b (stranded-token-on-demotion,
  claimed by this PRD, previously unowned by either `ADR-0011` or
  `ADR-0016`), FC-009/Q-002 (self-impersonation, uncovered by any ADR)
- Suspected new components or boundaries: None — reuses existing
  session/JWT issuance, `AdminGuard`, and `JwtStrategy`, all pre-existing;
  consistent with this backlog row's own annotation that the
  token/back-to-admin-flow ADR work was already anticipated (`ADR-0011`
  is that ADR, produced during the Session Management phase rather than
  this one).
- Known architectural risk: this feature's mechanism is described in
  depth, and its main risks already evaluated, by `ADR-0011` (auth
  boundary) and `ADR-0016` (admin-authority leakage) — both Accepted or
  Proposed already. **Corrected (Full Review round 1) — the
  admin-targeting risk is not uncovered.** `ADR-0016` already evaluates
  rejecting admin-targeted impersonation at start time as its Option C
  and deliberately defers it (see Q-003) — this is not a gap the ADR set
  misses, it is a decision already made and parked. The genuinely
  uncovered risk is narrower: **self**-impersonation at start time
  (FC-009, Q-002), which no ADR addresses on its own terms, since
  `ADR-0016`'s Option A/C are framed around admin *targets*, not the
  caller targeting themselves. Whether that narrower gap warrants its own
  ADR, or is a small enough fix to fold into `ADR-0016`'s implementation,
  is an architecture-discovery question, not decided here.
