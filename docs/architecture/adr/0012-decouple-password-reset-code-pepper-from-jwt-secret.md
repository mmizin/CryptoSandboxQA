# ADR-0012: Decouple the password-reset code pepper from `JWT_SECRET`, keep a hardcoded final default

## Status

Accepted

**Revision 1:** 2026-07-27 — an `architecture-reviewer` pass found the
original Context overstated the gap: `PASSWORD_RESET_CODE_PEPPER`'s
fallback to `JWT_SECRET` is not undocumented, it is stated as intended
behavior in `README.md:255`, `ARCHITECTURE.md:125`, and
`FEATURES_INVENTORY.md:112`; `.env.example` is a required, tracked
artifact (`scripts/setup.js` hard-exits without it) and `JWT_SECRET` is set
on every documented run path with a value distinct from the code's
hardcoded fallback literal, meaning the "identical literal collision" case
this ADR originally led with is a non-default, undocumented edge case, not
the norm. This revision corrects Context, adds the previously-missing
Option C (keep the fallback, document a distinct pepper value), and
restates Consequences accordingly. The Decision (decouple) is unchanged —
confirmed with the user after the correction — but its justification and
the documentation-debt accounting are rewritten. Status reverted from
Accepted to Proposed pending this rework being reviewed once more.

**Revision 2:** 2026-07-27 — a second `architecture-reviewer` pass found:
the fail-closed alternative (requiring `PASSWORD_RESET_CODE_PEPPER` with
no fallback) was never evaluated as a considered option despite being the
only one that closes the residual this ADR's own Consequences names as a
Negative; the upgrade-impact Consequence scoped its blast radius to
deployments "relying on" the coupling (Assumption 1) when Revision 1's own
corrected Context establishes that population as the documented *default*
configuration, not a subset; and a sentence describing the unaddressed
`??`/`||` fallback-operator asymmetry had lost a clause. This revision adds
Option D (fail closed, rejected — same reasoning as this repo's other
permissive-default decisions), rescopes the upgrade-impact Consequence to
the actual default-configuration population, and repairs the garbled
sentence.

**Revision 3:** 2026-07-27 — a third `architecture-reviewer` pass found two
residual scope inconsistencies left behind by Revision 2's rescope
(Assumption 1 and Option A's Risk bullet still carried the pre-Revision-2
narrow framing, and "see Risks" pointed at a section with no upgrade-impact
content) and no cross-link to `ADR-0013`, which shares this feature and
independently invalidates in-flight reset codes on deploy. This revision
aligns Assumption 1 and Option A's Risk with Consequences' corrected
scope, and adds `ADR-0013` to Related ADRs. No change to the Decision or
its justification.

