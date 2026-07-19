---
status: Confirmed
owner: "mmizin"
reviewers: []
updated_at: "2026-07-08"
feature_size: M     # set by sdlc:classify-size, not here
stage: "01"
ticket: "<ticket-id>"
value_score:
  rice: 5
  state: confirmed
  confirmed_at: "2026-07-08"
feasibility_state: confirmed
---

<!-- Stage 01 → see .claude/skills/interview/SKILL.md -->
<!-- Why: capture the idea before it's forgotten or retold incorrectly -->

# Idea Brief — CryptoSandboxQA

## 1. Raw idea
CryptoSandboxQA is a fully functional cryptocurrency exchange sandbox that simulates real-world exchange operations in a safe, controlled environment, so QA engineers can learn, test, and master quality-assurance practices across a modern full-stack application. This update re-confirms the current vision — a realistic crypto-exchange sandbox for QA-engineer training — and enriches it into a structured product brief with competitive research, scored approaches, and a clear recommendation.

## 2. Problem
Junior QA engineers have no safe, realistic place to practice testing financial systems before their first fintech job. Today they poke at live or staging exchange testnets, which are unsafe, unstable, and not built for structured learning — teaching wrong habits or nothing at all. Testing an exchange demands understanding of order lifecycle, fund locking, real-time price updates, and settlement mechanics that generic practice apps never expose.

## 3. Users
- **Primary:** Junior QA engineers onboarding into their first role or training program, who have never tested a real financial system.
- **Secondary:** Teams and training leads who provision the sandbox and seed reproducible scenarios for their cohort.
- **Frequency / segment:** Estimated ~50 learners per quarter for a self-hosted internal training tool.
- **Outcome metric:** Test scenarios completed per learner (baseline 0 → target ~20 covering order lifecycle, balance validation, edge cases).

## 4. Why now
No external incident or contract deadline — this is a quality-first initiative. The full exchange sandbox has already shipped (orders, wallets, transactions, admin tooling, realtime), so the moment is right to layer structured QA-training scenarios on top of proven mechanics rather than let the sandbox sit as raw infrastructure.

## 5. Out of scope
- Real cryptocurrency blockchain integration
- Fiat on/off-ramps
- KYC/AML workflows
- Multi-exchange features
- Advanced derivatives (futures, options)
- Automatic auto-grading of learner tests (deferred to a later phase — see §14 Approach B)

## 6. Competitive analysis
| # | Product · URL | Features | Value (1-5) | Gap |
|---|---|---|---|---|
| 1 | Binance Testnet · https://academy.binance.com/en/glossary/testnet | Futures demo, 3,000 virtual USDT, mirrors production API | Realism 5, Learning-design 1 | No seed data, admin tools, or QA scenarios — realistic but not teaching-oriented |
| 2 | BingX Demo · https://bingx.com/en/learn/article/best-crypto-platforms-with-demo-trading-for-beginners | 100,000 virtual USDT, perpetual futures simulation, copy trading | Realism 4, Learning-design 1 | Trading practice only; no QA/testing infrastructure or inspectable internals |
| 3 | QA Learning Hub · https://qalearninghub.com/ | UI Playground, Banking App, E-commerce flow, API sandbox | Realism 2, Learning-design 4 | QA-designed but generic apps — no order book, fund locking, or settlement complexity |
| 4 | SauceDemo / DemoQA · https://www.saucedemo.com/ | Stable demo web apps for automation practice | Realism 2, Learning-design 3 | Toy shop flows; no financial-system mechanics to test |
| 5 | SoftwareTestPilot · https://softwaretestpilot.com/qa-practice-hub | UI automation labs, Swagger API testing against live API | Realism 2, Learning-design 4 | Generic practice targets; no realistic exchange domain |

Footnotes: rows searched 2026-07-08, queries "crypto exchange testnet sandbox for practice trading Binance Coinbase" and "QA testing training platform hands-on practice real application sandbox".

