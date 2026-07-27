# ADR-0013: Rate-limit unauthenticated auth-adjacent endpoints, and close the password-reset code invalidation race with a schema-enforced unique constraint and a fail-safe conflict guard

## Status

Accepted

**Revision 1:** 2026-07-27 — an `architecture-reviewer` pass found: (1) the
original Decision claimed a Prisma `$transaction` closes BR-002's
concurrent-insert race; it does not, under PostgreSQL's default Read
Committed isolation, for the identical reason ADR-0008's Option A was
rejected in this same repo; (2) the original scope named only two of at
least four unauthenticated/unthrottled auth-adjacent endpoints this repo's
own discovery reports document; (3) an email-keyed limiter on
`reset-password` shares its key between attacker and victim, creating a
deterministic lockout the original draft did not state; (4) the
anti-enumeration implication of an email-keyed limiter was unaddressed.
This revision replaced the transaction-only fix with a DB-level partial
unique index, narrowed the email-keyed limiter to `forgot-password` only,
and named the other two endpoints as explicitly out of scope.

**Revision 2:** 2026-07-27 — a second `architecture-reviewer` pass, verifying
Revision 1, found: (5) Revision 1's claim that the email-keyed limiter on
`forgot-password` introduces no lockout risk was false — the same
shared-key property that disqualified `reset-password` applies there too;
the real, undisclosed distinction is that it blocks *issuance* of a new
code, not *redemption* of one already held. This revision states that
trade-off explicitly rather than denying it exists. (6) Revision 1's stated
migration mechanism (`prisma migrate`) does not exist in this repo —
`npm run db:migrate` itself runs `prisma db push` (`scripts/migrate.js:33`)
and no `backend/prisma/migrations/` directory exists — making the partial
unique index inapplicable to every documented schema-sync command, not
only `db:reset`. (7) A schema-expressible alternative was never evaluated:
`@@unique([userId])` plus `upsert()`, which needs no raw SQL and survives
every documented command. This revision adopts it, eliminating problem (6)
structurally rather than working around it, and eliminating the `P2002`
translation question raised by review (an `upsert` has no losing branch to
translate). (8) The scope-exclusion framing for `2fa/verify` and
`register` contradicted the adopted global-throttle mechanism, which does
apply an IP-keyed default to both; the exclusion is narrowed to
account-keyed tightening only. (9) The Read Committed argument covered
only the no-prior-row case; the with-prior-row case is added. (10) The
global-throttle exclusion checklist is widened to name the Socket.IO
transport and order/deposit endpoints specific to this codebase.

**Revision 3:** 2026-07-27 — a third `architecture-reviewer` pass, verifying
Revision 2, found the "`upsert` has no losing branch" claim (point 7 above)
was itself wrong, and surfaced a genuine correctness regression Option F
introduced that neither prior round caught: (11) this repo's own
`ADR-0008` (Accepted) documents that a Prisma `upsert` on a unique key
**can** throw `P2002` under concurrency unless specific compiler
preconditions hold, which were never verified for this call site — this
revision states those preconditions explicitly and keeps a `P2002` catch
as a fail-safe rather than asserting none is needed. (12) Changing the
reset row's identity from per-code (`deleteMany`+`create`) to per-user
(`upsert`) silently removed a safety property: a concurrent
`forgot-password` request landing during `resetPasswordWithCode()`'s
bcrypt-hashing window now **updates** the in-flight row instead of
deleting it, so the transaction's final `usedAt` write succeeds using a
code `BR-002` guarantees should already be dead — a real path to
redeeming a superseded code. This revision makes the redemption update
conditional on the code hash actually still matching, closing the
regression. (13) `@@unique([userId])` cannot be applied to any database
already carrying historical rows (any user with two completed resets has
2+ rows) — this revision states the required one-time cleanup. (14) The
schema change as described breaks Prisma's inferred relation cardinality
on `User.passwordResets`, requiring a paired change from `[]` to `?`. (15)
The Decision's justification for why the victim can still redeem *a* code
misidentified *which* code survives — under BR-002 the victim's own
pre-attack code is the one guaranteed dead; the surviving code is the
attacker's own last-issued one, mailed to the victim's inbox. (16) The
window-vs-TTL coupling that determines whether the email-keyed limiter
stays an issuance-only lockout (as intended) or degrades into a full
denial-of-recovery lockout was left to implementation; this revision
makes it an explicit Decision constraint, confirmed with the user.

