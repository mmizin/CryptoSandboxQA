# Architecture Discovery — Two-Factor Authentication

Scan source: architecture-discovery
Scope: the TOTP/backup-code second-factor mechanism only
(`TwoFactorService`, `/auth/2fa/*` routes, `user_two_factor`); does not
re-scope password reset, session revocation mechanics, or admin
impersonation itself, which are (or will be) covered by their own
discoveries — this feature's interaction with each is in scope, the
mechanism underneath is not.
Primary input: `docs/features/two-factor-auth/PRD.md` (Status: Draft,
Confidence: Low — three rounds of independent product-review verification,
all findings fixed and re-verified; low confidence reflects genuine open
product questions, not unverified content)
Secondary input (consulted for consistency, not re-derived):
`docs/features/login/DISCOVERY.md`, `docs/features/login/FINDINGS.md`,
`docs/features/password-reset/DISCOVERY.md`,
`docs/architecture/adr/0009-...md` (Accepted),
`docs/architecture/adr/0010-...md` (Accepted),
`docs/architecture/adr/0011-...md` (Proposed),
`docs/architecture/adr/0012-...md` (Accepted),
`docs/architecture/adr/0013-...md` (Accepted, not yet implemented)
Last scanned: 2026-07-27

## System Overview

Two-Factor Authentication is not a standalone component — it is
`TwoFactorService` (`backend/src/auth/two-factor.service.ts`), six
JWT+session-guarded `AuthController` routes plus one deliberately unguarded
route (`POST /auth/2fa/verify`), and one Prisma model (`user_two_factor`),
consumed by `AuthService.login()`/`verify2Fa()` as the second stage of a
login already gated by password. Its defining architectural property,
evidenced directly in code, is that every trust boundary the feature relies
on to be safe is a boundary *owned by a different feature*: the temp
token's restricted scope depends on a login-owned guard-pairing convention
(`PRD-Login` C-002, `login/FINDINGS.md` IF-001), its only mitigation against
verification brute-forcing depends on a rate-limiting ADR
(`ADR-0013`) that is accepted but not implemented, and its only functioning
"lost everything" recovery path runs through admin impersonation
(`AuthService.impersonate()`), a mechanism this feature does not own and
that performs no `is2FaEnabled()` check. This discovery's job is to
determine which of the PRD's flagged gaps are genuinely new architectural
decisions this feature must resolve, versus decisions that belong to
mechanisms it merely depends on, versus plain defects. Two candidate ADRs
are recorded below as newly this feature's own; the remainder are either
already-known candidates it inherits (not re-filed) or Implementation
Findings.

## Component Inventory

| Component | Responsibility | Evidence |
|---|---|---|
| `TwoFactorService` (`backend/src/auth/two-factor.service.ts`) | Owns the full 2FA lifecycle: `getSetup()` (:14-55), `enable()` (:57-94), `disable()` (:96-139), `getBackupCodes()` (:141-153, always returns empty by design), `regenerateBackupCodes()` (:155-174), `verifyCode()` (:176-206), `getStatus()`/`is2FaEnabled()` (:208-220), `generateBackupCodes()` (:222-233, `Math.random()`-based) | `two-factor.service.ts` full file |
| `AuthController` `/auth/2fa/*` routes (`auth.controller.ts:247-311`) | Six routes (`status`, `setup`, `enable`, `disable`, `backup-codes`, `backup-codes/regenerate`) guarded by `JwtAuthGuard, SessionGuard`; one route (`verify`, `:247-253`) carries no guard at all | `auth.controller.ts:247-311` |
| `AuthService.login()` (`auth.service.ts:79-106`) | Checks `is2FaEnabled()`; if true, issues a signed temp token (`Temp2FaPayload`, `temp2fa: true`, `TEMP_2FA_EXPIRY = '5m'`) instead of a session, and does not create a `user_sessions` row | `auth.service.ts:54,79-106` |
| `AuthService.verify2Fa()` (`auth.service.ts:191-213`) | Verifies temp-token signature and `temp2fa`/`sub` claims, delegates to `TwoFactorService.verifyCode()`, then calls the same `issueTokenAndSession()` a normal login uses; does not revoke or mark the temp token as spent afterward | `auth.service.ts:191-213` |
| `AuthService.impersonate()` (`auth.service.ts:457-495`) | Mints a full session token and `user_sessions` row for an arbitrary target user given only admin role, with no call to `is2FaEnabled()` anywhere in the method | `auth.service.ts:457-495` |
| `UserTwoFactor` Prisma model (`schema.prisma:63-76`) | Persistence: `userId` (unique), `secret` (non-nullable, plaintext), `backupCodes` (JSON array of bcrypt hashes), `enabled`, `enabledAt`; `onDelete: Cascade` on the user relation | `schema.prisma:63-76` |
| `frontend/components/TwoFactorVerificationModal.tsx` | Login-time code entry; strips non-digits and truncates to 6 chars on every keystroke (`:68-72`), rejecting backup codes structurally, not just by validation | Read directly; see PRD C-002/FC-003 |
| `frontend/components/TwoFactorSettingsSection.tsx` | Setup/enable/disable/regenerate UI; a `useEffect` (`:33-37`) keyed on `[enabled, setupInProgress]` refetches `getBackupCodes()` (always empty) and overwrites any just-displayed real codes, including the ones `handleEnable` (`:54-73`) itself just set, since `handleEnable` changes both dependencies | `TwoFactorSettingsSection.tsx:33-37,54-73`; see PRD FC-014 |

