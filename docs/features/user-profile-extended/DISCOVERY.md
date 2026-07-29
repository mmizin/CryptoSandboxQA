# Architecture Discovery — User Profile Extended (Registration with Profile)

**Feature:** Backlog #10, `POST /auth/register-with-profile`
**Slug:** PRD-UserProfileExtended
**Date:** 2026-07-29
**Trigger:** Product Reviewer Full Review 1 findings D1–D3 (reachability
claim, `ADR-0008`/`ADR-0013`/`ADR-0020` cross-references) required
verification against the live repository before the PRD could be revised.

## Method

Evidence gathered by direct repository inspection: `grep`/`find` across
`frontend/`, `backend/src/`, `tests/` (does not exist — see below),
`openapi.json`, `ARCHITECTURE.md`, and full reads of `ADR-0008`, `ADR-0013`,
`ADR-0020`, and the two sibling PRDs (`PRD-Registration`,
`PRD-UserProfileSettings`). No product requirements were invented from this
inspection — only used to confirm or correct claims already made in the PRD
draft, per the plan's "implementation consulted only to verify/resolve
ambiguity" rule.

## Finding 1 — Reachability: confirmed unreachable by any current caller

- **Frontend:** `grep -rn "register-with-profile\|registerWithProfile"
  frontend/` returns zero matches. `frontend/lib/api.ts` exposes only
  `authApi.register` → `POST /auth/register`. No UI route, form, or client
  call reaches this endpoint.
- **Tests:** `ARCHITECTURE.md` (as currently committed) documents a
  `tests/backend_tests/` Python API test suite whose `AuthClient` calls
  `POST /auth/register-with-profile` as an unauthenticated bootstrap
  helper, and a `tests/ui-tests/` Playwright suite. **Neither directory
  exists in this repository.** `git log --oneline --all -- tests/` shows
  the most recent commit touching that path is `003842a — "chore: Remove
  all testing infrastructure and documentation"`, which deleted the entire
  `tests/` tree; all prior commits are pre-removal test-infrastructure
  history. `ARCHITECTURE.md`'s description of `tests/backend_tests/` was
  not updated after that removal — it documents infrastructure that no
  longer exists on disk.
- **Backend:** the route is defined and reachable directly
  (`backend/src/auth/auth.controller.ts:190`, `@Post('register-with-profile')`)
  and documented in `openapi.json` (line 970) — it is live and callable via
  Swagger or a raw HTTP client, just not from any caller currently checked
  into the repository.

**Conclusion:** the endpoint is confirmed reachable only by direct API
call (Swagger, curl, or a script) — not by the frontend (never had a
caller) and not by the test suite (had one, now removed along with all
other test infrastructure). This resolves Product Reviewer finding D1's
central question: it is not a design gap the PRD failed to notice: no
caller exists today, full stop, and no evidence found (commit history,
docs, code comments) states an intention to build a frontend caller. There
is no evidence of deliberate "QA-training API-only surface" framing either
— the removed test suite's use of it appears to have been the only actual
consumer, and that consumer no longer exists.

## Finding 2 — ADR-0008: applies directly, decision not yet implemented

`ADR-0008` (Accepted) explicitly names this endpoint's both pre-checks:

- Email pre-check (`auth.service.ts:260-262`, verified): throws
  `UnauthorizedException('Email already registered')` — ADR-0008 requires
  this become `ConflictException` with the same message, unified with the
  five other write paths' behavior on the same condition.
- Username pre-check (`auth.service.ts:264-269`, verified — ADR-0008 cites
  this exact line as `auth.service.ts:267`): throws
  `UnauthorizedException('Username already taken')` — ADR-0008 requires
  this become `ConflictException` with the same message.

**Verified against current code:** both pre-checks still throw
`UnauthorizedException` (401) as of this pass — the ADR's decision has not
yet been implemented against this endpoint. `createUserWithProfileAsAdmin()`
(`auth.service.ts:293-320`), a sibling method, already throws
`ConflictException` for the identical conditions — confirming the two
sibling methods currently disagree with each other on the same logical
condition, exactly as ADR-0008 describes.

## Finding 3 — ADR-0020: governs this endpoint's `username` write, not yet cited

`ADR-0020` (Accepted, 2026-07-29, Revision 5 — same day as this PRD's prior
draft) names `UsersService.createWithProfile() — line 90` as one of
exactly four `username` write sites in the codebase, and states
`createWithProfile()` "is called in-process by
`AuthService.registerWithProfile()`" — this feature's own service method.

**Correction (this document previously misstated the Decision as
"lowercase + trim at write time"):** the Accepted decision (Option A +
Option D, combined) is **`citext`** for the `username` column
(construction-enforced, database-level case-insensitive uniqueness —
`citext` preserves the originally-submitted casing on read, it does *not*
lowercase), **plus** application-level trim in `UsersService`, with
empty-after-trim converting to `NULL`. Lowercase-at-write-time was
Revision 1's original proposal and is explicitly superseded — the ADR's
own "This decision does not specify" section states this directly:
"Display casing: `citext` preserves the originally-submitted casing in
storage and on read (unlike lowercasing at write time, which Revision 1
proposed)." This write path is governed by the trim/empty-to-`NULL` half
identically to the other three sites, and by the `citext` column change,
which is a schema-level decision applying to the column, not per-write-site
logic.

