# System Vision — CryptoSandboxQA

**Status:** Draft
**Source:** `docs-new/product/01-idea-brief.md` (§2, §3, §13), `CLAUDE.md`

## Why this system exists

Junior QA engineers have no safe, realistic place to practice testing
financial systems before their first fintech job. Live or staging exchange
testnets are unsafe, unstable, and not built for structured learning — they
teach wrong habits or nothing at all. Testing an exchange demands
understanding of order lifecycle, fund locking, real-time price updates, and
settlement mechanics that generic practice apps never expose.

CryptoSandboxQA is a full-stack crypto exchange sandbox that simulates
real-world exchange operations — registration, wallets, orders, matching,
settlement, deposits, admin tooling, realtime pricing — in a safe, controlled
environment, so QA engineers can learn, test, and master quality-assurance
practices against a system with genuine financial-domain complexity.

## Who it's for

- **Primary:** Junior QA engineers onboarding into their first role or
  training program, who have never tested a real financial system.
- **Secondary:** Teams and training leads who provision the sandbox and seed
  reproducible scenarios for their cohort.

## What it deliberately is not

- Not a real cryptocurrency exchange — no blockchain integration, no real
  money movement, no KYC/AML.
- Not aiming for production-scale realism — trigger logic, address formats,
  and matching are simplified where that simplification doesn't compromise
  the QA-training value (see `GLOSSARY.md` and `SYSTEM-OVERVIEW.md` for
  specifics, e.g. stop orders trigger client-side, not server-side).
- Not a general-purpose QA practice app (SauceDemo-style) — the domain
  complexity (order lifecycle, fund locking, settlement) is the point, not
  incidental.

## Open questions

- [ ] The idea brief (`01-idea-brief.md`) describes a *planned* layer on top
      of this sandbox — a curated QA-scenario library with progress
      tracking — which is not yet built. This Vision document describes the
      sandbox as it exists today; whether/how the scenario-library vision
      folds into this Foundation layer is unresolved. — owner: mmizin
