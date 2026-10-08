"use client";

import { useEffect } from "react";

export default function AuditGuideModal({ isOpen, onClose }) {
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") onClose();
    };
    if (isOpen) {
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="modal-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div className="modal-dialog" onClick={(e) => e.stopPropagation()} style={{ maxWidth: "780px" }}>
        <div className="modal-header">
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <div className="brand-icon-wrapper" style={{ width: "32px", height: "32px", background: "rgba(16, 185, 129, 0.2)", borderColor: "rgba(16, 185, 129, 0.4)", color: "#10b981" }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <path d="M12 16v-4" />
                <path d="M12 8h.01" />
              </svg>
            </div>
            <div>
              <h3>SEC 10-K Audit Integrity Guide</h3>
              <p className="text-secondary" style={{ fontSize: "0.75rem" }}>
                Methodology & Verification Rules (TRD § 4–6 Compliance)
              </p>
            </div>
          </div>

          <button type="button" className="modal-close-btn" onClick={onClose} title="Close guide">
            &times;
          </button>
        </div>

        <div className="modal-content">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "1rem" }}>
            <div className="chart-card">
              <h4 className="text-primary font-semibold" style={{ fontSize: "0.85rem", marginBottom: "0.4rem" }}>
                1. Strict Decimal Precision
              </h4>
              <p className="text-secondary" style={{ fontSize: "0.8rem", lineHeight: 1.5 }}>
                Financial ratios (e.g. Operating Margin 31.51%, YoY Growth +12.87%) are computed using high-precision Decimal arithmetic rather than floating-point math to eliminate binary rounding errors.
              </p>
            </div>

            <div className="chart-card">
              <h4 className="text-primary font-semibold" style={{ fontSize: "0.85rem", marginBottom: "0.4rem" }}>
                2. Comparative Period Isolation
              </h4>
              <p className="text-secondary" style={{ fontSize: "0.8rem", lineHeight: 1.5 }}>
                Form 10-K filings disclose multiple annual columns. The system explicitly maps each row cell to its exact fiscal year (Twelve Months Ended Sep 28, 2024 vs Sep 30, 2023) to prevent period confusion.
              </p>
            </div>

            <div className="chart-card">
              <h4 className="text-primary font-semibold" style={{ fontSize: "0.85rem", marginBottom: "0.4rem" }}>
                3. Point-in-Time vs Duration
              </h4>
              <p className="text-secondary" style={{ fontSize: "0.8rem", lineHeight: 1.5 }}>
                Balance Sheet metrics (e.g. Cash & Equivalents $29,943M) are instantaneous snapshots as of fiscal year end, separated from Income Statement flow totals.
              </p>
            </div>

            <div className="chart-card">
              <h4 className="text-primary font-semibold" style={{ fontSize: "0.85rem", marginBottom: "0.4rem" }}>
                4. Zero-Hallucination Guardrails
              </h4>
              <p className="text-secondary" style={{ fontSize: "0.8rem", lineHeight: 1.5 }}>
                When asked about unfiled or future periods (e.g. Q2 FY2025) or investment trading advice, the engine deterministically abstains with <code>insufficient_evidence</code> or <code>out_of_scope</code>.
              </p>
            </div>
          </div>

          <div style={{
            background: "rgba(10, 16, 31, 0.7)",
            border: "1px solid var(--border-subtle)",
            borderRadius: "8px",
            padding: "1rem",
            fontSize: "0.8rem",
            color: "#94a3b8",
          }}>
            <strong className="text-primary" style={{ display: "block", marginBottom: "0.25rem" }}>
              Official SEC 10-K Anchors:
            </strong>
            Item 8 Consolidated Statements of Operations (Page 29) • Consolidated Balance Sheets (Page 31) • Item 7 Management's Discussion and Analysis (Results of Operations) • Note 11 Segment Revenue.
          </div>
        </div>
      </div>
    </div>
  );
}