**Accepted:** 2026-07-27 — Option F's mechanism was verified empirically
against a live Postgres instance, not just reasoned about: (a) 20
concurrent `upsert()` calls on the same `userId` all completed without a
`P2002`, leaving exactly one row — confirming Prisma compiles this call
shape to an atomic `INSERT ... ON CONFLICT DO UPDATE`, not a
read-then-write; (b) the F-2 regression was reproduced directly — an
`update({where:{id}})` (the original, unconditional approach) redeemed a
superseded code, while the adopted conditional `updateMany({where:{id,
codeHash, usedAt:null}})` correctly refused (count 0) under the identical
race; (c) `npx prisma validate` confirmed the `User.passwordResets`
cardinality change (`[]` → `?`) is required, matching F-4; (d) a forced
`P2002` against the schema-declared constraint returned
`meta.target: ["user_id"]` (a field name), confirming the fail-safe catch
discriminates reliably, unlike `ADR-0008`'s raw-SQL-index warning case.
Test performed against a disposable user row on the local dev database;
schema and data fully reverted after verification. With three
`architecture-reviewer` rounds and this empirical check resolved, Status
moved to Accepted.

## Date

2026-07-27

## Context

No rate limiting, throttling, or lockout mechanism exists anywhere in this
backend. Confirmed repo-wide: no `@Throttle` decorator or equivalent guard
in any controller, no `ThrottlerModule` registration in `app.module.ts`,
and no `@nestjs/throttler` (or comparable) dependency in `package.json`.

At least four unauthenticated or effectively-unthrottled endpoints carry
this gap, evidenced across three features' discovery reports:

- **Password reset** (`POST /auth/forgot-password`, `POST
  /auth/reset-password` — `docs/features/password-reset/PRD.md` FC-003,
  `docs/features/password-reset/DISCOVERY.md` Data Flow 4) — three
  distinct harms:
  1. **Code brute-force:** an 8-digit code (10^8 keyspace) is guessable at
     ~28,000 req/s for even odds within a single 30-minute window, or,
     since each freshly-issued code is an independent draw and nothing
     confines an attacker to one window, ~8.6M attempts/day at a far more
     ordinary 100 req/s reaches ~8.6% cumulative success per day — even
     odds within about 8 days.
  2. **Denial-of-recovery race:** `BR-002` (any new `forgot-password`
     request invalidates the account's current unused code) lets anyone
     who knows a victim's email repeatedly invalidate whichever code the
     victim is currently trying to redeem — a race the attacker must keep
     winning, not an outright lockout, since each such call also mails the
     victim a fresh valid code.
  3. **Mail amplification:** repeated `forgot-password` calls against a
     known address flood that address's inbox and the mail service,
     independent of whether the account holder is actively resetting
     anything.
- **Login** (`POST /auth/login` — `docs/features/login/PRD.md` Q-002) — the
  identical absence, not yet designed there.

**Named, and receiving this ADR's global default, but not its tightened
per-route limits:**

- **`POST /auth/2fa/verify`** — unguarded and unthrottled, and does not
  count failed attempts or invalidate the 5-minute temp token on a wrong
  code (`docs/features/login/DISCOVERY.md:170-180`), making it an
  unlimited-guess window against a 6-digit TOTP code. `login/DISCOVERY.md`
  itself frames a throttle as a partial, applicable mitigation ("the same
  class of risk once that feature exists"); this ADR's global IP-keyed
  default therefore does apply to it, same as any other route. What this
  ADR does **not** design is attempt-counting or temp-token invalidation
  specific to the 2FA flow, or an email/account-keyed limit tuned to that
  endpoint's own risk profile — those are `PRD-TwoFactorAuth`'s (not yet
  produced) to decide, informed by this ADR's mechanism.
- **`POST /auth/register`** — unauthenticated, triggers `sendWelcomeEmail`
  (`docs/features/registration/PRD.md` Q-002), sharing this ADR's
  mail-amplification harm shape. Receives the same global default; a
  tightened, registration-specific limit (e.g. per-IP signup caps) is
  `PRD-Registration` Q-002's decision, not designed here.

A related, non-atomicity gap compounds harm 2 above:
`requestPasswordReset()`'s invalidate-then-create sequence
(`backend/src/auth/auth.service.ts:121-136` — a `deleteMany` and a `create`
as two separate, unwrapped `await`s, with a `randomInt` call and an HMAC
computation between them) has no transaction and no unique constraint
backing `BR-002`'s "only one unused code per account" invariant
(`backend/prisma/schema.prisma:92-104` has only `@@index([userId])`). Two
concurrent `forgot-password` requests for the same account can each pass
the `deleteMany` before either reaches `create`, leaving two live unused
codes.

**A transaction wrapper alone does not close this race, in either
sub-case.** Under PostgreSQL's default Read Committed isolation (this repo
specifies no `isolationLevel` anywhere):

- **No prior row:** both concurrent transactions' `deleteMany` matches
  zero rows and takes no row lock; both proceed to `create` unimpeded.
- **A prior row exists:** the second transaction's `deleteMany` blocks
  briefly on the first transaction's row lock, but once the first commits,
  the second re-evaluates under a fresh Read-Committed snapshot, finds the
  row already gone, deletes nothing — and still proceeds to `create`.

Both sub-cases end the same way: two live unused codes. This is the
identical reasoning
`docs/architecture/adr/0008-duplicate-email-registration-race-handling.md`
(Accepted) already recorded rejecting an equivalent transaction-only fix
for registration's duplicate-email race: "a transaction wrapper alone
doesn't serialize the check against concurrent inserts... gives a false
sense of correctness."

This is `CryptoSandboxQA`, a QA training sandbox (`CLAUDE.md`), not a
production system, and its documented setup (`npm run setup`) currently
requires no operator-supplied throttling configuration. Schema changes are
applied exclusively via `prisma db push` in this repo — `scripts/setup.js`,
and, despite its name, `scripts/migrate.js:33` (`npm run db:migrate`) as
well; no `backend/prisma/migrations/` directory exists. Any BR-002 fix
requiring a hand-applied raw-SQL migration would silently disappear on
every one of these commands, not survive selectively — addressed directly
in Decision.

## Decision Drivers

- **Abuse resistance** — the three harms above are all concretely
  exploitable today, with no mitigation of any kind, on endpoints reachable
  by any unauthenticated caller.
- **Invariant correctness, expressed declaratively** — `BR-002`'s "only one
  unused code" rule should hold under concurrency, and should be
  expressible in this repo's actual schema-management workflow
  (`prisma db push`), not depend on a step that workflow doesn't run.
- **QA training realism, without breaking test automation** — trainees
  exercising this sandbox for security-testing practice should be able to
  observe realistic rate-limit behavior, but this system also exists to be
  driven by automated test suites (`CLAUDE.md`'s `SIMULATED_PERSIST_DELAY_MS=0`
  precedent for "fast test loops") — a mechanism that flakes CI is a real
  cost.
- **Consistency across auth endpoints** — password reset and login share
  the identical rate-limiting gap; a mechanism scoped to only one silently
  leaves the other unaddressed.
- **Anti-enumeration integrity** — this feature's defining property (PRD
  G-002; `ADR-0009`) is that every response looks identical regardless of
  account existence. Any new control added here must not become a new
  enumeration oracle.
