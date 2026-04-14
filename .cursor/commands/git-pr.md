# git-pr

**Authorization:** The user invoked this command to **open a pull request only**. **Do not** merge. Normal merge rules apply afterward ([.cursor/rules/git-flow.mdc](.cursor/rules/git-flow.mdc): merge only after explicit user approval in a separate step or command).

## Do this

1. **Post-codegen review** — Invoke the **`agent-post-codegen-review`** subagent defined in [.cursor/agents/post-codegen-review.md](../agents/post-codegen-review.md) on the current branch’s changes against the PR base (default **`master`**: e.g. `git diff master...HEAD` or equivalent). Treat its output as a gate: if it reports **Critical** issues, **summarize them and stop**—do not push or open a PR until the user fixes them or clearly says to proceed anyway. Include **Warnings/Suggestions** in a short note (e.g. PR description or reply) when you continue.
2. **Push** the current branch if it is not on the remote yet.
3. **Open a PR** targeting **`master`** (or another base branch only if the user named one in the same message). Share the PR URL in your reply.
4. If **PR creation fails** (auth, conflicts with base, `gh` errors, branch protection), **report what failed** and stop.

## Do not

- **Merge** the PR, run `gh pr merge`, or sync/delete branches as if the PR were merged—unless the user invokes a separate merge workflow or explicitly asks to merge in the same message.

## Auth

- Use `gh` with `GH_TOKEN` from `.env` when needed (`set -a && source .env && set +a`). **Never** print or commit tokens.

## Scope

- Operate on the **current branch** unless the user specified another branch in the same message.
