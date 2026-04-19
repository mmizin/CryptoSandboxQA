# LLM wiki (Karpathy-style vault)

This folder is a **small, repo-local knowledge base** for humans and coding agents. It follows the usual pattern: **immutable-ish inputs** in `raw/`, **maintained concept pages** in `wiki/`, and a **single entry index** so navigation stays fast.

## Layout

| Path | Role |
|------|------|
| [`raw/`](raw/README.md) | Source drops: meeting notes, spec excerpts, investigation logs, pasted API deltas. Prefer pointers to real paths over duplicating `ARCHITECTURE.md`. |
| [`wiki/`](wiki/00-START-HERE.md) | Compiled pages: short maps, glossaries, “how we test X”, cross-links. Updated when behavior or layout changes. |
| [`wiki/00-START-HERE.md`](wiki/00-START-HERE.md) | **Start here** — map-of-content and links to path index + topic maps. |

## Workflow (suggested)

1. Add or update material under `raw/` when you ingest new facts (optional; many teams only use `wiki/`).
2. Run an LLM pass to fold new facts into `wiki/` pages: update maps, fix links, add contradictions to a small `wiki/TODO-contradictions.md` if needed.
3. Keep pages **short**; deep truth stays in code and [`ARCHITECTURE.md`](../../ARCHITECTURE.md).

## Obsidian

Open the repo (or only `knowledge/llm-wiki/`) as a vault if you want graph view and `[[wikilinks]]`. Cursor and GitHub navigate best with **relative Markdown links**; the wiki pages use those in addition to optional `[[wiki/Note]]`-style links where helpful.

## Agents

When exploring the repo, open **`wiki/00-START-HERE.md` first**, then **`wiki/index-by-repo-path.md`** to jump by directory.
