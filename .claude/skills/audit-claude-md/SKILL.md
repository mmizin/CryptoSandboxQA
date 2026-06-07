---
name: audit-claude-md
description: >-
  Audit CLAUDE.md against 6 criteria: required commands, architecture accuracy,
  project patterns, conciseness, technology relevance, and practicality.
  Generates detailed findings, scores, and recommendations per criterion.
disable-model-invocation: false
---

# CLAUDE.md Audit

Analyzes CLAUDE.md quality and completeness against 6 criteria.

## Audit criteria

When the user invokes `/audit-claude-md`, perform a comprehensive analysis of `CLAUDE.md` (and related code) and generate a detailed audit report covering:

### 1. **Required commands only** — Verify all documented commands are actually used and useful

- Check `package.json` scripts against commands documented in CLAUDE.md
- Identify missing commands developers encounter daily
- List commands that are documented but rarely used
- **Output:** List of documented, missing, and obsolete commands with justification

### 2. **Architecture accuracy** — Verify documented architecture matches current codebase

- Confirm backend modules match `backend/src/` structure
- Confirm frontend stack matches actual dependencies and code patterns
- Verify database, realtime, and testing frameworks are current
- Check that architectural diagrams/descriptions in ARCHITECTURE.md align with documented stack
- **Output:** Score on how well CLAUDE.md reflects actual architecture; identify gaps

### 3. **Project-specific patterns** — Verify patterns and workflows are documented actionably

- Check if builders (`UserBuilder`, `OrderBuilder`, `DepositBuilder`) are mentioned
- Verify order locking and settlement mechanics are explained
- Confirm stop orders and frontend trigger logic are documented
- Check if test strategies (`ApiUserCreationStrategy`, `AdminApiUserCreationStrategy`) are covered
- Verify admin workflows (impersonation, bulk import) are documented
- **Output:** List of patterns that are documented vs. missing; assess actionability

### 4. **Conciseness** — Identify duplication, verbosity, and low-value sections

- Count lines per section and estimate token usage
- Flag sections that duplicate global rules (e.g., `plan-before-coding.md`)
- Identify generic philosophy without project specifics
- Note unnecessary explanations or examples
- **Output:** Token efficiency score; sections to remove/consolidate

### 5. **Technology relevance** — Verify all mentioned tech is current and actually used

- Cross-check documented tech against `package.json` (backend + frontend)
- Verify version claims are plausible (Feb 2025 cutoff minimum)
- Identify actively used tech not mentioned (e.g., Zustand, Recharts, @dnd-kit)
- Flag any deprecated or EOL technologies
- **Output:** Relevance score; missing/outdated tech references

### 6. **Practicality** — Assess whether guidance is actionable and project-specific

- Evaluate if sections help developers solve real problems (add endpoint, run test, etc.)
- Identify generic guidance ("write clean code", "follow best practices") without specifics
- Check if workflows include step-by-step instructions with file paths
- Assess if knowledge is discoverable (can developers find what they need quickly?)
- **Output:** Practicality score; identify gaps in common workflows

## Output format

Generate a report with:

1. **Per-criterion findings** (for each of the 6 criteria):
   - Findings (factual observations)
   - Issues (specific gaps or problems)
   - Recommended changes (concrete suggestions)
   - Priority (High / Medium / Low)

2. **Summary table:**
   - Criterion | Score (/10) | Status | Impact

3. **Overall metrics:**
   - Overall score (0–10)
   - Estimated token efficiency (useful content %)
   - Sections to remove entirely
   - Sections to code-verify
   - Suggested final CLAUDE.md structure

4. **Implementation priority:**
   - Grouped by HIGH/MEDIUM/LOW

## Notes

- Compare against actual code, not assumptions. Read relevant files:
  - `package.json` for commands
  - `backend/src/` modules for architecture
  - `frontend/package.json` for dependencies
  - Test files for patterns (`tests/backend_tests/`, `tests/ui-tests/`)
  - `ARCHITECTURE.md` for existing documentation
- Reference line numbers from CLAUDE.md when citing sections
- Provide specific, actionable feedback (not vague critiques)
- Estimate token count for useful vs. wasteful content