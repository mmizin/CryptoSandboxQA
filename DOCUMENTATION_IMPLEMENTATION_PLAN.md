# Documentation Implementation Plan

**Purpose:** Drive systematic PRD + architecture documentation coverage of CryptoSandboxQA's existing functionality, using [`FEATURES_INVENTORY.md`](FEATURES_INVENTORY.md) as a backlog rather than a checklist to clear all at once.

**Source of truth:** During *planning* (this document), `FEATURES_INVENTORY.md` is authoritative. During *execution*, the inventory is the primary input for every PRD/ADR; the implementation may be inspected only to verify architecture and resolve ambiguity — never to invent product requirements that aren't in the inventory. If the inventory is silent or ambiguous, that gap gets logged as an open question, not silently resolved by reading source.

**Scope:** This is a plan document. No `product-toolkit` or `architecture-toolkit` skill invocations happen until the plan is approved and execution is explicitly requested, **one feature at a time**.

**Location:** All new documentation produced by this plan is written under [`docs/`](docs/), following the hybrid structure below. All pre-existing legacy documentation has been migrated into `docs/` as well (archived under `docs/architecture/history/`, or relocated as living references under `docs/engineering/`/`docs/guides/`); `old-docs/` no longer exists.

**Structure** (within `docs/`):

```
docs/
├── product/            — product discovery and intent (idea briefs)
├── features/<slug>/    — per-feature PRD.md, DISCOVERY.md
├── architecture/
│   ├── adr/            — active ADR baseline (NNNN-kebab-title.md), rebuilt via architecture-toolkit; numbering continues sequentially from the legacy archive below but is NOT that archive's continuation in format or status
│   ├── findings/       — architecture review findings registry
│   ├── diagrams/       — C4 diagrams
│   ├── quality-attributes/  — cross-cutting quality docs (scaffolded, empty until used)
│   └── history/         — archived, non-active material: API_DESIGN_PLAN.md, DATABASE_DESIGN_PROPOSAL.md, legacy-adr/ (ADR-0001–0007, historical only)
├── foundation/          — stable system knowledge (vision, glossary, domain model, standards)
├── engineering/          — living contributor conventions (code style, naming) — not part of the PRD/ADR pipeline
└── guides/              — living reference docs for QA/testing surfaces — not part of the PRD/ADR pipeline
```

## Execution model

**One feature at a time, gated.** For each feature: run the pipeline below → review → fix → user approves → only then move to the next feature. Never run a full phase unattended — catching an architectural mistake after 8 features are documented is expensive; catching it after 1 is cheap.

## Phase 0 — Foundation (run once, before Phase 1)

Written once and referenced by every later PRD/ADR, so no feature has to re-explain what CryptoSandboxQA is, or what a "User"/"Wallet"/"Order" means.

| Artifact | Content |
|---|---|
| Product Vision | Why this product exists (QA training sandbox), who it's for |
| System Overview | One-page narrative of the system, tying to `ARCHITECTURE.md` |
| Glossary | Canonical definitions: User, Wallet, Balance (available/locked), Order, Trade, Deposit, Withdrawal, Asset, Session, Impersonation |
| Domain Model | Core entities and relationships (User ↔ Wallet ↔ Order ↔ Trade ↔ Balance Transaction) |
| High-level C4 Context | System boundary: frontend, backend, Postgres, SMTP, Socket.IO — via `c4-expert` |
| Documentation Standards | PRD/ADR/C4 naming & cross-link conventions used for the rest of this plan |

## Documentation dependency graph

