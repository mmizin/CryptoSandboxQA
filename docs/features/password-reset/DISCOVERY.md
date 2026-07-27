# Architecture Discovery — Password Reset

Scan source: architecture-discovery
Scope: the 8-digit-code password reset mechanism only (`requestPasswordReset()`,
`resetPasswordWithCode()`, `hashResetCode()`, `user_password_resets`); does
not re-scope session revocation, mail delivery internals, or login, which
are (or will be) covered by their own discoveries.
Primary input: `docs/features/password-reset/PRD.md` (Status: Review)
Secondary input (consulted for consistency, not re-derived):
`docs/features/session-management/DISCOVERY.md`,
`docs/features/session-management/FINDINGS.md`,
`docs/features/login/DISCOVERY.md`,
`docs/architecture/adr/0009-notification-delivery-boundary-on-request-path.md`
Last scanned: 2026-07-27

## System Overview

Password Reset is not a standalone component — it is two `AuthController`
routes (`POST /auth/forgot-password`, `POST /auth/reset-password`) backed by
two `AuthService` methods and one Prisma model (`user_password_resets`),
reusing `MailService` for delivery and `SessionsService` for its one
downstream effect (revoking every session on success, `PRD-SessionManagement`
FR-004). Its defining property, evidenced directly in code, is that both
routes are intentionally unauthenticated and every response is engineered to
look identical regardless of whether the target account exists — the
anti-enumeration posture the PRD's G-002 states and ADR-0009 (Accepted, not
yet implemented) is already positioned to close one gap in. This discovery's
job is to determine whether the PRD's remaining named gaps (pepper fallback,
rate limiting, BR-002's atomicity) are genuinely architectural or merely
implementation detail — they are architectural, and are recorded as
candidate ADRs below.

## Component Inventory

| Component | Responsibility | Evidence |
|---|---|---|
| `AuthController` (`backend/src/auth/auth.controller.ts`) | Exposes `POST /auth/forgot-password` (`:72-83`) and `POST /auth/reset-password` (`:85-96`); neither route carries `@UseGuards` | `auth.controller.ts:72-96` |
| `AuthService.requestPasswordReset()` (`auth.service.ts:109-140`) | Looks up user by normalized email; on match, deletes any prior unused code, generates and hashes a new one, persists it, sends it by mail; on no match, returns immediately with no side effects | `auth.service.ts:109-140` |
| `AuthService.resetPasswordWithCode()` (`auth.service.ts:142-181`) | Looks up user; matches a `user_password_resets` row on `userId` + `codeHash` + `usedAt: null` + `expiresAt > now`; on match, updates `passwordHash` and marks the row used inside `this.prisma.$transaction`, then calls `sessionsService.deleteAllUserSessions()` **after** that transaction resolves | `auth.service.ts:142-181` (transaction at `:168`, session call at `:179`) |
| `AuthService.hashResetCode()` (`auth.service.ts:183-189`) | `HMAC-SHA256(pepper, code)`; pepper resolved `PASSWORD_RESET_CODE_PEPPER` → `JWT_SECRET` → literal `'dev-secret-change-in-production'` | `auth.service.ts:183-189` |
| `UserPasswordReset` Prisma model (`schema.prisma:92-104`) | Persistence: `userId`, `codeHash`, `expiresAt`, `usedAt`, `createdAt`; `@@index([userId])` only, no index or uniqueness on `codeHash`; `onDelete: Cascade` on the user relation | `schema.prisma:92-104` |
| `MailService.sendPasswordResetCode()` (`mail.service.ts:53-60`) | Delivers the code; unlike the module's other four send methods, has no `try/catch` around its call into `deliver()` | `mail.service.ts:53-60`, contrasted with `:63,90,123,141` |
| `frontend/app/forgot-password/page.tsx`, `frontend/app/reset-password/page.tsx` | Single-step email-request UI; separate code+new-password+confirm-password UI with client-only confirmation check and a 2-second post-success redirect | Read directly; see PRD Current Behavior |

Checked and found not to be a separate credential path relevant to this
feature: `AdminApiKeyGuard` (static header key, no JWT) guards only admin
bootstrap and has no interaction with password reset.

## Data Flows

### Observed (directly evidenced)

1. **Request-side anti-enumeration** — `requestPasswordReset()` returns the
   identical generic message whether or not the account exists; the
   no-account path does strictly less work (one lookup, then return) than
   the known-account path (delete, HMAC, create, mail send), which is a
   timing difference regardless of the mail call's outcome. PRD G-002,
   FC-004.
2. **Content/status divergence on mail failure, SMTP-configured only** —
   `sendPasswordResetCode()` is awaited directly by `requestPasswordReset()`
   with no surrounding `try/catch` at either call site; when `SMTP_HOST` is
   set and the transport throws, the error propagates out of the request
   unhandled on the known-account path only (the unknown-account path never
   reaches the mail call). When `SMTP_HOST` is unset, `deliver()` logs and
   returns without attempting a network call, so this path cannot fail.
   ADR-0009 (Accepted) already targets exactly this call site by name
   ("Bringing `sendPasswordResetCode` in scope," Option B applied narrowly
   to it) but is verified not yet implemented: `deliver()` still has no
   `try/catch` (`mail.service.ts`), `createTransport` still has no
   `connectionTimeout`/`greetingTimeout`/`socketTimeout`, and
   `auth.service.ts:138` still awaits the send directly. PRD FC-001, G-002,
   Q-003.
