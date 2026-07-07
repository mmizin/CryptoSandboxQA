# Start here (LLM wiki index)

**Canonical architecture:** [`ARCHITECTURE.md`](../../../ARCHITECTURE.md)

This file is the **map of content (MOC)** — use it to choose a thin overview page before opening large trees in `backend/` or `frontend/`.

## Navigate by problem

| I need to… | Go to |
|------------|--------|
| Understand bounded contexts & domain events | [`raw/01-domain-event-storming.md`](../raw/01-domain-event-storming.md) |
| Code style, naming, request-body locals | [`docs/CODE_STYLE_READABILITY.md`](../../../docs/CODE_STYLE_READABILITY.md) · [`docs/examples/code-style-templates.md`](../../../docs/examples/code-style-templates.md) · [`.cursor/rules/code-readability.mdc`](../../../.cursor/rules/code-readability.mdc) |
| Jump by repo path | [`index-by-repo-path.md`](index-by-repo-path.md) |
| Backend modules & flows | [`map-backend.md`](map-backend.md) |
| Frontend app structure | [`map-frontend.md`](map-frontend.md) |

## Optional Obsidian wikilinks

If you use Obsidian in this vault, you can also link: `[[index-by-repo-path]]`, `[[map-backend]]`, etc.

## Maintenance

When you add a major feature area, add **one** new `map-*.md` (or extend an existing map) and link it from this file and from [`index-by-repo-path.md`](index-by-repo-path.md).
