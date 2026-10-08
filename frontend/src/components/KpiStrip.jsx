"use client";

const AUDITED_KPIS = [
  {
    id: "kpi-sales",
    label: "FY24 Total Net Sales",
    badge: "+2.02% YoY",
    badgeType: "positive",
    value: "$391,035M",
    subtext: "Page 29 • Consolidated Stmts",
    query: "What were Apple's total net sales in fiscal year 2024?",
    period: "FY2024",
  },
  {
    id: "kpi-margin",
    label: "FY24 Operating Margin",
    badge: "31.51%",
    badgeType: "positive",
    value: "31.51%",
    subtext: "Derived • $123,216M Op Inc",
    query: "What was Apple's operating margin for fiscal year 2024?",
    period: "FY2024",
  },
  {
    id: "kpi-iphone",
    label: "FY24 iPhone Net Sales",
    badge: "51.45% Share",
    badgeType: "neutral",
    value: "$201,183M",
    subtext: "Item 7 • Segment Breakdown",
    query: "What was the breakdown of Apple's net sales by product category in fiscal year 2024?",
    period: "FY2024",
  },
  {
    id: "kpi-services",
    label: "FY24 Services Sales",
    badge: "+12.87% YoY",
    badgeType: "positive",
    value: "$96,169M",
    subtext: "Ads, App Store, Cloud Drivers",
    query: "Compare Apple's Services net sales between fiscal year 2023 and fiscal year 2024.",
    period: "FY2024",
  },
  {
    id: "kpi-cash",
    label: "Cash & Equivalents",
    badge: "Sep 28, 2024",
    badgeType: "neutral",
    value: "$29,943M",
    subtext: "Page 31 • Balance Sheet",
    query: "What was Apple's cash and cash equivalents balance as of September 28, 2024?",
    period: "FY2024",
  },
];

export default function KpiStrip({ onSelectQuery }) {
  return (
    <section className="kpi-section" aria-label="SEC Key Performance Indicators">
      <div className="kpi-section-header">
        <span>Form 10-K Disclosed Benchmarks (Apple Inc. FY2024)</span>
        <span className="font-mono">5 OF 5 FACTS VERIFIED</span>
      </div>

      <div className="kpi-grid">
        {AUDITED_KPIS.map((kpi) => (
          <div
            key={kpi.id}
            className="kpi-card"
            onClick={() => onSelectQuery(kpi.query, kpi.period)}
            title={`Click to analyze: "${kpi.query}"`}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onSelectQuery(kpi.query, kpi.period);
              }
            }}
          >
            <div className="kpi-meta">
              <span className="kpi-label">{kpi.label}</span>
              <span
                className={`kpi-badge ${
                  kpi.badgeType === "positive"
                    ? "kpi-badge--positive"
                    : "kpi-badge--neutral"
                }`}
              >
                {kpi.badge}
              </span>
            </div>
            <div className="kpi-value">{kpi.value}</div>
            <div className="kpi-subtext">
              <span>{kpi.subtext}</span>
              <span className="kpi-click-hint">Analyze →</span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
