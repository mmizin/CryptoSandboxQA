---
name: test-design-techniques
description: >-
  Applies structured test design techniques (equivalence partitioning, boundary
  value analysis, state transitions, pairwise combinations, decision tables,
  CRUD/process cycles, exploratory charters, error guessing) to produce test
  cases, scenarios, and coverage mapping with risk awareness. Produces test
  design documents with test data and expected results; optionally outlines test
  plans when the user asks for strategy-level deliverables. Use when the user
  asks for test cases, test scenarios, test design, coverage, or QA scenarios
  for a feature, API, UI, or workflow—not when they only want code changes.
---

# Test design techniques

## Purpose

Test design should **detect critical defects**, **reduce redundant tests** while keeping coverage meaningful, and **map to requirements** in a structured, reproducible way—not purely ad-hoc lists. Tie effort to **risk** where it matters (e.g. money, security, data integrity): prioritize scenarios that address higher risk first.

## When to use

Use this skill when the user asks for **test cases**, **scenarios**, **coverage**, **test design**, or **QA scenarios** for functionality (API, UI, workflows, business rules). If the request is ambiguous between a **test plan** (strategy, scope, schedule) and a **test design / case list** (scenarios, data, expected results), ask one short clarifying question or default to **test design / cases** and offer an optional test-plan outline.

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

## Documentation: test design vs test plan

- **Test design / test cases** (default output): scenarios, test data, expected results, and coverage mapping—often documented in a **test design document** or test-case specification. (Do not confuse with **Test-Driven Development**; here “test design” means planned scenarios, not a dev methodology.)
- **Test plan** (only if the user asks): higher-level **strategy**, scope, schedule, entry/exit criteria, resources. Do not substitute a test plan for a concrete case list when the user wanted scenarios.

## Logical vs physical

- **Logical** (default): scenarios, coverage, techniques used, risks addressed.
- **Physical**: concrete automation scripts, tool commands, or data setup scripts—**out of scope** unless the user asks. If they ask for automation, follow [.cursor/rules/no-unrequested-tests.mdc](../../rules/no-unrequested-tests.mdc) and, for UI tests, [.cursor/rules/playwright-ui-tests.mdc](../../rules/playwright-ui-tests.mdc).

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
3. **Coverage table**: technique or category → scenario ID or title (optional **requirement ID** column).
4. **Scenarios**: ID or title, preconditions, steps, test data, **expected result** (oracle).
5. If the output will map to **data-driven / matrix** tests later: row **`name`** pattern per [.cursor/rules/test-scenario-conventions.mdc](../../rules/test-scenario-conventions.mdc)—stable expected outcome first, then short description of inputs and intent.

## Optional QA technique tags

Optional tags such as `[Boundary]` or `[Stress]` in scenario or row names are allowed **only when accurate**—see [.cursor/rules/test-scenario-conventions.mdc](../../rules/test-scenario-conventions.mdc). If unsure, omit the tag.

## Boundary with automated tests

Producing test cases or test design **does not** mean adding or extending automated tests. Follow [.cursor/rules/no-unrequested-tests.mdc](../../rules/no-unrequested-tests.mdc): do not create or expand `*.spec.ts` or other test code unless the user explicitly asks.

## Anti-patterns

- Ad-hoc bullet lists with no coverage rationale or technique mapping.
- Duplicate scenarios under different names.
- Treating exploratory sessions as fully scripted regression coverage without stating limits.
- Delivering a full **test plan** when the user only asked for **test cases**.
- Implementing or expanding automated tests when the user did not ask.

## Project note

Do not store custom skills under `~/.cursor/skills-cursor/` (reserved for Cursor built-in skills). This skill lives under `.cursor/skills/` in the repository.
