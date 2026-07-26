# Architecture Discovery — User Registration

**Feeds:** `PRD-Registration` (docs/features/registration/PRD.md)
**Scope:** Feature-scoped, inventory/PRD-primary. Implementation inspected
only to verify architectural behavior and resolve ambiguity the PRD already
flagged (per `docs/foundation/DOCUMENTATION-STANDARDS.md`) — this is not
a full-repo scan.
**Produced by:** `architecture-toolkit:architecture-discovery`
**Date:** 2026-07-25

## System overview (scoped to this feature)

Registration is one endpoint inside NestJS's single-process `auth` module,
backed directly by Prisma/PostgreSQL — there is no queue, no separate
identity service, no async worker. `POST /auth/register` runs entirely
in-request: validate → uniqueness check → hash password → write `users` row
→ send welcome email → issue JWT + session row → respond. Every step is a
synchronous await in one call stack; nothing is decoupled or event-driven
anywhere in this path.

## Component inventory

| Component | Responsibility (as observed) |
|---|---|
| `AuthController` (`backend/src/auth/auth.controller.ts`) | HTTP boundary; `POST /auth/register` maps `RegisterDto` straight to `AuthService.register()` with no extra logic |
| `AuthService.register()` (`auth.service.ts:215-224`) | Orchestrates the whole flow: uniqueness check, hashing, user creation, mail trigger, session issuance — one method owns all of it |
| `UsersService.create()` (`users.service.ts:38-52`) | Single `prisma.user.create()` call; lowercases email; no transaction wrapper |
| `MailService` (`mail.service.ts`) | Wraps `nodemailer`; `sendWelcomeEmail` catches and logs its own errors so `AuthService` never sees a rejected promise; falls back to logging the message body when `SMTP_HOST` is unset |
| `SessionsService.createSession()` (`sessions.service.ts:13-21`) | Hashes the JWT and inserts a `user_sessions` row — no expiry enforcement beyond the stored `expiresAt` field |
| Prisma schema (`schema.prisma`) | `User.email` has a DB-level `@unique` constraint; `UserProfile` is a separate, optional 1:1 table not touched by plain `/auth/register` |

## Data flow

**Observed** (traced directly from source, not inferred):

```
Visitor → POST /auth/register
  → RegisterDto validated (class-validator, global ValidationPipe)
  → AuthService.register():
      1. usersService.findByEmail(email.toLowerCase())   [read]
      2. if found → throw UnauthorizedException           [no write happens]
      3. bcrypt.hash(password, 10)
      4. usersService.create({...})                       [write: users row]
      5. mailService.sendWelcomeEmail(...)                 [awaited; internally
                                                             try/catch'd, never throws]
      6. issueTokenAndSession(user):
           - jwtService.sign(...)
           - sessionsService.createSession(...)            [write: user_sessions row]
  → response: { access_token, user }
```

**Inferred** (not directly observed, reasoned from absence of evidence):

