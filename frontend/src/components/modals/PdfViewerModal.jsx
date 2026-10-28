"use client";

import { useState, useEffect } from "react";

export default function PdfViewerModal({
  isOpen,
  onClose,
  citation,
  document: activeDoc,
}) {
  const [currentPage, setCurrentPage] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [copied, setCopied] = useState(false);

  // Extract initial target page and document ID when citation changes
  useEffect(() => {
    if (citation?.printed_page) {
      const match = citation.printed_page.match(/\d+/);
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

  const docId = citation?.document_id || activeDoc?.document_id || "AAPL-10K-2024";
  const company = citation?.company || activeDoc?.company || "SEC Filing";
  const year = citation?.report_year || activeDoc?.report_fiscal_year || "2024";
  const section = citation?.section || "Item 8 - Financial Statements";
  const exactQuote = citation?.exact_quote || "";

  const pdfUrl = `/api/documents/${encodeURIComponent(docId)}/pdf#page=${currentPage}&view=FitH`;

  const handleCopyQuote = () => {
    if (!exactQuote) return;
    navigator.clipboard.writeText(exactQuote);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleOpenNewTab = () => {
    window.open(pdfUrl, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="pdf-modal-backdrop" onClick={onClose} aria-label="PDF Citation Viewer Overlay">
      <div
        className={`pdf-modal-container ${isFullscreen ? "fullscreen" : ""}`}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="SEC Filing PDF Provenance Viewer"
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
                {company} • {activeDoc?.report_type === "general" || docId?.startsWith("doc_") ? "Uploaded Document" : `FY${year} Form 10-K`}
              </div>
              <div className="pdf-modal-subtitle">
                {docId} — {section || "Document Content"}
              </div>
            </div>
          </div>

          {/* Center Page Controls */}
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
                max="300"
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

        {/* Grounded Chunk Citation Banner */}
        {exactQuote && (
          <div className="pdf-chunk-banner">
            <div className="pdf-chunk-banner-header">
              <div className="chunk-verified-tag">
                <span className="chunk-dot" />
                <strong>Grounded Evidence Chunk (Page {currentPage})</strong>
                <span className="chunk-section-tag">{section}</span>
              </div>
              <button
                type="button"
                className="btn-copy-quote"
                onClick={handleCopyQuote}
                title="Copy excerpt to clipboard"
              >
                {copied ? "✓ Copied" : "Copy Quote"}
              </button>
            </div>
            <div className="pdf-chunk-quote-text">
              &ldquo;{exactQuote}&rdquo;
            </div>
          </div>
        )}

        {/* Embedded PDF Viewer Iframe */}
        <div className="pdf-iframe-wrapper">
          <iframe
            key={`${docId}-p${currentPage}`}
            src={pdfUrl}
            title={`${company} FY${year} Form 10-K - Page ${currentPage}`}
            className="pdf-iframe"
          />
        </div>
      </div>
    </div>
  );
}

