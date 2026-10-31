"use client";

export default function InspectorDrawer({
  isOpen,
  onClose,
  activeCitation,
  activeDocument,
  onOpenPdfModal,
}) {
  if (!isOpen) return null;

  const docId = activeCitation?.document_id || activeDocument?.document_id || "";
  const company = activeCitation?.company || activeDocument?.company || "Document";
  const year = activeCitation?.report_year || activeDocument?.report_fiscal_year || "2024";
  const page = activeCitation?.printed_page || "1";
  const section = activeCitation?.section || "Document Disclosures";
  const quote = activeCitation?.exact_quote || "Full document indexed with table cell bounding coordinates.";

  const isGeneralDoc =
    activeCitation?.report_type === "general" ||
    activeDocument?.report_type === "general" ||
    docId?.startsWith("doc_");

  const title = activeCitation
    ? `${company} • ${isGeneralDoc ? "Document" : `${year} ${activeCitation.report_type || "10-K"}`}`
    : activeDocument
    ? `${company} • ${isGeneralDoc ? "Document" : `FY${year}`}`
    : "Document Chunk Inspector";

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

        {/* Verbatim Excerpt with Highlighting Indicator */}
        <div className="chunk-quote-card">
          <div className="chunk-quote-header">
            <span className="chunk-quote-label">
              Disclosed Verbatim Passage from Report
            </span>
            <span className="chunk-highlight-indicator">
              ⚡ Highlighted Chunk
            </span>
          </div>
          <div className="chunk-quote-display">
            &ldquo;{quote}&rdquo;
          </div>
        </div>

        {/* Comparative Notice if applicable */}
        {!isGeneralDoc && (
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
              Annual financial statements report three consecutive years (FY24, FY23, FY22) on this page in side-by-side columns. You do not need to upload prior-year reports to verify comparisons.
            </p>
          </div>
        )}

        {/* Document Action */}
        <div className="inspector-action-box">
          <span className="inspector-action-hint">
            Verify original document layout and surrounding context:
          </span>
          <div className="inspector-btn-row">
            {onOpenPdfModal && (
              <button
                type="button"
                className="btn-open-sec-pdf btn-open-modal-primary btn-full-width"
                onClick={() => onOpenPdfModal(activeCitation || activeDocument)}
                title={`Open PDF jump-linked to Page ${page} with highlighted evidence`}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                </svg>
                <span>View Page {page} with Highlighted Evidence</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </aside>
  );
}