3. **Pepper fallback chain shares its terminal literal with JWT signing** —
   `hashResetCode()`'s fallback chain terminates at the literal
   `'dev-secret-change-in-production'` (`auth.service.ts:187`). Independently,
   `AuthModule`'s JWT signing (`auth.module.ts:24`) and `JwtStrategy`
   (`jwt.strategy.ts:17`) fall back to the **identical literal string** when
   `JWT_SECRET` is unset. This means: with no env vars set at all, the
   reset-code pepper and the JWT signing secret are not just independently
   weak, they are the *same* value — a JWT secret compromise and a
   reset-code pepper compromise become one and the same event in that
   configuration, not merely "one leak compromises the other" as the PRD's
   C-001 states for the `JWT_SECRET`-configured-but-no-pepper case. Neither
   `backend/.env.example` (not found in the repo) nor any file discovery
   located documents `PASSWORD_RESET_CODE_PEPPER` as a variable to set. PRD
   C-001, Q-004.
4. **No rate limiting anywhere in the backend** — repo-wide search for
   `@Throttle`, `ThrottlerModule`, or a `throttl*` package dependency found
   none, confirming PRD FC-003's finding is not local to these two routes
   but reflects the entire backend having no request-rate-limiting
   mechanism at all (`app.module.ts` has no `ThrottlerModule.forRoot()`;
   `package.json` has no `@nestjs/throttler` or equivalent). PRD FC-003,
   Q-002; the same absence `PRD-Login` Q-002 already records for the login
   endpoint.
5. **BR-002's "one unused code" invariant is enforced by call-sequencing
   only** — `requestPasswordReset()`'s `deleteMany` (`:121-123`) and
   `create` (`:130-136`) are two separate, unwrapped `await`s with a
   randomInt call and an HMAC computation between them; neither is inside
   `this.prisma.$transaction`, unlike `resetPasswordWithCode()`'s
   password-update path, which is (`:168`). No unique or partial-unique
   constraint on `user_password_resets` backs the invariant either
   (`@@index([userId])` only). Two concurrent `forgot-password` requests
   for the same account can each pass the `deleteMany` before either
   reaches `create`, leaving two live unused codes. PRD BR-002, FC-003,
   Q-002.
6. **Session invalidation happens outside and after the password-change
   transaction** — `deleteAllUserSessions()` (`:179`) is called after
   `resetPasswordWithCode()`'s `$transaction` (`:168`) has already resolved,
   not inside it. This is the same ordering `PRD-SessionManagement` FC-006
   already documents at this call site (`session-management/DISCOVERY.md`
   Data Flow 4 references it too) — not a new condition, only this
   feature's instance of triggering it. PRD FC-002.

### Inferred

- **The anti-enumeration posture is a deliberate, evidenced design goal, not
  an accident.** Inferred from `requestPasswordReset()`'s own inline
  comment ("Same response whether or not the email exists (avoid account
  enumeration)"), the identical generic-error collapsing of four distinct
  failure cases in `resetPasswordWithCode()`, and BR-001/BR-002's explicit
  single-use and replacement rules, which only make sense as anti-replay
  measures for a code that is assumed to be shared to only one person.
  Evidence: `auth.service.ts:108, 154-165`. This inference supports why
  candidate ADR 1 below is worth resolving at the architecture level rather
  than dismissed as unimportant polish.
- **The pepper's design intent was probably "separate secret from JWT
  signing," not "reuse it."** Inferred from `PASSWORD_RESET_CODE_PEPPER`
  being a distinct env var name rather than a direct reuse of `JWT_SECRET`
  in the code — if reuse were intended, the fallback chain would likely
  skip straight to `JWT_SECRET` as the primary source, not as a
  second-choice fallback behind a dedicated variable. No comment or
  documentation confirms this; treated as a plausible read of the code
  shape, not a settled fact — see candidate ADR 2.

## Candidate ADRs

Ranked by significance — decisions with real consequences and no recorded
rationale, not implementation detail.

### 1. Rate limiting / abuse-prevention design for unauthenticated auth-adjacent endpoints — Resolved by ADR-0013 (Accepted)

