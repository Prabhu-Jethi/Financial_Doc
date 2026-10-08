"use client";

export default function Sidebar({
  isOpen,
  documents = [],
  selectedDocIds = [],
  onToggleDocSelection,
  onOpenUpload,
  history = [],
  onSelectHistory,
  onNewSession,
  activeEngine,
}) {
  return (
    <aside className={`webapp-sidebar ${isOpen ? "open" : ""}`} aria-label="Application Sidebar">
      {/* Header */}
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
      </div>

      {/* Scrollable Center */}
      <div className="sidebar-scroll-area">
        {/* New Session Button */}
        <button
          type="button"
          className="btn-new-query"
          onClick={onNewSession}
          title="Start fresh document querying thread"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          <span>New Analysis</span>
        </button>

        {/* Source Documents Section */}
        <div>
          <div className="sidebar-section-title">
            <span>Documents ({documents.length})</span>
            <button type="button" onClick={onOpenUpload} title="Upload document">
              + Upload
            </button>
          </div>

          {/* Quick upload trigger */}
          <div className="upload-drop-trigger" onClick={onOpenUpload}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: "var(--c-charcoal)" }}>
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            <div>
              <strong>Upload Document</strong>
              <span>Drop PDF / financial filing</span>
            </div>
          </div>

          {/* Document list */}
          <div className="doc-source-list">
            {documents.map((doc) => {
              const isSelected = selectedDocIds.includes(doc.document_id);
              const is2024 = doc.report_fiscal_year === 2024 || doc.document_id === "AAPL-10K-2024";
              return (
                <div
                  key={doc.document_id}
                  className={`doc-source-card ${isSelected ? "active" : ""}`}
                  onClick={() => onToggleDocSelection(doc.document_id)}
                >
                  <input
                    type="checkbox"
                    className="doc-checkbox"
                    checked={isSelected}
                    onChange={() => onToggleDocSelection(doc.document_id)}
                    onClick={(e) => e.stopPropagation()}
                    aria-label={`Select ${doc.company || "document"}`}
                  />
                  <div className="doc-card-info">
                    <span className="doc-card-name" title={doc.file_name || doc.company}>
                      {doc.isCustom ? doc.company : `Apple ${doc.report_fiscal_year} ${doc.report_type}`}
                    </span>
                    <div className="doc-card-sub">
                      <span>
                        <span className="doc-status-dot" />
                        {doc.page_count ? `${doc.page_count} pgs` : "Indexed"}
                      </span>
                      <span>{doc.report_fiscal_year ? `FY${doc.report_fiscal_year}` : "Ready"}</span>
                    </div>
                    {is2024 && (
                      <span className="doc-comparative-pill">
                        Contains FY23 &amp; FY22 Comparatives
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Recent Queries / Threads */}
        {history.length > 0 && (
          <div>
            <div className="sidebar-section-title">
              <span>Query History</span>
            </div>
            <div className="history-thread-list">
              {history.map((h, idx) => (
                <button
                  key={idx}
                  type="button"
                  className="history-thread-item"
                  onClick={() => onSelectHistory(h)}
                  title={h.question}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0, color: "var(--c-charcoal)" }}>
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                  </svg>
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>
                    {h.question}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="sidebar-footer">
        <div className="system-mode-tag">
          <span className="doc-status-dot" />
          <span>{activeEngine === "fastapi_live" ? "FastAPI Live" : "SEC 10-K Index"}</span>
        </div>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.68rem" }}>v1.0</span>
      </div>
    </aside>
  );
}
