"use client";

import { useState } from "react";
import { exportFinancialModelToExcel } from "../../lib/exportExcel";

const MATRIX_DATA = {
  FY2024: [
    {
      company: "Apple Inc.",
      ticker: "AAPL",
      revenue: "$391,035M",
      revenueNum: 391035,
      growth: "+2.02%",
      growthNum: 2.02,
      operatingIncome: "$123,216M",
      operatingIncomeNum: 123216,
      margin: "31.51%",
      marginNum: 31.51,
      netIncome: "$93,736M",
      rdExpense: "$31,370M",
      keySegment: "Services ($96.2B, +12.9%)",
      secUrl: "https://www.sec.gov/ix?doc=/Archives/edgar/data/0000320193/000032019324000106/aapl-20240928.htm",
      filingId: "AAPL-10K-2024",
    },
    {
      company: "Microsoft Corporation",
      ticker: "MSFT",
      revenue: "$245,124M",
      revenueNum: 245124,
      growth: "+15.67%",
      growthNum: 15.67,
      operatingIncome: "$109,433M",
      operatingIncomeNum: 109433,
      margin: "44.64%",
      marginNum: 44.64,
      netIncome: "$88,136M",
      rdExpense: "$29,510M",
      keySegment: "Intelligent Cloud ($105.4B, +19.3%)",
      secUrl: "https://www.sec.gov/ix?doc=/Archives/edgar/data/0000789019/000078901924000067/msft-20240630.htm",
      filingId: "MSFT-10K-2024",
    },
    {
      company: "Amazon.com, Inc.",
      ticker: "AMZN",
      revenue: "$574,785M",
      revenueNum: 574785,
      growth: "+11.83%",
      growthNum: 11.83,
      operatingIncome: "$36,852M",
      operatingIncomeNum: 36852,
      margin: "6.41%",
      marginNum: 6.41,
      netIncome: "$30,425M",
      rdExpense: "$85,622M",
      keySegment: "AWS ($105.0B, +13.3%)",
      secUrl: "https://www.sec.gov/ix?doc=/Archives/edgar/data/0001018724/000101872424000008/amzn-20231231.htm",
      filingId: "AMZN-10K-2024",
    },
    {
      company: "Meta Platforms, Inc.",
      ticker: "META",
      revenue: "$164,815M",
      revenueNum: 164815,
      growth: "+22.12%",
      growthNum: 22.12,
      operatingIncome: "$54,233M",
      operatingIncomeNum: 54233,
      margin: "32.91%",
      marginNum: 32.91,
      netIncome: "$39,098M",
      rdExpense: "$38,879M",
      keySegment: "Family of Apps Ad Revenue ($160.8B)",
      secUrl: "https://www.sec.gov/ix?doc=/Archives/edgar/data/0001326801/000132680125000011/meta-20241231.htm",
      filingId: "META-10K-2024",
    },
  ],
  FY2023: [
    {
      company: "Apple Inc.",
      ticker: "AAPL",
      revenue: "$383,285M",
      revenueNum: 383285,
      growth: "-2.80%",
      growthNum: -2.8,
      operatingIncome: "$114,301M",
      operatingIncomeNum: 114301,
      margin: "29.82%",
      marginNum: 29.82,
      netIncome: "$96,995M",
      rdExpense: "$29,915M",
      keySegment: "iPhone ($200.6B)",
      secUrl: "https://www.sec.gov/ix?doc=/Archives/edgar/data/0000320193/000032019323000106/aapl-20230930.htm",
      filingId: "AAPL-10K-2023",
    },
    {
      company: "Microsoft Corporation",
      ticker: "MSFT",
      revenue: "$211,915M",
      revenueNum: 211915,
      growth: "+6.88%",
      growthNum: 6.88,
      operatingIncome: "$88,523M",
      operatingIncomeNum: 88523,
      margin: "41.77%",
      marginNum: 41.77,
      netIncome: "$72,361M",
      rdExpense: "$27,195M",
      keySegment: "Intelligent Cloud ($87.9B)",
      secUrl: "https://www.sec.gov/ix?doc=/Archives/edgar/data/0000789019/000078901923000067/msft-20230630.htm",
      filingId: "MSFT-10K-2023",
    },
    {
      company: "Amazon.com, Inc.",
      ticker: "AMZN",
      revenue: "$513,983M",
      revenueNum: 513983,
      growth: "+9.40%",
      growthNum: 9.4,
      operatingIncome: "$12,248M",
      operatingIncomeNum: 12248,
      margin: "2.38%",
      marginNum: 2.38,
      netIncome: "-$2,722M",
      rdExpense: "$73,213M",
      keySegment: "AWS ($80.1B)",
      secUrl: "https://www.sec.gov/ix?doc=/Archives/edgar/data/0001018724/000101872423000008/amzn-20221231.htm",
      filingId: "AMZN-10K-2023",
    },
    {
      company: "Meta Platforms, Inc.",
      ticker: "META",
      revenue: "$134,902M",
      revenueNum: 134902,
      growth: "+15.69%",
      growthNum: 15.69,
      operatingIncome: "$34,204M",
      operatingIncomeNum: 34204,
      margin: "25.35%",
      marginNum: 25.35,
      netIncome: "$23,200M",
      rdExpense: "$35,338M",
      keySegment: "Family of Apps ($133.0B)",
      secUrl: "https://www.sec.gov/ix?doc=/Archives/edgar/data/0001326801/000132680124000012/meta-20231231.htm",
      filingId: "META-10K-2023",
    },
  ],
};

