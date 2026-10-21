"use client";

import { useState } from "react";
import DataVisualizer from "./DataVisualizer";

export default function AnswerWorkspace({
  result,
  onInspectCitation,
  onExportAuditMemo,
}) {
  const [activeTab, setActiveTab] = useState("overview");
  const [copied, setCopied] = useState(false);

  if (!result) return null;

  const handleCopy = () => {
    if (!result?.answer_text) return;
    navigator.clipboard.writeText(result.answer_text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case "answered":
        return <span className="status-badge-main badge-answered">✓ Disclosed & Verified</span>;
      case "partial":
        return <span className="status-badge-main badge-partial">⚠ Partial Evidence</span>;
      case "needs_clarification":
        return <span className="status-badge-main badge-partial">? Needs Clarification</span>;
      case "insufficient_evidence":
        return <span className="status-badge-main badge-insufficient">✕ Insufficient Evidence</span>;
      case "out_of_scope":
        return <span className="status-badge-main badge-out-of-scope">⊘ Out of Scope</span>;
      default:
        return <span className="status-badge-main badge-answered">{status}</span>;
    }
  };

  const hasCalculations = result.calculations && result.calculations.length > 0;
  const hasFacts = result.facts && result.facts.length > 0;
  const hasCitations = result.citations && result.citations.length > 0;

  return (
    <div className="workspace-left">
      <div className="results-card">
        {/* Workspace Navigation Tabs */}
        <div className="results-tabs-bar">
          <button
            type="button"
            className={`result-tab-btn ${activeTab === "overview" ? "active" : ""}`}
            onClick={() => setActiveTab("overview")}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
              <polyline points="10 9 9 9 8 9" />
            </svg>
            <span>Intelligence Brief</span>
          </button>

          <button
            type="button"
            className={`result-tab-btn ${activeTab === "charts" ? "active" : ""}`}
            onClick={() => setActiveTab("charts")}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="20" x2="18" y2="10" />
              <line x1="12" y1="20" x2="12" y2="4" />
              <line x1="6" y1="20" x2="6" y2="14" />
            </svg>
            <span>Visualizer & Trends</span>
          </button>

          {hasCalculations && (
            <button
              type="button"
              className={`result-tab-btn ${activeTab === "ledger" ? "active" : ""}`}
              onClick={() => setActiveTab("ledger")}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="4" y="2" width="16" height="20" rx="2" />
                <line x1="8" y1="6" x2="16" y2="6" />
                <line x1="16" y1="14" x2="16" y2="18" />
                <path d="M16 10h.01" />
                <path d="M12 10h.01" />
                <path d="M8 10h.01" />
                <path d="M12 14h.01" />
                <path d="M8 14h.01" />
                <path d="M12 18h.01" />
                <path d="M8 18h.01" />
              </svg>
              <span>Math Ledger</span>
              <span className="tab-count-badge">{result.calculations.length}</span>
            </button>
          )}

          {hasFacts && (
            <button
              type="button"
              className={`result-tab-btn ${activeTab === "facts" ? "active" : ""}`}
              onClick={() => setActiveTab("facts")}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
              </svg>
              <span>Verified Facts</span>
              <span className="tab-count-badge">{result.facts.length}</span>
            </button>
          )}
        </div>

        {/* Card Header with Status & Quick Actions */}
        <div className="results-card-header">
          <div className="results-status-group">
            {getStatusBadge(result.status)}
            <span className="results-query-label">"{result.question}"</span>
          </div>

          <div className="results-actions-group">
            <button
              type="button"
              className="btn-secondary-tool"
              onClick={handleCopy}
              title="Copy answer text"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
              </svg>
              <span>{copied ? "Copied!" : "Copy"}</span>
            </button>

            <button
              type="button"
              className="btn-secondary-tool"
              onClick={() => onExportAuditMemo(result)}
              title="Download audit memo as Markdown"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              <span>Export Memo</span>
            </button>
          </div>
        </div>

        {/* Card Body - Tab Content */}
        <div className="results-card-body">
          {activeTab === "overview" && (
            <div className="answer-narrative">
              <div style={{ whiteSpace: "pre-line" }}>{result.answer_text}</div>

              {/* Missing information warning if any */}
              {result.missing_information && result.missing_information.length > 0 && (
                <div style={{
                  background: "rgba(245, 158, 11, 0.1)",
                  border: "1px solid rgba(245, 158, 11, 0.3)",
                  borderRadius: "8px",
                  padding: "0.85rem 1rem",
                  marginTop: "0.5rem",
                  fontSize: "0.85rem",
                  color: "#fcd34d",
                }}>
                  <strong style={{ display: "block", marginBottom: "0.25rem" }}>
                    ⚠ Corpus Boundary Notice:
                  </strong>
                  <ul style={{ paddingLeft: "1.2rem", margin: 0 }}>
                    {result.missing_information.map((item, idx) => (
                      <li key={idx}>{item}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {activeTab === "charts" && <DataVisualizer result={result} />}

          {activeTab === "ledger" && (
            <div className="ledger-view-container">
              {result.calculations.map((calc, idx) => (
                <div key={idx} className="ledger-item-card">
                  <div className="ledger-formula-box">
                    <span className="text-secondary font-mono" style={{ fontSize: "0.75rem", textTransform: "uppercase" }}>
                      Formula Definition:
                    </span>
                    <span className="ledger-formula-code">{calc.formula}</span>
                  </div>

                  <table className="ledger-operands-table">
                    <thead>
                      <tr>
                        <th>Operand Name</th>
                        <th>Reported Value</th>
                        <th>Source Statement</th>
                        <th>Page</th>
                      </tr>
                    </thead>
                    <tbody>
                      {calc.operands.map((op, opIdx) => (
                        <tr key={opIdx}>
                          <td className="font-semibold text-primary">{op.name}</td>
                          <td className="font-mono text-cyan">{op.raw_value}</td>
                          <td className="text-secondary">{op.source_statement || "Form 10-K"}</td>
                          <td className="font-mono text-secondary">{op.printed_page || "N/A"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  <div className="ledger-result-strip">
                    <span className="text-secondary font-mono" style={{ fontSize: "0.78rem" }}>
                      VERIFIED RESULT (DECIMAL ARITHMETIC)
                    </span>
                    <span className="ledger-final-calc">
                      = {calc.display_value} {calc.unit}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeTab === "facts" && (
            <div className="facts-table-wrapper">
              <table className="facts-table">
                <thead>
                  <tr>
                    <th>Metric</th>
                    <th>Period</th>
                    <th>Reported Value</th>
                    <th>Scale</th>
                    <th>Normalized Decimal</th>
                    <th>Audit Status</th>
                  </tr>
                </thead>
                <tbody>
                  {result.facts.map((fact, idx) => (
                    <tr key={idx}>
                      <td>
                        <span className="fact-metric-title">{fact.metric_label || fact.canonical_metric}</span>
                        <div className="text-tertiary font-mono" style={{ fontSize: "0.7rem" }}>
                          {fact.canonical_metric}
                        </div>
                      </td>
                      <td className="font-mono">{fact.reporting_period}</td>
                      <td className="font-mono font-semibold text-primary">{fact.reported_value}</td>
                      <td className="font-mono text-secondary">{fact.scale} {fact.currency}</td>
                      <td className="font-mono text-cyan" style={{ fontSize: "0.78rem" }}>{fact.normalized_decimal}</td>
                      <td>
                        <span className="fact-status-badge">
                          ✓ {fact.verification_status || "verified"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Telemetry Footer */}
        <div className="results-card-footer">
          <div className="telemetry-item">
            <span>Request ID:</span>
            <span className="font-mono text-secondary">{result.request_id || "req_local_sec"}</span>
          </div>

          <div className="telemetry-item">
            <span>Corpus:</span>
            <span className="font-mono text-secondary">{result.corpus_version || "v1.0-sec-verified"}</span>
          </div>

          {result.timings_ms?.total && (
            <div className="telemetry-item">
              <span>Latency:</span>
              <span className="font-mono text-emerald">{result.timings_ms.total}ms</span>
            </div>
          )}
        </div>
      </div>

      {/* Citations Grid */}
      {hasCitations && (
        <section aria-label="Cited Sources and Provenance">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
            <h3 style={{ fontSize: "0.95rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "#f8fafc" }}>
              Source Provenance ({result.citations.length} Citations)
            </h3>
            <span className="text-tertiary font-mono" style={{ fontSize: "0.72rem" }}>
              ANCHORED TO VERIFIED 10-K PDF CELLS
            </span>
          </div>

          <div className="citations-grid-container">
            {result.citations.map((cite, idx) => (
              <div key={idx} className="citation-tile">
                <div className="citation-tile-top">
                  <span className="citation-source-label">
                    {cite.company} • {cite.report_year} {cite.report_type}
                  </span>
                  <span className="citation-page-badge">Page {cite.printed_page}</span>
                </div>

                <div className="citation-section-text">{cite.section}</div>

                <div className="citation-quote-box">
                  "{cite.exact_quote}"
                </div>

                <button
                  type="button"
                  className="citation-action-link"
                  onClick={() => onInspectCitation(cite)}
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="11" cy="11" r="8" />
                    <line x1="21" y1="21" x2="16.65" y2="16.65" />
                  </svg>
                  <span>Inspect in 10-K Filing</span>
                </button>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
