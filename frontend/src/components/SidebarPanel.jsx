"use client";

export default function SidebarPanel({
  documents = [],
  history = [],
  onSelectHistory,
  onInspectDocument,
}) {
  return (
    <aside className="sidebar-panel" aria-label="Filing Corpus and Audit Studio">
      {/* Indexed Document Corpus */}
      <div className="sidebar-card">
        <h3 className="sidebar-title">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-cyan">
            <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
            <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
          </svg>
          <span>Indexed SEC 10-K Corpus</span>
        </h3>

        <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
          {documents.map((doc) => (
            <div key={doc.document_id} className="document-item">
              <div className="document-item-top">
                <span className="document-name">
                  Apple {doc.report_fiscal_year} {doc.report_type}
                </span>
                <span className="doc-status-badge">READY</span>
              </div>

              <div className="doc-dates">
                <div>Period: {doc.period_ended}</div>
                <div>Filing: {doc.filing_date}</div>
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "0.25rem" }}>
                <button
                  type="button"
                  className="citation-action-link"
                  onClick={() => onInspectDocument(doc)}
                  style={{ fontSize: "0.72rem" }}
                >
                  Inspect Excerpt →
                </button>
                <a
                  href={doc.source_url}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="text-tertiary"
                  style={{ fontSize: "0.7rem", textDecoration: "none" }}
                  title="Open official SEC PDF"
                >
                  SEC PDF ↗
                </a>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Audit Integrity Checklist (TRD Compliance) */}
      <div className="sidebar-card">
        <h3 className="sidebar-title">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-emerald">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          </svg>
          <span>Audit Integrity Guardrails</span>
        </h3>

        <div className="audit-check-list">
          <div className="audit-check-row">
            <span className="check-icon-pass">✓</span>
            <div>
              <strong className="text-primary" style={{ display: "block" }}>Period Disambiguation</strong>
              Report fiscal year ≠ table comparative period.
            </div>
          </div>

          <div className="audit-check-row">
            <span className="check-icon-pass">✓</span>
            <div>
              <strong className="text-primary" style={{ display: "block" }}>Point-in-Time Isolation</strong>
              Balance Sheet snapshot segregated from Income flow.
            </div>
          </div>

          <div className="audit-check-row">
            <span className="check-icon-pass">✓</span>
            <div>
              <strong className="text-primary" style={{ display: "block" }}>Deterministic Math</strong>
              Python/JS Decimal arithmetic (no float drift).
            </div>
          </div>

          <div className="audit-check-row">
            <span className="check-icon-pass">✓</span>
            <div>
              <strong className="text-primary" style={{ display: "block" }}>Zero Hallucination Bounds</strong>
              Abstains on out-of-corpus periods (e.g. Q2 FY25).
            </div>
          </div>
        </div>
      </div>

      {/* Session Query History */}
      {history.length > 0 && (
        <div className="sidebar-card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--border-subtle)", paddingBottom: "0.5rem" }}>
            <h3 className="sidebar-title" style={{ borderBottom: "none", paddingBottom: 0, margin: 0 }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-amber">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
              <span>Recent Queries</span>
            </h3>
            <span className="font-mono text-tertiary" style={{ fontSize: "0.68rem" }}>
              {history.length} SAVED
            </span>
          </div>

          <div className="history-list">
            {history.map((item, idx) => (
              <button
                key={idx}
                type="button"
                className="history-item-btn"
                onClick={() => onSelectHistory(item)}
                title={item.question}
              >
                <span className="font-semibold" style={{ color: "#e2e8f0" }}>
                  {item.question.length > 55
                    ? `${item.question.slice(0, 55)}...`
                    : item.question}
                </span>
                <span className="history-item-time">
                  {item.period || "All Periods"} • {item.timestamp}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </aside>
  );
}
