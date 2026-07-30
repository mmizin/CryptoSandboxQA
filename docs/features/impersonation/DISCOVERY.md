# Architecture Discovery — Impersonation (Admin → User)

**Scope:** Feature-scoped discovery for `PRD-Impersonation`
(`docs/features/impersonation/PRD.md`), per
`DOCUMENTATION_IMPLEMENTATION_PLAN.md`'s per-feature workflow step 4.
Inventory-primary: `FEATURES_INVENTORY.md:175-188` is the product-requirements
source; source code consulted only to verify architecture and resolve the
PRD's Definition-of-Ready ambiguity.

## System overview

Impersonation lets an authenticated admin obtain a full session as another
user without that user's password, by calling `POST /auth/impersonate`
(`AdminGuard`-protected). The backend mints an ordinary 7-day session for the
target user with one added JWT claim (`impersonatedBy`), plus a separate,
non-session-backed 1-hour restore token (`backToAdminToken`, `purpose:
'back_to_admin'`). `POST /auth/end-impersonation` — carrying no guards at
all, authenticating entirely via that token's own signature/expiry/purpose
check — exchanges it for a fresh admin session. The mechanism reuses every
existing session/JWT primitive; no new component, service, or schema was
introduced for this feature.

## Component/module inventory

| Component | Responsibility | Relevant to this feature |
|---|---|---|
| `AuthController` (`auth.controller.ts`) | Route declarations, guard wiring | `impersonate` (guarded), `end-impersonation` (unguarded) |
| `AuthService` (`auth.service.ts`) | Token issuance, session creation, restore-token verification | `impersonate()`, `endImpersonation()` |
| `AdminGuard` (`admin.guard.ts`) | Authorizes admin-only routes | Checked on `impersonate`, not `end-impersonation`; does not inspect `impersonatedBy` |
| `JwtStrategy` (`jwt.strategy.ts`) | Validates bearer JWTs, attaches `request.user` | Populates `impersonatedBy` from the token payload for any impersonated request |
| `SessionGuard` (`session.guard.ts`) | Confirms the JWT's session row is still live | Applies to `impersonate` (admin's own session); not applicable to `end-impersonation` (no session backs `backToAdminToken`) |
| `SessionsService` | Creates/looks up `user_sessions` rows | `createSession()` called for the target user during `impersonate()`; never called to revoke on end |
| `ImpersonationBanner` (frontend) | Signals active impersonation, offers return control | Reads `back_to_admin`/`impersonating` client state (`useAuth.ts`) |
| `useAuth.ts` (frontend) | Client-side token storage, `impersonate()`/`returnToAdmin()` orchestration | Stores both tokens in `localStorage`; single-tab-eager, cross-tab-lagging refresh |

## Observed data flows and integration points

- **Observed:** `impersonate()` → `sessionsService.createSession()` for the
  target user (`auth.service.ts:471-482`) → JWT with `impersonatedBy` claim
  returned to the frontend, alongside a separate `backToAdminToken`
  (`auth.service.ts:484-490`).
- **Observed:** `end-impersonation` performs no DB lookup of any session —
  verification is JWT-signature/claim-only (`auth.service.ts:497-518`).
- **Observed:** `impersonatedBy` is read downstream by `deposits`, `orders`,
  and `wallets` controllers to write `performedByAdmin`/`adminId` into
  `balance_transactions.metadata` (`wallets.service.ts:370`) — a
  cross-module integration point already documented in `ADR-0016`'s
  Consequences and cited, not re-derived, by the PRD.
- **Inferred:** No component currently treats `impersonatedBy` as an
  authorization signal outside these audit writes and (once implemented)
  `AdminGuard` — inferred from the absence of any other reference to
  `impersonatedBy` in `backend/src` beyond `jwt.strategy.ts` (population),
  the three controllers above (audit writes), and `admin.guard.ts` (target of
  the not-yet-implemented `ADR-0016` check). Not exhaustively grepped beyond
  these files; stated as an inference, not a verified negative.

## Feature-scoped verification checklist

1. **Frontend callers.** Found: `frontend/lib/api.ts:144-152` (`authApi.impersonate`,
   `authApi.endImpersonation`), consumed by `frontend/lib/useAuth.ts` and
   invoked from `frontend/app/admin/impersonate/page.tsx:48`. `POST
   /auth/impersonate` and `POST /auth/end-impersonation` are both reachable
   from the shipped UI — not orphaned endpoints, unlike `PRD-UserProfileExtended`'s
   finding for a different route.
