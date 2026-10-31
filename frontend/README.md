# DocIntel — Frontend Suite

An institutional-grade, responsive AI analysis workspace for multi-company financial reports (Apple, Microsoft, Amazon, Meta) and user-uploaded PDF documents. Built with Next.js 14 App Router, vanilla CSS, and OpenAI/ChatGPT system aesthetics.

---

## Key Features

1. **In-Document Evidence Highlighting**
   - **Interactive Split View**: Compare illuminated chunk cards side-by-side with the original PDF canvas.
   - **Native PDF Canvas Highlighting**: Injects `#page=N&search="phrase"` into browser PDF engines for direct on-page yellow highlights.
   - **Illuminated Marker Layer**: Numerical figures (`$391,035M`, `31.51%`), dates, and metrics are highlighted in glowing amber badges.
   - **Flexible View Modes**: Instant toggling between `Split View`, `Full PDF`, and `Evidence Text` reader.

2. **OpenAI / ChatGPT System Aesthetics**
   - Clean, lightweight system font stack (`-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`).
   - Standardized typography weights (400 regular, 500 medium, 600 semibold).
   - Zero external font loading latency.

3. **Exclusive Modal Architecture**
   - Centralized `activeModal` controller prevents popup collisions.
   - Unified fixed backdrop overlay (`.modal-backdrop`) with `z-index: 99999` and backdrop blur.
   - Modals include: `PdfViewerModal`, `UploadModal`, `CompareMatrixModal`, `ProfileModal`, `SettingsModal`, and `AuditGuideModal`.

4. **100% Self-Contained Provenance Viewer**
   - Zero external links to EDGAR servers. All documents stream through internal secure endpoints.
   - Interactive citation tags with printed page numbers and document titles.

5. **Multi-Company & User Document Management**
   - Quick batch-selection controls (`Select All` / `Uncheck All`).
   - Seamless switching between Curated SEC 10-K Filings and Uploaded Documents.
   - Dedicated `Upload General PDF` action with drag-and-drop ingestion.

6. **Audio Executive Briefings & Live Excel Models**
   - Speech synthesis audio briefings with text normalization.
   - Live `.xls` spreadsheet export with native formulas.

---

## Tech Stack
- **Framework**: Next.js 14 (App Router)
- **Styling**: Pure Vanilla CSS (`globals.css`) with CSS custom properties
- **Auth**: `@supabase/ssr` (Cookie-based session handling)
- **Security**: Hardened HTTP response headers (`X-Frame-Options: SAMEORIGIN`, `X-Content-Type-Options: nosniff`)

---

## Development Setup

```bash
cd frontend
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the workspace.