- **Honest risk accounting** — a mitigation that relocates a harm rather
  than closing it must say so, not claim the harm is gone.

## Assumptions

- `@nestjs/throttler` (or an equivalent NestJS-native guard) is an
  acceptable dependency to add.
- In-memory rate-limit storage is acceptable for IP-keyed limiting on this
  single-node sandbox. It is a different proposition for an
  attacker-controlled key space (see Risks).
- Retaining historical *used* `user_password_resets` rows has no current
  consumer: PRD Data Requirements records them as "kept, not queried by
  anything found in this feature," and `PRD-PasswordReset` Q-005 already
  asks whether that retention is intentional or an oversight, unresolved
  before this ADR. This ADR's adopted mechanism (see Decision) answers
  Q-005 as a direct consequence, not a coincidence — flagged there.

## Considered Options

### Option A — Global `ThrottlerModule` with per-route overrides

Register `@nestjs/throttler`'s `ThrottlerModule.forRoot()` once at the
application level with a conservative default (e.g. 100 req/min per IP),
then apply tighter `@Throttle()` overrides to `forgot-password`,
`reset-password`, and `login`.

- **Advantages:** One shared mechanism covers all three routes (and
  applies a baseline default to registration and 2FA as well, per Context)
  without per-controller duplication; NestJS-idiomatic; in-memory storage
  requires no new infrastructure.
- **Disadvantages:** A global default changes behavior for every route in
  the system. Known candidates that must not be inadvertently throttled in
  this specific codebase: Prometheus's `/metrics` scrape target
  (`docker-compose.yml`, `observability/prometheus/prometheus.yml`), any
  frontend polling loop, the Socket.IO ticker transport's
  handshake/polling fallback (`backend/src/websocket/ticker.gateway.ts`),
  and any test suite driving the order-lifecycle or deposit flows in tight
  loops (`CLAUDE.md` calls order lifecycle "critical for testing" and
  exercised repeatedly in QA scenarios). A full audit of every route is
  out of this ADR's scope; these four are named as a concrete starting
  checklist.
- **Risks:** Per-IP throttling alone does not fully close harm 1's
  distributed-attacker case; does not by itself stop harm 2.

### Option B — Route-scoped guards only, no global default

