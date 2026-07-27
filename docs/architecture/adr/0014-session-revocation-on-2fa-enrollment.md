# ADR-0014: Revoke other existing sessions when 2FA is enabled on an account

## Status

Accepted

**Accepted:** 2026-07-27 — verified directly against source (not routed
through a separate `architecture-reviewer` pass, per explicit user
direction to rely on self-verification going forward): confirmed
`deleteAllUserSessions()`'s single existing call site
(`resetPasswordWithCode()`, `auth.service.ts:179`), confirmed no
current-session-preserving revocation method exists in `SessionsService`
today (the gap Option A's Disadvantages and Risks are built on), and
confirmed `SessionGuard`'s authorization check performs no per-request
`is2FaEnabled()` re-evaluation. No material findings against this ADR's
own reasoning.

## Date

2026-07-27

## Context

`TwoFactorService.enable()` (`backend/src/auth/two-factor.service.ts:57-94`)
activates 2FA for an account by writing `enabled: true`, `enabledAt`, and a
fresh set of backup codes to `user_two_factor`. It touches no other table.
In particular, it never calls `SessionsService.deleteAllUserSessions()`, the
one method in this codebase that already exists for exactly this class of
action — revoking every existing session for a user in response to a
sensitive account-state change — and which is currently called from exactly
one site: `AuthService.resetPasswordWithCode()`
(`auth.service.ts:179`), on a successful password reset.

`SessionGuard` (`backend/src/auth/session.guard.ts:27-32`) authorizes a
request by checking only the presented token's hash and expiry against
`user_sessions`; it does not re-evaluate `is2FaEnabled()` per request.
Sessions are valid for up to `JWT_EXPIRY = '7d'`
(`auth.service.ts:53`).

`PRD-TwoFactorAuth` G-001 states the purpose of this feature: "a leaked or
guessed password alone is not sufficient to access the account." As
currently implemented, that guarantee applies only to logins that occur
*after* enrollment. A session token obtained before enrollment — including
one an attacker is already holding at the moment the legitimate account
holder enables 2FA, which is plausibly the exact scenario that motivates
enabling it — continues to authorize every request `SessionGuard` protects,
unaffected by the new second factor, for up to the remainder of that
session's 7-day life. `PRD-TwoFactorAuth` FC-013 records this as an open
failure condition; Q-012 asks whether this ADR's decision should be made
here or as part of session management.

This is a decision for this feature to make, not an inherited one:
`resetPasswordWithCode()` establishes a working precedent for the
*mechanism* (`deleteAllUserSessions()` already exists and is proven in
production use within this codebase), but no ADR or documented policy
states a general rule that every sensitive account-state change revokes
sessions — it is currently one undocumented instance, not a codified
policy this feature is merely failing to follow. Whether 2FA enrollment
specifically should join that precedent is what this ADR decides.

A material complication distinguishes this case from
`resetPasswordWithCode()`'s: password reset is performed by an
*unauthenticated* caller (the request carries no session to preserve), so
revoking every session for that user has no immediate self-effect on the
caller. `enable()` is called by an *authenticated* user acting through
their own current session (`JwtAuthGuard, SessionGuard`,
`auth.controller.ts:273-274`). A blanket "revoke all sessions" applied
here would invalidate the very session the caller used to make the
request, and `SessionsService` (`sessions.service.ts:46`) exposes only a
delete-all method — no "delete all except the current token" variant
exists today.

## Decision Drivers

- **Security boundary integrity** — G-001's stated guarantee should hold
  against a session obtained before enrollment, not only against future
  password-based logins.
- **Consistency with existing precedent** — this codebase already treats
  session revocation as the correct response to one sensitive account-state
  change (`resetPasswordWithCode()`); an unexplained inconsistency between
  that case and this one is itself a documentation and reasoning gap.
- **No degradation of the enrolling user's own experience** — whatever is
  decided must not silently sign out the user in the middle of the action
  they're performing, without an explicit, deliberate call on that
  tradeoff.
- **Training-sandbox scope** — this codebase is `CryptoSandboxQA`
  (`CLAUDE.md`), not a production system; the decision should be
  right-sized to what a QA training sandbox needs demonstrated, not
  engineered for a threat model beyond that.

## Assumptions

- No caller today relies on `enable()` leaving all other sessions for the
  account untouched (e.g. a legitimate concurrent-device workflow that
  would break if this ADR is adopted). Not verified against real usage
  data — this codebase has none — only against the absence of any such
  documented workflow.
- `SessionsService` can be extended with a "delete all except this token"
  method without a schema change; `user_sessions` already stores enough
  per-row identity (`tokenHash`) to support it (`sessions.service.ts`
  read alongside `session.guard.ts:27-32`'s lookup shape).

## Considered Options

### Option A — Revoke every other session, preserve the caller's current one

`enable()` calls a new `deleteAllUserSessionsExcept(userId, currentToken)`
(or equivalent), passed the token the authenticated request itself carried,
immediately after the 2FA row is written.

- **Advantages:** Closes FC-013 fully — every session that predates
  enrollment and is not the one actively performing it is revoked. The
  enrolling user's own in-progress session is unaffected, so no unexpected
  sign-out during the enable flow itself.
- **Disadvantages:** Requires a new `SessionsService` method not currently
  exposed by any caller — a small addition, but a new capability, not a
  reuse of the existing one-line call `resetPasswordWithCode()` makes.
- **Risks:** If the "current token" isn't threaded correctly from the
  guard/controller layer into the service call, this could silently revoke
  the wrong session or none at all — the correctness of this option
  depends entirely on that plumbing being right, and needs a test
  asserting the caller's own session survives.

### Option B — Revoke every session including the caller's, force re-login

`enable()` calls the existing `deleteAllUserSessions()` unmodified, exactly
as `resetPasswordWithCode()` does, and the frontend redirects to login on a
recognized response shape (or simply lets the next request 401 and the
existing auth-redirect handling take over).

- **Advantages:** Reuses the existing, already-proven method with no new
  `SessionsService` capability required — the smallest possible code
  change, and mechanically identical to the established precedent.
- **Disadvantages:** The user who just successfully enabled 2FA is
  immediately signed out of the session they used to do it, with no
  transitional UX unless the frontend is also changed to detect and handle
  this specific case (today's `enable()` response contains only backup
  codes; nothing signals "you are about to be logged out"). Combined with
  `PRD-TwoFactorAuth` FC-014 (the settings page already loses the
  displayed backup codes to an unrelated bug), a forced logout at this
  exact moment compounds an existing rough edge in the same flow.
- **Risks:** Without a coordinated frontend change, the user's next action
  on the same page (e.g. clicking "Show backup codes") fails with an
  authentication error that has no explanation in the UI, reading as a
  broken feature rather than an intentional security measure.

### Option C — Do not revoke sessions on enrollment

Leave `enable()` as it is today.

- **Advantages:** No code change; no risk of the new-method plumbing bug
  Option A risks, or the forced-logout UX gap Option B risks.
- **Disadvantages:** Leaves FC-013 open — G-001's guarantee does not hold
  against a session already in an attacker's possession at enrollment
  time, for up to the remainder of that session's 7-day life.
- **Risks:** None new; this is the status quo.

## Decision

**Option A** — revoke every other existing session for the account when
2FA is enabled, while preserving the session that performed the enable
request.

Chosen over Option B because Option B's forced-logout, while simpler to
implement, degrades the exact moment this feature is trying to build user
confidence in security — signing a user out immediately after they
successfully secured their account, with no in-UI explanation, reads as a
malfunction rather than a safeguard, and compounds the already-identified
FC-014 rough edge in the same screen. Chosen over Option C because leaving
FC-013 open means G-001's core promise — "a leaked or guessed password
alone is not sufficient to access the account" — does not hold against the
scenario most likely to motivate enabling 2FA in the first place (suspected
compromise), which is the failure mode with the highest real cost of the
three options.

This decision requires `SessionsService` to gain a
current-session-preserving revocation method; the exact method name and
signature are an implementation detail for whoever applies this ADR, not
decided here.

## Consequences

### Positive

- G-001's "leaked or guessed password alone is not sufficient" guarantee
  extends to sessions obtained before enrollment, closing `PRD-TwoFactorAuth`
  FC-013.
- The enrolling user experiences no unexpected sign-out; the security
  benefit is delivered with no cost to the action they were performing.
- Establishes a documented precedent other sensitive account-state changes
  in this codebase can be measured against, rather than leaving
  `resetPasswordWithCode()`'s revocation as a single undocumented instance.

### Negative

- Introduces a new `SessionsService` capability
  (current-session-preserving revocation) that does not exist today —
  real implementation and test-writing cost, not a one-line reuse of
  `deleteAllUserSessions()`.
- Any device or client session that was legitimately active on the account
  at enrollment time (a second browser, a mobile session) is now silently
  signed out with no notification sent to that device — the account holder
  learns this only if they next try to use it. This is the intended
  effect against an attacker's session, but has the same effect against
  the account holder's own other legitimate sessions, and this ADR does
  not add a notification mechanism to soften that.

## Risks

- **Plumbing correctness is load-bearing:** if the current-session token
  is not correctly threaded from the authenticated request into the new
  revocation call, this either revokes nothing (silently failing to close
  FC-013) or revokes the caller's own session too (regressing to Option
  B's UX problem without having chosen it deliberately). A test asserting
  the calling session specifically survives is necessary, not optional.
- **No corresponding decision for `disable()`:** this ADR is scoped to
  enrollment (`enable()`) only, per FC-013's framing. Whether disabling
  2FA should have any session effect was not raised as a failure condition
  and is out of scope here; a future change touching `disable()`'s session
  behavior would need its own justification, not an extension of this
  ADR's reasoning by assumption.
- **Interacts with FC-014, not addressed by this ADR:** the settings page
  already loses the displayed backup codes to an unrelated frontend defect
  (`PRD-TwoFactorAuth` FC-014, `FINDINGS.md` IF-001). This ADR's Option A
  was chosen partly to avoid compounding that UX rough edge, but does not
  fix it — FC-014 remains open, tracked separately.

## Alternatives Rejected

- **Option B (revoke all including current, force re-login):** rejected —
  reuses existing infrastructure at the lowest implementation cost, but
  the forced-logout UX at the exact moment of successful enrollment was
  judged worse than the added implementation cost of preserving the
  current session, especially layered on top of FC-014's existing rough
  edge in the same flow.
- **Option C (no session revocation):** rejected — leaves FC-013 open
  against the scenario (a session already compromised before enrollment)
  that most plausibly motivates a user to enable 2FA in the first place.

## Related ADRs

- Related: `ADR-0010` (session revocation via DB-backed session records) —
  this ADR relies on the same `user_sessions` mechanism `ADR-0010`
  established; it extends when revocation is triggered, not how sessions
  are tracked or invalidated at the storage layer.
- Related: `ADR-0011` (end-impersonation authentication boundary,
  Proposed) — a different session-lifecycle decision in the same auth
  module; no direct dependency, noted for a reader auditing session
  revocation triggers across the codebase.

## References

- `docs/features/two-factor-auth/PRD.md` — FC-013, Q-012, G-001
- `docs/features/two-factor-auth/DISCOVERY.md` — Candidate ADR C-ADR-1
- `backend/src/auth/two-factor.service.ts:57-94` — `enable()`
- `backend/src/auth/auth.service.ts:142-181` — `resetPasswordWithCode()`,
  the existing precedent
- `backend/src/auth/sessions.service.ts:46` — `deleteAllUserSessions()`
- `backend/src/auth/session.guard.ts:27-32` — `SessionGuard`'s
  authorization check
