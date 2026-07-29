# ADR-0020: Username Identity Normalization

- **Status:** Accepted
- **Date:** 2026-07-29 (Revision 5)

## Context

`username` (`UserProfile.username`, `backend/prisma/schema.prisma:45`) is a
`String? @unique` column. It is written at **four** sites in
`backend/src/users/users.service.ts`:

- `createWithProfile()` — line 90
- `updateProfile()` — line 321
- `updateByAdmin()` — line 382
- `replaceByAdmin()` — lines 439, 451

`createWithProfile()` is called in-process by `AuthService.registerWithProfile()`
and `AuthService.createUserWithProfileAsAdmin()` (`backend/src/auth/auth.service.ts`)
— those two are callers, not independent writers. `updateByAdmin`/`replaceByAdmin`
back the admin `PATCH`/`PUT /users/:id` routes and are in scope: `username` and
`email` are written by overlapping but not identical method sets (`email`'s
write-time normalization additionally covers `create()`, which never writes
`username`; `username`'s set additionally covers `updateProfile()`, which never
writes `email`). There is no basis in either set for treating `username` as
narrower than the four methods above — a full-repo search for
`userProfile.*username` and `profileUpdate.username`/`profileData.username`
assignments confirms these are the only four sites.

It is read for uniqueness lookup by `UsersService.findByUsername()`
(`users.service.ts:129-134`).

No normalization is applied anywhere in this path:

- `findByUsername()` performs an exact-string match: `where: { username }`
  — unlike `findByEmail()` (`users.service.ts:123-127`), which lowercases
  its argument before comparing.
- All four write sites store the submitted value verbatim — no case-folding,
  no trimming.
- `UpdateProfileDto.username` (`backend/src/users/dto/update-profile.dto.ts`)
  carries only `@IsOptional() @IsString()` — no `@MinLength`,
  `@IsNotEmpty`, `@Matches`, or length ceiling. Coverage is inconsistent
  across the four write surfaces: a 50-character limit exists on
  `RegisterWithProfileDto` (`backend/src/auth/dto/register-with-profile.dto.ts:31-35`)
  and is mirrored by the bulk-import parser
  (`backend/src/auth/bulk-user-import.parse.ts:108-109`) and its frontend
  counterpart (`frontend/lib/adminUserImport.ts:135-136`), but
  `UpdateProfileDto`, `AdminPatchUserDto`, and `AdminReplaceUserDto` — the
  admin `PATCH`/`PUT /users/:id` and self-service `PATCH /users/me` surfaces
  — impose no limit at all.

This is a known, previously-flagged gap. `ADR-0008` (Accepted,
"Duplicate Email/Registration Race Handling") observes it directly while
addressing a related but narrower problem (the username-collision *response
code* on an exact-string match, not username *identity*):

> `username` is normalized nowhere — `findByUsername()` matches exactly
> (`users.service.ts:129-134`), and every write path stores `dto.username`
> as submitted, unlowercased... no PRD covers the profile endpoints this
> ADR touches.

That final clause is an observation of absence, not an ownership
assignment — `ADR-0008` names no follow-up ADR and assigns no explicit
owner; it states only that it declines to decide the question rather than
silently defaulting to case-sensitive-by-inaction. This ADR exists because
the gap is real and needs an owner, not because `ADR-0008` commissioned it.

**The established precedent for an analogous field is case-folding at
write time — but it lives in `UsersService`, not `AuthService`.** `email`
is lowercased at write time in `users.service.ts:46, 80, 377, 429` — these
are `create()`, `createWithProfile()`, `updateByAdmin()`, `replaceByAdmin()`.
That is **not** the identical method set `username` is written from:
`create()` never accepts a `username` (it has no profile data), and
conversely `updateProfile()` writes `username` but never writes `email`
directly (email changes are not exposed on `PATCH /users/me` at all — see
`docs/features/user-profile-settings/PRD.md` C-002). The sets overlap on
three methods (`createWithProfile`, `updateByAdmin`, `replaceByAdmin`) and
diverge by one on each side. `auth.service.ts`'s own `.toLowerCase()` calls
(8 sites) are all lookups or a bulk-import dedupe key — `AuthService` never
writes `email` directly; it delegates to `UsersService`. None of the
`email` write sites trims. (Revision 1 of this ADR cited `auth.service.ts`
as the precedent and mis-derived the write-path set from it; Revision 2
corrected the write-path set but still overstated the sets as identical —
this revision corrects that overstatement.)

