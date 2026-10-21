"use client";

import { useState } from "react";

export default function Sidebar({
  isOpen,
  onClose,
  documents = [],
  selectedDocIds = [],
  onToggleDocSelection,
  onSelectAllDocs,
  onClearAllDocs,
  onOpenUpload,
  onPreviewDocument,
  history = [],
  onSelectHistory,
  onNewSession,
  onOpenCompare,
  currentUser = null,
  onSignOut,
  activeEngine,
  theme = "light",
  onToggleTheme,
}) {
  const [documentsExpanded, setDocumentsExpanded] = useState(true);
  const [activeCompanyFilter, setActiveCompanyFilter] = useState("All");

  const companies = ["All", "AAPL", "AMZN", "MSFT", "META"];

  const filteredDocs = documents.filter((doc) => {
    if (activeCompanyFilter === "All") return true;
    return doc.ticker === activeCompanyFilter || (doc.company && doc.company.toUpperCase().includes(activeCompanyFilter));
  });

  return (
    <aside className={`webapp-sidebar ${isOpen ? "open" : ""}`} aria-label="Application Sidebar">
      {/* Top Header */}
      <div className="sidebar-header">
        <div className="app-brand">
          <div className="brand-icon">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
            </svg>
          </div>
          <div>
            <span className="brand-name">DocIntel</span>
            <span className="brand-tag">SEC 10-K</span>
          </div>
        </div>

        {/* Mobile close toggle */}
        {onClose && (
          <button
            type="button"
            className="sidebar-close-btn"
            onClick={onClose}
            title="Collapse sidebar"
            aria-label="Collapse sidebar"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        )}
      </div>

      {/* Main Scrollable Area */}
      <div className="sidebar-scroll-area">
        {/* ChatGPT-Style New Analysis Button */}
        <button
          type="button"
          className="btn-new-query"
          onClick={onNewSession}
          title="Start a new analysis thread"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          <span>New Analysis</span>
        </button>

        {/* Multi-Company Comparison Matrix Launcher */}
        {onOpenCompare && (
          <button
            type="button"
            className="btn-compare-launcher"
            onClick={onOpenCompare}
            title="Open 4-Company Benchmark Scorecard (AAPL, MSFT, AMZN, META)"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 20V10" />
              <path d="M12 20V4" />
              <path d="M6 20v-6" />
            </svg>
            <span>Compare Filings</span>
            <span className="badge-matrix-pill">Matrix</span>
          </button>
        )}

        {/* =========================================================================
            COLLAPSIBLE DOCUMENT CONTAINER (Accordion)
           ========================================================================= */}
        <div className="documents-accordion-container">
          <div
            className="accordion-header"
            onClick={() => setDocumentsExpanded(!documentsExpanded)}
            title="Toggle SEC Filings Container"
          >
            <div className="accordion-title-group">
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                className={`accordion-chevron ${documentsExpanded ? "expanded" : ""}`}
              >
                <polyline points="9 18 15 12 9 6" />
              </svg>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: "var(--c-charcoal)" }}>
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
              </svg>
              <span>SEC 10-K Filings</span>
              <span className="doc-count-badge">{documents.length}</span>
            </div>

            <button
              type="button"
              className="btn-accordion-quick-upload"
              onClick={(e) => {
                e.stopPropagation();
                onOpenUpload();
              }}
              title="Upload new filing"
            >
              + Upload
            </button>
          </div>

          {/* Accordion Content */}
          {documentsExpanded && (
            <div className="accordion-content">
              {/* Minimalist Upload Pill */}
              <div
                className="compact-upload-pill"
                onClick={onOpenUpload}
                title="Upload or drop SEC Form 10-K filing PDF"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="17 8 12 3 7 8" />
                  <line x1="12" y1="3" x2="12" y2="15" />
                </svg>
                <span>Upload New 10-K PDF</span>
              </div>

              {/* Company Filter Chips */}
              <div className="company-filter-bar">
                {companies.map((co) => (
                  <button
                    key={co}
                    type="button"
                    className={`company-chip ${activeCompanyFilter === co ? "active" : ""}`}
                    onClick={() => setActiveCompanyFilter(co)}
                  >
                    {co}
                  </button>
                ))}
              </div>

              {/* Compact Document Rows */}
              <div className="compact-doc-list">
                {filteredDocs.map((doc) => {
                  const isSelected = selectedDocIds.includes(doc.document_id);
                  const ticker = doc.ticker || "SEC";
                  const year = doc.report_fiscal_year || "2024";

                  return (
                    <div
                      key={doc.document_id}
                      className={`compact-doc-row ${isSelected ? "selected" : ""}`}
                      onClick={() => onToggleDocSelection(doc.document_id)}
                      title={`${doc.company || "Filing"} FY${year} — Click to toggle selection`}
                    >
                      <input
                        type="checkbox"
                        className="doc-mini-checkbox"
                        checked={isSelected}
                        onChange={() => onToggleDocSelection(doc.document_id)}
                        onClick={(e) => e.stopPropagation()}
                        aria-label={`Select ${doc.company}`}
                      />

                      <span className={`mini-ticker-pill ticker-${ticker.toLowerCase()}`}>
                        {ticker}
                      </span>

                      <div className="compact-doc-label">
                        <span className="doc-main-name">
                          {doc.company ? doc.company.replace(", Inc.", "").replace(" Corporation", "") : "SEC Filing"}
                        </span>
                        <span className="doc-year-tag">FY{year}</span>
                      </div>

                      {/* PDF Preview Icon Button */}
                      {onPreviewDocument && (
                        <button
                          type="button"
                          className="btn-preview-pdf"
                          onClick={(e) => {
                            e.stopPropagation();
                            onPreviewDocument(doc);
                          }}
                          title="Open original filing PDF"
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                            <circle cx="12" cy="12" r="3" />
                          </svg>
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* =========================================================================
            CHATGPT-STYLE CONVERSATION THREADS (Primary Real Estate)
           ========================================================================= */}
        <div className="history-section">
          <div className="sidebar-section-title">
            <span>Recent Analyses</span>
          </div>

          {history.length === 0 ? (
            <div className="history-empty-state">
              <span>No prior queries yet. Ask any financial question to start.</span>
            </div>
          ) : (
            <div className="history-thread-list">
              {history.map((h, idx) => (
                <button
                  key={idx}
                  type="button"
                  className="history-thread-item"
                  onClick={() => onSelectHistory(h)}
                  title={h.question}
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="thread-icon">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                  </svg>
                  <span className="thread-title">{h.question}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* User Account Profile & Sign Out */}
      {currentUser && (
        <div className="sidebar-user-section">
          <div className="sidebar-user-info">
            <div className="user-avatar-circle mini">
              {currentUser.user_metadata?.avatar_url ? (
                <img
                  src={currentUser.user_metadata.avatar_url}
                  alt="User"
                  className="user-avatar-img"
                />
              ) : (
                <span>
                  {currentUser.user_metadata?.full_name
                    ? currentUser.user_metadata.full_name
                        .split(/\s+/)
                        .map((n) => n[0])
                        .slice(0, 2)
                        .join("")
                        .toUpperCase()
                    : (currentUser.email || "U")[0].toUpperCase()}
                </span>
              )}
            </div>
            <div className="sidebar-user-details">
              <span className="sidebar-user-name">
                {currentUser.user_metadata?.full_name || currentUser.email?.split("@")[0]}
              </span>
              <span className="sidebar-user-email">
                {currentUser.user_metadata?.role ? `${currentUser.user_metadata.role} • ` : ""}{currentUser.email}
              </span>
            </div>
          </div>
          {onSignOut && (
            <button
              type="button"
              className="btn-sidebar-signout"
              onClick={onSignOut}
              title="Sign out of your account"
            >
              Sign Out
            </button>
          )}
        </div>
      )}

      {/* Bottom Status Footer */}
      <div className="sidebar-footer">
        <div className="system-mode-tag">
          <span className="doc-status-dot" />
          <span>{activeEngine === "fastapi_live" ? "FastAPI Live" : "SEC 10-K Index"}</span>
        </div>
        {onToggleTheme && (
          <button
            type="button"
            className="sidebar-theme-toggle-btn"
            onClick={onToggleTheme}
            title={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
            aria-label="Toggle color theme"
          >
            {theme === "dark" ? "☀️ Light" : "🌙 Dark"}
          </button>
        )}
        <span className="version-pill">v1.3</span>
      </div>
    </aside>
  );
}
