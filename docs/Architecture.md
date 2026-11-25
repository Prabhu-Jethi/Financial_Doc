# 🟪 Architecture.md — How the pieces connect

**Financial Report Analysis Assistant & Document Intelligence Platform** · v1.10 · 25 November 2026

> 🟩 **Production hybrid cloud architecture operational.** Next.js 14 modular frontend workspace deployed on Vercel (`https://docintel-sage.vercel.app`), Dockerized FastAPI microservice (`python:3.12-slim`, ~60MB RAM, zero PyTorch) hosted on AWS EC2 with automated GitHub Actions CD (`.github/workflows/cd.yml`), Supabase PostgreSQL with 1536-dim OpenAI `text-embedding-3-small` `pgvector` HNSW indexing (`idx_chunks_embedding_hnsw`) + lexical RRF ($k=60$, $top\_k=10$), Guest Explorer Mode + authenticated multi-tenant isolation (`user_id = auth.uid()`), calibrated physical-to-printed PDF page alignment (`DEC-070`), and a 60-case deterministic unit test suite verified offline in CI.

[Requirements](Trd.md) · [Architecture](Architecture.md) · [Rules](rules.md) · [Phases](phases.md) · [Memory](memory.md)

---

## 1. Application map & 3-layer security

```mermaid
flowchart TD
    subgraph Layer1["Layer 1: Presentation & Session (Vercel / Next.js 14)"]
        UI["React Client Components (Workspace, Modals, Auth)"] --> BFF["Next.js Route Handlers & BFF Proxy (/api/*)"]
        BFF --> COOKIE["Supabase SSR Session Cookies & Edge Middleware"]
    end

    subgraph Layer2["Layer 2: Application & API (AWS EC2 / Dockerized FastAPI)"]
        BFF -->|"Optional or Verified Bearer <supabase-jwt>"| API["FastAPI v1 Gateway & Auth Dependencies"]
        API --> ROUTER{"Document Type Router"}
        ROUTER -->|"sec_10k (Public / Guest)"| SEC_ENGINE["Financial 10-K Logic & Evidence Auditor"]
        ROUTER -->|"general (Authenticated Tenant)"| GEN_ENGINE["General Document Parser & Retrieval"]
        SEC_ENGINE --> CALC["Verified Decimal Calculator"]
        SEC_ENGINE --> LLM["ModelService (OpenAI Embeddings + ChatOpenAI)"]
        GEN_ENGINE --> LLM
    end

    subgraph Layer3["Layer 3: Data & Multi-Tenancy (Supabase & Postgres)"]
        API -->|"Tenant Scoped Queries / RLS"| DB["PostgreSQL with pgvector 1536-dim (chunks, documents, pages)"]
        API --> STORAGE["Supabase Storage (Signed PDF URLs)"]
        COOKIE -.->|"OAuth 2.0 PKCE"| AUTH_SRV["Supabase Auth & Google Identity"]
    end

    classDef blue fill:#DBEAFE,stroke:#2563EB,color:#172554
    classDef purple fill:#EDE9FE,stroke:#7C3AED,color:#3B0764
    classDef green fill:#DCFCE7,stroke:#16A34A,color:#14532D
    classDef amber fill:#FEF3C7,stroke:#D97706,color:#78350F
    class UI,BFF,COOKIE blue
    class API,ROUTER,SEC_ENGINE,GEN_ENGINE,CALC,LLM purple
    class DB,STORAGE,AUTH_SRV green
```

