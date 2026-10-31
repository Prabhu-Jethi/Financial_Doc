"use client";

import { useState } from "react";
import FinancialChart from "./FinancialChart";
import { exportFinancialModelToExcel } from "../../lib/exportExcel";

const STARTER_PROMPTS = [
  {
    tag: "DEV-015",
    label: "Meta Revenue",
    query: "Meta's 2024 fiscal year revenue?",
    period: "FY2024",
  },
  {
    tag: "DEV-018",
    label: "Microsoft Margin",
    query: "Microsoft FY24 operating margin?",
    period: "FY2024",
  },
  {
    tag: "DEV-016",
    label: "Amazon Growth",
    query: "What was Amazon's revenue growth in 2023?",
    period: "Comparative: FY2023 vs FY2022",
  },
  {
    tag: "DEV-006",
    label: "Apple Margin",
    query: "What was Apple's operating margin for fiscal year 2024?",
    period: "FY2024",
  },
  {
    tag: "DEV-014",
    label: "Cross-Company",
    query: "Compare Apple and Microsoft's operating margins for fiscal year 2024.",
    period: "FY2024 Comparative",
  },
  {
    tag: "DEV-020",
    label: "AWS Segment",
    query: "Amazon AWS sales 2024",
    period: "FY2024",
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
  const [viewModes, setViewModes] = useState({}); // idx -> "table" | "chart" | "both"
  const [speakingIndex, setSpeakingIndex] = useState(null);
  const [hoveredCitation, setHoveredCitation] = useState(null);

  const handleCopy = (text, id) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const toggleLedger = (idx) => {
    setOpenLedgerIndex(openLedgerIndex === idx ? null : idx);
  };

  const handleSetViewMode = (idx, mode) => {
    setViewModes((prev) => ({ ...prev, [idx]: mode }));
  };

  const handleToggleSpeech = (text, idx) => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;

    if (speakingIndex === idx) {
      window.speechSynthesis.cancel();
      setSpeakingIndex(null);
      return;
    }

    window.speechSynthesis.cancel();

    // Clean text for natural speech (remove markdown symbols, formulas, bracketed page numbers)
    const cleanText = text
      .replace(/\[\d+\]/g, "")
      .replace(/[*_#`~]/g, "")
      .replace(/\$([0-9,]+)\s*million/gi, "$1 million dollars")
      .replace(/\(([^)]+)\)/g, "$1")
      .replace(/\s+/g, " ")
      .trim();

    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    utterance.onend = () => setSpeakingIndex(null);
    utterance.onerror = () => setSpeakingIndex(null);

    setSpeakingIndex(idx);
    window.speechSynthesis.speak(utterance);
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
            <strong>Comparative Scope Notice:</strong> An annual filing (such as Form 10-K for Apple, Amazon, Microsoft, or Meta) discloses comparative figures for prior years (e.g. FY23 & FY22). Multi-year comparisons do not require two separate filings.
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

              {/* 2. Structured Comparison Table & Visual Financial Chart */}
              {item.comparison_table && (
                <div className="comparison-section-container">
                  {/* View Mode Bar: Table | Chart | Both */}
                  <div className="table-chart-toggle-bar">
                    <span className="subview-section-label">
                      📈 Comparative Disclosures
                    </span>
                    <div className="subview-pills-group">
                      <button
                        type="button"
                        className={`btn-subview-pill ${(viewModes[idx] || "table") === "table" ? "active" : ""}`}
                        onClick={() => handleSetViewMode(idx, "table")}
                      >
                        📋 Table
                      </button>
                      <button
                        type="button"
                        className={`btn-subview-pill ${viewModes[idx] === "chart" ? "active" : ""}`}
                        onClick={() => handleSetViewMode(idx, "chart")}
                      >
                        📊 Visual Chart
                      </button>
                      <button
                        type="button"
                        className={`btn-subview-pill ${viewModes[idx] === "both" ? "active" : ""}`}
                        onClick={() => handleSetViewMode(idx, "both")}
                      >
                        🗂 Both
                      </button>
                    </div>
                  </div>

                  {/* Comparison Data Table */}
                  {((viewModes[idx] || "table") === "table" || viewModes[idx] === "both") && (
                    <div className="comparison-table-container">
                      <div className="comparison-table-header-block">
                        <div className="comparison-title-row">
                          <span className="comparison-table-title">{item.comparison_table.title}</span>
                          <span className="comparison-source-pill">
                            Source Filing: {item.comparison_table.source_filing || (item.company ? `${item.company} Form 10-K` : "SEC Form 10-K")}
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

                  {/* Interactive Financial Chart */}
                  {(viewModes[idx] === "chart" || viewModes[idx] === "both") && (
                    <FinancialChart
                      comparisonTable={item.comparison_table}
                      company={item.company}
                    />
                  )}
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
                                              company: item.company || "SEC Filing",
                                              report_year: item.reporting_periods?.[0] || 2024,
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
                    <span>
                      {item.citations.some(c => c.report_type === "10-K" || ["AAPL", "AMZN", "MSFT", "META"].includes(c.company || c.ticker))
                        ? `Supporting SEC 10-K Disclosures (${item.citations.length} Citations)`
                        : `Source Document Citations (${item.citations.length})`}
                    </span>
                  </div>
                  <div className="citations-chips-group">
                    {item.citations.map((cite, cIdx) => {
                      const citeKey = `${idx}-${cIdx}`;
                      const isHovered = hoveredCitation === citeKey;
                      return (
                        <div
                          key={cIdx}
                          className="citation-pill-wrapper"
                          onMouseEnter={() => setHoveredCitation(citeKey)}
                          onMouseLeave={() => setHoveredCitation(null)}
                        >
                          <button
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

                          {/* Instant Hover Quick-Peek Popover */}
                          {isHovered && (
                            <div className="citation-hover-popover" role="tooltip">
                              <div className="popover-header">
                                <span className="popover-badge">SEC Verified Excerpt</span>
                                <span className="popover-page">Page {cite.printed_page}</span>
                              </div>
                              <div className="popover-quote">
                                {cite.exact_quote ? `“${cite.exact_quote}”` : "Official SEC filing statement disclosure."}
                              </div>
                              {cite.section && (
                                <div className="popover-footer">
                                  <span>📁 {cite.section}</span>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
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

                  {/* Audio Executive Briefing */}
                  <button
                    type="button"
                    className={`btn-tool-action ${speakingIndex === idx ? "speaking" : ""}`}
                    onClick={() => handleToggleSpeech(item.answer_text, idx)}
                    title={speakingIndex === idx ? "Stop Executive Briefing" : "Listen to Executive Briefing"}
                  >
                    {speakingIndex === idx ? (
                      <>
                        <span className="audio-wave-anim">
                          <span /><span /><span />
                        </span>
                        <span>Stop Audio</span>
                      </>
                    ) : (
                      <>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                          <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" />
                        </svg>
                        <span>Listen Briefing</span>
                      </>
                    )}
                  </button>

                  {/* Audit-grade Excel export with live formulas */}
                  {item.comparison_table?.rows?.length > 0 && (
                    <button
                      type="button"
                      className="btn-tool-action btn-excel-action"
                      onClick={() => exportFinancialModelToExcel(item)}
                      title="Download audit-grade financial spreadsheet with live Excel formulas"
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="3" y="3" width="18" height="18" rx="2" />
                        <line x1="3" y1="9" x2="21" y2="9" />
                        <line x1="9" y1="21" x2="9" y2="9" />
                      </svg>
                      <span>Excel Model (.xls)</span>
                    </button>
                  )}

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
                    <span>{item.timings_ms.total > 1000 ? `${(item.timings_ms.total / 1000).toFixed(1)}s` : `${item.timings_ms.total}ms`}</span>
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
