---
name: jira-test-tickets-from-cases
description: >-
  Creates Jira Test issues from categorized test cases (API, UI, Integration)
  using the Atlassian MCP: one Test issue per non-empty layer, links each to a
  user-provided Story, rich descriptions on Test issues, and Subtask children
  per logical case (one subtask for parametrized / data-driven matrix groups).
  Use when the user wants test cases pushed to Jira as Test tickets with
  subtasks, or asks to create Jira issues from a test design via MCP.
---

# Jira test tickets from test cases (MCP)

## Purpose

Turn a **test design** (or explicit test case list) into **Jira work items** with a consistent structure:

- **One `Test` issue per layer** that has at least one case: **API**, **UI**, **Integration**. Omit layers with zero cases.
- **Link** each `Test` issue to the **Story** the user supplies (issue link, not Epic parent).
- Put **full context** in each **`Test` issue description** (story reference, scope, assumptions, environment, overview table).
- Create **`Subtask` issues** under each **`Test`**: **one subtask per logical test case**, except **one subtask for an entire parametrized / data-driven scenario** with a **data matrix** in the subtask body.

Do **not** create the Story; the user provides its key (e.g. `KAN-42`).

## When to use

- The user asks to **create Jira tickets from test cases**, **push test design to Jira**, or **structure API/UI/integration tests in Jira** using MCP.
- They provide (or you derive from context) a **Story key** and **project key**, plus test cases or a test-design output.

If test cases do not exist yet, run or align with [.cursor/skills/test-design-techniques/SKILL.md](../test-design-techniques/SKILL.md) first; then apply this skill to **materialize** issues in Jira.

## Jira hierarchy (required)

```text
Story (existing, user-provided key)
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

Use the **Atlassian** MCP server (e.g. `plugin-atlassian-atlassian`). **Read tool schemas** in the MCP descriptors before calling if parameters are unclear.

1. **`getAccessibleAtlassianResources`**  
   Resolve **`cloudId`** if the user did not provide a site URL / hostname.

2. **`getJiraProjectIssueTypesMetadata`** (`projectIdOrKey`)  
   Confirm exact strings for **`Test`** and **`Subtask`** (or equivalents).

3. For each **non-empty** layer (**API** / **UI** / **Integration**):
   - **`createJiraIssue`**: `projectKey`, `issueTypeName`: `Test`, **`summary`**, **`description`** (see [Templates](#templates)).
   - **`createIssueLink`**: link **Story** ↔ this **`Test`** issue (see [Linking to the Story](#linking-to-the-story)).
   - For each **subtask group** (one logical case, or one data-driven group):
     - **`createJiraIssue`**: `issueTypeName`: `Subtask`, **`parent`**: `Test` issue key, **`summary`**, **`description`**.

4. If creation fails with missing required fields: **`getJiraIssueTypeMetaWithFields`** for the project + issue type id, then retry **`createJiraIssue`** with **`additional_fields`** as required by the API.

Prefer **`contentFormat`: `markdown`** for descriptions unless ADF is required for the project.

## Inputs to collect

| Input | Notes |
| ----- | ----- |
| **`projectKey`** | e.g. `KAN` |
| **`storyKey`** | Existing Story to link to (e.g. `KAN-42`) |
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
- **One subtask for** a **parametrized / data-driven** scenario: single title (e.g. “Login — validation matrix”), shared steps, and a **table** of rows (inputs → expected outcome). Do **not** split each matrix row into a separate subtask unless the user asks.

Align naming with [.cursor/rules/test-scenario-conventions.mdc](../../rules/test-scenario-conventions.mdc) when the source uses matrix row names or QA tags.

## Templates

### `Test` issue summary

```text
Test (<Layer>): <Short feature name> — <StoryKey>
```

Examples: `Test (UI): Login validation — KAN-42`, `Test (API): Orders API — KAN-42`.

### `Test` issue description (minimum)

- **Related Story:** `<StoryKey>` (link or key).
- **Layer:** API | UI | Integration.
- **Scope / out of scope** (short).
- **Assumptions & environment** (e.g. base URL, role, feature flags).
- **Coverage overview:** table listing logical case IDs or titles that will appear as subtasks (or matrix groups).

### `Subtask` summary

```text
TC-<Layer>-<NN>: <Short case title>
```

Example: `TC-UI-01: Valid credentials redirect to dashboard`. Use **one** subtask for a full data-driven group: e.g. `TC-API-02: Create order — validation matrix`.

### `Subtask` description (minimum)

- **Objective**
- **Preconditions**
- **Steps** (or **Parameterized steps** + **Data** table for matrix)
- **Expected result**

## Failure handling

- **Wrong issue type name** → re-run **`getJiraProjectIssueTypesMetadata`** and use exact **`name`** values.
- **Validation / required field errors** → **`getJiraIssueTypeMetaWithFields`** + **`additional_fields`** on **`createJiraIssue`**.
- **Permission or site errors** → confirm MCP auth and that **`projectKey`** / **`cloudId`** match the user’s site.

## Anti-patterns

- Creating **one `Test` issue per single test case** when the plan is **one `Test` per layer** (API/UI/Integration).
- Setting subtask **`parent`** to the **Story** (default is **`Test`**).
- Omitting the **Story link** on the **`Test`** issues.
- Splitting every **data-driven row** into separate subtasks without user request.

## Project note

Store this skill under **`.cursor/skills/`** in the repository. Do not place custom skills under `~/.cursor/skills-cursor/` (reserved for Cursor built-ins).
