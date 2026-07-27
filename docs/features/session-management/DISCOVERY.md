# Architecture Discovery — Session Management

Scan source: architecture-discovery
Scope: session-lifecycle mechanism only (`SessionsService`, `SessionGuard`,
session-creating/deleting call sites in `AuthModule`); does not re-scope
Login, Registration, 2FA, or Impersonation's own flows, which are (or will
be) covered by their own PRDs/discoveries.
Primary input: `docs/features/session-management/PRD.md` (Status: Review,
Approved with comments)
Secondary input (consulted for consistency, not re-derived): `docs/features/login/DISCOVERY.md`, `docs/features/login/FINDINGS.md`
Last scanned: 2026-07-26 (rev. 2, post architecture-review)

## System Overview

Session Management is a shared backend mechanism, not a standalone service:
a `user_sessions` table and two enforcement points (`SessionsService`,
`SessionGuard`) that sit between NestJS's JWT layer (Passport, `JwtAuthGuard`)
and every protected route in the monolith. Its primary, evidenced purpose is
to make a signed JWT revocable before its signed expiry — requiring a live,
matching database row alongside a valid signature (PRD BR-001). Whether
`user_sessions` was also intended as an audit/attribution record is an open
question the PRD raises and does not resolve (PRD Q-010, evidenced by the
never-populated `userAgent`/`ipAddress` columns) — this report treats
revocability as the mechanism's *evidenced* purpose, not its only possible
one. Six flows in `AuthModule` create a session row (PRD FR-001); two
operations delete one (PRD FR-003, FR-004); one operation is specified to
delete one and cannot, today, do so as specified (PRD FR-005).

## Component Inventory

| Component | Responsibility | Evidence |
|---|---|---|
| `SessionsService` (`backend/src/auth/sessions.service.ts`) | Owns session row creation and deletion; computes `tokenHash` via `hashToken()` (SHA-256). Five public methods: `createSession`, `deleteSessionByToken`, `deleteAllUserSessions` (called from elsewhere), `isSessionValid`, `getTokenHash` (neither called from anywhere in the repo) | `sessions.service.ts:13,24,32,42,46` |
| `SessionGuard` (`backend/src/auth/session.guard.ts`) | Route guard: re-hashes the bearer token inline (does not call `SessionsService`) and queries `user_sessions` directly for a match with `expiresAt` in the future; 401 on no match | `session.guard.ts:15-38` (401 at `:34-36`) |
| `JwtAuthGuard` / `JwtStrategy` (`jwt-auth.guard.ts`, `jwt.strategy.ts`) | Verifies JWT signature and claimed expiry only; attaches `impersonatedBy` (if present in the payload) to the resolved user object; never consults `user_sessions` | `jwt.strategy.ts:21-31` |
| `AdminApiKeyGuard` (`backend/src/auth/guards/admin-api-key.guard.ts`) | A second, disjoint credential path: a shared static `ADMIN_API_KEY` header, no JWT, no session lookup. Guards `POST /auth/admin/register` (admin bootstrap), which still mints a full session-backed token via `createAdmin()`/`issueTokenAndSession()`. Not part of the `JwtAuthGuard`+`SessionGuard` pairing this report's candidate ADR 3 concerns — noted here so its exclusion from that candidate is explicit, not silent | `auth.controller.ts:106-107` |
| `AuthService` (`auth.service.ts`) | Orchestrates all six session-creating flows via `issueTokenAndSession()` (private, `:440-455`) and `impersonate()` (`:457-495`); also `resetPasswordWithCode()` (`:142-181`, session-deleting) and `endImpersonation()` (`:497-518`, session-creating for the admin, non-deleting for the target) | `auth.service.ts` |
| `AuthController` (`auth.controller.ts`) | Exposes `POST /auth/logout` (`@UseGuards(JwtAuthGuard, SessionGuard)`, deletes) and `POST /auth/end-impersonation` (**no** `@UseGuards` decorator at all, creates) | `auth.controller.ts:226-245` |
| `UserSession` Prisma model (`schema.prisma:78-90`) | Persistence: `userId`, `tokenHash`, `expiresAt`, `createdAt`, nullable `userAgent`/`ipAddress` (unpopulated — PRD A-001) | `schema.prisma:78-90` |
| Frontend `authApi.logout()` (`frontend/lib/api.ts:143`) | Defined client for `POST /auth/logout` | Present, but see Data Flows — never invoked |

