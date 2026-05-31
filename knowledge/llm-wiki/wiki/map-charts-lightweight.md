# TradingView Lightweight Charts Integration Guide

**Current version:** 4.2.3 (frontend dependency)

**Official docs:** [tradingview.github.io/lightweight-charts/docs](https://tradingview.github.io/lightweight-charts/docs)

This guide documents our use of TradingView Lightweight Charts for financial charting across the application.

## Overview

Lightweight Charts is a performant, interactive charting library designed for financial data visualization. The library is client-side only (browser support required — not compatible with Node.js/server-side rendering).

**Why we use it:**
- Minimal bundle size (typescript-friendly, tree-shakeable)
- High-performance real-time data updates (crucial for live ticker)
- Rich customization without bloat
- Responsive, touch-friendly interactions
- Requires proper TradingView attribution

### Key Constraint: Attribution Required

The Lightweight Charts license **requires** proper attribution to TradingView in the product UI. Failure to include proper attribution violates the license terms.

**Implementation:** Include attribution notice and link to TradingView in any page that displays a Lightweight Chart.

---

## Series Types (Data Visualization Options)

Six core series types are available, plus support for custom series plugins. Choose by your data shape and use case:

| Type | Use Case | Data Format | Example |
|------|----------|-------------|---------|
| **Candlestick** | OHLC (Open-High-Low-Close) price bars. Standard for financial analysis. | `{ time, open, high, low, close }` | AdvancedChart candlestick mode |
| **Area** | Single-value trend with visual fill. Emphasizes magnitude over time. | `{ time, value }` | AdvancedChart area mode |
| **Line** | Simplest single-value line chart. Lightweight alternative to area. | `{ time, value }` | AdvancedChart line mode |
| **Bar** | OHLC visualized as vertical bars (alternate to candlestick). | `{ time, open, high, low, close }` | Alt candlestick representation |
| **Histogram** | Discrete data distributions, typically for volume or indicators. | `{ time, value, color }` | AdvancedChart volume bars (Histogram) |
| **Baseline** | Two-color area chart with reference baseline. Good for above/below comparisons. | `{ time, value }` | Indicator comparisons vs. reference |

---

## Core API Reference

### Creating a Chart

```typescript
import { createChart, ColorType } from 'lightweight-charts';

const container = document.getElementById('chart');
const chart = createChart(container, {
  width: container.clientWidth,
  height: 380,
  layout: {
    background: { type: ColorType.Solid, color: '#ffffff' },
    textColor: '#000000',
    attributionLogo: false, // Set true if not showing attribution elsewhere
  },
  grid: {
    vertLines: { color: '#f0f0f0' },
    horzLines: { color: '#f0f0f0' },
  },
  timeScale: { timeVisible: true, secondsVisible: false },
  crosshair: { mode: CrosshairMode.Normal },
});
```

**Key creation options:**
- `width`, `height` — Chart dimensions (container-relative widths are not automatic; use ResizeObserver for responsive sizing)
- `layout` — Theme, text color, attribution logo visibility
- `grid` — Gridline visibility and color
- `rightPriceScale`, `leftPriceScale` — Y-axis configuration
- `timeScale` — X-axis (time) configuration
- `crosshair` — Cursor interaction behavior

### Adding a Series

```typescript
// Candlestick
const series = chart.addCandlestickSeries({
  upColor: '#10b981',
  downColor: '#ef4444',
  borderUpColor: '#10b981',
  borderDownColor: '#ef4444',
  wickUpColor: '#10b981',
  wickDownColor: '#ef4444',
});

// Area
const series = chart.addAreaSeries({
  lineColor: '#10b981',
  topColor: 'rgba(16, 185, 129, 0.35)',
  bottomColor: 'rgba(16, 185, 129, 0)',
  lineWidth: 2,
});

// Line
const series = chart.addLineSeries({
  color: '#10b981',
  lineWidth: 2,
});

// Histogram (volume)
const series = chart.addHistogramSeries({
  priceFormat: { type: 'volume' },
  priceScaleId: 'volume', // Separate Y-axis for volume
});
```

### Setting and Updating Data

```typescript
// Replace all data (setData) — use when loading initial dataset
series.setData(dataPoints);

// Update latest point or append new point (update)
// For real-time updates, always use update() instead of setData()
series.update({ time: 1234567890, open: 100, high: 102, low: 99, close: 101 });
```

⚠️ **Performance note:** Using `setData()` repeatedly for real-time updates causes performance degradation. Use `update()` for live data streams (see Live Tick Pattern below).

### Key Chart Methods

```typescript
// Interaction
chart.subscribeCrosshairMove((param) => {
  // param.seriesData.get(series) — get values under cursor for this series
  // param.time, param.point — cursor position
});

chart.subscribeClick((param) => {
  // Handle chart clicks
});

// Layout
chart.applyOptions({ /* partial option updates */ });

// Cleanup
chart.remove(); // Must call before unmounting to release memory and DOM

// Time scale
chart.timeScale().fitContent(); // Auto-fit data to view
chart.timeScale().setVisibleRange({ from, to }); // Set zoom range
```

---

## Integration Patterns in the Project

### Pattern 1: `AdvancedChart` Component (React)

**File:** `frontend/components/AdvancedChart.tsx`

**Key patterns:**
- Chart lifecycle: create once on mount, store in `ref`
- Series lifecycle: rebuild (remove + add) when data source or series type changes
- ResizeObserver: responsive sizing without repeated setData calls
- Crosshair subscription: read cursor position for OHLC readout display
- Live tick pattern: use `update()` on interval, not `setData()`
- Theme switching: apply options without rebuilding series

**Code outline:**
```typescript
const containerRef = useRef<HTMLDivElement>(null);
const chartRef = useRef<IChartApi | null>(null);
const mainSeriesRef = useRef<ISeriesApi<'Candlestick' | 'Line' | 'Area'> | null>(null);

// Lifecycle 1: Create chart + ResizeObserver (once)
useEffect(() => {
  const chart = createChart(container, { /* options */ });
  const ro = new ResizeObserver((entries) => {
    const width = entries[0]?.contentRect.width;
    if (width) chart.applyOptions({ width: Math.floor(width) });
  });
  ro.observe(container);
  return () => { ro.disconnect(); chart.remove(); };
}, []);

// Lifecycle 2: Build series when data source or type changes
useEffect(() => {
  if (mainSeriesRef.current) chart.removeSeries(mainSeriesRef.current);
  const s = chart.addCandlestickSeries({ /* options */ });
  s.setData(data);
  mainSeriesRef.current = s;
}, [coin, seriesType]);

// Lifecycle 3: Re-theme without rebuild
useEffect(() => {
  chart.applyOptions({ layout: { /* new colors */ } });
}, [theme]);

// Pattern 4: Live tick updates
useEffect(() => {
  if (!live) return;
  const id = setInterval(() => {
    mainSeriesRef.current?.update(newCandle);
  }, 1500);
  return () => clearInterval(id);
}, [live, coin]);
```

**Learnings:**
- Always store chart + series in refs so they persist across renders
- Rebuild series (remove + add) rather than calling setData; setData is for initial load only
- ResizeObserver pattern is essential for responsive charts without triggering re-renders
- Live updates must use `update()` on `setInterval`, never re-render the entire series

---

## Performance Considerations

1. **Initial load:** Use `setData()` once with all historical data
2. **Real-time updates:** Use `update()` with the latest point
3. **Responsive sizing:** Use ResizeObserver; don't call `applyOptions({ width })` on every render
4. **Memory cleanup:** Always call `chart.remove()` in cleanup function
5. **Series count:** Limit to ~3-4 series per chart; multiple charts per page are OK
6. **Data granularity:** High-frequency candle updates (< 100ms) may exceed browser repaint budget; 1500ms is safe

---

## Customization Options

### Colors and Styling

- **Candlestick:** `upColor`, `downColor`, `borderUpColor`, `borderDownColor`, `wickUpColor`, `wickDownColor`
- **Area:** `lineColor`, `topColor`, `bottomColor`, `lineWidth`
- **Line:** `color`, `lineWidth`
- **Grid:** `vertLines.color`, `horzLines.color`
- **Text:** `textColor` in layout
- **Price scales:** `borderColor`

### Data Point Formatting

- **Price scale:** `priceFormat: { type: 'volume' | 'price' | 'percent', precision: number }`
- **Time scale:** `timeVisible: true/false`, `secondsVisible: true/false`

---

## Common Patterns

### Dual Y-Axes (Example: Volume Below Price)

```typescript
// Main series (price on right Y-axis, default)
const price = chart.addCandlestickSeries({ /* ... */ });

// Volume on separate left Y-axis
const volume = chart.addHistogramSeries({
  priceFormat: { type: 'volume' },
  priceScaleId: 'volume', // Custom scale ID
});
volume.priceScale().applyOptions({
  scaleMargins: { top: 0.82, bottom: 0 }, // Position above time axis
});
```

### Responsive Chart with ResizeObserver

```typescript
const containerRef = useRef<HTMLDivElement>(null);

useEffect(() => {
  const container = containerRef.current;
  const chart = createChart(container, { width: container.clientWidth, height: 380 });
  
  const resizeObserver = new ResizeObserver((entries) => {
    const width = entries[0]?.contentRect.width;
    if (width) {
      chart.applyOptions({ width: Math.floor(width) });
    }
  });
  resizeObserver.observe(container);
  
  return () => {
    resizeObserver.disconnect();
    chart.remove();
  };
}, []);
```

### Handling Crosshair Events

```typescript
chart.subscribeCrosshairMove((param) => {
  if (!param.time || !param.point) {
    // Cursor left chart; reset to last visible data
    return;
  }

  const seriesData = param.seriesData.get(series);
  if (!seriesData) return;

  if ('open' in seriesData) {
    // Candlestick data
    console.log(seriesData.open, seriesData.high, seriesData.low, seriesData.close);
  } else {
    // Area/Line data
    console.log(seriesData.value);
  }
});
```

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| Chart not rendering | Ensure container has explicit width/height. Lightweight Charts doesn't support container-relative sizing automatically. |
| Chart flickers on data update | Use `update()` for real-time updates instead of `setData()`. |
| Performance degradation | Check if `setData()` is called on every render. Use ResizeObserver for responsive sizing. |
| Memory leak | Always call `chart.remove()` in cleanup. Check that refs are properly cleared. |
| Attribution warning | Ensure TradingView attribution is visible and linked. Use `attributionLogo: false` only if attribution is provided elsewhere. |
| Colors not applying | Use valid color formats: hex (#RRGGBB), rgb(r,g,b), rgba(r,g,b,a), or named colors. |

---

## Resources

- **Official docs:** https://tradingview.github.io/lightweight-charts/docs
- **GitHub:** https://github.com/tradingview/lightweight-charts
- **API Reference:** https://tradingview.github.io/lightweight-charts/docs/api
- **Series types:** https://tradingview.github.io/lightweight-charts/docs/series-types
- **Examples:** https://tradingview.github.io/lightweight-charts/docs/gallery

---

## Next Steps for Feature Development

When adding new chart features, refer to:

1. **Series type requirements** → Choose from the 6 core types (or consider custom series plugins)
2. **AdvancedChart component** → Extend props and logic following the lifecycle pattern
3. **Data generation** → Update `lib/chartMockData.ts` if adding new data shapes
4. **Styling** → Update color constants and theme function in `AdvancedChart.tsx`
5. **Testing** → UI tests should verify chart rendering and interactive features (crosshair, zoom)

---

## Related Files

- **Component:** `frontend/components/AdvancedChart.tsx`
- **Data generation:** `frontend/lib/chartMockData.ts`
- **Theme provider:** `frontend/lib/useTheme.ts`
- **Tests:** `tests/ui-tests/` (search for `advanced-chart` test selectors)
