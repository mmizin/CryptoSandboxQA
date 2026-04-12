---
name: test-design-techniques
description: >-
  Applies structured test design techniques (equivalence partitioning, boundary
  value analysis, state transitions, pairwise combinations, decision tables,
  CRUD/process cycles, exploratory charters, error guessing) to produce test
  cases, scenarios, and coverage mapping with risk awareness. For features
  implemented in this repo, ground scenarios in ARCHITECTURE.md, QA docs,
  OpenAPI, and source before listing cases. Where it helps and is not noisy,
  include sample API payloads/responses or UI references (e.g. screenshot notes).
  When output will feed Jira Test/Subtask creation, use the Jira handoff shape
  (layers, subtask granularity, evidence). Produces test design documents with
  test data and expected results; optionally outlines test plans when the user
  asks for strategy-level deliverables. Use when the user asks for test cases,
  test scenarios, test design, coverage, or QA scenarios for a feature, API, UI,
  or workflow—not when they only want code changes.
---

# Test design techniques

## Purpose

Test design should **detect critical defects**, **reduce redundant tests** while keeping coverage meaningful, and **map to requirements** in a structured, reproducible way—not purely ad-hoc lists. Tie effort to **risk** where it matters (e.g. money, security, data integrity): prioritize scenarios that address higher risk first.

## When to use

Use this skill when the user asks for **test cases**, **scenarios**, **coverage**, **test design**, or **QA scenarios** for functionality (API, UI, workflows, business rules). If the request is ambiguous between a **test plan** (strategy, scope, schedule) and a **test design / case list** (scenarios, data, expected results), ask one short clarifying question or default to **test design / cases** and offer an optional test-plan outline.