Checked and found not to be a separate credential or override path relevant
to this feature: no admin endpoint, bulk-import path, or user-management
route reads or writes `user_two_factor` directly (repo-wide search) — the
only cross-cutting interaction is the pre-existing `impersonate()` method,
which bypasses this feature incidentally rather than integrating with it.

## Data Flows

### Observed (directly evidenced)

1. **Second-factor handoff from login** — `login()` decides, based on
   `is2FaEnabled()`, whether to issue a full session or a temp token; this
   feature's `verify2Fa()`/`verifyCode()` is the only consumer of that temp
   token and the only path back to `issueTokenAndSession()` from it. PRD
   FR-003, Integration Requirements.
2. **Guard-pairing dependency, not an owned boundary** — the temp token's
   inability to reach an authenticated route rests entirely on every
   `@UseGuards` site in the codebase pairing `JwtAuthGuard` with
   `SessionGuard`, a convention this feature does not enforce or check
   (`JwtStrategy.validate()` never inspects the `temp2fa` claim,
   `jwt.strategy.ts:21-31`). Already filed as `login/FINDINGS.md` IF-001;
   this feature inherits the same exposure and does not re-file it.
3. **Verification has no rate-limit dependency satisfied today** —
   `ADR-0013` (Accepted) would apply its global IP-keyed `ThrottlerModule`
   default to `/auth/2fa/verify` once implemented, but a repo-wide search
   (`grep -r "throttle\|Throttle\|ThrottlerModule"` across `backend/src`
   and `backend/package.json`) returns zero matches — no dependency,
   `@nestjs/throttler` import, module registration, or decorator exists
   anywhere in the backend. The route is unmitigated today, not
   partially mitigated.
4. **Admin impersonation bypasses this feature without touching it** —
   `impersonate()` never calls `TwoFactorService` or checks
   `is2FaEnabled()`; it issues a session through a code path entirely
   separate from `login()`/`verify2Fa()`. This is not a defect *in*
   `TwoFactorService` — the service behaves correctly for every call it
   receives — it is a property of a boundary this feature does not own.

### Inferred

1. **The `useEffect` refetch in `TwoFactorSettingsSection.tsx` was not
   designed to overwrite `enable()`'s own response** — inferred from the
   fact that `handleEnable` bothers to set `backupCodes` and
   `codesRevealed` from the response at all (`:64-65`) immediately before
   an effect with matching dependencies fires and discards it; a
   deliberate design would not populate state it's about to erase.
   Evidence: `TwoFactorSettingsSection.tsx:33-37,54-73`. This reads as an
   ordinary effect-dependency defect, not an architectural decision — see
   `FINDINGS.md` IF-001 (this feature's own).

## Candidate ADRs

Ranked by significance. Each is checked against what this feature actually
introduces versus what it inherits from an existing or already-flagged
decision.

### C-ADR-1 (new): Whether 2FA enrollment should invalidate other existing sessions

- **Significance:** High. This feature's core security promise (PRD G-001)
  is materially narrower than stated if enrollment doesn't take effect
  against sessions that predate it — the scenario most likely to motivate
  enabling 2FA (suspected account compromise) is exactly the one this gap
  leaves unaddressed.
- **Evidence it's undecided, not merely unimplemented:** `enable()`
  (`two-factor.service.ts:84-91`) writes only to `user_two_factor`.
  `deleteAllUserSessions()` exists and is called from exactly one site
  repo-wide, `resetPasswordWithCode()` (`auth.service.ts:179`) — a
  precedent for "this security-state change revokes existing sessions,"
  deliberately not reused here. No comment, test, or doc states this was a
  considered-and-rejected choice versus an oversight.
  `SessionGuard` (`session.guard.ts:27-32`) checks only token hash and
  expiry — it does not re-evaluate `is2FaEnabled()` per request, so there
  is no compensating per-request check either.
  `JWT_EXPIRY = '7d'` bounds the exposure window but does not close it.
- **Why this is genuinely this feature's decision, not inherited:** the
  precedent (`resetPasswordWithCode()`) belongs to `PRD-PasswordReset` /
  session management, but *whether 2FA enrollment should follow the same
  pattern* is a decision specific to this feature's own enable/disable
  lifecycle — no existing ADR states a general "sensitive account-state
  change revokes sessions" policy that would already cover this case by
  extension.
- **PRD linkage:** FC-013, Q-012.

### C-ADR-2 (new): Whether enabling 2FA should require step-up authentication (password re-verification)

- **Significance:** High. Without it, proof of authenticator possession
  (BR-003) only demonstrates that *whoever holds the current session*
  controls some authenticator — not that they are the legitimate account
  holder. A hijacked-session attacker can enroll their own device, making
  the compromise durable and effectively permanent (the legitimate holder
  has no code to disable it with).
- **Evidence it's undecided:** `GET /auth/2fa/setup` and
  `POST /auth/2fa/enable` require only `JwtAuthGuard, SessionGuard`
  (`auth.controller.ts:264-281`) — proof of an existing session, not
  re-proof of the account password. No other sensitive-action route in the
  auth module was found to require step-up auth either (checked: password
  change is out of this scan's scope but was not found gating on a
  re-entered password in the routes reviewed), so there's no existing
  in-repo pattern this feature is simply failing to follow — this is an
  open design question for the codebase generally, surfaced first here.
- **Why this is genuinely this feature's decision:** step-up authentication
  as a mechanism would likely be cross-cutting if adopted (useful for other
  sensitive changes too), but *whether 2FA enrollment specifically needs
  it* is this feature's own requirement to state, since it's the one
  action whose absence produces a durable, hard-to-reverse account
  takeover.
- **PRD linkage:** FC-010, BR-003, Q-010.

### Not promoted to a new candidate ADR

- **Attempt-counting / temp-token invalidation for `/auth/2fa/verify`**
  (PRD FC-001, Q-001) — `ADR-0013`'s own Context section already names
  this exact decision as explicitly deferred to this PRD, so it is this
  feature's design work, but it is *ADR-0013's* declared successor
  decision, not an independent new candidate; recommend it be raised as a
  follow-up ADR explicitly scoped as complementary to `ADR-0013` rather
  than filed fresh here, since its natural home is beside the mechanism
  it extends.
- **Temp-token scope enforcement (`temp2fa` claim check)** (PRD FC-002) —
  already `login/FINDINGS.md` IF-001, a `PRD-Login`-owned finding this
  feature inherits exposure from but does not originate. Not re-filed.
- **Admin impersonation's interaction with 2FA-enabled accounts** (PRD
  FC-006, FC-010) — considered as a candidate ADR and rejected for that
  role: `impersonate()` itself is `PRD-Login`/session-management-owned
  infrastructure this feature does not control, and `ADR-0011` (Proposed)
  already covers a related but distinct concern (the end-impersonation
  *restore* path's auth boundary), not this one (impersonation's *reach*
  into 2FA-protected accounts). Recording a decision here would mean
  deciding something about a mechanism this feature doesn't own. Filed
  instead as an Implementation Finding (`FINDINGS.md` IF-002) so the risk
  is on record without this PRD prescribing a fix to code outside its
  boundary.
