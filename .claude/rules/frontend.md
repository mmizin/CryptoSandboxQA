---
description: Frontend patterns, Next.js workflows, and Socket.IO integration
paths:
  - "frontend/**/*"
---

# CLAUDE.md — Frontend

Guidance for working with the frontend in CryptoSandboxQA.

## Add a frontend feature

1. Create component in `frontend/src/app/[route]/page.tsx` (Next.js App Router)
2. If real-time updates needed: subscribe to Socket.IO in hook (`socket.on('/ticker', ...)`) or reuse `useOrderTriggers`, `useTickers`
3. Use Zustand store (`frontend/src/store/[domain].ts`) for cross-component state; define actions and state atomically
4. Add Tailwind CSS for styling (utility classes); no CSS files in most components
5. Test with `/run-ui-tests @[feature]` before merging

## Stop orders — frontend implementation

Stop orders are stored on backend with `stop_price` field. Frontend subscribes to `/ticker` Socket.IO namespace and monitors live prices in real time. Buy stop triggers when `price >= stopPrice`; sell stop when `price <= stopPrice`, then converts to market order. **Frontend must stay open** — no server-side trigger. Implementation in `frontend/lib/orderTriggers.ts` and `useOrderTriggers` hook.
