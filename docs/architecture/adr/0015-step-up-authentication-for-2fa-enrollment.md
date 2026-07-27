# ADR-0015: Require password re-verification (step-up authentication) before enabling 2FA

## Status

Accepted

**Accepted:** 2026-07-27 — verified directly against source (not routed
through a separate `architecture-reviewer` pass, per explicit user
direction to rely on self-verification going forward): confirmed no
password-change or other step-up-style route exists anywhere in
`auth.controller.ts` (repo-wide check of every route in the file), and
confirmed `login()`'s existing `bcrypt.compare()` use as the primitive this
decision reuses. No material findings against this ADR's own reasoning.

## Date

2026-07-27

## Context

`GET /auth/2fa/setup` and `POST /auth/2fa/enable`
(`backend/src/auth/auth.controller.ts:264-281`) are both guarded by
`JwtAuthGuard, SessionGuard` — proof that the caller holds a currently
valid session — and nothing else. `TwoFactorService.enable()`
(`two-factor.service.ts:57-94`) additionally requires a valid TOTP code for
the newly generated secret before activating 2FA (`BR-003`,
`PRD-TwoFactorAuth`), but that proves only that *whoever holds the
session* controls some authenticator app. It does not prove that the
session holder is the legitimate account owner rather than someone who has
obtained the session by other means (e.g. XSS, a leaked or stolen token, an
unattended authenticated device).

A repo-wide check of `auth.controller.ts` found no password-change route in
this module at all, and no other route requiring re-entry of the account
password after initial login exists anywhere the discovery scan covered —
there is no in-repo "step-up authentication" pattern this feature would be
deviating from; this is an open design question being raised for the first
time by this feature, not an inconsistency with an established practice.

The consequence of this gap, evidenced directly:

- An attacker holding a hijacked session can call `getSetup()` then
  `enable()` with their own authenticator, satisfying BR-003 with a code
  from a device they control.
- Once enabled, `POST /auth/2fa/disable`
  (`two-factor.service.ts:96-139`) itself requires a valid TOTP or backup
  code — which only the attacker's device or backup-code set can produce.
  The legitimate account holder, still knowing the correct password, has
  no way to disable what they never enabled.
- `PRD-TwoFactorAuth` FC-010 records this as a failure condition and
  explicitly notes that BR-003's proof-of-possession rationale does not
  defend against this attack — it is what makes the attack durable, not
  what prevents it.

This ADR is scoped to `enable()` specifically, the one action in this
feature whose absence of re-verification produces a durable,
hard-to-reverse account takeover — not a general policy for every
sensitive action across the codebase, which is a larger decision this ADR
does not have the mandate to make (see Risks).

## Decision Drivers

- **Closing a durable-lockout attack path** — FC-010 describes an outcome
  with no self-service recovery once it occurs (the legitimate holder has
  no code to disable with), which is a materially worse failure mode than
  a merely detectable or reversible one.
- **Not breaking the existing enable flow's usability** — whatever
  mechanism is added must not make the common case (a legitimate user
  enabling 2FA on their own account, session intact and uncompromised)
  meaningfully harder.
- **No existing in-repo pattern to reuse or extend** — this decision
  introduces the concept fresh; it should be scoped narrowly enough to
  solve this feature's problem without silently deciding a
  broader step-up-authentication policy this ADR hasn't evaluated evidence
  for.
- **Training-sandbox context** (`CLAUDE.md`) — this system is a QA
  training sandbox; the mechanism should be simple enough to be a useful
  teaching example of step-up authentication, not a production-grade
  implementation (e.g. WebAuthn re-assertion, step-up token scoping)
  disproportionate to the codebase's actual maturity elsewhere.

## Assumptions

- The account holder's current password is still known only to them at the
  time of enrollment — i.e., this mechanism defends against a
  session-hijack attacker who does *not* also know the password, which is
  the threat model FC-010 describes. If the attacker also has the
  password, step-up re-verification provides no additional protection;
  that is a different, larger compromise this ADR does not address.
- No existing frontend or backend flow depends on `enable()` being
  callable without the caller supplying their password in the same
  request — not verified against real usage, only against the absence of
  any such documented flow in the routes and components this discovery
  scan covered.