| Layer | Responsibility | Security Boundary |
|---|---|---|
| **Next.js 14 (Vercel)** | Workspace UI, zero-flash theme persistence (`layout.jsx`), SSR session cookies, `/api/*` BFF proxy, local SEC corpus fallback | Same-origin browser requests, edge middleware session refresh, no browser-exposed service role keys. |
| **FastAPI (AWS EC2)** | Optional/mandatory JWT verification (`get_optional_user` / `get_current_user`), multi-tenant upload barrier (HTTP 401 for guests on `/upload`), Decimal math, hybrid RAG | Rejects unauthenticated uploads (`POST /api/v1/documents/upload`) and private metadata calls with HTTP 401; derives `user_id` strictly from verified JWT `sub` claim. |
| **Supabase / Postgres** | Auth management, 1536-dim `pgvector` HNSW search, private PDF bucket, Row Level Security (RLS) | Curated SEC 10-K filings remain publicly explorable in Guest Mode; `user_query_history` and user-uploaded documents (`user_id IS NOT NULL`) are isolated per `user_id = auth.uid()`. |

---

## 2. Pluggable Document Parsing Subsystem

The ingestion engine is structured as a **Pluggable Parser Architecture** (`backend/app/parsers/`), maintaining strict financial 10-K extraction while enabling authenticated general PDF parsing as a dedicated feature:

```mermaid
flowchart TD
    UPLOAD["Incoming PDF File (Authenticated Upload)"] --> FACTORY{"ParserFactory.get_parser()"}
    
    subgraph SEC_PARSER["SEC 10-K Financial Parser"]
        FACTORY -->|"doc_type: sec_10k"| P_SEC["SEC10KParser"]
        P_SEC --> EX_SEC["Extract Narrative + Statement Tables"]
        EX_SEC --> PARENT["Parent Statement Matrices & Footnotes"]
        EX_SEC --> ACC["Accounting Formats: (1,234) -> -1234, Scale Multiplier"]
        ACC --> CHK_SEC["Bounded Row-Group Chunks with Header Lineage"]
    end

    subgraph GEN_PARSER["General Document Parser (Additional Feature)"]
        FACTORY -->|"doc_type: general"| P_GEN["GeneralPDFParser"]
        P_GEN --> EX_GEN["Page-by-Page Clean Text (2-Column Flow Tolerance)"]
        EX_GEN --> TBL_MD["Generic Table to Markdown Grid Conversion"]
        EX_GEN --> CHK_GEN["Sentence-Bounded Sliding Window (~350 words, 50-word overlap)"]
        CHK_GEN --> META_GEN["Attach user_id, page_number, and chunk_type metadata"]
    end

    CHK_SEC --> EMBED["ModelService Embedding (OpenAI text-embedding-3-small 1536-d)"]
    CHK_GEN --> EMBED
    EMBED --> STORE["Batch Insert into PostgreSQL chunks with pgvector HNSW"]

    classDef blue fill:#DBEAFE,stroke:#2563EB,color:#172554
    classDef purple fill:#EDE9FE,stroke:#7C3AED,color:#3B0764
    classDef green fill:#DCFCE7,stroke:#16A34A,color:#14532D
    class UPLOAD,FACTORY blue
    class P_SEC,EX_SEC,PARENT,ACC,CHK_SEC purple
    class P_GEN,EX_GEN,TBL_MD,CHK_GEN,META_GEN blue
    class EMBED,STORE green
```

### SEC 10-K Parser vs. General PDF Parser

| Dimension | SEC 10-K Financial Parser | General PDF Parser (Additional Feature) |
|---|---|---|
| **Target Corpus** | Annual SEC Form 10-K filings (Item 7 MD&A, Item 8 Financials) | Arbitrary user-uploaded PDFs (contracts, research notes, invoices, whitepapers) |
| **Table Handling** | Strict cell matrices, period header paths, accounting parentheses `(1,234)`, scale multipliers ($M) | Generic tables converted to Markdown grids (`\| Col 1 \| Col 2 \|`) preserving column alignments |
| **Narrative Chunking** | Bounded sections mapped to corporate filing disclosure items | Sliding word window (~350 words, 50-word overlap) preserving 2-column reading order (`use_text_flow=True`) |
| **Data Tenancy** | Curated system-wide corpus accessible in Guest Explorer Mode & Authenticated sessions | Multi-tenant isolation: tagged with `user_id`, empty for guests/new users, protected via RLS |
| **Citation Output** | Company, fiscal year, statement section, printed footer page + calibrated 1-based physical `source_page`, verbatim quote | Document filename, physical page index (`source_page`), verbatim excerpt quote |

