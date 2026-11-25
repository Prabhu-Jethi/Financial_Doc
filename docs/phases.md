# 🟧 phases.md — Step-by-Step Architecture & Release Phases

**Financial Report Analysis Assistant & Document Intelligence Platform** · v1.10 · 25 November 2026

> 🟢 **Phase 1 through Phase 6.11 Verified Complete**: The platform has progressed through ground truth curation, hybrid retrieval, 3-layer microservice auth with Guest Explorer Mode, general PDF parsing, Zero-PyTorch OpenAI `text-embedding-3-small` migration (~60MB container), 8-defect v1.9 audit remediation, theme persistence, physical-to-printed PDF page alignment (`DEC-070`), and automated **AWS EC2 Docker CD** (`.github/workflows/cd.yml`) paired with Vercel SSR. Verified at **20/20 (100.0%) pass on DEV-20** with **100% zero-hallucination rate** and **60 deterministic unit tests**.

[Requirements](Trd.md) · [Architecture](Architecture.md) · [Rules](rules.md) · [Phases](phases.md) · [Memory](memory.md)

---

## 1. System Roadmap & Delivery Gates

```mermaid
flowchart TD
    P0["P0: System Planning & Scoping"] --> P1["P1: SEC 10-K Ground Truth Curation"]
    P1 --> P2["P2: Traceable Ingestion & pgvector Schema"]
    P2 --> P3["P3: Fixed RAG & Workspace Interface"]
    P3 --> P4["P4: Hybrid RAG & Deterministic Test Suite"]
    P4 --> AUTH["P4.5: 3-Layer Auth & Modular Architecture"]
    AUTH --> P5["P5: Pluggable General PDF Parser Engine"]
    P5 --> P6["P6: Production Docker Containerization"]
    P6 --> P61["P6.1: Ingestion Hardening & Async Worker"]
    P61 --> P62["P6.2: State Persistence & Zero-Flicker Reload"]
    P62 --> P63["P6.3: Strict Document Scoping & Anti-Contamination"]
    P63 --> P64["P6.4: pgvector HNSW Indexing & Latency Tuning"]
    P64 --> P65["P6.5: Universal Responsive UI (Tablet & Mobile)"]
    P65 --> P66["P6.6: Offline-Gated CI/CD & Fast-Path Guardrail"]
    P66 --> P67["P6.7: Scale-Aware Grounding & 100% DEV Benchmark"]
    P67 --> P68["P6.8: OpenAI 1536-d Embeddings & Zero-PyTorch Slim"]
    P68 --> P69["P6.9: v1.9 Audit, Guest Mode & Tenant Scoping"]
    P69 --> P610["P6.10: Theme Persistence & Physical PDF Page Offset Fix"]
    P610 --> P611["P6.11: AWS EC2 Container Host & Auto-CD Pipeline"]
    P611 --> P7["P7: Two-Tier Caching & Bounded Agentic (Optional)"]

    classDef green fill:#DCFCE7,stroke:#16A34A,color:#14532D
    classDef purple fill:#EDE9FE,stroke:#7C3AED,color:#3B0764
    class P0,P1,P2,P3,P4,AUTH,P5,P6,P61,P62,P63,P64,P65,P66,P67,P68,P69,P610,P611 green
    class P7 purple
```

---

## 2. Release Gates & Verification Matrix

