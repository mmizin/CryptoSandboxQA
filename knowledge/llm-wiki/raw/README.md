# raw — source drops

Use this folder for **inputs** that are not yet (or never) worth merging into [`ARCHITECTURE.md`](../../../ARCHITECTURE.md):

- Meeting notes, decision logs, one-off investigations.
- Excerpts from tickets or specs (with reference id).
- Temporary copies of external docs **when** you need an offline anchor for an LLM ingest pass.
- Domain discovery artifacts (Event Storming, DDD analysis).

**Do not** mirror the whole architecture doc here; link to it instead. After an ingest, prefer moving durable summaries into [`../wiki/`](../wiki/00-START-HERE.md) and leaving a stub note under `raw/` if history matters.

## Contents

- **[`01-domain-event-storming.md`](01-domain-event-storming.md)** — Event Storming lite analysis: 12 key domain events, 5 bounded contexts (Identity, Trading, Payments, Wallets, Market), ubiquitous language per BC, and BC Map (Mermaid). Reference for domain-driven design discussions and API contract alignment.
