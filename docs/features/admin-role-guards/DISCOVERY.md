# Architecture Discovery — Admin Role & Guards

Scan source: architecture-discovery
Scope: the `role`-based authorization primitive (`AdminGuard`, `users.role`,
the guard chains that consume it) and its interaction with impersonation;
does not re-scope `JwtStrategy`/`SessionGuard` mechanics themselves (owned
by `PRD-Login`/session management) or `impersonate()`'s/`endImpersonation()`'s
own redemption-check design (owned by `ADR-0011`) — this feature's
interaction with each is in scope, the mechanism underneath is not.
Primary input: `docs/features/admin-role-guards/PRD.md` (Status: Draft,
Confidence: Low for product intent / High for observed behavior — three
rounds of product-reviewer verification, all findings fixed and
re-verified)
Secondary input (consulted for consistency, not re-derived):
`docs/features/login/FINDINGS.md` (IF-001, Open),
`docs/features/two-factor-auth/DISCOVERY.md` and `FINDINGS.md` (precedent
for routing unguarded-route findings to Implementation Findings, not
ADRs),
`docs/architecture/adr/0010-session-revocation-via-db-backed-session-records.md` (Accepted),
`docs/architecture/adr/0011-end-impersonation-authentication-boundary.md` (Proposed),
`docs/architecture/adr/0014-session-revocation-on-2fa-enrollment.md` (Accepted)
Last scanned: 2026-07-28

## System Overview