| Phase | Core Deliverables & Capabilities | Gate Status |
|---|---|---|
| **P1 — Ground Truth** | 11 official SEC 10-K reports (AAPL, MSFT, AMZN, META) downloaded and hashed; 20 verified dev questions with audited ground-truth references. | 🟩 Complete |
| **P2 — Traceable Ingestion** | `pdfplumber` cell matrix extraction, accounting number normalizer, narrative chunking, and 9-table Supabase relational catalog. | 🟩 Complete |
| **P3 — Fixed RAG Workspace** | Conversational workspace, floating composer dock, right-hand citation inspector drawer, and grounded LLM answering service. | 🟩 Complete |
| **P4 — Hybrid RAG & Testing** | Dense vector search combined with PostgreSQL lexical full-text search via Reciprocal Rank Fusion ($k=60$), expanded to 60-case unit test suite. | 🟩 Complete |
| **P4.5 — 3-Layer Auth** | Next.js SSR session cookies, Google OAuth 2.0 PKCE, FastAPI cryptographic JWKS verification, Supabase RLS, and modular frontend structure. | 🟩 Complete |
| **P5 — General PDF Parser** | Pluggable `BaseParser` subsystem, Markdown table reconstruction, sliding-window chunker, `POST /documents/upload` endpoint, and dual-section sidebar. | 🟩 Complete |
| **P6 — Containerization** | Multi-stage Docker builds (`backend/Dockerfile` slim Python 3.12, `frontend/Dockerfile` on Node 20 Alpine), `docker-compose.yml`, bridge network. | 🟩 Complete |
| **P6.1 — Hardening & Async** | 30 MB file quota, `%PDF-` magic byte check, SHA-256 deduplication, memory hygiene cache flushes, and async background task worker. | 🟩 Complete |
| **P6.2 — State Persistence** | Instant `localStorage` lazy initializers for analyses, active thread, user documents, and settings, eliminating page-reload vanish. | 🟩 Complete |
| **P6.3 — Scoping & Isolation** | Strict `document_id`/`document_ids` priority routing, retriever company filter bypass, dynamic citation labeling for non-SEC files. | 🟩 Complete |
| **P6.4 — Retrieval Acceleration** | pgvector HNSW index (`idx_chunks_embedding_hnsw`) eliminating sequential table scans. | 🟩 Complete |
| **P6.5 — Responsive UI Overhaul** | 5-tier responsive layout (desktop, <=1024px tablet drawers, <=640px mobile phones, 16px iOS font lock, safe-area insets). | 🟩 Complete |
| **P6.6 — CI/CD Automation** | GitHub Actions CI workflow (`.github/workflows/ci.yml`), offline unit testing, fast-path query guardrail, Vercel preview deploys. | 🟩 Complete |
| **P6.7 — Empirical QA Benchmark** | Scale-aware numerical grounding ($N / 1000$ billion conversion), LaTeX grouping normalization, primary reported unit prompting, 20/20 (100%) DEV pass. | 🟩 Complete |
| **P6.8 — Zero-PyTorch Embeddings** | Migrated to OpenAI `text-embedding-3-small` (1536-dim) via API, re-embedded 6,174 Supabase chunks, cut container RAM from ~450MB to ~60MB. | 🟩 Complete |
| **P6.9 — Guest Mode & v1.9 Audit** | Fixed BUG-001..008 (comparative quotas, 2-col PDF spacing, optimistic skeleton), enabled Guest Explorer Mode (`DEC-067`), isolated user uploads (`DEC-068`). | 🟩 Complete |
| **P6.10 — Theme & Page Offset Fix** | Zero-flash inline theme script (`DEC-069`); fixed `-10K` regex collision in `evidence.py` & `retrieval.py` + `resolvePhysicalPage()` dual-badge (`DEC-070`). | 🟩 Complete |
| **P6.11 — AWS EC2 Always-On CD** | Migrated backend FastAPI container to AWS EC2 Ubuntu host (0s cold start) with automated SSH deploy via `.github/workflows/cd.yml`. | 🟩 Complete |
| **P7 — Caching & Agentic (V4)** | Two-tier L1/L2 Redis query cache for cost reduction, bounded retry query rewriting, multi-step financial reconciliation. | ⬜ Optional Future |

---

## 3. Engineering Phase Checklists

### P4.5 — 3-Layer Authentication & Modular Architecture (Complete)

- [x] **Layer 1 (Next.js)**: Cookie-based SSR client (`browser.js`, `server.js`, `middleware.js`), Google OAuth 2.0 PKCE route (`/auth/callback`), protected workspace edge guard (`/workspace`), and Bearer token forwarding (`api.js`).
- [x] **Layer 2 (FastAPI)**: Token verification dependency (`get_current_user`), cryptographic Supabase JWKS validation, and route protection on `/documents` and `/query`.
- [x] **Layer 3 (Supabase)**: Row Level Security (RLS) on `user_query_history` isolating records to `user_id = auth.uid()`.
- [x] **Interactive Auth UI**: Live Avatar Initials Generator, Financial Role Selector Chips, 4-bar Password Strength Meter with dynamic criteria checklist, eye password visibility toggles, and terms agreement checkbox.
- [x] **Split PDF View Removal**: Completely removed docked split PDF view in favor of the focused `PdfViewerModal.jsx` with direct citation page jumping.
- [x] **Modular Frontend Reorganization**:
  - Reorganized components into `src/components/workspace/`, `src/components/modals/`, and `src/components/auth/`.
  - Added standalone `PasswordStrengthMeter.jsx` and `RoleChipSelector.jsx`.
  - Added custom hooks `useTheme.js`, `useAuth.js`, and `useChat.js`.
  - Added centralized `lib/constants.js`.
  - Verified clean Next.js production build (`npm run build`, 0 errors, 6/6 static routes).