**Also relevant:** `ADR-0020` OQ-5 leaves open whether `findByUsername()`'s
exact-string pre-check still catches case variants once the column is
`citext` (dependent on unverified Prisma parameter-binding/cast behavior),
and the ADR names a hard sequencing dependency — `ADR-0008`'s `P2002`
catch must ship before the `citext` constraint is applied, or several
currently-silent collision paths would instead surface as unhandled `500`s.
Both are relevant to how this endpoint's own FC-003 target behavior should
be described — see the revised PRD.

**Also relevant and previously uncited:** `ADR-0020`'s Context section
notes a **50-character limit exists on `RegisterWithProfileDto`**
(`backend/src/auth/dto/register-with-profile.dto.ts:31-35`, verified) for
`username` — the *only* one of the four write surfaces that enforces any
length limit on this field (`UpdateProfileDto`, `AdminPatchUserDto`,
`AdminReplaceUserDto` enforce none). `ADR-0020`'s own OQ-3 asks which PRD
should own the `username` length/charset question and states it is
"Open — PRD-level, not this ADR's to resolve." Since this feature's DTO is
the only one of the four with an enforced limit today, this document is a
plausible owner for that question, alongside `PRD-UserProfileSettings`
Q-006a.

**Verified atomicity (relevant to BR-001/FR-002):**
`UsersService.createWithProfile()` (`users.service.ts:54-105`) gates row
creation on `hasProfileData` — `Object.values(profileData).some((v) => v
!== undefined && v !== null && v !== '')` — **not trimmed**, and structural
values (e.g. `{}` for `preferences`) are never `''`. So a request with
only `{ preferences: {} }` or `{ username: "   " }` passes the gate today
and creates a `UserProfile` row holding no data the visitor meaningfully
supplied, plus hardcoded defaults (`languageCode: 'en'`, `timezone: 'UTC'`,
`preferences: {}`). When the row is created, both the `User` insert and the
`UserProfile` insert happen inside one `prisma.$transaction` — genuinely
atomic, confirming FR-001/FR-002's implicit atomicity assumption is correct
today (not previously stated as a Constraint or acceptance criterion).

## Finding 4 — ADR-0013: plausibly covered by the global default (inference), not individually named, and not yet implemented

`ADR-0013` (Accepted) registers a global IP-keyed `ThrottlerModule` default
that "applies to every route in the system." It explicitly itemizes four
named routes receiving this global default (`login`, `forgot-password`,
`2fa/verify`, `register`) as "a concrete starting checklist," not an
exhaustive list — the ADR states "a full audit of every route is out of
this ADR's scope." `register-with-profile` is not named individually
anywhere in the ADR. Given the mechanism is a global default rather than a
route-scoped guard, and the ADR's own framing treats its checklist as
illustrative rather than exhaustive, the global default plausibly covers
this endpoint too — but this is an inference from the mechanism's stated
scope, not a citation naming this endpoint, and should be presented as
such rather than as confirmed fact.

**Also relevant, and previously omitted:** `ADR-0013` is Accepted but
**not yet implemented anywhere in this backend** — its own Context states
no rate limiting, throttling, or lockout mechanism exists in the codebase
today, and a repository-wide search for `Throttl` under `backend/` returns
no matches. This is the same "Accepted, not yet shipped" status as
`ADR-0008` and `ADR-0020`, and should be stated with the same explicitness
— treating it as more settled than the other two ADRs (because a mechanism
is designed) would be a confidence-inflation error, not a stronger claim.

## Finding 5 — Should a `DISCOVERY.md` exist for this feature?

Yes — this document is it, produced retroactively after the PRD's first
review round rather than before, unlike every sibling feature in the
backlog (all of which produced Discovery before or alongside their first
PRD draft). The absence of an upfront Discovery pass is the most direct
explanation for Product Reviewer findings D1–D3: the frontend-caller
search, the `tests/` removal check, and the `ADR-0008`/`ADR-0013`/`ADR-0020`
cross-references are exactly the kind of verification a Discovery pass
performs before the PRD is drafted, not after.

## Candidate architectural decisions

None identified as new — all three ADR cross-references above concern
decisions already Accepted elsewhere (`ADR-0008`, `ADR-0020`) or an
inference from an existing global mechanism (`ADR-0013`), not a fresh
decision point this feature introduces. No new `adr-expert` invocation is
indicated by this discovery pass.

## Outcome

Findings 1–4 resolve Product Reviewer D1 (reachability — confirmed, not a
product decision), D2 (FC-003/Q-002/Q-005 — ADR citations now available to
close or narrow them), and part of D3 (ADR-0020 now available to fix
BR-001/FR-002). The remaining product-level judgment calls (e.g. whether
`register-with-profile` should be retired, kept as an API-only surface, or
given a frontend caller; whether BR-001's normalization point should count
`ADR-0020`'s post-trim value) are recorded as Open Questions in the
revised PRD, not resolved here.