**Accepted:** 2026-07-27 — three `architecture-reviewer` rounds resolved
with no remaining material findings against this ADR's own claims
(Revision 3's residual items were editorial, not reasoning defects).
Status moved to Accepted.

## Date

2026-07-27

## Context

`AuthService.hashResetCode()` (`backend/src/auth/auth.service.ts:183-189`)
computes `HMAC-SHA256(pepper, code)` for the 8-digit password-reset code,
where `pepper` resolves through a three-tier fallback:
`PASSWORD_RESET_CODE_PEPPER` → `JWT_SECRET` → the hardcoded literal
`'dev-secret-change-in-production'`.

**This fallback is documented, intended behavior, not an unnoticed gap.**
`README.md:255` states: `PASSWORD_RESET_CODE_PEPPER` — "falls back to
`JWT_SECRET`" — "Optional extra secret for hashing reset codes."
`ARCHITECTURE.md:125` and `FEATURES_INVENTORY.md:112` describe the same
fallback. The root `.env.example` is a required, tracked setup artifact:
`scripts/setup.js` hard-exits with `Missing .env.example` if it is absent,
and copies it to `.env` on first run; `README.md:247` documents
`JWT_SECRET`'s example default as `your-super-secret-jwt-key-change-in-production`
— a value distinct from the code's hardcoded fallback literal
(`'dev-secret-change-in-production'`) and matching `docker-compose.yml:41`'s
own default — meaning `JWT_SECRET` is set, to a known, non-code-fallback
value, on every documented setup path (`npm run setup`, `npm run stack:up`).

Two distinct problems remain despite the coupling being intentional:

1. **Configured-but-partial case (the live case):** an operator who sets
   `JWT_SECRET` (which every documented path does) but not
   `PASSWORD_RESET_CODE_PEPPER` (documented as "Optional") gets a system
   where the two secrets are the same value by design — a leak of one
   compromises both JWT signing (session forgery) and reset-code hashing
   (recovery-code guessing), despite the two protecting materially
   different assets. This is the documented, default, everyday
   configuration, not an edge case.
2. **Fully-unconfigured case (a non-default edge case):** if neither env
   var is set — which requires running the backend without `.env` and
   without the `stack:up`/`docker-compose` path, i.e. outside every
   documented setup flow — both fallback chains terminate at the identical
   hardcoded literal. Real, but not the case an operator following this
   repo's own instructions would hit.

`PRD-PasswordReset` (`docs/features/password-reset/PRD.md`, C-001) raises
this as Q-004, naming it the backlog's designated "pepper design" ADR
candidate (`DOCUMENTATION_IMPLEMENTATION_PLAN.md`, row 5).

This codebase is `CryptoSandboxQA`, a QA training sandbox, not a production
system (`CLAUDE.md`). Its documented setup path
(`npm install && npm run db:up && npm run setup`) is turnkey; any change
here must not require new operator action to keep it that way.

## Decision Drivers

- **Security boundary separation** — a reset-code pepper and a JWT signing
  key protect different assets; a leak of one should not, by the
  documented default configuration, automatically leak the other.
- **Turnkey local setup** — `npm run setup` must continue to work with the
  same zero-additional-action experience it has today.
- **Training-sandbox context** — this system is explicitly not
  production-hardened, but the same reasoning that keeps `JWT_SECRET`
  itself a single shared value with a permissive fallback does not by
  itself justify reusing that same value for an unrelated secret's default
  too — separation of purpose is a design property independent of how
  weak any individual default is allowed to be.

## Assumptions

- No deployment of this codebase intentionally relies on problem 1's
  coupling for a reason this ADR hasn't identified (e.g. deliberately
  wanting one secret to rotate both values together). Note this coupling
  is live on the *documented default* configuration (Context), not a
  narrow subset — this assumption is therefore about every such
  deployment's *intent*, not about whether the coupling applies to them;
  see Consequences → Negative for the resulting upgrade impact.
- The turnkey `npm run setup` flow is a hard constraint this decision must
  not break, per explicit product direction.

## Considered Options

### Option A — Decouple: drop the `JWT_SECRET` fallback tier entirely

Pepper resolution becomes `PASSWORD_RESET_CODE_PEPPER` → a pepper-specific
hardcoded literal, distinct from `JWT_SECRET`'s. No dependency on
`JWT_SECRET` remains in `hashResetCode()`.

- **Advantages:** Closes problem 1 (the live, documented-default coupling)
  and problem 2 (the edge-case collision) in one change, for every run
  path, present and future, with no reliance on `.env.example` staying
  correctly populated.
- **Disadvantages:** Requires updating three now-stale documents
  (`README.md:255`, `ARCHITECTURE.md:125`, `FEATURES_INVENTORY.md:112`)
  that currently describe the fallback as intended — this is real
  documentation work this ADR's adoption creates, not zero-cost.
- **Risks:** Every deployment on the documented default configuration
  (not a narrow subset — see Consequences → Negative) changes its
  effective pepper value on upgrade unless the accompanying doc updates
  make the change visible ahead of time.

### Option B — Keep the `JWT_SECRET` fallback tier as-is

- **Advantages:** No code or documentation change; matches the currently
  documented, intended design.
- **Disadvantages:** Leaves problem 1 — the live, default-configuration
  coupling — unresolved. A JWT secret leak and a reset-code pepper leak
  remain the same incident on every documented setup path, not just an
  unconfigured edge case.
- **Risks:** Incident response investigating a suspected JWT secret leak
  must also treat every issued password-reset code as compromised, and
  vice versa, on the system's default configuration — a coupling that is
  documented but not obviously intentional for that specific reason
  anywhere it's written down (each of the three docs states the fallback
  as a fact, not with security rationale attached).

### Option C — Keep a fallback, but set a distinct `PASSWORD_RESET_CODE_PEPPER` value in `.env.example`