- **Backup-code generation via `Math.random()`** (PRD FC-009) — a
  generation-algorithm choice, not an architectural decision (no component
  boundary, integration, or long-term structural tradeoff is implicated;
  swapping to `crypto.randomInt()` is a one-line, fully local change with
  a direct in-repo precedent already established for the same purpose in
  `auth.service.ts`). Filed as an Implementation Finding
  (`FINDINGS.md` IF-003).
- **TOTP secret retention at rest** (PRD FC-012) — the plaintext-at-rest
  property is inherent to TOTP (RFC 6238, PRD C-001) and not a decision
  this feature made; the *retention* aspect (never purged after disable)
  is evidence-backed but narrow enough, and close enough to `ADR-0012`'s
  already-accepted reasoning about at-rest secret handling, that it does
  not warrant a new ADR of its own. Filed as an Implementation Finding
  (`FINDINGS.md` IF-004), cross-referenced to `ADR-0012`.

## Documentation Gaps

- No architecture-level document states a general policy for when a
  sensitive account-state change should revoke existing sessions (only one
  concrete instance — `resetPasswordWithCode()` — exists in code, with no
  written rationale for why it does this and `enable()` does not). C-ADR-1
  would be the first ADR to establish this as an explicit policy rather
  than a single undocumented precedent.
- No architecture-level document addresses step-up authentication as a
  concept anywhere in this codebase. C-ADR-2 would be the first.

## Implementation Findings

Filed to `docs/features/two-factor-auth/FINDINGS.md`: IF-001 (new), IF-002
(new), IF-003 (new), IF-004 (new).

## C4 Diagram Assessment

**Not warranted.** This feature introduces no new container or component
boundary: `TwoFactorService` is a new module-internal class inside the
existing backend deployable, `user_two_factor` is a new table inside the
existing Postgres container, and every integration point (`login()`,
`issueTokenAndSession()`, the settings-page frontend routes) already exists
as an edge in whatever C4 component diagram covers the auth module today.
Both candidate ADRs (session revocation on enrollment, step-up
authentication) are internal-logic decisions within `AuthService`/
`TwoFactorService` — they change behavior on an existing edge, not the
edge's existence or direction. This holds even if either candidate ADR is
accepted: revoking sessions calls an already-existing method
(`deleteAllUserSessions()`) on an already-existing dependency
(`SessionsService`), and step-up auth would add a check inside an existing
route handler, not a new service or external dependency. Consistent with
prior features in this backlog (Registration, Login, Session Management,
Password Reset all concluded no diagram needed).