---

### P5 — General PDF Parser & Ingestion Engine (Complete)

- [x] **Architecture Subsystem (`backend/app/parsers/`)**:
  - Implement `backend/app/parsers/base.py` defining the abstract `BaseParser` interface and `ParsedChunk`/`ParsedDocument` contracts.
  - Implement `backend/app/parsers/gen_pdf_parser.py`:
    - Clean text extraction with physical page number attribution.
    - Generic table extraction converted into GitHub-Flavored Markdown tables (`| Col 1 | Col 2 |`).
    - Spatial masking via `page.outside_bbox(table.bbox)` preventing duplicate table narrative extraction.
    - Sentence-bounded sliding-window narrative chunking breaking cleanly on punctuation boundaries.
  - Implement `backend/app/parsers/factory.py` to route dynamically based on `doc_type` (`sec_10k` vs `general`).
  - Extract SEC 10-K logic from `ingestion.py` into `backend/app/parsers/sec_10k_parser.py`.
- [x] **API Endpoints & Database Integrity**:
  - `POST /api/v1/documents/upload` accepting `UploadFile`, running `GeneralPDFParser`, embedding chunks via `ModelService`, and storing records.
  - Fixed relational foreign-key integrity in `document.py`: populate parent `pages` table records prior to inserting vector chunks to prevent constraint violations.
  - Update `backend/app/services/retrieval.py` to allow querying unversioned general documents (`corpus_version IS NULL` filter adjustment).
- [x] **Frontend Integration & Next.js Endpoints**:
  - Connect `UploadModal.jsx` to real `POST /api/documents/upload` with extraction and embedding progress notifications.
  - Create Next.js server route handler forwarding multipart `FormData` with verified Supabase JWT Bearer authentication.
  - Update `Sidebar.jsx` with two distinct collapsible containers: **Curated SEC 10-K Filings** and **My Uploaded Documents**, with custom badge pills, page counts, preview launchers, and multi-doc filtering.
  - Full production build verification (`npm run build` passing with 0 errors across all routes).

---

### P6 — Production Containerization & Docker Orchestration (Complete)

- [x] **Backend Containerization (`backend/Dockerfile`)**:
  - Python 3.12-slim base image with non-buffered logging and bytecode suppression (`PYTHONDONTWRITEBYTECODE=1`, `PYTHONUNBUFFERED=1`).
  - **PyTorch CPU Optimization**: Pre-installs lightweight CPU-only PyTorch, reducing wheel download size from 2,800MB down to 180MB.
  - **Production Dependency Pruning**: Pruned `requirements.txt` from 130 bloated frozen packages down to the 15 exact production libraries used, preventing container disk exhaustion.
  - Health check verification polling `GET /health/live`.
- [x] **Frontend Containerization (`frontend/Dockerfile`)**:
  - Multi-stage build (`deps` $\rightarrow$ `builder` $\rightarrow$ `runner`) using Node 20 Alpine.
  - Injected build-time Supabase public keys (`ARG NEXT_PUBLIC_SUPABASE_URL`, `ARG NEXT_PUBLIC_SUPABASE_ANON_KEY`).
  - Hardened with an unprivileged system user (`nextjs:nodejs`).
  - Health check polling `/api/health`.
- [x] **Docker Compose Orchestration (`docker-compose.yml`)**:
  - Defines `backend` and `frontend` services connected via `docintel-network` bridge.
  - Configured inter-container service discovery (`FASTAPI_BASE_URL=http://backend:8000`).
  - Read-only volume binding for `./data/originals` for physical PDF provenance viewing.
  - Health-dependent startup ordering (`depends_on: { backend: { condition: service_healthy } }`).

