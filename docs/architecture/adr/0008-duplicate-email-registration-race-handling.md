# Handle duplicate-email registration races via a `UsersService`-scoped constraint translation

**Status:** Accepted

**Date:** 2026-07-25
**Revision 1:** 2026-07-25 — reworked after `architecture-reviewer` found
the original global-filter decision unsafe. See
`docs/architecture/findings/ARCHITECTURE-REVIEW-FINDINGS.md`
(FINDING-0001, FINDING-0002, FINDING-0003) for the full findings that
revision resolved.
**Revision 2:** 2026-07-25 — a manual exhaustiveness audit of the
`UsersService`-scoped whitelist (requested explicitly, because a whitelist
is only as good as its completeness) found it covered 3 of 5 real write
paths, and missed the `username` invariant entirely. See FINDING-0009.
**Revision 3:** 2026-07-25 — `architecture-reviewer` re-review of Revision
2 found the expanded whitelist itself was exhaustive, but two defects in
*what the catch does once it fires*: it doesn't satisfy FC-001 (status
code still diverges between the pre-check and the race path), and it can
catch the wrong constraint in the three `upsert`-based methods. See
FINDING-0011, FINDING-0012.
**Revision 4:** 2026-07-25 — a third re-review found Revision 3's status-code
fix incomplete: it unified the *status code* but not the *message text*
(FC-001 covers the whole visitor-facing response, not the code alone),
left `registerWithProfile`'s username pre-check unconverted, and the
Context section still carried a stale count and an overbroad "all five
share one shape" claim the Revision 2 audit had already contradicted.
Editorial fixes only — no re-decision. See the corrections below.
**Revision 5:** 2026-07-25 — a fourth review pass confirmed Revision 4's
fixes hold, and found one residual the "every path" claim overstated:
`updateByAdmin`/`replaceByAdmin` keep an `ensureEmailAvailable` pre-check
with different wording than the canonical wording their own race-path
catch now produces — a within-admin-endpoint divergence outside FC-001's
scope, not previously called out. Also corrected: endpoint count (six, not
five) and the openapi note (decorators must be added before regeneration
produces anything). Editorial only. Reviewer's explicit recommendation:
ready for `Status: Accepted`; a fifth pass is not expected to change the
decision. See FINDING-0019.

## Context

There are five call sites relevant to this decision — four `AuthService`
methods that create a `User` row (`register`, `createAdmin`,
`registerWithProfile`, `createUserWithProfileAsAdmin`), plus
`UsersService.ensureEmailAvailable`, which guards an email-change update —
and, separately, five `UsersService` methods this ADR's fix touches
(enumerated in "Exhaustiveness audit" below). These are two different sets
that happen to share a size; they are not renamed further here because
each is unambiguous in its own context, but this note exists because
Revision 3's re-review found the coincidence genuinely confusing on a
first read.

Not all five call sites follow one shape — `register`, `createAdmin`,
`registerWithProfile`, and `ensureEmailAvailable`'s callers all read
(`findByEmail`) before writing; `updateProfile` (see the audit below) does
not check anything before writing `username`. The read-then-write shape
that *does* apply to the checked paths is never wrapped in the same
transaction as the write (only two of the five `UsersService` methods this
ADR touches — `createWithProfile`, `replaceByAdmin` — use
`prisma.$transaction` for the write itself, and even there the transaction
starts after the read, which is the part that matters for this decision).
No code path anywhere in `backend/src` catches Prisma's unique-constraint
violation (`P2002`) or registers a NestJS `ExceptionFilter` for it —
confirmed by search, not inferred.

**Exhaustiveness audit (Revision 2).** Revision 1 of this ADR scoped its
fix to 3 `UsersService` methods (`create`, `createWithProfile`,
`replaceByAdmin`), chosen because they looked like the write methods behind
the known call sites. An explicit audit of every `prisma.user.*` and
`prisma.userProfile.*` write in `backend/src` (not just the call sites this
ADR started from) found that whitelist incomplete on two counts:

