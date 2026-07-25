---
name: interview
description: >
  Consolidated 14-phase ideation skill — Socratic interview, autonomous
  competitive research, 3 strategic approaches via parallel sub-agents,
  multi-perspective review (Engineer/Executive/UX), devil's advocate,
  Claude-proposed RICE/Feasibility. Single entry-point for ideation phase.
  Produces idea-brief.md (15 sections, ≤5 pages). Triggers on "raw idea",
  "capture an idea", "interview a feature X", "brief for X", "new feature X",
  "idea brief", "intake feature X", "start new feature", "ideation for {slug}",
  "/sdlc-interview {slug}". Replaces the prior intake + brainstorm + interview
  trio. ADRs are no longer part of this skill — they are spawned inline by
  the architecture-design skill at gate 04-05. Not to be confused with the global `interview` skill
  (stress-testing ideas) — this one is bound to SDLC ideation phase and
  writes an artifact into docs/features/.
---

# Skill: interview (SDLC ideation phase — single entry-point)

Consolidated 14-phase ideation runner. Single entry-point for the ideation phase. Replaces the prior atomic trio `intake` + `brainstorm` + `interview` with one autonomous Claude-driven protocol. Output: a single `docs/features/<slug>/idea-brief.md` with 15 sections (≤5 pages), no separate `brainstorm.md` / `initiatives.md`.

## Why this consolidation

