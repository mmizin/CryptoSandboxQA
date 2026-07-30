# Bulk User Import (CSV/JSON)

| Field | Value |
|---|---|
| Status | Draft |
| Mode | Existing Feature |
| Discovery | Initial |
| Confidence | High for source-read behavior — corrected after Full Review round 1 caught two sibling-route/rationale misattributions and one risk-severity understatement, and Delta Review round 1 independently re-verified ~20 of the resulting citations against source (see round-1 correction notes throughout) — except two behaviors recorded but explicitly unverified against a live instance (Q-011's file-size rejection response shape, Q-012's max-batch request duration). Low for product intent (atomicity, limits, validation-unification, and reporting-model questions) and for two cross-PRD/ADR dependencies not yet resolved elsewhere (`PRD-AdminRoleGuards` Q-008, `ADR-0020` OQ-2). |
| Owner | |
| Last updated | 2026-07-29 |
| Slug | PRD-BulkUserImport |

## Overview

Bulk User Import lets an authenticated admin upload a single CSV or JSON file
of user records and create many accounts in one request, instead of calling
the single-user admin-create route (`POST /auth/admin/create-user`) once per
user. **Correction (Full Review round 1):** that single-create route is
distinct from `PRD-AdminUserCreation`'s `POST /auth/admin/register` bootstrap
path — see Current Behavior for the distinction and Q-010 for the fact that
no PRD currently documents `admin/create-user` itself. This feature shares
that route's underlying account-creation call and admin-session guard stack,
but — per Current Behavior and FR-004 — uses its **own, independently
written row-validation rules**, which are not identical to that route's.
It processes up to 500 rows per request and reports a per-row outcome
(`created` / `skipped` / `error`) rather than succeeding or failing as one
unit.

## Current Behavior

Read directly from source (`backend/src/auth/auth.controller.ts:152-188`,
`backend/src/auth/auth.service.ts:293-438`,
`backend/src/auth/bulk-user-import.parse.ts`,
`frontend/app/admin/import-users/page.tsx`,
`frontend/lib/adminUserImport.ts`), per this plan's inventory-primary rule
(inventory entry at `FEATURES_INVENTORY.md:157-171` consulted first; source
read only to verify architecture and resolve the Definition-of-Ready open
questions below).

