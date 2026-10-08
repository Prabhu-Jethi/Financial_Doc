# Apex Financial Intelligence — Frontend Suite

An institutional-grade, responsive AI analysis workspace for Apple Inc. SEC Form 10-K filings (FY2022–FY2024). Features cited natural language answers, interactive visualizers, deterministic Decimal calculation ledgers, and table cell provenance inspection.

---

## Key Features

1. **Bloomberg / Linear Inspired Visual Design**
   - High-density dark glassmorphism palette (`#070b14` canvas, obsidian elevated cards, luminous cyan/emerald/amber status signals).
   - Modern typography: `Inter` for crisp narrative legibility and `JetBrains Mono` for audited numbers, decimal strings, and formulas.
   - Micro-animations: Smooth tab switches, hover-reactive cards, and real-time pulse indicators.

2. **Audited SEC Key Performance Indicators (Top Strip)**
   - Instant KPI tiles: FY24 Total Net Sales ($391,035M), Operating Margin (31.51%), iPhone Sales ($201,183M), Services Growth (+12.87%), and Cash Balance ($29,943M).
   - Click-to-analyze: Clicking any tile instantly populates and executes the verified query.

3. **Smart Query Console & Category Navigator**
   - Filter pills by domain: *Revenue & Segments*, *Margins & Formulas*, *Balance Sheet*, *MD&A Commentary*, *Boundary Controls*.
   - Sample prompt chips for DEV evaluation queries (`DEV-001` through `DEV-010`).
   - Period selector dropdown (*All Periods*, *FY2024*, *FY2023*, *FY2022*).
   - Keyboard shortcut: <kbd>Ctrl</kbd> + <kbd>Enter</kbd> to execute.

4. **Multi-Tab Audited Workspace**
   - **Intelligence Brief**: Cited natural language explanation with highlighted metrics and provenance anchors.
   - **Visualizer & Trends**: Dynamic SVG segment breakdown charts with hover percentages, multi-year sales trajectory, and operating margin gauge meter.
   - **Math Ledger**: Step-by-step formula breakdown, operands table (with source statement & page), and Decimal precision results (TRD § 5).
   - **Verified Facts**: Atomic facts grid with normalized decimals, scale, and verification status (TRD § 4).

5. **Audited Provenance & Document Inspection Modal**
   - Citation tiles with printed page badges (e.g. Page 29 Consolidated Statements of Operations).
   - In-app 10-K document viewer modal displaying extracted table cells and direct links to official SEC PDFs.

6. **Full Responsiveness Across All Devices**
   - **Desktop (> 1100px)**: Dual-pane workspace with real-time sidebar and wide charts.
   - **Tablet (768px – 1100px)**: Adaptive 2-column layout with flexible sidebar.
   - **Mobile (< 768px)**: Single-column flow with swipeable KPI ticker, stacked query toolbar, and touch-optimized action targets.

---

## Tech Stack
- **Framework**: Next.js 14 (App Router)
- **UI Logic**: React 18 (Vanilla JavaScript / JSX)
- **Styling**: Pure Vanilla CSS (`globals.css`) with CSS custom properties (Zero Tailwind, zero external component frameworks)
- **Zero Heavy Dependencies**: Pure native SVG charts, no heavy charting libraries

---

## Development Setup

```bash
cd frontend
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the workspace.
