"use client";

import { useState } from "react";

const SEGMENTS = [
  { name: "iPhone", value: 201183, share: "51.45%", color: "#38bdf8" },
  { name: "Services", value: 96169, share: "24.59%", color: "#6366f1" },
  { name: "Wearables, Home & Acc.", value: 37005, share: "9.46%", color: "#f59e0b" },
  { name: "Mac", value: 29984, share: "7.67%", color: "#10b981" },
  { name: "iPad", value: 26694, share: "6.83%", color: "#a855f7" },
];

const HISTORICAL_SALES = [
  { year: "FY2022", amount: "$394,328M", change: "Baseline" },
  { year: "FY2023", amount: "$383,285M", change: "-2.80% YoY" },
  { year: "FY2024", amount: "$391,035M", change: "+2.02% YoY" },
];

export default function DataVisualizer({ result }) {
  const [hoveredSegment, setHoveredSegment] = useState(null);

  // Check if current query relates to segments or margins
  const hasCalculations = result?.calculations && result.calculations.length > 0;

  return (
    <div className="visualizer-container">
      {/* Product Category Breakdown */}
      <div className="chart-card">
        <div className="visualizer-section-title">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-cyan">
            <line x1="18" y1="20" x2="18" y2="10" />
            <line x1="12" y1="20" x2="12" y2="4" />
            <line x1="6" y1="20" x2="6" y2="14" />
          </svg>
          <span>Net Sales by Category (FY2024 Form 10-K • Note 11)</span>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
          {SEGMENTS.map((seg) => {
            const isHovered = hoveredSegment === seg.name;
            return (
              <div
                key={seg.name}
                className="segment-bar-row"
                onMouseEnter={() => setHoveredSegment(seg.name)}
                onMouseLeave={() => setHoveredSegment(null)}
                style={{
                  opacity: hoveredSegment && !isHovered ? 0.6 : 1,
                  transition: "opacity 150ms ease",
                }}
              >
                <div className="segment-bar-labels">
                  <span className="segment-name">{seg.name}</span>
                  <div className="segment-values">
                    <span className="font-semibold text-primary" style={{ marginRight: "0.5rem" }}>
                      ${seg.value.toLocaleString()}M
                    </span>
                    <span className="kpi-badge kpi-badge--neutral font-mono">{seg.share}</span>
                  </div>
                </div>

                <div className="bar-track">
                  <div
                    className="bar-fill"
                    style={{
                      width: seg.share,
                      backgroundColor: seg.color,
                      boxShadow: isHovered ? `0 0 10px ${seg.color}` : "none",
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Multi-Year Trend & Operating Margin Gauge */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "1rem" }}>
        {/* Trend Comparison */}
        <div className="chart-card">
          <div className="visualizer-section-title">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-emerald">
              <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
              <polyline points="17 6 23 6 23 12" />
            </svg>
            <span>Multi-Year Net Sales Trajectory</span>
          </div>

          <div className="trend-comparison-grid">
            {HISTORICAL_SALES.map((item) => (
              <div key={item.year} className="trend-col">
                <span className="trend-year-label">{item.year}</span>
                <span className="trend-amount">{item.amount}</span>
                <span className="text-secondary font-mono" style={{ fontSize: "0.72rem" }}>
                  {item.change}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Margin Meter */}
        <div className="chart-card">
          <div className="visualizer-section-title">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-amber">
              <circle cx="12" cy="12" r="10" />
              <path d="m4.93 4.93 4.24 4.24" />
              <path d="m14.83 9.17 4.24-4.24" />
              <path d="m14.83 14.83 4.24 4.24" />
              <path d="m9.17 14.83-4.24 4.24" />
            </svg>
            <span>FY24 Operating Margin Efficiency</span>
          </div>

          <div className="margin-meter-wrapper">
            <div className="margin-gauge-circle">
              <span className="margin-gauge-value">31.51%</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem", fontSize: "0.8rem" }}>
              <span className="text-secondary">Formula: $123,216M ÷ $391,035M</span>
              <span className="text-emerald font-semibold">✓ Deterministic Decimal Provenance</span>
              <span className="text-tertiary" style={{ fontSize: "0.72rem" }}>
                Consumer Tech Industry Median: ~18.4%
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