Leave `hashResetCode()`'s code unchanged; add
`PASSWORD_RESET_CODE_PEPPER=<distinct-value>` to `.env.example` so every
documented setup path gets a pepper different from `JWT_SECRET` with zero
code change, while an operator who deletes that line (or runs outside
`.env.example` entirely) still falls back to the coupled behavior.

- **Advantages:** Cheapest fix by far — one line in an already-tracked
  file, no code change, no behavior change for any deployment not touching
  `.env.example`. Closes problem 1 for the documented default path
  immediately.
- **Disadvantages:** Does not close problem 1 structurally — a future
  change to `.env.example`, or any run path that doesn't use it, silently
  reintroduces the coupling with no code-level guard against it. Three
  documents describing the fallback as intended are now actively
  misleading about the *shipped default*, even though the fallback
  mechanism itself still exists in code.
- **Risks:** Relies on `.env.example` staying correctly populated
  indefinitely; nothing enforces that the two values actually differ if
  someone edits it later.

### Option D — Fail closed: require `PASSWORD_RESET_CODE_PEPPER`, no fallback at all

Startup throws if `PASSWORD_RESET_CODE_PEPPER` is unset, closing both
problem 1 and problem 2 completely rather than reducing the fallback
literal's blast radius.

- **Advantages:** No weak default exists at all for this one secret;
  closes the residual this ADR's Option A explicitly still carries as a
  Negative consequence (a hardcoded, publicly-visible literal in the
  fully-unconfigured case).
- **Disadvantages:** Breaks the documented zero-config `npm run setup`
  flow unless `.env.example`, setup docs, and setup scripts are updated in
  lockstep to generate or require the variable — a larger, cross-cutting
  change to the setup pipeline this ADR does not have the mandate to make.
  Inconsistent with every other secret in this codebase, all of which have
  permissive hardcoded fallbacks today (`JWT_SECRET` itself included, and
  unaffected by this ADR).
- **Risks:** Partial adoption — failing closed here while `JWT_SECRET` and
  every other secret keeps a permissive default — creates an inconsistent
  security posture that is harder to reason about than a uniformly
  permissive one, without a coordinated decision to fail closed more
  broadly.

## Decision

**Option A** — decouple the pepper from `JWT_SECRET` by dropping the
middle fallback tier, and give `hashResetCode()` its own dedicated,
pepper-specific hardcoded literal as the final default, distinct from
`JWT_SECRET`'s.

Resolution becomes:

```
PASSWORD_RESET_CODE_PEPPER → 'dev-password-reset-pepper-change-in-production'
```

(exact literal value is an implementation detail for whoever applies this
ADR; it must differ from `JWT_SECRET`'s own fallback literal and from
whatever value `.env.example` sets for `JWT_SECRET`.)

Chosen over Option C because Option C only fixes the *shipped default*
while leaving the structural coupling in code — a future edit to
`.env.example`, or any deployment that constructs its own environment
without copying that file, silently reintroduces problem 1 with no
code-level signal that it happened. Option A closes the coupling at its
source once, for every run path, present and future, which better serves
the "security boundary separation" driver than a configuration-only fix.
Chosen over Option B for the reason Option B's Disadvantages state: the
coupling is real and live on the documented default configuration, not
merely a theoretical edge case, and separation of purpose for two secrets
protecting different assets is worth the one-line code change plus
documentation update. Chosen over Option D (fail closed) because failing
closed would break the turnkey setup flow this repository's `CLAUDE.md`
documents as the primary onboarding path, and would apply a stricter
standard to this one secret than every other secret in the codebase
carries today — including `JWT_SECRET` itself, whose own permissive
fallback this ADR does not touch. If this codebase's security posture for
secrets changes more broadly in the future (e.g. all defaults move to fail
closed together), Option D should be revisited then as part of that wider
decision, not adopted in isolation here.

This decision accepts Option A's real disadvantage — three currently
correct documents become stale — as a known, bounded cost (see
Consequences), rather than treating it as a reason not to decouple.

## Consequences

### Positive

- A `JWT_SECRET` leak no longer compromises password-reset code hashing on
  the system's default, documented configuration, and vice versa.
