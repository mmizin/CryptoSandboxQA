# git-sync-master

**Purpose:** Align the local repository with remote **`master`** after a PR was merged (or whenever you want the latest `master`). This switches off a feature branch and updates `master`.

**Note:** `git pull` already **fetches** from the remote, so a separate `git fetch origin` is **not** required for this—unless you want to prune remotes or inspect before merging.

## Do this

1. **Checkout** **`master`**: `git checkout master` (or `git switch master`).
2. **Pull** latest: `git pull origin master` — or `git pull` if local `master` **tracks** `origin/master` (usual after a normal clone).
3. If the command **fails** (uncommitted changes blocking checkout, merge conflicts on pull, network), **report the error** and stop—do not force or discard the user’s work without explicit instruction.

## Optional (only if the user asks in the same message)

- **Delete** a local feature branch that was merged: `git branch -d <branch>` (use `-D` only if they confirm discarding unmerged work).
- **Prune** stale remote-tracking branches: `git fetch origin --prune` (or combine with a one-off: `git fetch origin --prune` before checkout if they care about cleanup).
- **Fetch only** to inspect or update all remote refs before acting—`git pull` still suffices for “get `master` current” when you checkout `master` first.

## Do not

- **Force** checkout or reset that would drop uncommitted changes unless the user explicitly requests it.
- Rename **`master`**—this repo uses **`master`** as the default branch ([.cursor/rules/git-flow.mdc](.cursor/rules/git-flow.mdc)).

## Terminal one-liner

For use outside Cursor (e.g. shell alias):

```bash
git checkout master && git pull origin master
```

## Auth

- Normal `git`/`ssh` credentials apply; no `gh` token required for pull.