**Concrete failure this produces today**, beyond the case-collision
`ADR-0008` names:

- `username` accepts an empty string (`""`) as a valid value — it passes
  `@IsString()`, and the unique constraint treats it as a real value like
  any other. `username` is nullable and `updateProfile()` already branches
  on `!== undefined` rather than truthiness, so an explicit `null` likely
  already clears it today — this differs from `FC-003` in
  `docs/features/user-profile-settings/PRD.md`, which is scoped to
  **non-nullable** fields (`languageCode`, `timezone`, `preferences`) and
  does not cover `username`; a prior revision of this ADR incorrectly cited
  FC-003 as evidence that clearing `username` is currently broken. The
  actual, present-tense defect is narrower: `""` is a *distinct value from
  `null`* that a client might plausibly send (e.g. a form field's default
  empty state, submitted without distinguishing "untouched" from
  "explicitly cleared"), and it is a valid, storable, unique-constrained
  value today. The first user to submit `username: ""` consumes that
  unique slot; a second user attempting the same currently gets an
  **unhandled 500** (per PRD FC-001, the `P2002` catch `ADR-0008` requires
  on `updateProfile()` is not yet implemented).
- Leading/trailing whitespace is preserved verbatim, so `"alice"` and
  `" alice "` persist as distinct identities with no error at write time.
- Only **one** of the four write paths is pre-checked at all —
  `createWithProfile()`, and only indirectly, via its two `AuthService`
  callers (`registerWithProfile()`/`createUserWithProfileAsAdmin()`, which
  call `findByUsername()` before delegating to it — these are callers, not
  independent writers, per above). The three remaining independent write
  paths — `updateProfile()`, `updateByAdmin()`, `replaceByAdmin()` (the
  latter two guard `email` via `ensureEmailAvailable()` but have no
  equivalent for `username`) — have **no** pre-check at all, so a
  case-variant collision on `PATCH /users/me`, `PATCH /users/:id`, or
  `PUT /users/:id` currently happens unconditionally and **succeeds
  silently** (case-sensitive exact match never detects it), not only under
  a race.

## Decision drivers

- **`username` is decided to be a case-insensitive identity, matching
  `email`.** This was an open product question (PRD Q-014) as of Revision 2
  of this ADR; it is resolved here by explicit product/owner direction, not
  derived from source evidence — the codebase itself is silent on the
  question (schema, DTO, and service all treat `username` as an opaque
  string with no stated semantics). Reasons given: prevent lookalike
  identities (`"Alice"` vs `"alice"` impersonating one another), keep any
  future username-based feature (e.g. @-mentions, username login) behaving
  consistently with how `email` already behaves, and avoid a second,
  differently-cased identity model in the same system. This decision is
  the reason Options A/B/D below are worth comparing at all — if `username`
  were instead decided to be a case-sensitive display handle, this ADR
  would reduce to only the empty-string/whitespace fix (see Option C).
- The unique constraint's enforcement only means anything if the values it
  compares are the values a human intends to be distinct.
