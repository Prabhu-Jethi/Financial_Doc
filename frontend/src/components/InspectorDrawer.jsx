"use client";

export default function InspectorDrawer({
  isOpen,
  onClose,
  activeCitation,
  activeDocument,
}) {
  if (!isOpen) return null;

  const title = activeCitation
    ? `${activeCitation.company || "Apple Inc."} • ${activeCitation.report_year || 2024} ${activeCitation.report_type || "10-K"}`
    : activeDocument
    ? `${activeDocument.company || "Apple Inc."} • FY${activeDocument.report_fiscal_year || 2024}`
    : "Document Chunk Inspector";

  const page = activeCitation?.printed_page || "29";
  const section = activeCitation?.section || "Financial Statements / MD&A";
  const quote = activeCitation?.exact_quote || "Full document indexed with table cell bounding coordinates.";
  const url = activeCitation?.source_url || activeDocument?.source_url || "https://s2.q4cdn.com/470004039/files/doc_earnings/2024/q4/filing/10-Q4-2024-As-Filed.pdf";

  return (
    <aside className="webapp-inspector open" aria-label="Chunk & Table Provenance Inspector">
      {/* Header */}
      <div className="inspector-header">
        <div className="inspector-title">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--c-charcoal)" }}>
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <span>Citation &amp; Page Provenance</span>
        </div>
        <button
          type="button"
          className="btn-inspector-close"
          onClick={onClose}
          title="Close inspector drawer"
          aria-label="Close inspector"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      {/* Body */}
      <div className="inspector-body">
        {/* Source Coordinates Banner */}
        <div className="chunk-provenance-box">
          <div className="chunk-source-tag">
            <span className="provenance-doc-title">{title}</span>
            <span className="provenance-page-pill">PAGE {page}</span>
          </div>

          <div className="provenance-section-name">
            {section}
          </div>

          <div className="provenance-meta-detail">
            Source Anchor: Table Cell &amp; Dense Vector Match
          </div>
        </div>

        {/* Verbatim Excerpt */}
        <div className="chunk-quote-card">
          <span className="chunk-quote-label">
            Disclosed Verbatim Passage from Report
          </span>
          <div className="chunk-quote-display">
            "{quote}"
          </div>
        </div>

        {/* Multi-Year Comparison Note */}
        <div className="inspector-comparative-callout">
          <div className="inspector-callout-title">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0 }}>
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="16" x2="12" y2="12" />
              <line x1="12" y1="8" x2="12.01" y2="8" />
            </svg>
            <span>Comparative Multi-Year Disclosure</span>
          </div>
          <p className="inspector-callout-text">
            SEC Form 10-K financial statements report three consecutive years (FY24, FY23, FY22) on this page in side-by-side columns. You do not need to upload prior-year reports to verify comparisons.
          </p>
        </div>

        {/* Document Action */}
        <div className="inspector-action-box">
          <span className="inspector-action-hint">
            Verify original formatting and surrounding disclosures in the official SEC filing:
          </span>
          <a
            href={url}
            target="_blank"
            rel="noreferrer noopener"
            className="btn-open-sec-pdf"
          >
            <span>Open Official SEC Filing PDF ↗</span>
          </a>
        </div>
      </div>
    </aside>
  );
}
