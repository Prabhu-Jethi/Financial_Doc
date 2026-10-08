"use client";

import { useState } from "react";

const STARTER_PROMPTS = [
  {
    tag: "DEV-005",
    label: "YoY Comparison",
    query: "Compare Apple's Services net sales between fiscal year 2023 and fiscal year 2024.",
    period: "Comparative: FY2024 vs FY2023",
  },
  {
    tag: "DEV-001",
    label: "Revenue Growth",
    query: "What were Apple's total net sales in fiscal year 2024?",
    period: "FY2024",
  },
  {
    tag: "DEV-006",
    label: "Operating Margin",
    query: "What was Apple's operating margin for fiscal year 2024?",
    period: "FY2024",
  },
  {
    tag: "DEV-004",
    label: "Segment Breakdown",
    query: "What was the breakdown of Apple's net sales by product category in fiscal year 2024?",
    period: "FY2024",
  },
  {
    tag: "DEV-007",
    label: "iPhone Growth",
    query: "What was the year-over-year percentage growth in Apple's iPhone net sales from fiscal year 2023 to fiscal year 2024?",
    period: "Comparative: FY2024 vs FY2023",
  },
  {
    tag: "DEV-008",
    label: "MD&A Narrative",
    query: "According to management in Item 7 of the FY2024 10-K, what primary factors drove the increase in Services net sales during 2024 compared to 2023?",
    period: "Comparative: FY2024 vs FY2023",
  },
];