- **Route is `POST /auth/admin/bulk-import-users`, gated by
  `JwtAuthGuard, SessionGuard, AdminGuard`** (`auth.controller.ts:152-153`) —
  a full authenticated admin session, the same guard stack
  `PRD-AdminRoleGuards` documents for other admin routes. **Correction (Full
  Review round 1):** this is the *identical* guard stack used by
  `POST /auth/admin/create-user`, the single-account counterpart to this
  feature (`auth.controller.ts:121-122`) — not `PRD-AdminUserCreation`'s
  `POST /auth/admin/register` bootstrap path, which is a different route
  gated by a static `ADMIN_API_KEY` instead of a session
  (`auth.controller.ts:106-107`). There is no `ADMIN_API_KEY`-gated
  bulk-import route, and this feature's guard model never touches that
  bootstrap path at all — the two are unrelated beyond both living under
  `/auth/admin/*`. `admin/create-user` currently has no PRD of its own; see
  Q-010. **Caveat (Delta Review round 1):** this session-gated reading of
  `admin/create-user` is confirmed directly from source
  (`auth.controller.ts:121-122`), but is stated elsewhere in this
  documentation set as an open contradiction, not settled fact —
  `PRD-AdminRoleGuards` Q-008 records that `CLAUDE.md` documents this same
  route as `ADMIN_API_KEY`-gated instead, and has not resolved which
  reading is intended. This PRD relies on the code reading (as
  `PRD-AdminUserCreation`'s own Q-001 does), but does not treat Q-008 as
  closed — see Q-010.
- **Single multipart file upload, field name `file`, backed by
  `AuthService.bulkImportUsersFromFile()`** (`auth.controller.ts:183-188`,
  `auth.service.ts:343`). The inventory's method name
  `bulkImportUsers()` does not match source; the actual method is
  `bulkImportUsersFromFile()`. **Extended (Delta Review round 1) — three
  further inventory/source mismatches found alongside this one**, none
  previously recorded: `FEATURES_INVENTORY.md:167` lists `firstName,
  lastName` as accepted columns, which do not exist in
  `IMPORT_CSV_HEADERS` (the actual columns are enumerated above);
  `FEATURES_INVENTORY.md:169` says "Batch insert to `users` table", but
  creation is a strictly sequential per-row loop, not a batch insert (see
  below); `FEATURES_INVENTORY.md:170` describes the response as a "List of
  created users", but the actual response is `{ created, failed, skipped,
  rows }` with every row's outcome, not only the created ones. The same
  "Same rules as single user create" line this Overview and FR-004 already
  correct (`FEATURES_INVENTORY.md:168`) is the fourth. **Correction (Delta
  Review round 2) — the endpoint's own Swagger text is not a fifth
  instance of this claim.** `auth.controller.ts:170`'s `@ApiBody`
  description ("Same columns as single create-user") is a claim about
  *column names*, not validation rules, and it is accurate — both paths
  do share the same 13 field names. `auth.controller.ts:178`'s
  `@ApiOperation` description ("Rows are validated like the import
  template") refers to the CSV/JSON template, not to `create-user`, but is
  vague enough that it tells a reader nothing about the divergences FR-004
  documents. See Q-013, which tracks correcting all four inventory lines
  and sharpening the `@ApiOperation` description above — not the accurate
  `@ApiBody` line — beyond the method-name mismatch already noted.
- **Hard limits enforced at two layers**: `FileInterceptor` rejects any file
  over `MAX_IMPORT_FILE_BYTES` (5 MB) before parsing
  (`auth.controller.ts:157-159`, `bulk-user-import.parse.ts:19`), and the
  parser separately rejects a file whose row count exceeds
  `MAX_IMPORT_ROWS` (500) for both CSV and JSON
  (`bulk-user-import.parse.ts:20,179-184,222-227`). **Resolves the
  Definition-of-Ready open question on row/file-size limits**: 500 rows,
  5 MB, both fixed constants, not currently configurable per environment or
  per request.
- **Format is detected by filename extension only (`.csv` or `.json`),
  case-insensitive — not by content-sniffing or a declared MIME type**
  (`bulk-user-import.parse.ts:161-164`). A `.csv`-named file containing JSON,
  or vice versa, is parsed as whichever format its extension names and will
  fail parsing under that format's rules. **Resolves the Definition-of-Ready
  open question on format detection.**
- **CSV parsing requires an exact, fixed 13-column header, in a fixed
  order**: `email, password, displayName, username, fullName, photoUrl, bio,
  websiteUrl, location, birthday, languageCode, timezone, preferences`
  (`bulk-user-import.parse.ts:3-17`). Header comparison is case-insensitive
  and strips a leading UTF-8 BOM, but column *order* and *count* are rigid —
  a reordered, renamed, or partial header set is rejected as a whole-file
  error before any row is read (`bulk-user-import.parse.ts:204-219`). The
  delimiter is auto-detected as comma or semicolon by counting occurrences in
  the header line (`bulk-user-import.parse.ts:72-76`); quoted fields
  (`"..."`, with `""` as an escaped quote) are supported
  (`bulk-user-import.parse.ts:40-62`); rows with fewer cells than the header
  are right-padded with empty strings, rows with more are rejected
  (`bulk-user-import.parse.ts:64-70,232-238`).
- **JSON parsing expects a top-level array of objects**; each object's known
  keys are whitelisted into the payload shape (unknown keys are silently
  dropped, not rejected) (`bulk-user-import.parse.ts:131-154`). A non-array
  top level, or any array element that is not a plain object, rejects the
  whole file (`bulk-user-import.parse.ts:169-193`).
- **Whole-file rejection occurs for**: a file over `MAX_IMPORT_FILE_BYTES`
  (5 MB), rejected by `FileInterceptor` before the request handler runs at
  all — **verification gap**: the exact status/message this produces was
  not directly confirmed against a live request; see Q-011 rather than
  assuming it matches the `400 Bad Request` the parser-level rejections
  below return. The parser itself (`400 Bad Request`, no rows processed)
  additionally rejects: unsupported extension, empty file content,
  invalid/non-array JSON, a non-object JSON array element, over 500 rows,
  wrong CSV column count or header mismatch, a CSV row with more cells than
  the header, or a CSV `preferences` cell that is not valid JSON-object text
  (`bulk-user-import.parse.ts`, multiple sites cited above). All of these are
  distinct from row-level outcomes below — a whole-file rejection means *no*
  accounts are created from that request.
- **Row-level validation, applied identically to every surviving row, and
  independently written from — not shared with — `admin/create-user`'s
  validation**: `bulk-user-import.parse.ts:101-129` (invoked from
  `auth.service.ts:362`) checks `email` required and matched against
  `EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/` with **no maximum length**;
  `password` required, minimum 6 characters; `displayName` ≤100 chars;
  `username` ≤50 chars; `fullName` ≤100 chars; `photoUrl` ≤500 chars; `bio`
  ≤500 chars; `websiteUrl` ≤200 chars; `location` ≤100 chars; `languageCode`
  ≤5 chars; `timezone` ≤50 chars; `birthday`, if present, checked with
  `Date.parse()` (accepts any JS-parseable date string, not just ISO). A row
  failing any of these is classified `invalid` and never reaches account
  creation. **Correction (Full Review round 1) — this is not the same rule
  set `admin/create-user` applies.** That route's `CreateUserDto` (extending
  `RegisterWithProfileDto`, `backend/src/auth/dto/register-with-profile.dto.ts:
  13-88`) uses class-validator decorators instead: `@IsEmail()` (rejects
  malformed addresses this parser's regex would accept, e.g. `user@-.com`)
  plus `@MaxLength(254)` on email (this parser has no email length limit at
  all, and `email String` in `schema.prisma` is unconstrained, so nothing
  backstops it); and `@IsDateString()` on birthday (requires ISO
  `YYYY-MM-DD`; rejects strings like `"March 5, 1990"` that `Date.parse()`
  accepts here). The other length limits (displayName, username, fullName,
  photoUrl, bio, websiteUrl, location, languageCode, timezone) match between
  the two paths. Also, `pickPayload()`/CSV-cell extraction only checks that a
  known field is a `string` (or, for `preferences`, an `object`) — a JSON
  row with the wrong type for a field (e.g. `password: 123456`, a number)
  is treated as if that field were absent, which for `password` and `email`
  surfaces as a visible "required" validation error, but for optional
  fields (e.g. `displayName: 12345`) silently drops the value and still
  reports the row `created` with no error — see Q-006.
- **Two independent, differently-reported duplicate checks exist** — this
  resolves the Definition-of-Ready open question on duplicate detection, and
  the answer is "both, reported differently, not unified":
  - **In-file duplicates by email** (same email, case-insensitive, appearing
    twice in one upload) are caught during row classification, before any DB
    call, and counted as `failed`/`error` — the second and later occurrences
    of an email are never attempted (`auth.service.ts:353,366-376`).
  - **Against-existing-account duplicates** (email or username already in
    the `users` table) are only discoverable per-row, during
    `createUserWithProfileAsAdmin()`'s DB check, which throws
    `ConflictException`; the service specifically catches this exception
    type and counts it as `skipped`, distinct from any other thrown error,
    which is counted as `error` (`auth.service.ts:308-317,418-434`).
  - **Correction (Full Review round 1) — a third case exists that fits
    neither category above.** In-file duplicate detection keys on `email`
    only (`auth.service.ts:353`); it does not check `username` across rows.
    Two rows with distinct emails but the same `username` both pass
    in-file classification and both reach `createUserWithProfileAsAdmin()`;
    the second fails that call's *own* username-uniqueness check
    (`auth.service.ts:312-317`) against the *first row's own newly created*
    account and is reported `skipped` via the same `ConflictException`
    path used for against-existing-account duplicates — even though the
    conflict is entirely within this one file, not against a pre-existing
    account. So an in-file duplicate is reported as `error` when the
    collision is on email, and as `skipped` when it is on username. See
    Q-005 (superseding the narrower framing this Open Question previously
    had).
- **Import is not atomic — it is a best-effort, per-row loop, not a single
  transaction.** Rows are processed sequentially; each valid, non-in-file-
  duplicate row is created independently inside its own `try/catch`, and one
  row's failure (a DB error, a race against a concurrently-created account,
  etc.) does not stop or roll back any other row in the same request
  (`auth.service.ts:394-435`). **Resolves the Definition-of-Ready open
  question on partial-failure behavior**: partial success within a single
  request is the normal, expected outcome, not an edge case.
- **Response is always `201 Created` once the file itself parses**,
  regardless of how many individual rows succeeded, were skipped, or
  errored (`@HttpCode(HttpStatus.CREATED)`, `auth.controller.ts:155`). The
  body is `{ created, failed, skipped, rows: [...] }`, where `rows` preserves
  original file order and each entry is `{ email, status: 'created' |
  'skipped' | 'error', userId?, message? }` (`auth.service.ts:383-388,437`).
  There is no distinct HTTP status for "some rows failed" — a client must
  inspect the body to learn that.
- **No welcome email is sent, and no session is issued, for any
  import-created account.** `createUserWithProfileAsAdmin()`
  (`auth.service.ts:293-340`) — the exact same function
  `admin/create-user` calls directly, not merely an analogous one — mirrors
  `register()`'s account-creation logic but does not call
  `mailService.sendWelcomeEmail()` and returns the created record rather
  than an authenticated session. This is the identical behavior
  `admin/create-user` already has, for the same reason (same shared
  function); it is unrelated to `PRD-AdminUserCreation`'s separate
  `createAdmin()` bootstrap path, which independently also skips the
  welcome email but is a different function on a different route.
- **The frontend performs a full, independent client-side re-implementation
  of parsing, per-row validation, and in-file duplicate detection**
  (`frontend/lib/adminUserImport.ts`), used to render a pre-upload preview
  before the admin confirms the import. **The original, unfiltered file is
  what gets uploaded** — `frontend/app/admin/import-users/page.tsx:113-127`
  calls `adminApi.bulkImportUsers(pending.file)` with the original `File`
  object, not a client-filtered subset — so the server independently
  re-parses and re-validates the same content and is authoritative; the
  client preview can disagree with the server's result (most concretely:
  the client cannot detect an against-DB duplicate, only the server can, so
  a row the client preview marks as passing may still come back `skipped`
  from the server). **Correction (Full Review round 1) — the two results
  are not shown as disconnected views.** `page.tsx:128-135` joins the
  server's `response.rows[i]` to the client's own unfiltered
  `pending.parsedRows[i]` **by array index**, and the resulting merged rows
  are what the admin sees and what the downloadable results artifact
  exports (`exportSuccessesJson`, `page.tsx:99-111`, exporting `sent:
  s.request` taken from this client-parsed row). No row key or index is
  returned by the server to verify this join — if the client's and
  server's row *counts or ordering* ever diverge (e.g. a parsing
  edge case — blank-line handling, delimiter-detection tie-breaking, or
  short-row padding — resolved differently by the two independently
  maintained parsers), a row's submitted data would be silently
  misattributed to a different row's reported outcome, rather than merely
  producing a "confusing preview." This is a correctness risk in the
  admin-facing result, not a cosmetic UX gap — see Q-008.
- **A file header comment in the current client module
  (`frontend/lib/adminUserImport.ts:3`) is factually stale**: it states
  "Server persists via `POST /auth/admin/create-user`", but the code three
  lines below it, and the actual call site in `page.tsx`, use
  `adminApi.bulkImportUsers()` against `POST /auth/admin/bulk-import-users`
  — the bulk endpoint, not the single-create endpoint the comment names.
  This is a documentation-accuracy defect in the source, not a product
  requirement of this feature; recorded here rather than silently corrected,
  per this plan's inventory-primary rule.
- **The same page also hosts Bulk User Export** (`runExport`,
  `page.tsx:220-250`, calling `usersApi.bulkExport()`) as an adjacent UI
  section on `/admin/import-users`. That is a distinct, separately-backlogged
  feature (`FEATURES_INVENTORY.md` "Admin User Export", backlog #14) and is
  out of scope for this PRD — noted here only because the two share one page
  in the current implementation.

## Problem Statement

An admin who needs to create more than a handful of accounts — seeding a
training cohort, restoring a set of QA test users, provisioning a batch for a
scheduled exercise — cannot reasonably do so one account at a time through
`POST /auth/admin/create-user` (**correction, Full Review round 1:** not
`PRD-AdminUserCreation`'s bootstrap path — see Current Behavior and Q-010)
or the standard registration UI. Nothing in the inventory documents *how
many* users a typical batch contains or *how often* this is run; this PRD
does not invent that context — see Q-006.

## Goals

- G-001: An authenticated admin can create many user accounts from a single
  CSV or JSON file upload, in one request, without submitting each account
  individually.
- G-002: A single malformed row in an otherwise-valid file does not prevent
  the other valid rows in the same file from being created — the admin gets
  partial success with a clear account of which rows succeeded, were
  skipped, or failed, and why.
- G-003: **Correction (Full Review round 1) — restated as an aspiration, not
  an observed property; see FR-004 and Q-003a.** Ideally the per-row fields
  and validation rules accepted by bulk import would match
  `admin/create-user`'s rules closely enough that an admin does not need to
  learn a second set of field rules for the same underlying account data.
  As documented in Current Behavior and FR-004, this is **not currently
  true** — the two paths use independently written validation with known
  divergences (email length, email format strictness, birthday format
  strictness). Whether closing that gap is worth doing is Q-003a.

## Non Goals

- Admin User Export — a separate, already-backlogged feature
  (`FEATURES_INVENTORY.md` backlog #14) that happens to share a page with
  this one in the current UI; not addressed here.
- Any bulk *update* or bulk *delete* of existing accounts — this path only
  creates new accounts; the observed against-DB duplicate behavior is
  "skip", never "update in place" (`auth.service.ts:308-317`).
- Making import atomic/transactional (all rows succeed or none do) — the
  observed design is explicitly best-effort per-row; whether that should
  change is Q-002, not decided here.
- Deciding row-count/file-size limits going forward — 500 rows / 5 MB are
  recorded as the current fixed values (see Current Behavior); whether they
  should be raised, lowered, or made configurable is Q-004.
- Any change to the `ADMIN_API_KEY`-gated single-account bootstrap path
  (`PRD-AdminUserCreation`, `POST /auth/admin/register`) — this feature
  always requires an authenticated admin session and never accepts the API
  key; that route is unrelated to this feature beyond sharing the
  `/auth/admin/*` prefix.
- Documenting `POST /auth/admin/create-user` itself as its own feature —
  this feature's single-account counterpart currently has no PRD of its own
  (see Q-010); this PRD describes it only where needed to compare against
  bulk import's behavior, and does not attempt to fully specify it.

## Users / Actors

| Actor | Type | Description |
|---|---|---|
| Admin | Human | Holds an authenticated session with `role = 'admin'` (per `PRD-AdminRoleGuards`); uploads the CSV/JSON file and reviews the per-row import outcome. |
| Backend (`AuthService`, `bulk-user-import.parse.ts`) | System | Parses the uploaded file, validates each row, creates accounts individually, and reports per-row outcomes. |

## User Stories

- US-001: As an admin setting up a training cohort, I want to upload a CSV
  or JSON file listing many users at once, so that I don't have to create
  each account individually through the single-user admin-create form.
- US-002: As an admin who uploaded a file with a few bad rows, I want to see
  exactly which rows failed and why, so that I can fix and re-submit just
  those rows instead of redoing the whole batch.
- US-003: As an admin re-running an import that partially succeeded before
  (e.g., after a partial failure), I want rows for emails that already exist
  to be skipped rather than erroring the whole file, so that re-uploading
  the same file is safe.

## Functional Requirements

### FR-001: Bulk-create accounts from an uploaded CSV or JSON file

- **Description:** The system must allow an authenticated admin to upload a
  single CSV or JSON file and create one account per valid, non-duplicate
  row it contains.
- **Actor:** Admin
- **Priority:** Must
- **Acceptance Criteria:**
  - Given a valid admin session and a `.csv` file with the fixed 13-column
    header and one or more valid data rows, when it is uploaded, then an
    account is created for each row that passes validation and is not a
    duplicate.
  - Given a valid admin session and a `.json` file containing an array of
    row objects, when it is uploaded, then the same per-row creation
    behavior applies as for CSV.
  - Given a file that parses successfully but contains zero valid rows
    (all invalid, all in-file duplicates, or all against-DB duplicates),
    when it is uploaded, then the request still returns `201 Created` with
    `created: 0` and every row accounted for in `rows` — not a `400`.
  - **(Added, Delta Review round 1 — makes FC-006 testable against a
    concrete criterion; FC-006 previously described a failure mode with no
    requirement it actually violated. Corrected, Delta Review round 2 —
    restated as discard-oriented rather than identity-oriented, since the
    original "unchanged" wording was literally false against documented,
    intentional normalizations. This is a target-state criterion, not
    current-observed behavior: FC-006 documents that it is currently
    violated for mistyped optional fields; whether that should be fixed is
    Q-003(b), not settled by this criterion's presence here.)** Given a
    row that passes validation and is created, when the created account's
    stored profile is inspected, then no field for which the row supplied
    a correctly-typed value has been **silently discarded** — documented,
    intentional normalizations (email lower-casing; `birthday` string-to-
    `Date` conversion; `languageCode`/`timezone` defaulting to `en`/`UTC`
    when absent, per Current Behavior/`users.service.ts:96-98`) are
    expected transformations, not violations of this criterion, and a row
    is not permitted to report `created` while silently dropping a
    submitted value outright (as FC-006 documents happening today for
    type-mismatched optional fields).
- **Governed by:** BR-001
- **Related:** US-001, G-001, G-003, FC-003, FC-004, FC-005, FC-006, FC-007

### FR-002: Report a per-row outcome for every row in the file

- **Description:** The system must report, for every row that was parsed
  from the file (in file order), whether it was created, skipped as an
  existing-account duplicate, or failed, along with a human-readable reason
  for any non-created outcome.
- **Actor:** Backend
- **Priority:** Must
- **Acceptance Criteria:**
  - Given a file containing a mix of valid rows, invalid rows, in-file
    duplicate rows, and rows duplicating an existing account, when it is
    processed, then the response's `rows` array has exactly one entry per
    input row, each carrying `status` of `created`, `skipped`, or `error`
    and, for non-`created` rows, a `message`.
  - Given the response overall, when inspected, then `created + skipped +
    failed` (the `error`-status row count) equals the total row count.
- **Related:** US-002, US-003, G-002

### FR-003: Reject the whole file when it cannot be parsed

- **Description:** The system must refuse the entire request, creating no
  accounts, when the uploaded file itself is unreadable as either format,
  or exceeds the fixed size limit — as distinct from individual rows
  within a readable, appropriately-sized file being invalid.
- **Actor:** Backend
- **Priority:** Must
- **Acceptance Criteria:**
  - Given a file with an unsupported extension, empty content, malformed
    JSON, a non-array JSON top level, a CSV header that doesn't match the
    fixed column set, or a row count over the fixed maximum (500), when it
    is uploaded, then the request is rejected with `400 Bad Request` and no
    account is created.
  - **(Added, Delta Review round 1 — the file-size case was previously
    recorded only in Q-011, not in this AC.)** Given a file over the fixed
    size limit (5 MB), when it is uploaded, then the request is rejected
    and no account is created — the exact response status/message this
    produces was not verified against a live request (see Q-011); this
    criterion asserts only that no account is created, not the specific
    `400 Bad Request` shape the other cases above are confirmed to return.
- **Governed by:** BR-002
- **Related:** FC-001

### FR-004: Apply bulk import's own per-row field validation

- **Description:** **Correction (Full Review round 1) — this FR previously
  asserted bulk import validates rows "using the same rules as the
  single-account admin-create path"; that is false, see Current Behavior.**
  The system must validate each row's fields (email presence and format,
  password presence and minimum length, and per-field length limits) using
  bulk import's own rule set (`bulk-user-import.parse.ts:101-129`). This
  rule set is **not** identical to `admin/create-user`'s
  `CreateUserDto`/`RegisterWithProfileDto` validation — see Current
  Behavior for the specific divergences (no email-length cap, a looser
  email-format regex, and non-ISO birthday strings accepted here that the
  other path rejects).
- **Actor:** Backend
- **Priority:** Must
- **Acceptance Criteria:**
  - Given a row missing a required field or violating a field's length or
    format rule (per bulk import's own rules, enumerated in Current
    Behavior), when it is processed, then that row is reported with status
    `error` and is not created, while the rest of the file's valid rows
    continue to be processed.
  - Given a row whose `email` exceeds 254 characters, or whose `birthday` is
    a non-ISO but JS-`Date`-parseable string (e.g. `"March 5, 1990"`), when
    it is processed, then the row is accepted and the account is created —
    this is accepted, current behavior, not a defect this FR asks to be
    fixed; whether it should change is Q-003a.
- **Related:** G-003, FC-002

## Failure Conditions

### FC-001: File cannot be parsed as CSV or JSON

- **Applies to:** FR-003
- **Condition:** The uploaded file's extension is not `.csv`/`.json`, its
  content is empty, malformed, or structurally invalid for the format its
  extension names, its CSV header doesn't match the fixed column set
  exactly, its row count exceeds the fixed maximum (500), **or (added,
  Delta Review round 1 — previously recorded only as a gap note below, not
  in this Condition) its size exceeds `MAX_IMPORT_FILE_BYTES` (5 MB)**.
- **Expected behavior:** The entire request is refused, no accounts are
  created, and no partial `rows` result is returned. For every case above
  *except* the file-size case, this is confirmed as `400 Bad Request`
  describing the specific parse failure. For the file-size case, see the
  gap noted below — the response shape was not verified.
- **Gap noted (Full Review round 1):** the file-size limit (5 MB,
  `MAX_IMPORT_FILE_BYTES`) is enforced by `FileInterceptor` at a different
  layer than the parser, before the request handler body runs at all —
  its actual status code/message were not directly verified against a live
  request and may not match the parser-level `400` above. See Q-011.

### FC-002: A row fails field validation

- **Applies to:** FR-004
- **Condition:** A row's `email`, `password`, or another validated field
  fails its format, presence, or length rule.
- **Expected behavior:** That row is reported with status `error` and a
  message naming the row and the specific rule violated; the file's other
  rows are still processed (not a whole-file rejection).
- **Related gap (Full Review round 1) — not the same condition, a distinct
  one worth naming separately: a known field with the wrong JSON type is
  not validated as "missing", it is silently coerced to absent.** JSON-row
  extraction (`pickPayload()`, `bulk-user-import.parse.ts:131-153`) only
  accepts a field if it is already the expected JS type (`string`, or
  `object` for `preferences`); a type-mismatched value (e.g.
  `{"password": 123456}`, a number) is treated as if the field were never
  present. For required fields (`email`, `password`) this still surfaces
  as a visible `error` via the "required" check. For **optional** fields
  (e.g. `{"displayName": 12345}`) the value is silently dropped and the
  row still reports `created` with no error — a different, more severe
  failure mode (confident wrong output, not a caught failure) than this
  FC's condition. Tracked as FC-006 rather than folded into this FC's
  expected behavior, since the two require different fixes.

### FC-003: Duplicate email within the same file

- **Applies to:** FR-001
- **Condition:** The same email (case-insensitive) appears more than once
  among the file's rows.
- **Expected behavior:** The first occurrence is processed normally; every
  later occurrence is reported with status `error` (not `skipped`) and a
  message identifying it as an in-file duplicate — distinct in category
  from FC-004's against-DB duplicate, per Current Behavior.

### FC-004: Row duplicates an existing account

- **Applies to:** FR-001
- **Condition:** A row's email, or (if provided) username, already belongs
  to an existing account in the `users` table.
- **Expected behavior:** That row is reported with status `skipped` (not
  `error`) and a message naming the conflict; no account is created or
  modified for that row; the file's other rows are still processed.

### FC-005: In-file duplicate on `username` rather than `email` (added, Full Review round 1)

- **Applies to:** FR-001
- **Condition:** Two rows in the same file have distinct emails but the
  same `username`, exact-match. In-file duplicate detection only keys on
  email (`auth.service.ts:353`), so both rows pass classification; the
  second then fails `createUserWithProfileAsAdmin()`'s username-uniqueness
  check (`users.service.ts:129-134`, an exact-match `findUnique`) against
  the account the first row's own processing just created.
- **Expected behavior:** Currently: reported `skipped` via the same
  `ConflictException` path as FC-004, even though the conflict is entirely
  within this one file, not against a pre-existing account — so this case
  is presently indistinguishable, in the response, from a true
  against-DB duplicate. Whether it should instead be classified as `error`
  (matching FC-003's in-file-collision category) is Q-009.
- **Related case (Delta Review round 1) — a case-differing collision is not
  a collision at all under current behavior.** Because the check is
  exact-match, two rows with `username` values `JohnDoe` and `johndoe`
  collide in *neither* the in-file check above nor the DB check —
  **both accounts are created**, unlike the email dedupe, which is
  explicitly case-insensitive (`auth.service.ts:367`). This asymmetry
  between email and username duplicate handling is current, unconfirmed
  behavior — not evaluated against a live instance — folded into Q-009
  rather than a separate question, since both concern the same
  in-file-username-collision design gap.
- **Cross-reference (Delta Review round 1) — this FC's classification
  question is not this PRD's alone to answer.** `ADR-0020` (Username
  Identity Normalization, Accepted) — a decision this PRD did not
  previously cite — already tracks a closely related question as its own
  open item **OQ-2**: *"What exception type/status does a `citext`-detected
  collision surface as through Prisma … and how should
  `bulkImportUsersFromFile`'s `skipped`-vs-`failed` classification treat
  it?"* `ADR-0020` also names this exact `instanceof ConflictException`
  branch (`auth.service.ts`) as a contract it must not silently break. If
  `ADR-0020` moves usernames to case-insensitive (`citext`) matching, the
  case-differing collision this bullet describes stops being possible —
  it becomes a same-value collision like any other — which would supersede
  part of this FC's Condition. **This FC's "Currently" framing should be
  read as pre-`ADR-0020`-implementation behavior**, not a stable target
  state. See Q-009 for how this PRD tracks the dependency.

### FC-006: A known field is present with the wrong JSON type (added, Full Review round 1)

- **Applies to:** FR-001 (its added acceptance criterion, Delta Review
  round 1) — **corrected from FR-004**: this row passes FR-004's
  validation, so FR-004 is not the requirement it violates; the criterion
  it actually breaks is FR-001's field-fidelity guarantee.
- **Condition:** A JSON row's field has a JS type other than the expected
  one (`string` for most fields, `object` for `preferences`) — e.g.
  `displayName: 12345`.
- **Expected behavior:** Currently: the field is silently treated as absent
  by `pickPayload()`. For optional fields, the row is still created and
  reported `created`, with the mistyped field silently omitted and no
  error surfaced anywhere in the response — violating FR-001's new
  field-fidelity acceptance criterion. This is a confident-but-wrong
  outcome, not a caught failure — the admin has no way to learn it happened
  from the response alone. See Q-003.

### FC-007: A maximum-size import does not complete before the request times out (gap, Full Review round 1)

- **Applies to:** (system-level)
- **Condition:** Rows are created strictly sequentially, each performing a
  `bcrypt.hash()` call (cost factor 10, `auth.service.ts:318`) plus
  **(corrected, Delta Review round 1, then round 2 — first understated as
  "two to three DB round trips", then still undercounted at "three to
  five")** three to six DB statements across three to four calls:
  `findByEmail`; a conditional `findByUsername`; then either a single
  `create` (no profile fields present, `users.service.ts:44-51`) or a
  three-statement `$transaction` when any profile field is present — a
  user insert, a profile insert, and a closing `findUnique` that re-reads
  the just-created row with its profile (`users.service.ts:69-108`,
  specifically the `tx.user.findUnique` at lines 103-106); and finally a
  separate `findByIdWithProfile` call (`auth.service.ts:308-334`) that
  performs the *same read a second time*. Nothing in source parallelizes
  this across rows. A 500-row import — the documented maximum, and the one
  advertised in the endpoint's own Swagger description
  (`auth.controller.ts:170`) — plausibly takes tens of seconds within one
  synchronous HTTP request,
  though this was not measured against a live instance.
- **Expected behavior:** **Not established — this is a gap, not a
  confirmed behavior.** If a client, proxy, or platform-level timeout is
  hit before the response is sent, the admin receives no `rows` body at
  all, while an unknown prefix of the file's rows may already have created
  accounts, with FR-002's "clear account of which rows succeeded" failing
  exactly at maximum scale. See Q-012 — whether a ceiling exists, whether
  it's achievable within `createUserWithProfileAsAdmin()`'s current
  synchronous design (`C-001`), and what the product-level expected
  behavior should be, are open.

## Non Functional Requirements

None could be established with a measurable threshold from source or the
inventory. The 500-row / 5 MB limits are fixed constants observed in Current
Behavior, not stated performance targets with a measurement method, so they
are recorded as Current Behavior/Constraints rather than NFRs — see Q-004
for whether they should become one. Request duration for a maximum-size
import is a related, distinct unknown — see FC-007 and Q-012 — that would
become an NFR if a ceiling is ever specified.

## Business Rules

### BR-001: A bulk-imported account is identical, going forward, to any account created through any other admin-facing path

- **Rule:** An account created via bulk import has no distinguishing flag,
  provenance marker, or distinct lifecycle from an account created via
  `admin/create-user`'s single-create path or standard registration — it
  is a normal `users` row with `role = 'user'` (bulk import does not set
  `role = 'admin'`; only `PRD-AdminUserCreation`'s separate bootstrap path
  does that).
- **Rationale (corrected, Full Review round 1):** `createUserWithProfileAsAdmin()`
  (`auth.service.ts:293-340`) is the *same, already-existing* underlying
  creation call whether it is invoked once (via `POST
  /auth/admin/create-user`, `auth.controller.ts:121-135`) or many times in
  a loop (via bulk import) — not, as an earlier draft of this rationale
  incorrectly stated, a "hypothetical future" reuse; that route exists
  today and is bulk import's actual single-row counterpart. No per-import
  metadata is written anywhere in the call path or schema found.

### BR-002: A file-level parse failure creates zero accounts

- **Rule:** If the uploaded file cannot be parsed into a row list at all,
  the request produces no side effects — no account, partial or otherwise,
  is created from that request.
- **Rationale:** Parsing happens entirely before any row reaches
  `createUserWithProfileAsAdmin()` (`bulk-user-import.parse.ts`, called at
  `auth.service.ts:348` before the row-processing loop at `auth.service.ts:
  394`); a parse failure returns before the loop is ever entered. **Added
  (Delta Review round 2) — this rule's rationale, and FR-003's `Governed
  by` reference to it, originally covered only parser-level rejections.**
  The oversize-file case (FC-001, FR-003's second AC) is rejected even
  earlier than that, by `FileInterceptor` before the request handler body
  runs at all (`auth.controller.ts:156-160`) — so this rule's conclusion
  (no side effects from a whole-file rejection) still holds for that case
  too, by an even shorter path than the one described above.

## Data Requirements

| Entity | Owned by | Retention | Sensitivity |
|---|---|---|---|
| `users` row (role='user', per row) | this feature (creation) / `PRD-AdminRoleGuards`, `PRD-UserProfileSettings` (ongoing) | Same as any user account — no distinct retention rule found | PII (email, name, and optional profile fields) |
| Uploaded file (CSV/JSON, in-memory `Express.Multer.File`) | this feature, transient | Not persisted to disk or DB beyond the request — no storage location found in source | PII while in flight (contains plaintext passwords) |
| Exported import-results artifact (added, Delta Review round 1) — the admin-downloadable JSON produced by `exportSuccessesJson` (`page.tsx:99-111`), whose `sent` field is the client-parsed row **including the row's plaintext `password`** | this feature (frontend), downloaded to the admin's local machine | Uncontrolled once downloaded — outside this system entirely; no retention rule can apply | PII + plaintext credentials for up to 500 accounts, by design (see A-003) — the mechanism A-003's out-of-band credential distribution assumes |

## Integration Requirements

| System | Direction | Purpose | Criticality |
|---|---|---|---|
| `PRD-AdminRoleGuards` (guard stack) | inbound | This route's authorization is `JwtAuthGuard, SessionGuard, AdminGuard`, the same admin-session guard model that PRD documents — and the identical stack `POST /auth/admin/create-user` uses. | blocking — the route is unreachable without a valid admin session. |
| `POST /auth/admin/create-user` (`createUserWithProfileAsAdmin`, shared creation call, independent validation) | inbound | Bulk import reuses that route's underlying account-creation call, but — corrected, Full Review round 1 — validates rows with its own, independently written rule set, not that route's `CreateUserDto` (see Current Behavior, FR-004). This route currently has no PRD of its own (Q-010). | blocking — a change to the shared creation call changes both; the two validation rule sets can drift independently since neither references the other. |
| Frontend `adminUserImport.ts` (client-side mirror) | bidirectional | Duplicates the parser/validator logic for a pre-upload preview; must be kept manually in sync with the backend parser per the backend file's own comment (`bulk-user-import.parse.ts:1`) — no shared package or generated contract enforces this. The two are also joined **by array index** in the results view (`page.tsx:128-135`), not just compared for preview purposes. | **Raised, Full Review round 1 — correctness, not merely degraded UX**: if the two independently maintained parsers ever disagree on row count or ordering for the same file, the index-based join can silently misattribute one row's submitted data to a different row's reported outcome in the admin-facing result and its exported artifact. |

## Constraints

- C-001: Row-level account creation reuses `createUserWithProfileAsAdmin()`
  as-is, strictly sequentially with no parallelism — this feature cannot
  introduce a different account-creation mechanism or a different
  concurrency model without diverging from `admin/create-user`'s
  single-create path (see FC-007, Q-012 for the timing consequence of this
  constraint).
- C-002: The parser and validator exist as two independently maintained
  copies (backend `bulk-user-import.parse.ts`, frontend
  `adminUserImport.ts`), synchronized only by a source comment convention,
  not by a shared module — a pre-existing architectural fact, not a
  decision this PRD makes.

## Assumptions

| ID | Assumption | Impact if wrong | Owner |
|---|---|---|---|
| A-001 | The fixed 500-row / 5 MB limits are adequate for this system's actual training/QA batch sizes | If real batches regularly exceed either limit, admins must split files manually with no in-product guidance that they need to | |
| A-002 | The client's and server's independent parsers agree closely enough in practice on row count and ordering for the same file that the index-based join in the results view (`page.tsx:128-135`) rarely misattributes a row | **Corrected, Full Review round 1 — impact restated from "confusing preview" to a correctness risk:** if the two parsers diverge on a parsing edge case (blank-line handling, delimiter tie-breaking, short-row padding), a row's submitted data can be silently displayed and exported under a different row's reported outcome, with nothing in the response to detect it | |
| A-003 | Credential distribution for bulk-imported accounts (getting each row's plaintext password to the person who will use it) is handled entirely out-of-band by the admin running the import — either the original uploaded CSV, or (confirmed, Delta Review round 1) the product's own exported-results artifact (`exportSuccessesJson`, Data Requirements), which already contains each created row's plaintext password by design — since no welcome email, session, or in-product notification is sent to the created accounts (see Current Behavior, Q-005) | If wrong — e.g. if imported accounts are expected to be usable by their owners without the admin manually distributing credentials — the feature as built provides no path from "account created" to "the intended user can sign in," for up to 500 accounts per request | |

## Open Questions

| ID | Question | Blocks | Owner | Status |
|---|---|---|---|---|
| Q-001 | Should the two duplicate categories (in-file-by-email vs. against-existing-account) be merged into one reported category, or is the current split (`error` vs. `skipped`) intentional and meaningful to admins? **Note (Full Review round 1):** answering this should also account for FC-005's third case (in-file duplicate by username, currently reported as `skipped` alongside true against-DB duplicates) — see Q-009, a related but distinct question. | FC-003, FC-004, FC-005 | | open |
| Q-002 | Should bulk import be atomic (all rows succeed or the whole batch is rolled back) instead of best-effort per-row? The current design is best-effort; changing this would be an architecture decision. | Non Goals, FR-001 | | open |
| Q-003 | **Widened (Full Review round 1) — originally scoped to unknown keys only; a second, more severe case was found.** (a) Is silently dropping *unknown* JSON keys the intended behavior, or should unrecognized fields be flagged? (b) Is silently dropping a *known* field whose JSON value has the wrong type (e.g. `displayName: 12345` — see FC-006) also acceptable, given that case produces a row reported `created` with no error despite data being dropped, which is a more severe outcome than (a)? | FR-001, FC-006 | | open |
| Q-003a | (New, Full Review round 1) Given FR-004/Current Behavior confirm bulk import's row validation is not the same rule set `admin/create-user` applies (no email-length cap, looser email regex, non-ISO birthday strings accepted), should the two be unified, or is bulk import's looser validation an accepted, intentional difference? **Note (Delta Review round 1):** this question's premise — that `admin/create-user` is bulk import's session-gated counterpart — depends on `PRD-AdminRoleGuards` Q-008 resolving toward the code (session-gated) rather than toward `CLAUDE.md`'s conflicting documentation (API-key-gated) for that route; see Q-010. | G-003, FR-004, `PRD-AdminRoleGuards` Q-008 | | open |
| Q-004 | Should the 500-row / 5 MB limits be configurable per environment, or raised/lowered, rather than fixed constants? | A-001, Non Goals | | open |
| Q-005 | Should a welcome email (or any admin-import-specific notification) be sent for bulk-imported accounts, matching the same open question `PRD-AdminUserCreation` Q-004 raises for its single-create path? Related to A-003's out-of-band-credential-distribution assumption. | (behavioral gap, not yet an FR), A-003 | | open |
| Q-006 | What is the typical/expected batch size and import frequency this feature is meant to serve (training cohort setup, QA test-data seeding, other)? No usage evidence or operator report was found to answer this from source. | Success Metrics, A-001, Q-004 | | open |
| Q-007 | Should the stale source comment in `frontend/lib/adminUserImport.ts:3` (naming the wrong endpoint) be corrected as a documentation fix? Recorded as an implementation-accuracy note, not a product requirement of this PRD. | (documentation only) | | open |
| Q-008 | Should the client-side pre-upload preview and the server's post-upload result be reconciled with an explicit row key or index returned by the server (rather than positionally joined by array order, as today, per Current Behavior/Integration Requirements), so a client/server parsing divergence cannot silently misattribute a row's data to the wrong outcome? | US-002, A-002 | | open |
| Q-009 | (New, Full Review round 1) FC-005: an in-file duplicate on `username` (distinct emails, same username) is currently reported `skipped` — the same status as a true against-DB duplicate — rather than `error` like FC-003's in-file email duplicate. Should it be reclassified to `error` for consistency with FC-003, or is `skipped` acceptable since the row genuinely does collide with an account that (by then) exists in the DB, even though that account was itself just created by this same request? **Cross-reference (Delta Review round 1) — not solely this PRD's question to answer:** `ADR-0020` (Username Identity Normalization, **Accepted**) already tracks a closely related, unresolved question as its own **OQ-2** — what exception type/status a `citext`-detected username collision surfaces as, and how `bulkImportUsersFromFile`'s `skipped`-vs-`failed` classification should treat it — and explicitly names this same `ConflictException` branch as a contract it must not silently break. This question should be answered jointly with, or deferred to, `ADR-0020` OQ-2 rather than settled independently here; if `ADR-0020`'s case-insensitive (`citext`) matching lands, the case-differing-collision variant this FC records stops being possible, which would supersede part of FC-005's Condition. | FC-005, Q-001, `ADR-0020` OQ-2 | | open (tracked jointly with `ADR-0020` OQ-2) |
| Q-010 | (New, Full Review round 1) `POST /auth/admin/create-user` — bulk import's actual single-row counterpart, sharing its guard stack and creation call — currently has no PRD of its own anywhere in this documentation set. Should one be added to the backlog, and should Q-003a's validation-unification question be answered there instead of (or in addition to) here? **Note (Delta Review round 1):** this route's guard model is stated here as settled fact (session-gated, per source), but `PRD-AdminRoleGuards` Q-008 has that exact route's gating open as an unresolved contradiction against `CLAUDE.md` (which documents it as `ADMIN_API_KEY`-gated). Any future PRD for this route — and Q-003a's premise here — should resolve against Q-008's outcome, not treat the session-gated reading as final. | Overview, Non Goals, Integration Requirements, Q-003a, `PRD-AdminRoleGuards` Q-008 | | open |
| Q-011 | (New, Full Review round 1) The file-size limit (5 MB) is enforced by `FileInterceptor` before the parser runs, at a different layer than every other whole-file rejection in FC-001/FR-003. Its actual response status/message were not verified against a live request — and the browser UI already blocks over-size files client-side (`page.tsx:181-184`), so this server-side path is reachable only via a direct API call, which is exactly the surface a QA-training product cares most about testing. Should FC-001/FR-003's expected behavior be updated once verified, in case it does not return the same `400 Bad Request` shape the parser-level rejections do? | FC-001, FR-003 | | open |
| Q-012 | (New, Full Review round 1) FC-007: rows are created strictly sequentially, each performing three to six DB statements across three to four calls (`corrected, Delta Review round 1, then round 2` — `findByEmail`, a conditional `findByUsername`, then either a single `create` or a three-statement `$transaction` when profile fields are present, and a final `findByIdWithProfile` that duplicates the transaction's own closing read; `auth.service.ts:308-334`, `users.service.ts:44-108`), with no measured ceiling on how long a maximum-size (500-row) import takes inside one HTTP request. Has a full 500-row import ever been run and timed in this environment? Is there an acceptable maximum request duration, and if the synchronous design (C-001) cannot meet it, should this become an architecture-discovery question about async/background processing instead of a same-request response? **Note (Delta Review round 1):** no automated test infrastructure currently exists in this repo to produce this measurement (see `docs/architecture/findings/ARCHITECTURE-REVIEW-FINDINGS.md`); manual measurement against a live instance, or escalating this unmeasured to Architecture Toolkit, are the two paths available. **Note (Delta Review round 2):** if this is ever measured, the duplicated read (transaction's closing `findUnique` immediately followed by a separate `findByIdWithProfile`) is the cheapest first thing to eliminate before considering an architectural change. | FC-007, Non Functional Requirements | | open |
| Q-013 | (New, Delta Review round 1; scope corrected Delta Review round 2) `FEATURES_INVENTORY.md:157-171`'s entry for this feature has four inaccuracies against source, beyond the previously-noted method-name mismatch: it lists `firstName, lastName` as accepted columns (not the actual `IMPORT_CSV_HEADERS` set), describes creation as a "Batch insert" (it is a sequential per-row loop), describes the response as a "List of created users" (it is `{created, failed, skipped, rows}` with every row's outcome), and repeats the disproven "Same rules as single user create" claim FR-004 corrects. **Corrected scope:** the endpoint's `@ApiBody` Swagger line (`auth.controller.ts:170`) is a column-name claim, not a validation-parity claim, and is accurate — no fix needed there. Its `@ApiOperation` line (`auth.controller.ts:178`, "Rows are validated like the import template") is merely vague, not wrong — it does not state that bulk import's validation differs from `create-user`'s. Should the four inventory lines be corrected to match this PRD's Current Behavior, and should the `@ApiOperation` description be sharpened to name that divergence explicitly, so a future discovery pass does not re-derive the disproven premise from either source? | FEATURES_INVENTORY.md, `openapi.json` | | open |
| Q-014 | (New, Delta Review round 1; corrected Delta Review round 2) The exported import-results artifact (`exportSuccessesJson`, `page.tsx:99-111`, Data Requirements) serializes each created row's plaintext password **unconditionally** — the page's `showPasswords` toggle (`page.tsx:69`) only masks the on-screen results table (`page.tsx:599`) and does not gate the export in any way, so a reader should not assume the toggle is a control over the export's exposure. Is including plaintext passwords in a downloadable, uncontrolled-retention artifact an intentional, accepted design for this QA-training context (per A-003), or should the export omit passwords (independent of the on-screen toggle) and rely on the admin's original source file for credential distribution instead? | Data Requirements, A-003 | | open |

## Success Metrics

| Metric | Baseline | Target | Source |
|---|---|---|---|
| (unknown) | (unknown) | (unknown) | No usage/observability data found for this route — no audit logging or metrics call found in `bulkImportUsersFromFile()`, so no metric can currently be sourced. See Q-006. |

## Architecture Impact

- Requirements likely to drive decisions: FR-001/FR-002 (best-effort
  per-row processing vs. an atomic-batch alternative, per Q-002); FR-003
  (fixed file/row limits, per Q-004); FC-007 (whether a synchronous,
  strictly-sequential per-row loop can meet an acceptable request duration
  at the documented 500-row maximum, per Q-012 — this may require an
  async/background-processing redesign, which is squarely an architecture
  decision, not a product one)
- Suspected new components or boundaries: None currently — reuses
  `createUserWithProfileAsAdmin()`, `AdminGuard`/`SessionGuard`/
  `JwtAuthGuard`, and the existing `users` table, all pre-existing. If
  Q-012 concludes the synchronous design cannot meet an acceptable request
  duration, a background-job/polling boundary would be a new component —
  not decided here.
- Known architectural risk: two distinct risks, not one.
  1. **(Corrected, Full Review round 1 — upgraded from a UX risk to a
     correctness risk.)** The backend parser/validator
     (`bulk-user-import.parse.ts`) and the frontend's independent
     reimplementation (`adminUserImport.ts`) are two hand-synchronized
     copies of the same rules with no shared source of truth, and the
     frontend additionally joins server results to its own parsed rows **by
     array index** (`page.tsx:128-135`) rather than a server-returned key.
     A change to one parser without the matching change to the other can
     silently misattribute a row's submitted data to a different row's
     reported outcome in the admin-facing result and its exported artifact
     — not merely a "confusing preview," since the server remains
     authoritative for *which accounts get created*, but the *displayed and
     exported record of which row produced which outcome* can be wrong.
     Whether to consolidate into one shared module, or have the server
     return an explicit row key, is an architecture-discovery question
     (see Q-008).
  2. **(New, Full Review round 1.)** Strictly sequential, synchronous
     per-row processing (`C-001`) with no measured ceiling on maximum-size
     (500-row) request duration — see FC-007, Q-012. Whether this requires
     an architectural change (batching, async processing, background jobs)
     or is acceptable as-is for this system's actual usage pattern depends
     on Q-006's unanswered batch-size/frequency question and on an actual
     timing measurement neither of which this PRD could establish from
     source alone.