No rate limiting, throttling, or lockout mechanism exists anywhere in the
backend (Data Flow 4). For password reset specifically this produces three
distinct, evidenced harms the PRD already separates (FC-003): code
brute-force across multiple issuance windows, a denial-of-recovery race
enabled by BR-002 (Data Flow 5's finding sharpens this: the race is not
just "issue a fresh code to invalidate the old one," it can also be won by
exploiting the non-atomic invalidate-then-create window itself), and mail
amplification. The identical gap is independently recorded on the login
endpoint (`PRD-Login` Q-002). This is architectural because it needs a
decision with real alternatives and system-wide consequences — a global
`ThrottlerModule` guard, a per-route decorator, a per-account/per-address
strategy, or an accepted-risk call for a training sandbox — not a
local fix to one controller method. **Recommend an ADR**, scoped at the
auth-module (or wider) level rather than per-feature, since the same gap
recurs on at least one sibling endpoint (login) with no shared mechanism
between them today.

### 2. Reset-code pepper: dedicated secret vs. fallback-to-JWT_SECRET vs. hardcoded default — Resolved by ADR-0012 (Accepted)

`hashResetCode()`'s three-tier fallback (`PASSWORD_RESET_CODE_PEPPER` →
`JWT_SECRET` → a hardcoded literal that is also JWT signing's own terminal
fallback, Data Flow 3) is a real security-boundary decision with no
recorded rationale: should reset-code hashing require its own secret with
no fallback (fail closed if unset), fall back to `JWT_SECRET` deliberately
(accepting the coupling), or is the current chain a deliberately weak
training-sandbox default in the same spirit as `SIMULATED_PERSIST_DELAY_MS`?
The shared terminal literal (found in this scan, not previously documented
in the PRD) sharpens the stakes: in the zero-env-vars case, compromising
one secret is compromising both. This is squarely the backlog's named
"pepper design" ADR candidate. **Recommend an ADR.**

### Not promoted to candidate ADR

- **BR-002's non-atomic "one unused code" invariant** (Data Flow 5) has a
  real alternative (wrap `deleteMany`+`create` in a transaction, or add a
  partial unique index on `(userId)` `WHERE usedAt IS NULL`) but is narrow
  in scope — one method, one race window — relative to candidates 1 and 2.
  Not promoted to its own numbered candidate; recorded here so it is not
  silently dropped. **Fold into candidate 1's ADR** when drafted, on the
  grounds that it is the same method and code path candidate 1 already
  touches — **not**, as this entry originally reasoned, because a
  per-account request throttle would close the race: a throttle reduces
  how *often* two requests race, it does not make either request's result
  atomic (`ADR-0013`, once drafted, made the identical correction and
  rejected both alternatives listed above — a transaction wrapper doesn't
  serialize under this database's default isolation level, per `ADR-0008`;
  a raw-SQL partial index isn't expressible in this repo's Prisma-managed
  schema workflow — adopting instead a schema-declarative unique
  constraint).
- **FC-001 / content-status divergence on SMTP-configured mail failure**
  (Data Flow 2) already has a recorded decision: ADR-0009 (Accepted) names
  `sendPasswordResetCode` specifically and decides its fix (Option A+D,
  plus Option B narrowly for this method). Verified not yet implemented in
  code, which is an implementation-tracking gap, not a missing decision —
  no new ADR is warranted; the existing one needs to land. PRD Q-003
  already asks the scheduling question this discovery would otherwise
  raise.
- **FC-002 / session invalidation after the password-change transaction
  commits, not inside it** (Data Flow 6) is the identical condition
  `PRD-SessionManagement` FC-006 already documents at the same call site,
  independently confirmed by `session-management/DISCOVERY.md`. Not a new
  candidate here — any ADR resolving it belongs to session management's
  scope, not password reset's, since the call site's caller-side behavior
  (call `deleteAllUserSessions()` and don't further guard it) is identical
  regardless of which feature triggers it.
- **Unindexed `codeHash`** — `user_password_resets` has no index on
  `codeHash` itself, only `@@index([userId])`. Not promoted or filed as an
  Implementation Finding: every query against this table filters by
  `userId` first (an indexed column) with `codeHash` as a secondary
  equality filter on an already-narrow per-user row set, unlike
  `SessionsService`'s `tokenHash`-only lookup (`session-management`
  `FINDINGS.md`, unindexed and queried alone). No evidence of a comparable
  performance risk here.

## Documentation Gaps

- No `PRD-SMTPConfiguration` exists yet (backlog row 15, Not Started) despite
  this feature depending on `MailService.sendPasswordResetCode()`'s
  delivery behavior — PRD Q-001 already raises this as an open question,
  not newly found here.
- `PASSWORD_RESET_CODE_PEPPER` is not documented in any example-env file
  found in the repository (no `backend/.env.example` located during this
  scan) — an operator configuring this system from scratch has no written
  cue that the variable exists or what value class it expects. Relevant to
  candidate ADR 2, whichever way it resolves.
- No C4 diagram is warranted for this feature. `AuthController`,
  `AuthService`, `MailService`, `SessionsService`, and Postgres are all
  already-documented containers/components (`docs/architecture/c4/C4-CONTEXT.md`
  already shows the backend-to-SMTP and backend-to-Postgres boundaries at
  context level); this feature adds two routes and one table inside an
  existing container, with no new external system, no new container, and
  no new component boundary crossed. This matches the precedent set by
  Registration and Login, both of which reached the same conclusion for
  the same reason.
