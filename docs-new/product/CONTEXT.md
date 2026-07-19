---
status: Living
updated_at: "2026-07-08"
---

# Domain Context — CryptoSandboxQA

<!--
CONTEXT.md is the domain glossary — not a PRD and not a scratch pad. NO implementation
detail here (no datastore/broker/framework names, no API contracts) — only domain words
and the boundaries between them. Implementation choices live in the SAD and ADRs;
behaviour lives in PRD.md.

Terms get fixed inline, the moment they surface in an interview / PRD / review — never
batched «I'll consolidate later». ## Glossary is mandatory.
-->

## Glossary

<!-- One line per term: name · one-sentence canonical definition · one-sentence boundary
     (what it is NOT / the concept it gets confused with). Alphabetical once there are a few. -->
- Fund locking — reserving a portion of a user's balance while an order is live so it can't be double-spent, released on cancel or settle. NOT settlement — locking holds funds temporarily, settlement moves them to their final owner.
- Order lifecycle — the full path of an order from validation → fund lock → persist → match → settle. NOT order matching — matching is one step (pairing a buy and a sell), the lifecycle is the whole sequence around it.
- QA scenario — a curated, guided test exercise a learner completes against the sandbox (e.g. verify balance locks on a limit order). NOT a test case — a scenario bundles setup, steps and an expected outcome for training, whereas a test case is one atomic assertion.
- Settlement — moving locked funds to their final owner after an order matches (base to the buyer, quote to the seller). NOT fund locking — settlement is the final transfer, locking is the temporary hold that precedes it.
