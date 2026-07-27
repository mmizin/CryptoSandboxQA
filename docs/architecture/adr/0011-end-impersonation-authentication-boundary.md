# Authenticate the end-impersonation restore path with a guard, single-use enforcement, and impersonated-token binding

**Status:** Proposed

**Date:** 2026-07-27

## Context

`POST /auth/end-impersonation` restores an admin's own access after an
impersonation session, by exchanging a `backToAdminToken` (issued alongside
the impersonated user's session, at `AuthService.impersonate()`,
`auth.service.ts:457-495`) for a fresh admin session.

**A premise worth stating precisely, since it bears directly on the option
set below:** `impersonate()` never deletes the admin's own `user_sessions`
row — it creates a session for the target user and signs `backToAdminToken`,
nothing else (`auth.service.ts:457-495`, in full). The admin's own session
therefore typically **remains live** in the database for the entire
impersonation. The reason `end-impersonation` cannot simply reuse the
admin's original token via the ordinary `JwtAuthGuard`+`SessionGuard`
pairing is a **client-side** choice, not a server-side constraint: the
frontend overwrites the `token` key in `localStorage` with the
impersonated user's token at the moment impersonation starts
(`frontend/lib/useAuth.ts:90`), so the admin's own token is no longer
available to send, even though the session record backing it still is. No
PRD requirement or code comment states this discarding was a deliberate
design decision rather than the simplest way to swap the active identity —
this ADR does not assume either explanation, and evaluates an option
built on this premise below (Option E) rather than excluding it.

Most authenticated routes in the codebase are protected by pairing
`JwtAuthGuard` (verifies JWT signature/expiry) with `SessionGuard`
(verifies a live `user_sessions` row) — confirmed against all 28
`@UseGuards` sites in `backend/src`: 27 pair both guards (directly or by
class-level inheritance), and the remaining one
(`POST /auth/admin/register`) uses a different, disjoint credential
(`AdminApiKeyGuard`, a shared static key) entirely
(`docs/features/session-management/DISCOVERY.md`, Data Flow 2).
`end-impersonation` carries **no** `@UseGuards` decorator of any kind
(`backend/src/auth/auth.controller.ts:226-232`), which at first reading
looks unprecedented — but it is not the only route that redeems a
non-session-backed, purpose-claim JWT with no guard: `POST
/auth/2fa/verify` (`auth.controller.ts:247-253`) is likewise unguarded,
and `AuthService.verify2Fa()` validates the 2FA temp token's signature and
`temp2fa` purpose claim inline in the service, exactly as
`endImpersonation()` does for `purpose: 'back_to_admin'`
(`auth.service.ts:191-199` vs. `:497-511`). Neither route has a single-use
marker. `end-impersonation` is an instance of an existing, undocumented
pattern in this codebase — "redeem a short-lived purpose-scoped JWT inline,
no guard, no replay protection" — not a one-off exception, and it differs
from its sibling only in the privilege it mints (a full admin session,
versus an ordinary user session for 2FA).

`AuthService.endImpersonation()` (`auth.service.ts:497-518`) is the only
authentication check on the `end-impersonation` path. It verifies the
`backToAdminToken`'s JWT signature, its `purpose: 'back_to_admin'` claim,
and that the subject is still an admin — nothing else. There is no nonce,
usage counter, or `usedAt` marker: the token is a plain JWT with a 1-hour
`expiresIn` (`BACK_TO_ADMIN_EXPIRY`), and nothing server-side prevents it
being redeemed more than once within that hour. The frontend removes it
from `localStorage` after use (`frontend/lib/useAuth.ts:109`), but that is
a client-side convention with no enforcement behind it — an intercepted or
retained token remains a fully-privileged, repeatable admin-session-minting
credential for its full lifetime.