Single entry-point for ideation. Replaces intake + brainstorm + interview. Autonomous Claude-driven research (competitive analysis, strategic approaches, multi-perspective review, devil's advocate, RICE/Feasibility proposals) with user confirms via AskUserQuestion. No more user-input RICE numbers («calculator game»). No more separate brainstorm.md / initiatives.md. ADR is not a gate-1 concern — it moves to gate 3 (after sad.md (architecture-design) §Trade-offs); the ideation phase stays pure product.

## Owner

Idea author (PM / Eng / CTO / anyone). Tech Lead joins at multi-perspective review (phase 6) if asked.

## When to use

- «capture an idea <slug>», «new brief for <feature>», «raw idea for <feature>».
- «interview a feature <slug>», «ideation for <slug>», «brief for <feature>».
- «intake feature <slug>», «start new feature with CONTEXT», «full intake for <slug>».
- `/sdlc-interview <slug>` as explicit invocation.
- User drops a raw idea in prose and asks «format this per SDLC» / «run ideation for <slug>».
- Glossary-aware: on start the skill reads `docs-new/foundation/GLOSSARY.md` if it exists, keeps the glossary as session state, and appends new domain terms to it directly.
- Skip if `docs/features/<slug>/idea-brief.md` already exists with `status: Confirmed` and is fresh (≤2 weeks) — update it first, don't rewrite.

## Inputs

- `<slug>` — kebab-case, short (`rate-limiting`, `goals-tracking`). If the user didn't give one — suggest 2-3 options based on the idea.
- (Optional) prior notes / links / ticket the user already has.

## Mode handling

**This skill is planning-mode-native.** Phases 0-11 execute entirely in read-only mode (Read, WebSearch, Agent, AskUserQuestion). Only at the transition from Phase 11 → 12 is `ExitPlanMode` invoked with the synthesized plan; then Phase 12 copies the template and writes `idea-brief.md` to disk.

**Why:** AskUserQuestion checkpoints in Phases 1, 2, 9, 10, 11 are not "clarifying questions," but a **mandatory data-input protocol**. The user must actually engage deeply with the idea; without this, the artifact is a reconstruction from model memory, not an interview.

**Auto Mode override:** if `Auto Mode` system-reminder is active in the session, it does **not** override the AskUserQuestion checkpoints in this skill. Auto Mode applies to "pause to check whether I should proceed" moments between phases, not data input. Fabricating raw ideas, Socratic answers, RICE/Feasibility/Recommendation confirmations without user input = invalidate the entire interview.

## AskUserQuestion style — junior-friendly guidance (mandatory)

Each `AskUserQuestion` in this skill (Phases 1, 2, 9, 10, 11) is formulated so that **a PM without technical background or a first-year junior developer** can answer without needing help.

**Mandatory structure:**

1. **Clear language throughout** — labels and descriptions in plain terms. Technical identifiers (RICE, R/I/C/E score, Feasibility ☑/☐, Approach A/B/C) remain in English as names; but actions are phrased simply ("Accept Approach C", "Adjust E lower", "Mark TBD", "Confirm and move to Phase 11").

2. **`question` field — 3-4 sentences** with three blocks:
   - **CONTEXT** — where this question comes from, which Phase we're in now, what has already been gathered (1-line recap)
   - **WHY IT MATTERS** — what breaks if the answer is wrong (e.g., "RICE without understanding Effort = decision based on wishful thinking; Phase 11 will have a shaky foundation")
   - **WHAT TO CONSIDER** — what to look at before choosing; whether to review prior phase output

3. **Option `description` — 3-5 sentences** with three elements:
   - **What happens technically**: which line in idea-brief changes, which later phases depend on this answer
   - **What the option means in simple terms** — without jargon:
     - Not "RICE score 80, Approach C" → "The RICE formula (Reach × Impact × Confidence / Effort) yields 80 for option C; this means C appears more justified by resources than A (60) or B (45) — but this is Claude's prediction, not a fact"
     - Not "Feasibility 3/3 ☑" → "All three feasibility blocks (Skills, Time, Tech) Claude marked as confirmed — this means the team has the expertise, there's room in the release window, and the tech stack isn't blocking. If any of this is TBD — Phase 11 Recommendation will come with a warning"
     - Not "strategic vector" → "The main direction we're heading: e.g., 'consolidate content delivery inside BeerLMS' — anything suggesting scope expansion beyond this direction will be flagged as scope creep in Phase 8-9"
   - **Hidden trade-off** — if the option has a consequence a junior might miss (e.g., "Mark recommendation as TBD" → "all downstream skills (write-prd, architecture-design) hard-refuse until status is Confirmed — this blocks the entire SDLC pipeline for this feature") — mention it directly in the description

**Prohibited:** terse English-only labels ("Confirm", "Adjust", "TBD"); one-line descriptions; technical terms without explanation; trade-offs hidden in follow-up.

**Why:** The audience for this skill — PMs and junior developers — speaks product language, not engineering jargon. They don't have full context of the SDLC pipeline. Explanations must be accessible; that accessibility is mirrored in `sdlc:architecture-design/references/ask-examples.md` and `sdlc:write-prd/references/ask-examples.md`.

**Planning mode compatibility:** Since all Write operations are concentrated in Phase 12 (post-ExitPlanMode), the skill starts correctly in any permission mode (default / acceptEdits / plan / Auto). If ExitPlanMode is unavailable (i.e., the session was not started in plan mode) — Phase 12 executes immediately after Phase 11, without a transition.

## Protocol

**14 phases. Phases 0-11 read-only. Phase 11.5 = ExitPlanMode. Phases 12-14 execute writes + self-check + commit propose.**

### 0. Pre-plan setup (read-only)

- **Read** `./templates/idea-brief.md` — load the skeleton into session memory (NO copy yet).
- **Read** `docs-new/foundation/GLOSSARY.md` (if it exists) — load the glossary into session state.
- **Verify** `docs/features/<slug>/idea-brief.md` does not exist with `status: Confirmed` (else: skip, update existing).
- **NO Write / Edit / mkdir.** Setup becomes one of the steps in the plan, which will be executed in Phase 12.

### 1. Idea capture (AskUserQuestion — mandatory)

One AskUserQuestion for raw paragraph: "Describe the idea in 1-3 sentences, in your own words". Persist verbatim in session memory as §1 Raw idea draft. Do not edit — this is the baseline.

### 2. Socratic deep dive (AskUserQuestion — mandatory)

Pick 3-5 questions from 5 categories based on idea-shape:
- **Problem clarity** (what exactly hurts, for whom, how often).
- **Solution validation** (why this solution, what was tried before).
- **Success criteria** (what does "it worked" mean — concrete metric).
- **Constraints** (timeline, budget, team capacity, dependencies).
- **Strategic fit** (how does this align with roadmap / OKR / business outcome).

Delivery: AskUserQuestion in batches of 2-3 (not all-at-once).

### 3. Glossary capture (deferred)

For each new domain term in user responses — add the term to the session-state list `pending_glossary_terms`. **Do not write** to GLOSSARY.md now — Write/Edit is not allowed in planning mode. Skip generic tech terms (HTTP, JSON, queue, cache, database). Terms are applied in Phase 12 (post-ExitPlanMode) before writing idea-brief.md.

### 4. Competitive research (Claude-driven, read-only)

Claude operates autonomously:
- WebSearch for 3-5 competitors / adjacent solutions.
- Builds a table: **Product · URL · Features · Value (1-5 per feature) · Gap** in session memory.
- Each row includes a footnote: date and search query used.
- If internal tool with no market equivalent — `N/A — internal tool` with reason.

No user input in this phase — Claude performs the research, the user reviews afterward.

### 5. Strategic approaches (3 parallel Agent.tool calls, read-only)

Shared prompt template, 3 personas execute in parallel through separate sub-agents:
- **Variant-A (Simplicity):** shortest path, MVP-style, minimum moving parts.
- **Variant-B (Differentiation):** wow-factor / strategic moat / unique angle.
- **Variant-C (Balanced):** trade-off between A and B.

Each sub-agent returns a 1-paragraph approach with:
- **Name** (3-5 words).
- **Thesis** (1 sentence, product language — NO tech terms like Redis/Postgres/Kafka).
- **For whom** (which segment from §3 Users).
- **Outcome metric** (1 KPI: baseline → target).
- **Key trade-off** (1 line).
- **Effort signal**: S / M / L.

### 6. Multi-perspective review (3 parallel Agent.tool calls, read-only)

Three personas execute in parallel through sub-agents, each seeing all 3 approaches from §5:
- **Engineer** — concerns / risks / blockers. Explicitly told in the prompt: "no library/DB names — abstract concerns only (latency, throughput, complexity, integration surface)".
- **Executive** — business value / opportunity cost / strategic fit.
- **UX-researcher** — user friction / discoverability / onboarding curve.

Each returns 3-5 bullets with concerns / value / risks for **each** of the 3 approaches.

Build the §8 Synthesis matrix (3 personas × 3 approaches) with 6-word justifications per cell (+/0/-) in session memory.

### 7. Trade-offs + edge cases (synthesis, read-only)

Claude synthesizes in session memory (no user input — review/edit only):
- Trade-offs per approach: pros / cons table.
- 5-8 edge cases that any approach must handle (data, integrations, failure modes, ops).

### 8. Devil's advocate (1 Agent.tool call with clean context, read-only)

Spawn 1 sub-agent with a clean context (NO upstream session memory), prompt: "Find how this could fail. 5-10 attack vectors with production signals (what exactly breaks, how it manifests in monitoring/customer churn/incident)".

The most critical attack vector → reserved for §10 Risks. The rest → for §9 Edge cases.

### 9. Claude-proposed RICE (AskUserQuestion — mandatory)

Claude computes R/I/C/E from upstream sections:
- **Reach** ← §3 Users (number of users / quarter affected).
- **Impact** ← §2 Problem severity + Executive perspective bullets.
- **Confidence** ← number of TBDs / open questions; many unresolved → 0.5; all facts concrete → 1.0.
- **Effort** ← Effort signal from §7 approaches (S = 1-2 person-weeks, M = 3-5, L = 6-12).

Compute `R × I × C / E`. AskUserQuestion per number (4 separate checkpoints or 1 multiSelect batch) with options: `Confirm N` / `Adjust higher` / `Adjust lower` / `Mark TBD`. The rationale in idea-brief cites the upstream section.

### 10. Claude-proposed Feasibility (read-only repo scan + AskUserQuestion — mandatory)

Claude scans the project repo (read-only `find`/`ls`/`Glob` over feature dirs `docs/features/`, `src/`, `app/`, `pkg/`, `services/`, project-specific paths) for adjacent features that already shipped similar tech / workflow.

Proposes 3 checkboxes:
- **Tech** ☑/☐ — with justification ("similar to <existing feature> in <module>").
- **Skills** ☑/☐ — with justification ("team already shipped <X>, same skill applies").
- **Time** ☑/☐ — with justification ("similar feature <X> shipped in <N> weeks").

AskUserQuestion per checkbox (3 separate or 1 multiSelect batch): `Confirm ☑` / `Flip to ☐ — <reason>` / `TBD`.

### 11. Recommendation synthesis (AskUserQuestion — mandatory)

Claude picks one of the 3 approaches from §5 and writes a 3-5 sentence rationale in session memory.

Rationale MUST explicitly cite:
- RICE score from §11.
- Feasibility state from §12.
- ≥1 multi-perspective synthesis matrix cell from §8.
- ≥1 competitive gap from §6.

AskUserQuestion for user confirmation: `Accept recommendation` / `Pick different approach` / `Mark recommendation as TBD`.

### 11.5. ExitPlanMode handoff (planning → execute)

Everything above exists in session memory only. Now the skill **calls `ExitPlanMode`** with a plan containing:

1. Create directory `docs/features/<slug>/` (if absent).
2. Copy template `./templates/idea-brief.md` → `docs/features/<slug>/idea-brief.md`.
3. Apply pending glossary terms (Phase 3 list) directly to `docs-new/foundation/GLOSSARY.md`.
4. Fill 15 sections + Related + DoD self-check in the new file from all session memory (Phases 1-11).
5. Update frontmatter: `status: Confirmed`, `value_score.{rice,state,confirmed_at}`, `feasibility_state: confirmed`.
6. Run Phase 13 self-check (regex, length, citations).
7. Propose commit + next owner.

If the ExitPlanMode tool is unavailable (skill was not started in plan mode) — skip this step and execute Phase 12 directly. The plan in session memory remains the same.

### 12. Execute: fill expanded idea-brief

After `ExitPlanMode` (or immediately if plan mode is not active):

- **mkdir** `docs/features/<slug>/` if absent.
- **Copy** template → `docs/features/<slug>/idea-brief.md`.
- **Apply** pending glossary terms by editing `docs-new/foundation/GLOSSARY.md` directly (one line per term, alphabetical, following its existing format), if needed.
- **Edit/Write** all sections 1-15 + Related + DoD self-check from session memory. Update frontmatter:
  - `status: Confirmed`
  - `value_score.rice: <N>`, `value_score.state: confirmed`, `value_score.confirmed_at: <today YYYY-MM-DD>`
  - `feasibility_state: confirmed`
  - `updated_at: <today>`

Parked approaches (2 non-recommended from §5) — in §14 with reason + revisit trigger.

### 13. Self-check vs DoD

Run all checks (Read + grep over the file just written):
- **15 sections present.** All 1-15 + Related + DoD self-check filled.
- **No anti-pattern terms in body.** Regex check (excluding DoD self-check meta-line): `\b(Postgres|Redis|Kafka|MySQL|SM-2|FSRS|Leitner|SQLAlchemy|gorm|JSONB)\b` + `p99`. **Word-boundary is important**: `chi` as a substring in "architecture" would be a false positive; use `\b`.
- **Length ≤ 5 pages** (~2200 words ±10%). If over — compress §5 Approaches paragraphs and §6 Competitive table.
- **Rationale citations.** §13 Recommendation cites §6 (1 gap) + §8 (1 cell) + §11 (RICE) + §12 (Feasibility).

If any check fails → identify the offending section, re-Edit it, then re-check.

### 14. Propose commit + next owner

Suggest the commit (do not auto-execute):

```
01: idea-brief for <slug>
```

Next owner: PM + Tech Lead → `sdlc:write-prd <slug>` (gate now requires idea-brief.md with `status: Confirmed`).

ADR (`sdlc:architecture-design`) is NOT called at gate 1 — this is a gate 3 concern (after sad.md (architecture-design) §Trade-offs). If the recommendation from §13 looks like a hard-to-reverse technical choice — note it in §15 Open questions, but don't open an ADR thread here.

## Questions for discussion

- What slug — kebab-case, short, no date?
- Which segment of users suffers most from this problem?
- Why now — what trigger (incident / contract / deadline)?
- Which metric do we use to measure that it worked?
- Which of the 3 strategic approaches aligns best with how the team usually solves similar tasks?
- Do you agree with Claude-proposed RICE numbers — or do they need adjustment?
- Are all 3 Feasibility checkboxes truly confirmed, or are some still unknown?

## Definition of Done

- `docs/features/<slug>/idea-brief.md` created and committed.
- All 15 sections filled (no empty H2, `<!-- TBD -->` allowed where honestly missing).
- No anti-pattern tech terms in body (verified by internal regex check, word-boundaries on).
- Length ≤ 5 pages (~2200 words ±10%).
- Frontmatter `status: Confirmed`, `value_score.state: confirmed`, `feasibility_state: confirmed`, `confirmed_at: <date>`.
- §13 Recommendation rationale cites RICE (§11) + Feasibility (§12) + ≥1 multi-perspective cell (§8) + ≥1 competitive gap (§6).
- **AskUserQuestion checkpoints actually fired** in Phases 1, 2, 9, 10, 11 (verify through the user-message trail). If even one was fabricated → artifact is NOT DoD-valid.
- Next-stage owner assigned (PM + Tech Lead → `sdlc:write-prd`).

## Anti-patterns

- **Inventing competitors because "we need to write something".** Better `N/A — internal tool` with reason than fake research. Competitors = "all the same" without links — that's not research, that's laziness. Phase 4 must produce real URLs + features + value ratings.
- **User-input RICE ("calculator game").** Old skill asked user for Reach/Impact/Confidence/Effort — user has no grounding to answer. New flow: Claude proposes from upstream sections (Users → Reach, Executive perspective → Impact, TBDs → Confidence, Effort signal → Effort). User only confirms or adjusts.
- **Tech terms in idea-brief body** (Postgres, Redis, Kafka, SM-2, FSRS, p99 latency, JSONB). This is a PRODUCT brief. Tech lives in PRD §6 + sad.md (architecture-design) + ADR (gate 3+). Phase 13 self-check enforces this.
- **Single approach in §5.** Strategic approaches MUST be 3 (Simplicity / Differentiation / Balanced). One approach = decision already taken, nothing to evaluate.
- **Skip multi-perspective review.** Engineer-only view → blind to business / UX risks. Executive-only view → blind to implementation cost. Need all 3 perspectives in §6 to balance.
- **Devil's advocate from same session context.** Phase 8 MUST spawn sub-agent with clean context, otherwise it's biased by all the optimism upstream.
- **Skip Feasibility repo scan.** Phase 10 must do `find`/`ls` over feature dirs and cite adjacent shipped features. "Tech: ☑ — we know how" without citation = guess.
- **Recommendation without rationale citing 4 upstream sections.** Phase 11 rationale MUST cite §6 (competitive gap), §8 (multi-perspective cell), §11 (RICE), §12 (Feasibility). Otherwise it's "I feel like A".
- **Propose ADR at end of phase 14.** ADR moves to gate 3 (after sad.md (architecture-design)). Gate 1 is pure product — no tech locks-in.
- **Brainstorm-style transcript dump.** §14 Parked & rejected is structured (table with status / reason / revisit trigger), not raw chat log.
- **Solution-mode prose in §2 Problem.** "We need to add Redis" → wrong section. §2 is the problem only; solutions live in §7 Approaches.
- **Fabricating user answers under Auto Mode.** `Auto Mode Active` system-reminder means "work without stopping for clarifying questions" — this applies to pause-to-check moments, not the in-flow AskUserQuestion checkpoints of this skill. Phases 1, 2, 9, 10, 11 MUST fire real AskUserQuestions; generating raw ideas / Socratic answers / RICE confirmations / Feasibility confirmations / recommendation acceptance without user input = reconstruction artifact, not an interview. If AskUserQuestion is rejected due to permission denial — stop and notify the user, don't bypass.
- **Writing files inside planning mode.** Phases 0-11 are read-only. If the skill starts in plan mode and you try Write/Edit/mkdir before ExitPlanMode (Phase 11.5) — permission denied. Keep all artifact content in session memory until Phase 12.

## Template

→ [./templates/idea-brief.md](./templates/idea-brief.md)

## Example invocation

> **User:** "Interview a feature: 3 customers complained about 429s from noisy neighbors this week — we need per-user rate limiting"
>
> **Skill behavior (planning-mode-friendly flow):**
>
> **— Plan mode (read-only) —**
> 1. **Phase 0** — suggests slug `rate-limiting-per-user`. User confirms. **Read** template and `docs-new/foundation/GLOSSARY.md`. NO copy yet.
> 2. **Phase 1** — AskUserQuestion: "Describe the idea in 1-3 sentences". Captures raw paragraph verbatim in session memory as §1 draft.
> 3. **Phase 2** — Socratic batch 1 (AskUserQuestion): "Which customer segment is affected?" "How frequently does this happen?" Batch 2 (AskUserQuestion): "What have you tried before?" "What does 'it worked' mean — which metric?"
> 4. **Phase 3** — User response mentions "tenant" → added to `pending_glossary_terms` (applied to GLOSSARY.md in Phase 12, since the write is deferred).
> 5. **Phase 4** — Claude runs WebSearch: Kong per-consumer, Tyk, AWS API Gateway throttling, Cloudflare rate-limit. Builds §6 table in session memory.
> 6. **Phase 5** — 3 parallel sub-agents (single message):
>    - A (Simplicity): "Per-tenant request quota at edge proxy" — fastest, generic, S effort.
>    - B (Differentiation): "Adaptive per-tenant quota based on plan-tier" — pricing leverage, L effort.
>    - C (Balanced): "Static per-tenant quota with self-serve config" — M effort, customer can adjust.
> 7. **Phase 6** — 3 sub-agents (Engineer / Executive / UX) review all 3 in parallel. Engineer stays abstract (no Redis/nginx). Synthesis matrix in session memory.
> 8. **Phase 7** — Claude synthesizes trade-offs + 6 edge cases in session memory.
> 9. **Phase 8** — sub-agent with clean context: "How does this fail?" Returns 7 attack vectors. Top → reserved for §10 Risks.
> 10. **Phase 9** — Claude proposes RICE: R=200, I=2, C=0.8, E=3 → 107. AskUserQuestion per number; user adjusts Effort to 4 → Score = 80.
> 11. **Phase 10** — Claude scans repo (read-only): finds adjacent `usage-metering`. Proposes 3 ☑. AskUserQuestion per checkbox; user confirms all 3.
> 12. **Phase 11** — Claude picks **Approach C**. Rationale cites: RICE=80, Feasibility 3/3 ☑, Engineer bullet, Kong gap. AskUserQuestion: user accepts.
>
> **— ExitPlanMode handoff —**
> 13. **Phase 11.5** — `ExitPlanMode` with plan: "create dir, copy template, add 'tenant' to GLOSSARY.md, fill 15 sections, run self-check, propose commit".
>
> **— Execute (post-plan) —**
> 14. **Phase 12** — `mkdir docs/features/rate-limiting-per-user/`, copy template, add "tenant" to `docs-new/foundation/GLOSSARY.md`, Write idea-brief.md with all sections. Frontmatter `status: Confirmed`, `confirmed_at: 2026-05-21`.
> 15. **Phase 13** — self-check: 15 sections ✓, no Postgres/Redis in body ✓, 4.2 pages ✓, citations ✓.
> 16. **Phase 14** — Commit message proposed: `01: idea-brief for rate-limiting-per-user` (user executes). Next: PM + Tech Lead → `sdlc:write-prd rate-limiting-per-user`.