- `hashResetCode()`'s fallback behavior becomes independently auditable —
  reading it no longer requires also reasoning about `AuthModule`'s JWT
  configuration.
- No change to the setup flow or required operator configuration; `npm run
  setup` continues to work exactly as documented today.

### Negative

- `README.md:255`, `ARCHITECTURE.md:125`, and `FEATURES_INVENTORY.md:112`
  all currently describe the `JWT_SECRET` fallback as intended behavior and
  must be updated in the same change that implements this ADR, or they
  become actively wrong the moment this lands — this is real documentation
  work, not a footnote.
- The system still has a hardcoded, publicly-visible pepper default in the
  fully-unconfigured edge case — this ADR does not eliminate that
  weakness, only ensures it is a *different* weak value than the JWT
  signing fallback.
- **Every deployment on the documented default configuration** (`JWT_SECRET`
  set, `PASSWORD_RESET_CODE_PEPPER` unset — the normal case per Context,
  not a narrow subset relying on unusual behavior) sees its effective
  pepper value change on upgrade, invalidating any reset codes issued but
  not yet redeemed at that moment — no data loss, no security regression,
  a one-time UX blip (a "code invalid, please request a new one" outcome)
  if it occurs during a live migration.

## Risks

- **Documentation debt is immediate, not deferred:** unlike the original
  draft of this ADR, which treated missing pepper documentation as a
  future follow-up, the correct framing is that three *existing, correct*
  documents go stale the moment this ADR is implemented. The implementing
  change must update all three in the same commit.
- **Silent-reintroduction risk (the reason Option C was rejected) still
  exists at a smaller scale:** nothing prevents a future code change from
  reintroducing a `JWT_SECRET` fallback tier by mistake. Not mitigated by
  this ADR; worth a code comment at the fallback site noting the decision
  and this ADR's number.
- **`??` vs `||` asymmetry, unaddressed by this decision:**
  `hashResetCode()` uses `??` (`auth.service.ts:184-187`) while
  `AuthModule`'s JWT fallback uses `||` (`auth.module.ts:24`,
  `jwt.strategy.ts:17`). With `??`, an operator who sets
  `PASSWORD_RESET_CODE_PEPPER=` (empty string — a realistic `.env` typo)
  gets an **empty HMAC key**, silently, with no fallback triggered. This
  ADR changes which literal `hashResetCode()` falls back to, but the `??`
  operator itself, and the empty-string footgun it creates, are unchanged
  by Option A — carried forward unmodified; flagged here as a residual
  worth a follow-up decision, not fixed by this one.

## Alternatives Rejected

- **Option B (keep `JWT_SECRET` fallback):** rejected — the coupling is
  live on the system's documented default configuration, not merely a
  fully-unconfigured edge case, and separation of purpose for two secrets
  protecting different assets is worth the cost of decoupling.
- **Option C (fix `.env.example` only):** rejected — cheaper, but only
  patches the shipped default; the structural coupling in code remains and
  can be silently reintroduced by any future change to `.env.example` or
  any run path that doesn't use it.
- **Option D (fail closed):** rejected — inconsistent with the rest of the
  codebase's secret-handling posture (including `JWT_SECRET`'s own
  unchanged fallback) and would break the documented turnkey setup flow
  without a coordinated, wider-scoped change to the setup pipeline.

## Related ADRs

- Related: `ADR-0013` — both ADRs invalidate in-flight, unredeemed
  password-reset codes on deploy (this ADR: the pepper value changes;
  `ADR-0013`: existing rows are overwritten by its schema migration's
  cleanup step) and both create documentation debt on the same file
  (`ARCHITECTURE.md:125`). If both land in the same release, plan the
  combined user-facing impact rather than treating them as independent.
  Otherwise scoped narrowly to `hashResetCode()`'s pepper resolution; does
  not change `JWT_SECRET`'s own fallback behavior (`auth.module.ts:24`,
  `jwt.strategy.ts:17`), which is unchanged and out of scope.

## References

- `docs/features/password-reset/PRD.md` — C-001, Q-004
- `docs/features/password-reset/DISCOVERY.md` — Candidate ADR 2, Data Flow 3
- `README.md:247,255`, `ARCHITECTURE.md:125`, `FEATURES_INVENTORY.md:112` —
  documents this decision requires updating on implementation