```
                    Phase 0: Foundation
              (Vision · Glossary · Domain Model · C4 Context)
                              │
                              ▼
                    Phase 1: Authentication
              (Register · Login · Session · 2FA · Reset · Admin Role)
                              │
                              ▼
                    Phase 2: Users & Admin Mgmt
              (Profile · Bulk Import · Impersonation · SMTP Config)
                              │
                              ▼
                    Phase 3: Wallets & Balances
              (Wallets · Lock/Unlock · Transfer · Withdrawal · Payment Methods)
                       ┌──────┴──────┐
                       ▼             ▼
              Phase 4: Deposits   Phase 5: Trading
              (Fiat · Crypto ·    (Ticker WS · Order Lifecycle ·
               Persist Delay)      Matching · Stop Orders · Futures)
                       └──────┬──────┘
                              ▼
                    Phase 6: Portfolio & Markets
              (Summary · Allocation · Analytics · Markets Table · Charts)
                              ▼
                    Phase 7: Transactional Email
              (Order/Deposit/Welcome/Reset/Training Credit emails)
                              ▼
                    Phase 8: Admin Inspection
              (Unified admin read views over Phases 3–6)
                              ▼
              Phase 9 / 10 / 11 (independent, low priority)
              QA Utilities · Observability & API Docs · Cross-cutting UI Patterns
```

## Per-feature workflow

1. **Definition of Ready** — a feature may enter the pipeline only when:
   - All its listed dependencies are in `Done` status
   - Its inventory entry has been re-read for the specific feature
   - Any referenced frontend/backend files in the inventory are noted (not yet read — just catalogued)
   - Open questions the inventory leaves unanswered are listed up front
2. **Product Toolkit** → `prd-engine` produces the PRD from the inventory entry, referencing (not duplicating) Phase 0 glossary/domain model and any prior-phase PRDs it depends on.
3. **Product Review** → `product-reviewer` gives independent critique of the PRD.
4. **Architecture Toolkit** → `architecture-discovery` (inventory-primary; implementation consulted only to verify/resolve ambiguity) → `adr-expert` only where the inventory reveals a genuine decision point (e.g., "server-side trigger not implemented" is ADR-worthy; "uses Tailwind" is not) → `c4-expert` for container/component diagrams where the feature crosses module boundaries → technical design notes for anything C4 doesn't capture.
5. **Architecture Review** → `architecture-reviewer` critiques the ADR/C4 output.
6. **Definition of Done** — a feature is complete when all of these hold:
   - PRD exists and passed `product-reviewer` with no unresolved blocking findings
   - Architecture artifacts exist for any feature with cross-module or multi-service behavior, and passed `architecture-reviewer`
   - Open questions from the inventory gap are explicitly logged, not silently dropped
   - Cross-links added: PRD references the ADRs/C4 it depends on; later features reference earlier PRDs instead of re-deriving them
   - Traceability column (below) filled in with the artifact IDs actually produced

## Review escalation gate

**Every review finding gets reported before another review round is spawned.** When `product-reviewer` or `architecture-reviewer` finds an issue (Full Review or Delta Review), the finding is fixed and then reported back to the user as a full write-up — not silently resolved and chained into the next review round automatically. Each report states, per finding:

