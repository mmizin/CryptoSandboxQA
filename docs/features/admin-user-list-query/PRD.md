# Admin User List & Query

| Field | Value |
|---|---|
| Status | Approved |
| Mode | Existing Feature |
| Discovery | Confirmed |
| Confidence | Medium |
| Owner | |
| Last updated | 2026-08-03 |
| Slug | PRD-AdminUserList |

<!-- Slug reconciled from PRD-AdminUserListQuery to PRD-AdminUserList (Full
     Review 1, F5) to match the reference already made by
     docs/features/impersonation/PRD.md, which names this feature
     "PRD-AdminUserList (backlog #13, not yet produced)". -->

## Overview

Admin User List & Query lets an administrator list and search registered
user accounts by a search term. It is the read surface an admin uses to
find a specific account before acting on it — today, this is exactly the
account picker `PRD-Impersonation`'s `/admin/impersonate` page already
consumes (see Integration Requirements).

## Current Behavior

**Correction to the inventory entry** (`FEATURES_INVENTORY.md:600-611`):
after a first draft of this PRD was reverse-engineered from that entry
alone and failed a Full Review that read the actual code, the entry was
found to materially misdescribe the shipped endpoint — no pagination
parameters exist, the response is a bare array rather than
`{ data, total, meta }`, and only 4 of the 7 fields it lists are returned.
This section is re-derived directly from source, the same correction
pattern `docs/features/impersonation/PRD.md:178-183` already applied to a
different inventory divergence in a sibling feature.

- **Endpoint:** `GET /users?search=<term>`, admin-only.
  `UsersController.list()` (`backend/src/users/users.controller.ts:41-47`)
  accepts exactly one optional query parameter, `search`; there is no
  `limit` or `offset`. This route is one of the 13 `AdminGuard`-gated sites
  already enumerated in `PRD-AdminRoleGuards`'s Current Behavior
  (`users.controller.ts` — list) — see that PRD for the guard/auth model;
  not re-derived here.
- **Backing service:** `UsersService.findAll(search?)`
  (`backend/src/users/users.service.ts:136-157`).
- **Search matching:** when `search` is provided, the term is matched
  case-insensitively against `email` (`contains`), and additionally against
  `id` by exact match if the term is UUID-shaped
  (`users.service.ts:139-146`). No other field (`username`, `firstName`,
  `lastName`, `displayName`) is matched. When `search` is omitted, empty, or
  whitespace-only (`users.service.ts:139` trims the term before checking),
  every user matches (no filter applied) — this unfiltered path is exactly
  what the confirmed consumer calls on page mount, before any term is
  typed (`impersonate/page.tsx:33-37`).
- **Response shape:** a bare array of matching users — `User[]`, not an
  envelope with `total`/`meta`.
- **Fields returned per user:** `id`, `email`, `displayName`, `role`
  (`users.service.ts:137,152`). `username`, `firstName`, `lastName`, and
  `createdAt` are not returned by this endpoint. Passwords are never
  included.
- **Result cap and order:** hard-capped at 100 rows (`take: 100`), sorted
  `email` ascending (`users.service.ts:153-154`) — a stable order, since
  `email` is unique. There is no `limit`/`offset` pagination past this
  fixed cap: a 101st matching account is simply not returned, with no
  signal in the response that truncation occurred.
- **Confirmed consumer:** `/admin/impersonate`
  (`frontend/app/admin/impersonate/page.tsx:33-37`) calls this endpoint via
  `usersApi.list(search)` (`frontend/lib/api.ts:175-178`) and consumes the
  flat-array, 4-field shape directly — `docs/features/impersonation/PRD.md`
  names this feature as the owner of that call's behavior.

## Problem Statement

An administrator needs to find one specific user account — to act on it via
another admin feature, or to enter impersonation for it — among the set of
registered accounts, without knowing that account's exact ID in advance.
`docs/features/impersonation/PRD.md` confirms this is a real, already-
consumed need: its account picker calls this feature's search capability as
its own entry point.

## Goals

- G-001: An administrator can find a specific registered user account, by
  searching or by an unfiltered listing (the default, no-term state), with
  enough identifying information (`id`, `email`, `displayName`, `role`)
  returned to confirm it is the right account before taking a subsequent
  action.
- G-002: The list/search results never expose password data.