Apply `@Throttle()` individually to each named route, with no
application-wide default.

- **Advantages:** Minimal blast radius; smallest initial change.
- **Disadvantages:** Leaves every other current and future route
  permanently unprotected by default; each new auth-adjacent route added
  later must remember to opt in individually.
- **Risks:** Repeats the unenforced-per-route-opt-in pattern this
  codebase already has a documented negative instance of
  (`docs/features/session-management/DISCOVERY.md` candidate ADR 3,
  guard-pairing enforcement lacking any structural check).

### Option C — Per-account (email-keyed) limiting in addition to per-IP, on both password-reset endpoints

Extends Option A with a second, email-keyed limiter on both
`forgot-password` and `reset-password`, independent of source IP,
incrementing on every request keyed on the submitted email string.

- **Advantages:** Directly bounds harm 2 and raises harm 1's cost floor
  against a distributed attacker, since the account is limited, not just
  any one IP.
- **Disadvantages:** The limiter's key is attacker-obtainable (any known
  email) on **both** endpoints. On `reset-password` specifically, this
  lets an attacker who knows the victim's email exhaust the victim's
  budget with garbage codes, blocking **redemption** of a code the victim
  already holds in hand — strictly worse than today's race, where the
  victim always retains a usable code.
- **Risks:** Attacker-mintable key space against in-memory storage (see
  Risks, below).

### Option D — No rate limiting; accept as a deliberate training-sandbox gap

- **Advantages:** Zero implementation cost.
- **Disadvantages:** The three harms in Context remain live and
  concretely exploitable, with no mitigation; unlike
  `SIMULATED_PERSIST_DELAY_MS` or `JWT_SECRET`'s fallback, an absent rate
  limit offers no training-realism or setup-convenience benefit that
  offsets the harms it leaves open.
- **Risks:** Leaves the identical, unaddressed gap open across multiple
  features indefinitely.

### BR-002's atomicity: two schema-mechanism options, evaluated separately from A-D above

The rate-limiting decision (A-D) and the BR-002 atomicity decision are
independent — a throttle reduces how *often* two requests race, it does
not make one request's result atomic. Two mechanisms were evaluated for
the latter:

#### Option E — DB-level partial unique index

`UNIQUE (user_id) WHERE used_at IS NULL`, applied via raw SQL, with the
resulting `create()`-time `P2002` translated to
`requestPasswordReset()`'s existing generic response.

- **Advantages:** Preserves every historical row, used and unused;
  minimal change to `requestPasswordReset()`'s existing `deleteMany`+`create`
  shape.