Checked and found not to be an additional unguarded surface: `TickerGateway`
(`backend/src/websocket/ticker.gateway.ts`) carries no authentication, but
serves only public ticker data — it is not a session-relevant boundary.

## Data Flows

### Observed (directly evidenced)

1. **Session creation** — six call sites converge on two physical inserts:
   `AuthService.issueTokenAndSession()` (`:448`, called from `login` `:105`,
   `verify2Fa` `:212`, `register` `:223`, `createAdmin` `:242`,
   `registerWithProfile` `:287`, `endImpersonation` `:517`) and
   `AuthService.impersonate()` (`:482`, target-user session only). Both
   compute `expiresAt` as `new Date(); .setDate(+7)` independently of the
   JWT's own `expiresIn: '7d'` (`:53`). PRD FR-001, C-002.
2. **Session validation** — every protected route pairs `JwtAuthGuard` with
   `SessionGuard`; `SessionGuard` performs its own `findFirst` on
   `user_sessions.tokenHash` (unindexed) per request. Verified against all
   28 `@UseGuards` sites in `backend/src`: 23 pair both guards directly at
   the route; 4 more (`users.controller.ts:42,61,102,116`) carry only
   `AdminGuard` at the method but inherit both from a class-level
   `@UseGuards(JwtAuthGuard, SessionGuard)` (`users.controller.ts:37`); the
   remaining 1 (`auth.controller.ts:107`) is `AdminApiKeyGuard` alone, a
   different credential entirely, not a pairing site. Pairing holds at
   every site where it applies — 27 of 27, not counting the one route on a
   different credential. PRD FR-002, C-001, FC-003.
3. **Session validation failure (datastore unavailable)** — no fallback or
   explicit handling exists in `SessionGuard` for the case where the
   `findFirst` call itself fails (e.g. DB unreachable); such a failure
   would propagate as an unhandled error rather than a defined
   fail-open/fail-closed response. PRD FC-002, Q-004.
4. **Session deletion, explicit** — `POST /auth/logout` → `SessionsService
   .deleteSessionByToken()` (single row); `resetPasswordWithCode()` →
   `SessionsService.deleteAllUserSessions()` (all rows for the account,
   called **after** the password-hash transaction commits, not inside it,
   `auth.service.ts:168-177` then `:179`). Both endpoints return `{ success:
   true }` unconditionally, regardless of whether the underlying deletion
   succeeded. PRD FR-003, FR-004, FC-006, Q-009.
5. **Session creation after token signing can fail with no defined
   response** — in `issueTokenAndSession()`, the JWT is signed and returned
   before `createSession()` is awaited; a failure in the insert (e.g. DB
   error) surfaces as an unhandled error after a token was already
   generated. `impersonate()` (`auth.service.ts:476-482`) has the identical
   sign-then-`createSession` structure with no `try/catch`, so this
   condition has (at least) two sites, not one. PRD FC-001 claims this
   condition as PRD-SessionManagement's own responsibility ("recorded here
   as this PRD's own copy since session creation is this feature's
   responsibility, not Login's") — but `PRD-Login` Q-006 (not FC-001, which
   is an unrelated invalid-credentials condition there) leaves the same
   ownership question explicitly open: "is closing that gap Login's
   responsibility, `PRD-SessionManagement`'s, or an accepted risk nobody
   needs to close?" `docs/features/login/DISCOVERY.md` candidate ADR 2
   independently promotes the same condition to candidate status. This
   discovery adopts PRD-SessionManagement's unilateral claim rather than
   treating the ownership question as jointly resolved — the two PRDs
   disagree only in that one has asserted and the other has not yet
   answered, not in substance.