export default function MessageThread({
  messages = [],
  loading,
  onSelectPrompt,
  onInspectCitation,
  onExportMemo,
}) {
  const [openLedgerIndex, setOpenLedgerIndex] = useState(null);
  const [copiedId, setCopiedId] = useState(null);

  const handleCopy = (text, id) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const toggleLedger = (idx) => {
    setOpenLedgerIndex(openLedgerIndex === idx ? null : idx);
  };

  // Welcome Hero
  if (messages.length === 0) {
    return (
      <div className="welcome-hero">
        <div className="welcome-icon-box" aria-hidden="true">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="16" y1="13" x2="8" y2="13" />
            <line x1="16" y1="17" x2="8" y2="17" />
          </svg>
        </div>

        <h2>Document Intelligence Workspace</h2>
        <p className="welcome-instruction">
          Ask about revenue, margins, and year-to-year changes. Open citations to check the supporting report pages.
        </p>

        <div className="welcome-scope-banner">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0, marginTop: "2px" }}>
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="16" x2="12" y2="12" />
            <line x1="12" y1="8" x2="12.01" y2="8" />
          </svg>
          <span>
            <strong>Comparative Scope Notice:</strong> An annual filing (such as Apple FY2024 Form 10-K) contains figures for previous years (FY2023 and FY2022). Multi-year comparisons do not require two uploaded reports.
          </span>
        </div>

        <div className="welcome-prompt-grid">
          {STARTER_PROMPTS.map((prompt) => (
            <div
              key={prompt.tag}
              className="prompt-card-starter"
              onClick={() => onSelectPrompt(prompt.query, prompt.period)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onSelectPrompt(prompt.query, prompt.period);
                }
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span className="prompt-starter-tag">{prompt.label}</span>
                <span className="prompt-starter-id">
                  {prompt.tag}
                </span>
              </div>
              <span className="prompt-starter-text">{prompt.query}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="conversation-inner">
      {messages.map((item, idx) => (
        <div key={idx} className="thread-turn">
          {/* User Bubble */}
          <div className="user-query-bubble">
            <span className="user-query-text">{item.question}</span>
            {item.period && (
              <span className="user-query-scope-tag">
                Scope: {item.period}
              </span>
            )}
          </div>

          {/* Assistant Answer Card */}
          <div className="assistant-response-container">
            <div className="assistant-avatar" aria-hidden="true">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
              </svg>
            </div>

            <div className="assistant-content-card">
              {/* Header with status badge & explicit scope */}
              <div className="assistant-meta-header">
                <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                  <span
                    className={`audit-badge-pill ${
                      item.status === "answered"
                        ? "verified"
                        : item.status === "insufficient_evidence"
                        ? "insufficient"
                        : "out-of-scope"
                    }`}
                  >
                    {item.status === "answered" && "✓ Verified from 10-K"}
                    {item.status === "insufficient_evidence" && "✕ Insufficient Evidence"}
                    {item.status === "out_of_scope" && "⊘ Out of Scope"}
                  </span>

                  <span className="source-scope-label">
                    {item.company || "Apple Inc."} Form 10-K (FY2024 Disclosures)
                  </span>
                </div>

                <span className="reporting-period-tag font-mono">
                  {item.reporting_periods?.join(", ") || "FY2024"}
                </span>
              </div>

              {/* 1. Readable Narrative Answer */}
              <div className="response-text-body">
                <div className="answer-prose">{item.answer_text}</div>

                {/* Missing information warning if any */}
                {item.missing_information && item.missing_information.length > 0 && (
                  <div className="boundary-warning-box">
                    <strong>Boundary Notice: </strong>
                    {item.missing_information.join("; ")}
                  </div>
                )}
              </div>

              {/* 2. Structured Comparison Table (if comparative or segmented query) */}
              {item.comparison_table && (
                <div className="comparison-table-container">
                  <div className="comparison-table-header-block">
                    <div className="comparison-title-row">
                      <span className="comparison-table-title">{item.comparison_table.title}</span>
                      <span className="comparison-source-pill">
                        Source Filing: {item.comparison_table.source_filing || "Apple Form 10-K (FY2024)"}
                      </span>
                    </div>
                    <p className="comparison-explicit-note">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0, marginTop: "2px" }}>
                        <circle cx="12" cy="12" r="10" />
                        <line x1="12" y1="16" x2="12" y2="12" />
                        <line x1="12" y1="8" x2="12.01" y2="8" />
                      </svg>
                      <span>
                        {item.comparison_table.source_note || "Both current and comparative prior-year figures are disclosed within the single Form 10-K filing. Comparisons do not require uploading two separate reports."}
                      </span>
                    </p>
                  </div>

                  <div className="table-scroll-wrapper">
                    <table className="comparison-data-table">
                      <thead>
                        <tr>
                          {item.comparison_table.columns.map((col, cIdx) => (
                            <th key={cIdx} className={cIdx >= 1 && cIdx <= 4 ? "text-right" : "text-left"}>
                              {col}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {item.comparison_table.rows.map((row, rIdx) => (
                          <tr key={rIdx} className={row.highlight ? "row-highlight" : ""}>
                            <td className="cell-metric font-semibold">{row.metric}</td>
                            <td className="cell-num font-mono text-right">{row.prior_period}</td>
                            <td className="cell-num font-mono text-right font-bold">{row.current_period}</td>
                            <td className="cell-num font-mono text-right">
                              <span className={`delta-badge ${row.variance_dollar?.startsWith("+") ? "delta-pos" : row.variance_dollar?.startsWith("-") ? "delta-neg" : "delta-neutral"}`}>
                                {row.variance_dollar}
                              </span>
                            </td>
                            <td className="cell-num font-mono text-right font-semibold">{row.variance_pct}</td>
                            <td className="cell-source text-left">
                              {row.source}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* 3. Expandable Calculation Ledger */}
              {item.calculations && item.calculations.length > 0 && (
                <div className="ledger-accordion">
                  <button
                    type="button"
                    className="ledger-accordion-trigger"
                    onClick={() => toggleLedger(idx)}
                    aria-expanded={openLedgerIndex === idx}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                      <span>📐 Verified Calculation Ledger</span>
                      <span className="ledger-count-tag">{item.calculations.length} formula</span>
                    </div>
                    <span className="ledger-toggle-arrow">
                      {openLedgerIndex === idx ? "Hide ▲" : "Show calculation & operands ▼"}
                    </span>
                  </button>

                  {openLedgerIndex === idx && (
                    <div className="ledger-accordion-content">
                      {item.calculations.map((calc, calcIdx) => (
                        <div key={calcIdx} className="ledger-calc-card">
                          <div className="ledger-formula-row">
                            <span className="ledger-formula-label">Deterministic Formula:</span>
                            <code className="ledger-formula-code">{calc.formula}</code>
                            <span className="ledger-final-badge">
                              = {calc.display_value} {calc.unit}
                            </span>
                          </div>

                          <div className="ledger-operands-table-wrapper">
                            <div className="ledger-operands-title">
                              Disclosed Operands with Statement & Page Provenance:
                            </div>
                            <div className="ledger-operands-list">
                              {calc.operands.map((op, opIdx) => {
                                const matchingCite = item.citations?.find(
                                  (c) => String(c.printed_page) === String(op.printed_page)
                                );
                                return (
                                  <div key={opIdx} className="ledger-operand-row">
                                    <div className="operand-name-col">
                                      <span className="operand-name">{op.name}</span>
                                      <span className="operand-source-label">{op.source_statement}</span>
                                    </div>
                                    <div className="operand-value-col">
                                      <span className="operand-raw-val font-mono font-bold">
                                        {op.raw_value}
                                      </span>
                                      <button
                                        type="button"
                                        className="operand-page-link"
                                        onClick={() =>
                                          onInspectCitation(
                                            matchingCite || {
                                              company: item.company || "Apple Inc.",
                                              report_year: 2024,
                                              report_type: "10-K",
                                              printed_page: op.printed_page,
                                              section: op.source_statement,
                                              exact_quote: `${op.name}: ${op.raw_value} in ${op.source_statement}`,
                                            }
                                          )
                                        }
                                        title={`Inspect Page ${op.printed_page} in filing`}
                                      >
                                        Page {op.printed_page} ↗
                                      </button>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* 4. Clickable Citations Opening the Original Page */}
              {item.citations && item.citations.length > 0 && (
                <div className="citations-tray">
                  <div className="citations-tray-header">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                      <polyline points="14 2 14 8 20 8" />
                    </svg>
                    <span>Supporting SEC 10-K Pages ({item.citations.length} Citations):</span>
                  </div>
                  <div className="citations-chips-group">
                    {item.citations.map((cite, cIdx) => (
                      <button
                        key={cIdx}
                        type="button"
                        className="citation-interactive-pill"
                        onClick={() => onInspectCitation(cite)}
                        title={`Click to open Page ${cite.printed_page} excerpt and official SEC filing`}
                      >
                        <span className="cite-page-badge">Page {cite.printed_page}</span>
                        <span className="cite-section-label">
                          {cite.section?.split("-")[0]?.trim() || "Financial Statements"}
                        </span>
                        <span className="cite-open-icon">↗</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Action Toolbar */}
              <div className="assistant-tools-bar">
                <div className="tools-left">
                  <button
                    type="button"
                    className="btn-tool-action"
                    onClick={() => handleCopy(item.answer_text, idx)}
                    title="Copy response text"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                    </svg>
                    <span>{copiedId === idx ? "Copied" : "Copy"}</span>
                  </button>

                  <button
                    type="button"
                    className="btn-tool-action"
                    onClick={() => onExportMemo(item)}
                    title="Export markdown analysis memo"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <polyline points="7 10 12 15 17 10" />
                      <line x1="12" y1="15" x2="12" y2="3" />
                    </svg>
                    <span>Export Memo</span>
                  </button>
                </div>

                <div className="tools-right font-mono">
                  {item.timings_ms?.total && (
                    <span>{item.timings_ms.total}ms • {item.request_id || "req_local"}</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      ))}

      {/* Loading state indicator */}
      {loading && (
        <div className="assistant-response-container">
          <div className="assistant-avatar" aria-hidden="true">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            </svg>
          </div>
          <div className="assistant-content-card" style={{ padding: "1.1rem 1.4rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
              <div className="spinner-circle" />
              <span style={{ fontSize: "0.85rem", color: "var(--c-charcoal)", fontWeight: 500 }}>
                Retrieving document chunks & extracting disclosed figures...
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