- This decision determines what `UsersService.updateProfile()`'s FC-001 fix
  (`ADR-0008`'s required `P2002` catch) is actually catching: an
  exact-string collision only, or a normalized-identity collision.
- **Enforcement-mechanism risk is itself a driver.** Revision 1 of this ADR
  demonstrated, in its own draft, that a discipline-based approach
  (normalize in application code, remember to do it everywhere) is easy to
  get wrong — it mis-scoped its own write-path set, and Revision 2 still
  overstated part of its own evidence (see Context). `ADR-0008` shows the
  same failure mode for `email`: its write-path enumeration needed a
  revision to reach completeness. This history favors weighing a
  construction-enforced mechanism, not just an application-level one.

## Options considered

### Option A — Normalize at write time (lowercase + trim) in `UsersService`

All four write sites (`createWithProfile`, `updateProfile`, `updateByAdmin`,
`replaceByAdmin`) lowercase and trim `username` before persistence, mirroring
the existing `email` write-time normalization in the same file.
`findByUsername()` is updated to lowercase its argument, mirroring
`findByEmail()`.

- **Advantages:** Matches the actual, working precedent in this codebase
  (`UsersService`'s `email` handling); closes the case-collision gap
  outright when applied to all four sites; no schema migration.
  **Disadvantages:** Enforcement depends entirely on every current and
  future write site remembering to normalize — the exact discipline
  failure this ADR's own history (see Decision drivers) has already
  demonstrated once. A future write path (or a missed one, as in Revision 1)
  silently reopens the gap.

### Option B — Leave storage as-is; normalize only at comparison time (case-insensitive query)

`findByUsername()` changes to a case-insensitive lookup (e.g. Prisma's
`mode: 'insensitive'`); stored values keep whatever casing/whitespace the
user submitted.

- **Advantages:** Preserves a user's chosen display casing.
  **Disadvantages:** Does not touch the empty-string or whitespace-padding
  problem (not a casing issue). More severely: `updateProfile()` has no
  pre-check at all today, so under Option B alone a case-variant collision
  on `PATCH /users/me` is written successfully, unconditionally, with the
  unique index never noticing (exact-string index, case-preserved storage).
  Does not match the codebase's `email` precedent, which normalizes at
  write time rather than comparing case-insensitively over raw storage.

### Option C — Leave undecided; document as accepted current behavior

Explicitly ratify the status quo: `username` is case-sensitive,
whitespace-sensitive, and empty-string-permitting, by design.

- **Advantages:** Zero implementation cost.
  **Disadvantages:** Does not address the concrete, present-tense
  empty-string collision bug, which is a defect independent of the
  case-sensitivity question and not something "leave undecided" resolves.

### Option D — Database-level enforcement via `citext`

Change `UserProfile.username` from `String?` to a case-insensitive
Postgres column type, expressed in `schema.prisma` as `String? @db.Citext
@unique`. **This project has no `backend/prisma/migrations/` directory** —
`npm run setup` and `npm run db:migrate` both run `npx prisma db push`
(`scripts/setup.js:39`, `scripts/migrate.js:33`), not `prisma migrate`.
Two implementation mechanics are **unverified against this project's
actual Prisma version and a live `db push` run, not assumed to be settled**:
whether `@db.Citext` requires the `postgresqlExtensions` preview feature
to be recognized at all (that feature governs declaring/managing
extensions in the `datasource` block; whether native-type recognition
depends on it specifically is not confirmed here), and whether
`extensions = [citext]` causes `db push` to create the extension itself
or whether `CREATE EXTENSION citext` must be run out-of-band before `db
push` executes. `db push` may also require `--accept-data-loss` to apply
a `text → citext` column type change — also unverified. All three should
be confirmed with a live `db push` run before implementation; if `db
push` does create the extension automatically, this option's adoption
cost is lower than stated below. Postgres 16 (this project's image,
`postgres:16-alpine`) ships `citext` in contrib by default; no elevated
database privileges are needed in this project's local-only deployment.
The Prisma Client's TypeScript type for `username` remains `string`
either way — this is a database-level semantic change invisible to the
type system; no in-memory string comparison in the codebase gains
case-insensitivity from this alone.

A pure functional index (`UNIQUE (lower(username))` alongside a plain
`String?` column) was considered and rejected as a variant: Prisma's schema
DSL has no native support for expression indexes at all, independent of
which migration workflow (`db push` or `prisma migrate`) the project uses
— it would require the unique constraint to be defined and maintained
entirely outside Prisma's schema-driven model, which `db push`'s
schema-diffing behavior could then conflict with on a future `db push` run.
`citext` achieves the same guarantee while staying inside Prisma's
supported, schema-declared feature set.

`citext` does not trim whitespace — that remains an application-level
concern regardless of this option.

- **Advantages:** Enforced by construction, not by code-review discipline —
  closes exactly the risk this ADR's own history demonstrates (a missed
  write path, twice — see Context). Directly available in this project's
  Postgres version with no elevated privileges.
  **Disadvantages:** Likely requires enabling a Prisma preview feature
  (`postgresqlExtensions`) not currently used in this project, and possibly
  an out-of-band step to create the extension, since this project has no
  migration-file workflow to carry a `CREATE EXTENSION` statement the way
  `prisma migrate` would — both mechanics are unverified (see this
  option's opening paragraph and Risks) and could turn out cheaper than
  stated here. Does not solve whitespace trimming or
  empty-string handling by itself; those remain Option A's job regardless.
  Introduces a Postgres-specific column type, a portability consideration
  if the database engine ever changed (not a concern currently — see
  `ARCHITECTURE.md`, Postgres is a fixed dependency here).

## Decision

**Option A + Option D, combined — application-level trim/empty-to-null
handling in `UsersService`, plus `citext` for database-level
case-insensitive uniqueness.** `username` becomes a `citext` column
(construction-enforced case-insensitive uniqueness), and `UsersService`'s
four write sites additionally trim whitespace before persisting (a concern
`citext` doesn't address). **If the value is empty after trimming, it is
converted to `NULL` and stored as such** — never rejected as invalid input
(see "Empty-after-trim" below for the rejected alternative and its
trade-off). Whether `findByUsername()` needs an explicit argument-side
`.trim()`/normalization call, or whether `citext` comparison already makes
that unnecessary, is **not asserted here — see OQ-5**: `citext`'s
`text ↔ citext` cast behavior means the effective case-sensitivity of a
Prisma-generated `WHERE` clause depends on how Prisma binds the query
parameter, which has not been verified against generated SQL for this
project's Prisma version.

This combination is chosen over Option A alone because Option A's failure
mode (a missed write path silently reopening the gap) has already occurred
twice in this ADR's own revision history (see Context), and `citext`
removes that failure mode by construction rather than asking the same
discipline to succeed a third time. It is chosen over Option D alone
because `citext` does not address whitespace or empty-string handling,
both of which are separately real defects (see Context).

### Sequencing dependency on `ADR-0008`

**This decision depends on `ADR-0008`'s required `P2002` catch being
implemented on `UsersService.updateProfile()` (and, by the same reasoning,
on `updateByAdmin()`/`replaceByAdmin()`, which currently have no username
pre-check either) *before* the `citext` constraint is enabled.**
`ADR-0020` defines *what values collide* (case-insensitive identity);
`ADR-0008` defines *how a collision is reported* (409, canonical message).
Today, a case-variant username collision on those three write paths
succeeds silently — no pre-check catches it. If `citext` ships first, the
same collision becomes an **unhandled 500** on all three routes, since no
code currently catches the resulting `P2002` (verified: no
`P2002`/`PrismaClientKnownRequestError`/exception filter exists anywhere
in `backend/src`). This is not a hypothetical ordering nicety — it
determines whether shipping this decision improves or worsens the current
behavior of three live routes. `ADR-0020` does not include its own
conflict-handling requirement; it relies on `ADR-0008`'s.

### Empty-after-trim: convert to `NULL`

An empty-after-trim `username` is stored as `NULL`. `username` is nullable
(`String? @unique`) and Postgres permits unlimited `NULL` values under a
unique index (unaffected by the `citext` change), so this closes the
empty-string collision. This decision relies on `username` not being a
mandatory field anywhere in the product — see Assumptions.

**Rejected alternative:** reject an empty-after-trim submission with a
validation error (`400`) instead of converting to `NULL`. This was
rejected because it gives no working way to clear an already-set
`username` (unlike other nullable profile fields, which can be cleared via
explicit `null` in the request body — see Context). Its own downside,
recorded here rather than left unstated: convert-to-`NULL` also means a
client bug that accidentally sends `""` (rather than omitting the field)
silently clears a user's `username` with a `200` response and no error
feedback, indistinguishable from a deliberate clear. This trade-off
(silent-clear risk vs. no-clear-affordance) was weighed in favor of
convert-to-`NULL` because the DTO already treats `undefined` (omit) and
`null`/`""` (clear) as meaningfully different states elsewhere in this
write path, and losing the only working clear-affordance was judged the
worse of the two failure modes.

### Backfill

Whether a backfill of existing rows is needed before this decision can be
implemented safely is **unresolved — see OQ-1.**

This decision does **not** specify:
- A maximum length or character-set restriction for `username` — a
  narrower, separate validation question. `docs/features/user-profile-settings/PRD.md`
  Q-006a does not currently cover `username` (it lists `bio`, `websiteUrl`,
  `location`, `preferences` only); this gap should be tracked against
  PRD Q-014 instead, or Q-006a amended to include `username` — a PRD-level
  correction, not something this ADR can fix directly. Noting for the PRD
  owner: `bulk-user-import.parse.ts:108-109` already enforces a 50-character
  limit on one path only, an existing inconsistency this ADR does not
  resolve.
- Display casing: `citext` preserves the originally-submitted casing in
  storage and on read (unlike lowercasing at write time, which Revision 1
  proposed) — `citext` compares case-insensitively but does not fold the
  stored value, so `"JohnDoe"` submitted stays `"JohnDoe"` in storage. This
  resolves Revision 1's display-casing concern as a side effect of choosing
  `citext` over plain lowercasing, without needing a separate hybrid design.
- The exception type/HTTP status thrown when an admin bulk-import row's
  `username` collides post-normalization, or when `bulkImportUsersFromFile`
  (`auth.service.ts:394-435`, which calls `createUserWithProfileAsAdmin` and
  branches on `ConflictException` for its `skipped`-vs-`failed`
  classification) encounters a `citext`-detected collision it would not
  have detected pre-`citext`. This is an implementation detail contingent
  on how the `citext` constraint violation surfaces through Prisma
  (likely still `P2002`, but not verified) — flagged for implementation,
  not decided here.
- **`docs/features/user-profile-settings/DISCOVERY.md` Candidate #5's
  bundling recommendation for PRD Q-015** (`UsersService.updateProfile()`'s
  writes are not wrapped in a transaction, so a rejected update is
  correct-by-ordering rather than correct-by-guarantee — see `ADR-0008`
  Risks). Explicitly **declined**: this ADR stays scoped to username
  identity normalization. `citext` does increase how often
  `updateProfile()`'s `P2002` path fires (case-variant collisions that
  succeed silently today will begin throwing once this decision and
  `ADR-0008`'s catch are both implemented — see Decision, "Sequencing
  dependency"), which raises real exposure to Q-015's underlying risk, but
  addressing the transactionality question itself is left to whichever
  future ADR or PRD action takes up Q-015 directly.

## Consequences

**Positive:**
- Case-collision uniqueness is enforced at the database level, independent
  of which code path performs a write — closes the discipline-failure risk
  this ADR's own revision history has demonstrated twice.
- Closes the empty-string collision bug.
- Display casing is preserved (a `citext` property), avoiding the
  lowercasing-loses-casing tradeoff Revision 1 accepted.
- Trimming still requires the four `UsersService` write sites to cooperate,
  but a *missed* trim only leaves padding, not a collision — the
  uniqueness guarantee itself does not depend on it.

**Negative:**
- Likely requires enabling a Prisma preview feature and possibly an
  out-of-band extension setup step this project's current tooling doesn't
  obviously provide a place for (see Option D, Risks — both mechanics are
  unverified and could be cheaper than stated) — a larger and potentially
  riskier change than Option A alone, though the flagged risk (missed
  write path) is removed rather than accepted.
- Whitespace trimming still requires code changes at four sites; a missed
  site produces cosmetic padding issues, not a correctness failure, but is
  still a defect worth catching.
- Backfill status is unresolved (OQ-1) — this decision should not be
  implemented against a persistent environment until that question is
  answered.
- The bulk-import exception-classification question (see "This decision
  does not specify," below) is deferred to implementation.
- **Asymmetry with `email`:** after this decision, `username`'s
  case-insensitive uniqueness is enforced by construction (`citext`) while
  `email`'s equivalent requirement (`PRD-Registration` BR-002) remains
  enforced only by application discipline — `ADR-0008` named `citext`/a
  functional index for `email` as "a real option, not required by this
  decision" and deferred it, leaving the same discipline-based risk this
  ADR's history argues against for `username`. This ADR does not decide
  whether to revisit that deferral for `email`. **If** enabling
  `postgresqlExtensions` turns out to be required for this decision (see
  Option D — unverified), that adoption cost would be paid once here,
  which would lower the marginal cost of doing so later for `email`; if
  it turns out not to be required, this argument doesn't apply.

## Risks

- **Sequencing risk:** shipping the `citext` constraint before `ADR-0008`'s
  `P2002` catch is implemented on `updateProfile()`/`updateByAdmin()`/
  `replaceByAdmin()` turns silently-succeeding case-variant collisions on
  those three routes into unhandled 500s (see Decision, "Sequencing
  dependency on `ADR-0008`"). This is the highest-severity risk in this
  ADR — implementation must confirm the catch is in place first.
- **Migration-mechanism risk:** this project has no migration-file
  workflow (`db push` only, no `backend/prisma/migrations/`). Three
  mechanics are unverified against this project's Prisma version and a
  live `db push` run: whether `@db.Citext` requires
  `postgresqlExtensions` at all, whether `db push` creates the `citext`
  extension itself or requires an out-of-band step, and whether
  `--accept-data-loss` is needed for the `text → citext` type change (see
  Option D). If `db push` handles extension creation automatically, this
  risk — and Option D's stated adoption cost — is smaller than currently
  written. This is a first-use risk specific
  to this repo's tooling, not a risk with `citext` itself.
- **Backfill risk (OQ-1) — recurring via `db:dump`/`db:restore`, not a
  one-time migration-time event, and likely a silent-partial failure
  rather than a loud one.** If mixed-case legacy data exists and this
  decision ships without addressing it, applying the `citext` constraint
  can fail on a data-only dump restored into a `citext`-constrained
  database — this recurs on every `npm run db:restore`, and on every fresh
  `npm run setup`, since `setup.js:63-69` restores `data/postgres-dump.sql`
  automatically whenever it exists, not only at the original migration
  time. (`scripts/dump.js:72` uses `--data-only`, so a dump cannot revert
  the column's `citext` type itself — only row-level data collisions are a
  risk, not schema drift.) The originally-stated framing — that this is a
  **safer** failure mode because it is "caught immediately" — needs
  qualifying: `scripts/restore.js:45` pipes the dump into `psql` with no
  `ON_ERROR_STOP` flag, and a plain `pg_dump --data-only` output is not
  wrapped in a transaction. Under those conditions, a `citext` unique
  violation likely aborts only the offending `COPY` statement — `psql`
  continues past it, `restore.js`'s error handling never fires, and
  "Restore complete" prints with a `0` exit code, leaving `user_profiles`
  silently partially populated rather than causing a visible failure. This
  inference is drawn from the absence of `ON_ERROR_STOP` and `pg_dump`'s
  non-transactional plain-text output, not from an executed test — treat
  the specific failure shape as high-confidence but unverified in this
  environment. The checked-in dump itself was checked and found clean, and
  provably safe against this constraint (see OQ-1: its 591 `username`
  values are already unique under the current exact-match index, so they
  cannot newly collide under a case-insensitive one) — but that cleanliness
  is a property of the current commit, since `scripts/dump.js` overwrites
  the file in place, not a durable guarantee. This failure shape should be
  understood before implementation, not discovered via a partially-empty
  `user_profiles` table after a routine `db:restore`.
- **Trimming remains discipline-based:** Option D only removes risk for the
  case-folding half of this decision; the trim half still depends on all
  four write sites cooperating, same risk class as Option A alone (smaller
  blast radius — padding, not a collision).

## Assumptions

- `username` is not a mandatory field anywhere in the product today.
  Verified: no `@IsNotEmpty()` or equivalent exists on `username` in any
  DTO (`UpdateProfileDto`/`AdminPatchUserDto`/`AdminReplaceUserDto`/
  `RegisterWithProfileDto`), the frontend registration flow does not
  require it, and no seed script writes it. This is what makes
  converting an empty-after-trim value to `NULL` safe rather than a
  silent way to satisfy a "required" field with an absent value. **Impact
  if wrong:** a future mandatory-username flow would need either a
  different empty-string treatment or its own DTO-level `@IsNotEmpty()`,
  independent of this decision.
- No plan exists to move off Postgres/Prisma; `citext` is evaluated within
  that constraint, consistent with `ADR-0008`'s own assumption.
- `bulkImportUsersFromFile`'s `instanceof ConflictException` branching
  (`auth.service.ts:394-435`) is treated as a real, permanent contract,
  per `ADR-0008`'s own investigation — this decision must not break it
  silently (see OQ-2).

## Open Questions

| ID | Question | Blocks | Status |
|---|---|---|---|
| OQ-1 | Does any environment this project runs in hold `user_profiles` rows with pre-existing mixed-case or whitespace-padded `username` values? Determines whether a backfill is a precondition for the `citext` migration or unnecessary. Investigation found a persistent Docker volume (`docker-compose.yml`, `postgres_data`) not wiped except by explicit `db:reset`; no seed script writing `username`; and — the principal in-repo source of pre-existing data — `data/postgres-dump.sql`, a checked-in `pg_dump` restored automatically by `npm run setup` (`scripts/setup.js:63-69`) and by `npm run db:restore`. All 591 `user_profiles` rows in that file carry uniformly lowercase, machine-generated `username` tokens (e.g. `io_tc01_…`, `login_…`) — no mixed case, whitespace padding, or empty values found, and since these values are already unique under today's exact-match index, they are **provably** safe against a case-insensitive constraint, not merely observed-clean. **This closes the question only for the checked-in dump, and only as of the current commit** (`scripts/dump.js` overwrites the file in place on each `db:dump`, so this isn't a durable guarantee) — ad-hoc manually-created data in a long-lived local database, outside the checked-in dump, still cannot be ruled out from source alone. | Implementation of this ADR | Open — owner input requested (checked-in dump confirmed safe; ad-hoc local data unconfirmed) |
| OQ-2 | What exception type/status does a `citext`-detected collision surface as through Prisma (still `P2002`, or different), and how should `bulkImportUsersFromFile`'s `skipped`-vs-`failed` classification treat it? | Implementation, `ADR-0008`'s bulk-import contract | Open |
| OQ-3 | Is `PRD-UserProfileSettings` Q-006a the right home for `username` length/charset limits, or should Q-014 own it, or should Q-006a be amended? | PRD cross-reference accuracy | Open — PRD-level, not this ADR's to resolve |
| OQ-5 | Does a Prisma `findUnique({ where: { username } })` against a `citext` column reliably compare case-insensitively, or can the bind parameter's implicit `text` typing force a case-sensitive comparison (a documented `citext` hazard: `citext → text` is an implicit cast, `text → citext` is only an assignment cast)? Must be verified against generated SQL before implementation — if it does not hold, `findByUsername()`'s pre-checks silently stop catching case variants, which feeds directly into the sequencing risk above. | Implementation, `findByUsername()` correctness | Open |

## Related

- `ADR-0008` — Duplicate Email/Registration Race Handling (Accepted).
  Observes this gap without assigning it an owner; this ADR is the response
  to that observation, not a commissioned follow-up. **`ADR-0020` depends
  on `ADR-0008`'s `P2002` catch being implemented before the `citext`
  constraint is enabled** — see Decision, "Sequencing dependency on
  `ADR-0008`."
- `docs/features/user-profile-settings/PRD.md` — FC-001, Q-002, Q-006a,
  Q-014 (this decision resolves Q-014 by explicit product direction — see
  Decision drivers; Q-002/FC-001 remain a separate, already-decided-by-
  `ADR-0008` implementation gap; Q-006a's coverage of `username` is
  questioned, see OQ-3).
- `docs/features/user-profile-settings/DISCOVERY.md` — Candidate ADR #1.

## Revision history

- **Revision 1** (2026-07-28): Initial draft. Chose Option A alone
  (application-level lowercase+trim), sourced the `email` precedent from
  `auth.service.ts` (incorrect — those are read paths), and named an
  incomplete 3-path write-path set that omitted the admin `PATCH`/`PUT
  /users/:id` surface. `architecture-reviewer` Full Review returned "Needs
  Changes" (12 findings, F1/F3 Critical/High on write-path and precedent
  accuracy, F4 on missing the `citext` option, F5 on empty-string handling,
  F7 on backfill). Superseded by Revision 2 in place (not a new ADR number
  — the decision identity is unchanged, only its correctness).
- **Revision 2** (2026-07-28): Corrects the write-path enumeration and
  `email` precedent citation; adds Option D (`citext`) and changes the
  Decision to Option A+D combined; changes empty-string handling from
  reject to convert-to-`NULL`; records the backfill question as an
  explicit, unresolved Open Question rather than an "execution detail." A
  subsequent self-check (same day, not separately versioned) fixed a
  contradictory sentence, added an Assumptions section, and added a
  (subsequently found to be false — see Revision 3, N1) subsection on
  `UsersService.findAll()`'s username search.
- **Revision 3** (2026-07-29): `architecture-reviewer` Full Review
  returned "Needs Changes" on Revision 2 (5 High, 7 Medium, 3 Info
  findings, N1-N15). Owner confirmed three decisions before rework: (1)
  `username` is a case-insensitive identity, resolving PRD Q-014 by
  explicit direction rather than leaving it asserted without argument; (2)
  `ADR-0020` depends on `ADR-0008`'s `P2002` catch shipping first, rather
  than including its own conflict-handling requirement; (3) the combined
  application-trim + database-`citext` enforcement model is confirmed.
  This revision: deletes the false `findAll()` search subsection and its
  dependent Consequence/Open-Question entries (N1 — the actual code at the
  cited line is a CSV export header, not search logic, and `findAll()`
  only searches `email`/`id`); rewrites Option D against this project's
  actual `prisma db push`-only workflow, which has no migration-file
  mechanism to carry the `CREATE EXTENSION` step (N2); adds an explicit
  sequencing dependency on `ADR-0008` to the Decision and Risks (N3);
  demotes the "`findByUsername()` needs no change" claim from an assertion
  to Open Question OQ-5, given `citext`'s implicit/assignment-cast
  asymmetry (N4); grounds the case-insensitive-identity decision in
  explicit product direction (N5); names the resulting enforcement
  asymmetry with `email` as a Consequence (N6); corrects the FC-003
  mischaracterization and the resulting overclaimed "gives users a working
  way to clear" benefit (N7); corrects two remaining ADR-0008/email
  write-path-set overstatements (N8); corrects the "no other write path"
  50-character-limit claim (N9); corrects the "`updateProfile()`
  specifically" unguarded-path claim to state that 3 of 4 paths are
  unguarded (N10); records the rejected reject-on-empty alternative and
  its own downside (N11); names the `@db.Citext` schema mechanism and
  notes the Prisma Client TypeScript type is unaffected (N12); and
  completes this revision history entry (N15).
- **Revision 4** (2026-07-29): `architecture-reviewer` Full Review on
  Revision 3 returned "Accept with changes" — decision confirmed sound and
  independently stress-tested; 3 blocking evidence corrections (F1-F3) and
  2 non-blocking corrections (F4, F6), plus one small owner decision (F5).
  Owner declined bundling PRD Q-015 (`updateProfile()`'s un-transactioned
  writes) into this ADR, keeping it scoped to username identity
  normalization. This revision: corrects the write-path pre-check count
  (was "two of four," is actually one of four — F1); softens the Option D
  Prisma/`citext` mechanism claims (`postgresqlExtensions` requirement and
  whether `db push` creates the extension automatically) from asserted
  fact to explicitly unverified, matching how `--accept-data-loss` was
  already handled (F2); extends OQ-1's investigation to
  `data/postgres-dump.sql` — the project's principal in-repo source of
  pre-existing `username` data, found to contain only clean
  lowercase/machine-generated tokens (F3); reframes the backfill risk as a
  recurring hazard via `db:dump`/`db:restore`, not a one-time
  migration-time event (F4); records the declined Q-015 bundling
  explicitly in "This decision does not specify" (F5); and softens
  "ADR-0008 considered and declined citext for email" to "named it as an
  option and deferred it" (F6).
- **Revision 5** (2026-07-29): Delta Review on Revision 4 returned
  "Continue" (no escalation) — 5 of 6 fixes fully resolved and
  independently re-verified against source (including a full re-check of
  all 591 `data/postgres-dump.sql` rows); F2 found partially resolved (one
  remaining sentence still asserted the `postgresqlExtensions` requirement
  as settled). Two findings addressed in this revision: N1 — the
  "Asymmetry with `email`" Consequence bullet now conditions its
  adoption-cost argument on `postgresqlExtensions` actually being required,
  rather than asserting it; N2 — the Backfill Risk bullet corrected to
  state the likely failure mode is a **silent, partial** restore (no
  `ON_ERROR_STOP` in `scripts/restore.js`, non-transactional `pg_dump
  --data-only` output), not the loud, immediately-caught failure the prior
  wording implied — this is a materially different operational
  consequence and was worth getting right before acceptance. OQ-1 also
  strengthened to state the checked-in dump is provably (not just
  observed-) safe, while being explicit that this holds only for the
  current commit. Per owner decision, `Status` moved **Proposed →
  Accepted** — no architectural blockers remain; all further open items
  (OQ-1 ad-hoc-data confirmation, OQ-2, OQ-3, OQ-5) are implementation-time
  or cross-document concerns, not decision-level ones. PRD Q-015's
  bundling into this ADR remains explicitly declined (F5, unchanged from
  Revision 4) — scope held to username identity normalization only.