- What was found
- Severity (Critical / High / Medium / Low, per the reviewer's own taxonomy)
- Which section/requirement/ADR it relates to

The user then decides whether the next check is a Full Review, a Delta Review, or none at all. The orchestrator does not auto-escalate to another review round on its own judgment alone — Delta Review's own escalation triggers (unbounded changed region, new Critical/High finding) still apply and may fire, but accepting that escalation and paying for another full pass is a decision the user makes, not one made silently to reach a "clean" document. This exists because review cost compounds fast (see `docs/process/FEATURE_EXECUTION_LOG.md`, Feature 9 retrospective) and severity, not round-count, should drive whether another paid pass is worth it.

## Ordering principle

Phases are ordered by **dependency**, not by the inventory's table of contents. Foundational features (identity, sessions, wallets/balances) are documented first because nearly every later feature's PRD needs to reference them.

---

## Backlog

Complexity scale: **S** (~0.5 day) / **M** (~1–2 days) / **L** (~3–4 days) / **XL** (~5+ days) — rough documentation effort, not implementation effort.

| # | Feature | Phase | Priority | Complexity | Est. Effort | Dependencies | Product Docs | Architecture Docs | Artifacts (Depends on / Produces) | Status |
|---|---------|-------|----------|------------|--------------|---------------|---------------|--------------------|-------------------------------------|--------|
| 0 | Foundation (Vision, Glossary, Domain Model, C4 Context) | 0 | High | L | ~3d | — | Vision doc | C4 Context | Produces: SYSTEM-VISION.md, SYSTEM-OVERVIEW.md, GLOSSARY.md, DOMAIN-MODEL.md, C4-CONTEXT.md, DOCUMENTATION-STANDARDS.md | Done |
| 1 | User Registration | 1 | High | S | ~0.5d | Foundation | PRD | Architecture Discovery, ADR ×2, C4 (confirmed not needed) | Depends: GLOSSARY · Produces: PRD-Registration, DISCOVERY, ADR-0008 (Rev.5, Accepted), ADR-0009 (Rev.4, Accepted) | **Done** — DoD met: PRD passed product-reviewer; Discovery + 2 ADRs passed architecture-reviewer (4 cycles, 19 findings, 17 resolved, 2 open by design/owner-TBD); c4-expert confirmed no C4 diagram warranted (no new container/component boundary — behavioral changes only, already documented in the ADRs' prose) |
| 2 | User Login | 1 | High | S | ~0.5d | Registration | PRD | Architecture Discovery, C4 (confirmed not needed) | Depends: PRD-Registration · Produces: PRD-Login (docs/features/login/PRD.md), DISCOVERY.md (3 Candidate ADRs), FINDINGS.md (IF-001) | **Done** — DoD met: PRD passed product-reviewer (2 fix rounds, Approved); Discovery passed architecture-reviewer (3 review rounds, all findings resolved); c4-expert confirmed no C4 diagram warranted (no new Person/System_Ext at Context level, no new container/component boundary — behavioral changes only, consistent with Registration's precedent); open questions logged (PRD Q-001–Q-007, FINDINGS IF-001), none silently dropped |
| 3 | Session Management | 1 | High | S | ~0.5d | Login | PRD | Architecture Discovery, ADR-0010 (Accepted), ADR-0011 (Proposed) | Depends: PRD-Login · Produces: docs/features/session-management/{PRD.md, DISCOVERY.md, FINDINGS.md}, docs/architecture/adr/{0010,0011} | **Done** — DoD met: PRD passed product-reviewer (4 review rounds); Discovery + FINDINGS passed architecture-reviewer (2 review rounds); 2 of 4 candidate ADRs drafted and reviewed (2 rounds each) — ADR-0010 (session revocation model, Accepted) and ADR-0011 (end-impersonation auth boundary, Proposed); candidates 3 (guard-pairing enforcement) and 4 (non-session-backed tokens) deferred pending user triage; open questions logged (PRD Q-001–Q-011), none silently dropped, owners still TBD |
| 4 | Logout | 1 | Medium | S | ~0.5d | Session Mgmt | PRD | — | Depends: PRD-SessionManagement · Produces: PRD-Logout (docs/features/logout/PRD.md) | **Done** — DoD met: PRD passed product-reviewer (1 review round, 3 blocking findings fixed: US-001's unqualified security claim, missed `returnToAdmin()`→`logout()` call sites in A-001/C-001/Non Goals, G-002 pre-empting Q-001); no architecture artifacts required per backlog; open questions logged (Q-001–Q-007), none silently dropped, owners TBD; cross-links to PRD-SessionManagement (FR-003, FC-007, G-002, US-001, Q-011, BR-001) added |
| 5 | Password Reset (8-digit code) | 1 | High | M | ~1d | Login, Session Mgmt, SMTP Config | PRD | Architecture Discovery, ADR-0012 (Accepted), ADR-0013 (Accepted), C4 (confirmed not needed) | Depends: PRD-Login, PRD-SessionManagement · Produces: docs/features/password-reset/{PRD.md, DISCOVERY.md}, docs/architecture/adr/{0012,0013} | **Done** — DoD met: PRD passed product-reviewer (3 review rounds — brute-force arithmetic, BR-002 atomicity, and mitigation-matrix corrections); Discovery passed architecture-reviewer, correctly distinguishing genuine candidate ADRs (rate limiting, pepper fallback) from gaps already owned elsewhere (ADR-0009 for mail-failure divergence, PRD-SessionManagement FC-006 for session-invalidation ordering); both candidate ADRs drafted and reached Accepted after 3 architecture-review rounds each — ADR-0012 (pepper decoupled from `JWT_SECRET`, correcting an initial premise that the coupling was undocumented when it was in fact documented/intended) and ADR-0013 (rate limiting + BR-002 atomicity fix, correcting two mechanism errors caught across rounds — a transaction wrapper that doesn't close the race under this DB's isolation level, and an unconditional upsert that would let a superseded code redeem successfully during a race); ADR-0013's final mechanism verified empirically against a live Postgres instance (concurrent-upsert atomicity, the conditional-redemption fix, required schema cardinality change, and `P2002` error-shape all confirmed) before acceptance; c4-expert confirmed no C4 diagram warranted (no new container/component boundary, consistent with Registration/Login precedent); open questions logged (PRD Q-001–Q-010, minus Q-005 closed), Q-002/Q-004 remain open pending implementation-time doc/config updates the ADRs name |
| 6 | Two-Factor Authentication (2FA/TOTP) | 1 | High | M | ~1.5d | Login, Session Mgmt | PRD | Architecture Discovery, ADR-0014 (Accepted), ADR-0015 (Accepted), C4 (confirmed not needed) | Depends: PRD-Login, PRD-SessionManagement · Produces: docs/features/two-factor-auth/{PRD.md, DISCOVERY.md, FINDINGS.md}, docs/architecture/adr/{0014,0015} | **Done** — DoD met: PRD passed product-reviewer (3 review rounds — admin-impersonation-as-bypass correction (D-1), hijacked-session lockout gap (D-2), backup-code CSPRNG gap (D-3), and a settings-page backup-code display bug found only in round 3 (FC-014)); Discovery correctly distinguished 2 genuine new candidate ADRs (session revocation on enrollment, step-up auth before enrollment) from items already owned elsewhere (ADR-0013 for rate limiting, `login/FINDINGS.md` IF-001 for temp-token scope) and from plain implementation defects (4 Implementation Findings filed to FINDINGS.md — backup-code display bug, impersonation bypass, `Math.random()` generation, indefinite secret retention); both candidate ADRs drafted and Accepted — ADR-0014 (session revocation on 2FA enrollment, preserving the enrolling session) and ADR-0015 (step-up password re-verification before enabling 2FA, scoped narrowly rather than building a general-purpose mechanism); c4-expert step skipped in favor of direct confirmation (no new container/component boundary — both ADRs extend existing edges, consistent with prior features' precedent); architecture-reviewer step replaced by self-verification against source per explicit user direction (cost-driven), applied consistently to both PRD round-3 fixes and both ADRs; open questions logged (PRD Q-001–Q-013, minus Q-010/Q-012 resolved by the two new ADRs), remainder open pending implementation-time work the ADRs and FINDINGS name |
| 7 | Admin Role & Guards | 1 | High | S | ~0.5d | Login | PRD | ADR-0016 (Accepted) | Depends: PRD-Login · Produces: docs/features/admin-role-guards/{PRD.md, DISCOVERY.md, FINDINGS.md}, docs/architecture/adr/0016 | **Done** — DoD met: PRD (Slug: PRD-AdminRoleGuards) passed product-reviewer across 3 rounds (Full → Delta → forced-escalation Full) — corrected a false FC-001 validation claim (DTO whitelist decorators already existed), fixed AdminGuard/AdminApiKeyGuard route misattribution and completed the 13-site route inventory, added FC-005 for the unguarded `GET /users/:id`, split FC-004 into fails-closed (FC-004a) and fails-open-on-wrong-token-kind (FC-004b) variants, and refined FR-004 into an outcome-based coverage requirement; Discovery correctly routed FC-004b to Implementation Finding IF-001 (same root cause as `ADR-0011`'s deferred Option D, not a new candidate ADR) and FC-005 to IF-002 (plain defect), while surfacing two related candidate decisions that a first architecture-reviewer Full Review found were reasoning about one half of a single mechanism and missing a materially cheaper cross-cutting option; both candidates were combined into a single rewritten ADR-0016 (deny admin authority to any impersonated session via the existing `impersonatedBy` claim, zero schema cost) and the original ADR-0017 retired as a merge stub; a second Full Review returned "Accept with changes" (7 findings — inaccurate audit-surface claim, missing 2FA-enrollment residual harm, a missing considered option, a misdirected Risks fallback, two unstated operational consequences, an unnamed auditing sub-question, and a stale citation) — all fixed and self-verified directly against source, then ADR-0016 moved to Accepted; c4-expert step skipped (no new container/component boundary, consistent with prior features) |
| 8 | Admin User Creation (API Key Bootstrap) | 1 | Medium | S | ~0.5d | Admin Role & Guards | PRD | Architecture Discovery, ADR-0018 (Accepted), ADR-0019 (Accepted) | Depends: PRD-AdminRoleGuards · Produces: docs/features/admin-user-creation/{PRD.md, DISCOVERY.md, FINDINGS.md}, docs/architecture/adr/{0018,0019} | **Done** — DoD met: PRD (Slug: PRD-AdminUserCreation) passed product-reviewer across 3 Full + 2 Delta Reviews, correcting an initial draft that hadn't read source directly and resolving a live self-contradiction about whether session-minting was confirmed fact, adopted goal, or open question simultaneously; Discovery correctly separated two genuine candidate ADRs (session-issuance intent — Q-002; zero-admin restriction — Q-009) from items already owned elsewhere (ADR-0008 for the duplicate-email race/401 ambiguity, ADR-0013 for rate limiting) and filed 3 Implementation Findings (IF-001–IF-003); ADR-0018 (restrict the route to the zero-admin window via a live admin-count check) went through 7 review rounds, correcting three successive unsound arguments (an incorrect recoverability claim, a circular PRD-citation argument, and a factually false sibling-route usage argument) before reaching Accepted, with its own required PRD amendment carried out directly; ADR-0019 (continue issuing a session in the same call) went through 5 review rounds — 2 Full Reviews finding 23 defects total, 2 Delta Reviews finding follow-on inconsistencies including a durability defect (accumulated hedging obscuring the argument, resolved via a full consolidated rewrite rather than further patching), and a final Full Review catching a backwards precedent argument and an unpriced cost that a separately-Accepted ADR-0008 already covered — both fixed directly against source without a further paid review round, given accumulated review cost; required PRD follow-through for both ADRs carried out in `PRD-AdminUserCreation` (FR-001, G-001, G-002, Non Goals, Current Behavior, Q-002, Q-007, Q-009); open questions logged (PRD Q-001–Q-011), none silently dropped; c4-expert step skipped (no new container/component boundary, consistent with prior features) |
| 9 | User Profile & Settings | 2 | Medium | S | ~0.5d | Registration, Login | PRD | ADR-0020 (Accepted), ADR-0021 (deferred, not started) | Depends: PRD-Registration, PRD-Login · Produces: docs/features/user-profile-settings/{PRD.md, DISCOVERY.md}, docs/architecture/adr/0020 | **Done** — DoD met: PRD Approved (owner sign-off); Discovery Completed; ADR-0020 (username case-insensitive identity via `citext`) reached Accepted after 4 Full Review rounds + 1 Delta Review, correcting recurring write-path enumeration errors, a `db push`-vs-migrations false premise in Option D, a fabricated self-check finding, and verifying backfill risk directly against the checked-in data dump; ADR-0021 (admin-impersonation audit metadata) recorded as a legitimate deferred candidate, not required to close; c4-expert confirmed no C4 diagram warranted; open questions logged (PRD Q-013 tracks the ADR-0021 gap), none silently dropped |
| 10 | User Profile Extended (Register w/ Profile) | 2 | Low | S | ~0.5d | Registration | PRD | — | Depends: PRD-Registration · Produces: docs/features/user-profile-extended/{PRD.md, DISCOVERY.md} | **Done** — DoD met: PRD (Slug: PRD-UserProfileExtended) passed product-reviewer across Full Review 1 (Needs rework, 5 defects + 1 gap: D1 Critical — the endpoint has no caller anywhere in the repo, unstated; D2/D3 High — FC-003/BR-001 recorded as unconfirmed what ADR-0008/ADR-0020 already decide; D4/D5 Medium — Non Goals confused delegation with exclusion, BR-001 failed the deletion test; G1 — the reachability question was never asked) and two Delta Reviews; a Discovery pass (produced retroactively, after Full Review 1 — DISCOVERY.md) confirmed via direct repository inspection that the endpoint has zero callers in `frontend/` and that its one prior caller (a Python test suite) was removed repo-wide in a past commit, resolving D1/G1 as fact rather than assumption, and verified ADR-0008/ADR-0013/ADR-0020's exact applicability against source; Delta Review 1 found the fix pass itself introduced a new High-severity mischaracterization of ADR-0020 (citing its superseded Revision 1 proposal instead of the Accepted Revision 5 decision) plus 4 smaller issues, corrected at the DISCOVERY.md source first per owner direction, then propagated to the PRD; Delta Review 2 confirmed all fixes and reached Approved with 2 non-blocking editorial notes (folded in); open questions logged (PRD Q-000–Q-007, Q-000 being the feature's central reachability decision), none silently dropped; no architecture artifacts required per backlog (C4/ADR not indicated); cross-links to PRD-Registration and PRD-UserProfileSettings added |
| 11 | Bulk User Import (CSV/JSON) | 2 | Medium | M | ~1d | Admin Role & Guards | PRD | Technical Design (parser format detection) | Depends: PRD-AdminRoleGuards · Produces: PRD-011 | Not Started |
| 12 | Impersonation (Admin → User) | 2 | High | M | ~1.5d | Admin Role, Session Mgmt | PRD | ADR (token/back-to-admin flow), C4 | Depends: PRD-AdminRoleGuards, PRD-SessionManagement · Produces: PRD-012, ADR-005 | Not Started |
| 13 | Admin User List & Query | 2 | Low | S | ~0.5d | Admin Role & Guards | PRD | — | Depends: PRD-AdminRoleGuards · Produces: PRD-013 | Not Started |
| 14 | Admin User Export | 2 | Low | S | ~0.5d | Admin User List | PRD | — | Depends: PRD-013 · Produces: PRD-014 | Not Started |
| 15 | SMTP Configuration (Mailpit/Custom) | 2 | Medium | S | ~0.5d | — | PRD | C4 (mail integration) | Produces: PRD-015 | Not Started |
| 16 | User Wallets & Balances | 3 | High | L | ~3d | Registration | PRD | Architecture Discovery, C4, Technical Design (balance/locked model) | Depends: PRD-Registration · Produces: PRD-016 | Not Started |
| 17 | Balance Lock & Unlock (Order-Backed) | 3 | High | L | ~3d | User Wallets & Balances | PRD | ADR (locking formula), Technical Design | Depends: PRD-016 · Produces: PRD-017, ADR-006 | Not Started |
| 18 | Internal Crypto Transfer | 3 | Medium | M | ~1d | User Wallets & Balances | PRD | — | Depends: PRD-016 · Produces: PRD-018 | Not Started |
| 19 | Cryptocurrency Withdrawal | 3 | Medium | M | ~1d | User Wallets & Balances | PRD | — | Depends: PRD-016 · Produces: PRD-019 | Not Started |
| 20 | Payment Methods | 3 | Low | S | ~0.5d | User Wallets & Balances | PRD | — | Depends: PRD-016 · Produces: PRD-020 | Not Started |
| 21 | Fiat Deposit (Card/SEPA) | 4 | High | M | ~1.5d | Wallets, Payment Methods, SMTP Config | PRD | Technical Design (simulated persist delay) | Depends: PRD-016, PRD-020, PRD-015 · Produces: PRD-021 | Not Started |
| 22 | Cryptocurrency Deposit (Manual Address) | 4 | Medium | M | ~1d | Wallets, SMTP Config | PRD | — | Depends: PRD-016, PRD-015 · Produces: PRD-022 | Not Started |
| 23 | Deposit History & Admin Inspection | 4 | Low | S | ~0.5d | Fiat + Crypto Deposit | PRD | — | Depends: PRD-021, PRD-022 · Produces: PRD-023 | Not Started |
| 24 | Timing & Async Waits (Simulated Persist Delay) | 4 | Medium | S | ~0.5d | Order/Deposit flows | PRD | ADR (why simulated delay exists, training rationale) | Depends: PRD-021 · Produces: PRD-024, ADR-007 | Not Started |
| 25 | Ticker WebSocket (Socket.IO) | 5 | High | M | ~1.5d | Foundation | PRD | Architecture Discovery, C4 | Depends: GLOSSARY · Produces: PRD-025 | Not Started |
| 26 | Order Creation & Lifecycle | 5 | High | XL | ~5d | Wallets, Balance Lock/Unlock, Ticker WS | PRD | Architecture Discovery, ADR (matching/settlement design), C4, Technical Design | Depends: PRD-016, PRD-017, PRD-025 · Produces: PRD-026, ADR-008 | Not Started |
| 27 | Spot Market Trading (Buy/Sell) | 5 | High | M | ~1.5d | Order Creation & Lifecycle | PRD | — | Depends: PRD-026 · Produces: PRD-027 | Not Started |
| 28 | Matching & Trade Settlement | 5 | High | L | ~3d | Order Creation & Lifecycle | PRD | Technical Design (FIFO matching) | Depends: PRD-026 · Produces: PRD-028 | Not Started |
| 29 | Order Cancellation | 5 | Medium | S | ~0.5d | Order Creation & Lifecycle | PRD | — | Depends: PRD-026 · Produces: PRD-029 | Not Started |
| 30 | Order Listing & Filtering | 5 | Low | S | ~0.5d | Order Creation & Lifecycle | PRD | — | Depends: PRD-026 · Produces: PRD-030 | Not Started |
| 31 | Stop Orders (Buy/Sell Stop) | 5 | Medium | M | ~1.5d | Order Creation & Lifecycle, Ticker WS | PRD | ADR (client-side trigger, no server-side trigger — training tradeoff) | Depends: PRD-026, PRD-025 · Produces: PRD-031, ADR-009 | Not Started |
| 32 | Futures Market Trading (UI) | 5 | Low | S | ~0.5d | Spot Market Trading | PRD | — | Depends: PRD-027 · Produces: PRD-032 | Not Started |
| 33 | Trade History | 5 | Low | S | ~0.5d | Matching & Trade Settlement | PRD | — | Depends: PRD-028 · Produces: PRD-033 | Not Started |
| 34 | Portfolio Summary | 6 | Medium | S | ~0.5d | Wallets | PRD | — | Depends: PRD-016 · Produces: PRD-034 | Not Started |
| 35 | Portfolio Allocation | 6 | Low | S | ~0.5d | Portfolio Summary | PRD | — | Depends: PRD-034 · Produces: PRD-035 | Not Started |
| 36 | Dashboard Portfolio Analytics (Reorderable) | 6 | Low | M | ~1d | Portfolio Summary/Allocation | PRD | — | Depends: PRD-034, PRD-035 · Produces: PRD-036 | Not Started |
| 37 | Markets Cryptocurrency Table (with Modals) | 6 | Low | S | ~0.5d | Ticker WS | PRD | — | Depends: PRD-025 · Produces: PRD-037 | Not Started |
| 38 | Trade Coin Selection Table | 6 | Low | S | ~0.5d | Markets Table | PRD | — | Depends: PRD-037 · Produces: PRD-038 | Not Started |
| 39 | Order Book (Price Chart) | 6 | Low | S | ~0.5d | Order Listing | PRD | — | Depends: PRD-030 · Produces: PRD-039 | Not Started |
| 40 | Advanced Candlestick Charts | 6 | Low | M | ~1d | Ticker WS | PRD | — | Depends: PRD-025 · Produces: PRD-040 | Not Started |
| 41 | Order Status Email | 7 | Medium | S | ~0.5d | Order Creation & Lifecycle, SMTP Config | PRD | — | Depends: PRD-026, PRD-015 · Produces: PRD-041 | Not Started |
| 42 | Deposit Receipt Email (Fiat & Crypto) | 7 | Medium | S | ~0.5d | Deposits, SMTP Config | PRD | — | Depends: PRD-021, PRD-022, PRD-015 · Produces: PRD-042 | Not Started |
| 43 | Welcome Email (Registration) | 7 | Low | S | ~0.5d | Registration, SMTP Config | PRD | — | Depends: PRD-Registration, PRD-015 · Produces: PRD-043 | Not Started |
| 44 | Password Reset Code Email | 7 | Low | S | ~0.5d | Password Reset, SMTP Config | PRD | — | Depends: PRD-PasswordReset, PRD-015 · Produces: PRD-044 | Not Started |
| 45 | Training Credit Deposit Email | 7 | Low | S | ~0.5d | Deposits, SMTP Config | PRD | — | Depends: PRD-021, PRD-015 · Produces: PRD-045 | Not Started |
| 46 | Admin Inspection Views (Wallets/Orders/Deposits/Transactions/Portfolio) — grouped | 8 | Medium | M | ~1.5d | Wallets, Orders, Deposits, Portfolio, Admin Role | PRD (one, covering all admin inspection endpoints) | — | Depends: PRD-016, PRD-026, PRD-021, PRD-034, PRD-AdminRoleGuards · Produces: PRD-046 | Not Started |
| 47 | QA Iframe Practice Surface | 9 | Low | S | ~0.5d | — | PRD | — | Produces: PRD-047 | Not Started |
| 48 | Input Field Rules & Client Validation | 9 | Low | S | ~0.5d | — | PRD | — | Produces: PRD-048 | Not Started |
| 49 | Form Error Handling (Client & Server) | 9 | Low | S | ~0.5d | — | PRD | — | Produces: PRD-049 | Not Started |
| 50 | Prometheus Metrics Endpoint | 10 | Low | S | ~0.5d | — | PRD | C4 (observability) | Produces: PRD-050 | Not Started |
| 51 | Prometheus & Grafana Stack | 10 | Low | S | ~0.5d | Metrics Endpoint | PRD | — | Depends: PRD-050 · Produces: PRD-051 | Not Started |
| 52 | Swagger API Documentation | 10 | Low | S | ~0.5d | — | PRD | — | Produces: PRD-052 | Not Started |
| 53 | Cross-cutting UI/A11y Patterns (Theme, Modals, Form A11y, Keyboard Nav, Loading UI, Responsive) — grouped | 11 | Low | M | ~1.5d | — | One shared PRD | — | Produces: PRD-053 | Not Started |

*Infrastructure-only items (DB Seeding, Env Config, OpenAPI Generation, Prisma Studio, Migrations, Docker Compose, npm Workspaces) are parked, not documented in this pass — see decision below.*

---

## Phase summary

| Phase | Theme | Feature count | Rationale |
|-------|-------|---------------|-----------|
| 0 | Foundation | 1 | Vision/glossary/domain model referenced by every later phase |
| 1 | Identity & Access foundation | 8 | Everything else needs auth/session/role model defined first |
| 2 | User & Admin management | 7 | Builds directly on Phase 1 primitives |
| 3 | Wallets & balance mechanics | 5 | Core money model; trading and funding both depend on it |
| 4 | Deposits & funding | 4 | Needs wallets + payment methods |
| 5 | Trading & order lifecycle | 9 | The most complex domain; needs wallets, balance locking, and ticker WS |
| 6 | Portfolio, markets & visualization | 7 | Read-only views over Phases 3–5 data |
| 7 | Transactional email | 5 | Cross-cutting notification layer over Phases 1–5 |
| 8 | Admin inspection surfaces | 1 (grouped) | Read-only admin views over everything prior |
| 9 | QA testing utilities | 3 | Independent, low priority |
| 10 | Observability & API docs | 3 | Independent, low priority |
| 11 | Cross-cutting UI/accessibility patterns | 1 (grouped) | Documented once, referenced everywhere |

**Total: 54 backlog entries** (Foundation + 53, some grouped) covering all 35+ features named in the inventory summary.

---

## Decisions locked in

1. **Tooling/infrastructure items** — skipped in this pass. If needed later, captured as a single "Development Environment & Tooling" ADR set (architecture concern, not product).
2. **Grouped PRDs** — rows 46 and 53 are intentionally bundled (admin inspection endpoints; cross-cutting UI/a11y patterns) rather than split one-per-feature.
3. **Execution trigger** — one feature at a time: pipeline → review → fix → user approval → next feature. No unattended full-phase runs.