---

## 3. Query Execution, Physical Page Resolution & Grounding

```mermaid
flowchart TD
    Q["User Query + Document Scope"] --> AUTH_CHK["Resolve Optional Bearer JWT (Guest or Authenticated)"]
    AUTH_CHK --> POLICY{"Fast-Path Policy Guardrail"}
    POLICY -->|"Trading Advice / Out-of-Scope"| REJECT["Immediate Rejection (Zero Model Load)"]
    POLICY -->|"Valid Query"| RET["Hybrid Search: Dense (1536-d pgvector <=>) + Lexical (websearch_to_tsquery)"]
    RET --> RRF["Reciprocal Rank Fusion (k=60) + Physical Page Extraction"]
    RRF --> SCOPE{"Document Scope Filter"}
    SCOPE -->|"sec_10k"| AUDIT["Scale-Aware Provenance & Numerical Grounding Auditor"]
    SCOPE -->|"general"| GEN_AUDIT["Verbatim Quote & Physical Page Verification"]
    AUDIT --> CALC_CHK{"Calculations Needed?"}
    CALC_CHK -->|"Yes"| CALC["Deterministic Decimal Calculator & Formula Ledger"]
    CALC_CHK -->|"No"| SYNTH["LLM Synthesis with Grounded Page Citations"]
    CALC --> SYNTH
    GEN_AUDIT --> SYNTH
    SYNTH --> OUT["Structured Response (AnswerText, Calculations, Citations with source_page)"]

    classDef blue fill:#DBEAFE,stroke:#2563EB,color:#172554
    classDef purple fill:#EDE9FE,stroke:#7C3AED,color:#3B0764
    classDef green fill:#DCFCE7,stroke:#16A34A,color:#14532D
    classDef red fill:#FEE2E2,stroke:#DC2626,color:#991B1B
    class Q,AUTH_CHK,POLICY blue
    class REJECT red
    class RET,RRF,SCOPE purple
    class AUDIT,GEN_AUDIT,CALC_CHK,CALC,SYNTH,OUT green
```

* **Grounding Guarantee:** No numeric claim is presented as verified unless matched against an indexed chunk or derived via `FinancialCalculator`.
* **Physical-to-Printed Page Alignment (`DEC-070`):** Both `retrieval.py` and `evidence.py` extract the 1-based physical sheet index (`physical_page` / `source_page`) strictly from `P(\d+)` page identifiers using negative lookahead `(?![a-zA-Z])` so `-10K` document prefixes never corrupt pagination. `PdfViewerModal.jsx` renders dual transparency badges (`PAGE {currentPage} (Report P. {printed_page})`) when physical sheet index differs from printed report numbering.

---

## 4. Current Repository Structure