## Non Goals

- Pagination beyond the fixed 100-row cap — no `limit`/`offset` mechanism
  exists; see Q-002 for whether this is a deliberate ceiling or an
  unaddressed gap.
- Searching by `username`, `firstName`, or `lastName` — confirmed not
  implemented (Current Behavior); see Q-001 for whether this is intended
  scope.
- Sorting by any field other than `email` ascending — the only order the
  backend applies.
- Editing, deleting, or otherwise mutating a user account from this
  endpoint — this is a read-only search surface.
- Returning any account data beyond `id`, `email`, `displayName`, `role`
  (e.g. balances, orders, deposits, `username`, name fields, `createdAt`)
  — those are either separate admin inspection surfaces (backlog #46) or
  simply not part of this endpoint's projection today.

## Users / Actors

| Actor | Type | Description |
|---|---|---|
| Administrator | Human | An account with `role: 'admin'`, the only actor able to call this route — see `PRD-AdminRoleGuards` |
| UsersService | System | Backing service (`findAll()`) that queries and searches the user list |

## User Stories

- US-001: As an administrator, I want to search for a user by email or ID,
  so that I can find a specific account without knowing its exact
  identifier in advance — this is the entry point `PRD-Impersonation`'s
  account picker already relies on.
- US-002: As an administrator, I want to see an unfiltered listing of
  registered accounts when I haven't typed a search term, so that I have
  something to browse before narrowing down — this is the confirmed
  consumer's default, on-page-load state.
- US-003: As an administrator, I want the list/search response to never
  include password data, so that sensitive credentials are never exposed
  even to a trusted operator role.

<!-- This PRD has never left Draft and no external artifact cites its
     requirement IDs by number (only its slug, PRD-AdminUserList, is
     referenced elsewhere — see docs/features/impersonation/PRD.md:186,
     225, 537, 573). R-001/R-011's ID-stability guarantees protect IDs once
     cited externally; renumbering within an unreleased Draft, as this
     revision does, does not violate them. This note replaces an earlier,
     narrower comment that cited only R-011 (which scopes itself to FR,
     NFR, BR, FC — not US) as justification; R-001's broader "never reused"
     text is the actually-relevant rule, and the reasoning above is why
     reuse here causes no harm, not an argument that R-001 doesn't apply. -->

## Functional Requirements

### FR-001: List or search registered users

- **Description:** The system must let an authenticated administrator
  either (a) retrieve an unfiltered listing of registered user accounts, or
  (b) search them by a term matched case-insensitively against `email`
  (partial match), and additionally against `id` (exact match) when the
  term is UUID-shaped. No term given (including an empty or whitespace-only
  term) is the unfiltered case, not an error.
- **Actor:** Administrator
- **Priority:** Must
- **Acceptance Criteria:**
  - Given an authenticated administrator, when they request this route with
    no `search` term (omitted, empty, or whitespace-only), then the
    response contains every registered account, subject to FR-002's cap.
  - Given an authenticated administrator, when they submit a `search` term
    matching part of a registered account's email, then that account is
    included in the response.
  - Given a `search` term that is a registered account's exact `id`, then
    that account is included in the response even if it does not match on
    `email`.
  - Given a `search` term matching only a `username`, `firstName`, or
    `lastName` value, then no account is returned for that reason — this is
    current behavior, not a defect; see Non Goals and Q-001 for whether it
    should change.
  - Given a non-admin account, when it requests this route, then the
    request is denied per `PRD-AdminRoleGuards` FR-001.
- **Governed by:** BR-001
- **Related:** US-001, US-002, G-001
- **Failure analysis:** See FC-001, FC-002, FC-005.

### FR-002: Cap results at 100 rows, sorted by email

- **Description:** The system must return at most 100 matching accounts per
  request, ordered by `email` ascending.
- **Actor:** UsersService
- **Priority:** Must
- **Acceptance Criteria:**
  - Given a search matching more than 100 accounts, when the response is
    returned, then it contains exactly 100 records, the 100
    lexicographically-first by `email`.
  - Given two searches returning results, when their orderings are
    compared, then both are sorted by `email` ascending.
- **Related:** G-001
- **Failure analysis:** See FC-003.

### FR-003: Never include credential data in results

- **Description:** The system must exclude password hashes and other
  credential material (e.g. 2FA secrets, reset tokens) from every user
  record returned by this endpoint. This is the security invariant BR-002
  states; it does not by itself fix the rest of the response's shape — see
  C-001 for today's exact projection, which FR-003 does not freeze.
- **Actor:** UsersService
- **Priority:** Must
- **Acceptance Criteria:**
  - Given any response from this endpoint, when the returned record's field
    set is compared against C-001's documented projection (`id`, `email`,
    `displayName`, `role`), then every returned field is a member of that
    set — a field outside it is not permitted by this requirement until it
    has been explicitly checked against BR-002 and, if it passes,
    documented as an addition to C-001's projection.
