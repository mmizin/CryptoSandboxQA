# Use Next.js for the frontend

**Status:** Accepted

**Date:** 2024-03-01

## Context

CryptoSandboxQA's frontend required:
- Server-side rendering (SSR) capability for SEO and initial page load performance
- Built-in routing and API routes for tight frontend-backend integration
- React component ecosystem and tooling maturity
- Type-safe development (TypeScript across client and server)
- Zero-config deployment and development experience
- Ability to share types with NestJS backend (via TypeScript models/DTOs)

The team had React expertise, so a React-based framework was the natural choice.

## Decision

We chose **Next.js** (v13+ with App Router) for the frontend.

## Rationale

### Pros of Next.js
- **Full-stack** — API routes enable frontend to talk to backend via `/api/*` proxy (or direct to NestJS in dev)
- **File-based routing** — Routes are files in `app/` directory; automatic code splitting
- **TypeScript first** — Full type support; shared types with backend reduce sync errors
- **Optimized images & fonts** — Built-in `next/image` and `next/font` prevent CLS issues
- **Development UX** — Hot reloading, error overlay, built-in debugging
- **Deployment flexibility** — Works on Vercel, Docker, or any Node.js host; static export option
- **React ecosystem** — Access to thousands of components and libraries (Recharts, Socket.IO client, dnd-kit)
- **Performance** — Automatic code splitting, image optimization, font subsetting improve metrics

### Cons of Next.js
- **Framework coupling** — Difficult to move away from Next.js; uses Vercel-specific conventions
- **Server vs. client confusion** — `use client` directives and server components add complexity (mitigated: clear patterns in codebase)
- **API routes overhead** — For simple proxies, running a Node.js server might be overkill
- **Opinionated routing** — Can't customize routing if needed; file-based structure is restrictive for complex apps

### Alternatives considered

**Create React App (CRA) with plain React:**
- Pros: Minimal framework overhead; maximum flexibility
- Cons: No routing; no SSR; requires separate backend for API; manual build configuration
- **Rejected:** Missing features (routing, SSR, API routes) would require additional libraries and complexity

**Vite + React (Fast build tool):**
- Pros: Much faster build times; minimal config
- Cons: No SSR; no built-in routing; requires separate backend; more setup than Next.js
- **Rejected:** Next.js's built-in SSR and API routes are valuable for a trading platform (SEO, performance, security)

**Vue.js (Nuxt):**
- Pros: Similar to Next.js; simpler template syntax
- Cons: Smaller ecosystem; less adoption than React; team expertise is React, not Vue
- **Rejected:** React ecosystem is larger; team prefers React patterns

**Angular (TypeScript, full-featured):**
- Pros: Full-featured, TypeScript-first, strong typing
- Cons: Steep learning curve; verbose boilerplate; heavy framework; overkill for a single-page trading dashboard
- **Rejected:** Unnecessary complexity for a SPA; React is more suitable

**Svelte (Compiler-based reactive framework):**
- Pros: Smaller bundle size; reactive syntax is elegant
- Cons: Smaller ecosystem; less adoption; team not experienced with Svelte
- **Rejected:** Team expertise is React; smaller library ecosystem

## Consequences

### Positive consequences
- **Type-safe frontend** — TypeScript + React enables refactoring with confidence
- **Shared types with backend** — Models and DTOs defined once, used in both frontend and NestJS
- **Fast development** — Hot reloading, error overlay, built-in debugging speed up iteration
- **SEO-friendly** — SSR and static generation help with search indexing (useful for public marketing pages)
- **Image optimization** — Built-in `next/image` improves Core Web Vitals and performance
- **API flexibility** — Can use Next.js `/api` routes as proxy, or call NestJS directly; easy to switch

### Negative consequences / Risks
- **Complexity from server components** — React Server Components (default in App Router) add cognitive load; requires `use client` directives to opt into client-side features
- **Vendor lock-in** — Moving away from Next.js later would require significant refactoring (not a concern for stable project)
- **Bundle size** — Next.js framework code increases initial JavaScript (mitigated: code splitting and lazy loading)
- **Deployment considerations** — Requires Node.js runtime; not suitable for static hosting alone

### Mitigation strategies
- **Documentation** — `ARCHITECTURE.md` and code examples show when to use server vs. client components
- **Code organization** — Clear separation between page components (`app/`), UI components (`src/components/`), and hooks
- **Type sharing** — Establish naming conventions for DTOs and models to keep frontend/backend in sync
- **Testing** — Playwright UI tests (`tests/ui-tests/`) ensure functionality works end-to-end
- **Performance monitoring** — Vercel Analytics (if deployed on Vercel) or custom monitoring tracks metrics

## Related ADRs

- [0002: NestJS](./0002-nestjs-backend-framework.md) — Backend framework; Next.js and NestJS work well together
- [0006: Playwright UI Testing](./0006-playwright-ui-testing.md) — Testing strategy for frontend

## References

- Next.js docs: https://nextjs.org/docs
- App Router guide: https://nextjs.org/docs/app
- React docs: https://react.dev/
- Frontend architecture: [`ARCHITECTURE.md` § Tech stack](../../ARCHITECTURE.md#tech-stack)
- Setup: [`CLAUDE.md` § Quick start](../../CLAUDE.md#quick-start)