```plaintext
Financial_Doc/
├── .github/workflows/
│   ├── ci.yml                              # Offline backend unit tests (60 cases), Next.js build, Docker validation
│   └── cd.yml                              # Automated SSH Docker deployment to AWS EC2 (main & test branches)
├── docker-compose.yml                      # Unified local multi-container orchestration & bridge networking
├── .env.example                            # Full-stack environment template
│
├── backend/
│   ├── Dockerfile                          # Lightweight python:3.12-slim (~60MB runtime, zero PyTorch, curl healthcheck)
│   ├── .dockerignore                       # Excludes venv, tests, and caches
│   ├── requirements.txt                    # Pruned API-driven production dependencies
│   ├── app/
│   │   ├── main.py                         # FastAPI app, CORS middleware, root & /health/* probes
│   │   ├── schemas.py                      # Typed Pydantic v2 API contracts
│   │   ├── api/v1/
│   │   │   ├── router.py                   # API v1 router aggregation
│   │   │   ├── auth.py                     # Authenticated profile inspection (/auth/me)
│   │   │   ├── document.py                 # Guest-aware catalog, async PDF upload, status polling, signed URLs
│   │   │   ├── health.py                   # Liveness & PostgreSQL readiness endpoints
│   │   │   └── query.py                    # Audited RAG query execution + fast-path guardrail
│   │   ├── core/                           # System settings & JWT validation
│   │   │   ├── config.py                   # Pydantic BaseSettings
│   │   │   └── security.py                 # Supabase JWT verification (get_current_user, get_optional_user)
│   │   ├── parsers/                        # Pluggable parser subsystem
│   │   │   ├── base.py                     # BaseParser interface
│   │   │   ├── factory.py                  # ParserFactory resolver
│   │   │   ├── sec_10k_parser.py           # Financial statement & accounting parser
│   │   │   └── gen_pdf_parser.py           # Generic 2-column PDF & markdown table parser
│   │   ├── services/                       # Business logic services
│   │   │   ├── ingestion.py                # Pipeline orchestration
│   │   │   ├── retrieval.py                # Dense + Lexical RRF search & physical page attribution
│   │   │   ├── calculations.py             # Decimal arithmetic solver
│   │   │   ├── evidence.py                 # Provenance, source_page resolution & grounding auditor
│   │   │   └── answering.py                # LLM cited response generator & comparative routing
│   │   └── integrations/                   # Infrastructure adapters
│   │       ├── database.py                 # pgvector client
│   │       ├── storage.py                  # Supabase Storage client
│   │       └── models.py                   # OpenAI text-embedding-3-small & ChatOpenAI adapter
│   └── tests/unit/                         # 60 deterministic offline unit tests
│
├── frontend/
│   ├── Dockerfile                          # Multi-stage production build (Node 20 Alpine)
│   ├── .dockerignore                       # Excludes node_modules, .next, and envs
│   ├── package.json                        # Next.js 14, React 18, Supabase SSR
│   ├── src/
│   │   ├── app/                            # App Router routes & layouts
│   │   │   ├── globals.css                 # Theme tokens, modal styles & WCAG AA/AAA styling
│   │   │   ├── layout.jsx                  # Root layout with synchronous anti-flash theme script
│   │   │   ├── page.jsx                    # Primary analysis workspace (guest + authenticated)
│   │   │   ├── login/page.jsx              # Interactive Google OAuth & classic auth
│   │   │   ├── workspace/page.jsx          # Protected workspace route
│   │   │   ├── auth/callback/route.js      # PKCE exchange route
│   │   │   └── api/                        # Next.js BFF proxy routes (documents, query, health, history, upload)
│   │   ├── components/
│   │   │   ├── Header.jsx                  # Top navigation, live engine status & theme/profile controls
│   │   │   ├── auth/                       # PasswordStrengthMeter, RoleChipSelector
│   │   │   ├── workspace/                  # Sidebar, SidebarPanel, ChatInput, MessageThread, AnswerWorkspace, FinancialChart, InspectorDrawer, KpiStrip, QueryConsole
│   │   │   └── modals/                     # PdfViewerModal, UploadModal, CompareMatrixModal, ProfileModal, SettingsModal, AuditGuideModal
│   │   ├── hooks/                          # useAuth, useChat, useTheme
│   │   └── lib/                            # constants.js, exportExcel.js, server/api.js, server/mockEngine.js, supabase/
│   └── middleware.js                       # Next.js edge session middleware
│
├── supabase/
│   └── migrations/                         # Versioned SQL migrations (RLS, 1536-dim HNSW vector index, schema)
├── data/                                   # Document lake (11 original SEC 10-Ks, manifest)
└── evaluation/                             # Quantitative benchmark suites & results
```

---

## 5. Technology Stack Summary