- Step 1→4 is **not transactional** and has **no unique-constraint-violation
  handling** — I searched the codebase for `ExceptionFilter`,
  `useGlobalFilters`, and `P2002` (Prisma's unique-violation error code) and
  found none. Inference: if two requests for the same email interleave
  between step 1 and step 4, both can pass the read check; the DB's
  `@unique` constraint on `User.email` (schema.prisma) would then reject the
  second `create()` call, and since nothing catches Prisma's
  `PrismaClientKnownRequestError`, it propagates as an unhandled exception —
  Nest's default error handler returns a generic 500. This is inferred from
  the *absence* of exception handling, not from having triggered the race
  — it has not been reproduced here, only reasoned from the code.
- `nodemailer.createTransport()` in `MailService.deliver()` is called with
  no `connectionTimeout`, `greetingTimeout`, or `socketTimeout` options.
  Inference: if the SMTP host is configured but slow or unresponsive, the
  `await this.deliver(...)` in `sendWelcomeEmail` — itself awaited by
  `register()` before the response is sent — has no code-level upper bound;
  it would fall back to Node's/the OS's default TCP behavior, which is
  materially longer than what a registration response should tolerate. Not
  reproduced, reasoned from the transporter config.
- No rate limiting exists anywhere in the app: I searched for
  `ThrottlerModule`, `@Throttle`, and found neither installed as a
  dependency nor referenced in `main.ts`/`app.module.ts`. `/auth/register`
  is reachable at unlimited rate today.

## Candidate ADRs

Ranked by significance — these are **candidates requiring confirmation**,
not settled decisions. Neither has a recorded rationale anywhere in the
repo, so "why it's this way" is genuinely unknown, not just undocumented.

### Candidate ADR 1 — Concurrency guarantee for unique-email registration

**Significance: High.** This is the more significant of the two because it
determines correctness under load, not just responsiveness, and PRD-Registration's
FC-001 already made the visitor-facing outcome a Must-level requirement
("indistinguishable from a sequential duplicate"). Today's read-then-write
with an unhandled DB constraint violation does not satisfy that requirement
under concurrency — it's a genuine open decision, not a formality.

Candidate options observed as generally available in this stack (not a
recommendation — that's `adr-expert`'s and the user's call):
- Wrap the check+create in a Prisma `$transaction`, still racy at the
  read/write boundary without a stronger isolation level or advisory lock.
- Catch Prisma's `P2002` unique-violation error at the `create()` call site
  and translate it to the same response FC-001 already specifies, treating
  the DB constraint as the actual source of truth instead of the earlier
  read.
- Add an application-level exception filter so this handling doesn't need
  to be duplicated at every `create()` call site across the codebase
  (relevant beyond just registration — `createAdmin`, `registerWithProfile`,
  and `createUserWithProfileAsAdmin` in the same service have the identical
  pattern).

### Candidate ADR 2 — Bounding or decoupling the welcome-notification trigger

**Significance: Medium.** Registration already succeeds/fails independently
of mail delivery (errors are swallowed) — the gap is specifically about
*response latency*, not correctness. PRD-Registration's Q-005 and FC-003
already flag this; discovery confirms the code has no existing timeout to
point to as the current behavior.

Candidate options observed as generally available in this stack:
- Add explicit timeout options to the `nodemailer.createTransport()` call
  (bounds the existing synchronous design, smallest change).
- Fire-and-forget the mail call (don't `await` it in the request path) —
  changes the failure-visibility story: today's `try/catch` inside
  `sendWelcomeEmail` guarantees the error is logged before the function
  returns; not awaiting it would need its own unhandled-rejection handling
  to preserve that guarantee.
- Move notification triggering off the request path entirely (queue/outbox)
  — the largest change, and notably this app has no queue infrastructure
  anywhere else (confirmed: no `bull`, `bullmq`, or similar in
  `package.json`), so this option would introduce a new infrastructure
  category, not just a code change.

## Documentation gaps

- No ADR exists for either candidate above, and no other doc in the repo
  (`ARCHITECTURE.md`, `docs/`) mentions either the concurrency behavior or
  the mail-transport timeout configuration — these are genuinely
  undocumented, not just undocumented *here*.
- No C4 diagram exists anywhere in the repo yet (`docs/architecture/c4/C4-CONTEXT.md`
  is the only one, at System Context level). This feature does not appear to
  warrant its own Container/Component diagram — it stays within the single
  existing backend service and doesn't introduce a new container. Flagging
  this as a finding, not deciding it: `c4-expert` should confirm whether the
  System Context diagram already covers what's needed here (Mail as an
  external system is already implied) or whether a Component-level view of
  the `auth` module would earn its cost given Candidate ADR 1 above touches
  four call sites, not just registration's.
- `RegisterDto`/`RegisterWithProfileDto`/`CreateUserDto` duplicate the same
  four validation fields across three files (email, password, displayName,
  plus profile fields in the latter two) — not architecturally significant
  on its own (a library/pattern choice, not a style decision), so **not**
  promoted to a candidate ADR, but noted since it's the kind of thing that
  compounds if left unaddressed across the 46 remaining backlog items.

## What this hands off to

- Candidate ADR 1 (concurrency) and Candidate ADR 2 (mail timeout) →
  `adr-expert`, if you confirm they're worth formalizing.
- No new C4 diagram recommended for this feature specifically — flagged
  above for `c4-expert` to confirm rather than decided here.
- No `arc42-expert` write-up scoped to a single feature — that's a
  whole-system exercise per the plan's Phase ordering, not per-feature.
