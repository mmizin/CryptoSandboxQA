# Architecture Review Findings — Temporary Registry

**Status:** Temporary. This file is a stopgap source of truth until
`architecture-toolkit` supports first-class generated findings files (target
shape: `docs/architecture/findings/INDEX.md` + one `FINDING-NNNN.md` per
finding). Do not delete this file's history when that lands — migrate it.

**Purpose:**
- Capture every issue surfaced by an `architecture-reviewer` pass, or by a
  targeted manual audit run in response to one, so nothing is lost when the
  ADR it applies to gets reworked.
- Findings are never deleted once fixed — they're marked Resolved with a
  link to what actually changed, so the reasoning stays auditable.

## Finding schema

Every finding uses these fields, in this order:

| Field | Meaning |
|---|---|
| **Finding ID** | `FINDING-NNNN`, permanent, never reused or renumbered |
| **Severity** | Conflict (High/Medium) / Gap (High/Medium) / Info / Recommendation |
| **Category** | Architecture / Security / Observability / Correctness / Completeness / Documentation |
| **Detected by** | Which review pass or audit produced it (person or process, e.g. `architecture-reviewer`, manual audit) |
| **Affected artifact** | The ADR/PRD/doc the finding applies to |
| **Decision** | What was decided in response — the fix chosen, or explicitly "not fixed here, tracked separately" |
| **Status** | Open / In Progress / Resolved |
| **Resolution** | What actually changed, with a pointer to the artifact section |
| **Verification** | How the resolution was/will be checked — currently manual inspection + re-review for everything below, since no automated test suite exists in this repo. Update this field once real tests exist for the relevant code paths. |

---

## FINDING-0001 — Global P2002 filter has undercounted blast radius

- **Severity:** Conflict, High
- **Category:** Architecture / Observability
- **Detected by:** `architecture-reviewer` (review pass on ADR-0008/0009, 2026-07-25)
- **Affected artifact:** ADR-0008 (duplicate-email registration race handling)
- **Decision:** Reject the global-`ExceptionFilter` mechanism entirely; scope translation to `UsersService` instead.
- **Status:** Resolved
- **Description:** ADR-0008's Option C (Revision 1) proposed a global
  `ExceptionFilter` translating any Prisma `P2002` to `409 Conflict`. The
  schema carries at least 10 unique constraints, not the 1 extra case
  (`UserProfile.username`) the ADR considered — including
  `UserBalance @@unique([userId, assetId])`, which sits inside the
  settlement path `CLAUDE.md` calls "critical for testing." A global filter
  would silently convert a loud 500 (a real balance-accounting bug) into a
  quiet 409 there — an observability regression in the highest-stakes code
  path in the app, introduced as a side effect of a registration-scoped fix.
- **Resolution:** ADR-0008 revised (Revision 1) to reject the global-filter
  mechanism. Duplicate-email/username translation scoped to `UsersService`
  (the user-domain boundary) instead of an app-wide exception filter.
  Unrelated `P2002` violations (balances, profiles, 2FA) explicitly left
  unhandled by this decision, continue to surface as 500s. See
  `docs/architecture/adr/0008-duplicate-email-registration-race-handling.md`
  §"Decision" and §"Alternatives Rejected".
- **Verification:** Manual inspection of the revised Decision section;
  re-review by `architecture-reviewer` pending. No automated test exists to
  assert `UserBalance` P2002s still surface as 500s — recommend adding one
  when test infrastructure is reinstated.

## FINDING-0002 — Global filter breaks an existing internal exception-type contract