6. **Session deletion, absent, at the least-guarded entry point in the
   system** — `endImpersonation()` creates a session for the returning
   admin but issues no delete for the impersonated user's session; `POST
   /auth/end-impersonation` carries no `@UseGuards` decorator of any kind
   (`auth.controller.ts:226-232`) — not a JwtAuthGuard+SessionGuard site
   with one guard missing, but a route with neither. The handler
   (`auth.service.ts:497-518`) verifies only the `backToAdminToken`'s
   signature, `purpose` claim, and that the subject is still an admin —
   there is no nonce, usage counter, or single-use marker, so the token is
   replayable for its full 1-hour signed lifetime; the frontend clearing it
   from `localStorage` after use (`useAuth.ts:109`) is a client-side
   convention with no server-side enforcement behind it. PRD FR-005, FC-004,
   FC-005.
7. **Client-side, no network call** — the frontend's logout action
   (`useAuth.ts:62-68`) clears `localStorage` only; `authApi.logout()`
   (`api.ts:143`) has no caller anywhere in `frontend/`. PRD FC-007.

### Inferred

- **Guard-pairing is a convention, not a framework guarantee, and it
  currently holds everywhere it applies.** Inferred from the absence of any
  shared decorator, base controller, or lint rule that forces `SessionGuard`
  alongside `JwtAuthGuard` — each route's guard list is written
  independently. Evidence: the repo-wide `@UseGuards` scan (flow 2, above)
  found zero routes with one guard but not the other. `end-impersonation`
  is a **separate condition** — a route with no guards at all — not a
  counterexample to the pairing convention, consistent with PRD C-001's own
  framing ("tracked separately as FC-004, not as an instance of this
  convention breaking"). The risk this inference describes is therefore
  prospective (nothing currently enforces the pairing continuing to hold on
  the next new route), matching how `docs/features/login/FINDINGS.md` IF-001
  states the same convention: "This has not been observed to happen."
- **`tokenHash` duplication is unintentional divergence risk, not a
  deliberate abstraction boundary.** Inferred from `SessionsService`
  exposing `isSessionValid()`/`getTokenHash()` (dead code — no callers
  found) alongside `SessionGuard` inlining the identical hash computation.
  The dead methods suggest the guard was meant to delegate and does not.
  Filed as Implementation Finding `IF-001`, not a candidate ADR (see
  Candidate ADRs, "Not promoted," for why).

## Candidate ADRs

Ranked by significance — decisions with real consequences and no recorded
rationale, not implementation detail.

### 1. Session revocation model: DB-row-gates-JWT vs. token-only

The core architectural choice this feature embodies: a signed JWT is
insufficient for access; a live server-side record is also required
(PRD BR-001). This is genuinely architectural — it trades a stateless-auth
property (no DB lookup per request) for revocability, and the tradeoff is
paid on every authenticated request in the system (PRD FC-003's latency
angle). No ADR recording this tradeoff, its alternatives (short JWT
expiry + refresh tokens, a revocation denylist, stateless-only), or its
consequences was found (checked `docs/architecture/adr/` and the legacy
ADR set, `docs/architecture/history/legacy-adr/` `0001`–`0007`, plus
current `docs/architecture/adr/0008`, `0009` — neither current ADR covers
session revocation). **Recommend an ADR.**

### 2. Authentication boundary of the end-impersonation restore path

`POST /auth/end-impersonation` is the one route in the system that mints a
**fully-privileged admin session** from a bearer token with no session
backing and no `@UseGuards` at all — verifying only the
`backToAdminToken`'s signature and `purpose` claim
(`auth.service.ts:497-511`), with no single-use marker and a 1-hour replay
window (Data Flow 6, above). Two other routes also accept a
non-session-backed token, so the "authenticates without a session" property
alone is not unique to this route: `POST /auth/admin/register`
(`AdminApiKeyGuard`, a shared static key, no JWT at all) and `POST
/auth/2fa/verify` (unguarded, accepts the 2FA temp token — candidate 4).
What is unique to end-impersonation is the combination — no guard, a
replayable token, and the specific outcome of minting *admin* access — and
that combination has no ADR or recorded rationale. This is a genuine "how
does a session-less-by-design endpoint authenticate its caller"
architectural question with concrete alternatives: a purpose-scoped guard,
requiring the impersonated token alongside the restore token,
session-backing `backToAdminToken` itself, or a single-use/rotating
redemption scheme. This is distinct from candidate 4
(non-session-backed tokens generally) in that it also concerns *route
authorization*, not only *token revocability* — `backToAdminToken`'s
non-session-backed nature (candidate 4) is one contributing cause, not the
whole problem. PRD FC-004, FC-005. **Recommend an ADR** — this is the
single highest-consequence gap this discovery identified, since the
current design mints a fully-privileged admin session from a bearer token
alone.

### 3. Guard-pairing as the enforcement mechanism for candidate 1's model

`JwtAuthGuard` + `SessionGuard` pairing is the mechanism by which candidate
1's model is enforced on every other route, and it is unenforced by
tooling (PRD C-001) — no test, lint rule, or shared decorator was found
that would catch a future route omitting `SessionGuard`. Distinct from
candidate 2: this concerns the *general* convention across the ~28 routes
that use it correctly today, not the one route (`end-impersonation`) that
uses neither guard, which candidate 2 owns. **Recommend an ADR** — options
include a composed `@Authenticated()` decorator, a global guard registered
once, or an e2e test asserting every authenticated route carries both
guards.

### 4. Non-session-backed tokens as an accepted exemption or a gap to close

`backToAdminToken` (PRD FC-005) and the 2FA temporary token
(`PRD-Login` C-002, `IF-001` there) are both JWTs issued with no backing
`user_sessions` row, each redeemable into full or fuller access, and
neither revocable by this feature's mechanism. PRD FR-005 already names
three concrete alternatives for bringing `backToAdminToken` into the
model — persist impersonation linkage on the session row, embed the
impersonation session id in the `backToAdminToken` payload, or change the
end-impersonation request to carry the impersonated token — so this is a
decision with recorded alternatives, not merely a missing feature; PRD
Architecture Impact independently calls this "a design decision for
architecture, not specified here." **Recommend drafting the ADR now, as
Proposed**, framing the alternatives and Q-008/the parallel 2FA-token
question as the open decision to be answered *through* the ADR process
— not deferred until Q-008 has an answer from elsewhere, since every Open
Question in the PRD currently has an empty Owner and there is no other
mechanism visibly positioned to close it.

### Not promoted to candidate ADR

- **Independent computation of `expiresAt`/`tokenHash` at multiple sites**
  — PRD C-002 (expiry, `auth.service.ts:446-447` vs. `:480-481`) and
  Implementation Finding `IF-001` (hash, `sessions.service.ts:9-11` vs.
  `session.guard.ts:26`) are both instances of the same underlying issue —
  no single source of truth for values that gate access — rather than two
  separate decisions. Neither individually rises to ADR significance (each
  is a small refactor with an obvious fix — a shared `SessionsService`-owned
  helper — not a tradeoff between competing alternatives). **Not a
  candidate ADR; not a standalone item.** Fold both into candidate 3's
  scope when it is drafted: closing candidate 3 (enforcing guard-pairing
  centrally) is a natural place to also centralize these two computations,
  and `adr-expert` should close `IF-001` via whichever code change or ADR
  resolves that reference (see `FINDINGS.md`).
- **FC-002 / fail-open vs. fail-closed on `SessionGuard` datastore failure**
  (PRD Q-004) — this has real alternatives (fail closed and reject the
  request vs. fail open and allow it) and no recorded rationale, which
  would normally clear the bar. Not promoted to its own numbered candidate
  because it is small in scope (one guard, one failure branch) relative to
  candidates 1–4, but it is real and unaddressed — recorded as a
  documentation gap below rather than silently dropped, and worth folding
  into candidate 1's ADR as a consequence (candidate 1 already establishes
  that the system depends on a DB lookup on the auth path; this is that
  dependency's failure mode) rather than treated as a standalone candidate.
- **FC-003 / unbounded session accumulation, no cleanup, unindexed
  `tokenHash`** (PRD Q-002, Q-005, Q-007) — PRD.md names this "a latency
  risk on every authenticated request in the system" and gives it three
  concrete alternatives (index the column, add a cleanup job, cap
  concurrent sessions) plus "accept as-is." That would normally clear the
  bar on its own. Not promoted to its own numbered candidate for the same
  reason as FC-002 — narrow, local scope relative to candidates 1–4 — but
  it is real, unaddressed, and already cited as supporting evidence for
  candidate 1's significance; recorded as a documentation gap below rather
  than left to that indirect mention alone.
- **FC-001 / session creation can fail after the token is already signed**
  — see Data Flow 5. This condition is claimed by PRD-SessionManagement's
  own FC-001 and independently promoted to Candidate ADR 2 by
  `docs/features/login/DISCOVERY.md`. Not promoted to its own numbered
  candidate *here* because the sibling discovery already carries it as a
  candidate; recorded as a documentation gap below so the duplication (two
  discoveries, one condition, one candidate) is visible rather than
  silently resolved by this document alone. Whether it is one candidate
  cited from both PRDs, or two separate candidates each PRD owns, is left
  for `adr-expert` to settle when drafting — not decided unilaterally here.
- **FR-005 / impersonated-session revocation on end-impersonation** — this
  *is* covered, but as part of candidate ADR 2 (the end-impersonation
  authentication boundary) and candidate ADR 4 (non-session-backed
  tokens), not as its own item — it is the composite of both, not a
  separate decision. Not listed here as "declined": it is promoted, split
  across two candidates deliberately, per those items' scope statements.
- **FC-007 / frontend never calls logout** — a wiring gap (missing function
  call: `authApi.logout()` is defined but has no caller), not an
  architectural decision — there are no competing alternatives to weigh,
  only "call it" vs. "don't," and PRD Q-011 already asks which is intended.
  Filed as Implementation Finding `IF-002` (see `FINDINGS.md`) rather than
  silently dropped, since it is evidence-backed, carries a plausible risk,
  and is not already covered as a candidate ADR.
- **Using `crypto.createHash('sha256')` for `tokenHash`** — a library/API
  choice, not an architectural style choice; does not clear the bar per the
  skill's own guidance (using a library isn't architectural).

## Documentation Gaps

- No ADR exists for the DB-session-gates-JWT revocation model (candidate 1)
  despite it being the load-bearing tradeoff of this entire feature.
- No ADR exists for the end-impersonation authentication boundary
  (candidate 2) despite it being, on current evidence, the single point in
  the system where a bearer token with no session backing and no
  guards mints a fully-privileged admin session.
- No ADR exists for the guard-pairing enforcement mechanism (candidate 3).
- No recorded decision exists for `SessionGuard`'s behavior on datastore
  failure (fail-open vs. fail-closed, PRD FC-002/Q-004), for whether
  session revocation must be atomic with the state change it accompanies
  (PRD FC-006/Q-009), or for the accumulation/index/cleanup question (PRD
  FC-003/Q-002/Q-005/Q-007) — three real, unaddressed questions, not
  implementation detail (see "Not promoted to candidate ADR," above).
- The session-creation-after-signing failure condition (PRD FC-001) is
  claimed as in-scope by two discoveries — this one and
  `docs/features/login/DISCOVERY.md` candidate ADR 2 — with no single
  candidate ADR owning it yet; see "Not promoted to candidate ADR," above.
- **`ARCHITECTURE.md` states, without qualification, that logout revokes
  the session — which FC-007 shows does not hold for the shipped UI.**
  `ARCHITECTURE.md:112` ("combined with **SessionGuard** backed by
  `user_sessions` (logout invalidates session)") is a mechanism claim that
  is true of the backend endpoint in isolation but misleading without the
  qualification FC-007 supplies (the shipped frontend never calls it).
  `ARCHITECTURE.md:295` is a QA-scenario walkthrough ("logout (session
  invalid)") that a tester could still satisfy by calling the API
  directly rather than through the UI, so it is weaker evidence of the
  same gap than `:112`, not an independent instance of it. Both are worth
  a correction or a cross-reference to FC-007/IF-002, not necessarily a
  rewrite.
- **`FEATURES_INVENTORY.md` repeats or extends every discrepancy already
  logged against `DOMAIN-MODEL.md` and adds two more.** `:197` claims the
  raw JWT (not a hash) is stored in `user_sessions`, and claims an
  `impersonated_by` column — both false (verified: `SessionsService` only
  ever stores `hashToken(token)`, and `schema.prisma:78-90` has no such
  column). `:186` claims `user_sessions` "tracks impersonation state" — it
  does not track anything beyond the JWT-claim-derived
  `impersonatedBy`, which is not persisted. `:199` claims `SessionGuard`
  "checks JWT + session record exists" — `session.guard.ts` never
  validates the JWT signature or claims, only the session record;
  signature validation is `JwtAuthGuard`'s job, a separate guard. `:200`
  and `:202` claim logout "removes" the session, unqualified — the same
  gap `ARCHITECTURE.md:112` has, above. PRD Q-001, Q-010, Q-011 already
  cite pieces of this; this is the fuller picture across all four claims
  in one place.
- **`docs/foundation/DOMAIN-MODEL.md:32`** states `UserSession` "tracks
  `impersonated_by` when applicable"; `schema.prisma:78-90` has no such
  column (PRD Q-001). DOMAIN-MODEL is a Phase 0 artifact other PRDs treat
  as ground truth, which makes this a correctness gap in a load-bearing
  document rather than a simple cross-reference issue. The cross-reference
  health portion of this (whether other docs cite the same wrong claim) is
  `architecture-librarian`'s to audit; the underlying factual error is
  recorded here since it surfaced during this scan.
- No C4 component-level view of `AuthModule`'s internal session-management
  boundary exists; `ARCHITECTURE.md` describes `AuthModule` only as a
  single box at container level. Whether a component diagram scoped to
  `AuthModule` (Login, Session, Impersonation, 2FA sub-components and their
  guard dependencies) is warranted, given the PRD already documents
  candidate 2's gap in prose, is left for `c4-expert` to judge rather than
  decided here.
- No test (unit, integration, or lint rule) enforcing guard-pairing (PRD
  C-001) was found — the convention has zero automated protection against
  a future route omitting `SessionGuard`.

## Implementation Findings

Two findings filed this scan, both surfaced during data-flow tracing and
not already covered as a Candidate ADR or Documentation Gap. See
`docs/features/session-management/FINDINGS.md`.

- `IF-001` — Duplicate, independent `tokenHash` computation between
  `SessionsService` and `SessionGuard`, with `SessionsService`'s own
  validation helper (`isSessionValid()`) never called.
- `IF-002` — The shipped frontend never calls the session-revoking logout
  endpoint; `authApi.logout()` has no caller anywhere in `frontend/`.

## What this hands off to

- Candidate ADRs 1–4 → `adr-expert`, plus the "Not promoted" item folded
  into candidate 3 (independent `expiresAt`/`tokenHash` computation) when
  candidate 3 is drafted. Candidate 4 should be drafted as
  Proposed now, per its own recommendation above, rather than waiting on
  an unowned open question.
- FC-002/FC-006 (declined as standalone candidates, folded into candidates
  1 and left as documentation gaps respectively) → `adr-expert` if, on
  review, either warrants its own ADR rather than being folded in.
- `AuthModule` component boundary question → `c4-expert`, to confirm
  whether a component-level diagram is warranted (left open above, not
  decided unilaterally here).
- `IF-001`, `IF-002` → resolved through a code change, an issue, or an ADR
  citing them via `Resolved by:` (see `FINDINGS.md`); this discovery does
  not set their status.
- `ARCHITECTURE.md:112`/`:295` and `DOMAIN-MODEL.md:32` corrections →
  the user/owning team; `architecture-librarian` for a broader
  cross-reference audit if other documents repeat the same claims.
