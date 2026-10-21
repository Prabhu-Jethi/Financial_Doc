"use client";

import { useRef, useEffect } from "react";

export default function ChatInput({
  question,
  setQuestion,
  period,
  setPeriod,
  loading,
  onSubmit,
  onOpenUpload,
  activeDocSummary,
}) {
  const textareaRef = useRef(null);

  // Auto-resize textarea to fit question length smoothly
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 140)}px`;
    }
  }, [question]);

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (!loading && question.trim()) {
        onSubmit();
      }
    }
  };

  const hasText = question.trim().length > 0;

  // Format concise summary for corpus chip
  const corpusChipText = activeDocSummary
    ? activeDocSummary.replace(" (Multi-Company Corpus)", "").replace(" Active", "")
    : "11 Filings";

  return (
    <div className="chatgpt-input-dock" role="region" aria-label="Query Composer">
      <div className="chatgpt-input-container">
        {/* Main ChatGPT Composer Card */}
        <div className="chatgpt-composer-box">
          {/* Top: Auto-expanding Textarea */}
          <textarea
            ref={textareaRef}
            className="chatgpt-textarea"
            placeholder="Ask anything about Apple, Microsoft, Amazon, or Meta SEC 10-K filings..."
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={loading}
            rows={1}
            aria-label="Ask a financial question"
          />

          {/* Bottom Action & Context Toolbar inside the Composer */}
          <div className="chatgpt-toolbar-row">
            <div className="chatgpt-toolbar-left">
              {/* Attachment / Upload Button */}
              <button
                type="button"
                className="btn-chatgpt-attach"
                onClick={onOpenUpload}
                title="Upload SEC Form 10-K or financial report"
                aria-label="Upload document"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
              </button>

              {/* Scope / Corpus Badge Chip */}
              <div className="chatgpt-corpus-chip" title={activeDocSummary || "11 Active Corporate Filings"}>
                <span className="chatgpt-scope-dot" aria-hidden="true" />
                <span className="chatgpt-chip-text">{corpusChipText}</span>
              </div>

              {/* Reporting Period Selector Pill */}
              <div className="chatgpt-period-chip">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0 }}>
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                  <line x1="16" y1="2" x2="16" y2="6" />
                  <line x1="8" y1="2" x2="8" y2="6" />
                  <line x1="3" y1="10" x2="21" y2="10" />
                </svg>
                <select
                  id="period-selector-pill"
                  className="chatgpt-period-select"
                  value={period}
                  onChange={(e) => setPeriod(e.target.value)}
                  disabled={loading}
                  title="Filter comparative fiscal period"
                >
                  <option value="">All Disclosed (FY22–FY24)</option>
                  <option value="Comparative: FY2024 vs FY2023">Comparative: FY24 vs FY23</option>
                  <option value="FY2024">FY2024 Reported</option>
                  <option value="FY2023">FY2023 Comparative</option>
                  <option value="FY2022">FY2022 Comparative</option>
                </select>
              </div>
            </div>

            {/* Right: Circular Send Button */}
            <div className="chatgpt-toolbar-right">
              <button
                type="button"
                className={`btn-chatgpt-send ${hasText ? "ready" : ""}`}
                onClick={onSubmit}
                disabled={!hasText || loading}
                title={hasText ? "Send query (Enter)" : "Type a financial question to send"}
                aria-label="Send query"
              >
                {loading ? (
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="spinner-circle">
                    <circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
                    <path d="M12 2a10 10 0 0 1 10 10" />
                  </svg>
                ) : (
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <line x1="12" y1="19" x2="12" y2="5" />
                    <polyline points="5 12 12 5 19 12" />
                  </svg>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Bottom Centered Disclaimer */}
        <div className="chatgpt-input-footer">
          <span className="chatgpt-footnote-text">
            SEC 10-K Document Intelligence • Multi-year comparative disclosures are citation-grounded.
          </span>
        </div>
      </div>
    </div>
  );
}
