# ADR-0018: `POST /auth/admin/register` is restricted to the window before any admin account exists

## Status

Accepted

**Revision 6:** 2026-07-28 — a seventh `architecture-reviewer` Delta Review
pass found no remaining defect in the architectural reasoning (Decision,
hierarchy, and evidence all held), and confirmed the gating condition this
ADR set for itself — the required `PRD-AdminUserCreation` PRD
amendment — had landed and was accurately described. Remaining items were
consistency/completeness cleanup, applied in this revision: the
`FEATURES_INVENTORY.md` References entry was rewritten to match Context's
corrected discounting rationale rather than restating the superseded
credibility-only framing; the "silent on admin count" characterization was
softened to "ambiguous" (the source's "Admins can create..." phrasing is
weakly suggestive, not clean silence); G-001, not only G-002, received an
additive PRD clause recording that its JWT-session-free claim now holds
only in the zero-admin window; the Non Goals credential-policy question
regained a live ID reference (Q-009's still-open half); a PRD Current
Behavior bullet was added recording the pre-restriction observed fact
(`createAdmin()` performs no admin-count check) that this Decision
changes; the Q-008 contingency near G-002 was reconciled with this ADR's
independent finding that `admin/create-user` cannot create an admin under
any resolution of Q-008; and Consequences/the follow-through note were
past-tensed now that the amendment is discharged. Status moves to Accepted.

**Revision 5:** 2026-07-28 — a fifth `architecture-reviewer` Full Review
returned "Accept with changes": the Decision's direction (Option B) holds,
but one of its two supporting claims did not survive verification. The
review found: `admin/create-user`, the route Revision 4 claimed
`CLAUDE.md`'s documented workflow points operators toward instead of this
one, does not create admin accounts at all (`createUserWithProfileAsAdmin()`
never sets `role`, which defaults to `'user'`) — that argument is retracted
in full, not merely reworded, since it does not hold under any resolution
of `PRD-AdminRoleGuards` Q-008. The repository-search claim was also
overstated ("or at all, outside the route's own... definitions" is false —
`README.md`, `ARCHITECTURE.md`, `FEATURES_INVENTORY.md`, and a QA guide all
reference this route) and its power against a human-operator-invoked
route was not disclosed. This revision: narrows the search claim to what
was actually verified (no in-repo automation), discloses the search's
power limitation, retracts the `CLAUDE.md` prong entirely, adds
`ARCHITECTURE.md:114`'s independent corroborating citation, explicitly
discounts `FEATURES_INVENTORY.md`'s competing purpose statement rather than
ignoring it, restricts the recoverability-parity claim to the zero-admin
case (adding the "admin exists but is unusable" break-glass cost to Option
B's Disadvantages and Consequences), fixes "already occurring" to a
contingent-exposure framing consistent with the no-automation finding, and
gives the Required PRD follow-through a gating condition (this ADR does not
move to Accepted until the PRD amendment lands) plus confirmation that
Q-009's mandated cross-PRD re-check is already performed in Context. The
Decision itself (Option B) is unchanged; its stated basis is corrected and
narrowed to what the evidence actually supports. Status remains Proposed
pending re-review.

**Revision 4:** 2026-07-28 — a fourth `architecture-reviewer` Full Review
found that once Revision 3's circularity was fixed, the remaining honest
weighing no longer supported that revision's conclusion (Option A). Three
specific defects: (1) a new "Proportionality" driver quoted
`PRD-AdminUserCreation`'s Overview as stating a purpose it does not
state ("provision and immediately use an admin account for QA/test
setup"), when the Overview's actual, non-fabricated text scopes the
route's purpose to "when none exists yet" — evidence *for* restricting,
misquoted as evidence against; (2) Option B's cost, correctly downgraded in
Revision 3 from "requirements conflict" to "procedural" (a pre-scripted PRD
amendment), was then used as an *additional reason to reject* Option B —
a cost that has been shown to be cheap cannot argue against the option it
describes; (3) the ADR's own Risks section already stated the deciding
asymmetry and didn't act on it: Option A accumulates permanent,
non-deprovisionable admin accounts and sessions that reversal cannot undo,
while Option B's cost (a PRD edit) is fully reversible either direction.
The review also found, and this revision independently confirmed by
searching the repository, that no in-repo caller (script, harness, seed)
invokes this route, and `CLAUDE.md`'s documented admin-creation workflow
names the sibling `AdminGuard`-gated route, not this one — the operator
need (US-002) this ADR's prior revisions rested on has no corroborating
evidence of actual use, only a stated intent in a Draft, unowned,
Low-product-intent-confidence PRD. Combined, the accumulation asymmetry and
the absence of confirmed usage move the Decision to **Option B**. This
revision: flips the Decision; corrects the Overview quotation and adds it
as evidence for Option B in Context; records the repository search result;
restates Option B's Disadvantage as the real, but bounded and reversible,
cost it is; restricts the recoverability-parity and Q-007-dissolution
claims to Option B only (Option D would actually change FC-002's
recoverability in "production," now stated in Option D's Disadvantages);
reconciles the two sandbox-simplicity drivers into one; and fixes the
US-002 quotation to include its stated Q-002 contingency. Status remains
Proposed pending re-review.

**Revision 3:** 2026-07-28 — rebuilt the Decision on US-002 alone after a
third review found Revision 2's basis (an unqualified quotation of
`PRD-AdminUserCreation` FR-001's second acceptance criterion) circular:
that criterion is itself "contingent on Q-009," the question this ADR
answers. Concluded Option A on a since-revised weighing; superseded by
Revision 4 above.

**Revision 2:** 2026-07-28 — corrected Revision 1's central error: Option B
(a live admin-count check) does not remove `PRD-AdminRoleGuards` FC-002's
recovery path, since a zero-admin state satisfies "no admin currently
exists" under a live check the same way it satisfies an unrestricted
route. Recoverability does not distinguish Option A from Option B. This
finding carried forward into every later revision; see Context.

**Revision 1:** 2026-07-28 — original draft, built on the recovery-path
argument Revision 2 found unsound. Superseded in substance; not otherwise
carried forward.

## Date

2026-07-28

## Context

`POST /auth/admin/register` (`AdminApiKeyGuard`, `AuthService.createAdmin()`,
`backend/src/auth/auth.controller.ts:106-119`,
`backend/src/auth/auth.service.ts:226-243`) is gated by a static, shared,
environment-level secret (`ADMIN_API_KEY`), not by any existing admin's JWT
session. No seed script creates an admin account (`PRD-AdminUserCreation`
G-002), so this route is the only *currently confirmed* path able to
produce the system's first admin — G-002 itself notes that reading is
contingent on `PRD-AdminRoleGuards` Q-008 (open: whether `CLAUDE.md`'s
conflicting documentation of a different route is the actual intended
design). The route has no check on how many admin accounts already exist:
it behaves identically whether the caller is bootstrapping from zero
admins or creating the tenth.

**`PRD-AdminUserCreation`'s own Overview and Problem Statement scope this
route's purpose to the zero-admin case**, not to repeat use: "It exists so
an admin account can be created and used **when none exists yet** — the
'who admins the first admin' problem" (Overview), and "Before any admin
account exists… there is no session-based path available at all" (Problem
Statement). This is direct, non-contingent evidence for restricting the
route to that window — an earlier draft of this ADR instead attributed a
"provision and immediately use an admin account for QA/test setup"
purpose to this same Overview section, which does not contain that
phrase; that misquotation is corrected here.

`PRD-AdminUserCreation` FR-001 (Priority: Must) has a second acceptance
criterion covering repeat use, but it does not stand as independent
evidence against restricting the route: "Given at least one admin account
already exists… then a new admin account is created… **As currently
observed** the path is not restricted to first-admin-only use; **contingent
on Q-009**, which proposes restricting this route to environments where no
admin yet exists." That criterion describes current behavior awaiting a
decision — Q-009 is the question this ADR answers, so treating the
criterion as settled input would be circular.

What genuinely stands independent of Q-009 is US-002: "As an operator
running QA test setup, I want to create additional admin accounts directly
via API, so that I don't have to manually promote a regular user through an
existing admin session. **Contingent on Q-002:** whether that also means an
immediately usable session in the same call… is open." The
promote-through-an-admin-session avoidance is real and carries no Q-009
contingency — but it is one user story in a Draft, unowned PRD
(`PRD-AdminUserCreation` header: Confidence "Low (product intent on
blast-radius questions)" — availability restriction is exactly such a
question), not a settled mandate. **No in-repo automation corroborates it
being exercised in practice**: a repository-wide search found no seed
script, npm script, or test harness that calls `POST /auth/admin/register`
more than once. This is a narrower finding than it might sound — the
route's caller is a **human operator** authenticating with an environment
secret, not an application component (`PRD-AdminUserCreation` Actors:
"Operator... not necessarily an existing application user"), so an
in-repo search has little power to detect real usage one way or the
other; it bounds *automation*, not operator behavior, and
`docs/features/admin-user-creation/DISCOVERY.md:294-298` already records
this exact question as open for the same reason. An earlier draft of this
ADR additionally argued that `CLAUDE.md`'s documented workflow points
operators at the sibling `admin/create-user` route instead — that argument
does not hold and is retracted: `createUserWithProfileAsAdmin()`
(`auth.service.ts:293-340`) never sets `role`, which defaults to `'user'`
(`schema.prisma:19`), so that route cannot create an admin account under
any resolution of `PRD-AdminRoleGuards` Q-008. It is irrelevant to this
question, not supporting evidence.

Two in-repo documents do bear on the purpose question directly, and are
weighed openly rather than left uncited. `ARCHITECTURE.md:114` states
"`AdminApiKeyGuard` for **bootstrapping** admin users" — non-contingent,
in-repo evidence for the zero-admin-window reading, independent of the PRD.
`FEATURES_INVENTORY.md:139-153`'s Purpose/Notes fields read "**Admins** can
create admin accounts via `ADMIN_API_KEY` without user interaction... direct
API-only pathway for test setup." On inspection this is weaker
counter-evidence than it first appears, though not fully neutral: the
subject "Admins" plausibly denotes the key holder rather than an existing
admin *account*, and the sentence does not explicitly claim the route is
meant for *repeat* use — it is genuinely ambiguous on admin count, not a
clean counter-claim to the zero-admin reading, but also not clean silence.
It is engaged rather than left uncited, but does not carry equal weight
against `ARCHITECTURE.md:114`'s affirmative "bootstrapping" framing on that
basis alone, independent of the source's separately-known unreliability at
other details (`PRD-AdminUserCreation` Current Behavior already found it
names a method, `registerAdmin()`, that does not exist in source; the
actual method is `createAdmin()`).

A separate PRD's open question is also relevant, though it does not by
itself determine this route's cost: `docs/features/admin-role-guards/PRD.md`
FC-002 records that "no code path examined checks the count of remaining
`role: 'admin'` accounts before applying a role change" — an admin can
demote themselves, or another admin, to zero remaining admins via the
ordinary role-update routes. **FC-002's own expected behavior is explicitly
undefined**: "Not currently defined by the product. See Q-002" — and Q-002
is listed `open`, with no named owner. FC-002 also notes, as an observation
rather than a decision: "`AdminApiKeyGuard`'s bootstrap path
(`POST /auth/admin/register`) would remain available to create a new admin
even from a zero-admin state, since it does not depend on any existing
admin account — this bounds the failure's severity but does not resolve
whether it should be prevented at the role-update layer."

**A live zero-admin precondition (the restriction this ADR adopts) does not
change that observation, in the zero-admin case specifically.** Since it
checks the *current* admin count, a zero-admin state — however it arises,
including via FC-002's failure mode — satisfies "no admin currently
exists" and the route remains available exactly as it does today.
Recoverability is identical between the unrestricted route and a
live-count restriction *when the count is actually zero*; this ADR's
Decision does not trade away `PRD-AdminRoleGuards` FC-002's recovery path
for that case, and does not treat FC-002 as an accepted risk
position — no such acceptance is recorded anywhere in `PRD-AdminRoleGuards`.

This parity does not extend to a different failure mode: an admin account
exists but is unusable (a lost password with no controlled mailbox, a lost
2FA device, an orphaned seeded account). Under the unrestricted route, the
API key is a general break-glass mechanism regardless of count; under this
ADR's Decision, the count is ≥ 1 and the route refuses, so the key stops
functioning as break-glass once any admin exists — see Option B's
Disadvantages.

Note a circularity worth naming rather than silently relying on:
`PRD-AdminRoleGuards` Q-002's own question text is framed as "**Given**
`AdminApiKeyGuard`'s bootstrap path remains available regardless, is this
worth guarding against at all, or an accepted, recoverable risk…?" — i.e.,
Q-002 is already premised on this route's continued availability. This
ADR's Decision preserves that availability under the live-count precondition,
so it does not resolve this circularity either — Q-002 will likely continue
to be answered, if ever, on the same premise it already leans on.

`PRD-AdminUserCreation` Q-007 asks the coupling question directly: "is that
dependency acceptable as a permanent design coupling between the two
features, or should the last-admin risk be independently mitigated?" This
ADR does not so much resolve Q-007 as dissolve half of it, for the option it
adopts: a live-count restriction doesn't change FC-002's recoverability, so
there is no dependency there to accept or mitigate under this Decision.
Q-007's second half — whether the last-admin risk should be independently
mitigated — remains `PRD-AdminRoleGuards` Q-002's question, unanswered
here.

Out of scope for this ADR:
- Whether `POST /auth/admin/register` should be rate-limited. `ADR-0013`
  (Accepted, not yet implemented) already decides a global, application-wide
  rate-limiting default covering every route, including this one, as a
  separate and already-closed baseline question. Whether a *tighter*,
  route-specific limit is separately warranted here remains open per
  `docs/features/admin-user-creation/DISCOVERY.md`, but is not this ADR's
  decision to make.
- Whether the account this route creates should also receive a live session
  in the same call. That is a separate, not-yet-drafted candidate ADR
  (`PRD-AdminUserCreation` Q-002 — a different Q-002 than
  `PRD-AdminRoleGuards`' Q-002 referenced above; the two PRDs' ID
  namespaces are independent) and is not conflated with this one.
- Auditing/logging account creation via this route (`PRD-AdminUserCreation`
  Q-006) — no existing ADR decides this either; out of scope here.
- Whether `PRD-AdminRoleGuards` Q-002 itself should be closed (e.g., by a
  last-admin guard at the role-update layer) — that decision belongs to
  `PRD-AdminRoleGuards`, not to this PRD or this ADR.
- Realigning `docs/features/admin-user-creation/DISCOVERY.md`'s Candidate
  ADR-2 section, which still describes an earlier, since-abandoned
  Must-priority-requirement basis for this decision — a documentation
  cross-reference health issue, deferred to an `architecture-librarian`
  pass rather than fixed inline here.

## Decision Drivers

- **The PRD's own stated purpose scopes this route to the zero-admin
  case** (Overview, Problem Statement) — non-contingent evidence favoring
  restriction, previously misquoted in an earlier draft of this ADR as
  supporting the opposite conclusion.
- **A real, but unconfirmed-in-practice operator need (US-002)** — repeat
  admin creation via this route at nonzero admin count would serve a
  stated operator workflow. It carries no Q-009 contingency, but it is one
  user story in a Draft, unowned PRD self-rating Low confidence on this
  exact class of question, and no in-repo automation (no script, harness,
  or seed) corroborates it being exercised — though this bounds automation,
  not operator behavior, since the caller is a human operating with an
  environment secret (see Context, Assumptions).
- **Blast radius of a leaked, shared, or inferred `ADMIN_API_KEY`** — not
  limited to account creation: each call to `createAdmin()` also mints a
  live, DB-backed 7-day session via `issueTokenAndSession()`
  (`auth.service.ts:242`), and each created account is permanent, with "no
  expiry, and no deprovisioning path recorded anywhere"
  (`PRD-AdminUserCreation` Architecture Impact) — reachable indefinitely
  thereafter through the equally unrate-limited `/auth/login`. The
  credential itself is static and (per `PRD-AdminUserCreation` A-002) not
  confirmed to be rotated or held only by trusted operators in every
  deployment; `FINDINGS.md` IF-003 (non-constant-time key comparison)
  additionally means this risk is not limited to leakage.
- **Reversibility asymmetry (the deciding driver — see Decision)** —
  should the key ever be leveraged by anyone other than a legitimate
  operator, Option A's exposure accumulates permanent, non-deprovisionable
  state (accounts and sessions) that reversing the decision cannot undo.
  Option B's cost (a documented, pre-scripted PRD amendment per Q-009) is
  fully reversible in either direction and
  accumulates no state of its own. Under uncertainty about US-002's actual
  usage and `PRD-AdminUserCreation` Q-010 (who holds the key), the
  optionality-preserving choice is the one that doesn't accumulate
  irreversible exposure while that uncertainty remains — restrict now,
  relax later if evidence of real repeat-use need emerges.
- **Cross-feature framing dependency, not a recovery dependency** — this
  route's continued availability at zero admins does not change
  `PRD-AdminRoleGuards` FC-002's recoverability, but `PRD-AdminRoleGuards`
  Q-002's own question text is already premised on this route's continued
  availability. Naming this rather than silently relying on it.
- **Operational simplicity for a QA training sandbox** — favors low
  ceremony in general (`CLAUDE.md`), but a live admin-count check is itself
  low ceremony (a count query and a conditional, no new configuration
  surface or environment-marker dependency) — this driver does not
  distinguish Option A from Option B the way it would distinguish either
  from Option D, and should not be read as favoring A over B.

## Assumptions

- `ADMIN_API_KEY` is not routinely leaked, shared beyond trusted operators,
  or feasibly inferred in any given deployment. `PRD-AdminUserCreation` A-002
  already flags the leakage/sharing half as unconfirmed (Q-010 asks who
  actually holds the key in training deployments); `FINDINGS.md` IF-003
  (non-constant-time comparison) means the inference half is not fully
  closed either, though no rate limiting exists yet (IF-002) to bound
  inference attempts. If this assumption is false, it strengthens the case
  for this ADR's Decision (Option B) rather than weakening it.
- `PRD-AdminRoleGuards` Q-002 remains open and unowned at the time this ADR
  is decided. This ADR's Decision does not depend on Q-002's eventual
  answer — a live-count restriction doesn't change FC-002's recoverability
  either way — but if Q-002 is closed by a mechanism at the role-update
  layer, that independently removes the last-admin failure mode FC-002
  describes.
- **No in-repo automation exercises repeat use of this route today**, and
  no in-repo document records an operator runbook that does either. A
  repository-wide search found no seed script, npm script, or test harness
  calling this route. This bounds *automation*, not operator behavior —
  the caller is a human operator authenticating with an environment
  secret, which an in-repo search has little power to observe either way
  (`docs/features/admin-user-creation/DISCOVERY.md:294-298` already records
  this exact question as open). If a real, currently undocumented operator
  practice (an instructor runbook, a shared script, manual repeated use)
  does exercise this route, that is new evidence this ADR does not have,
  and it would weaken the case for this Decision — see Alternatives
  Rejected for the revisit condition.

## Considered Options

### Option A — Keep unrestricted: no change to current behavior

The route remains reachable identically regardless of how many admin
accounts already exist.

- **Advantages:** Zero implementation cost. Satisfies US-002's stated
  operator need as-is, requiring no PRD change, if that need is in fact
  exercised in practice (unconfirmed — see Assumptions).
- **Disadvantages:** A leaked, shared, or inferred `ADMIN_API_KEY` is a
  permanent, unbounded admin-creation-and-session-issuance channel for the
  lifetime of that secret, for as long as that secret is valid — not only
  at the moment of a first admin's creation. This decision does not reduce
  that exposure; it leaves whatever mitigation eventually exists to be
  request-volume-based (`ADR-0013`, not yet implemented) rather than
  availability-based. Unlike Option B's cost, this exposure accumulates
  irreversible state (permanent admin accounts and sessions with no
  deprovisioning path) for as long as this option remains in effect.
- **Risks:** If `PRD-AdminUserCreation` A-002 turns out to be false in a
  given deployment (the key is shared beyond trusted operators, or
  successfully inferred per IF-003), this option offers no mitigation until
  `ADR-0013`'s rate limiting is implemented, and even then only bounds
  request volume, not eventual success.

### Option B — Restrict to a live zero-admin precondition (reject the request whenever at least one admin currently exists)

`createAdmin()` checks the current admin count and rejects the request if at
least one admin account already exists.

- **Advantages:** Bounds the bootstrap route's exposure to the window
  before any admin exists — matching `PRD-AdminUserCreation`'s own stated
  purpose for this route (Context) — closing the leaked/inferred-key
  standing-authority risk `DISCOVERY.md` and `FINDINGS.md` describe for
  every case except that initial window. Because the check is on the
  *current* admin count, it does not close the window if every admin is
  later removed (`PRD-AdminRoleGuards` FC-002's failure mode) — a
  zero-admin state, however it arises, satisfies the precondition and the
  route becomes available again for the zero-admin case. Recoverability is
  therefore identical to Option A's *in that case*; this option's benefit
  is scoped entirely to bounding the *leaked-key* exposure at nonzero admin
  count, not to changing FC-002's recovery story.
- **Disadvantages:** Removes the operator workflow US-002 describes, at
  nonzero admin count. This is a real cost, though a bounded and reversible
  one: `PRD-AdminUserCreation` Q-009 already anticipates this exact outcome
  and pre-scripts the amendment ("If 'restrict' is the answer, FR-001's
  second acceptance criterion and G-002 must change") — adopting this
  option means editing the PRD to match, not overriding a settled
  requirement against its own terms. If evidence later emerges that US-002
  is exercised in practice, this option should be revisited (see
  Alternatives Rejected). **Also removes the `ADMIN_API_KEY` holder's
  ability to use this route as a general break-glass mechanism once any
  admin exists** — e.g. if the only usable admin loses their password with
  no controlled mailbox, or their 2FA device, recovery no longer runs
  through this route once the count is ≥ 1. This project's documented
  DB-access workflows (`CLAUDE.md`: `npm run prisma:studio`,
  `docker exec crypto-postgres psql`) remain available as a fallback, at
  materially higher friction than a single API call.
- **Risks:** A race between "count admins" and "insert new admin" under
  concurrent requests could allow two bootstrap calls to both see zero
  admins and both succeed — a minor risk, since both callers already hold
  `ADMIN_API_KEY` and could have created any number of admin accounts under
  Option A regardless; this is the same non-atomicity class `FINDINGS.md`
  IF-001 already documents for this method's duplicate-email check, at
  materially lower severity (that race changes a response code; this one
  changes a count of accounts an authorized caller could already create at
  will).

### Option C — Keep unrestricted availability, rely on rate limiting as the sole additional control

Adopt `ADR-0013`'s already-decided global rate limiting (and, if warranted,
a tightened per-route limit — a separate open question, not this ADR's to
decide) as the only additional control, with no change to this route's
availability.

- **Advantages:** Satisfies US-002 in full, identically to Option A, while
  adding friction against brute-force/enumeration use of a leaked or
  guessed key. Requires no new logic in `createAdmin()` beyond what
  `ADR-0013` already specifies for the rest of the auth module.
- **Disadvantages:** Rate limiting bounds *request volume*, not *standing
  authority*: a key holder who is not rate-limit-constrained (a single
  correct request is all `createAdmin()` requires) retains the same
  unbounded admin-creation capability Option A describes. It does not
  bound availability the way Option B does, and does not address the
  accumulation-of-irreversible-state concern the Reversibility asymmetry
  driver names.
- **Risks:** None beyond `ADR-0013`'s own risks, which this option inherits
  without adding new ones.

### Option D — Restrict by environment (non-production only)

`createAdmin()` (or the route) is disabled outside environments explicitly
marked non-production (e.g., a `NODE_ENV`/config check).

- **Advantages:** Removes the standing-authority risk entirely in whatever
  is designated "production," without affecting US-002's workflow in
  non-production/training environments where this system's primary use
  case lives.
- **Disadvantages:** Requires a definition of "production" this codebase
  does not currently formalize for this purpose, and a decision about what
  happens if that environment marker is misconfigured (fail open or
  closed?) — introducing a new configuration-correctness dependency of the
  same shape `admin-api-key.guard.ts`'s existing `ADMIN_API_KEY`-unset
  fail-closed check already has, but for a different variable. For a
  training sandbox whose primary deployments may not cleanly map to a
  "production/non-production" binary (`CLAUDE.md` describes training
  deployments, not a conventional prod/staging split), this option's
  central assumption may not hold cleanly across deployments. **Unlike
  Option B, this option would actually change `PRD-AdminRoleGuards`
  FC-002's recoverability** in whatever environment is designated
  "production": if every admin is later removed there, this route would be
  unavailable in that environment too, unlike Option B's live-count check,
  which remains available whenever the current count is zero regardless of
  environment. This cost is not analyzed further here, as it depends on an
  environment-boundary definition this codebase does not have.
- **Risks:** A misconfigured or absent environment marker could fail open
  (silently preserving Option A's behavior everywhere) or fail closed
  (silently reproducing Option B's disruption to US-002's workflow, plus
  the FC-002 recoverability cost above, in what was intended to be a safe
  environment) — which failure mode is not decided by choosing this option
  alone.

## Decision

**Option B — restrict `POST /auth/admin/register` to the window before any
admin account exists, via a live admin-count check.**

The deciding factor is the Reversibility asymmetry, supported by — not
co-equal with — the absence of confirmed usage. Option A's exposure — a
leaked, shared, or inferred `ADMIN_API_KEY` yielding unbounded, permanent,
non-deprovisionable admin accounts and sessions — accumulates state that
this decision cannot later undo by reversing course. Option B's cost is the
opposite: a documented, pre-scripted PRD amendment (`PRD-AdminUserCreation`
Q-009) that this ADR itself now applies, fully reversible if evidence of
real repeat-use need emerges. `PRD-AdminUserCreation`'s own Overview and
Problem Statement already scope this route's purpose to the zero-admin
case, corroborated by `ARCHITECTURE.md:114`'s independent "bootstrapping"
framing; against that, no in-repo automation or documented runbook confirms
US-002's repeat-use workflow is actually exercised — though this is a bound
on what a repository search can see for a human-operator-invoked route, not
proof the workflow doesn't exist (see Assumptions). Weighing an accumulating,
irreversible exposure against an unconfirmed convenience, under genuine
uncertainty that a repository search cannot fully resolve, favors the
option that does not accumulate exposure while that uncertainty stands.

This decision does not close `PRD-AdminRoleGuards` Q-002, and does not treat
it as settled — Q-002 remains open and unowned, and this route's continued
availability at zero admins means Q-002's own premise is unaffected either
way. It does not close `PRD-AdminUserCreation` Q-010, the credential-trust
question. It dissolves half of `PRD-AdminUserCreation` Q-007 — the coupling
Q-007 asks about turns out not to exist on the recoverability axis under
this option — but leaves Q-007's other half (whether the last-admin risk
should be independently mitigated) to `PRD-AdminRoleGuards` Q-002,
unanswered here.

**Required PRD follow-through — complete.** `PRD-AdminUserCreation`
FR-001's second acceptance criterion has been amended to state the
restricted behavior (superseding, not retiring, the prior criterion — the
underlying capability is unchanged for the zero-admin case); US-002 has
been retired with `Reason`/`Retired`/`Replaced by` fields naming this ADR
and the revisit condition; the orphaned `Related: US-002` reference on
FR-001 has been reported per R-012, not silently dropped; G-002 and
**G-001** (the latter's "without needing any existing admin's JWT session"
clause, orphaned by this Decision at nonzero admin count) both received
additive clauses, not rewrites; Q-009 is marked answered for the
restriction half in the Open Questions table, with its still-open
credential-policy half given a live cross-reference in Non Goals; Q-007 is
marked partially answered, reflecting that the coupling it asked about does
not exist on the recoverability axis under this Decision; and a Current
Behavior bullet now records the pre-restriction observed fact (no
admin-count check in `createAdmin()`) that this Decision changes. The
cross-PRD re-check against `PRD-AdminRoleGuards` FC-002/Q-002 was already
performed above, in Context, before this amendment was made.

## Consequences

### Positive

- Bounds the leaked/shared/inferred-`ADMIN_API_KEY` exposure to the window
  before any admin exists, closing the majority of the standing-authority
  risk `DISCOVERY.md` and `FINDINGS.md` describe.
- No accumulating, irreversible exposure while `PRD-AdminUserCreation`
  Q-010 (credential trust) and the true usage frequency of US-002's
  workflow remain unconfirmed.
- Low implementation cost: a count query and a conditional, no new
  configuration surface or environment-marker dependency.

### Negative

- Removes a documented, if unconfirmed-in-practice, operator convenience
  (US-002) — if that workflow turns out to be real and exercised, this
  decision imposes a genuine cost until revisited.
- Required a `PRD-AdminUserCreation` PRD amendment (FR-001, G-001, G-002,
  US-002) as direct follow-through — discharged; see Decision.
- `PRD-AdminRoleGuards` Q-002's own question framing remains premised on
  this route's continued availability, and this decision does not change
  that — Q-002 will likely continue to be answered, if ever, on that
  premise.
- Does not close `FINDINGS.md` IF-002 (no rate limiting) or IF-003
  (non-constant-time key comparison) — the pre-first-admin window this
  option preserves is still reachable at unlimited request volume until
  `ADR-0013` is implemented.
- Removes the `ADMIN_API_KEY` holder's ability to use this route as a
  general break-glass mechanism once any admin exists — an admin account
  that becomes unusable (lost password, lost 2FA device) is no longer
  recoverable through this route at nonzero admin count; recovery falls
  back to this project's documented DB-access workflows
  (`npm run prisma:studio`, `docker exec crypto-postgres psql`) at
  materially higher friction.

## Risks

- **Assumption risk:** if a real, currently undocumented operator workflow
  does depend on repeat use of this route or on its break-glass property —
  something an in-repo search cannot rule out, only fail to find — this
  decision breaks it without warning until someone notices and revisits
  this ADR.
- **Race risk:** see Option B's Risks — a minor, bounded concurrency issue
  already inherited from the same non-atomicity class as `FINDINGS.md`
  IF-001.
- **Framing entrenchment:** `PRD-AdminRoleGuards` Q-002's premise (this
  route stays available) is preserved under this Decision, same as under
  Option A — this ADR does not resolve that circularity, only avoids
  making it worse.
- **PRD-drift risk (mitigated, not eliminated):** the required PRD
  follow-through (FR-001/G-002/US-002) has been carried out, so
  `PRD-AdminUserCreation` and this ADR now agree on the route's intended
  behavior. The residual risk is implementation drift, not documentation
  drift: `createAdmin()` (`auth.service.ts:226-243`) does not yet implement
  the live admin-count check this ADR and the amended PRD both describe —
  until it does, the documented and actual behavior disagree.

## Alternatives Rejected

- **Option A (keep unrestricted)** — rejected: its cost is a standing
  capability that would accumulate irreversible admin-account/session
  exposure for as long as this option remains adopted, should the key ever
  be leveraged by anyone other than a legitimate operator, and reversing
  course later cannot undo that accumulation. Its support (US-002, plus
  zero implementation cost) is real but unconfirmed as exercised in
  practice, and does not offset an irreversible-exposure cost with a
  reversible one. Revisit if concrete evidence of a real, exercised
  repeat-use operator workflow emerges, or if the
  break-glass property (Option B's Disadvantages) is confirmed as load-bearing
  — at that point Option A's case would be materially stronger than
  analyzed here.
- **Option D (environment restriction)** — rejected because this system's
  deployment model does not cleanly formalize a production/non-production
  boundary for this purpose, the option introduces a new
  configuration-correctness dependency whose failure mode (open or closed)
  is undecided, and — unlike Option B — it would actually change
  `PRD-AdminRoleGuards` FC-002's recoverability in whatever environment is
  designated production.
- **Option C is not rejected** — it remains the already-decided path
  (`ADR-0013`), complementary to this ADR's Decision (Option B): rate
  limiting bounds request volume within the zero-admin window Option B
  preserves; it is not a substitute for restricting availability.

## Related ADRs

- Related: `ADR-0013` (rate-limiting decision covering this route's
  baseline within the zero-admin window this ADR preserves; complementary,
  not a substitute)
- Related: `ADR-0011` (end-impersonation authentication boundary — observes,
  without deciding, that this route uses a disjoint credential outside the
  session/role system, in service of a different argument about token-kind
  confusion; cited here only as a parallel observation, not a shared
  conclusion)
- Related: `PRD-AdminRoleGuards` FC-002/Q-002 (the open, unowned question
  whose premise this ADR's Decision leaves unaffected — a last-admin guard
  at the role-update layer, if `PRD-AdminRoleGuards` ever adopts one, would
  independently close FC-002 without requiring any change here)
- Related: `PRD-AdminUserCreation` Q-007 (this ADR dissolves the
  recoverability half of the coupling Q-007 asks about; the other half
  remains `PRD-AdminRoleGuards` Q-002's to answer), Q-009 (this ADR's
  Decision answers Q-009: restrict to the zero-admin window; PRD amendment
  required, see Decision), Q-010 (the credential-trust question, which
  remains open)

## References

- `docs/features/admin-user-creation/PRD.md` (Overview, Problem Statement,
  FR-001, US-002, Q-002, Q-007, Q-009, Q-010, Non Goals, C-001, A-002,
  Architecture Impact)
- `docs/features/admin-user-creation/DISCOVERY.md` (Candidate ADR-2)
- `docs/features/admin-user-creation/FINDINGS.md` (IF-001, IF-002, IF-003)
- `docs/features/admin-role-guards/PRD.md` (FC-002, Q-002, FR-003,
  Architecture Impact)
- `ARCHITECTURE.md:114` (independent "bootstrapping" framing of this route)
- `FEATURES_INVENTORY.md:139-153` (purpose statement engaged in Context —
  ambiguous rather than probative on admin count, with the source's
  separately-known unreliability noted as a secondary, severable point)
- `CLAUDE.md` (documented DB-access fallback workflows:
  `npm run prisma:studio`, `docker exec crypto-postgres psql`)
- `docs/architecture/adr/0013-rate-limiting-for-unauthenticated-auth-endpoints.md`