Admin Role & Guards is not a standalone component — it is one field
(`users.role`), one guard (`AdminGuard`), and 13 `@UseGuards` sites that
apply it, layered on `PRD-Login`'s `JwtStrategy`/`SessionGuard` machinery.
Its defining property, confirmed directly in code, is that it resolves
authorization fresh from the database on every request rather than from
any token claim — a genuinely sound design for the property it was built
for (a role change takes effect immediately, no re-login). This
discovery's job is to determine which of the PRD's flagged gaps are new
architectural decisions this feature must make, versus gaps this codebase
has *already scoped and deliberately deferred* under an existing ADR,
versus plain implementation defects. The most significant finding of this
scan is the second category: `AdminGuard`'s fail-open mode (PRD FC-004b) is
not a new problem — it is the same root cause `ADR-0011` already named,
scoped, and deferred (as that ADR's Option D), now confirmed to also
threaten admin authority specifically, not only `end-impersonation` and
`/2fa/verify`. Filing it as a fresh candidate ADR would duplicate a
decision this codebase has already made about how to make this decision.

## Component Inventory

| Component | Responsibility | Evidence |
|---|---|---|
| `AdminGuard` (`backend/src/auth/guards/admin.guard.ts`) | Denies a request unless `request.user.role === 'admin'`; throws if `request.user` is absent | `admin.guard.ts:8-20` |
| `users.role` (`schema.prisma:19`) | `String @default("user")`, no DB-level enum constraint; whitelisted to `{'user','admin'}` only at the two admin-update DTOs | `schema.prisma:19`, `admin-update-user.dto.ts:28-31`, `admin-replace-user.dto.ts:25-28` |
| `JwtStrategy.validate()` (`backend/src/auth/jwt.strategy.ts:21-31`) | Resolves `request.user` via a fresh `usersService.findById(payload.sub)` on every request; inspects only `payload.sub` — never `temp2fa` or `purpose` claims | `jwt.strategy.ts:21-31`; confirmed via `PRD-Login`/`PRD-TwoFactorAuth` |
| `AuthService.impersonate()` (`auth.service.ts:457-495`) | Validates the caller is an admin; validates the target exists but **not** that the target is non-admin | `auth.service.ts:461-464` (caller check), `:466-469` (target check, existence only) |
| `AuthService.endImpersonation()` (`auth.service.ts:497-518`) | Re-checks `role !== 'admin'` on the return path; owned by `ADR-0011`'s redemption-check design, not this feature | `auth.service.ts:497-518` |
| 13-site `AdminGuard` route inventory | Full enumeration already produced by `prd-engine`, not reproduced here | `docs/features/admin-role-guards/PRD.md`, Current Behavior |

## Data Flows

### Observed (directly evidenced)

1. **Role resolution is fresh-per-request, not token-carried** — confirmed
   by `PRD-AdminRoleGuards` and independently re-derivable from
   `jwt.strategy.ts:21-31` and the absence of a `role` field on
   `JwtPayload` (`auth.service.ts:23-27`). This is the property that makes
   a role revocation take effect on the very next request.
2. **`AdminGuard`'s fail-open mode shares its exact mechanism with
   `ADR-0011`'s already-scoped root cause.** `ADR-0011`'s Context
   (`0011-...md:66-75`) states: "all token types in this system... are
   signed with one shared secret... `JwtStrategy.validate()` never
   inspects a `purpose` claim... A raw `backToAdminToken` therefore
   already passes `JwtAuthGuard` as if it were the admin's own access
   token; the only thing currently preventing it from being usable
   directly against any `JwtAuthGuard`+`SessionGuard` route is that it has
   no backing `user_sessions` row." `PRD-AdminRoleGuards` FC-004b
   establishes the same fact from `AdminGuard`'s side: a route pairing
   `JwtAuthGuard`+`AdminGuard` without `SessionGuard` would accept an
   admin's own 2FA temp token or `backToAdminToken` as admin authority.
   These are the same underlying gap, observed from two different call
   sites, not two separate gaps that happen to look similar.
3. **`impersonate()`'s target validation is asymmetric with its caller
   validation.** The caller check (`role === 'admin'`, `:461-464`) has no
   counterpart on the target (`:466-469` checks existence only). This is
   confirmed in code, not inferred — no comment or test suggests this
   asymmetry was a deliberate choice.
4. **No role-revocation-triggers-session-invalidation path exists for the
   admin-role case**, confirmed by reading `updateByAdmin`/
   `replaceByAdmin` (`users.service.ts:367-416`, `:418-`) — neither calls
   `SessionsService.deleteAllUserSessions()` or any equivalent. `ADR-0014`
   established this pattern for a different trigger (2FA enrollment); no
   ADR has evaluated it for a role change.

### Inferred

1. **The caller/target validation asymmetry in `impersonate()` reads as an
   oversight, not a documented decision** — inferred from the absence of
   any comment, test, or PRD statement asserting admin-to-admin
   impersonation is intentional, combined with the inventory's explicit
   (if imprecisely reasoned, per `PRD-AdminRoleGuards` Current Behavior)
   claim that impersonation "does not grant admin access" — a claim that
   only holds for non-admin targets and reads as though the inventory's
   author believed the restriction was general.

## Candidate ADRs

Ranked by significance. Each is checked against whether it is a genuinely
new decision or one this codebase has already scoped elsewhere.

### Not promoted to a candidate ADR: FC-004b (`AdminGuard` fails open for a non-access-token credential)

This is `ADR-0011`'s Option D's root cause, not a new decision point.
`ADR-0011` (Proposed) already identifies "any non-access token currently
passes `JwtAuthGuard`... `SessionGuard`'s absence-of-a-row as the only
thing stopping misuse today" as the root cause behind two of its own
findings (`backToAdminToken` on `end-impersonation`, and by the same
mechanism `/2fa/verify`'s temp token), and already evaluates a
`JwtStrategy`-wide fix for it (Option D: "Scope tokens cryptographically
so a non-access token cannot pass `JwtAuthGuard` at all") — explicitly
**deferred, not rejected**, on the grounds that it is "a larger, `JwtStrategy`-wide
change out of proportion to this ADR's scope, which is deliberately
limited to `end-impersonation`." `PRD-AdminRoleGuards` FC-004b confirms
the identical mechanism reaches `AdminGuard` routes as well, which widens
the known blast radius of `ADR-0011`'s already-deferred Option D but does
not introduce a new decision to make. Filing a fresh ADR here would
duplicate `ADR-0011`'s own Option D discussion rather than extend it.
**Filed instead as an Implementation Finding** (`FINDINGS.md` IF-001)
cross-referencing `ADR-0011`, so the widened blast radius is on record
without a redundant decision artifact. Recommend: whoever next revisits
`ADR-0011`'s deferred Option D should read this finding as additional
evidence for that option's scope, not as a separate problem.

### Candidate ADR 1 and Candidate ADR 2: merged into `ADR-0016` (Proposed) after review

**Resolution note (2026-07-28):** Both candidates below were drafted as
separate ADRs, then merged into a single decision — `ADR-0016`, "Deny
admin authority to any impersonated session, unconditionally" — after an
`architecture-reviewer` Full Review found a materially cheaper option
(denying admin authority per-request via the already-attached
`impersonatedBy` claim) invisible from either candidate's scope alone,
and that Candidate ADR 1's session-invalidation framing contradicted
`PRD-AdminRoleGuards` G-002 as written. The merged decision does **not**
invalidate any session — it denies admin authority at check time instead.
Original candidate framing preserved below for traceability; see
`ADR-0016` for what was actually decided, and `ADR-0017`'s retirement
note for what changed and why.

### Candidate ADR 1 (original framing, superseded by `ADR-0016`): Should a role change (specifically, revocation) invalidate the account's existing sessions and any impersonation session/token it caused?

- **Significance:** High. `PRD-AdminRoleGuards` FC-006 establishes that a
  demoted admin's already-issued impersonation session, and (separately)
  their own `backToAdminToken`, are both unaffected by the demotion —
  the first is privilege retention across revocation, a materially
  different failure than an ordinary lingering session.
- **Why this is a genuine decision point, not inherited:** `ADR-0014`
  (Accepted) establishes the mechanism (`deleteAllUserSessions()`) and a
  precedent for "a sensitive account-state change should invalidate
  sessions," but for a *different* trigger (2FA enrollment) and a
  different actor (the account's own action). Nothing in `ADR-0014` or
  elsewhere evaluates the role-revocation trigger, which is an
  *admin-acting-on-another-account* trigger, not a self-service one — the
  decision of *whether* to cascade, and to what (the demoted account's
  own sessions, sessions they created via impersonation, or both) has not
  been made.
- **PRD linkage:** FC-006 (first and second consequences), Q-007 (parts 1
  and 2).

### Candidate ADR 2 (original framing, superseded by `ADR-0016`): Should `impersonate()` be permitted to target another admin account?

- **Significance:** Medium-High. The asymmetric validation (Data Flows
  #3) means an admin can impersonate another admin today, and per FC-006's
  third consequence, doing so combined with a subsequent demotion produces
  privilege retention (a demoted admin keeps an admin-role session via the
  impersonation path). Whether to close this by restricting `impersonate()`
  itself, or by some other means (e.g. the session-cascade in Candidate
  ADR 1 closing the retention consequence without restricting the
  impersonation call itself), is genuinely open.
- **Why this is a genuine decision point:** No existing ADR evaluates
  `impersonate()`'s target-validation logic at all — `ADR-0011` is scoped
  to the *redemption* check on `end-impersonation`, not to who can be
  impersonated in the first place.
- **Relationship to Candidate ADR 1:** related but not redundant — Candidate
  ADR 1 (session cascade) would close FC-006's *retention* consequence
  without necessarily addressing whether admin-to-admin impersonation
  should be permitted at all (an audit/logging/consent question, not only
  a session-lifetime one). `adr-expert` should evaluate whether these are
  better drafted as one ADR (a combined "impersonation-and-role-integrity"
  decision, in the spirit of how `ADR-0013` combined rate limiting with
  BR-002's atomicity fix because they shared scope) or two independent
  ones — not decided here.
- **PRD linkage:** FC-006 (third consequence), Q-007 (part 3).

### Not promoted to a candidate ADR: FC-001/FC-002/FC-003 (role-value validation, last-admin protection, malformed-role signaling)

Confirmed as correctly scoped by the PRD's own Architecture Impact
section: these are contained, business-rule-level or DTO/schema-level
decisions with no component or boundary implication (whitelisting an
additional layer at the schema, deciding whether to block a
last-admin-removal, deciding whether to log an anomalous role value are
all local, reversible changes). No new evidence from this scan changes
that assessment.

### Not promoted to a candidate ADR: FC-005 (`GET /users/:id` unguarded)

Confirmed as a plain implementation defect, not an architectural decision
— consistent with the precedent `docs/features/two-factor-auth/DISCOVERY.md`
set for routing an unguarded-route-shaped finding to Implementation
Findings rather than an ADR (that scan's FC-014, the backup-code display
bug, was routed the same way). Closing it is a one-route fix (add
`AdminGuard`, a self-ownership check, or a reduced projection — the PRD's
own Q-006 already frames these as implementation alternatives, not
architectural ones). **Filed as an Implementation Finding**
(`FINDINGS.md` IF-002).

## Documentation Gaps

- No architecture-level document evaluates `impersonate()`'s target
  validation at all — `ADR-0011` is the only ADR touching impersonation,
  and it is scoped to the redemption/restore path, not the impersonation
  call itself. Candidate ADR 2 would be the first.
- No architecture-level document generalizes `ADR-0014`'s
  session-invalidation-on-sensitive-change pattern into a stated policy —
  it exists as one accepted instance (2FA enrollment) with no written
  rule for when else it applies. Candidate ADR 1, if accepted, would be a
  second instance; a future third instance would still lack a general
  policy unless one is written explicitly.

## Implementation Findings

Filed to `docs/features/admin-role-guards/FINDINGS.md`: IF-001 (new,
cross-referencing `ADR-0011`), IF-002 (new).

## C4 Diagram Assessment

**Not warranted.** This feature introduces no new container or component
boundary: `AdminGuard` is a new guard class inside the existing backend
deployable, `users.role` is an existing column on an existing table, and
every integration point (`JwtStrategy`, `SessionGuard`, `impersonate()`)
already exists as an edge in whatever C4 component diagram covers the
auth module today. Both candidate ADRs (session cascade on role
revocation, admin-target impersonation restriction) are internal-logic
decisions within `AuthService`/`UsersService` — they change behavior on
an existing edge, not the edge's existence or direction. Consistent with
every prior feature in this backlog (Registration, Login, Session
Management, Password Reset, Two-Factor Auth all concluded no diagram
needed).