---

### P6.1 — Ingestion Hardening & Async Background Tasks (Complete)

- [x] **Upload Protection & File Integrity**:
  - Enforce 30 MB maximum file quota.
  - Implement magic byte checking (`%PDF-`) to reject executable masking.
  - Add SHA-256 deduplication to bypass redundant ingestion runs.
- [x] **Memory Hygiene**:
  - Flush pdfminer layout cache (`page.flush_cache()`) and execute periodic garbage collection every 20 pages to eliminate memory leaks on large reports.
  - Singleton embedding model lifecycle to prevent system memory exhaustion.
- [x] **Async Ingestion**:
  - Implement FastAPI `BackgroundTasks` pipeline returning HTTP 202 Accepted, unblocking the main HTTP thread during PDF ingestion.

---

### P6.2 — State Persistence Across Page Refreshes (Complete)

- [x] **Instant Client-Side Lazy Initializers**:
  - Implement zero-flicker `useState` lazy initializers from `localStorage` in `page.jsx` for analyses, active thread, user documents, and settings.
  - Eliminate the 1-second data wipe/vanish when users refresh the workspace.
- [x] **Supabase Direct Persistence**:
  - Direct insertion and retrieval from `user_query_history` and `documents` to guarantee query threads persist across devices.

---

### P6.3 — Strict Document Scoping & Contamination Elimination (Complete)

- [x] **Targeted Document Routing**:
  - In `page.jsx`, when an uploaded document is selected, strictly set `document_ids: [selectedDoc.document_id]`, disabling entity keyword regex overrides.
  - In `backend/app/services/answering.py`, dynamically set `self.retriever.company = None` when `document_id` or `document_ids` is provided to enforce strict single-document boundaries.
  - In `backend/app/services/retrieval.py`, prioritize `document_id` in `_build_where_filters`, completely bypassing company and year constraints for scoped queries.
- [x] **Clean Non-SEC Provenance Labeling**:
  - In `ingestion.py` and `evidence.py`, dynamically label non-SEC tables and passages as `Page {printed_page} Table / Excerpt` instead of hardcoded `"Item 8 / Item 7"`.
  - In `InspectorDrawer.jsx` and `MessageThread.jsx`, dynamically label citations as "Supporting SEC 10-K Disclosures" vs "Source Document Citations" based on document lineage.

---

### P6.4 — Retrieval Latency Acceleration & HNSW Vector Indexing (Complete)

- [x] **Supabase pgvector HNSW Migration**:
  - Authored `supabase/migrations/20261102000000_add_hnsw_vector_index.sql` creating `idx_chunks_embedding_hnsw` using `m=16, ef_construction=64, vector_cosine_ops` for sub-millisecond nearest neighbor search.
- [x] **Embedding Pipeline Acceleration**:
  - In `backend/app/integrations/models.py`, integrated `HuggingFaceEndpointEmbeddings` with automatic local fallback, eliminating cold-start model download timeouts.

---

### P6.5 — Universal Multi-Device Responsive UI Overhaul (Complete)

- [x] **Tablet & iPad Drawer Threshold (<=1024px)**:
  - Standardized off-canvas drawer threshold to `<= 1024px` for sidebar and inspector across desktop and tablets (iPad Mini, Air, Pro in landscape/portrait).
  - Added blurred backdrop dimming overlay with touch-to-dismiss behavior.
  - Added dynamic window `resize` event listener in `page.jsx` to adapt layout on tablet orientation change.
- [x] **Mobile Smartphone Optimization (<=640px & <=400px)**:
  - Enforced 16px minimum font size on `.chatgpt-textarea` to prevent iOS Safari automatic viewport zoom-in.
  - Integrated CSS `env(safe-area-inset-*)` padding for iPhone Dynamic Island, notch, and home bar indicator.
  - Added sticky first-column freezing on `.compare-benchmark-table` so financial line items stay locked during horizontal column touch swipes.
  - Added `viewportFit: 'cover'` in `layout.jsx` for full-bleed edge-to-edge mobile screens.
  - Consolidated duplicate variable declaration in `InspectorDrawer.jsx`.
  - Verified 0-error clean production build.

---

### P6.6 — CI/CD Pipeline & Automated Release Engineering (Complete)