- **Disadvantages, decisive:** Prisma's schema language has no partial-index
  syntax, so this constraint cannot be declared in `schema.prisma` and
  cannot survive this repo's actual schema-sync commands — `npm run
  setup`'s `db push`, `npm run db:migrate`'s `db push` (despite the
  command's name — `scripts/migrate.js:33`), and `npm run db:reset` all
  reset the schema to what `schema.prisma` declares, silently dropping any
  constraint added out-of-band. `prisma migrate dev` is not a viable
  alternative here either: this repo has no `backend/prisma/migrations/`
  history, and initializing one now would require drift-reconciling
  against a database this repo's entire documented workflow manages via
  `db push`, changing that workflow for every model, not just this one —
  a cost far larger than this ADR's mandate.
- **Risks:** Even if a setup step were added to reapply the index after
  every `db push`, the `P2002` catch must discriminate on `meta.target`,
  which for a raw-SQL-named index carries the *index name*, not a column
  name (`ADR-0008` Risks makes the identical point for its own constraint)
  — a catch written against the wrong target string becomes a silent
  no-op, indistinguishable from never having shipped it.

#### Option F — `@@unique([userId])` plus `upsert()`, with a fail-safe `P2002` catch and a conditional redemption update

Add a full (non-partial) unique constraint on `userId` to
`user_password_resets`, and replace `requestPasswordReset()`'s
`deleteMany`+`create` pair with a single `upsert()` keyed on `userId`,
setting `codeHash`, `expiresAt`, and resetting `usedAt` to `null`
unconditionally.

- **Advantages:** Fully declarative in `schema.prisma` — survives `db
  push`, `db:migrate`, and `db:reset` identically for any *fresh*
  database, with no recurring setup-step change (a one-time cleanup is
  required for existing data — see Disadvantages). Prisma compiles
  `upsert()` on a single non-nullable unique field, with no nested writes
  and the same value present in both `create` and the `where` clause, to a
  single atomic `INSERT ... ON CONFLICT (user_id) DO UPDATE` — this call
  meets all three preconditions, verified against the shape described
  above, so the common case has no losing branch. Simpler code than
  Option E: one call instead of two, no raw SQL.
- **Disadvantages:**
  - Only the single latest row per user is retained — used rows are
    overwritten on the next request, not kept. This is a behavior change
    to the "keep used rows for history" note in PRD Data Requirements and
    to `ARCHITECTURE.md:125`'s "new request replaces unused rows" (which
    must become "replaces the prior row, used or not").
  - **The constraint cannot be applied directly to a database already
    carrying historical rows.** This codebase's current behavior never
    deletes used rows, so any user with two or more completed resets
    already has multiple rows; `CREATE UNIQUE INDEX` on `user_id` fails
    against that data, and `prisma db push` (invoked with no
    `--accept-data-loss` anywhere in this repo) aborts rather than
    applying it. A one-time cleanup — keep only the newest
    `user_password_resets` row per `user_id`, delete the rest — must run
    before this schema change is applied to any non-empty database
    (`npm run db:reset`, which recreates the database from empty, is
    unaffected; `npm run setup` and `npm run db:migrate` against an
    existing database are not, until the cleanup runs).
  - **`@@unique([userId])` on the FK side makes Prisma infer a one-to-one
    relation**, requiring `User.passwordResets` (`schema.prisma:36`,
    currently `UserPasswordReset[]`) to become `UserPasswordReset?` in the
    same change, or `prisma validate`/`db push` fails before reaching the
    database. No code reads `user.passwordResets` anywhere in this repo
    (verified: the only reference is the relation declaration itself), so
    this is a free but *necessary*, previously-unstated part of the
    schema edit.
- **Risks:** Prisma's compilation of `upsert()` into a single atomic
  statement is a documented behavior of the query engine for the
  precondition shape above, not a language guarantee independent of that
  shape — this repo's own `ADR-0008` records an instance where a
  differently-shaped `upsert()` (with an update payload varying per call
  site) fell back to a non-atomic read-then-write and could throw `P2002`
  under concurrency. If a future change to this call site adds a nested
  write, a computed `where`, or otherwise departs from the exact shape
  verified here, the atomicity this option relies on can silently regress
  with no test in this repo positioned to catch it. **As a fail-safe, not
  because the common-case path is expected to need it**, the
  implementation wraps the `upsert()` call in a `try/catch` translating
  any `P2002` (on the `userId` target — verified via `meta.target`, per
  `ADR-0008`'s established pattern for this repo) into
  `requestPasswordReset()`'s existing generic response, so a future
  regression fails safely (a swallowed conflict, matching today's
  anti-enumeration shape) rather than as an unhandled 500 on the
  known-account path only.

**A second, independent correctness requirement this option introduces:**
switching the reset row's identity from per-code (`deleteMany`+`create`
mints a new row each time) to per-user (`upsert` reuses the same row)
removes an incidental safety property `resetPasswordWithCode()` relies on
today. Currently, if a concurrent `forgot-password` request deletes the
in-flight row while `resetPasswordWithCode()` is mid-transaction (e.g.
during its `bcrypt.hash` call, `auth.service.ts:167` — a real,
attacker-triggerable window on an unauthenticated endpoint), the
redemption update at `:173` targets a now-nonexistent `id` and the whole
transaction — including the password change — rolls back loudly. Under a
naive `upsert()`, that same concurrent request **updates** the row in
place instead of deleting it, so `:173`'s update-by-`id` **succeeds**,
redeeming a code `BR-002` guarantees should already be invalid. **This
option's redemption update must therefore be made conditional on the code
still matching**: `updateMany({ where: { id: row.id, codeHash, usedAt:
null }, data: { usedAt: new Date() } })`, aborting the transaction (and
returning the same generic invalid-code error) if the affected count is
0. This is part of the decision, not a follow-up detail — the mechanism
change is what creates the need, and it did not exist as a requirement
under Option E.

**Retention cost assessed as near-zero:** PRD Data Requirements already
states used rows are "not queried by anything found in this feature," and
`PRD-PasswordReset` Q-005 asks whether retaining them is intentional
without an answer on record. Repo-wide, `userPasswordReset` is referenced
at exactly four call sites (`auth.service.ts:121, 130, 154, 173`), none of
which reads a used row for any purpose beyond the single redemption
transaction that marks it used. No audit or reporting feature consuming
historical rows was found anywhere in this codebase. This is evidence the
cost is low, not confirmation that no retention was ever intended — see
Consequences and Related ADRs on how this ADR treats `PRD-PasswordReset`
Q-005.

## Decision

**Rate limiting: Option A, plus Option C's mechanism applied to
`forgot-password` only, not `reset-password`.**

Register `ThrottlerModule` globally with a conservative application-wide
IP-keyed default (applying to every route, including `2fa/verify` and
`register`, per Context), with `@Throttle()` overrides tightening
`forgot-password`, `reset-password`, and `login` specifically. Add an
email-keyed limiter to **`forgot-password` only**, incrementing on every
request regardless of whether the account exists.

**This is not a lockout-free fix — it relocates the lockout, and that
relocation is the actual justification, not an absence of the risk.** The
email-keyed limiter on `forgot-password` is exactly as attacker-mintable
as the rejected Option C variant on `reset-password`: an attacker who
knows the victim's email can exhaust the limit with repeated requests, and
the victim will be unable to *initiate* a new reset for the remainder of
the window. What changes is which action gets blocked. `reset-password`
was rejected because blocking there denies **redemption of a code the
victim already holds** — turning "the victim can still act" into "the
victim cannot act at all," a strictly worse failure mode than today's
unthrottled race. `forgot-password`'s limiter blocks only **issuance of a
new code** — and under `BR-002`, the attacker's own burst is what
guarantees the victim's *pre-attack* code is already dead (this is
`BR-002`'s own stated purpose, not a gap this ADR introduces). The code the
victim can still redeem is not "their own most recent request" but the
**last code the attacker's own burst caused to be issued** — every
`forgot-password` call, including the attacker's, mails a fresh code to
the *victim's* inbox (`auth.service.ts:130-138`), so the attacker's flood
does not deny the victim a working code, it just makes the victim's own
prior code moot and requires them to use the newest one instead.
`reset-password` is not the endpoint being limited by this control, so
that final redemption step is never blocked.

**This trade only holds if the limiter's window is shorter than the
code's TTL — this is a hard constraint on the Decision, not a tuning
choice.** If the email-keyed window on `forgot-password` were ever
configured to exceed `PASSWORD_RESET_CODE_TTL_MIN` (30 minutes,
`auth.service.ts:56`), a victim whose most recent code expires mid-window
would be unable to either redeem the old code (expired) or request a new
one (rate-limited) — collapsing this option back into the full
denial-of-recovery lockout Option C was rejected on `reset-password` for
avoiding. **The `forgot-password` email-keyed window MUST be strictly
shorter than `PASSWORD_RESET_CODE_TTL_MIN`** (confirmed with the product
owner as a hard requirement, not deferred to implementation judgment). The
trade is: bound harm 2 to a fixed-size denial-of-*new-code* window, in
exchange for not creating a denial-of-*redemption* window, contingent on
that window constraint holding. This is judged the better trade, not a
trade-free win, and limit selection for `forgot-password` must account for
this being a real, attacker-triggerable floor on legitimate recovery
latency, not only a UX tuning knob.

**BR-002's atomicity: Option F (`@@unique([userId])` + `upsert()`, with a
fail-safe `P2002` catch and a conditional redemption update), not Option
E.** Chosen because it is fully expressible in this repo's actual schema
workflow — every documented schema-sync command preserves it for a fresh
database, with no recurring extra step beyond a one-time cleanup for
existing data — while Option E requires a mechanism (`prisma migrate`)
this repo does not use and cannot adopt for one constraint without
changing how every other model in `schema.prisma` is synced. The `P2002`
catch is retained as a fail-safe against a future regression to
`upsert()`'s non-atomic fallback path (see Option F Risks), not because
the common case needs it, addressing `ADR-0008`'s precedent directly
rather than asserting it doesn't apply. The redemption update is made
conditional on the code hash still matching (see Option F), closing the
correctness gap the identity change from per-code to per-user rows would
otherwise introduce. Option F's retention cost (used rows overwritten, not
kept) is accepted as near-zero given Assumption 3; this forecloses
`PRD-PasswordReset` Q-005's "retain used rows" branch as a side effect of
this decision, not an answer to the product question Q-005 asks — if
retention is later wanted, it requires its own append-only mechanism (e.g.
a separate history table), and the product owner should confirm this
foreclosure is acceptable before this ADR reaches Accepted (see Related
ADRs, Risks).

Chosen Option A over Option B for the reason stated in Option B's Risks —
an unenforced per-route convention is a documented failure pattern in this
codebase already. Chosen the narrowed Option C over the full Option C
because the redemption-lockout risk on `reset-password` is a strictly
worse failure mode than the issuance-lockout risk accepted on
`forgot-password`, argued above, contingent on the window-vs-TTL
constraint above holding.

Exact request-per-window numbers and backoff behavior are otherwise left
to implementation (subject to the window-vs-TTL constraint above), informed
by the attack-cost figures in Context; 429 response shape is left to
implementation.

## Consequences

### Positive

- Substantially raises the cost of harm 1 and bounds harm 2 to a fixed
  window rather than an indefinite race, contingent on the window-vs-TTL
  constraint holding, while avoiding the strictly worse redemption-lockout
  an unqualified Option C would have introduced. Substantially raises the
  cost of harm 3 (mail amplification is bounded per window, not
  eliminated across windows).
- `BR-002`'s "only one unused code" invariant now actually holds under
  concurrency, enforced declaratively by the database schema for a fresh
  database, with a fail-safe conflict guard for the case where a future
  code change regresses the upsert's atomicity.
- Forecloses `PRD-PasswordReset` Q-005's "retain used rows" branch as a
  side effect — used rows are no longer retained past the next reset
  request, since `upsert()` overwrites them. This is a decision the product
  owner should confirm before Accepted, not a resolved answer to Q-005's
  underlying product question (see Related ADRs).
- Establishes one throttling mechanism reusable by `login` today and by
  registration/2FA once their own PRDs are ready to adopt tightened,
  route-specific limits.

### Negative

- `forgot-password`'s email-keyed limiter introduces a genuine,
  attacker-triggerable denial-of-*new-code-issuance* window against any
  known account — bounded and strictly less severe than a
  denial-of-redemption window, but real, and must be sized as a product
  decision (see Decision), not left purely to abuse-cost tuning.
- Historical *used* password-reset code rows are no longer retained after
  the next reset request for that account — a behavior change from today
  (currently kept, if unused by anything) that PRD Data Requirements,
  Q-005, and `ARCHITECTURE.md:125` ("new request replaces unused rows," to
  become "replaces the prior row, used or not") must be updated to
  reflect.
- Applying `@@unique([userId])` requires a one-time data cleanup on any
  existing database with historical rows (Option F Disadvantages) — not a
  cost on fresh databases, but real for any environment already running
  this feature.
- Adds a new runtime dependency (`@nestjs/throttler` or equivalent).
- A global IP-keyed default, once registered, applies to every route
  unless explicitly excluded — Prometheus's `/metrics` scrape, frontend
  polling, the Socket.IO ticker transport, and order/deposit-flow test
  loops are named starting points for an exclusion audit this ADR does not
  itself complete. The tightened IP-keyed limit on `reset-password`
  specifically is also collidable behind a shared egress IP (a training
  classroom or corporate NAT) — a real, if lower-priority, redemption
  hazard for a legitimate user sharing an IP with an unrelated caller.
- In-memory throttle storage resets on process restart and is not shared
  across horizontally-scaled instances — acceptable for this single-node
  sandbox today.

## Risks

- **Implementation risk:** limits set too tight degrade legitimate UX and
  widen the denial-of-issuance window named above; set too loose, the
  harms in Context remain largely open. Needs empirical tuning informed by
  both considerations, not just UX.
- **QA-automation risk:** a global default risks 429s in test suites that
  loop login, reset, order-lifecycle, or deposit flows in quick succession
  — worth an env-var escape hatch on the `SIMULATED_PERSIST_DELAY_MS=0`
  precedent, not designed here but flagged as a likely necessary
  follow-up.
- **In-memory storage under an attacker-mintable key:** `forgot-password`'s
  email-keyed limiter accepts arbitrary caller-supplied strings as keys;
  whether `@nestjs/throttler`'s default storage evicts aggressively enough
  to bound unbounded key growth should be verified before shipping.
- **Scope-seam risk:** `POST /auth/2fa/verify` and `POST /auth/register`
  receive only this ADR's global default, not a tightened, route-specific
  limit — if either sibling PRD designs its own tightened limit without
  referencing this ADR's mechanism, the codebase ends up with inconsistent
  throttling approaches instead of one shared one.
- **Retention-reversal risk:** if `PRD-PasswordReset` Q-005's product owner
  does not accept the foreclosure this ADR's Option F introduces (see
  Decision), undoing the overwrite-on-upsert behavior requires a new
  mechanism (e.g. an append-only history table written alongside the
  upsert), not a schema rollback — worth confirming before Accepted, not
  after implementation.
- **Upsert-atomicity regression risk:** the `upsert()` call's atomicity
  depends on Prisma compiling it to a single `INSERT ... ON CONFLICT`
  statement, which holds only for the exact precondition shape verified in
  Option F (single non-nullable unique field, no nested writes, matching
  `create`/`where` value). A future change to this call site that departs
  from that shape (e.g. a nested write, a computed field) can silently
  regress it to a non-atomic read-then-write with no test in this repo
  positioned to catch it — the `P2002` fail-safe (Option F) bounds the
  damage but does not prevent the regression itself. Worth a code comment
  at the call site naming this constraint and this ADR.

## Alternatives Rejected

- **Option B (route-scoped only, no global default):** rejected — repeats
  a per-route opt-in pattern this codebase already has a documented
  negative instance of.
- **Full Option C (email-keyed limiter on both endpoints):** rejected on
  `reset-password` specifically — creates a redemption-lockout against the
  endpoint's legitimate user, a strictly worse failure mode than the
  issuance-lockout accepted on `forgot-password`.
- **Transaction wrapper for BR-002 (Revision 1's approach):** rejected —
  does not close the race under Read Committed isolation in either
  sub-case, per `ADR-0008`'s identical, already-established reasoning for
  this repository.
- **Option E, DB partial unique index (Revision 1's approach):** rejected
  — not expressible in Prisma's schema language, and therefore does not
  survive this repo's actual schema-sync workflow (`db push`, used by
  every documented setup/migrate/reset command) without an unmandated,
  larger change to that workflow.
- **`SERIALIZABLE` isolation + retry for BR-002:** rejected — the
  invariant is directly expressible as a database constraint; retry logic
  would be unnecessary complexity for a problem a unique constraint
  already solves.
- **Option D (accept as deliberate gap):** rejected — unlike this
  repository's other intentionally weak defaults, an absent rate limit
  offers no training or convenience benefit that offsets the concretely
  exploitable harms it leaves open.

## Related ADRs

- Related: `ADR-0008` — this ADR's rejection of a transaction-only BR-002
  fix follows `ADR-0008`'s identical Read-Committed reasoning; its
  rejection of Option E (the partial-index route) is informed by
  `ADR-0008`'s own warning that a raw-SQL constraint's `P2002` surfaces an
  index name, not a column name, to the catching code. **Reconciled, not
  contradicted:** an earlier revision of this ADR asserted Option F's
  `upsert()` has no `P2002` path at all; `ADR-0008`'s own Decision
  documents a case where a Prisma `upsert()` on a unique key *does* throw
  `P2002` under concurrency. This ADR's Option F now states the specific
  preconditions under which the atomic-compilation path applies, verifies
  they hold for this call site, and keeps a `P2002` catch as a fail-safe
  rather than asserting the class of risk `ADR-0008` identified doesn't
  exist here.
- Related: `ADR-0009` (notification delivery boundary) — that ADR's
  Decision (once implemented) reduces per-request attacker cost for
  password reset's mail-amplification harm (3) by removing the synchronous
  mail wait from the request path; complementary to, not a duplicate of,
  this ADR's rate limiting. Since `reset-password` never calls
  `MailService`, `ADR-0009` does not affect harm 1 (code brute-force)
  directly, only indirectly via reducing the cost of re-issuing codes on
  `forgot-password`.
- Related: `PRD-Login` Q-002, `PRD-Registration` Q-002 — share this ADR's
  underlying gap on their own endpoints; expected to adopt this ADR's
  `ThrottlerModule` mechanism for any tightened, route-specific limit
  rather than design a separate one.
- Related: `docs/features/login/DISCOVERY.md` (2FA temp-token unlimited-guess
  window) — receives this ADR's global default only; attempt-counting and
  temp-token invalidation remain `PRD-TwoFactorAuth`'s to design.
- Related: `PRD-PasswordReset` Q-005 — this ADR's Option F **forecloses**
  Q-005's "retain used rows" branch as a side effect of choosing a
  schema-declarative mechanism over a raw-SQL one; it does not answer
  Q-005's underlying product question (was retention ever intentional).
  The product owner should confirm this foreclosure is acceptable before
  this ADR reaches `Accepted` (see Risks).
- Related: `ADR-0012` — both ADRs invalidate in-flight, unredeemed reset
  codes on deploy (this ADR: existing rows overwritten by the schema
  migration's cleanup step; `ADR-0012`: the pepper value changes) and both
  create documentation debt on the same file (`ARCHITECTURE.md:125`). If
  both land in the same release, users mid-reset are affected by either
  change independently — worth deploying with that in mind, not a reason
  to sequence them differently.

## References

- `docs/features/password-reset/PRD.md` — FC-003, BR-002, Q-002, Q-005,
  Data Requirements
- `docs/features/password-reset/DISCOVERY.md` — Candidate ADR 1, Data Flows 4-5
- `docs/features/login/PRD.md` — Q-002
- `docs/features/login/DISCOVERY.md` — 2FA temp-token finding
- `docs/architecture/adr/0008-duplicate-email-registration-race-handling.md`
- `ARCHITECTURE.md:125` — reset-code storage description requiring update
  on implementation
- `backend/prisma/schema.prisma:36` — `User.passwordResets` relation
  requiring a cardinality change alongside the `@@unique([userId])` addition
