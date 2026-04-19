# qa-test-pipeline

**Logical name:** **qa-test-pipeline** (filename **`cmd-qa-test-pipeline.md`** uses the repo’s **`cmd-`** prefix for pipeline commands).

**Authorization:** The user invoked the **full QA test pipeline** for an existing **Jira Story**. Run **phases 1 → 4 in a single session**, **in order**, without pausing for a separate “run the next step” confirmation—unless you are **blocked** (missing required inputs, MCP/Jira failure, ambiguous scope). Do **not** invent Jira issues or skip phases.

**Commits:** Do **not** commit automatically when finishing ([.cursor/rules/git-flow.mdc](../rules/git-flow.mdc)) unless the user explicitly asks.

**Git:** Work on a **feature branch**, not **`master`** / **`main`**, when making repo changes during this pipeline ([.cursor/rules/git-flow.mdc](../rules/git-flow.mdc)).

---

## Inputs (parse from the same message as this command)

| Input | Required | Notes |
| ----- | ---------- | ----- |
| **Story** | **Yes** | Issue key (e.g. `CSQ-123`, pattern like `PROJ-123`) **or** a Jira **browse URL** for that Story; parse the key from a URL if needed. |
| **`projectKey`** | If MCP cannot infer it | Jira project key for MCP calls when needed. |
| **Layers** | No | Optional restriction: `api`, `integration`, `ui` / `playwright`. If omitted, **derive layers** from the feature and test design (include every layer that has real cases). |

If **no Story key and no Story URL** can be parsed, **stop** and ask for one.

---

## Persistence (so a cut session can resume)

After each major phase, **leave durable traces**:

- **After phase 1:** Test design output is in the conversation; if sizable, the user may save it under `docs/` or the tool may summarize at the top of the next phase.
- **After phase 2:** List created Jira **`Test`** / **`Subtask`** keys in the reply.
- **After phase 3:** The folder **`.cursor/plans/<YYYY-MM-DD>-test-automation-<slug>/`** with **`00-index.md`** and chunk files must exist on disk.

---

## Phase 1 — Design test cases

1. Follow [.cursor/skills/design-test-cases/SKILL.md](../skills/design-test-cases/SKILL.md).
2. Ground scenarios in [ARCHITECTURE.md](../../ARCHITECTURE.md), [docs/QA_TESTING_FEATURES.md](../../docs/QA_TESTING_FEATURES.md), [docs/openapi.json](../../docs/openapi.json), and implementation as the skill describes.
3. Produce categorized output suitable for Jira: **API** / **UI** / **Integration** (Jira-handoff shape: explicit matrix rows, oracles, planned Playwright tags when UI is in scope).
4. If **layers** were specified in the invocation, **omit** or clearly mark out-of-scope layers.

---

## Phase 2 — Jira test tickets from cases

1. Follow [.cursor/skills/jira-test-tickets-from-cases/SKILL.md](../skills/jira-test-tickets-from-cases/SKILL.md).
2. **Before any Atlassian MCP call:** read each tool’s **schema/descriptor** (JSON) for that server and tool name; do not guess parameters.
3. Use the **Story** from inputs (key or browse URL). **Do not** create the Story.
4. Create **`Test`** issues per non-empty layer and **`Subtask`** issues as the skill requires; link to the Story.
5. **On failure** (auth, API error, missing permissions): **report the error and stop**. Do **not** fabricate issue keys.
6. **On success:** record issue keys for phase 3–4 traceability.

---

## Phase 3 — Test automation planner

1. Follow [.cursor/agents/agent-test-automation-planner.md](../agents/agent-test-automation-planner.md).
2. **Source of truth:** **Jira** for scope and traceability; phase 1 output is **supporting** detail ([planner doc](../agents/agent-test-automation-planner.md)).
3. Create **`.cursor/plans/<YYYY-MM-DD>-test-automation-<slug>/`** with **`00-index.md`** and **`chunk-NN-<topic>.md`** files. Slug may include the Story key (e.g. `2026-04-16-test-automation-csq-123`).
4. **If this phase fails** or no plan folder is produced: **stop**. Do **not** run test agents.

---

## Phase 4 — Parallel and sequential test agents

1. Open **`00-index.md`** in the new plan folder.
2. For each chunk, note **intended executor**, **execution order**, and **parallel-safe** (yes/no) vs other chunks.
3. **Parallel:** For chunks that may run **in parallel** (disjoint paths, index says parallel-safe), **launch parallel runs** using the **Task** tool (or equivalent subagent invocations) with the matching agent type:
   - **`agent-backend-api-tests`** — [.cursor/agents/agent-backend-api-tests.md](../agents/agent-backend-api-tests.md)
   - **`agent-backend-integration-tests`** — [.cursor/agents/agent-backend-integration-tests.md](../agents/agent-backend-integration-tests.md)
   - **`agent-ui-playwright-tests`** — [.cursor/agents/agent-ui-playwright-tests.md](../agents/agent-ui-playwright-tests.md)
   Each Task must receive the **relevant `chunk-NN-….md` path**, **`00-index.md`**, Story key, and Jira references.
4. **Sequential:** Run dependent chunks **after** prerequisites complete; do not parallelize chunks that share paths or that the index orders strictly.
5. Test scope must stay within **Jira** / **chunk** instructions ([.cursor/rules/no-unrequested-tests.mdc](../rules/no-unrequested-tests.mdc)).
6. If an executor agent’s workflow ends with **post-codegen review**, follow that agent’s own instructions (e.g. **`agent-post-codegen-review`**) before the user merges.

---

## Do not

- Stop after phase 1 or 2 and wait for a new user command unless **blocked**.
- Create **fake** Jira issues or issue keys.
- Run phase 4 **before** **`00-index.md`** exists.
- Merge PRs or run **`git-pr`** as part of this command unless the user explicitly combined the ask.

## Honest limits

- **Cursor command ≠ shell executable:** Running text in an external terminal alone does not execute this pipeline; the **assistant** must follow this file in Chat/Composer.
- **Long sessions:** Full pipeline may be long; persistence above supports resume if the session ends early.

## End state

Reply with:

- Story key and created **Jira** keys (phase 2).
- Path to **`.cursor/plans/...`** and confirmation that **`00-index.md`** is the entry point.
- Which **Tasks** (agents) ran for which **chunks**, and what remains **sequential** if not finished in-session.
