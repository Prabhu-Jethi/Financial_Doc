"use client";

import { useEffect } from "react";

export default function AuditGuideModal({ isOpen, onClose }) {
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape" && isOpen) onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="modal-backdrop" onClick={onClose} aria-label="Close guide backdrop">
      <div
        className="modal-container guide-modal-container"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="guide-modal-title"
      >
        {/* Header */}
        <div className="modal-header">
          <div className="modal-title-group">
            <div className="modal-icon-badge guide-badge">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="16" x2="12" y2="12" />
                <line x1="12" y1="8" x2="12.01" y2="8" />
              </svg>
            </div>
            <div>
              <h2 id="guide-modal-title" className="modal-title">SEC 10-K Audit Integrity Guide</h2>
              <p className="modal-subtitle">Methodology, Decimal Precision &amp; Verification Rules</p>
            </div>
          </div>

          <button
            type="button"
            className="modal-close-btn"
            onClick={onClose}
            title="Close guide"
            aria-label="Close"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Modal Body */}
        <div className="modal-body guide-modal-body">
          <div className="guide-cards-grid">
            <div className="guide-card">
              <div className="guide-card-header">
                <span className="guide-step-pill">Rule 1</span>
                <h3 className="guide-card-title">Strict Decimal Precision</h3>
              </div>
              <p className="guide-card-text">
                Financial ratios (e.g. Operating Margin 31.51%, YoY Growth +12.87%) are computed using high-precision Decimal arithmetic rather than floating-point math to eliminate binary rounding errors.
              </p>
            </div>

            <div className="guide-card">
              <div className="guide-card-header">
                <span className="guide-step-pill">Rule 2</span>
                <h3 className="guide-card-title">Comparative Period Isolation</h3>
              </div>
              <p className="guide-card-text">
                Form 10-K filings disclose multiple annual columns. The system explicitly maps each row cell to its exact fiscal year (Twelve Months Ended Sep 28, 2024 vs Sep 30, 2023) to prevent period confusion.
              </p>
            </div>

            <div className="guide-card">
              <div className="guide-card-header">
                <span className="guide-step-pill">Rule 3</span>
                <h3 className="guide-card-title">Point-in-Time vs Duration</h3>
              </div>
              <p className="guide-card-text">
                Balance Sheet metrics (e.g. Cash &amp; Equivalents $29,943M) are instantaneous snapshots as of fiscal year end, separated from Income Statement flow totals.
              </p>
            </div>

            <div className="guide-card">
              <div className="guide-card-header">
                <span className="guide-step-pill">Rule 4</span>
                <h3 className="guide-card-title">Zero-Hallucination Guardrails</h3>
              </div>
              <p className="guide-card-text">
                When asked about unfiled or future periods (e.g. Q2 FY2025) or investment trading advice, the engine deterministically abstains with <code>insufficient_evidence</code> or <code>out_of_scope</code>.
              </p>
            </div>
          </div>

          {/* SEC Anchors Callout */}
          <div className="guide-callout-card">
            <div className="guide-callout-header">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
              </svg>
              <strong>Official SEC 10-K Anchors</strong>
            </div>
            <p className="guide-callout-text">
              Item 8 Consolidated Statements of Operations • Consolidated Balance Sheets • Item 7 Management&apos;s Discussion and Analysis (Results of Operations) • Note 11 Segment Revenue.
            </p>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="modal-footer">
          <button
            type="button"
            className="btn-modal-primary"
            onClick={onClose}
          >
            Got It
          </button>
        </div>
      </div>
    </div>
  );
}