2. **Test callers.** None found in a repo-wide search for `impersonat` across
   `*.spec.ts`/`*.test.ts`/`*.py` — no automated test exercises either
   endpoint today. Reported as a negative finding, not an absence of search.
3. **Historical callers.** Not run — no documentation claims a removed
   caller existed; this checklist item's trigger condition did not fire.
4. **Related ADRs.** Full-repo search for `impersonat` across
   `docs/architecture/adr/` returned: `ADR-0010` (session revocation model —
   topically adjacent, does not name this feature's files directly),
   `ADR-0011` (`end-impersonation-authentication-boundary` — names this
   feature's exact files/lines), `ADR-0014` (2FA-enrollment session
   revocation — topically adjacent), `ADR-0016` (`deny-admin-authority-to-impersonated-sessions`
   — names `admin.guard.ts` directly), `ADR-0017` (`restrict-impersonation-of-admin-accounts`
   — see item 5), `ADR-0018`/`ADR-0019`/`ADR-0020` — topically unrelated,
   matched only via an incidental cross-reference in prose, not a decision
   about this feature.
5. **Accepted vs. superseded revision.**
   - `ADR-0011`: **Status: Proposed** (not yet Accepted). Its single
     Decision section (`0011-...md:330-393`) adopts Option A + Option B +
     Option C2 combined, with Option C1 and Option D explicitly deferred.
     No revision history to disambiguate — this is the only Decision
     section in the file.
   - `ADR-0016`: **Status: Accepted.** Decision section
     (`0016-...md:271-340`) adopts Option B alone (deny admin authority to
     any impersonated session via the existing `impersonatedBy` claim),
     with Option A's target-side check deliberately not bundled in.
   - `ADR-0017`: **Status: Retired — merged into ADR-0016**, per its own
     Status section (`0017-...md:3-16`). Its target-restriction option is
     preserved as a considered-and-deferred alternative inside `ADR-0016`
     (Option A / Alternatives Rejected), not an independent decision. Not
     citable as an active ADR for anything.
6. **Implementation status of each Accepted ADR.**
   - `ADR-0016` (Accepted): **Not implemented.** Direct read of
     `admin.guard.ts:9-20` confirms `AdminGuard.canActivate()` checks only
     `!user` and `user.role !== 'admin'` — no reference to
     `impersonatedBy` anywhere in the file. Matches the PRD's own Current
     Behavior finding; independently re-verified here rather than inherited.
   - `ADR-0011` (Proposed, not Accepted): implementation-status question
     does not apply — the decision itself isn't settled. Direct read of
     `auth.controller.ts:226-232` and `auth.service.ts:497-518` confirms the
     **pre-decision** state the ADR's Context describes still holds: no
     `@UseGuards` on `end-impersonation`, no single-use marker, no binding
     to the impersonated JWT.
7. **Existing DISCOVERY.md.** None existed prior to this scan — this is a
   Create, not an update.
8. **Existing feature documentation.** `PRD-Impersonation` already cites
   `PRD-SessionManagement` (FR-005/Q-006/Q-008), `PRD-TwoFactorAuth`
   (Q-003), `PRD-Logout` (`returnToAdmin()` paths), `ADR-0011`, and
   `ADR-0016` — reused directly rather than re-derived; each citation was
   independently re-verified against current source in items 5-6 above and
   in the code excerpts under Observed data flows, and found still
   accurate (no drift detected between the PRD's citations and current
   source).
9. **Reachability / retirement status.** Both endpoints are reachable —
   see item 1. Not applicable as a retirement concern.
10. **Reused evidence verification.** All evidence reused from
    `PRD-Impersonation`, `ADR-0011`, and `ADR-0016` was re-checked directly
    against `admin.guard.ts`, `auth.controller.ts`, and `auth.service.ts`
    in items 5-6 and the flows above; no discrepancy found between the
    reused citations and current source.

## Candidate ADRs

Ranked by significance. Each checked against the PRD's own Architecture
Impact section and the items above before being promoted to "candidate."

1. **Q-001b — No fallback path once FC-004 refuses the restore.**
   `ADR-0016`'s own Consequences section (`0016-...md:333-340`) states this
   gap explicitly: "the stranded `back_to_admin` token — both remain open,
   the latter with no clear current owner." Independently confirmed here,
   not inherited on faith — `ADR-0011`'s Decision (item 5 above) adopts
   guard/single-use/binding changes to `end-impersonation`'s *redemption*
   mechanics but says nothing about a *fallback* once redemption is
   correctly refused because the subject is no longer an admin. This has
   genuinely distinct options with different security/UX trade-offs (forced
   re-authentication as the status quo, a time-boxed grace fallback, or
   re-validating against a signal other than live `role='admin'`) — the
   same shape as the options weighed in `ADR-0011`/`ADR-0016`. **Candidate
   ADR** — though note it could alternatively be scoped as a small
   amendment to `ADR-0011` (same route, adjacent failure mode) rather than
   a standalone ADR; that packaging choice belongs to `adr-expert`.

**Considered and not promoted:**

- **FC-009/Q-002 — Self-impersonation not blocked server-side.**
  `impersonate()` (`auth.service.ts:457-469`) validates only that the
  caller is an admin and the target exists; it never compares
  `targetUserId` to the caller's own id. The only block is client-side
  (`frontend/app/admin/impersonate/page.tsx:41-44`). Initially promoted to
  candidate-ADR status on the grounds that no existing ADR addresses it
  (`ADR-0016`, `ADR-0011`, and the retired `ADR-0017` all frame their scope
  around a *target* being an admin, or around the *restore* path, not the
  caller targeting themself) — **on reassessment, "no ADR owns it" is not
  the same claim as "it needs one."** The fix is a single, non-branching
  comparison with no competing options and no cross-cutting mechanism
  involved, unlike `ADR-0016`'s genuine A/B/C/D trade-off across
  demote-during-impersonation and promote-during-impersonation. This is a
  plain functional/business-rule gap — the frontend already encodes the
  intended behavior; the fix is closing the same rule server-side. Stays
  **PRD-owned** (already recorded as Q-002), to be resolved by an FR
  amendment once the expected behavior is confirmed, not escalated to
  `adr-expert`. Not filed as an Implementation Finding either — it doesn't
  meet the R-005 bar for a finding distinct from a plain, already-tracked
  PRD open question.
- **Q-001a — Restore token's 1-hour lifetime.** `ADR-0011`'s own
  Assumptions state the lifetime "is not being revisited by this ADR";
  `PRD-SessionManagement`'s Non Goals name `PRD-Impersonation` as the
  lifetime/issuance-policy owner. Both citations verified directly against
  `0011-...md` and `PRD-SessionManagement`'s Non Goals section — accurate.
  This is a real design question (fixed vs. renewable vs. expiry-warned),
  but it is a **parameter choice on an already-adopted mechanism**, not a
  choice between architecturally distinct options — no alternative
  session/token architecture is in play, only a duration value and
  whether a warning UX is added. Assessed as **not ADR-worthy**;
  fits the PRD-level bar this plan uses elsewhere (e.g. "uses Tailwind is
  not ADR-worthy," `DOCUMENTATION_IMPLEMENTATION_PLAN.md` §Per-feature
  workflow). Recommend it stay resolved at the PRD level (already recorded
  there as Q-001a), not escalated to `adr-expert`.

## Documentation gaps

- No test suite (unit, integration, or e2e) exercises `POST
  /auth/impersonate` or `POST /auth/end-impersonation` — confirmed absent
  in checklist item 2, not previously stated anywhere in the PRD.
- `FEATURES_INVENTORY.md:175-188`'s four inaccuracies (UI description,
  request body field name, audit-trail claim, database-tracking claim) are
  already recorded as `PRD-Impersonation` Q-009 — not re-filed here.

## Implementation Findings

None filed. The behaviors this scan observed that carry plausible risk —
self-impersonation, the stranded-restore-token gap, `ADR-0016`'s
not-yet-implemented status, the absent test coverage — are each already
either a candidate ADR above, an existing PRD-owned open question
(Q-001a/Q-001b/Q-002), or an already-Accepted-but-unimplemented decision
tracked by the PRD's own Current Behavior/FC-006 — none is a fresh,
undocumented condition meeting the R-005 filing bar for a new
Implementation Finding.

## Handing off

- **`adr-expert`:** one candidate — the stranded-restore-token fallback gap
  (Q-001b), ranked above. Self-impersonation (FC-009/Q-002) stays
  PRD-owned, resolved via an FR amendment, not escalated here.
- **`c4-expert`:** not warranted. No new container/component boundary —
  this feature reuses existing session/JWT issuance, `AdminGuard`, and
  `JwtStrategy` in full, consistent with every prior Phase 1/2 feature's
  precedent (Registration through Bulk User Import all reached the same
  conclusion for the same reason: behavioral changes only, no new System
  Context or Container-level element).
- **`architecture-reviewer`:** recommended once candidate ADR drafting
  begins, per this plan's per-feature workflow step 5.
