"use client";

import { useState, useEffect, useMemo } from "react";

export default function PdfViewerModal({
  isOpen,
  onClose,
  citation,
  document: activeDoc,
}) {
  const [currentPage, setCurrentPage] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [highlightActive, setHighlightActive] = useState(true);
  const [viewMode, setViewMode] = useState("split"); // "split" | "pdf" | "text"
  const [searchPhrase, setSearchPhrase] = useState("");

  const docId = citation?.document_id || activeDoc?.document_id || "AAPL-10K-2024";
  const company = citation?.company || activeDoc?.company || "Document";
  const year = citation?.report_year || activeDoc?.report_fiscal_year || "2024";
  const section = citation?.section || "Document Disclosures";
  const exactQuote = citation?.exact_quote || "";
  const isGeneralDoc =
    citation?.report_type === "general" ||
    activeDoc?.report_type === "general" ||
    docId?.startsWith("doc_");

  // Extract clean search phrase from verbatim quote for PDF reader search/highlight
  useEffect(() => {
    if (exactQuote) {
      const clean = exactQuote
        .replace(/[*_#`~"'{}\[\]]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
      const words = clean.split(" ").filter((w) => w.length > 2);
      // Take first 4-5 distinctive words
      const phrase = words.slice(0, 4).join(" ");
      setSearchPhrase(phrase);
      setViewMode("split");
    } else {
      setSearchPhrase("");
      setViewMode("pdf");
    }
  }, [exactQuote]);

  // Extract initial target page when citation changes
  useEffect(() => {
    if (citation?.printed_page) {
      const match = String(citation.printed_page).match(/\d+/);
      if (match) {
        setCurrentPage(parseInt(match[0], 10));
      } else {
        setCurrentPage(1);
      }
    } else {
      setCurrentPage(1);
    }
  }, [citation]);

  // Handle ESC key to close modal
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  // Build PDF URL with native search/highlight parameter when highlight is active
  const searchParam = highlightActive && searchPhrase ? `&search=${encodeURIComponent(searchPhrase)}` : "";
  const pdfUrl = `/api/documents/${encodeURIComponent(docId)}/pdf#page=${currentPage}${searchParam}&view=FitH`;

  const handleCopyQuote = () => {
    if (!exactQuote) return;
    navigator.clipboard.writeText(exactQuote);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleOpenNewTab = () => {
    window.open(pdfUrl, "_blank", "noopener,noreferrer");
  };

  // Render highlighted text with numerical metrics and keywords wrapped in <mark> tags
  const renderHighlightedPassage = (text) => {
    if (!text) return null;

    // Pattern to highlight numbers, dollar values, percentages, and fiscal years
    const regex = /(\$[\d,]+(?:\.\d+)?|\b\d+(?:\.\d+)?%|\bFY20\d\d\b|\b\d{1,3}(?:,\d{3})+(?:\.\d+)?\b)/gi;
    const parts = text.split(regex);

    return parts.map((part, i) => {
      if (regex.test(part)) {
        return (
          <mark key={i} className="evidence-mark-metric" title="Audited Financial Metric Anchor">
            {part}
          </mark>
        );
      }
      return <span key={i}>{part}</span>;
    });
  };

  return (
    <div className="pdf-modal-backdrop" onClick={onClose} aria-label="PDF Citation Viewer Overlay">
      <div
        className={`pdf-modal-container ${isFullscreen ? "fullscreen" : ""} ${viewMode}`}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Document Provenance Viewer"
      >
        {/* Top Header Bar */}
        <div className="pdf-modal-header">
          <div className="pdf-modal-title-group">
            <div className="pdf-icon-badge">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
              </svg>
            </div>
            <div>
              <div className="pdf-modal-company">
                {company} • {isGeneralDoc ? "Document" : `FY${year} Form 10-K`}
              </div>
              <div className="pdf-modal-subtitle">
                {docId} — {section || "Document Disclosures"}
              </div>
            </div>
          </div>

          {/* View Mode Pills (Split | PDF Full | Text Only) */}
          <div className="pdf-viewmode-selector" role="tablist" aria-label="Viewer Layout Mode">
            <button
              type="button"
              className={`btn-viewmode-pill ${viewMode === "split" ? "active" : ""}`}
              onClick={() => setViewMode("split")}
              title="Split View: Highlighted Chunk + Original PDF"
              role="tab"
              aria-selected={viewMode === "split"}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <line x1="12" y1="3" x2="12" y2="21" />
              </svg>
              <span>Split View</span>
            </button>
            <button
              type="button"
              className={`btn-viewmode-pill ${viewMode === "pdf" ? "active" : ""}`}
              onClick={() => setViewMode("pdf")}
              title="Full Original PDF Document"
              role="tab"
              aria-selected={viewMode === "pdf"}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
              </svg>
              <span>Full PDF</span>
            </button>
            {exactQuote && (
              <button
                type="button"
                className={`btn-viewmode-pill ${viewMode === "text" ? "active" : ""}`}
                onClick={() => setViewMode("text")}
                title="Highlighted Evidence Text Reader"
                role="tab"
                aria-selected={viewMode === "text"}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="21" y1="6" x2="3" y2="6" />
                  <line x1="21" y1="12" x2="9" y2="12" />
                  <line x1="21" y1="18" x2="7" y2="18" />
                </svg>
                <span>Evidence Text</span>
              </button>
            )}
          </div>

          {/* Center Page Navigation */}
          <div className="pdf-page-controls">
            <button
              type="button"
              className="btn-page-nav"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage <= 1}
              title="Previous Page"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </button>
            <div className="pdf-page-indicator">
              <span>Page</span>
              <input
                type="number"
                min="1"
                max="500"
                value={currentPage}
                onChange={(e) => {
                  const val = parseInt(e.target.value, 10);
                  if (!isNaN(val) && val >= 1) setCurrentPage(val);
                }}
                className="pdf-page-input"
                aria-label="Target PDF Page"
              />
            </div>
            <button
              type="button"
              className="btn-page-nav"
              onClick={() => setCurrentPage((p) => p + 1)}
              title="Next Page"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </button>
          </div>

          {/* Right Action Buttons */}
          <div className="pdf-modal-actions">
            {/* Highlighting Toggle Button */}
            {exactQuote && (
              <button
                type="button"
                className={`btn-highlight-toggle ${highlightActive ? "active" : ""}`}
                onClick={() => setHighlightActive(!highlightActive)}
                title={highlightActive ? "Evidence highlighting is active" : "Turn evidence highlighting ON"}
              >
                <span className="highlight-dot" />
                <span>{highlightActive ? "Highlights: ON" : "Highlights: OFF"}</span>
              </button>
            )}

            <button
              type="button"
              className="btn-modal-action"
              onClick={handleOpenNewTab}
              title="Open raw PDF in new browser tab"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                <polyline points="15 3 21 3 21 9" />
                <line x1="10" y1="14" x2="21" y2="3" />
              </svg>
              <span>Full Tab</span>
            </button>

            <button
              type="button"
              className="btn-modal-action"
              onClick={() => setIsFullscreen(!isFullscreen)}
              title={isFullscreen ? "Exit Fullscreen" : "Fullscreen View"}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                {isFullscreen ? (
                  <>
                    <polyline points="4 14 10 14 10 20" />
                    <polyline points="20 10 14 10 14 4" />
                    <line x1="14" y1="10" x2="21" y2="3" />
                    <line x1="3" y1="21" x2="10" y2="14" />
                  </>
                ) : (
                  <>
                    <polyline points="15 3 21 3 21 9" />
                    <polyline points="9 21 3 21 3 15" />
                    <line x1="21" y1="3" x2="14" y2="10" />
                    <line x1="3" y1="21" x2="10" y2="14" />
                  </>
                )}
              </svg>
            </button>

            <button
              type="button"
              className="btn-modal-close"
              onClick={onClose}
              title="Close PDF Viewer (Esc)"
              aria-label="Close"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        </div>

        {/* =========================================================================
            MAIN VIEWER STAGE (Split View / Full PDF / Highlighted Text Reader)
           ========================================================================= */}
        <div className="pdf-viewer-main-stage">
          {/* LEFT: Retrieved Evidence Highlighter Pane (Shown in 'split' or 'text' mode) */}
          {(viewMode === "split" || viewMode === "text") && exactQuote && (
            <div className={`evidence-highlighter-pane ${viewMode === "text" ? "full-width" : ""}`}>
              <div className="highlighter-pane-header">
                <div className="highlighter-title-tag">
                  <span className="highlighter-glow-icon">⚡</span>
                  <strong>Retrieved Evidence Chunk</strong>
                  <span className="highlighter-page-pill">PAGE {currentPage}</span>
                </div>
                <button
                  type="button"
                  className="btn-copy-highlighted"
                  onClick={handleCopyQuote}
                  title="Copy highlighted passage"
                >
                  {copied ? "✓ Copied" : "Copy Excerpt"}
                </button>
              </div>

              {/* Highlighting Info Bar */}
              <div className="highlighter-meta-bar">
                <div className="highlighter-section-title">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                  </svg>
                  <span>{section}</span>
                </div>
                <span className="highlighter-status-badge">
                  {highlightActive ? "Highlights Active" : "Original View"}
                </span>
              </div>

              {/* Illuminated Highlighted Quote Card */}
              <div className="highlighted-passage-card">
                <div className="passage-quote-marker">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M14.017 21v-7.391c0-5.704 3.731-9.57 8.983-10.609l.995 2.151c-2.432.917-3.995 3.638-3.995 5.849h4v10h-9.983zm-14.017 0v-7.391c0-5.704 3.748-9.57 9-10.609l.996 2.151c-2.433.917-3.996 3.638-3.996 5.849h3.983v10h-9.983z" />
                  </svg>
                </div>
                <div className={`passage-quote-text ${highlightActive ? "highlight-active" : ""}`}>
                  {highlightActive ? renderHighlightedPassage(exactQuote) : exactQuote}
                </div>
              </div>

              {/* Provenance Footnote & Search Helper */}
              <div className="highlighter-footer-details">
                <div className="highlighter-cue">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="16" x2="12" y2="12" />
                    <line x1="12" y1="8" x2="12.01" y2="8" />
                  </svg>
                  <span>
                    Numerical figures and operands extracted from this page are highlighted in amber.
                  </span>
                </div>

                {searchPhrase && (
                  <div className="pdf-search-sync-tag">
                    <span>PDF Search Term:</span>
                    <code>&ldquo;{searchPhrase}&rdquo;</code>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* RIGHT: Embedded PDF Viewer with Canvas Highlight Parameter */}
          {(viewMode === "split" || viewMode === "pdf") && (
            <div className={`pdf-iframe-wrapper ${viewMode === "split" ? "split" : "full"}`}>
              {/* Optional Top Mini Banner when in Full PDF mode */}
              {viewMode === "pdf" && exactQuote && highlightActive && (
                <div className="pdf-full-highlight-bar">
                  <div className="bar-left">
                    <span className="bar-icon">⚡</span>
                    <span className="bar-label">Highlighted Chunk on Page {currentPage}:</span>
                    <span className="bar-excerpt">&ldquo;{exactQuote.slice(0, 110)}...&rdquo;</span>
                  </div>
                  <button
                    type="button"
                    className="btn-switch-split"
                    onClick={() => setViewMode("split")}
                    title="Open side-by-side highlighted comparison"
                  >
                    Open Split View
                  </button>
                </div>
              )}

              <iframe
                key={`${docId}-p${currentPage}-${highlightActive ? "hl" : "plain"}`}
                src={pdfUrl}
                title={`${company} FY${year} - Page ${currentPage}`}
                className="pdf-iframe"
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
