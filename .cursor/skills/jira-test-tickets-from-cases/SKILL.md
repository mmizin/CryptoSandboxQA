---
name: jira-test-tickets-from-cases
description: >-
  Creates Jira Test and Subtask issues from categorized test cases (API, UI,
  Integration) using the Atlassian MCP. Subtask bodies must include full data
  matrices with explicit parameter values per row, planned Playwright tags when
  provided, and row counts—no abbreviated or umbrella placeholder rows unless
  the user scoped smoke-only. The Story is never created here: the user supplies
  an existing Story (issue key or browse URL). If test cases are not provided
  yet, run design-test-cases first, then materialize issues. One Test issue
  per non-empty layer, link to Story. Use when pushing test design to Jira via
  MCP.
---

# Jira test tickets from test cases (MCP)

## Purpose

Turn a **test design** (or explicit test case list) into **Jira work items** with a consistent structure:

- **One `Test` issue per layer** that has at least one case: **API**, **UI**, **Integration**. Omit layers with zero cases.
- **Link** each `Test` issue to the **Story** the user supplies (issue link, not Epic parent).
- Put **full context** in each **`Test` issue description** (story reference, scope, assumptions, environment, overview table, **planned tags** when the handoff includes them).
- Create **`Subtask` issues** under each **`Test`**: **one subtask per logical test case**, except **one subtask for an entire parametrized / data-driven scenario** with a **complete data matrix** (all rows, explicit parameters, **Total rows: N**) in the subtask body—not a shortened sample unless **Scope** allows smoke-only.

Do **not** create the Story; the user identifies it by **issue key** (e.g. `KAN-42`) **or** a **browse URL** to that issue (e.g. `https://<site>.atlassian.net/browse/KAN-42`). If they pass a URL, **parse the issue key** for MCP calls such as **`getJiraIssue`**.

## Workflow (command order)