- **`UsersService.updateByAdmin()`** also writes `email`
  (`users.service.ts:377`), guarded by the same `ensureEmailAvailable`
  pre-check pattern as `replaceByAdmin`, with the identical race gap and no
  `P2002` handling. It was missing from the original whitelist entirely.
- **`UserProfile.username` is also `@unique`** (`schema.prisma`), and it is
  written by three methods — `createWithProfile`, `updateByAdmin`, and
  `replaceByAdmin` — of which only `createWithProfile` has ever checked
  username availability (`findByUsername`) before writing.
  **`UsersService.updateProfile()` — the self-service, non-admin profile
  endpoint — writes `username` via `userProfile.upsert()` with *no*
  pre-check at all** (`users.service.ts:297-358`). This is not a race
  condition: it is an unhandled 500 on an ordinary, sequential, single-user
  submission of an already-taken username, today, ADR or no ADR.

Two other write surfaces were checked and are **not** in scope: the generic
`UsersService.update()` method (`users.service.ts:288`) has no callers
anywhere in the codebase — dead code, not a live gap, and should be deleted
rather than left as a method that would technically satisfy this ADR's
governing rule (see "Governing rule, and its two loopholes" below) if it
were ever wired up unmodified. The three `backend/prisma/seed-*.js`
scripts (only `seed-lib.js` actually creates users) run as standalone Node
scripts outside the NestJS/HTTP runtime entirely (self-documented "safe to
run multiple times"), a different failure domain than this ADR addresses.
Also checked: `AuthService.resetPasswordWithCode()` writes `tx.user.update()`
directly (`auth.service.ts:169`, bypassing `UsersService` entirely) — but
only touches `passwordHash`, never `email`/`username`, so it is not a live
gap. It is, however, proof that a write bypassing `UsersService` is
possible in this codebase, which is why the governing rule below has a
second clause.

`User.email` carries a database-level `@unique` constraint
(`schema.prisma`), so two rows can never end up with the exact same stored
string — but see "Case-insensitivity is not enforced by this constraint"
below; the guarantee is narrower than it first appears. What's unhandled is
the *race window* between the read and the write: two concurrent requests
for the same not-yet-registered email can both pass the read check, and the
loser's `create()` call then throws a raw `PrismaClientKnownRequestError`
that nothing catches, surfacing as an unhandled 500.

`PRD-Registration` (`docs/features/registration/PRD.md`, FC-001) makes this
a Must-level product requirement: a concurrent duplicate attempt must
produce the same visitor-facing outcome as a sequential one. The four other
call sites are not currently in scope of any PRD but share the identical
defect, and are already visibly inconsistent with each other: `register()`
responds `401` ("Email already registered"), while
`createUserWithProfileAsAdmin()` and `ensureEmailAvailable()` both respond
`409` for the same condition.

**A second, load-bearing consumer exists that the original version of this
ADR missed.** `AuthService.bulkImportUsersFromFile()` calls
`createUserWithProfileAsAdmin()` **in-process**, and distinguishes a
`skipped` row from a `failed` row by checking
`if (e instanceof ConflictException)` (`auth.service.ts:419-435`). This
branching was introduced deliberately alongside the bulk-import feature
(commit `e6c4f7d`, "implement bulk user import and export functionality")
to produce a three-way `created`/`skipped`/`failed` response — it is a real
contract, not an accident, even though it was never written down as one
before now. No tests exist to verify this (test infrastructure was removed
repo-wide — see `1d642ae`/`003842a`), so intent was confirmed from the code
and commit history rather than from a spec. **Any mechanism this ADR
chooses must preserve `ConflictException` as the thrown type for this
internal caller, not only for HTTP responses.**

## Decision Drivers

- **Correctness under concurrency** — the read-then-write gap is a real,
  reproducible defect, not a hypothetical.
- **Preserve existing exception-type contracts for internal callers** —
  whatever mechanism is chosen must keep throwing `ConflictException` (or a
  type internal callers can still catch) for `bulkImportUsersFromFile`,
  which does not go through the HTTP layer.
- **Scope the fix to the boundary that owns the invariant** — user
  uniqueness is a `UsersService` concern; the mechanism should not reach
  into unrelated domains (balances, profiles-as-invariant, 2FA) that
  happen to also have unique constraints.
- **Blast radius** — one fix pattern needs to cover the 5 known call sites
  without being re-derived at each one, but "cover" must not mean
  "silently reinterpret every unique constraint in the schema."
- **Reversibility** — favor a mechanism that doesn't lock in a framework
  dependency beyond what's already in place (NestJS + Prisma + Postgres).

## Assumptions

- Registration throughput in this sandbox is low enough that the race is
  rare in practice, but the PRD requires it be *handled* regardless of
  frequency — this ADR does not assume the race needs to be prevented at
  high scale, only that its outcome must be well-defined.
- No plan exists to move off Postgres/Prisma; options are evaluated within
  that constraint.
- `bulkImportUsersFromFile`'s `instanceof ConflictException` branching is
  treated as a real, permanent contract per the investigation above, not as
  incidental behavior safe to break.

## Considered Options

### Option A — Wrap check + create in `prisma.$transaction`, no other change

- **Advantages:** Groups the read and write as one logical unit; consistent
  with `$transaction` usage elsewhere in the codebase for the write itself.
- **Disadvantages:** Does not close the race. Postgres's default isolation
  level (Read Committed) still allows two concurrent transactions to both
  read "not found" before either commits its write — a transaction wrapper
  alone doesn't serialize the check against concurrent inserts. Closing it
  properly would need `SERIALIZABLE` isolation (which converts the race
  into a `40001` serialization failure requiring explicit retry logic, not
  a clean fix) or an explicit lock, either of which this codebase has no
  precedent for.
- **Risks:** Gives a false sense of correctness — code reads as
  "transaction = safe" without being safe under the race this ADR exists
  to fix.

### Option B — Global NestJS `ExceptionFilter` mapping any Prisma `P2002` to `409 Conflict`, app-wide

*(This was the originally chosen option. Rejected in this revision — kept
here, demoted, so the reasoning against it is preserved rather than
deleted.)*

- **Advantages:** A single interception point; would catch `P2002` from any
  call site that lets it propagate to the HTTP layer.
- **Disadvantages, decisive:**
  - **Does not cover `bulkImportUsersFromFile`.** A `ExceptionFilter` only
    intercepts exceptions that escape a route handler to the framework's
    HTTP exception layer. `bulkImportUsersFromFile` catches
    `createUserWithProfileAsAdmin`'s exception in-process; a global filter
    never runs in that path. This alone disqualifies the option given the
    Decision Driver above.
  - **Blast radius is not just email/username.** The schema carries at
    least 10 unique constraints. Several — `UserProfile.userId`,
    `UserTwoFactor.userId`, and critically
    `UserBalance @@unique([userId, assetId])` inside the settlement path
    `CLAUDE.md` calls "critical for testing" — represent *internal
    invariant violations*, not user-correctable input conflicts. A global
    filter would convert what should be a loud 500 (a real
    balance-accounting bug) into a quiet, misleadingly client-shaped 409.
    This is an observability regression in the app's highest-stakes code
    path, introduced as a side effect of a registration-scoped decision.
- **Risks:** Even restricted to a safe subset of constraints, a global
  filter creates an app-wide policy surface that every future unique
  constraint silently joins unless explicitly excluded — the wrong default
  direction for a mechanism meant to fix one domain's problem.

### Option C — Translate `P2002` inside `UsersService`, at every write that touches a user-uniqueness invariant

Catch the unique-constraint violation inside every `UsersService` method
that writes `users.email` or `user_profiles.username` — confirmed by the
Revision 2 audit above to be **five** methods (`create`,
`createWithProfile`, `updateByAdmin`, `replaceByAdmin`, `updateProfile`),
not the three originally identified — and re-throw the existing
`ConflictException` type with the existing message shape.

- **Advantages:** Scoped exactly to the boundary that owns the invariant —
  `UsersService` is where user/profile uniqueness is already a concern
  (`ensureEmailAvailable` lives there). Preserves `ConflictException` as the
  thrown type for every caller, HTTP or internal — `bulkImportUsersFromFile`
  needs no change. Unrelated constraints (balances, 2FA, assets) are
  completely untouched — they continue to surface as 500s, which is the
  correct behavior for an internal invariant violation. Fixes
  `updateProfile`'s pre-existing, non-race, always-reproducible
  duplicate-username 500 as a direct consequence, not a separate fix.
- **Disadvantages:** Does not automatically cover a *future* `UsersService`
  method that writes `email` or `username` without going through one of
  these five — a whitelist is only as strong as its last audit, and this
  ADR's own Revision 2 is direct evidence that a whitelist drifts out of
  sync with the code silently. Narrower blast radius than a global filter,
  but that same narrowness is what makes completeness the reader's
  responsibility rather than the framework's.
- **Risks:** Needs `meta.target` from Prisma's `P2002` error correctly
  mapped to `email` vs. `username` to keep today's distinct messages
  ("Email already registered" vs. "Username already taken") — verified
  against Prisma's actual error shape before shipping, not assumed. The
  whitelist-completeness risk above is real enough that it's carried
  forward as a named Risk, not just a disadvantage — see Risks section.

## Decision

**Option C** — translate `P2002` inside the five `UsersService` write
methods identified above (`create`, `createWithProfile`, `updateByAdmin`,
`replaceByAdmin`, `updateProfile`), re-throwing the same `ConflictException`
type and message shape these paths already use, covering **both**
`users.email` and `user_profiles.username` — not email alone, since the
audit found `username` had effectively no coverage anywhere except
`createWithProfile`.

### Governing rule, and its two loopholes

The governing rule going forward, stated explicitly so a future reviewer
can check new code against it rather than against a list that will drift:
**any `UsersService` method that writes `users.email` or
`user_profiles.username` must catch that field's `P2002` and re-throw
`ConflictException`.** The five methods above are today's complete
enumeration of that rule, not the rule itself.

That rule has two loopholes, both surfaced by re-review, both closed here:

1. **Which constraint, not just which method.** The three `upsert`-based
   methods (`updateProfile`, `updateByAdmin`, `replaceByAdmin`) call
   `userProfile.upsert({ where: { userId }, ... })`, and
   `UserProfile.userId` is *itself* `@unique` (`schema.prisma:43`). A race
   on the upsert can throw `P2002` on `userId` — an internal
   one-profile-per-user invariant violation, not a user-correctable
   `email`/`username` conflict. **The catch must inspect Prisma's
   `meta.target` and only translate to `ConflictException` when the target
   is `email` or `username`; any other target (`userId`, or anything else)
   must be re-thrown untouched.** Skipping this check would do, at
   `UsersService` scope, exactly what disqualified Option B at app scope:
   converting a loud, correct 500 into a quiet, misleading 409. This is not
   optional implementation detail — it's part of the decision.
2. **Scoped by class, not by column.** The rule as stated only binds
   methods on `UsersService`. Nothing stops a different service from
   writing `users.email` or `user_profiles.username` directly — and
   `AuthService.resetPasswordWithCode()` demonstrates this is possible in
   this codebase today (see Context). It happens to be safe (only writes
   `passwordHash`), but the rule's guarantee actually rests on an unstated
   second rule: **all writes to `users.email` and `user_profiles.username`
   go through `UsersService`.** Stating it here so it's checkable, not
   assumed.

### Closing the FC-001 gap: the pre-check and the race-path must throw the same thing

The existing pre-checks (`findByEmail` before create, `findByUsername`
where present, `ensureEmailAvailable` before update) **stay in place** as a
fast path — they give immediate feedback for the overwhelming majority of
real duplicate attempts (which are sequential, not raced) and avoid the
cost of hashing a password before finding out the email is taken. They are
explicitly **not** the correctness guarantee; the `UsersService`-level
catch is. `updateProfile` gains a `P2002` catch for `username` where it
previously had **no** guard of any kind — this closes a real, always
reproducible bug, not only the race case the rest of this ADR is about.

**Re-review correctly found a defect here that Revision 2 did not close:**
stating that "both paths throw the same exception type" was false as
written. `register()`, `createAdmin()`, and `registerWithProfile()` still
throw `UnauthorizedException` (401) from their pre-checks; the
`UsersService`-level catch throws `ConflictException` (409). A sequential
duplicate hits the pre-check and gets 401; a raced duplicate skips the
pre-check and gets 409 from the catch. That is precisely the
outcome-depends-on-timing behavior `PRD-Registration` FC-001 forbids, and
Revision 2 deferred it to Q-004 instead of closing it — Q-004 is about
*disclosure posture* (should registration confirm account existence at
all, matching or diverging from password reset's anti-enumeration design),
which is legitimately still open; it is not license to leave the
pre-check and the race-path disagreeing with each other in the meantime.

**This decision therefore also requires:** `register()`, `createAdmin()`,
`registerWithProfile()`'s email-uniqueness pre-check, **and**
`registerWithProfile()`'s username-uniqueness pre-check (`auth.service.ts:267`,
`UnauthorizedException('Username already taken')` — the fourth pre-check
this decision touches, easy to miss because it's the only username case
among otherwise email-only pre-checks) are all changed from
`UnauthorizedException` to `ConflictException`. `409 Conflict` is chosen as
the interim unified code (matching the sites that already use it)
specifically because it's the code the `UsersService`-level catch already
produces.

**Revision 4 correction: the status code alone is not what FC-001
requires — the message text must be unified too, and Revision 3 left this
inconsistent.** FC-001 requires the visitor-facing *outcome* be
indistinguishable, and the frontend renders the thrown error's message
verbatim (`frontend/app/register/page.tsx`) — a matching status code with
a different message is still a distinguishable outcome. Two message
strings exist in the codebase today for the same logical condition:
`AuthService`'s pre-checks say `'Email already registered'` /
`'Username already taken'`; `UsersService.ensureEmailAvailable()` says
`'Email already in use'`. **This decision adopts `AuthService`'s existing
wording (`'Email already registered'`, `'Username already taken'`) as
canonical**, since it is the wording actually visible on the registration
page today, and requires the `UsersService`-level catch (Option C) to
re-throw with that wording rather than `UsersService`'s own
`'...already in use'` phrasing. This creates a secondary, smaller
inconsistency with the *admin* endpoints (`PATCH`/`PUT /users/:id`), which
document `'Email already in use'` (`users.controller.ts:108,122`) and are
not required by FC-001 (an admin, not a race-prone anonymous visitor, is
on the other end) — left as-is deliberately rather than silently
reconciled, since unifying admin-facing wording too is a separate,
lower-priority consistency question this ADR doesn't need to answer to
satisfy FC-001.

**Scoped correctly: every path FC-001 actually governs** — pre-check or
race, email or username, on the three registration-facing pre-checks
(`register`, `createAdmin`, `registerWithProfile`) — now throws the same
type with the same message for the same logical condition. This is what
actually resolves FC-001, and it's an explicit part of this decision.

**A residual this decision does not resolve, found on review: within the
two admin endpoints themselves, the pre-check and the race-path still
disagree.** `updateByAdmin` and `replaceByAdmin` keep their
`ensureEmailAvailable` pre-check (`'Email already in use'`) as the fast
path, per this decision — but both are also among the five methods whose
`UsersService`-level catch is required to re-throw the canonical
`'Email already registered'` wording. So a sequential duplicate on
`PATCH /users/:id` gets `'Email already in use'`; a raced one gets
`'Email already registered'` — the identical pre-check/race-path message
divergence this decision exists to eliminate, recreated on the admin
surface it doesn't cover. This is **not** an FC-001 violation (FC-001
governs the anonymous registration flow; no admin-facing requirement is
currently documented for it), no consumer branches on this message text
(verified: `frontend/lib/api.ts` reads only `res.status`, falling back to
a generic string, never matching on error message content), and the cost
is cosmetic — but it is a residual, not a resolved case, and is recorded
as one rather than folded into the "every path" claim above.

