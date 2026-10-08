"use client";

export default function Header({ health, onOpenDocuments, onOpenGuide }) {
  const isOnline = health?.active_engine === "fastapi_live";
  const engineLabel = isOnline ? "FastAPI Live" : "SEC 10-K Index";

  return (
    <header className="site-header">
      <div className="header-inner">
        {/* Brand */}
        <div className="header-brand">
          <div className="brand-icon-wrapper" aria-hidden="true">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
              <line x1="10" y1="9" x2="8" y2="9" />
            </svg>
          </div>
          <div className="brand-title-group">
            <h1>
              <span className="brand-title-gradient">Apex Intelligence</span>
              <span className="brand-badge">SEC 10-K</span>
            </h1>
            <p className="brand-subtitle">
              <span>Apple Inc. (NASDAQ: AAPL)</span>
              <span className="brand-subtitle-dot"></span>
              <span>Official Form 10-K (FY2022–FY2024)</span>
            </p>
          </div>
        </div>

        {/* Right Status & Tools */}
        <div className="header-actions">
          <div className="system-status-pill" title={`Active engine: ${engineLabel}`}>
            <span className={`pulse-indicator ${isOnline ? "" : "offline"}`} />
            <span className="status-text-mono">{engineLabel}</span>
          </div>

          <button
            type="button"
            className="btn-header"
            onClick={onOpenDocuments}
            title="Browse Indexed Form 10-K Filings"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
              <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
            </svg>
            <span>Corpus</span>
          </button>

          <button
            type="button"
            className="btn-header"
            onClick={onOpenGuide}
            title="Audit Integrity Rules & Methodology"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 16v-4" />
              <path d="M12 8h.01" />
            </svg>
            <span>Audit Guide</span>
          </button>
        </div>
      </div>
    </header>
  );
}