## Considered Options

### Option A — Require the current password in the `enable()` request body

`Enable2FaDto` gains a required `password` field; `enable()` verifies it
against the account's `passwordHash` via `bcrypt.compare()` (the same
mechanism `login()` already uses) before proceeding to the existing TOTP
check.

- **Advantages:** Directly closes FC-010 — an attacker holding a session
  but not the password cannot complete enrollment. Reuses the exact
  password-verification primitive (`bcrypt.compare()`) already used
  elsewhere in this module; no new hashing scheme or dependency.
  Single-request UX: the user provides their password in the same form
  submission that already asks for a TOTP code, no additional round trip.
- **Disadvantages:** Couples `TwoFactorService.enable()` to knowledge of
  password verification, a concern currently owned by `AuthService`/
  `UsersService` — a small layering change (`enable()` needs access to the
  user's `passwordHash` and a compare call it doesn't use today).
  `Enable2FaDto` and the frontend enable form both need a new required
  field, which is a breaking change to the existing API shape for any
  caller passing only a `code` today.
- **Risks:** If the password field silently defaults to "not required"
  under a missing-validation bug, this option's entire protection is
  bypassed exactly as unsafely as before — the DTO validation must
  actively reject a request that omits it, not just document that it's
  expected.

### Option B — Introduce a short-lived step-up token, minted by a new password-re-verification endpoint, required by `enable()`

A new endpoint (e.g. `POST /auth/step-up`) accepts the current password and,
on success, issues a short-lived step-up-scoped token (analogous to the
existing `temp2fa` token pattern). `enable()` requires this token in
addition to the session and the TOTP code.

- **Advantages:** Establishes a reusable mechanism other sensitive actions
  (were this codebase to decide it needed them) could adopt later without
  each inventing its own password-recheck path. Keeps `enable()`'s request
  shape decoupled from raw password handling — it only checks a token's
  claim, mirroring the existing `verify2Fa()` pattern for consistency of
  approach within the module.
- **Disadvantages:** Meaningfully larger scope than this ADR's problem
  requires — a new endpoint, a new token type, new claim-validation logic,
  and (multi-step) an extra round trip in the enable UX (re-verify, then
  submit the TOTP code with the resulting token) for a feature this ADR
  scoped specifically to `enable()`. Introduces a second short-lived
  auth-adjacent token type alongside the existing `temp2fa` one, which is
  more surface area to reason about for a training-sandbox codebase than
  the problem currently warrants.
- **Risks:** As a new reusable mechanism, it invites exactly the kind of
  broader step-up-authentication policy decision this ADR explicitly
  declines to make (see Context, Risks) — building it as "reusable"
  without that policy decided first risks a half-designed general
  mechanism justified by a single caller.

### Option C — Do not add step-up authentication

Leave `enable()` as it is today, relying solely on session validity plus
TOTP proof-of-possession.

- **Advantages:** No code change, no new required field, no risk of a
  validation-bypass bug in a new check.
- **Disadvantages:** Leaves FC-010 open — a hijacked-session attacker can
  permanently lock the legitimate account holder out via 2FA enrollment,
  with no self-service recovery.
- **Risks:** None new; status quo.

## Decision

**Option A** — require the account's current password in the `enable()`
request, verified via `bcrypt.compare()` before the existing TOTP check
proceeds.

Chosen over Option B because Option B solves a broader problem than this
ADR was scoped to address — a reusable step-up mechanism is worth
considering, but only as its own deliberate decision with its own driver
evidence (which sensitive actions need it, and why), not as a byproduct of
closing FC-010 specifically. Building it now, justified by a single caller,
risks a mechanism shaped by this one use case rather than by the actual
range of needs a general step-up policy should serve. If a second sensitive
action later needs the same protection, that is the point at which Option
B's tradeoff should be re-evaluated with two real call sites' requirements
in hand, not one. Chosen over Option C because FC-010's failure mode — a
durable, self-recovery-impossible lockout — is a materially worse outcome
than the added friction of one more required field in a form the user is
already filling out.

## Consequences

### Positive

