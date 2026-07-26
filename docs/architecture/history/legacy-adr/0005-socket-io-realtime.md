# Use Socket.IO for real-time updates

**Status:** Accepted

**Date:** 2024-03-15

## Context

CryptoSandboxQA required real-time market data updates (ticker prices, bid/ask spreads) and order notifications to be pushed to connected clients without polling. Key requirements:

- Low latency — Users see price updates within 100-500ms
- Reliable delivery — Missed messages should not crash the app
- Bidirectional communication — Client can subscribe/unsubscribe to feeds
- Browser compatibility — Works in all major browsers (fallback to HTTP polling if WebSocket unavailable)
- Automatic reconnection — Handles network interruptions gracefully
- Type safety — Realtime events should be type-checked (TypeScript)

We needed an abstraction over raw WebSocket that handled fallbacks and reconnection logic automatically.

## Decision

We chose **Socket.IO** (v4+) for all real-time updates between NestJS backend and Next.js frontend.

## Rationale

### Pros of Socket.IO
- **Auto fallback** — WebSocket → HTTP long-polling → HTTP streaming (graceful degradation in restrictive networks)
- **Reconnection** — Built-in exponential backoff and reconnection; doesn't require manual state management
- **Rooms & namespaces** — Organize events logically (e.g., `/ticker` namespace for price updates)
- **Type safety with TypeScript** — Can define event types and payload schemas; server and client stay in sync
- **NestJS integration** — `@nestjs/websockets` provides clean module integration
- **Small overhead** — Client library is lightweight; server adds minimal memory per connection
- **Debugging** — Built-in tools for monitoring active connections and messages
- **Maturity** — Long-established, production-tested in high-traffic applications

### Cons of Socket.IO
- **Not pure WebSocket** — Adds abstraction layer and overhead (mitigated: overhead is negligible for trading platform scale)
- **Memory per connection** — Each client connection consumes memory (mitigated: ~10-50KB per connection; 1000 concurrent users ≈ 50MB)
- **Deployment complexity** — Requires sticky sessions in load-balanced environments (works fine with single Node.js process)
- **Client dependency** — Large applications must include Socket.IO client library (~50-100KB gzipped)

### Alternatives considered

**Raw WebSocket (native `ws` module):**
- Pros: Minimal overhead; fine-grained control
- Cons: No fallback for restrictive networks; manual reconnection logic; error-prone state management
- **Rejected:** Socket.IO's auto-fallback and reconnection are worth the small overhead; training platform shouldn't assume strong network conditions

**GraphQL Subscriptions:**
- Pros: Unified query/subscription API; type-safe schemas
- Cons: Overkill for one-way data flow (server → client prices); adds query complexity; heavier than Socket.IO
- **Rejected:** Ticker updates are simple one-directional events; GraphQL subscriptions add unnecessary overhead

**Server-Sent Events (SSE):**
- Pros: Simpler than WebSocket; built into browsers; standard HTTP
- Cons: One-way only (server → client); browser limits concurrent connections per domain; no bidirectional support
- **Rejected:** Need bidirectional (client can subscribe/unsubscribe); SSE is less flexible

**Polling (Client requests data periodically):**
- Pros: Simple; works everywhere
- Cons: High latency (depends on poll interval); wastes bandwidth; scales poorly (1000 users × 30 requests/min ≈ 500K requests/hour)
- **Rejected:** Too resource-intensive; not suitable for real-time market data

**AWS AppSync or Firebase Realtime Database:**
- Pros: Managed, auto-scaling, built-in auth integration
- Cons: Vendor lock-in; expensive; doesn't fit self-hosted training platform model
- **Rejected:** Project is self-hosted; introduces unnecessary external dependency

## Consequences

### Positive consequences
- **Transparent network conditions** — Clients automatically fallback if WebSocket unavailable; works in corporate networks
- **Responsive UI** — Price updates arrive within 100ms; order fills are immediate; users see live market data
- **Reliable delivery** — Reconnection logic means temporary network glitches don't require page reload
- **Scalable to ~1000 concurrent users** — Single Node.js process + Socket.IO handles training platform scale
- **Clean API** — Events are organized in namespaces; client code is readable
- **Debugging** — Can inspect active connections and emitted events in development

### Negative consequences / Risks
- **Memory growth** — Long-lived connections consume RAM; must monitor and set connection limits
- **Load balancing complexity** — Multiple Node.js instances require sticky sessions or Redis adapter
- **Client library size** — Adds ~50-100KB gzipped to frontend bundle (mitigated: negligible with code splitting)
- **Heartbeat overhead** — Socket.IO sends periodic ping/pong frames (minimal: ~1 frame/minute per connection)

### Mitigation strategies
- **Connection limits** — Set max concurrent connections; monitor via Prometheus metrics (`npm run stack:up`)
- **Message throttling** — Ticker updates sent at max 10 Hz (every 100ms) even if internal price updates faster
- **Client reconnection strategy** — Exponential backoff configured in Socket.IO client; won't spam server
- **Redis adapter (if scaling)** — For multiple Node.js instances, use `@socket.io/redis-adapter` to share rooms/namespaces
- **Monitoring** — Grafana dashboard tracks active connections and message throughput
- **Load testing** — Playwright tests simulate multiple concurrent users; backend tests verify message ordering

## Related ADRs

- [0002: NestJS](./0002-nestjs-backend-framework.md) — Backend framework; `@nestjs/websockets` provides Socket.IO integration
- [0004: Next.js](./0004-nextjs-frontend-framework.md) — Frontend framework; Socket.IO client runs in React components

## References

- Socket.IO docs: https://socket.io/docs/
- NestJS WebSockets: https://docs.nestjs.com/websockets/gateways
- Socket.IO TypeScript: https://socket.io/docs/v4/typescript/
- Implementation: `backend/src/tickers/` module (ticker gateway)
- Frontend usage: `frontend/src/hooks/useTicker.ts` (Socket.IO client)
- Monitoring: `npm run stack:up` (Prometheus + Grafana)