**Consolidated gap:** No product combines *realistic exchange mechanics* (order lifecycle, locking, settlement) with *QA-training design* (seed data, admin tools, inspectable DB, edge-case scenarios). Testnets are realistic-but-not-teaching; QA apps teach-but-aren't-realistic.

## 7. Strategic approaches

### Approach A — Curated QA scenario library
- **Thesis**: Ship a curated set of guided QA test scenarios and checklists on top of the existing sandbox.
- **For whom**: Junior QA engineers who need a starting path through realistic test cases.
- **Outcome metric**: Scenarios completed per learner (0 → 20).
- **Key trade-off**: Fast and simple, but no way to measure completion.
- **Effort signal**: S
- **Recommended?** ◯

### Approach B — Auto-graded QA challenge mode
- **Thesis**: An assessment engine validates a learner's tests against expected outcomes, with gamified progression.
- **For whom**: Junior QA who want proof of mastery and a motivating challenge loop.
- **Outcome metric**: Assessment pass rate (target ~80%).
- **Key trade-off**: Biggest "wow" and strongest proof of learning, but a large build with auto-validation risk.
- **Effort signal**: L
- **Recommended?** ◯

### Approach C — Scenario library + progress tracking
- **Thesis**: Curated scenarios with completion tracking and hints, guiding learners without a full auto-grader.
- **For whom**: Junior QA onboarding who need guided progression and a measurable path.
- **Outcome metric**: Scenarios completed per learner (0 → 20), now trackable.
- **Key trade-off**: Balanced value; defers automatic test validation to later.
- **Effort signal**: M
- **Recommended?** ●

## 8. Multi-perspective feedback

### Engineer
- All three build on shipped exchange mechanics — low core-tech risk.
- Auto-grading (B) adds a hard validation surface: judging a learner's test correctness is non-trivial.
- Progress tracking (C) needs modest new persistence, no new subsystems.

### Executive
- C matches the quality-first stance without over-investing before demand is proven.
- B has the strongest differentiation story but the weakest near-term cost/benefit.
- A ships fastest but can't demonstrate the training outcome — weak business narrative.

### UX-researcher
- Juniors need guided progression and feedback; a bare library (A) leaves them lost.
- Auto-grading (B) is motivating but risks harsh/opaque failures that discourage beginners.
- C's tracking + hints gives a gentle, discoverable path — best onboarding curve.

### Synthesis matrix
|         | Engineer | Executive | UX |
|---------|:--------:|:---------:|:--:|
| App. A  | +        | -         | -  |
| App. B  | -        | 0         | 0  |
| App. C  | +        | +         | +  |

- A/Eng +: reuses mechanics, minimal new code.
- A/Exec −: no measurable training outcome delivered.
- A/UX −: learners lack guidance and progression.
- B/Eng −: auto-validating learner tests is hard.
- B/Exec 0: high differentiation, high cost, unproven demand.
- B/UX 0: motivating but risks discouraging harsh failures.
- C/Eng +: modest tracking on proven base, no new subsystems.
- C/Exec +: right investment for quality-first, measurable outcome.
- C/UX +: guided progression with hints, gentle onboarding.

## 9. Trade-offs and edge cases

### Trade-offs per approach
| Approach | Pros | Cons |
|---|---|---|
| A | Fastest to ship, minimal code | Can't measure the success metric; learners unguided |
| B | Strongest proof of mastery, differentiated | Large build; auto-validation risk; contradicts 8-week Time |
| C | Measurable, guided, feasible on existing base | Defers automatic test validation to later |

### Edge cases
- Learner marks a scenario complete without actually understanding it (metric gaming).
- Sandbox mechanics drift from real-exchange behavior, teaching wrong habits.
- Reproducible seed data must reset cleanly between learners / cohorts.
- Concurrent learners sharing an instance must not corrupt each other's balances/orders.
- Progress state must survive a full database reset without orphaning history.
- Hints must not leak so much that scenarios stop teaching.
- Admin/impersonation flows must stay isolated from a learner's own tracked progress.