- **Governed by:** BR-002
- **Related:** US-003, G-002
- **Failure analysis:** See FC-004.

<!-- NF-2 fix (Delta Review 1): the prior AC used "credential-adjacent
     field," an undefined, non-decidable term. Anchoring to C-001's
     concrete field set keeps the check mechanical while preserving F4's
     split — this AC does not forbid growing the projection, it forbids
     growing it silently, which is the actual invariant BR-002 protects. -->

<!-- Split from a single fused FR (Full Review 3, F4): the earlier draft's
     sole acceptance criterion was an allow-list against the exact
     four-field projection, which meant any projection change — including
     benign ones like widening search to return a matched `username` — read
     as violating a security requirement. FR-003 now owns only the
     credential-exclusion invariant; C-001 owns the projection-freeze
     concern (a consumer-compatibility constraint, not a security one),
     and FC-004 attaches to C-001 rather than FR-003. -->

## Failure Conditions

### FC-001: Search term matches no account, and is indistinguishable from other empty-result causes

- **Applies to:** FR-001
- **Condition:** The `search` term does not match any account's `email`
  (partial) or `id` (exact) — including the case where the term would have
  matched a `username`, `firstName`, or `lastName` value that this endpoint
  does not search (Non Goals).
- **Expected behavior:** An empty result array — a well-formed, coherent
  200 that a response body alone cannot distinguish from **two other
  states**: (1) the account exists but was searched by an unsearched field
  (the case this FC originally covered), and (2) the request itself failed
  and the confirmed consumer degraded the failure to an empty list — see
  FC-005, which is the more severe of the two additional cases since it
  isn't even a correct empty result. No signal in the response distinguishes
  any of the three. This is a confident-failure mode of the primary goal
  (an admin may conclude a registered account doesn't exist when it does),
  not currently flagged anywhere in the product. See Q-001, Q-003.

### FC-002: Non-admin or unauthenticated request

- **Applies to:** FR-001
- **Condition:** A request arrives without a valid admin session.
- **Expected behavior:** Denied per `PRD-AdminRoleGuards` FR-001 (403) —
  this feature does not define its own denial behavior, it inherits the
  shared guard's.

### FC-003: More than 100 accounts match a search

- **Applies to:** FR-002
- **Condition:** A search (including an empty/unfiltered search) matches
  more than 100 accounts.
- **Expected behavior:** The 100 lexicographically-first-by-`email` matches
  are returned, with **no indication in the response that truncation
  occurred** — no `total`, no `hasMore` flag. An administrator searching a
  common term (or browsing with no term) cannot tell, from the response
  alone, whether they are seeing every match or the first 100 of more. See
  Q-002.

### FC-004: A field outside the documented projection appears in a response

- **Applies to:** FR-003 (if the added field is credential-adjacent — a
  direct BR-002 violation), C-001 (for any other undocumented field, a
  consumer-compatibility break rather than a security one)
- **Condition:** A future change to `UsersService.findAll()` adds a field to
  the returned projection beyond `id`, `email`, `displayName`, `role`,
  without updating this feature's contract.
- **Expected behavior:** Not currently defined by the product — no
  automated check enforcing either FR-003's credential exclusion or C-001's
  documented projection was found. See Q-004.

### FC-005: The search/list request itself fails

- **Applies to:** FR-001
- **Condition:** The endpoint is unreachable, errors, or times out.
- **Expected behavior:** Not currently defined by this feature — the one
  confirmed consumer's own error handling degrades any request failure to
  an empty result list (`impersonate/page.tsx:36`,
  `.catch(() => setUsers([]))`), which is indistinguishable from a correct
  "no matches" response (FC-001) or from an unsearched-field miss. Whether
  request failures should be surfaced distinctly is owned jointly with
  `PRD-Impersonation` for that specific consumer — see Q-006.

## Non Functional Requirements

No measurable NFR (search response time under a given user count, an
availability target) was found or stated anywhere in the system for this
feature specifically. This is a genuine gap, not just an unasked question:
the one confirmed consumer fires a request on every keystroke, with no
debounce and no request cancellation (`impersonate/page.tsx:26-38`, `search`
in the `useEffect` dependency array) — a latency ceiling for this endpoint
would matter in a way it might not for a lower-frequency admin route, and
out-of-order responses to a fast typist risk rendering results for a stale
term. See Q-007.

## Business Rules

### BR-001: The user search is admin-only

- **Rule:** Only an account with `role: 'admin'` may search the list of
  registered users.
- **Rationale:** This is `PRD-AdminRoleGuards` BR-001 applied to this
  specific route; restated here as `Governed by` per contract, not
  re-derived — see that PRD for the full authorization model.

### BR-002: User-facing search results never include credential data

- **Rule:** No endpoint that returns user records may include password
  hashes or other credential material.
- **Rationale:** Would hold regardless of this specific feature — a
  system-wide data-exposure invariant this endpoint must not violate.

## Data Requirements

| Entity | Owned by | Retention | Sensitivity |
|---|---|---|---|
| User (subset: `id`, `email`, `displayName`, `role`) | external — the `User` entity is owned by `PRD-Registration`/`PRD-Login`; this feature only reads and searches it | Indefinite while the account exists | PII (email) — capped at 100 rows per request; whether cross-request auditing exists is unverified, see Q-005 |

## Integration Requirements

| System | Direction | Purpose | Criticality |
|---|---|---|---|
| Admin Role & Guards (`PRD-AdminRoleGuards`) | inbound | Gates this route to admin-only access | blocking |
| Registration (`PRD-Registration`) | inbound | Source of the `User` records this feature searches | blocking |
| Impersonation (`PRD-Impersonation`) | outbound | `/admin/impersonate`'s account picker calls this feature (`usersApi.list(search)`) as its entry point and consumes the exact 4-field flat-array shape C-001 documents — a breaking change to this shape breaks that picker. That picker's own error handling also degrades any request failure from this endpoint to an empty result (FC-005) — a joint concern, see Q-006. | blocking |

## Constraints

- C-001: The response shape (bare `User[]` array) and the four returned
  fields (`id`, `email`, `displayName`, `role`) are what the shipped
  endpoint returns today, confirmed against source, and are consumed
  as-is by `PRD-Impersonation`'s account picker (blocking integration
  above). This PRD documents that shape; it does not propose changing it.
  Any future change to this shape is a breaking change to that consumer
  and needs to be recognized as such, not made incidentally.