Separately, all token types in this system (ordinary access tokens, the
2FA temp token, `backToAdminToken`) are signed with one shared secret and
no `audience`/`issuer` separation (`backend/src/auth/auth.module.ts:21-28`),
and `JwtStrategy.validate()` never inspects a `purpose` claim — it accepts
any JWT with a valid `sub`. A raw `backToAdminToken` therefore already
passes `JwtAuthGuard` as if it were the admin's own access token; the only
thing currently preventing it from being usable directly against any
`JwtAuthGuard`+`SessionGuard` route is that it has no backing
`user_sessions` row, and guard-pairing itself is an unenforced per-route
convention (PRD C-001, ADR-0010 Consequences).

This gap has no recorded rationale. It surfaced during architecture
discovery for Session Management
(`docs/features/session-management/DISCOVERY.md`, Candidate ADR 2) and is
tracked in the supporting PRD as **FC-004**, whose Condition already leads
with the guard gap this ADR addresses directly: "`POST
/auth/end-impersonation` carries no route guards," alongside its
unrevoked-impersonated-session consequence — the two are one PRD-level
finding, not separate defects, and this ADR resolves the guard half of it.
FC-005 (`backToAdminToken` has no session backing and is not revocable by
the mechanism ADR-0010 describes) is the token-model question Candidate
ADR 4 owns, not this ADR. **PRD Q-006 asks whether closing FC-004 —
including "guarding `POST /auth/end-impersonation`," its own words — is
`PRD-SessionManagement`'s responsibility or `PRD-Impersonation`'s**; that
ownership question is formally open as of this writing. This ADR proceeds
on the position that the authentication-boundary half of FC-004 is
answerable independently of that ownership question (the guard belongs
wherever the route lives, regardless of which PRD's Functional
Requirements ultimately cite it) — but the ownership question itself is
not resolved here, and should be revisited if `PRD-Impersonation`
subsequently claims this route.

## Decision Drivers

- **Blast radius of a compromise.** Unlike the 2FA temporary token (which
  authenticates into a normal user session), a compromised
  `backToAdminToken` mints a **full admin session** directly — the same
  redemption pattern as the 2FA temp token, but with higher-value output.
  This is the highest-privilege token type in the system protected by the
  weakest authentication check.
- **Consistency with an existing (undocumented) codebase pattern, not
  invention of a new one.** `end-impersonation` is not an isolated outlier
  in *mechanism* — `POST /auth/2fa/verify` redeems a structurally identical
  purpose-claim JWT with no guard and no single-use marker (see Context).
  This ADR deliberately does **not** extend A/B/C2 to `/2fa/verify`: the
  Blast-radius driver above is the stated reason the two routes are
  treated differently despite the mechanism being the same — a compromised
  2FA temp token authenticates into an ordinary user session (the same
  outcome credential theft anywhere else in the product would produce),
  while a compromised `backToAdminToken` mints admin access directly. Only
  Option D, by construction, would fix both at once, which is named as a
  reason to consider D rather than to leave `/2fa/verify` unaddressed
  indefinitely — but fixing `/2fa/verify` on its own terms is out of this
  ADR's scope and is not decided here.
- **Preserve the restore flow's core purpose, without asserting more than
  is evidenced.** `backToAdminToken` exists so an admin can return to
  their own account after impersonating a user. No PRD requirement was
  found stating this must succeed unconditionally, including when the
  admin's own or the impersonated session has since been independently
  revoked — that stronger property is not assumed here, and Option C below
  is evaluated on the actual, narrower consequence of tightening the
  check, not on an unsourced "no way back" framing.
- **Threat model.** `backToAdminToken` is stored in `localStorage`
  (`frontend/lib/useAuth.ts:89`) and sent in a request body. The dominant
  realistic compromise vector for a token stored this way is client-side
  exposure (XSS, or direct access to browser storage) at redemption time
  or shortly after — not necessarily "retained and replayed after the
  admin's own legitimate use." Single-use enforcement (Option B) only
  closes the *replay-after-legitimate-use* window; it does nothing if the
  attacker redeems first. **Against the client-side-exposure vector
  specifically, requiring a second token that lives in the same
  `localStorage` origin (Option C2) adds no defense** — an attacker who
  can read one key can read the other. C2's actual value, if any, is
  against a *different* vector: `backToAdminToken` alone travels in a
  request body and nowhere else, whereas requiring the impersonated token
  too means an attacker who has captured request logs, error-reporting
  payloads, or a network trace containing the restore call still needs a
  second, separately-captured artifact (the impersonated token, normally
  sent as an `Authorization` header, which some logging configurations
  redact and body-logging configurations do not). This ADR evaluates C2 on
  that narrower, log/transport-exposure basis — not as a general defense
  against client-side compromise, which it is not.
- **Reversibility.** This driver cuts against Option B specifically, not
  in its favor: B is the one option in this set that requires a schema
  migration (a persisted single-use marker), making it the hardest to
  reverse of the options considered, not the easiest. Option D, by
  contrast, requires no storage and is revisable in code alone — larger in
  *scope* (touches `JwtStrategy`, shared by every route) but not harder to
  *undo*. This ADR adopts B anyway, on Blast-radius/Threat-model grounds
  (closing the replay window is judged worth a migration), not because
  Reversibility favors it — see Decision. Bringing `backToAdminToken` into
  the session model (candidate for a future ADR, per
  `docs/features/session-management/DISCOVERY.md` Candidate ADR 4) remains
  the largest, most one-way change in this space and is not undertaken
  here.

## Assumptions

- The 1-hour `backToAdminToken` lifetime itself is not being revisited by
  this ADR — only how the token is checked at redemption, not how long it
  remains valid. Whether the lifetime is also appropriate is left to
  `docs/features/session-management/DISCOVERY.md` Candidate ADR 4 (and PRD
  Q-008), which concerns non-session-backed tokens generally.
- No requirement exists for `end-impersonation` to be callable by an
  unauthenticated party under any circumstance — the token itself, not the
  absence of a check, is intended to be the sole credential.

## Considered Options

### Option A — Add a purpose-scoped guard that validates the `backToAdminToken`'s claims

Introduce a guard (e.g. `BackToAdminGuard`) applied via `@UseGuards` on
`end-impersonation`, performing the same signature/`purpose`/admin-role
checks `endImpersonation()` currently does inline in the service layer,
but as a declared, testable guard rather than buried logic. Does not, by
itself, add single-use enforcement.

- **Advantages:** Makes the route's authentication check visible at the
  controller (matching every other route's convention of declaring its
  auth requirements via `@UseGuards`, rather than leaving it to be
  discovered by reading the service method). Small, incremental change —
  moves existing logic, does not redesign the token.
- **Disadvantages:** Does not close the replay window — the token remains
  valid and redeemable for its full hour, however many times it is
  presented.
- **Risks:** Fixes the "no guard at all" visibility problem without fixing
  the underlying replayability risk, which could be mistaken for a
  complete fix if not documented as partial.

### Option B — Add single-use enforcement (a `usedAt`/nonce check) to the redemption path

Extend `endImpersonation()` (or a guard wrapping it) to mark the
`backToAdminToken` (via its `jti` claim or an equivalent stored marker) as
consumed on first successful redemption, and reject any subsequent
redemption attempt even within the 1-hour window.

- **Advantages:** Closes the *replay-after-legitimate-use* window: a token
  intercepted or retained after the admin's own successful redemption
  becomes useless. Does not require the frontend to send anything it
  doesn't already send.
- **Disadvantages:** Requires persisting *something* about the token
  (a `jti` denylist entry, or a dedicated table) — a smaller version of the
  same "needs storage and cleanup" tradeoff ADR-0010 already accepted for
  sessions generally, now duplicated for a second, narrower purpose. **Also
  makes the operation non-idempotent**, which the current implementation
  is not documented as relying on but does not currently forbid either: if
  a redemption succeeds server-side but the response is lost in transit
  (network failure, tab closed), the admin's retry now fails, and they
  must re-authenticate with their password rather than the request simply
  re-succeeding. This is the same class of cost used to weigh Option C
  below and should be judged on the same terms.
- **Risks:** Only closes the post-legitimate-use replay window (see
  Decision Drivers, Threat Model) — does nothing against an attacker who
  redeems the token before the admin does. If implemented as a new table
  distinct from `user_sessions`, this is, under Prisma, a schema
  migration, not a schema-migration-free change — plan for it as such.

### Option C — Bind redemption to proof the caller currently controls the impersonation, in one of two strengths

**C1 (session-backed):** require the still-current impersonated access
token (e.g. as the `Authorization` header) *and* validate it against
`user_sessions`, the same way every other protected route does.

- **Advantages:** Strongest binding — ties redemption to proof the
  impersonated session is still live, not just that the caller once held a
  valid token for it.
- **Disadvantages:** If the impersonated session has since been revoked
  (by the impersonated user's own password reset, the only currently
  possible independent-revocation path — PRD FR-005's own revocation is
  *triggered by* this same endpoint, so it cannot have already fired
  before this call), the admin cannot use this path to restore access and
  falls back to re-authenticating with their password
  (`frontend/lib/useAuth.ts:111-117` already handles a failed
  end-impersonation call this way — this is an existing, not a new,
  fallback in the product). Requires a frontend change: the current
  implementation sends no `Authorization` header on this call
  (`frontend/lib/useAuth.ts:104-108`).
- **Risks:** Narrows the restore path's convenience in a genuinely rare
  scenario (impersonated-user password reset during the impersonation
  window) — a real but small cost, not the unconditional lockout risk a
  first read suggests.

**C2 (signature-and-claim-binding, no session lookup):** require the
impersonated JWT alongside the restore token, but validate only its
signature and that its `impersonatedBy` claim matches the restore token's
`sub` — no `user_sessions` lookup. `impersonate()` already embeds
`impersonatedBy: adminId` in the impersonation payload
(`auth.service.ts:471-475` — the payload literal spans `:471-475`, the
signing call at `:476-478`), so the data needed for this binding already
exists.

- **Advantages:** Closes the "intercepted `backToAdminToken` alone is
  sufficient" gap — an attacker now needs *both* tokens, not one — without
  a session lookup, without new storage, without a migration, and without
  Option C1's fallback-to-password scenario (the impersonated JWT stays
  signature-valid for its full `JWT_EXPIRY` regardless of session state,
  so this variant does not depend on the impersonated session still being
  live). Composes with Option B rather than competing with it.
- **Disadvantages:** Weaker than C1 — a stolen impersonated JWT that has
  *not* been revoked (which, per FR-005/FC-004, is currently the norm,
  since ending impersonation doesn't revoke it either) still works as the
  second factor. Still requires the frontend change C1 needs (sending the
  impersonated token on this call).
- **Risks:** Provides real but partial defense-in-depth — closes a
  single-token compromise, not a two-token one, which for this endpoint is
  the more realistic bar given how modest the frontend change is.

### Option D — Scope tokens cryptographically so a non-access token cannot pass `JwtAuthGuard` at all

Give `backToAdminToken` (and the 2FA temp token) either a separate signing
secret from ordinary access tokens, or an `audience`/`purpose` claim that
`JwtStrategy.validate()` explicitly checks and rejects for non-access-token
routes.

- **Advantages:** Addresses the root cause named in Context — that any of
  these token kinds currently passes `JwtAuthGuard` as a valid access
  token, with `SessionGuard`'s absence-of-a-row as the only thing stopping
  misuse today. Closes the exposure for **every** route, current and
  future, not just `end-impersonation` — including the same gap on `/2fa/verify`.
  Requires no storage, no migration, no cleanup.
- **Disadvantages:** Larger change than A/B/C — touches `JwtStrategy`
  (shared by every authenticated route) and the token-issuance code for
  two token kinds, not just the one endpoint this ADR is scoped to.
- **Risks:** Getting the `purpose`/`audience` check wrong in
  `JwtStrategy.validate()` risks rejecting legitimate access tokens
  system-wide, a far larger blast radius than a bug confined to
  `end-impersonation` alone — this is the tradeoff for addressing the root
  cause rather than one symptom of it.

### Option E — Retain and reuse the admin's own session instead of issuing `backToAdminToken`

As established in Context, `impersonate()` does not delete the admin's own
`user_sessions` row. Have the frontend preserve the admin's own token under
a second `localStorage` key (structurally the same pattern it already uses
to preserve `backToAdminToken` today) instead of only overwriting `token`,
and protect `end-impersonation` with the ordinary
`JwtAuthGuard`+`SessionGuard`+`AdminGuard` pairing, validating the admin's
own token exactly like any other authenticated admin request. No new token
type is issued at all.

- **Advantages:** The only option that achieves full consistency with the
  rest of the codebase's authentication model with **no** exception to
  document — Driver 2's demand is met outright rather than argued around.
  No new token kind, no migration, no cleanup, no non-idempotency: the
  request is validated and processed exactly like every other
  authenticated request in the system. If adopted, `backToAdminToken` and
  the `FC-005`/`Q-008` question about whether it belongs in the session
  model become moot — there would be nothing left to bring into the model.
- **Disadvantages:** Trades a short-lived, purpose-scoped, low-privilege-if-stolen-alone
  token (`backToAdminToken`, 1 hour, unusable without also compromising a
  session-backed route) for keeping a **full, ordinary 7-day admin access
  token** live in browser storage for the entire duration of every
  impersonation. If that token is compromised via the client-side vector
  the Threat Model driver names as dominant, the attacker gets standing
  admin access for up to 7 days, not a 1-hour restore-only credential —
  a materially worse outcome from the same compromise vector this whole
  ADR is otherwise trying to narrow.
- **Risks:** Depends on the admin's own session not being separately
  revoked during impersonation (e.g. by that admin's own password reset
  from another device) — a scenario Option C1 was deferred over for the
  *impersonated* session; the same class of edge case would apply here to
  the *admin's* session, with the same fallback-to-password behavior on
  failure.

## Decision

**Option A + Option B + Option C2, combined; Option C1 and Option D
explicitly deferred, not rejected.**

- **Option A** (declared, purpose-scoped guard) — adopt immediately.
  Closes the "no guard at all" visibility gap and matches the rest of the
  codebase's convention of declaring auth requirements via `@UseGuards`.
- **Option B** (single-use enforcement) — adopt, with its cost stated
  plainly: this makes end-impersonation non-idempotent, and a lost
  response after a successful redemption now requires the admin to
  re-authenticate with their password rather than retry. This is judged an
  acceptable, occasional inconvenience against a real security gap
  (unbounded replay for up to an hour), but it is a real cost, not a free
  fix.
- **Option C2** (bind to the impersonated JWT's `impersonatedBy` claim, no
  session lookup) — adopt alongside A and B, **on the narrow basis argued
  in the Threat Model driver**: it adds no defense against the dominant
  client-side compromise vector (both tokens share one `localStorage`
  origin), but it does raise the bar against a request-log or
  error-reporting exposure of `backToAdminToken` alone, since that channel
  does not also capture the impersonated token's `Authorization` header
  the same way. Requires the frontend to start sending the impersonated
  token on this call (a change it does not make today). **Disclosed
  weakness, not fixed here:** C2 binds only to *which admin* caused the
  impersonation (`impersonatedBy == sub`), not to *which impersonation
  session* — an admin holding a `backToAdminToken` for one impersonation
  and an unexpired impersonated JWT from a different, earlier
  impersonation would satisfy C2's check. Tightening this to bind the
  specific session (e.g. embedding the impersonated session's id in
  `backToAdminToken`'s own payload) is a small addition to the mechanism
  chosen here, not evaluated in depth, and is left as a follow-up refinement
  rather than blocking this decision.
- **Option C1** (session-backed binding) — **not adopted now.** Its
  additional strength over C2 depends on the impersonated session still
  being *revocable in practice*, which is limited today by PRD FR-005
  (ending impersonation doesn't revoke the impersonated session, so there
  are currently few events that would make C1's session check fail where
  C2's wouldn't). Revisit C1 once FR-005 closes — at that point C1
  provides both the log/transport benefit C2 provides and genuine
  protection against a since-revoked impersonated session, at the cost of
  C1's own fallback-to-password scenario. **Option B's relationship to
  that future state should be revisited at the same time:** once FR-005
  and C1 are both in place, a *second* redemption of the same restore
  token would already fail C1's session check (the first redemption's
  FR-005 cleanup would have removed the row), which may make Option B's
  separate single-use marker partially or fully redundant. This ADR does
  not resolve that overlap now — it is a reason to treat Option B as
  possibly provisional, not necessarily permanent, and to re-examine it
  when FR-005/C1 land rather than assume both persist indefinitely.
- **Option D** (cryptographic token scoping) — **not adopted now, tracked
  as a separate follow-up.** It is the only option here that addresses the
  root cause (any non-access token currently passes `JwtAuthGuard`) rather
  than this one route's symptom of it, and it also closes the identical
  gap on `/2fa/verify` (see Decision Drivers) — but it is a larger,
  `JwtStrategy`-wide change out of proportion to this ADR's scope, which is
  deliberately limited to `end-impersonation`. It is a larger *scope*
  change, not a harder-to-reverse one — see the Reversibility driver.
  Recording it here so it is not lost: whoever next touches
  `JwtStrategy.validate()` or the 2FA temp-token flow should weigh Option D
  against patching each redemption site individually, as this ADR does for
  one of them.
- **Option E** (reuse the admin's own live session, retire
  `backToAdminToken`) — **not adopted.** Rejected on the Threat Model
  driver: it would replace a short-lived, purpose-scoped, low-value-alone
  token with a full 7-day admin access token held in browser storage for
  the entire impersonation window — a materially worse outcome under the
  same client-side compromise vector this ADR treats as dominant, in
  exchange for eliminating an authentication-boundary exception this ADR
  can otherwise close with A/B/C2 at a smaller cost.

Combined, A+B+C2 close the replay window and raise the bar against
log/transport exposure of `backToAdminToken` alone, without waiting on
FR-005 or undertaking the token-strategy-wide change Option D represents,
and without accepting Option E's larger standing-privilege exposure. They
do not close every gap named in Context — see Consequences.

## Consequences

### Positive

- The highest-privilege token-redemption path in the system gains an
  explicit, declared authentication check, consistent with every other
  route's convention (Option A).
- The replay window is closed for the common case (an intercepted token
  used after the admin's own legitimate redemption) — Option B.
- Redemption now requires both the restore token and the impersonated
  token against a log/transport-exposure vector (each captured
  independently of the other in that channel) — Option C2 — without
  depending on the impersonated session still being live, and without the
  frontend needing to change its fallback-to-password behavior on failure.
  This is **not** a defense against the dominant client-side-compromise
  vector named in the Threat Model driver, where both tokens share
  exposure — see Negative, below.

### Negative

- Requires a new persisted marker (a `jti`/`usedAt`-style record) for
  single-use enforcement — a small storage and cleanup surface, in the
  same spirit as (though narrower than) the `user_sessions` table
  ADR-0010 already accepts.
- **End-impersonation is no longer idempotent.** A successful redemption
  whose response is lost in transit now forces the admin to
  re-authenticate with their password on retry, rather than the retry
  simply succeeding again — a real, if occasional, usability cost accepted
  in exchange for closing the replay window (see Decision).
- **Does not close the pre-legitimate-use compromise window.** Per the
  Threat Model driver, an attacker who redeems the token before the admin
  does is unaffected by Option B, and unaffected by C2 if they've also
  compromised the impersonated token (plausible if both live in the same
  `localStorage`, `frontend/lib/useAuth.ts:89`/`:90`). This decision
  narrows the exposure; it does not eliminate it.
- Does not resolve PRD FR-005 (the impersonated user's own session is
  still not revoked when impersonation ends) — that remains open, tracked
  separately, and this ADR should not be read as closing it. C1 (the
  stronger session-backed binding) is explicitly deferred until FR-005 is.
- Does not adopt Option D (cryptographic token scoping), so the root cause
  — any non-access token currently passing `JwtAuthGuard` — remains open
  for `backToAdminToken`, the 2FA temp token, and any future token type of
  this shape, on any route that omits `SessionGuard`. This ADR narrows one
  symptom, not the underlying condition.

## Risks

- **Technical:** the single-use marker must itself be cleaned up after the
  token's 1-hour expiry, or it becomes a second unbounded-growth table
  alongside `user_sessions` — the same class of risk ADR-0010 names for
  sessions generally, recurring here at smaller scale if not addressed.
- **Technical:** if a future change adds a legitimate reason to redeem
  `backToAdminToken` more than once (not currently anticipated), single-use
  enforcement would need to be revisited — flagged so it is not
  rediscovered as a mystery bug later.
- **Technical:** both tokens C2 now requires live in the same
  `localStorage` origin — an attacker with client-side script execution
  (XSS) at the point of impersonation can plausibly obtain both, at which
  point C2 provides no additional defense over Option B alone. **No option
  in this ADR's set closes this specific scenario** — Option D scopes
  tokens so a non-access token cannot be misused *against other routes*
  (cross-route confusion), which is a different problem than an attacker
  who has captured both tokens and uses each for its own intended purpose
  at `end-impersonation` itself. This remains an open exposure regardless
  of which options here are adopted.
- **Operational:** the single-use marker, if implemented as a new Prisma
  model, is a schema migration, not a purely backend-code change — plan
  the rollout accordingly rather than treating this as migration-free.

## Alternatives Rejected and Deferred

- **Option E** (reuse the admin's own live session, retire
  `backToAdminToken`) — **rejected**, not deferred: it would trade a
  short-lived, purpose-scoped token for a full 7-day admin access token
  held in browser storage for the duration of every impersonation, a
  materially worse outcome under the same client-side compromise vector
  this ADR treats as dominant.
- **Option C1** (require the impersonated token, session-validated) — not
  rejected, deferred: its added strength over C2 depends on the
  impersonated session being *revocably meaningful*, which FR-005 does not
  yet make true in practice. Revisit once FR-005 closes, and re-examine
  Option B's continued necessity at the same time (see Decision).
- **Option D** (cryptographic token scoping) — not rejected, deferred:
  addresses the root cause and closes the identical gap on `/2fa/verify`,
  but is a `JwtStrategy`-wide change disproportionate to this ADR's
  single-route scope. Recorded as a follow-up, not dismissed.

## Related ADRs

- Related: ADR-0010 (session revocation model) — this ADR's guard closes a
  gap in how that model's guarantees are enforced on one specific route,
  without changing the model itself.

## References

- `docs/features/session-management/PRD.md` — FC-004, FC-005, FR-005,
  Q-006, Q-008
- `docs/features/session-management/DISCOVERY.md` — Candidate ADR 2
  (source of this decision), Candidate ADR 4 (the broader, deferred
  question this ADR deliberately does not resolve)
- `backend/src/auth/auth.service.ts:457-495` — `impersonate()`;
  `:497-518` — `endImpersonation()`
- `frontend/lib/useAuth.ts:97-125` — `returnToAdmin()`, the sole client
  caller of this endpoint