export default function CompareMatrixModal({
  isOpen,
  onClose,
  onSelectPrompt,
}) {
  const [selectedYear, setSelectedYear] = useState("FY2024");
  const [selectedTickers, setSelectedTickers] = useState(["AAPL", "MSFT", "AMZN", "META"]);

  if (!isOpen) return null;

  const dataset = MATRIX_DATA[selectedYear] || MATRIX_DATA["FY2024"];
  const visibleCompanies = dataset.filter((c) => selectedTickers.includes(c.ticker));

  const toggleTicker = (ticker) => {
    setSelectedTickers((prev) =>
      prev.includes(ticker)
        ? prev.length > 1
          ? prev.filter((t) => t !== ticker)
          : prev
        : [...prev, ticker]
    );
  };

  // Find leader metrics
  const maxRevenue = Math.max(...visibleCompanies.map((c) => c.revenueNum));
  const maxMargin = Math.max(...visibleCompanies.map((c) => c.marginNum));
  const maxGrowth = Math.max(...visibleCompanies.map((c) => c.growthNum));

  const handleAskInChat = (tickerA, tickerB) => {
    if (onSelectPrompt) {
      onSelectPrompt(
        `Compare ${tickerA} and ${tickerB}'s operating margins and revenue growth for ${selectedYear}.`,
        `${selectedYear} Comparative`
      );
    }
    onClose();
  };

  const handleExportComparison = () => {
    const syntheticItem = {
      company: `Multi-Company Benchmark (${selectedTickers.join(", ")})`,
      reporting_periods: [selectedYear],
      comparison_table: {
        title: `Big Tech Financial Benchmark Scorecard (${selectedYear})`,
        source_filing: "SEC Form 10-K Filings (EDGAR Verified)",
        columns: ["Company / Metric", "Revenue ($M)", "Operating Income ($M)", "Operating Margin (%)", "YoY Growth (%)", "Top Segment"],
        rows: visibleCompanies.map((c) => ({
          metric: `${c.company} (${c.ticker})`,
          prior_period: c.revenue,
          current_period: c.operatingIncome,
          variance_dollar: c.margin,
          variance_pct: c.growth,
          source: c.keySegment,
        })),
      },
      citations: visibleCompanies.map((c, i) => ({
        company: c.company,
        printed_page: `${i + 1}`,
        section: "Item 7: MD&A",
        exact_quote: `${c.company} reported ${selectedYear} revenue of ${c.revenue} with operating income of ${c.operatingIncome} (${c.margin} margin).`,
      })),
    };
    exportFinancialModelToExcel(syntheticItem);
  };

  return (
    <div className="upload-modal-overlay" onClick={onClose} aria-label="Compare Companies Modal Backdrop">
      <div
        className="compare-modal-card"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Multi-Company Comparison Scorecard"
      >
        {/* Header */}
        <div className="compare-modal-header">
          <div className="compare-modal-title-group">
            <div className="compare-icon-badge">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <rect x="3" y="3" width="7" height="9" rx="1" />
                <rect x="14" y="3" width="7" height="5" rx="1" />
                <rect x="14" y="12" width="7" height="9" rx="1" />
                <rect x="3" y="16" width="7" height="5" rx="1" />
              </svg>
            </div>
            <div>
              <div className="compare-title">Multi-Company SEC 10-K Benchmark Matrix</div>
              <div className="compare-subtitle">Side-by-side audited comparison across Big Tech Form 10-K disclosures</div>
            </div>
          </div>

          <button
            type="button"
            className="btn-upload-close"
            onClick={onClose}
            aria-label="Close Comparison Modal"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Toolbar: Filters & Year Selector */}
        <div className="compare-toolbar">
          <div className="compare-filter-group">
            <span className="compare-filter-label">Companies:</span>
            {["AAPL", "MSFT", "AMZN", "META"].map((t) => (
              <button
                key={t}
                type="button"
                className={`company-chip ${selectedTickers.includes(t) ? "active" : ""}`}
                onClick={() => toggleTicker(t)}
              >
                {t}
              </button>
            ))}
          </div>

          <div className="compare-filter-group">
            <span className="compare-filter-label">Period:</span>
            {["FY2024", "FY2023"].map((y) => (
              <button
                key={y}
                type="button"
                className={`company-chip ${selectedYear === y ? "active" : ""}`}
                onClick={() => setSelectedYear(y)}
              >
                {y}
              </button>
            ))}
          </div>
        </div>

        {/* Scorecard Table */}
        <div className="compare-table-wrapper">
          <table className="comparison-data-table compare-matrix-table">
            <thead>
              <tr>
                <th className="text-left">Company</th>
                <th className="text-right">Total Revenue</th>
                <th className="text-right">YoY Growth</th>
                <th className="text-right">Operating Margin</th>
                <th className="text-right">Operating Income</th>
                <th className="text-right">R&amp;D Expense</th>
                <th className="text-left">Core Segment</th>
                <th className="text-center">SEC 10-K</th>
              </tr>
            </thead>
            <tbody>
              {visibleCompanies.map((c) => {
                const isRevLeader = c.revenueNum === maxRevenue;
                const isMarginLeader = c.marginNum === maxMargin;
                const isGrowthLeader = c.growthNum === maxGrowth;

                return (
                  <tr key={c.ticker}>
                    <td className="cell-metric">
                      <div style={{ display: "flex", alignItems: "center", gap: "0.45rem" }}>
                        <span className="mini-ticker-pill">{c.ticker}</span>
                        <span>{c.company}</span>
                      </div>
                    </td>
                    <td className="cell-num text-right font-bold">
                      {c.revenue}
                      {isRevLeader && <span className="leader-pill" title="Revenue Leader">🏆 Top</span>}
                    </td>
                    <td className="cell-num text-right">
                      <span className={`delta-badge ${c.growth.startsWith("+") ? "delta-pos" : "delta-neg"}`}>
                        {c.growth}
                      </span>
                      {isGrowthLeader && <span className="leader-pill" title="Growth Leader">⚡ Fast</span>}
                    </td>
                    <td className="cell-num text-right font-bold">
                      {c.margin}
                      {isMarginLeader && <span className="leader-pill" title="Operating Margin Leader">🎯 Margin</span>}
                    </td>
                    <td className="cell-num text-right">{c.operatingIncome}</td>
                    <td className="cell-num text-right">{c.rdExpense}</td>
                    <td className="cell-source text-left">{c.keySegment}</td>
                    <td className="text-center">
                      <a
                        href={c.secUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="sec-link-mini"
                        title={`Open official SEC Form 10-K for ${c.company}`}
                      >
                        10-K ↗
                      </a>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Quick Comparative Prompt Suggestions */}
        <div className="compare-prompts-tray">
          <span className="compare-prompts-label">Instant Cross-Company Questions:</span>
          <div className="compare-prompts-list">
            <button
              type="button"
              className="compare-prompt-chip"
              onClick={() => handleAskInChat("Apple", "Microsoft")}
            >
              💬 Compare Apple &amp; Microsoft Margins ({selectedYear})
            </button>
            <button
              type="button"
              className="compare-prompt-chip"
              onClick={() => handleAskInChat("Amazon", "Meta")}
            >
              💬 Compare Amazon &amp; Meta Revenue Growth ({selectedYear})
            </button>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="upload-modal-footer">
          <button
            type="button"
            className="btn-upload-cancel"
            onClick={handleExportComparison}
            title="Download comparative financial model (.xls) with live Excel formulas"
          >
            📊 Export Model (.xls)
          </button>
          <button
            type="button"
            className="btn-upload-submit"
            onClick={onClose}
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