When the feature **lives in this repository**, read **[ARCHITECTURE.md](../../ARCHITECTURE.md)**, **[docs/QA_TESTING_FEATURES.md](../../docs/QA_TESTING_FEATURES.md)**, and relevant **OpenAPI** / implementation files—**this skill owns that research** before listing cases. Derive steps and **oracles** (routes, payloads, validation, UI state) from that evidence. If the work will be **pushed to Jira**, structure cases per [Jira handoff (when creating tickets)](#jira-handoff-when-creating-tickets); loading the **Story** and linked issues in Jira happens when executing [.cursor/skills/jira-test-tickets-from-cases/SKILL.md](../jira-test-tickets-from-cases/SKILL.md) **after** test cases exist. If the feature is external or unspecified, state assumptions explicitly.

## Core techniques

| Technique | Role |
| --------- | ---- |
| **Equivalence partitioning** | Split inputs into valid/invalid classes; pick representative values per partition. |
| **Boundary value analysis** | Exercise min, max, and near-boundary values where faults cluster (pairs with equivalence partitioning). |
| **State transition testing** | Cover valid and invalid transitions when behavior depends on state (workflows, lifecycles). |
| **Pairwise testing** | Cover **all pairs** of interacting parameters when combination explosion is a risk; orthogonal arrays are an optional extension. |
| **Exploratory testing** | Charter-style sessions using experience; **complements** scripted cases—it does not replace explicit critical paths. |

## TMap / general QA techniques

Apply when the feature fits:

| Technique | Role |
| --------- | ---- |
| **Decision table** | Multiple conditions → outcomes (business rules as a matrix). |
| **Data cycle test** | CRUD (and similar) lifecycles on entities. |
| **Process cycle test** | End-to-end business process or user journey across steps and handoffs. |
| **Error guessing** | Heuristics and knowledge of past defects; label as experience-based, not random clicking. |

## Small supplements

- **Risk-based prioritization** — Order or tag scenarios by risk/impact.
- **Requirements traceability** — Optional column: requirement or user story ID → scenario (lightweight traceability when useful).
- **Test data and oracles** — Explicit prerequisites, inputs, and **expected results** per scenario.
- **Environment / compatibility** — When relevant (browsers, roles, API versions), add a small matrix without bloating every feature.
- **Automation placement** — When cases may become Playwright UI tests, record **target folder** and **planned run tags** (see [Automation placement (planned UI)](#automation-placement-planned-ui) below). This is planning metadata, not a substitute for the optional `[Boundary]` / `[Stress]` row tags in [.cursor/rules/test-scenario-conventions.mdc](../../rules/test-scenario-conventions.mdc).
- **Optional illustrations** — When it clarifies the oracle and **would not be overkill**, add:
  - **API:** a concise **request** example (JSON body, key headers) and **response** example (status + representative success/error body) taken from OpenAPI, Swagger, or observed behavior—not full schemas unless the user needs them.
  - **UI:** a **screenshot** attachment or a short note on **what to capture** (state before/after, error region) when visuals matter (layout, modals, validation placement). Skip screenshots for every trivial row of a matrix.

## Data-driven scenarios: one logical case, not many clones

When the **same flow** applies and only **inputs or expected outcomes** change (equivalence classes, boundary table, login valid vs invalid, API validation matrix):

- Represent it as **one** scenario or **one** data-driven group: shared **steps** plus a **data table** (parameters → expected result).
- When mapping to Jira (see [.cursor/skills/jira-test-tickets-from-cases/SKILL.md](../jira-test-tickets-from-cases/SKILL.md) **Subtask granularity**), use **one `Subtask`** for that whole matrix and **list all parameter rows** there—do **not** split into separate subtasks such as “valid login” and “invalid login” if the only difference is the data passed through the same steps.

Create a **separate** scenario or subtask only when something **materially differs**: different **navigation** or **screens**, different **API** or **side effects**, different **preconditions** or **cleanup**, or a **distinct risk** that deserves its own trace—not a mere parameter swap on the same script.

## Documentation: test design vs test plan

- **Test design / test cases** (default output): scenarios, test data, expected results, and coverage mapping—often documented in a **test design document** or test-case specification. (Do not confuse with **Test-Driven Development**; here “test design” means planned scenarios, not a dev methodology.)
- **Test plan** (only if the user asks): higher-level **strategy**, scope, schedule, entry/exit criteria, resources. Do not substitute a test plan for a concrete case list when the user wanted scenarios.

## Logical vs physical

- **Logical** (default): scenarios, coverage, techniques used, risks addressed.
- **Physical**: concrete automation scripts, tool commands, or data setup scripts—**out of scope** unless the user asks. Naming a **planned** target folder or tags in a test-design table is still **logical** (traceability to future automation). If they ask for automation, follow [.cursor/rules/no-unrequested-tests.mdc](../../rules/no-unrequested-tests.mdc) and, for UI tests, [.cursor/rules/playwright-ui-tests.mdc](../../rules/playwright-ui-tests.mdc).

## Automation placement (planned UI)

Use this when the user cares **where** Playwright specs will live and **how** runs will be filtered—so automation work can pick the right directory and tags without reclassifying cases.

**Target folder** under `tests/ui-tests/tests/` (this repo):

| Planned level | Typical content | Folder |
| ------------- | --------------- | ------ |
| **E2E** | Multi-step flows, journeys, cross-page behavior | `e2e/` |
| **Narrow UI** | Field/form validation matrices, single-page checks (still Playwright) | `unit/` |

The `unit/` name means **isolated UI checks** here, not Jest/Vitest unit tests—see [.cursor/rules/playwright-ui-tests.mdc](../../rules/playwright-ui-tests.mdc).

**Run profile (tags)** — orthogonal to folder. Record planned tags so CI/smoke/regression strategy stays explicit:

| Concept | How to capture |
| ------- | -------------- |
| **Smoke** / **merge gate** | Planned tags such as `@smoke`, `@merge-gate` (see Playwright rule vocabulary). |
| **Regression** | Often a **suite or job** (e.g. all e2e except smoke-only, or nightly full run), not a duplicate tree of folders. Optional `@regression` if the team standardizes it and documents it next to other tags. |
| **Client validation** | `@client-validation` for matrices aligned with `tests/ui-tests/tests/unit/`. |

Do **not** use `@unit` for Playwright—reserved for non-browser unit test runners.

**Separation from QA technique tags:** `[Boundary]`, `[Stress]`, etc. describe **test-design intent** on a row or scenario name. **Automation target** and **planned tags** are separate columns or fields so reviewers can see both without conflating them.

## Technique selection workflow

Execute in a lightweight order; skip steps that do not apply:

1. Identify **variables**: inputs, states, environment, permissions, data lifecycles.
2. **Equivalence partitioning + boundary value analysis** for ordered domains and field validation.
3. **State transition testing** for lifecycle- or workflow-heavy features.
4. **Pairwise** (or other reduced combination strategies) when many parameters interact.
5. **Decision tables** for multi-condition rules.
6. **Data cycle** and **process cycle** tests when the feature is entity- or process-centric.
7. **Exploratory charters** and **error guessing** for residual risk or unclear specifications.
8. **Non-functional** angles only if in scope (e.g. optional `[Stress]` in row names per conventions below).

## Output template

Structure the answer for reviewability:

1. **Assumptions** and **scope** / **out of scope**.
2. **Risk notes** (brief): what must not break; what was prioritized.
3. **Coverage table**: technique or category → scenario ID or title; optional **requirement ID**; when UI automation is in scope, optional **automation target** (`e2e` / `unit` or path under `tests/ui-tests/tests/`) and **planned tags** (e.g. `@smoke`, `@merge-gate`, `@client-validation`).
4. **Scenarios**: ID or title, preconditions, steps, test data, **expected result** (oracle); optional **automation target** and **planned tags** per row when helpful. For API cases, optional **request/response examples** in fenced code blocks when useful; for UI, optional **screenshot** or “capture” note when useful (see [Small supplements](#small-supplements)).
5. If the output will map to **data-driven / matrix** tests later: row **`name`** pattern per [.cursor/rules/test-scenario-conventions.mdc](../../rules/test-scenario-conventions.mdc)—stable expected outcome first, then short description of inputs and intent. Prefer **one** matrix block per flow rather than many near-duplicate scenarios—see [Data-driven scenarios: one logical case, not many clones](#data-driven-scenarios-one-logical-case-not-many-clones).
6. If the next step is **Jira Test/Subtask** creation: follow [Jira handoff (when creating tickets)](#jira-handoff-when-creating-tickets) so the case list maps cleanly to [.cursor/skills/jira-test-tickets-from-cases/SKILL.md](../jira-test-tickets-from-cases/SKILL.md).

## Jira handoff (when creating tickets)

Use this when the user will create issues with [.cursor/skills/jira-test-tickets-from-cases/SKILL.md](../jira-test-tickets-from-cases/SKILL.md) (or has asked for test design **before** that skill runs). **Repository and Story research** split: **test-design-techniques** produces grounded cases and **Evidence**; the Jira skill loads the **Story** in Jira and creates **`Test`** / **`Subtask`** issues—see that skill’s [Workflow](../jira-test-tickets-from-cases/SKILL.md#workflow-command-order).

Deliver a variant of the test design that is easy to **copy into Jira**:

| Expectation | What to provide |
| ----------- | ---------------- |
| **Layers** | Every case is labeled **API**, **UI**, or **Integration** (the Jira skill emits **one `Test` issue per non-empty layer**). |
| **Subtask mapping** | **One** scenario row (or **one** matrix group with a data table) ↔ **one** future **Subtask** title, except where [.cursor/skills/jira-test-tickets-from-cases/SKILL.md](../jira-test-tickets-from-cases/SKILL.md) allows a single subtask for a full matrix—see **Subtask granularity** there and [Data-driven scenarios](#data-driven-scenarios-one-logical-case-not-many-clones) here. |
| **Evidence** | Short pointers for the **`Test`** issue description: repo paths, OpenAPI operations, `data-testid`, linked Jira keys reviewed—so the agent does not re-research from scratch. |
| **Naming** | Scenario titles readable as **`TC-<Layer>-<NN>:`** subtask summaries (see Jira skill templates). |
| **Coverage overview** | A small table: **Layer** → list of case titles that will become subtasks (or one row per matrix group). |

If the user has **not** asked for Jira yet but might, still using **API** / **UI** / **Integration** groupings in the coverage table makes later handoff trivial.

## Optional QA technique tags

Optional tags such as `[Boundary]` or `[Stress]` in scenario or row names are allowed **only when accurate**—see [.cursor/rules/test-scenario-conventions.mdc](../../rules/test-scenario-conventions.mdc). If unsure, omit the tag.

## Boundary with automated tests

Producing test cases or test design **does not** mean adding or extending automated tests. Follow [.cursor/rules/no-unrequested-tests.mdc](../../rules/no-unrequested-tests.mdc): do not create or expand `*.spec.ts` or other test code unless the user explicitly asks.

## Anti-patterns

- **Generic** scenarios (e.g. “enter valid credentials”) with no **repo- or spec-backed** oracles when the behavior is implemented in this codebase.
- **Splitting** a pure **data-driven** flow into many separate scenarios or Jira subtasks when only **parameters** differ—use one matrix / one subtask unless the flow or risk genuinely diverges.
- Ad-hoc bullet lists with no coverage rationale or technique mapping.
- Duplicate scenarios under different names.
- Treating exploratory sessions as fully scripted regression coverage without stating limits.
- Delivering a full **test plan** when the user only asked for **test cases**.
- Implementing or expanding automated tests when the user did not ask.

## Project note

Do not store custom skills under `~/.cursor/skills-cursor/` (reserved for Cursor built-in skills). This skill lives under `.cursor/skills/` in the repository.