## Assumptions

| ID | Assumption | Impact if wrong | Owner |
|---|---|---|---|
| A-001 | `backend/src/users/users.service.ts:136-157` and `users.controller.ts:41-47`, read on 2026-08-03, reflect the currently deployed behavior of this endpoint | If wrong (a subsequent code change altered search matching, the cap, or the projection without this PRD being updated), Current Behavior, FR-001–FR-003, and C-001 would all need re-verification against source before being trusted | |
| A-002 | This training sandbox's account population stays below the 100-row cap (FC-003) during normal use — **at risk, not confirmed**: `PRD-BulkUserImport` (`docs/features/bulk-user-import/PRD.md:25`) ships a single-request import of up to 500 users, explicitly for "seeding a training cohort, restoring a set of QA test users, provisioning a batch" (`:263`) — a routine use of this sandbox that alone exceeds the cap 5×. This assumption should not be treated as a safe default. | If wrong (increasingly likely given `PRD-BulkUserImport`), FR-002/FC-003 silently truncate both the unfiltered listing (US-002) and any broad search to the lexicographic-first 100 by `email`, with no signal to the admin — accounts created by a bulk import late in alphabetical order become invisible. G-001 fails without anyone noticing, and Q-002 should be treated as **blocking**, not merely open, until resolved. | |
| A-003 | The four returned fields (`id`, `email`, `displayName`, `role`) are sufficient for an administrator to visually confirm they've selected the right account before acting on it — despite `displayName` being nullable (`schema.prisma:18`) and rendered as `—` when absent (`impersonate/page.tsx:135`) | If wrong, G-001's "enough identifying information to confirm the right account" is not actually met for accounts with no `displayName`, and this feature would need a fallback identifying field (e.g. `username`, tying into Q-001) | |

