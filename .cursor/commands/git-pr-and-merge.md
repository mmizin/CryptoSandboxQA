# git-pr-and-merge

**Authorization:** The user invoked this command. That **is** their approval to **create the PR and merge it** in one go. **Do not** ask for a separate “merge” or “I approve” confirmation—treat this invocation as full permission to complete the workflow.

Use the normal repo mechanics ([.cursor/rules/git-flow.mdc](.cursor/rules/git-flow.mdc) for targets, `gh`, `master`, post-merge sync), but **override** the “merge only after explicit approval” part of that rule **for this command only**.

## Do this

1. **Push** the current branch if it is not on the remote yet.
2. **Open a PR** targeting **`master`** (or another base branch only if the user named one in the same message).
3. **Merge** the PR on GitHub right away (`gh pr merge` or equivalent). Prefer merge/squash/rebase according to repo conventions if any; otherwise use a sensible default (e.g. merge commit or squash—pick what matches existing PRs).
4. If **merge is blocked** (required checks failing, conflicts, branch protection, or `gh` errors), **report what failed** and stop—do not bypass protections without the user explicitly asking for that.

## After merge

- Sync: `git fetch origin`, `git checkout master`, `git pull origin master`.
- Remove the local feature branch when safe: `git branch -d <branch>` (use `-D` only if the user later confirms discarding unmerged work).

## Auth

- Use `gh` with `GH_TOKEN` from `.env` when needed (`set -a && source .env && set +a`). **Never** print or commit tokens.

## Scope

- Operate on the **current branch** unless the user specified another branch or PR number in the same message.
