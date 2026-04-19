# update-knowledge

**Logical name:** **update-knowledge** (filename **`cmd_update-knowledge.md`** uses the repo’s **`cmd_`** prefix for pipeline-style commands).

**Authorization:** The user wants to **refresh the LLM wiki** under [`knowledge/llm-wiki/`](../../knowledge/llm-wiki/README.md) so it stays aligned with the codebase after ongoing development. **Discover what changed**, update **`wiki/`** (and optionally **`raw/`**) when navigation or summaries are stale. **[`ARCHITECTURE.md`](../../ARCHITECTURE.md)** is **usually already updated in the same PR as the feature** ([.cursor/rules/project-conventions.mdc](../rules/project-conventions.mdc)); touch it from this playbook **only when** it is **out of date** vs the code, was **missed** in an earlier change set, or the user **asks** to align it. If nothing material changed, **say so** and do not touch files for the sake of activity.

**Commits:** Do **not** commit automatically when finishing ([.cursor/rules/git-flow.mdc](../rules/git-flow.mdc)) unless the user explicitly asks.

**Git:** Prefer a **feature branch** for repo edits ([.cursor/rules/git-flow.mdc](../rules/git-flow.mdc)), not **`master`**.

---

## Source-of-truth order (do not invert)

1. **Code, Prisma schema, committed OpenAPI** — behavior and contracts.
2. **[`ARCHITECTURE.md`](../../ARCHITECTURE.md)** — canonical long-form overview; **routine** updates belong in the **feature change set** ([.cursor/rules/project-conventions.mdc](../rules/project-conventions.mdc)). During **update-knowledge**, edit this file **only if** it still disagrees with the code after that (drift / omission / user request).
3. **`knowledge/llm-wiki/wiki/`** — navigation maps and compression; must **not contradict** `ARCHITECTURE.md`.
4. **`knowledge/llm-wiki/raw/`** — optional ingest inputs; **append** notes rather than rewriting history unless fixing a clear error.

---

## Inputs (parse from the same message as this command)

| Input | Required | Notes |
| ----- | -------- | ----- |
| **Scope** | No | Default: **diff vs integration branch** — use **`master`** as base unless the user names another ref (e.g. `origin/master`, a tag, or commit SHA). If the working tree has **uncommitted** changes that matter, include them in the review (`git status`, `git diff`). |
| **Paths** | No | Optional glob or directory list (e.g. “only `backend/src/deposits/`”). If omitted, infer from the diff. |
| **Ticket / note** | No | If the user gives a Jira key or decision text, consider a short dated file under **`knowledge/llm-wiki/raw/`** (optional). |

If the base ref is ambiguous and **both** `master` and `main` might apply, **prefer `master`** for this repo ([`ARCHITECTURE.md`](../../ARCHITECTURE.md) / remote defaults).

---

## Procedure

### 1. Establish “what’s new”

- Run **`git fetch`** if comparing to **`origin/master`** and refs may be stale (needs network when appropriate).
- Compute changes vs the chosen base: e.g. `git diff <base>...HEAD` (three-dot: merge-base range) and/or `git diff` for unstaged/staged work.
- Summarize **touched areas** (backend modules, frontend routes, test harness folders, docs, Prisma, OpenAPI).

### 2. Read current knowledge state

- Open **[`knowledge/llm-wiki/wiki/00-START-HERE.md`](../../knowledge/llm-wiki/wiki/00-START-HERE.md)** and **[`wiki/index-by-repo-path.md`](../../knowledge/llm-wiki/wiki/index-by-repo-path.md)**.
- Open relevant **`wiki/map-*.md`** files for the touched subtrees.
- Skim **[`ARCHITECTURE.md`](../../ARCHITECTURE.md)** sections that correspond to those areas.

### 3. Decide required updates

| Situation | Action |
| --------- | ------ |
| New/changed **Nest module**, major **route** surface, **Prisma** model shape, **auth/realtime** behavior, main **frontend** routes, or **test harness** layout | **Preferred:** that work already updated **`ARCHITECTURE.md`** in the **feature PR** ([.cursor/rules/project-conventions.mdc](../rules/project-conventions.mdc)). **From this command:** edit **`ARCHITECTURE.md`** **only if** it is still incomplete or wrong vs the code (catch-up). |
| New **important paths** for “where do I look?” (new package under `tests/`, new domain folder, new Playwright page object family) | Update the right **`wiki/map-*.md`** and, if needed, **[`00-START-HERE.md`](../../knowledge/llm-wiki/wiki/00-START-HERE.md)** / **[`index-by-repo-path.md`](../../knowledge/llm-wiki/wiki/index-by-repo-path.md)**. |
| Large or contentious **decision** worth an audit trail | Optional: add **`knowledge/llm-wiki/raw/YYYY-MM-DD-<slug>.md`** (or similar) with links to tickets/PRs; then fold a **one-line** pointer into the appropriate **`wiki/`** map if useful. |
| Only trivial renames, formatting, or behavior-unchanged refactors | **Usually skip** wiki edits; mention “no knowledge updates needed.” |
| Wiki would **contradict** code or `ARCHITECTURE.md` | Fix **wiki** to match; if `ARCHITECTURE.md` is stale, fix **`ARCHITECTURE.md`** first, then wiki. |

### 4. Apply edits

- **Small, focused diffs** only; no drive-by refactors outside this scope ([.cursor/rules/project-conventions.mdc](../rules/project-conventions.mdc)).
- Keep **`wiki/`** pages **short**; link to **`ARCHITECTURE.md`** and real paths instead of duplicating paragraphs.
- Preserve **relative Markdown links** so navigation works in Cursor and on GitHub.

### 5. Report

Reply with:

- **What changed** in the repo (high level).
- **Which files** you updated (`ARCHITECTURE.md`, which `wiki/*.md`, any `raw/*`), or **none** if nothing was needed.
- **Follow-ups** (e.g. “regenerate `docs/openapi.json` if API surface changed” — only if true).

---

## Do not

- Treat **`knowledge/llm-wiki/wiki/`** as the authority over **`ARCHITECTURE.md`** or the code.
- Bulk-regenerate the entire vault without a diff-driven reason.
- Add or extend **tests** unless the user explicitly asks ([.cursor/rules/no-unrequested-tests.mdc](../rules/no-unrequested-tests.mdc)).

---

## Related

- Vault overview: [`knowledge/llm-wiki/README.md`](../../knowledge/llm-wiki/README.md)
- Repository layout row: [`ARCHITECTURE.md`](../../ARCHITECTURE.md) (table entry for `knowledge/llm-wiki/`)
