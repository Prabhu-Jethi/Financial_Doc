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
}) {
  const textareaRef = useRef(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
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

  return (
    <div className="floating-input-dock">
      <div className="input-console-pill">
        {/* Scope Context Header Banner inside composer */}
        <div className="composer-scope-bar">
          <div className="scope-indicator-tag">
            <span className="scope-dot" />
            <span className="scope-text-bold">Source Report:</span>
            <span>Apple Form 10-K (FY2024)</span>
            <span className="scope-subtext-pill">Contains FY24, FY23 &amp; FY22 Comparative Disclosures</span>
          </div>

          <div className="composer-period-picker">
            <label htmlFor="period-selector" className="period-picker-label">
              Comparison Scope:
            </label>
            <select
              id="period-selector"
              className="filter-chip-select"
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              disabled={loading}
              title="Select fiscal periods for query comparison"
            >
              <option value="">All Disclosed Periods (FY22–FY24 in FY24 10-K)</option>
              <option value="Comparative: FY2024 vs FY2023">
                Comparative: FY2024 vs FY2023 (Disclosed in FY2024 10-K)
              </option>
              <option value="FY2024">FY2024 (Reported Period)</option>
              <option value="FY2023">FY2023 (Disclosed Comparative Period)</option>
              <option value="FY2022">FY2022 (Disclosed Comparative Period)</option>
            </select>
          </div>
        </div>

        {/* Main Input Row */}
        <div className="input-main-row">
          <textarea
            ref={textareaRef}
            className="chat-input-field"
            placeholder="Ask about revenue, margins, and year-to-year changes (e.g., 'Compare Services net sales between 2023 and 2024')..."
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={loading}
            rows={1}
            aria-label="Ask a financial question about the document"
          />

          <button
            type="button"
            className="btn-send-message"
            onClick={onSubmit}
            disabled={!question.trim() || loading}
            title="Execute document query (Enter)"
            aria-label="Submit query"
          >
            {loading ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="spinner-circle">
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

        {/* Bottom controls in dock */}
        <div className="input-bottom-bar">
          <div className="input-controls-left">
            <button
              type="button"
              className="btn-input-attach"
              onClick={onOpenUpload}
              title="Upload custom report or SEC filing"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
              </svg>
              <span>Upload Document</span>
            </button>
            <span className="composer-upload-hint">
              (Multi-year comparisons are already embedded in the FY2024 filing)
            </span>
          </div>

          <span className="composer-shortcut-hint font-mono">
            Enter to send • Shift+Enter for newline
          </span>
        </div>
      </div>
    </div>
  );
}