- **Severity:** Conflict, High
- **Category:** Correctness
- **Detected by:** `architecture-reviewer` (review pass on ADR-0008/0009, 2026-07-25)
- **Affected artifact:** ADR-0008
- **Decision:** Preserve `ConflictException` as the thrown type for the internal caller by moving translation into `UsersService` itself (same fix as FINDING-0001).
- **Status:** Resolved
- **Description:** `AuthService.bulkImportUsersFromFile()` calls
  `createUserWithProfileAsAdmin()` in-process and catches the result with
  `if (e instanceof ConflictException)` to distinguish a `skipped` row from
  a `failed` row (`auth.service.ts:419-435`). A NestJS `ExceptionFilter`
  only intercepts exceptions that propagate out through the HTTP layer —
  it never runs for this in-process call. ADR-0008's original Decision
  claimed the global filter "fixes all 5 current call sites... in one
  place," which is false for this internal consumer.
  Investigated for prior intent per explicit direction: no tests exist
  (test infrastructure was removed repo-wide, see `1d642ae`/`003842a`),
  but the code itself (`created`/`skipped`/`failed` three-way status
  split, introduced deliberately in commit `e6c4f7d`, "implement bulk user
  import and export functionality") is clear evidence this exception-type
  branching is a real, load-bearing response contract, not incidental —
  confirmed to be treated as an existing constraint regardless of original
  design intent.
- **Resolution:** ADR-0008 revised (Revision 1) — decision no longer
  relies on an HTTP-layer mechanism. The `UsersService`-level translation
  (FINDING-0001's resolution) preserves `ConflictException` as the thrown
  type for both the HTTP call site and the internal
  `bulkImportUsersFromFile` caller, since both go through the same service
  method.
- **Verification:** Manual trace of the call graph confirms both callers
  now go through the same `UsersService` method and would receive the same
  exception type. No automated test exists to assert this at build time;
  recommend one when test infrastructure returns.

## FINDING-0003 — "Constraint is authoritative" claim ignores an application-level normalization invariant

- **Severity:** Gap, Medium
- **Category:** Correctness / Documentation
- **Detected by:** `architecture-reviewer` (review pass on ADR-0008/0009, 2026-07-25)
- **Affected artifact:** ADR-0008
- **Decision:** Document the real source of truth (application-level normalization) rather than overclaiming the DB constraint; note `citext`/functional-index as an optional follow-up, not required now.
- **Status:** Resolved
- **Description:** ADR-0008 argued the DB `@unique` constraint on
  `User.email` is "authoritative... Postgres itself is the serialization
  point, not application logic." `User.email` is a plain, case-*sensitive*
  unique index; case-insensitive uniqueness (required by BR-002) is
  currently upheld only by scattered `.toLowerCase()` calls in
  `users.service.ts`. A write path that forgot to lowercase would satisfy
  the DB constraint while violating BR-002, and no filter or handler keyed
  to the constraint would ever catch it.
- **Resolution:** ADR-0008 revised (Revision 1) to state the real source
  of truth explicitly: case-insensitive uniqueness is an application-level
  normalization invariant, not a database-level guarantee. The DB unique
  constraint is authoritative only for exact-string duplicates.
  `citext`/functional-index identified as the migration that would close
  this gap at the schema level, left as a named follow-up.
- **Verification:** Manual inspection of the revised ADR text. No
  automated test asserts the normalization discipline holds across all
  write paths; this remains a standing risk (see ADR-0008 Risks).

## FINDING-0004 — Timeout change regresses password-reset anti-enumeration guarantee

- **Severity:** Conflict, High
- **Category:** Security
- **Detected by:** `architecture-reviewer` (review pass on ADR-0008/0009, 2026-07-25)
- **Affected artifact:** ADR-0009 (notification delivery boundary on request path)
- **Decision:** Bring `sendPasswordResetCode` into this ADR's scope; wrap it with the same catch-and-log pattern as the other four methods.
- **Status:** Resolved
- **Description:** ADR-0009 asserted "a failed send never fails the
  caller's request" across all 5 `MailService` methods it named, including
  `sendPasswordResetCode`. That method has no try/catch
  (`mail.service.ts:53-60`) — its caller, `requestPasswordReset`
  (`auth.service.ts:109`), awaits it unguarded. That method's own comment
  states its purpose: *"Same response whether or not the email exists
  (avoid account enumeration)."* Under ADR-0009's original decision (add
  timeouts to the shared transport), a slow SMTP host would newly convert
  what is today a hang into a thrown error specifically on this path,
  producing: unknown email → 200 generic; known email → 500. That widens
  an account-enumeration side channel from "SMTP down" (rare) to "SMTP
  slow" (far more common).
- **Resolution:** ADR-0009 revised. `sendPasswordResetCode` explicitly
  brought in scope, wrapped with the same catch-and-log pattern already
  used by the other 4 `send*Email` methods, so a timeout there is logged
  internally but never changes the caller-visible response. Identical
  external behavior regardless of whether the email exists stated as a
  hard constraint, not a follow-up.
- **Verification:** Manual inspection of the revised Decision section
  (`docs/architecture/adr/0009-...md` §"Bringing `sendPasswordResetCode` in scope").
  No automated test currently asserts the anti-enumeration property;
  recommend one (assert identical response shape/timing-class for known
  vs. unknown email under simulated SMTP timeout) when test infrastructure
  is reinstated.

## FINDING-0005 — "Bounded worst case" overstates nodemailer's actual timeout guarantees

- **Severity:** Gap, Medium-High
- **Category:** Correctness / Documentation
- **Detected by:** `architecture-reviewer` (review pass on ADR-0008/0009, 2026-07-25)
- **Affected artifact:** ADR-0009
- **Decision:** State precisely what is and isn't bounded; note outer wall-clock deadline as a follow-up, not required now.
- **Status:** Resolved
- **Description:** ADR-0009's Decision claimed the chosen timeouts
  (`connectionTimeout`, `greetingTimeout`, `socketTimeout`) produce "a
  bounded worst case instead of an unbounded one." In fact `connectionTimeout`
  doesn't cover DNS resolution, and `socketTimeout` is an *inactivity*
  timeout, not a wall-clock deadline — a server that emits any byte before
  each interval elapses resets the timer indefinitely.
- **Resolution:** ADR-0009 revised to state precisely what is bounded (a
  host that accepts a connection and goes fully idle) versus what isn't
  (DNS hangs, periodic-keepalive-without-progress), with an outer
  wall-clock deadline noted as a follow-up if those gaps prove to matter,
  not required by this ADR.
- **Verification:** Manual inspection of the revised Decision/Consequences
  sections. No automated test currently exercises either bounded or
  unbounded failure modes against a real or mocked SMTP host; recommend
  one when test infrastructure returns.

## FINDING-0006 — Stale references in ADR-0006 to removed testing infrastructure

- **Severity:** Info, Recommendation
- **Category:** Documentation
- **Detected by:** `architecture-reviewer` (review pass on ADR-0008/0009, 2026-07-25)
- **Affected artifact:** ADR-0006 (Playwright UI testing) — not part of this feature's rework
- **Decision:** Not fixed here — out of scope for the Registration feature pass. Flagged for `architecture-librarian`'s next repo-wide consistency audit.
- **Status:** Open
- **Description:** ADR-0006's References section points at
  `tests/ui-tests/` and `CLAUDE.md § Testing`, both removed by the
  repo-wide testing-infrastructure removal (`1d642ae`/`003842a`).
- **Resolution:** N/A — not yet actioned.
- **Verification:** N/A.

## FINDING-0007 — ADR template divergence across the collection

- **Severity:** Info
- **Category:** Documentation
- **Detected by:** `architecture-reviewer` (review pass on ADR-0008/0009, 2026-07-25)
- **Affected artifact:** ADR collection as a whole (`docs/architecture/history/legacy-adr/` 0001-0007, `docs/architecture/adr/` 0008-0009)
- **Decision:** Not fixed here — a repo-wide template migration is a separate, dedicated consistency pass, not part of this feature's ADRs.
- **Status:** Partially resolved — consolidation question closed (2026-07-25); template divergence remains open
- **Description:** ADR-0008/0009 (in `docs/architecture/adr/`, per the
  documentation plan's location convention) use the newer
  `architecture-toolkit` template (Decision Drivers / Assumptions /
  Considered Options / Risks); ADR-0001–0007 (originally in `old-docs/adr/`,
  now archived at `docs/architecture/history/legacy-adr/`) use an
  older shape (Rationale / Pros / Cons / Mitigation strategies). Two open
  questions were raised: the template divergence, and whether the ADR collection
  should be fully consolidated into `docs/architecture/adr/` or intentionally split.
- **Resolution:** The consolidation question is resolved by explicit user
  decision (2026-07-25): the collection is intentionally split. ADR-0001–0007
  are archived as historical reference only (not part of the active ADR
  baseline, not renumbered, not migrated to the new template) at
  `docs/architecture/history/legacy-adr/`, clearly marked as such in that
  directory's `README.md`. `docs/architecture/adr/` (0008+) is the sole active
  baseline going forward. The template-divergence question remains genuinely
  open — the legacy archive is intentionally left in its original format
  since it is historical, not being migrated.
- **Verification:** Directory structure and cross-references verified via
  repo-wide grep after the 2026-07-25 migration (see
  `docs/architecture/adr/README.md` and
  `docs/architecture/history/legacy-adr/README.md`).

## FINDING-0008 — PRD-043 timing affects ADR-0009's proportionality argument

- **Severity:** Gap (open question, not a defect)
- **Category:** Documentation / Architecture
- **Detected by:** `architecture-reviewer` (review pass on ADR-0008/0009, 2026-07-25)
- **Affected artifact:** ADR-0009
- **Decision:** Named as the specific trigger for revisiting ADR-0009's Option A vs. Option C choice, in the ADR's Risks section. Not resolvable from this codebase alone.
- **Status:** Open — owner TBD
- **Description:** Whether `PRD-043` (Welcome Email — Registration) is
  expected to state a real delivery guarantee soon materially affects how
  long ADR-0009's "defer Option C" proportionality argument holds.
- **Resolution:** N/A — depends on `PRD-043`, not yet produced.
- **Verification:** N/A — re-evaluate when `PRD-043` is drafted.

## FINDING-0009 — `UsersService` write-method whitelist in ADR-0008 was not exhaustive

- **Severity:** Gap, High
- **Category:** Completeness / Correctness
- **Detected by:** Manual exhaustiveness audit, requested explicitly in response to ADR-0008 Revision 1 ("a whitelist is only as good as its completeness, verify it"), 2026-07-25
- **Affected artifact:** ADR-0008
- **Decision:** Expand the whitelist from 3 to 5 methods; extend coverage from `email` alone to `email` **and** `username`; state a governing rule (not just an enumerated list) so future additions can be checked by inspection.
- **Status:** Resolved
- **Description:** ADR-0008 Revision 1 scoped its fix to `create`,
  `createWithProfile`, and `replaceByAdmin`. An audit of every
  `prisma.user.*`/`prisma.userProfile.*` write in `backend/src` found two
  more real, live gaps: (1) `UsersService.updateByAdmin()` also writes
  `email` with the same racy pre-check pattern and no `P2002` handling —
  missing entirely from the whitelist; (2) `UserProfile.username` is also
  `@unique`, written by three methods, of which only `createWithProfile`
  ever checked availability before writing —
  `UsersService.updateProfile()` (the self-service profile endpoint)
  writes `username` via `upsert()` with **no pre-check of any kind**,
  meaning an ordinary sequential duplicate-username submission produces an
  unhandled 500 today, independent of any race condition. Two other write
  surfaces were checked and confirmed out of scope: the generic
  `UsersService.update()` has no callers (dead code), and the
  `backend/prisma/seed-*.js` scripts run outside the NestJS/HTTP runtime
  entirely.
- **Resolution:** ADR-0008 Revision 2. Decision expanded to cover 5
  methods (`create`, `createWithProfile`, `updateByAdmin`,
  `replaceByAdmin`, `updateProfile`) and both unique fields (`email`,
  `username`). A governing rule is stated explicitly in the Decision
  section so a future reviewer can check new code against a rule rather
  than a list that will silently drift again. The Risks section elevates
  whitelist-completeness to a named, standing risk rather than a one-time
  disadvantage, citing this finding's own 3→5 growth as direct evidence.
- **Verification:** Manual `grep` audit of all `prisma.user.*`/
  `prisma.userProfile.*` call sites in `backend/src`, cross-checked against
  all callers of the five `UsersService` methods. No automated test
  currently enforces the governing rule; recommend a lint rule or test
  that fails if a new `UsersService` write to `email`/`username` lacks a
  `P2002` catch, once test infrastructure is reinstated.

## FINDING-0010 — Pre-existing plaintext secret logging in the no-SMTP-host mail fallback

- **Severity:** Gap, Medium (pre-existing behavior, not introduced by ADR-0009, but surfaced while verifying ADR-0009's logging safety)
- **Category:** Security
- **Detected by:** Manual logging-safety audit, requested explicitly in response to ADR-0009's new catch-and-log clause ("check the logging path is safe, not just that a caller-visible response stays the same"), 2026-07-25
- **Affected artifact:** ADR-0009 (named, not fixed) / `MailService.deliver()` (the actual code)
- **Decision:** Not fixed by ADR-0009 — named explicitly in that ADR's Risks section as a pre-existing, adjacent risk, requiring its own separate decision if it's to change.
- **Status:** Open
- **Description:** `MailService.deliver()`'s no-SMTP-host fallback
  (`mail.service.ts:31`) logs the entire message body —
  `To: ${to}\nSubject: ${subject}\n${text}` — via `this.logger.log(...)`.
  For `sendPasswordResetCode`, `text` contains the plaintext reset code.
  This is documented, intentional behavior for local development without
  SMTP configured (`CLAUDE.md`: "MailService logs message body to backend
  terminal instead of sending"), and applies to every notification type
  identically. It predates and is unrelated to ADR-0009's timeout change.
  Verified as a real, current behavior — not hypothetical — by reading
  `deliver()` directly.
  ~~Separately verified: the *new* catch-and-log clause ADR-0009 adds for
  `sendPasswordResetCode`'s error path does **not** have this problem — it
  follows the existing convention of logging only `to` and the caught
  error object, never `text`. That part is confirmed safe by construction
  and stated explicitly in ADR-0009.~~ **Superseded by FINDING-0016:**
  that claim was true against the mechanism as it stood *before* Option D
  was adopted (a per-method catch clause). Once the catch moved into
  `deliver()` itself, the claim no longer held — see FINDING-0016 for the
  corrected analysis and fix. Left here, struck through rather than
  deleted, per this registry's own no-deletion rule.
- **Resolution:** Not resolved. This finding documents a pre-existing
  trade-off (local-dev convenience vs. plaintext secrets in logs) that
  ADR-0009 does not own and should not silently absorb into its own scope.
  Needs its own decision: acceptable as-is for a QA-training sandbox
  (arguably reasonable, given `CLAUDE.md` already documents it as
  intentional), or worth redacting (e.g. mask the code before logging)
  regardless of environment.
- **Verification:** N/A — open, no decision made yet.

## FINDING-0011 — ADR-0008's fix didn't satisfy FC-001: pre-check and race-path threw different status codes

- **Severity:** Conflict, High
- **Category:** Correctness
- **Detected by:** `architecture-reviewer` (re-review pass on ADR-0008 Revision 2, 2026-07-25)
- **Affected artifact:** ADR-0008
- **Decision:** Change `register()`, `createAdmin()`, and `registerWithProfile()`'s pre-check throws from `UnauthorizedException` (401) to `ConflictException` (409), matching what the `UsersService`-level catch already produces.
- **Status:** Resolved
- **Description:** Revision 2's Decision claimed "both paths throw the same
  exception type," while `register()`/`createAdmin()`/`registerWithProfile()`
  still threw `UnauthorizedException` (401) from their pre-checks and the
  new `UsersService`-level catch threw `ConflictException` (409). A
  sequential duplicate got 401; a raced duplicate got 409 — exactly the
  timing-dependent outcome `PRD-Registration` FC-001 (Must-level) forbids.
  The ADR's own text conceded this in a parenthetical immediately after
  asserting the opposite, deferring the whole question to Q-004 — but
  Q-004 is about *disclosure posture* (anti-enumeration), not license to
  leave two paths disagreeing on status code.
- **Resolution:** ADR-0008 Revision 3. The three `AuthService` pre-check
  throws are changed to `ConflictException`, so pre-check and race-path
  always agree. `409` chosen as the interim unified code because it's what
  the `UsersService` catch already produces. Q-004's separate,
  still-open question (whether to move away from confirming existence at
  all) is explicitly noted as a further change layered on top, not blocked
  by or resolved by this fix. New Consequences bullet added: API contract
  change on `register()` (401→409) plus the two admin endpoints gaining a
  second 409 reason; `openapi.json` needs regenerating.
- **Verification:** Manual re-trace of all three `AuthService` pre-check
  call sites confirms they'd now throw the same type as the
  `UsersService`-level catch. No automated test currently asserts FC-001's
  "indistinguishable outcome under race" property; recommend one (assert
  identical status/body for sequential vs. simulated-concurrent duplicate
  registration) once test infrastructure is reinstated.

## FINDING-0012 — ADR-0008's catch could translate the wrong Prisma constraint in `upsert`-based methods

- **Severity:** Gap, High
- **Category:** Correctness / Observability
- **Detected by:** `architecture-reviewer` (re-review pass on ADR-0008 Revision 2, 2026-07-25)
- **Affected artifact:** ADR-0008
- **Decision:** Add an explicit `meta.target` discrimination rule to the Decision — only translate `P2002` to `ConflictException` when the target is `email` or `username`; re-throw anything else (specifically `UserProfile.userId`) untouched.
- **Status:** Resolved
- **Description:** `updateProfile`, `updateByAdmin`, and `replaceByAdmin`
  all call `userProfile.upsert({ where: { userId }, ... })`, and
  `UserProfile.userId` is itself `@unique` (`schema.prisma:43`). A
  concurrent upsert race can throw `P2002` on `userId` — an internal
  one-profile-per-user invariant violation, not a user-correctable
  input conflict. Revision 2's Decision only discussed `meta.target` in
  the context of picking the right *message* (email vs. username), never
  stating the rule that a non-`email`/`username` target must not be
  translated at all. Left unstated, this recreates at `UsersService`
  scope exactly the blast-radius mistake Option B was rejected for at app
  scope (FINDING-0001): converting a loud, correct 500 into a quiet,
  misleading 409.
- **Resolution:** ADR-0008 Revision 3. Decision now states the
  discrimination rule explicitly, naming `UserProfile.userId` as the
  concrete case it must exclude. Also surfaced and fixed in the same pass:
  `updateByAdmin`'s profile-then-email writes were unwrapped (unlike
  `replaceByAdmin`'s), so adding the catch without transactional wrapping
  would let a race leave a partial write (profile committed, email
  rejected) where today a 409 always means nothing changed — now requires
  wrapping both writes in `prisma.$transaction`, matching `replaceByAdmin`.
- **Verification:** Manual review of all three `upsert` call sites and
  their surrounding write structure. No automated test currently exercises
  a `P2002` on `UserProfile.userId` specifically to confirm it surfaces as
  a 500, not a 409; recommend one once test infrastructure is reinstated.

## FINDING-0013 — ADR-0009's anti-enumeration fix closes the content oracle but not the timing oracle

- **Severity:** Gap, Medium
- **Category:** Security
- **Detected by:** `architecture-reviewer` (re-review pass on revised ADR-0009, 2026-07-25)
- **Affected artifact:** ADR-0009
- **Decision:** Qualify the claim to response content/status only; record the timing channel as a known, un-closed gap, structural to Option A, requiring a product-posture judgment rather than an architectural fix.
- **Status:** Resolved (claim corrected) — **superseded by FINDING-0017:** "remains open by design" below was accurate as of this finding, but the timing channel was substantially narrowed (not fully closed) by FINDING-0017's A+D+B re-evaluation in the next review pass. See FINDING-0017 for the current state.
- **Description:** ADR-0009's fix for `sendPasswordResetCode` (catch and
  log, never propagate) equalizes response *content and status* between a
  known and unknown email. It does not equalize *timing*: under the exact
  failure mode this ADR targets (a stalled SMTP host), the known-email
  path now blocks for up to the configured timeout before responding,
  while the unknown-email path returns immediately. That latency
  difference is itself a measurable signal of account existence. The
  original revised ADR's language ("identical external behavior") implied
  this was closed; it wasn't.
- **Resolution:** ADR-0009 Decision section corrected to state precisely
  what's closed (content/status) versus what remains open (timing), with
  the reasoning that Option A cannot close it by construction (the send
  stays synchronous and on the response path) — only Option B or C would,
  and both are rejected for independent reasons. Consequences/Negative and
  Risks sections both record this as an accepted, named residual, framed
  explicitly as a product-posture judgment ("acceptable for a QA-training
  sandbox") rather than an architectural decision this ADR has unilateral
  authority to make.
- **Verification:** Manual trace of `requestPasswordReset()`'s two return
  paths confirms the timing asymmetry exists as described. No automated
  test currently measures response-time parity between known/unknown
  email under simulated SMTP delay; recommend one if the timing channel's
  risk tolerance is ever revisited.

## FINDING-0014 — ADR-0009 never evaluated moving the failure-handling guarantee into `deliver()` itself

- **Severity:** Gap, Medium
- **Category:** Architecture
- **Detected by:** `architecture-reviewer` (re-review pass on revised ADR-0009, 2026-07-25)
- **Affected artifact:** ADR-0009
- **Decision:** Add a fourth considered option (Option D — move the catch-and-log wrapper into `deliver()` itself); adopt it in combination with Option A.
- **Status:** Resolved
- **Description:** The "failure never reaches the caller" guarantee lived
  in each `send*Email` method's own try/catch, not in the shared
  `deliver()` method all of them call — a per-method whitelist with the
  same drift risk ADR-0008 needed two revisions to close (FINDING-0009).
  `sendPasswordResetCode` (FINDING-0004) is direct proof this whitelist
  already drifted once. ADR-0009's Considered Options never evaluated
  moving the guarantee into the shared method, which would make it
  structural instead of repeated.
- **Resolution:** ADR-0009 revised to add Option D and adopt it combined
  with Option A: timeouts on the transport (Option A) plus the
  catch-and-log wrapper moved inside `deliver()` (Option D), so every
  current and future caller gets the guarantee automatically. No current
  caller needs a mail failure to propagate (verified: all methods either
  already swallow, or per this ADR now must), so Option D's only
  disadvantage — foreclosing that per-caller choice — costs nothing today
  and is named as the thing to revisit if a future notification
  genuinely needs it.
- **Verification:** Manual review of all 5 current `MailService` methods
  confirms none rely on a failure propagating to their caller today. No
  automated test currently enforces that a new `send*Email` method
  automatically inherits the guarantee (this is now true by construction
  once implemented, not by convention, so the main future risk this
  finding addressed is structurally closed rather than needing ongoing
  verification).

## FINDING-0015 — ADR-0008's status-code fix was incomplete: message text unified, but not registerWithProfile's username throw, plus stale Context claims

- **Severity:** Conflict, High (message text) + Gap, Medium (username coverage) + Conflict, Low (stale count/claim)
- **Category:** Correctness / Documentation
- **Detected by:** `architecture-reviewer` (third review pass on ADR-0008 Revision 3, 2026-07-25)
- **Affected artifact:** ADR-0008
- **Decision:** Unify message text (not just status code) to `AuthService`'s existing wording; explicitly cover `registerWithProfile`'s username pre-check; correct Context's stale transaction count and overbroad "all five share one shape" claim.
- **Status:** Resolved
- **Description:** Revision 3 unified the *status code* (401→409) but FC-001
  concerns the whole visitor-facing outcome, and two different message
  strings existed for the same logical condition (`'Email already
  registered'` in `AuthService` vs. `'Email already in use'` in
  `UsersService`) — a matching code with different text is still a
  distinguishable outcome. Separately, `registerWithProfile`'s
  username-uniqueness pre-check (`auth.service.ts:267`,
  `UnauthorizedException('Username already taken')`) was not explicitly
  named among the pre-checks being converted, and could be missed by an
  implementer reading only the email-focused surrounding text. Also found:
  Context ¶1 said "three of the five... use `$transaction`" (only two do)
  and "all five follow the same shape" (contradicted by the audit two
  paragraphs later, which found `updateProfile` has no pre-check shape at
  all).
- **Resolution:** ADR-0008 Revision 4. `AuthService`'s existing wording
  adopted as canonical for the `UsersService`-level catch to re-throw.
  `registerWithProfile`'s username pre-check named explicitly as the
  fourth throw being converted. Context rewritten to state the correct
  count and drop the contradicted claim, and to disambiguate "five call
  sites" from "five `UsersService` methods" (two different sets that
  share a size). Consequences' API-contract bullet expanded from 3 to 5
  endpoints, with the frontend-consumer verification (no status-code
  branching anywhere in `frontend/`) stated explicitly rather than
  implied. Also added in this pass: a Risk naming that the `meta.target`
  discrimination rule fails *closed* (wrong assumption → silent no-op, not
  a loud failure), and a note on `updateProfile`'s write-ordering
  dependency (safe today only because the throwing write happens first,
  unlike `updateByAdmin` which needed explicit transaction wrapping).
- **Verification:** Manual review of all message strings and pre-check
  call sites referenced in the ADR against the current code. No automated
  test currently asserts message-text parity across the five converted
  throws; recommend one once test infrastructure is reinstated.

## FINDING-0016 — ADR-0009's secret-logging safety rule was attached to a catch clause Option D had already removed

- **Severity:** Conflict, High
- **Category:** Security
- **Detected by:** `architecture-reviewer` (third review pass on revised ADR-0009, 2026-07-25)
- **Affected artifact:** ADR-0009
- **Decision:** Restate the logging-safety rule against `deliver()` itself — the actual location of the catch after Option D's adoption — naming the exact fields allowed to be logged for all five callers, not just `sendPasswordResetCode`.
- **Status:** Resolved
- **Description:** Revision 2 adopted Option D (move the catch into
  `deliver()`) but its secret-logging safety verification was still
  written against "`sendPasswordResetCode`'s new catch clause" — a
  per-method clause that no longer exists under D. The catch now lives
  inside `deliver()`, which is the one function with `text` (the full
  message body, including the plaintext reset code) as a local variable —
  four lines below the pre-existing full-body log already flagged as
  FINDING-0010. The most natural implementation of "log what failed to
  send" at that location logs `text`, which would leak the reset code on
  every failure — the exact outcome the original rule existed to prevent,
  now unguarded because the guard-rail didn't move with the mechanism it
  was guarding.
- **Resolution:** ADR-0009 Revision 3. Safety rule restated against
  `deliver()`'s catch directly: log only `to`, `subject`, and the error's
  `message`/`code` fields; never `text`, for any of the five callers, not
  only the one that motivated the original rule. Two stale Consequences
  bullets that still referenced "the new `sendPasswordResetCode` catch
  clause" corrected to describe the `deliver()`-level guarantee.
- **Verification:** Manual review of the restated rule's location against
  where Option D actually places the catch. No automated test currently
  asserts the catch never logs `text`; recommend one (assert log output
  never contains the value passed as `text`/message body) once test
  infrastructure is reinstated — this is the single highest-value test
  this findings registry has identified across all 17 findings, given
  what a regression here would leak.

## FINDING-0017 — ADR-0009 never re-evaluated Option B after Option D neutralized its stated objections, leaving the timing oracle open unnecessarily

- **Severity:** Gap, High
- **Category:** Security / Architecture
- **Detected by:** `architecture-reviewer` (third review pass on revised ADR-0009, 2026-07-25)
- **Affected artifact:** ADR-0009
- **Decision:** Adopt Option B narrowly for `sendPasswordResetCode()`'s call site only, closing the timing oracle for password reset specifically, while keeping the other four methods synchronous for a stated determinism reason (Mailpit visibility on response, relevant to this being a QA-training tool).
- **Status:** Resolved
- **Description:** Option B (fire-and-forget) was rejected using two
  objections — weakens failure-logging unless replicated per site; bounds
  nothing — both of which Option D's adoption (moving the catch into
  `deliver()`, making it non-rejecting) already neutralizes for any caller
  that stops awaiting it. This was never re-examined after D was adopted.
  Concretely, this meant FINDING-0013's timing oracle (known email
  measurably slower than unknown email under the targeted failure mode —
  and, found in this same pass, present under *normal* operation too, not
  only the failure mode) was left open despite the cheapest fix already
  being implied by the ADR's own adopted mechanism.
- **Resolution:** ADR-0009 Revision 3. Added "Re-evaluating Option B under
  the adopted A+D combination" section. Decision now applies Option B
  narrowly to `requestPasswordReset()`'s call to `sendPasswordResetCode()`
  only — safe specifically because Option D makes `deliver()`
  non-rejecting for that caller. The other four methods stay synchronous,
  with an explicit, previously-unstated reason (training-tool determinism:
  Mailpit shows the email the moment the triggering response returns).
  Timing-oracle risk in ADR-0009's Risks section updated from "open,
  needs a product-posture call" to "resolved" for password reset
  specifically, with a new, narrower risk noted: the fix's safety depends
  on `deliver()` remaining non-rejecting, which should stay visible to
  future maintainers of that method.
- **Verification:** Manual trace of `requestPasswordReset()`'s two return
  paths confirms both would now return without waiting on the mail send.
  No automated test currently measures response-time parity between
  known/unknown email; recommend one to confirm the fix in practice, not
  just in the code path, once test infrastructure is reinstated.

## FINDING-0018 — ADR-0009's fourth-pass residuals: stale section, unqualified rejection, timing-oracle overclaim, unspecified catch scope, unstated determinism cost

- **Severity:** Conflict, Medium (×2) + Gap, Medium (×3)
- **Category:** Documentation / Security
- **Detected by:** `architecture-reviewer` (fourth, intended-final review pass, 2026-07-25)
- **Affected artifact:** ADR-0009
- **Decision:** Five targeted edits; no re-decision — both adopted mechanisms (A+D composition; narrow B for `sendPasswordResetCode`) were independently re-verified against the actual code and confirmed correct.
- **Status:** Resolved
- **Description:** (1) The "Correcting an overclaim" section describing
  the pre-Revision-3 mechanism was never updated to past tense after
  Revision 3 adopted narrow Option B, and read as contradicting the
  Decision it precedes. (2) The Decision section's rejection of Option B
  ("Chosen over Option B because...") was unqualified, contradicting the
  narrow adoption twenty lines earlier in the same section. (3) "Closes
  the password-reset timing oracle" / "returns in comparable time" was
  itself an overclaim — verified against `auth.service.ts:109-140` that
  two DB round trips (`deleteMany`, `create`) remain exclusive to the
  known-email path after removing the `await`; the SMTP round trip (the
  dominant component) is removed, not the entire channel. (4) The
  logging-safety rule specified what the `deliver()` catch may log but not
  what it must *enclose* — verified that transport construction
  (`Number(SMTP_PORT)`, `createTransport`) runs before `sendMail` and
  could throw unguarded if the catch is scoped too narrowly. (5) The
  Mailpit-determinism reasoning used to justify keeping four methods
  synchronous was never applied to password reset, the one flow where
  reading the inbox is mandatory — the cost of making it asynchronous went
  unstated.
- **Resolution:** All five addressed directly in the ADR text: the stale
  section marked as historical/superseded; the Decision's Option B
  rejection qualified to "applied to all five methods"; the timing-oracle
  claim corrected to "narrows by orders of magnitude, does not fully
  close," with the residual named; a new paragraph requires the
  `deliver()` catch to wrap the entire method body, not just `sendMail`;
  a new Consequences/Negative bullet states the determinism cost password
  reset now carries. Revision header updated to flag this as a fourth,
  claim-scoping-only pass.
- **Verification:** Manual re-trace of `requestPasswordReset()`'s full
  control flow (all statements between the `findByEmail` branch and the
  `return`) confirms the two DB round trips are real and unavoidable under
  this decision. Manual review of `mail.service.ts:24-51` confirms the
  pre-`sendMail` throwing code exists as described. No automated test
  exists for either; both recommended once test infrastructure returns.

## FINDING-0019 — ADR-0008's fourth-pass residual: admin-endpoint pre-check/race-path divergence outside FC-001's scope, plus endpoint-count and openapi corrections

- **Severity:** Conflict, Medium (×2) + Conflict, Low
- **Category:** Correctness / Documentation
- **Detected by:** `architecture-reviewer` (fourth, intended-final review pass, 2026-07-25)
- **Affected artifact:** ADR-0008
- **Decision:** Scope the "every path" claim to FC-001's actual surface (registration, not admin); record the admin-endpoint residual explicitly; correct endpoint count to six; correct the openapi note to require adding decorators before regeneration.
- **Status:** Resolved
- **Description:** (1) "Every path this decision touches... now throws
  the same type with the same message" was false for the two admin
  endpoints: `updateByAdmin`/`replaceByAdmin` keep their
  `ensureEmailAvailable` pre-check (`'Email already in use'`) while their
  own `UsersService`-level catch is required to re-throw the canonical
  `'Email already registered'` wording — the identical pre-check/race-path
  divergence this decision exists to eliminate, recreated on a surface it
  doesn't cover. Not an FC-001 violation (FC-001 governs the anonymous
  registration flow, not admin endpoints) and no consumer branches on it,
  but the universal claim was still false. (2) "API contract change on
  five live endpoints" enumerated six. (3) "`openapi.json` needs
  regenerating" undersold the work — three controllers currently document
  no conflict response at all; decorators must be added before
  regeneration produces anything.
- **Resolution:** ADR-0008 Revision 5. "Every path" claim scoped to the
  three registration-facing pre-checks explicitly; new paragraph names the
  admin-endpoint residual, its cause, and why it's out of FC-001's scope
  rather than silently accepted. Endpoint count corrected to six.
  Openapi note corrected to name the three controllers needing new
  decorators. Positive Consequences bullet updated to credit both the
  status-code fix (Revision 3) and the message-text fix (Revision 4)
  accurately.
- **Verification:** Manual re-trace of `updateByAdmin`/`replaceByAdmin`'s
  pre-check and catch paths confirms the wording divergence as described.
  Manual count of the six endpoints named in the Consequences bullet
  against `auth.controller.ts`/`users.controller.ts`. No automated test
  exists for message-text parity; recommend one once test infrastructure
  returns.

---

## Open items summary

| ID | Status | Owner |
|---|---|---|
| FINDING-0006 | Open | `architecture-librarian` (next consistency pass) |
| FINDING-0007 | Open | `architecture-librarian` / repo owner (template migration decision) |
| FINDING-0008 | Open | Owner TBD — resolves when `PRD-043` is drafted |
| FINDING-0010 | Open | Repo owner — needs an explicit accept-or-fix decision |