| Component | Technology | Role |
|---|---|---|
| **Frontend & BFF** | Next.js 14 (App Router, React 18 SSR) on **Vercel** | Client workspace UI, SSR session cookies, zero-flash theme restoration, server proxy to EC2 |
| **Styling** | Vanilla CSS with Custom Properties | Strict WCAG AA/AAA compliance, 5-tier responsive layouts, zero bundle bloat |
| **Backend API** | Python 3.12, FastAPI, Pydantic v2 in **Docker on AWS EC2** | High-performance async microservice (~60MB RAM), typed contracts, always-on compute |
| **CI/CD** | GitHub Actions (`ci.yml` + `cd.yml`) | 60-test offline CI gate + automated SSH Docker rebuild/restart on AWS EC2 |
| **Database & Vectors** | Supabase PostgreSQL + `pgvector` HNSW | Relational tables, full-text lexical search, 1536-dim cosine similarity index |
| **Authentication** | Supabase Auth (Google OAuth 2.0 PKCE + Email/Pass) | Guest exploration mode for SEC 10-Ks + isolated multi-tenant uploads (`user_id = auth.uid()`) |
| **PDF Extraction** | `pdfplumber` | Coordinate text extraction, 2-column flow reconstruction, table matrices |
| **Embeddings** | OpenAI `text-embedding-3-small` (API) | 1536-dimensional normalized dense vectors (eliminates local PyTorch bloat) |
| **Generative LLM** | `ChatOpenAI` adapter (`gpt-6-luna`) | Grounded answering, citation synthesis, operand identification |

---

## 6. Production Hybrid Deployment Topology

In production, DocIntel decouples the presentation proxy from compute-heavy backend orchestration:

```mermaid
flowchart TD
    subgraph Cloud["Production Hybrid Cloud"]
        VERCEL["Vercel Edge / Serverless\nNext.js 14 Frontend + BFF Proxy\n(https://docintel-sage.vercel.app)"]
        EC2["AWS EC2 Ubuntu Host\nContainer: docintel-api (FastAPI :8000)\n• python:3.12-slim (~60MB RAM)\n• 2GB Swap + --restart unless-stopped\n• Always-On (0s Cold Start)"]
        SUPA["Supabase Cloud\n• PostgreSQL + pgvector (1536-d HNSW)\n• Supabase Auth (OAuth PKCE / JWT)\n• Supabase Storage (Signed PDF URLs)"]
    end

    GH["GitHub Actions (.github/workflows/cd.yml)"] -->|"SSH Build & Restart on push (main, test)"| EC2
    USER["Analyst / Guest Browser"] -->|"HTTPS"| VERCEL
    VERCEL -->|"FASTAPI_BASE_URL\nhttp://<EC2_HOST>:8000"| EC2
    EC2 -->|"SQL + Storage + Auth"| SUPA

    classDef blue fill:#DBEAFE,stroke:#2563EB,color:#172554
    classDef orange fill:#FFEDD5,stroke:#EA580C,color:#7C2D12
    classDef green fill:#DCFCE7,stroke:#16A34A,color:#14532D
    class VERCEL blue
    class EC2,GH orange
    class SUPA green
```

### Key Deployment & Container Optimizations:
1. **Zero-PyTorch Container Footprint**: Replacing local `sentence-transformers`/PyTorch with API-driven OpenAI `text-embedding-3-small` reduced the backend memory footprint from ~450MB down to ~60MB RAM and dropped startup time from ~25s to < 1.5s.
2. **Always-On AWS EC2 + Automated CD**: Eliminates PaaS free-tier sleep cold-starts and monthly running-hour exhaustion; `.github/workflows/cd.yml` pulls changes, rebuilds `docintel-backend:latest`, and restarts `docintel-api` automatically on pushes to `main` and `test`.
3. **Resilient BFF Fallback**: If the upstream FastAPI service is temporarily unreachable or restarting, Next.js `api.js` serves verified curated SEC 10-K resolutions (`mockEngine.js`) for general queries while clearly guarding document-specific queries.