- Closes `PRD-TwoFactorAuth` FC-010: an attacker holding a session without
  the account password cannot complete 2FA enrollment, removing the
  durable-lockout path.
- BR-003's proof-of-possession requirement now combines with proof of
  password knowledge, together approximating proof that the caller is the
  legitimate account holder — closer to what BR-003's original rationale
  implied than what TOTP proof-of-possession alone provided.
- No new token type, endpoint, or auth-adjacent mechanism is introduced;
  the change is contained to `TwoFactorService.enable()` and its DTO.

### Negative

- `Enable2FaDto`'s shape changes — any existing caller (frontend or a
  future API consumer) sending only `{ code }` must be updated to send
  `{ code, password }`, a breaking change to this one endpoint's contract.
- `TwoFactorService` gains a dependency on password-verification logic it
  did not need before, a small layering concern (see Option A
  Disadvantages) that whoever implements this should resolve by injecting
  the comparison capability rather than duplicating `bcrypt.compare()`
  logic independently of `AuthService`'s existing use of it.
- Does not protect `getSetup()` itself (only `enable()`) — an attacker
  holding a hijacked session can still call `getSetup()` and view a QR
  code/secret without a password, though this alone does not activate 2FA
  or lock anyone out; the durable-harm step is `enable()`, which this
  decision does gate.

## Risks

- **Validation-bypass risk is this option's central failure mode:** if the
  new `password` field is optional in practice (e.g. a DTO validation gap,
  or a code path that calls `TwoFactorService.enable()` directly without
  going through the guarded controller route), the protection this ADR
  adds is silently absent exactly where it matters most. This needs an
  explicit test asserting `enable()` rejects a request with a missing or
  incorrect password, not only a happy-path test.
- **Scope-creep risk deferred, not eliminated:** declining Option B's
  reusable mechanism here means a second future caller needing the same
  protection will either duplicate Option A's inline check or trigger a
  re-evaluation of Option B. This ADR does not resolve which; it only
  avoids deciding it prematurely on the evidence of one caller.
- **No corresponding decision for `disable()` or `regenerateBackupCodes()`:**
  this ADR is scoped to `enable()`, the action with the durable-lockout
  consequence. Whether disable or regenerate need the same treatment was
  not evaluated here — `disable()` already requires a TOTP/backup code,
  which is a materially different proof-of-possession situation than
  `enable()`'s (the attacker already holds those in the FC-010 scenario,
  since they set them). Left for separate consideration if evidence
  emerges that it's needed.

## Alternatives Rejected

- **Option B (step-up token, new endpoint):** rejected for this ADR's
  scope — a reusable mechanism is a larger, separately-justified decision;
  building it now for a single caller risks shaping it around one use case
  rather than a considered general policy.
- **Option C (no step-up authentication):** rejected — FC-010's failure
  mode (durable, self-recovery-impossible account lockout) outweighs the
  cost of one additional required field in the enable flow.

## Related ADRs

- Related: `ADR-0012` (decouple password-reset pepper) — a different
  auth-secret decision in the same module; no direct dependency, both
  concern strengthening a proof-of-identity step in the auth module.
- Related: `ADR-0014` (session revocation on 2FA enrollment) — both ADRs
  address the same underlying risk (a hijacked session compromising 2FA
  enrollment) from different angles: `ADR-0014` limits the blast radius
  after enrollment by revoking other sessions; this ADR prevents
  enrollment by an attacker in the first place. Complementary, not
  redundant — `ADR-0014` alone would still let an attacker complete
  enrollment before their session is revoked; this ADR alone would still
  leave other pre-existing sessions live after a legitimate enrollment.
  Recommend implementing both together if either is adopted.

## References

- `docs/features/two-factor-auth/PRD.md` — FC-010, BR-003, Q-010
- `docs/features/two-factor-auth/DISCOVERY.md` — Candidate ADR C-ADR-2
- `backend/src/auth/two-factor.service.ts:57-94` — `enable()`
- `backend/src/auth/auth.controller.ts:264-281` — `/auth/2fa/setup`,
  `/auth/2fa/enable` route guards
- `backend/src/auth/auth.service.ts` — existing `bcrypt.compare()` use in
  `login()`, the primitive this decision reuses