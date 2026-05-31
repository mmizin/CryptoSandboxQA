# Plan: Advanced Charts page (TradingView Lightweight Charts)

**Date:** 2026-05-31
**Slug:** lightweight-charts
**Branch (proposed):** `feat/lightweight-charts`

## Goal

Add a new top-navigation entry that opens an **Advanced Charts** page rendering an
interactive candlestick chart with [TradingView Lightweight Charts](https://github.com/tradingview/lightweight-charts).
The page uses deterministic mock OHLC data and exposes stable `data-testid` controls so it
becomes a new **Playwright/QA practice surface** (zoom, pan, crosshair, series/interval toggles,
screenshots).

This sits in the top nav alongside **Buy crypto / Deposit crypto / Markets / Assets / Trade**.

## Why Lightweight Charts (vs. existing recharts)

The app already has recharts area/line charts (`TradePriceChart`, `DashboardCharts`). Lightweight
Charts is a different, **canvas-based** engine — financial-grade candlesticks, real pan/zoom,
crosshair. It's a deliberately *different* testing target: canvas content isn't in the DOM, so
QA practice shifts to **toolbar controls, ARIA, readouts, and screenshot/visual assertions**
rather than reading SVG nodes. Good contrast to the existing recharts surfaces.

## Confirmed choices (2026-05-31)

- **Library:** Lightweight Charts **v4** (`^4.2.0`) — simpler `addCandlestickSeries()` API.
- **Data:** **Deterministic history + live tick** — seeded reproducible candles, plus a periodic
  `series.update()` driving the last candle. A `data-testid="advanced-chart-live-toggle"` lets QA
  **pause** the ticking for stable assertions/screenshots (defaults to running).
- **Nav:** **Single `Charts` link** (no dropdown).

## Key architecture decisions

1. **Library version — pin v4 (`lightweight-charts@^4.2.0`).**
   v5 (current `npm install` default) changed the API to `chart.addSeries(CandlestickSeries, …)`.
   v4 keeps the simpler `chart.addCandlestickSeries()` from the user's example and has abundant docs.
   *Trade-off:* v4 is one major behind, but stable and simpler. (Alternative: adopt v5 — noted, not chosen.)

2. **Client-only, canvas-mounted via ref.** Lightweight Charts manipulates a real DOM node and
   has no SSR support. The chart component is `'use client'`, creates the chart inside a
   `useEffect`/`useRef` against a container div, and disposes it on unmount. No dynamic-import gymnastics
   needed since it only runs in `useEffect` (never during SSR render).

3. **Deterministic mock OHLC generator.** New helper alongside the existing seeded generator in
   `lib/tradeMockData.ts` (keep the seeded-random pattern already there). Generates `CandlestickData`
   (`time, open, high, low, close`) + matching volume, parameterised by symbol + interval + base price,
   so tests get stable candles. Reuses `TRADE_COINS` for the coin list.

4. **Theme-aware.** Read `useTheme()` and apply dark/light chart `layout`/`grid` colors; re-style on
   theme change (chart instance persists, just `applyOptions`).

5. **Testability surface (the point of the feature).** Stable `data-testid`s on the container and every
   control, plus a DOM **readout** (last close / O-H-L-C of crosshair candle) that mirrors canvas state
   so Playwright can assert values without reading the canvas. Toolbar: coin select, interval select,
   series-type toggle (Candlestick / Line / Area), volume toggle, "Reset zoom" button, fit-content.

## Files to create

- `frontend/app/charts/page.tsx` — page shell (back button, title, theme classes, `useAuth(false)`
  so it's public like Markets). Renders the toolbar + chart component.
- `frontend/components/AdvancedChart.tsx` — `'use client'` Lightweight Charts wrapper: ref container,
  create/dispose lifecycle, series switching, theme application, crosshair-move → readout state,
  reset-zoom. Exposes `data-testid` hooks.
- `frontend/lib/chartMockData.ts` — deterministic OHLC + volume generator and interval definitions
  (`1m, 5m, 15m, 1h, 1d`), reusing `TRADE_COINS` from `tradeMockData.ts`. (Or co-locate in
  `tradeMockData.ts` — leaning to a new file to keep concerns separate.)

## Files to modify

- `frontend/package.json` — add `"lightweight-charts": "^4.2.0"` (run `npm install` in `frontend/`).
- `frontend/components/Header.tsx` — add a **Charts** nav link (single `Link`, mirroring the existing
  button styling; no dropdown needed since it's one destination). Placed in the nav row near `MarketsDropdown`.
- `docs/QA_TESTING_FEATURES.md` — new section documenting the Charts surface, all `data-testid`s,
  the canvas-vs-DOM testing note, and the readout selectors.
- `ARCHITECTURE.md` — add `/charts` to the **Routes implemented** table and `lightweight-charts`
  to the **Frontend** tech-stack row (same-PR doc rule, § Keeping this document current).

## Planned `data-testid` surface (for QA docs + automation)

- `advanced-chart-page` — page root
- `advanced-chart-container` — the canvas mount div
- `advanced-chart-coin-select`, `advanced-chart-interval-select`
- `advanced-chart-series-candlestick`, `advanced-chart-series-line`, `advanced-chart-series-area`
- `advanced-chart-volume-toggle`
- `advanced-chart-reset-zoom`
- `advanced-chart-readout` (and `…-readout-open/high/low/close/last`) — DOM mirror of crosshair candle

## Step-by-step implementation

1. `cd frontend && npm install lightweight-charts@^4.2.0` (updates `package.json` + root `package-lock.json`).
2. Add `lib/chartMockData.ts`: interval list + deterministic candle/volume generator.
3. Build `components/AdvancedChart.tsx`: container ref, chart create/dispose, candlestick/line/area
   series, volume histogram (separate price scale), theme apply, crosshair readout, reset-zoom, toolbar.
4. Add `app/charts/page.tsx` page shell wiring coin/interval/series state into `AdvancedChart`.
5. Add the **Charts** link to `Header.tsx`.
6. Document the surface in `docs/QA_TESTING_FEATURES.md`.
7. Manual verify: `npm run dev`, open `/charts`, switch coin/interval/series, pan/zoom, crosshair readout,
   theme toggle, reset zoom. Build check: `cd frontend && npm run build`.

## Out of scope / not doing

- **No automated tests** (per CLAUDE.md "do not add tests unless explicitly asked"). The page is built
  to be *testable*; tests come in a later, explicitly-requested change.
- No backend OHLC/candle API — data is mock + deterministic (matches existing trade mock approach).
  A real `/candles` endpoint + Socket.IO live updates could be a follow-up.
- No real-time streaming into the chart for now (could later wire `useTicker` to `series.update()`).

## Trade-offs / alternatives considered

- **v5 vs v4 API** — chose v4 for the simpler documented API; v5 is the alternative if we want latest.
- **Reuse recharts** — rejected; the whole point is a distinct canvas-based testing surface.
- **New lib file vs extend `tradeMockData.ts`** — leaning new file (`chartMockData.ts`) for separation;
  open to co-locating if you prefer fewer files.
- **Nav placement** — single `Link` ("Charts") vs a dropdown. Going with a single link unless you want
  sub-items (e.g. "Advanced chart", "Depth chart") later.
