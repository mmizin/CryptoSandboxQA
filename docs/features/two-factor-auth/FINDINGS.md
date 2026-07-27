# Implementation Findings — Two-Factor Authentication

Scan source: architecture-discovery
Last scanned: 2026-07-27

### IF-001 — Settings-page effect overwrites just-received backup codes on every successful enable

- **Source:** architecture-discovery
- **Status:** Open
- **Observation:** `TwoFactorSettingsSection.tsx`'s `handleEnable`
  (`:54-73`) sets `enabled: true`, `setupInProgress: false`, and the real
  backup codes from `enable()`'s response, in that same state update.
  A `useEffect` at `:33-37` is keyed on exactly `[enabled, setupInProgress]`
  and calls `getBackupCodes()`, which the backend always returns as an
  empty array by design (`two-factor.service.ts:141-153`, since bcrypt
  hashes cannot be reversed). The effect has no guard distinguishing
  "just enabled, codes already held in state" from "mounted with 2FA
  already enabled, no codes held" — both conditions satisfy its dependency
  array.
- **Evidence:** `frontend/components/TwoFactorSettingsSection.tsx:33-37`
  (effect definition and dependency array) and `:54-73` (`handleEnable`
  setting the same two state variables the effect depends on, then the
  real codes, in the same function). `handleRegenerate` (`:101-106`) does
  not set `enabled` or `setupInProgress`, so it does not trigger the same
  effect.
- **Impact:** The backup codes displayed immediately after a successful
  `enable()` call are replaced by placeholder dashes (rendered at `:187`,
  `backupCodes.length > 0 ? backupCodes : ['—']`) within roughly one
  network round-trip of that success, on every enable, not only on a later
  page revisit or a lost network response.
- **Confidence:** High
- **Related:** PRD-TwoFactorAuth FC-014, FC-005, FC-008, G-002

### IF-002 — Admin impersonation performs no 2FA check before granting a full session

- **Source:** architecture-discovery
- **Status:** Open
- **Observation:** `AuthService.impersonate()` mints a session token and
  `user_sessions` row for an arbitrary target user given only a role check
  on the calling admin. It does not call `TwoFactorService.is2FaEnabled()`
  or any equivalent check, and does not go through `login()` or
  `verify2Fa()` at all.
- **Evidence:** `backend/src/auth/auth.service.ts:457-495` — no reference
  to `TwoFactorService`, `is2FaEnabled`, or `twoFactor` appears in the
  method body or its call chain.
- **Impact:** Any admin can obtain a fully authenticated session for a
  2FA-enabled account without presenting a TOTP code or backup code,
  through a code path this feature's own guards and checks never execute.
- **Confidence:** High
- **Related:** PRD-TwoFactorAuth FC-006, FC-010, A-002 (retired)

### IF-003 — Backup codes are generated with `Math.random()`, not a cryptographically secure source

- **Source:** architecture-discovery
- **Status:** Open
- **Observation:** `generateBackupCodes()` draws each character via
  `Math.floor(Math.random() * chars.length)` against a fixed 32-character
  alphabet. `Math.random()` provides no cryptographic unpredictability
  guarantee. The same codebase uses `crypto.randomInt()` for a comparable
  purpose (password-reset code generation) in a different module.
- **Evidence:** `backend/src/auth/two-factor.service.ts:222-233`
  (`generateBackupCodes()`); contrast `backend/src/auth/auth.service.ts`
  use of `crypto.randomInt()` for password-reset codes. Additionally,
  `POST /auth/2fa/backup-codes/regenerate`
  (`auth.controller.ts:303-311`, `two-factor.service.ts:155-174`) allows
  any authenticated user to repeatedly invoke this generator against their
  own account with no rate limit present in the codebase (repo-wide search
  for `throttle`/`Throttle`/`ThrottlerModule` in `backend/src` and
  `backend/package.json` returns no matches).
- **Impact:** Backup codes are drawn from a non-cryptographic,
  process-global random source that any authenticated user can sample
  repeatedly and without limit via the regenerate endpoint.
- **Confidence:** High
- **Related:** PRD-TwoFactorAuth FC-009

### IF-004 — A disabled account's TOTP secret is retained indefinitely at rest, in plaintext

- **Source:** architecture-discovery
- **Status:** Open
- **Observation:** `disable()` clears `enabled`, `enabledAt`, and (on the
  TOTP-code branch only) `backupCodes`, but never writes to the `secret`
  column. `secret` is declared non-nullable in the schema and is not reset
  to an empty value by any code path found. A row's secret, once written by
  `getSetup()`, persists in the database for as long as the row exists,
  regardless of whether 2FA is currently enabled.
- **Evidence:** `backend/src/auth/two-factor.service.ts:112-115,126-133`
  (`disable()`, no write to `secret` in either branch);
  `backend/prisma/schema.prisma:63-76` (`secret String`, non-nullable, no
  default enabling a cleared state).
- **Impact:** A database compromise yields standing TOTP-bypass capability
  for every account that has ever called `getSetup()`, not only accounts
  with 2FA currently enabled, since disabling does not remove the secret
  that would let an attacker compute valid codes for that account if 2FA
  were re-enabled or if the value were otherwise exploited.
- **Confidence:** High
- **Related:** PRD-TwoFactorAuth FC-012, ADR-0012 (same class of at-rest
  secret risk, different mechanism)