## Open Questions

| ID | Question | Blocks | Owner | Status |
|---|---|---|---|---|
| Q-001 | Should search also match `username`, `firstName`, or `lastName` (as G-001's original framing and the inventory's "list and search" description might suggest), or is email/ID-only search the intended, final scope? Closing this toward "yes" would also resolve FC-001's ambiguous-empty-result gap for those fields. | FR-001, Non Goals | | open |
| Q-002 | Is the fixed 100-row cap (FC-003) an intentional ceiling for this training sandbox's expected user-base size, or should the endpoint support real pagination (`limit`/`offset`) or at least signal truncation (a `total`/`hasMore` field) once more than 100 accounts exist? **Elevated from open to effectively blocking** by A-002: `PRD-BulkUserImport` ships a single-request 500-user import, a routine sandbox operation that alone exceeds this cap. | FC-003, Non Goals, A-002, G-001 | | open |
| Q-003 | Should a search matching zero accounts (FC-001) be distinguished, in the response, from a search that simply didn't match any *searchable* field, or from a failed request (FC-005) — or is a bare empty array accepted as sufficient for all three? | FC-001, FC-005 | | open |
| Q-004 | Is there (or should there be) an automated check that the response never includes a credential field (FR-003) or exceeds the documented projection (C-001), closing FC-004? | FC-004 | | open |
| Q-005 | This endpoint returns PII (email) for up to 100 accounts per call. `docs/features/admin-role-guards/PRD.md:212-213` records no auditing of *role changes* in the routes it examined — that source is scoped to role changes, not admin reads generally, so whether any admin-read auditing exists system-wide is unverified, not confirmed absent. Should bulk PII reads via this endpoint be logged, once that's checked? | Data Requirements | | open |
| Q-006 | `/admin/impersonate`'s account picker degrades any request failure from this endpoint to an empty result list (FC-005), indistinguishable from a correct "no matches." Should that distinction be made observable at the picker (an error state), at this endpoint (an error response shape), or both — and which PRD owns the fix? | FC-005 | | open |
| Q-007 | Given the confirmed consumer fires one request per keystroke with no debounce or cancellation, does this endpoint need a stated latency target, and should out-of-order response handling (a fast typist seeing stale results) be addressed here or in `PRD-Impersonation`? | Non Functional Requirements | | open |

## Success Metrics

Not measured today. No instrumentation was found for admin search
frequency, response time, or typical search-term usage patterns.

## Architecture Impact

- Requirements likely to drive decisions: Q-001 (widening search to
  `username`/name fields — a contained addition to `UsersService.findAll`,
  not a new boundary); Q-002 (whether real pagination replaces the fixed
  100-row cap — larger in scope, since it changes the response envelope
  every consumer, including `PRD-Impersonation`'s picker, would need to
  handle); Q-005 (whether bulk-PII-read auditing is needed — a
  cross-cutting decision shared with any other bulk-PII-read admin
  surface, not unique to this feature); Q-006 (whether request-failure
  disambiguation belongs at this endpoint, at the picker, or both — a
  decision shared with `PRD-Impersonation`); Q-007 (whether a latency
  target and out-of-order response handling are needed, given the
  per-keystroke call pattern).
- Suspected new components or boundaries: None for Q-001, Q-003, or Q-004 —
  contained changes to the existing `UsersService.findAll` query or
  projection. Q-002, if resolved toward real pagination, would change the
  response contract (`C-001`) that `PRD-Impersonation`'s picker already
  depends on — any implementation would need to account for that consumer,
  not introduce a new component but coordinate a breaking change across an
  existing one.
- Known architectural risk: the fixed 100-row cap with no truncation signal
  (FC-003) means any consumer, including `PRD-Impersonation`'s picker,
  currently has no way to detect it is seeing a partial result set for a
  broad search or an unfiltered listing — a silent, confident-looking
  incompleteness, not merely a missing convenience feature.