Rejected the original Option B (global filter) because it fails the
Decision Driver that mattered most once discovered: it does not cover
`bulkImportUsersFromFile`, and its blast radius reaches into unrelated
domains this ADR has no business deciding for (see FINDING-0001,
FINDING-0002). Rejected Option A because it does not close the race at
all — see the Read Committed reasoning above.

### `updateByAdmin` must become atomic — a defect this decision would otherwise introduce

`updateByAdmin` writes the profile (`upsert`) and then the user row
carrying the email in two separate, unwrapped statements
(`users.service.ts:396`, `:407`) — unlike `replaceByAdmin`, which wraps
both in `prisma.$transaction` (`:424`). Today, `ensureEmailAvailable`
aborts before either write, so a 409 from this endpoint always means
nothing changed. Once the `P2002` catch described above is added at the
email-write step, a race can let the profile write succeed and then fail
on the email write — the admin gets a 409 *after* the username/bio/etc.
changes already committed. That is a partial-write state this decision
would introduce, not one that exists today, and it is the same failure
shape FC-001 names for email specifically ("no account is created **or
modified**"). **`updateByAdmin`'s two writes must be wrapped in
`prisma.$transaction`, matching `replaceByAdmin`'s existing pattern, as
part of this decision** — not deferred as a separate fix.

### Case-insensitivity is not enforced by this constraint — correcting a claim from the first draft

The original version of this ADR treated the database `@unique` constraint
as the sole, self-sufficient source of truth for email uniqueness. That
overstated it. `User.email` is a case-*sensitive* unique index.
Case-insensitive uniqueness — required by `PRD-Registration`'s BR-002 — is
upheld today only by application-level `.toLowerCase()` calls scattered
across `users.service.ts` (lines 46, 80, 125, 377, 429) before every read
and write. **The actual source of truth for BR-002 is that normalization
discipline, not the database constraint alone.** A write path that omitted
`.toLowerCase()` would satisfy the DB constraint (`Foo@x.com` and
`foo@x.com` are different strings to a case-sensitive index) while
violating BR-002, and neither the pre-check nor the Option C translation
described above would catch it, because both only fire on an actual
constraint violation.

This ADR does not require changing that today — a `citext` column or a
functional `UNIQUE INDEX ... (lower(email))` would make the database
constraint alone sufficient and is noted here as a real option, not
required by this decision. Until that migration happens, BR-002's
guarantee depends on `UsersService`'s normalization discipline being
maintained consistently, and that dependency should be visible to whoever
next touches this code, not assumed away.

**Username case-sensitivity is a gap this ADR surfaces but does not
resolve.** Revision 2 promoted `username` to a first-class invariant of
this decision; this section's reasoning, added in Revision 1, only ever
covered `email`. Checked directly: `username` is normalized nowhere —
`findByUsername()` matches exactly (`users.service.ts:129-134`), and every
write path stores `dto.username` as submitted, unlowercased. There is no
`BR` analogous to BR-002 for username, and no PRD covers the profile
endpoints this ADR touches. Whether `Alice` and `alice` are meant to be
distinct usernames is genuinely undecided, not merely undocumented — this
ADR does not decide it either, and says so rather than silently picking
case-sensitive-by-default through inaction.

## Consequences

### Positive

- The race PRD-Registration's FC-001 requires to be handled is closed at
  the layer that actually owns the invariant (`UsersService`'s writes), not
  approximated at the application layer or delegated to a mechanism with an
  uncontrolled blast radius.
- `bulkImportUsersFromFile`'s existing `skipped`/`failed` contract is
  preserved without modification — this was the original decision's most
  serious defect, and this revision closes it directly rather than working
  around it.
- Unrelated unique constraints (balances, 2FA, assets) are unaffected;
  their violations continue to surface loudly, which is correct for
  internal invariants.
- The case-insensitivity gap is now documented rather than silently
  assumed away, giving whoever implements this a clear, named follow-up
  option (`citext`/functional index) instead of a false sense that the
  constraint alone was already sufficient.
- `updateProfile`'s always-reproducible duplicate-username 500 (no guard of
  any kind, found by the Revision 2 audit) is fixed as a direct consequence
  of applying this decision correctly — not a separately scoped bug.
- `register()`, `createAdmin()`, and `registerWithProfile()` (both its
  email and username pre-checks) now agree with the `UsersService`-level
  catch on **both** status code and message text — FC-001 is actually
  satisfiable by this decision, not just narrowed toward it (Revision 3
  closed the status code; Revision 4 closed the message text and the
  previously-missed username pre-check).
- `updateByAdmin` gains transactional atomicity for its two writes,
  matching `replaceByAdmin`'s existing pattern — a 409 from this endpoint
  continues to mean nothing changed, which this decision would otherwise
  have silently broken.

### Negative

- Five methods need the same catch-and-translate logic instead of one
  global point — a real duplication cost, accepted deliberately in exchange
  for not reaching into domains this decision has no business governing.
  This grew from "three" to "five" between Revision 1 and Revision 2 of
  this ADR, which is itself evidence for the whitelist-completeness risk
  named below, not just a correction.
- **API contract change on six live endpoints.** `PATCH /users/me`
  (`updateProfile`) currently documents no 409 response at all
  (`users.controller.ts:91-99`) and will begin returning one for duplicate
  usernames. `PATCH /users/:id` and `PUT /users/:id`
  (`updateByAdmin`/`replaceByAdmin`) currently document 409 only for
  "Email already in use" (`:108`, `:122`) and will gain a second 409 reason
  for username conflicts. `POST /auth/register`'s duplicate-email response
  changes from 401 to 409; `POST /auth/admin/register`'s duplicate-email
  response changes from 401 to 409 (this also disambiguates that endpoint's
  401, which today is overloaded between "invalid admin API key" and
  "duplicate email" — a genuine, if incidental, improvement); `POST
  /auth/register-with-profile`'s duplicate-email *and* duplicate-username
  responses both change from 401 to 409. **`POST /auth/register`,
  `/auth/admin/register`, and `/auth/register-with-profile` currently
  document no conflict response at all** (`auth.controller.ts:101, 116,
  196`) — `409` decorators must be *added* to those three controllers'
  Swagger annotations before `openapi.json` can be regenerated
  (`npm run openapi:generate` per `CLAUDE.md`) to reflect them;
  regeneration alone reads existing decorators, it does not infer new
  ones. This is a visible, if directionally-correct, breaking change to
  document, not purely additive. (Verified before relying on this: no code
  under `frontend/` branches on HTTP status code for any of these calls —
  `frontend/lib/api.ts` discards `res.status` and surfaces only the error
  message — so this change has no known frontend consumer to break.)
- Registration's move from 401 to 409 for duplicate email resolves the
  *mechanical* inconsistency, but whether registration should move toward
  an anti-enumeration response model instead (not confirming account
  existence at all) remains open — see PRD-Registration Q-004. This ADR
  picks a consistent status code; it does not decide the disclosure
  question Q-004 asks.
- BR-002's case-insensitive guarantee still depends on application-level
  discipline rather than being schema-enforced, until/unless the noted
  `citext`/functional-index follow-up is taken. Username has no equivalent
  guarantee at all today, case-sensitive or otherwise — left as an open
  question, not silently resolved either way.

## Risks

- **Technical:** `meta.target` parsing for `P2002` must be verified against
  Prisma's actual error shape for both single-column (`email`) and the
  `UserProfile.username` constraint before being trusted to produce
  correct messages. This is a fail-*closed* check by design (unrecognized
  target → re-throw untouched, per the discrimination rule above) — the
  failure mode if the assumed shape is wrong (e.g. `meta.target` carries an
  index name like `users_email_key` rather than the column name `email` on
  this Prisma/Postgres combination) is that the translation silently never
  fires and this entire fix becomes a no-op, indistinguishable from not
  having shipped it, with no test suite in this repo to catch the
  regression. Verify the actual shape against a real `P2002` before
  relying on this ADR's fix being in effect.
- **Technical:** `updateProfile`'s write ordering (`users.service.ts:337-353`)
  is safe under this decision only because the throwing write (the
  `username` upsert) happens before the non-throwing one
  (`displayName` update) — unlike `updateByAdmin`, it is not wrapped in
  `$transaction`. This is correct today by construction, not by an
  explicit ordering guarantee; reordering those two blocks in a future
  change would reintroduce the same partial-write risk `updateByAdmin` was
  fixed for. Flagged here rather than wrapped, since wrapping every method
  "for symmetry" regardless of whether its current ordering is actually
  at risk is exactly the kind of unrequested scope this ADR's own
  Decision Drivers argue against.
- **Technical, found in re-review:** in the three `upsert`-based methods,
  `meta.target` can be `userId` (an internal invariant), not `email` or
  `username`. Mitigation is now part of the Decision (discriminate on
  `meta.target`, re-throw anything that isn't `email`/`username`
  untouched) — carried here as a Risk too because getting the
  discrimination wrong silently reproduces the exact failure mode Option B
  was rejected for, at smaller scale.
- **Technical:** The normalization-discipline dependency documented above
  is a standing risk until a schema-level fix is made — a new write path
  added to `UsersService` in the future that forgets `.toLowerCase()`
  would violate BR-002 silently.
- **Technical, elevated in Revision 2:** Whitelist completeness is not a
  one-time property — it is re-verified every time `UsersService` gains a
  write path. This ADR's own history (3 methods found, then 5 on a second
  pass) demonstrates the drift risk directly rather than hypothetically.
  Mitigation: the governing rule stated in the Decision section ("any
  method writing `users.email` or `user_profiles.username` must catch
  `P2002`") is written to be checkable against new code by inspection,
  since no test infrastructure exists in this codebase to enforce it
  automatically.
- **Operational:** None beyond normal deploy risk — this is a backend-only
  change with no schema migration required (the `citext` option is a
  documented follow-up, not part of this decision).
- **Future migration:** If the project ever moves off Prisma, the
  `P2002`-detection logic in these five methods moves with it and needs
  re-implementing against the new ORM's error shape — scoped to 5 methods
  instead of a global filter, this is a smaller migration surface than the
  rejected Option B would have left behind.

## Alternatives Rejected

- **Option A** (transaction wrapper only) — rejected: does not close the
  race under Postgres's default isolation level; would give a false
  impression of correctness.
- **Option B** (global `ExceptionFilter`) — rejected after
  `architecture-reviewer` found it does not cover the in-process
  `bulkImportUsersFromFile` consumer and has an unbounded, undifferentiated
  blast radius across every unique constraint in the schema, including one
  inside the settlement path. See FINDING-0001 and FINDING-0002.

## Related ADRs

- Related: none yet recorded — `0003-prisma-orm.md` documents the ORM
  choice this decision builds on, but does not address error-handling
  patterns.

## References

- `docs/features/registration/PRD.md` — FR-002, FC-001, Q-004 (this
  decision narrows Q-004's mechanical half but does not resolve its
  disclosure-posture question)
- `docs/features/registration/DISCOVERY.md` — Candidate ADR 1, evidence
  trail this ADR is based on
- `docs/architecture/findings/ARCHITECTURE-REVIEW-FINDINGS.md` —
  FINDING-0001, FINDING-0002, FINDING-0003 (Revision 1), FINDING-0009
  (Revision 2 — whitelist exhaustiveness), FINDING-0011, FINDING-0012
  (Revision 3 — FC-001 status-code gap, wrong-constraint catch),
  FINDING-0015 (Revision 4 — message-text unification, username-throw
  coverage, editorial corrections), FINDING-0019 (Revision 5 —
  admin-endpoint residual, endpoint count, openapi note)
- Prisma unique-constraint error reference:
  https://www.prisma.io/docs/orm/reference/error-reference#p2002