---

## 7. Target System Design Blueprint for 1,000 Users

| Pillar | Architecture Pattern | Implementation Details |
|---|---|---|
| **1. Asynchronous Ingestion** | Background Worker (ARQ / Celery + Redis) | Upload endpoint currently returns `HTTP 202 Accepted` with FastAPI `BackgroundTasks`; scales cleanly to durable Redis workers at 1,000 users. |
| **2. Connection Pooling & Indexing** | Supavisor / PgBouncer + HNSW | Routes transactions through Supabase connection pooler (port 6543) with existing `idx_chunks_embedding_hnsw` for sub-50ms vector lookups. |
| **3. Multi-Tenant Isolation** | PostgreSQL Row-Level Security (RLS) | `documents` and `chunks` isolate private uploads to `user_id = auth.uid()` while allowing guest read access to curated SEC 10-K filings. |
| **4. Cost & Quota Defense** | SlowAPI Rate Limiting + Two-Tier Cache | Planned L1 RAM LRU + L2 Redis cache for deterministic SEC 10-K queries to eliminate repeat embedding/LLM API costs and cut latency under 10ms. |
| **5. Auditable Observability** | Structured Logging with `request_id` | Propagates `X-Request-ID` across Next.js and FastAPI responses with latency breakdowns (`timings_ms`). |

---

## 8. Strict Document Scoping & Contamination Elimination

To guarantee that queries on user-uploaded documents (e.g., general contracts, invoices, research papers) are never contaminated by SEC 10-K company disclosures:

```mermaid
flowchart LR
    Q_IN["User Query Text"] --> CHECK{"Document Selected\nin Sidebar?"}
    CHECK -->|"Yes (document_ids)"| SCOPED["Scope Override: document_ids=[doc_id]"]
    CHECK -->|"No (Corpus Scope)"| REGEX["Regex Company Detection (AAPL, MSFT, etc.)"]
    
    SCOPED --> CLEAR["answering.py: self.retriever.company = None"]
    CLEAR --> FILTER["retrieval.py: WHERE document_id = ANY(document_ids)"]
    FILTER --> CLEAN_CITE["evidence.py: Label 'Page N Table/Excerpt' (No 'Item 8')"]
    CLEAN_CITE --> UI_CITE["UI Citation Tray: 'Source Document Citations'"]
    
    REGEX --> CORPUS_RET["retrieval.py: WHERE company = %s"]
    CORPUS_RET --> SEC_CITE["evidence.py: Label 'Item 8 / Item 7'"]
    SEC_CITE --> UI_SEC["UI Citation Tray: 'Supporting SEC 10-K Disclosures'"]
```

---

## 9. Universal Multi-Device Responsive Architecture

DocIntel implements a 5-tier responsive layout supporting desktops, tablets (iPad Mini, Air, Pro in landscape & portrait), foldables, and mobile phones:

| Viewport Tier | Key Responsive Behaviors |
|---|---|
| **Desktop (> 1024px)** | Fixed 3-column institutional layout: Sidebar (260px) + Main Conversation Feed + Provenance Inspector (350px). |
| **Tablet (<= 1024px)** | Off-canvas drawer layout: Sidebar and Inspector slide over the stage with `backdrop-filter: blur(3px)` touch-dismiss. Prevents squeezing chat area. |
| **Standard Tablet (<= 768px)** | Sticky first-column locking on `.compare-benchmark-table` for horizontal swipe navigation. Horizontal scrollable tab strip on Settings modal. |
| **Mobile (<= 640px)** | `font-size: 16px !important` on `.chatgpt-textarea` to prevent iOS Safari auto-zoom. Full safe-area inset support (`env(safe-area-inset-bottom/top)`) for iPhone Dynamic Island and home indicators. 36px touch targets for action buttons. |
| **Compact (<= 400px)** | Compact top bar with auto-collapsed scope badges to prevent horizontal page blowout. |
