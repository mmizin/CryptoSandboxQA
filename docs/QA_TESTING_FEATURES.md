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