## 10. Risks
- **Top attack vector (from devil's advocate):** Learners complete scenarios without real understanding — the "scenarios completed" metric rises while actual QA readiness does not, masking a training failure until it shows up on the job.
- Sandbox behavior diverging from real exchanges could teach incorrect testing assumptions.
- Quality-first with no deadline invites scope creep in scenario-content ambition (flagged by Executive perspective).
- Thin scenario content would undercut the moderate Impact assumed in RICE.

## 11. RICE — Claude proposed
- **Reach (R)**: 50 — cites §3 Users (self-hosted junior-QA training tool, ~50 learners/quarter).
- **Impact (I)**: 1 — moderate; helpful but one of several tools a junior uses (cites §2 + Executive perspective in §8).
- **Confidence (C)**: 0.8 — vision re-confirmed and metric clear; one main unknown is unbuilt scenario content (cites §15 open questions).
- **Effort (E)**: 8 person-weeks — quality-first M-sized balanced approach (cites §7 Approach C effort signal, adjusted higher).
- **RICE = R × I × C / E = 50 × 1 × 0.8 / 8 = 5.0**
- **State**: confirmed

## 12. Feasibility — Claude proposed
- [☑] **Tech**: Exchange mechanics already ship — `orders`, `wallets`, `transactions`, admin impersonation, `websocket` modules — plus an existing frontend `qa` area; scenarios + tracking build on top.
- [☑] **Skills**: Team already shipped the full-stack sandbox (NestJS backend, Next.js frontend, realtime) — exactly the skillset a scenario layer needs.
- [☑] **Time**: ~8 weeks realistic on the existing base; comparable in scope to shipped modules like `deposits` / `portfolio`.
- **State**: confirmed

## 13. Recommendation
**Selected: Approach C** — curated scenario library + progress tracking on the existing sandbox. It scores RICE = 5.0 (§11), an honest number for a quality-first internal tool, and rests on **Feasibility 3/3 ☑** (§12) since every dependency is a module that already ships. The **C/UX and C/Executive synthesis cells are both "+"** (§8) — C is the only approach that gives juniors guided, measurable progression without the auto-validation build risk of B. It directly fills the **competitive gap** (§6): exchange testnets are realistic-but-not-teaching and QA toy-apps teach-but-aren't-realistic, while C is both.

**Locked-in pointer**: write-prd builds a curated QA-scenario system with per-learner completion tracking and hints on the existing sandbox; automatic test validation is explicitly out of the first version.

## 14. Parked & rejected approaches
| # | Approach | Status | Reason | Revisit trigger |
|---|---|:---:|---|---|
| A | Curated QA scenario library | parked | No completion measurement — can't prove the success metric | If speed-to-first-version becomes the binding constraint |
| B | Auto-graded QA challenge mode | parked | L-effort contradicts confirmed 8-week Time box; auto-validation risk | Once C proves demand and auto-validation approach is spiked |

## 15. Open questions
- [ ] What defines "scenario complete" — self-check, admin review, or automated signal? — owner: mmizin, due: write-prd
- [ ] How much hinting is right before scenarios stop teaching? — owner: mmizin, due: write-prd
- [ ] How is per-learner progress reset relative to the sandbox database reset? — owner: mmizin, due: write-prd

## Related
- `docs-new/product/` — product docs home
- `CLAUDE.md` — order lifecycle, locking, and admin tooling reference
- `ARCHITECTURE.md` — backend module breakdown

## DoD self-check
- [x] 15 sections present
- [x] No anti-pattern terms (Postgres/Redis/etc.) in body
- [x] Length ≤ 5 pages (~2200 words)
- [x] Frontmatter status: Confirmed
- [x] RICE confirmed (state: confirmed)
- [x] Feasibility confirmed (state: confirmed)
- [x] Recommendation present with rationale citing 4 upstream sections (§6, §8, §11, §12)
