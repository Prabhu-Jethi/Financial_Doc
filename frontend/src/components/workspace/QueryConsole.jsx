"use client";

import { useState } from "react";

const CATEGORIES = [
  { id: "all", label: "All Prompts" },
  { id: "segments", label: "Revenue & Segments" },
  { id: "margins", label: "Margins & Formulas" },
  { id: "balance", label: "Balance Sheet & Cash" },
  { id: "mda", label: "MD&A Commentary" },
  { id: "bounds", label: "Boundary Controls" },
];

const SAMPLE_PROMPTS = [
  {
    id: "DEV-001",
    cat: "segments",
    label: "FY24 Total Net Sales",
    query: "What were Apple's total net sales in fiscal year 2024?",
    period: "FY2024",
  },
  {
    id: "DEV-002",
    cat: "margins",
    label: "FY24 Operating Income",
    query: "What was Apple's total operating income for fiscal year 2024?",
    period: "FY2024",
  },
  {
    id: "DEV-003",
    cat: "balance",
    label: "Cash & Equivalents Balance",
    query: "What was Apple's cash and cash equivalents balance as of September 28, 2024?",
    period: "FY2024",
  },
  {
    id: "DEV-004",
    cat: "segments",
    label: "Product Category Breakdown",
    query: "What was the breakdown of Apple's net sales by product category in fiscal year 2024?",
    period: "FY2024",
  },
  {
    id: "DEV-005",
    cat: "margins",
    label: "Services Sales YoY Comparison",
    query: "Compare Apple's Services net sales between fiscal year 2023 and fiscal year 2024.",
    period: "FY2024",
  },
  {
    id: "DEV-006",
    cat: "margins",
    label: "FY24 Operating Margin Calculation",
    query: "What was Apple's operating margin for fiscal year 2024?",
    period: "FY2024",
  },
  {
    id: "DEV-007",
    cat: "segments",
    label: "iPhone YoY Percentage Growth",
    query: "What was the year-over-year percentage growth in Apple's iPhone net sales from fiscal year 2023 to fiscal year 2024?",
    period: "FY2024",
  },
  {
    id: "DEV-008",
    cat: "mda",
    label: "Item 7 Services Growth Drivers",
    query: "According to management in Item 7 of the FY2024 10-K, what primary factors drove the increase in Services net sales during 2024 compared to 2023?",
    period: "FY2024",
  },
  {
    id: "DEV-009",
    cat: "bounds",
    label: "Negative Test: Q2 FY2025 (Out of Corpus)",
    query: "What were Apple's total net sales in the second quarter of fiscal year 2025?",
    period: "FY2025",
  },
  {
    id: "DEV-010",
    cat: "bounds",
    label: "Guardrail Test: Stock Advice Request",
    query: "Based on the FY2024 financial results, should I buy or sell Apple stock?",
    period: "",
  },
];

export default function QueryConsole({
  question,
  setQuestion,
  period,
  setPeriod,
  loading,
  onSubmit,
  onCancel,
}) {
  const [activeCategory, setActiveCategory] = useState("all");

  const filteredPrompts =
    activeCategory === "all"
      ? SAMPLE_PROMPTS
      : SAMPLE_PROMPTS.filter((p) => p.cat === activeCategory);

  const handleKeyDown = (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      if (!loading && question.trim()) {
        onSubmit();
      }
    }
  };

  return (
    <section className="query-hub" aria-label="Query Console">
      {/* Category Navigation Pills */}
      <div className="category-nav">
        {CATEGORIES.map((cat) => (
          <button
            key={cat.id}
            type="button"
            className={`category-pill ${activeCategory === cat.id ? "active" : ""}`}
            onClick={() => setActiveCategory(cat.id)}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Filtered Sample Prompt Chips */}
      <div className="sample-chips-row">
        {filteredPrompts.map((p) => {
          const isSelected = question === p.query;
          return (
            <button
              key={p.id}
              type="button"
              className={`sample-chip-btn ${isSelected ? "selected" : ""}`}
              onClick={() => {
                setQuestion(p.query);
                if (p.period) setPeriod(p.period);
              }}
              title={p.query}
            >
              <span className="chip-id-badge">{p.id}</span>
              <span>{p.label}</span>
            </button>
          );
        })}
      </div>

      {/* Query Input Box */}
      <div className="query-box-container">
        <textarea
          className="query-textarea"
          placeholder="Ask a factual question about Apple Inc. Form 10-K filings (e.g., 'What were iPhone net sales in FY2024?' or 'Calculate operating margin')..."
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={loading}
          rows={3}
          aria-label="Financial Query Input"
        />

        {/* Bottom Toolbar inside Input Box */}
        <div className="query-toolbar">
          <div className="query-filters-group">
            <select
              className="select-filter-custom"
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              disabled={loading}
              aria-label="Filter Fiscal Period"
            >
              <option value="">All Periods (FY22–FY24)</option>
              <option value="FY2024">FY2024 (Ended Sep 28, 2024)</option>
              <option value="FY2023">FY2023 (Ended Sep 30, 2023)</option>
              <option value="FY2022">FY2022 (Ended Sep 24, 2022)</option>
            </select>

            <span className="query-shortcut-tip">
              <span>Execute:</span>
              <kbd className="kbd-badge">Ctrl</kbd> + <kbd className="kbd-badge">Enter</kbd>
            </span>
          </div>

          <div className="query-actions-group">
            {question && !loading && (
              <button
                type="button"
                className="btn-query-clear"
                onClick={() => setQuestion("")}
                title="Clear input text"
              >
                Clear
              </button>
            )}

            {loading ? (
              <button
                type="button"
                className="btn-action-danger"
                onClick={onCancel}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
                <span>Cancel</span>
              </button>
            ) : (
              <button
                type="button"
                className="btn-action-primary"
                onClick={onSubmit}
                disabled={!question.trim()}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <polyline points="9 18 15 12 9 6" />
                </svg>
                <span>Run Analysis</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
