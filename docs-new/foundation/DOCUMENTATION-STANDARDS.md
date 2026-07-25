# Documentation Standards — CryptoSandboxQA

**Status:** Draft
**Source:** `DOCUMENTATION_IMPLEMENTATION_PLAN.md`, `product-toolkit`
(`prd-engine`), `architecture-toolkit` (`adr-expert`, `c4-expert`)

Conventions for artifacts produced under `docs-new/` during the
documentation implementation effort. This file is the single place these
rules are stated; later artifacts reference it instead of restating it.

## Document ownership

Each artifact type has exactly one owner. Only that owner edits it.

| Artifact | Owner |
|---|---|
| PRD | Product Toolkit (`product-toolkit:prd-engine`) |
| ADR | Architecture Toolkit (`architecture-toolkit:adr-expert`) |
| C4 diagram | Architecture Toolkit (`architecture-toolkit:c4-expert`) |
| Technical Design notes | Architecture Toolkit |
| Reviews (product / architecture) | Review agents only (`product-reviewer`, `architecture-reviewer`) |
| Foundation documents (this folder) | Human-maintained — no toolkit currently owns this layer |
| `DOCUMENTATION_IMPLEMENTATION_PLAN.md` | Human-maintained |

## Artifact identifiers

IDs are **slug-based**, not sequential numbers (`PRD-Registration`, not
`PRD-001`). Sequential numbering in a hand-maintained plan breaks whenever a
feature is inserted mid-backlog — every downstream ID would need renumbering.
Slugs stay stable regardless of ordering changes.

- PRD: `PRD-<FeatureSlug>` (e.g. `PRD-Registration`, `PRD-BalanceLockUnlock`)
- ADR: `ADR-<DecisionSlug>` (e.g. `ADR-RoleModel`, `ADR-StopOrderClientTrigger`)
- C4: `C4-<Scope>` (e.g. `C4-Context`, `C4-OrdersContainer`)

Slugs are assigned once, at creation, and never reused or reassigned — same
permanence rule as the PRD contract's requirement IDs (see
`product-toolkit` PRD-CONTRACT-RULES R-011).

## Cross-linking

- Every PRD/ADR/C4 that depends on Foundation content links to the specific
  file in `docs-new/foundation/` (e.g. "see `GLOSSARY.md` for Order") rather
  than redefining the term.
- Every PRD/ADR that depends on an earlier-phase artifact links to it by
  slug ID, not by re-deriving its content.
- Dependencies are recorded as `Depends: <slug-id>` / `Produces: <slug-id>`
  in the backlog table of `DOCUMENTATION_IMPLEMENTATION_PLAN.md`.

## Evidence and inspection boundary

During execution, the feature inventory (`FEATURES_INVENTORY.md`) is the
primary input for every PRD/ADR. The implementation may be inspected to
verify architectural behavior, resolve ambiguity, and validate consistency
with the documented product behavior. It must never be used to invent
undocumented product requirements. If the inventory is silent or ambiguous,
that gap is logged as an Open Question, not silently resolved by reading
source.

## Architecture Discovery output shape

Architecture Discovery always produces an Architecture Report. ADR, C4, and
Technical Design are conditional outputs of that report — not automatic
next steps:

```
Architecture Discovery
        │
        ▼
Architecture Report
        │
        ├──▶ ADR (only where a genuine decision point exists)
        ├──▶ C4 (only where the feature crosses module/container boundaries)
        └──▶ Technical Design (only where C4 doesn't capture the mechanic)
```

## Retirement / change handling

Retiring or materially changing a requirement follows the PRD contract's
retirement rule (R-011/R-012): status set to Retired with reason and date,
ID never reused, orphaned references reported rather than silently deleted.