1. **Collect:** Story (**key** or **browse URL**), **`projectKey`**, optional **`cloudId`**, and—if present—**categorized test cases** (API / UI / Integration).
2. **Test cases:** If the user did **not** provide a usable categorized case set, **run** [.cursor/skills/design-test-cases/SKILL.md](../design-test-cases/SKILL.md) **first** (repo and spec research live there, including the **Jira handoff** shape). **Then** return to this skill and **materialize** Jira issues. Do **not** skip test-design when cases are missing.
3. **Create in Jira:** Satisfy [Prerequisites](#prerequisites-before-jira-issue-creation), then follow [MCP workflow](#mcp-workflow-order-matters).

## When to use

- The user asks to **create Jira tickets from test cases**, **push test design to Jira**, or **structure API/UI/integration tests in Jira** using MCP.
- They provide a **Story** as **key or browse link**, **`projectKey`** when needed, and either **test cases** (or output from **design-test-cases**) or an explicit ask to derive cases first.

## Prerequisites: before Jira issue creation

Do **not** author **`Test`** / **`Subtask`** issues from generic templates until the blocks below are done. Summarize findings in each **`Test`** issue under **Evidence** (see [Templates](#templates)).

### 1. Test cases (required)

- **From test-design:** You already followed [Workflow](#workflow-command-order) and have output that includes the [Jira handoff](../design-test-cases/SKILL.md#jira-handoff-when-creating-tickets) shape—**API** / **UI** / **Integration** groupings, subtask-level or matrix-level cases, evidence pointers, **explicit inputs per matrix row**, **planned tags** when UI automation is in scope, and **Total rows: N** for each matrix.
- **From the user:** Cases are grouped into **API** / **UI** / **Integration** with enough detail to write **Subtask** steps and oracles. If cases are **thin**, **contain umbrella placeholders** (e.g. “invalid email (various)”), or **lack row-level parameters**, run or extend **design-test-cases** before creating issues—**do not** copy placeholder wording into Jira.
- **Quality bar:** Jira **`Test`** / **`Subtask`** descriptions must match the **test-design handoff** the user or agent just produced: same **row count**, same **explicit** input cells, same **oracles** and **tags**. Do **not** treat any static path inside this skill as the source of truth; **the handoff document or conversation output** is authoritative unless the user explicitly asks for a smaller **smoke** scope (then label **Scope** on the `Test` issue).

### 2. Evidence and oracles (in-repo features)

**Repository and spec research** for test design belongs in [.cursor/skills/design-test-cases/SKILL.md](../design-test-cases/SKILL.md)—do not duplicate that workflow here.

When **test-design** already ran, **reuse its Evidence** in **`Test`** descriptions and **Subtask** bodies. When the user supplied cases **without** that pass, still ground **Subtask** text in concrete sources before **`createJiraIssue`**:

| Source | What to extract |
| ------ | --------------- |
| [ARCHITECTURE.md](../../../ARCHITECTURE.md) | Modules, routes, auth/session, pointers to constraint files |
| [docs/QA_TESTING_FEATURES.md](../../../docs/QA_TESTING_FEATURES.md) | `data-testid`, field rules, training surfaces |
| [openapi.json](../../../openapi.json) | Endpoints, request/response shapes, status codes |
| **Implementation** | Relevant `frontend/`, `backend/` (pages, DTOs, services, guards) for the feature |
| **Existing automation** | `tests/ui-tests/` page objects or specs when they cover the same flow |

If the feature is **not** in this repository, say so in the **`Test`** issue description and rely on the Jira Story, linked issues, and user input.

### 3. Jira Story and related work (mandatory)

After **`cloudId`** is available (see [MCP workflow](#mcp-workflow-order-matters)):

1. **`getJiraIssue`** (`issueIdOrKey` = the Story **key**; if the user gave a **browse URL**, resolve it to the key first, use `responseContentFormat`: `markdown` when helpful) — capture summary, description, acceptance criteria, status.
2. **Linked / related work:** inspect link fields on the issue, use **`getJiraIssueRemoteIssueLinks`** when needed, and/or **`searchJiraIssuesUsingJql`** (e.g. `issue in linkedIssues("STORY-KEY")`, parent Epic, subtasks—adjust JQL to what the site supports) so test scope **aligns** with **Relates**, **Blocks**, existing specs, and does not **duplicate** work already tracked unless the user wants overlap.

## Jira hierarchy (required)

```text
Story (existing; user gives key or browse URL → normalize to key)
  └── issue link ──► Test (API)     ──► Subtask (per case or matrix group)
  └── issue link ──► Test (UI)      ──► Subtask (…)
  └── issue link ──► Test (Integration) ──► Subtask (…)
```

- **Subtasks** use **`parent` = the `Test` issue key** (not the Story).
- **Story ↔ `Test`** uses **`createIssueLink`** (see [Linking to the Story](#linking-to-the-story)).

## Defaults for this repo’s Jira (project KAN)

When `projectKey` is **`KAN`** (site [mizmanbeefcake.atlassian.net](https://mizmanbeefcake.atlassian.net)):

| Role | `issueTypeName` for `createJiraIssue` |
| ---- | --------------------------------------- |
| Test container | **`Test`** |
| Subtask | **`Subtask`** (not `Sub-task`) |

**Story ↔ Test link:** there is no dedicated “Tests” link type on this site. Use **`Relates`** between the Story and each `Test` issue unless the user specifies another type that exists in `getIssueLinkTypes`.

For **other projects or sites**, always confirm names with **`getJiraProjectIssueTypesMetadata`** before creating issues; issue type names vary.

## MCP workflow (order matters)

Use the **Atlassian MCP that Cursor shows as “Atlassian (plugin)”** in Settings → MCP. In MCP descriptor paths it is **`plugin-atlassian-atlassian`** (internal name `atlassian`). That is the server that exposes **`getAccessibleAtlassianResources`**, **`createJiraIssue`**, **`createIssueLink`**, etc.

Enable **Atlassian (plugin)** in **Cursor → Settings → MCP** if those tools are not already available to the agent.

**Read tool schemas** in the MCP descriptors before calling if parameters are unclear.

Complete [Prerequisites](#prerequisites-before-jira-issue-creation) (**test cases**, **Evidence** where needed, **Story** §3) before **`createJiraIssue`**. Story loading aligns with steps below once **`cloudId`** is known.

**Story:** use only the user-provided **Story** (**key** or **browse URL**; normalize to the key). Do **not** call **`createJiraIssue`** (or otherwise create) a Story; if the identifier is missing, ask for it.

1. **`getAccessibleAtlassianResources`**  
   Resolve **`cloudId`** if the user did not provide a site URL / hostname.

2. **`getJiraIssue`** (and linked-issue discovery per [Prerequisites](#prerequisites-before-jira-issue-creation) §3)  
   Load the **Story** and related issues before finalizing scope and duplicates.

3. **`getJiraProjectIssueTypesMetadata`** (`projectIdOrKey`)  
   Confirm exact strings for **`Test`** and **`Subtask`** (or equivalents).

4. **Pre-flight (before `createJiraIssue` for `Test` / `Subtask`):**  
   - **Parametrized subtasks:** Description contains the **full** markdown matrix from the test-design handoff: **explicit** input cells per row, **oracles**, **planned tags** (or stated once), **Total rows: N** matching **N** in the handoff. Reject **umbrella-only** rows (“invalid email (various)”) unless the parent **`Test`** issue **Scope** explicitly says smoke/sample.  
   - **Updating existing issues:** If a Subtask already exists with a **thin** matrix, use **`editJiraIssue`** to replace the description with the full table—do not leave placeholder rows.

5. For each **non-empty** layer (**API** / **UI** / **Integration**):
   - **`createJiraIssue`**: `projectKey`, `issueTypeName`: `Test`, **`summary`**, **`description`** (see [Templates](#templates)).
   - **`createIssueLink`**: link **Story** ↔ this **`Test`** issue (see [Linking to the Story](#linking-to-the-story)).
   - For each **subtask group** (one logical case, or one data-driven group):
     - **`createJiraIssue`**: `issueTypeName`: `Subtask`, **`parent`**: `Test` issue key, **`summary`**, **`description`**.

6. If creation fails with missing required fields: **`getJiraIssueTypeMetaWithFields`** for the project + issue type id, then retry **`createJiraIssue`** with **`additional_fields`** as required by the API.

Prefer **`contentFormat`: `markdown`** for descriptions unless ADF is required for the project.

## Inputs to collect

| Input | Notes |
| ----- | ----- |
| **`projectKey`** | e.g. `KAN` |
| **`storyKey`** | Existing Story: **key** (`KAN-42`) **or** **browse URL** (`…/browse/KAN-42`); normalize to the key for API calls |
| **`cloudId`** | From `getAccessibleAtlassianResources` or user’s site URL |
| **Categorized cases** | Split into **API** / **UI** / **Integration** |
| **Epic** | Optional; only mention in description if the user asks |

## Classifying API vs UI vs Integration

| Layer | Typical signals |
| ----- | ---------------- |
| **API** | HTTP methods, endpoints, status codes, JSON schema, auth headers, REST/GraphQL |
| **UI** | Browser/page, components, visible text, Playwright-style steps, accessibility |
| **Integration** | Multiple systems, queues, webhooks, DB + service chains, contract across boundaries |

If a case is ambiguous, ask **one** short question, or place it in the most conservative layer and **state the assumption** in the `Test` issue description.

## Linking to the Story

1. Call **`getIssueLinkTypes`** to list types (e.g. **Relates**, **Blocks**).
2. Call **`createIssueLink`** with:
   - **`cloudId`**
   - **`type`**: e.g. **`Relates`** for KAN (symmetric “relates to”).
   - **`inwardIssue`** / **`outwardIssue`**: the two issue keys (Story and `Test`). For **Relates**, order does not change semantics; for **directional** types, follow the MCP descriptor (e.g. Blocks: which issue blocks which).

Default for **KAN**: **`Relates`** between **Story** and each **`Test`** issue.

## Subtask granularity

- **One subtask per** independent logical test case (preconditions, steps, expected result).
- **One subtask for** a **parametrized / data-driven** scenario: single title (e.g. “Login — validation matrix”), shared steps, and a **full** **Data** table—**every** row from test-design with **literal or precisely described** inputs (no umbrella-only cells). Include **Planned tags** per row or state once if the whole matrix shares one profile. End with **Total rows: N**. Do **not** split each matrix row into a separate subtask unless the user asks.
- **One subtask ≠ one short paragraph:** a parametrized subtask may still be **one** issue, but its **description** must hold the **complete** matrix (often dozens of rows)—not a 3–4 row sample unless **Scope** on the parent **`Test`** issue says **smoke-only** or the user requested it.

Align naming with [.cursor/rules/test-scenario-conventions.mdc](../../rules/test-scenario-conventions.mdc) when the source uses matrix row names or QA tags.

### Matrix wording: good vs bad (illustrative)

| Bad (do not ship) | Good |
| ----------------- | ---- |
| Input: “invalid email” | Input: `user@` (missing domain); expected: format error per constraints |
| “Negative cases” as one row | One row per concrete invalid value with explicit oracle |
| Four representative rows when handoff had twenty | All **N** rows from test-design, or **Scope: smoke (4 of 20)** stated on `Test` issue |

Tag vocabulary for planned **Playwright** runs aligns with [.cursor/rules/playwright-ui-tests.mdc](../../rules/playwright-ui-tests.mdc) (e.g. `@smoke`, `@merge-gate`, `@client-validation`, `@e2e`). For **API** layers, the **same** `@…` names apply to **pytest** markers—see [.cursor/rules/pytest-backend-api-tests.mdc](../../rules/pytest-backend-api-tests.mdc); in Jira, you may add a one-line run hint, e.g. *Planned pytest: `-m "merge_gate and client_validation"`* when useful.

## Templates

### `Test` issue summary

```text
Test (<Layer>): <Short feature name> — <StoryKey>
```

Examples: `Test (UI): Login validation — KAN-42`, `Test (API): Orders API — KAN-42`.

### `Test` issue description (minimum)

- **Related Story:** `<StoryKey>` (link or key).
- **Layer:** API | UI | Integration.
- **Evidence:** pointers to repo truth and Jira context (e.g. `ARCHITECTURE.md` section, `path/to/file.tsx`, OpenAPI `POST /…`, linked Jira keys reviewed).
- **Scope / out of scope** (short). If matrices are **smoke-only** or **sample** (not full equivalence coverage), say so here.
- **Assumptions & environment** (e.g. base URL, role, feature flags).
- **Planned tags / run profile** (when test-design provided them): e.g. “Planned tags: `@merge-gate`, `@client-validation`” for the layer or matrix—copy from the handoff.
- **Coverage overview:** table listing logical case IDs or titles that will appear as subtasks (or matrix groups), with **Total rows** per matrix when known.

### `Subtask` summary

```text
TC-<Layer>-<NN>: <Short case title>
```

Example: `TC-UI-01: Valid credentials redirect to dashboard`. Use **one** subtask for a full data-driven group: e.g. `TC-API-02: Create order — validation matrix`.

### `Subtask` description (minimum)

- **Objective**
- **Preconditions**
- **Steps** (or **Parameterized steps** + **Data matrix** for parametrized flows) — use **specific** URLs, field names, selectors (`data-testid` when documented), and API payloads **from repository research**, not generic placeholders.
- **Data matrix:** markdown table with **every** row from the test-design handoff—columns at minimum: **Row name**, **Explicit inputs** (per field or parameter), **Expected oracle**, **Planned tags** (per row or noted once if identical). **No** umbrella-only input cells unless **Scope** on the parent `Test` issue explicitly allows smoke/sample coverage.
- **Total rows: N** — immediately after the table; **N** must match the handoff.
- **Expected result** — for the matrix as a whole: observable oracles (status code + body shape, redirect path, UI state, storage) tied to the implementation where applicable; optional **Notes** for split behavior (e.g. native browser validation vs app-rendered error) when documented in research.

## Failure handling

- **Wrong issue type name** → re-run **`getJiraProjectIssueTypesMetadata`** and use exact **`name`** values.
- **Validation / required field errors** → **`getJiraIssueTypeMetaWithFields`** + **`additional_fields`** on **`createJiraIssue`**.
- **Permission or site errors** → confirm MCP auth and that **`projectKey`** / **`cloudId`** match the user’s site.

## Anti-patterns

- **Creating a Story** — the Story must already exist; only **`Test`** and **`Subtask`** issues are created, linked to the user’s Story (**key** or URL resolved to key).
- Writing **`Test`** or **`Subtask`** bodies from **generic product templates** without completing [Prerequisites](#prerequisites-before-jira-issue-creation) (test cases, Evidence, Jira Story/links).
- **Abbreviated matrices** in a parametrized **`Subtask`**—a few “representative” rows when the handoff listed **many**—without labeling **smoke-only** on the **`Test`** issue **Scope**.
- **Umbrella input cells** without explicit values: e.g. “invalid email (various)”, “negative cases”, “pass invalid parameters”.
- **Dropping planned tags** from the handoff when the user or test-design included them for **UI** or **API** / **pytest** work.
- Creating **one `Test` issue per single test case** when the plan is **one `Test` per layer** (API/UI/Integration).
- Setting subtask **`parent`** to the **Story** (default is **`Test`**).
- Omitting the **Story link** on the **`Test`** issues.
- Splitting every **data-driven row** into separate subtasks without user request.

## Project note

Store this skill under **`.cursor/skills/`** in the repository. Do not place custom skills under `~/.cursor/skills-cursor/` (reserved for Cursor built-ins).
