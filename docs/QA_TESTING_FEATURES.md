# QA testing features

This document lists **purpose-built surfaces** in CryptoSandboxQA for manual checks and automation practice (selectors, frames, API-backed flows). Add a new section here whenever you introduce another training or testability feature.

---

## Iframe automation practice

The app serves a **same-origin** training form inside an iframe so you can practice frame-scoped selectors without third-party widgets or cross-origin blocks.

- **Page:** [http://localhost:3000/qa/iframe-practice](http://localhost:3000/qa/iframe-practice)
- **Embedded document:** `/qa/iframe-form.html` (static file under [`frontend/public/qa/`](../frontend/public/qa/))

**Playwright sketch** (run in your own test project; the repo does not ship Playwright):

```ts
const frame = page.frameLocator('[data-testid="practice-iframe"]');
await frame.getByTestId('iframe-email').fill('qa@example.com');
await frame.getByTestId('iframe-amount').fill('100');
await frame.getByTestId('iframe-terms').check();
await frame.getByTestId('iframe-submit').click();
await expect(frame.getByTestId('iframe-success')).toBeVisible();
```

**Selenium / Cypress:** switch to the frame (or use frame-scoped queries), then locate by the same `data-testid` or by label (`Email`, `Amount (USD)`, etc.).

---

## Backend: delay before DB writes (simulated processing)

Orders and deposits **do not hit PostgreSQL immediately** after validation. The API waits a short, configurable period to mimic real-world payment/settlement or sync latency before the first persist.

- **Applies to:** `POST /orders` (order creation), `POST /deposits/fiat`, `POST /deposits/crypto` — see [`simulatedPersistDelay`](../backend/src/common/simulated-persist-delay.ts) and call sites in `OrdersService` / `DepositsService`.
- **Default:** **1200 ms** if `SIMULATED_PERSIST_DELAY_MS` is unset.
- **Disable:** set `SIMULATED_PERSIST_DELAY_MS=0` in the backend environment.
- **Tune:** set `SIMULATED_PERSIST_DELAY_MS` to any positive milliseconds (capped at 60s in code) for slower/faster “processing” in demos or stability tests.

The frontend may also keep submit loading UI visible for a minimum duration; together these delays affect **how long** automations should wait after click before asserting success (see [`ARCHITECTURE.md`](../ARCHITECTURE.md) and `.env.example`).