- [x] **GitHub Actions Workflow (`.github/workflows/ci.yml`)**:
  - Configured multi-job CI running on pushes and pull requests across `main`, `develop`, `feature/**`, and `fix/**`.
  - **Backend Job**: Sets up Python 3.12, installs pruned dependencies, exports `HF_HUB_OFFLINE: "1"` and `TRANSFORMERS_OFFLINE: "1"` to guarantee fully offline, deterministic unit test execution.
  - **Frontend Job**: Sets up Node 20, verifies linting, and runs `npm run build` to catch bundling or syntax regressions prior to Vercel deployment.
- [x] **Fast-Path Policy Guardrail (`backend/app/api/v1/query.py`)**:
  - Extracted `check_out_of_scope()` in `backend/app/services/answering.py` as a lightweight standalone helper.
  - Intercepted trading and investment advice queries at the top of `execute_query()` in `query.py` before instantiating `AnswerService` or downloading embedding models.
  - Guaranteed strict Pydantic `QueryResponse` contract adherence (required `question`, `company`, `reporting_periods`, `timings_ms`).
  - Verified `test_query_endpoint_rejects_out_of_scope_trading_advice` asserts `_answering_service is None`.
- [x] **Vercel Preview & Production Lifecycle**:
  - Connected repository `Prabhu-Jethi/Financial_Doc` with automated Git Commit Status checks and Pull Request preview link comments.
  - Configured GitHub branch ruleset protecting `main` requiring CI status checks (`Lint, Type Check & Test Pipeline`) to pass before merging.
  - Validated clean PR merge (PR #9) into `main`.

---

### P6.7 — Empirical Verification, Scale-Aware Grounding & QA Benchmark (Complete)

- [x] **Scale-Aware Grounding in EvidenceService (`backend/app/services/evidence.py`)**:
  - Upgraded `audit_numerical_grounding()` to recognize legitimate billion-scale conversions ($N / 1000$) of million-scale 10-K reported figures (e.g. `$391.0B` or `$123.216B` for `$391,035M` and `$123,216M`).
  - Implemented LaTeX notation normalization (`{,}` $\rightarrow$ `,`) before regex tokenization to prevent formula grouping brackets from fragmenting multi-digit numbers into ungrounded tokens.
  - Added citation exclusions for footnote / Note markers (e.g., `Note 10`, `Note 2`) in addition to page citations.
  - Re-architected combined validation supporting both derived variance differences ($A - B$) and billion-scale conversions without regressing `test_citations.py`.
- [x] **Primary Reported Unit Enforcement (`backend/app/services/answering.py`)**:
  - Added Rule 8 to `SYSTEM_PROMPT` instructing the model to always report financial values using the exact scale and raw numbers as filed in the financial statement tables first (e.g., `"$391,035 million"`) before mentioning billion equivalents.
- [x] **Retrieval Depth Tuning (`backend/app/services/retrieval.py`)**:
  - Increased `top_k` from `8` to `10` and `candidate_limit` from `15` to `20` to prevent deep financial statement tables (such as Microsoft's Consolidated Income Statement on page 64) from falling outside the context window.
- [x] **Benchmark Evaluator Enhancement (`backend/scripts/eval_benchmark.py`)**:
  - Enhanced numeric match check to evaluate multi-precision billion variants (`.1f`, `.2f`, `.3f`) against ground truth numbers.
- [x] **Empirical Benchmark Verification (`evaluation/results/`)**:
  - **DEV-20 Benchmark (`dev_eval_report_hybrid_20261103_194400.json`)**:
    - **Total Cases Evaluated**: 20/20
    - **Cases Passed**: **20/20 (100.0%)** (jumped from 8/20, 40%)
    - **Calculation Precision**: **100.0%**
    - **Zero-Hallucination Rate**: **100.0%**
  - **RELEASE-40 Benchmark (`release_eval_report_hybrid_20261103_195708.json`)**:
    - **Cases Passed**: **24/40 (60.0%)** (jumped from 13/40, 32.5%)
    - **Zero-Hallucination Rate**: **100.0%** across all 40 held-out cases.

---

### P6.8 — OpenAI 1536-Dim Embeddings & Zero-PyTorch Slim Container (Complete)

- [x] **API-Driven Embedding Migration (`backend/app/integrations/models.py`)**:
  - Migrated from local `sentence-transformers/all-MiniLM-L6-v2` (384-dim) to OpenAI `text-embedding-3-small` (1536-dim) via `OpenAIEmbeddings`.
  - Re-embedded all 6,174 Supabase `chunks` rows and updated `idx_chunks_embedding_hnsw` to `vector(1536)`.
- [x] **Lightweight Docker Image (`backend/Dockerfile`, `backend/requirements.txt`)**:
  - Removed PyTorch/Torchvision/Transformers layers, shrinking backend container runtime RAM from ~450MB down to ~60MB and boot time to < 1.5s.

---

### P6.9 — v1.9 Engineering Audit, Guest Explorer Mode & Tenant Isolation (Complete)

- [x] **8-Defect v1.9 Remediation (BUG-001 through BUG-008)**:
  - Balanced comparative retrieval quotas (`retrieve_comparative()`), optimistic loading skeleton + XSS-safe bold parsing (`MessageThread.jsx`), 2-column text flow spacing (`gen_pdf_parser.py`), dynamic upload scoping, ticker filter wrapping, and PDF outline suppression.
- [x] **Guest Explorer Mode & Ingestion Barrier (`DEC-067` / `DEC-068`)**:
  - Configured `get_optional_user` across `/api/v1/query`, `/api/v1/documents`, `/api/v1/documents/{id}/status`, and `/api/v1/documents/{id}/pdf_url` so guests can freely explore all 11 SEC 10-K filings.
  - Enforced mandatory authentication (`get_current_user` -> HTTP 401) on `POST /api/v1/documents/upload` with an in-modal sign-in barrier card (`UploadModal.jsx`).
  - Strictly scoped uploaded documents (`user_id = user.id`) so new accounts and guest sessions always display an empty **My Uploaded Documents** drawer.
  - Expanded offline deterministic unit test suite to **60 cases** (`backend/tests/unit/`).

---

### P6.10 — Theme Persistence & Physical-to-Printed PDF Page Offset Alignment (Complete)

- [x] **Zero-Flash Theme Persistence (`DEC-069`)**:
  - Fixed premature `useEffect` return inside `frontend/src/app/page.jsx` that prevented theme, resize, and settings restoration across reloads.
  - Injected synchronous inline script in `<head>` of `frontend/src/app/layout.jsx` to apply `docintel_theme` before first paint; styled `.btn-modal-secondary` (`globals.css`) and explicit card clicks (`SettingsModal.jsx`).
- [x] **Physical-to-Printed PDF Page Offset Alignment (`DEC-070`)**:
  - Fixed critical regex collision in `backend/app/services/evidence.py` where `[-_]P?(\d+)` matched `-10` from `10-K` document IDs, causing all citations to scroll to Page 10.
  - Added strict `(?:[-_\s]+P|[-_]p)(\d+)(?![a-zA-Z])` extraction in `evidence.py` and `retrieval.py` (with `import re`), plus frontend safeguard `resolvePhysicalPage()` and dual report badge `PAGE {currentPage} (Report P. {printed_page})` in `PdfViewerModal.jsx`.
  - Verified with 3 regression unit tests in `test_citations.py` and clean Next.js build.

---

### P6.11 — AWS EC2 Always-On Backend & Automated GitHub Actions CD (Complete)

- [x] **AWS EC2 Container Host**:
  - Migrated FastAPI backend container (`docintel-api`) from Render Free Tier to an always-on **AWS EC2 Ubuntu** host (2GB swapfile, port 8000, `--restart unless-stopped`), eliminating 45s cold starts and monthly instance-hour exhaustion.
- [x] **Automated Continuous Deployment (`.github/workflows/cd.yml`)**:
  - Configured SSH-based GitHub Actions deployment workflow triggering on pushes to `main` and `test` to automatically pull commits, rebuild `docintel-backend:latest`, and restart `docintel-api`.
- [x] **Vercel Hybrid Integration**:
  - Wired Vercel Next.js 14 BFF (`https://docintel-sage.vercel.app`) to EC2 via `FASTAPI_BASE_URL` with `Supabase` handling PostgreSQL `pgvector`, Auth, and private PDF storage.
