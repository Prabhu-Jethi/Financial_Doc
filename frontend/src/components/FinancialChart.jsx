"use client";

import { useState } from "react";

export default function FinancialChart({ comparisonTable, company }) {
  const [activeTab, setActiveTab] = useState("bars"); // "bars" | "growth"
  const [hoveredIndex, setHoveredIndex] = useState(null);

  if (!comparisonTable || !comparisonTable.rows || comparisonTable.rows.length === 0) {
    return null;
  }

  const { columns = [], rows = [], title = "" } = comparisonTable;
  const priorLabel = columns[1] || "Prior Period";
  const currentLabel = columns[2] || "Current Period";

  // Number parser
  const parseValue = (val) => {
    if (!val || typeof val !== "string") return 0;
    const clean = val.replace(/[$,\s]/g, "");
    if (clean.endsWith("%")) {
      return parseFloat(clean.replace("%", "")) || 0;
    }
    return parseFloat(clean) || 0;
  };

  const chartData = rows.map((r) => {
    const pVal = parseValue(r.prior_period);
    const cVal = parseValue(r.current_period);
    const growthVal = parseValue(r.variance_pct);
    const isPercent = r.current_period?.includes("%");
    return {
      metric: r.metric,
      priorRaw: r.prior_period,
      currentRaw: r.current_period,
      priorVal: pVal,
      currentVal: cVal,
      growthVal: growthVal,
      varianceDollar: r.variance_dollar,
      variancePct: r.variance_pct,
      isPercent,
    };
  });

  // Calculate scales for comparison bars
  const maxBarVal = Math.max(...chartData.map((d) => Math.max(d.priorVal, d.currentVal)), 1);

  // SVG dimensions
  const svgWidth = 680;
  const rowHeight = 62;
  const svgHeight = chartData.length * rowHeight + 40;
  const labelWidth = 180;
  const barAreaWidth = svgWidth - labelWidth - 90;

  return (
    <div className="financial-chart-container" aria-label="Interactive Financial Visualization">
      {/* Chart Header Toolbar */}
      <div className="chart-header-row">
        <div className="chart-title-group">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className="chart-icon">
            <line x1="18" y1="20" x2="18" y2="10" />
            <line x1="12" y1="20" x2="12" y2="4" />
            <line x1="6" y1="20" x2="6" y2="14" />
          </svg>
          <span className="chart-header-title">Visual Financial Bridge &amp; Performance</span>
        </div>

        {/* View Mode Switcher */}
        <div className="chart-mode-pills">
          <button
            type="button"
            className={`btn-chart-mode ${activeTab === "bars" ? "active" : ""}`}
            onClick={() => setActiveTab("bars")}
          >
            📊 Comparison Bars
          </button>
          <button
            type="button"
            className={`btn-chart-mode ${activeTab === "growth" ? "active" : ""}`}
            onClick={() => setActiveTab("growth")}
          >
            📈 YoY Growth (%)
          </button>
        </div>
      </div>

      {/* Legend */}
      <div className="chart-legend-row">
        {activeTab === "bars" ? (
          <>
            <div className="legend-item">
              <span className="legend-color-box prior" />
              <span>{priorLabel}</span>
            </div>
            <div className="legend-item">
              <span className="legend-color-box current" />
              <span>{currentLabel}</span>
            </div>
          </>
        ) : (
          <>
            <div className="legend-item">
              <span className="legend-color-box pos" />
              <span>Positive YoY Expansion</span>
            </div>
            <div className="legend-item">
              <span className="legend-color-box neg" />
              <span>Contraction / Decline</span>
            </div>
          </>
        )}
      </div>

      {/* SVG Visualization Stage */}
      <div className="chart-svg-wrapper">
        <svg
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          className="financial-chart-svg"
          preserveAspectRatio="xMidYMid meet"
        >
          {/* Subtle Grid Guidelines */}
          {[0.25, 0.5, 0.75, 1.0].map((frac, gIdx) => (
            <line
              key={gIdx}
              x1={labelWidth + frac * barAreaWidth}
              y1={15}
              x2={labelWidth + frac * barAreaWidth}
              y2={svgHeight - 15}
              stroke="var(--border-subtle)"
              strokeDasharray="3 3"
              opacity="0.4"
            />
          ))}

          {activeTab === "bars" ? (
            // ================= DUAL COMPARISON BARS =================
            chartData.map((d, idx) => {
              const y = idx * rowHeight + 25;
              const priorW = Math.max(6, (d.priorVal / maxBarVal) * barAreaWidth);
              const currW = Math.max(6, (d.currentVal / maxBarVal) * barAreaWidth);
              const isHovered = hoveredIndex === idx;

              return (
                <g
                  key={idx}
                  className="chart-row-group"
                  onMouseEnter={() => setHoveredIndex(idx)}
                  onMouseLeave={() => setHoveredIndex(null)}
                >
                  {/* Row Highlight on Hover */}
                  {isHovered && (
                    <rect
                      x={4}
                      y={y - 8}
                      width={svgWidth - 8}
                      height={rowHeight - 6}
                      rx={6}
                      fill="var(--bg-surface-hover)"
                      opacity="0.6"
                    />
                  )}

                  {/* Metric Label */}
                  <text
                    x={labelWidth - 12}
                    y={y + 16}
                    textAnchor="end"
                    className="chart-metric-label"
                    fill="var(--c-charcoal)"
                    fontSize="11.5"
                    fontWeight={isHovered ? "700" : "600"}
                  >
                    {d.metric.length > 24 ? d.metric.slice(0, 22) + "…" : d.metric}
                  </text>

                  {/* Prior Bar (Light Gray) */}
                  <rect
                    x={labelWidth}
                    y={y}
                    width={priorW}
                    height={13}
                    rx={3}
                    fill="var(--c-mid-gray)"
                    opacity={isHovered ? "0.95" : "0.75"}
                    className="chart-bar"
                  />
                  <text
                    x={labelWidth + priorW + 6}
                    y={y + 10}
                    fontSize="9.5"
                    fontFamily="var(--font-mono)"
                    fill="var(--text-dim)"
                  >
                    {d.priorRaw}
                  </text>

                  {/* Current Bar (Charcoal / Primary) */}
                  <rect
                    x={labelWidth}
                    y={y + 17}
                    width={currW}
                    height={15}
                    rx={4}
                    fill="var(--c-charcoal)"
                    className="chart-bar active"
                  />
                  <text
                    x={labelWidth + currW + 6}
                    y={y + 29}
                    fontSize="10.5"
                    fontFamily="var(--font-mono)"
                    fontWeight="700"
                    fill="var(--c-charcoal)"
                  >
                    {d.currentRaw}
                  </text>

                  {/* Delta Variance Pill at Right */}
                  <g transform={`translate(${svgWidth - 75}, ${y + 8})`}>
                    <rect
                      x={0}
                      y={0}
                      width={68}
                      height={20}
                      rx={10}
                      fill={d.growthVal >= 0 ? "var(--delta-pos-bg)" : "var(--delta-neg-bg)"}
                      stroke={d.growthVal >= 0 ? "var(--delta-pos-border)" : "var(--delta-neg-border)"}
                      strokeWidth="1"
                    />
                    <text
                      x={34}
                      y={14}
                      textAnchor="middle"
                      fontSize="9.5"
                      fontFamily="var(--font-mono)"
                      fontWeight="800"
                      fill={d.growthVal >= 0 ? "var(--delta-pos-text)" : "var(--delta-neg-text)"}
                    >
                      {d.variancePct || `${d.growthVal > 0 ? "+" : ""}${d.growthVal.toFixed(1)}%`}
                    </text>
                  </g>
                </g>
              );
            })
          ) : (
            // ================= YOY GROWTH BRIDGE =================
            chartData.map((d, idx) => {
              const y = idx * rowHeight + 25;
              const maxGrowth = Math.max(...chartData.map((x) => Math.abs(x.growthVal)), 10);
              const zeroX = labelWidth + barAreaWidth / 2;
              const halfWidth = barAreaWidth / 2 - 10;
              const barLen = Math.max(6, (Math.abs(d.growthVal) / maxGrowth) * halfWidth);
              const isPos = d.growthVal >= 0;
              const isHovered = hoveredIndex === idx;

              return (
                <g
                  key={idx}
                  className="chart-row-group"
                  onMouseEnter={() => setHoveredIndex(idx)}
                  onMouseLeave={() => setHoveredIndex(null)}
                >
                  {isHovered && (
                    <rect
                      x={4}
                      y={y - 8}
                      width={svgWidth - 8}
                      height={rowHeight - 6}
                      rx={6}
                      fill="var(--bg-surface-hover)"
                      opacity="0.6"
                    />
                  )}

                  {/* Metric Label */}
                  <text
                    x={labelWidth - 12}
                    y={y + 18}
                    textAnchor="end"
                    className="chart-metric-label"
                    fill="var(--c-charcoal)"
                    fontSize="11.5"
                    fontWeight={isHovered ? "700" : "600"}
                  >
                    {d.metric.length > 24 ? d.metric.slice(0, 22) + "…" : d.metric}
                  </text>

                  {/* Center Zero Baseline */}
                  <line
                    x1={zeroX}
                    y1={y - 4}
                    x2={zeroX}
                    y2={y + 30}
                    stroke="var(--border-medium)"
                    strokeWidth="1.5"
                  />

                  {/* Growth Bar */}
                  <rect
                    x={isPos ? zeroX : zeroX - barLen}
                    y={y + 4}
                    width={barLen}
                    height={20}
                    rx={4}
                    fill={isPos ? "var(--delta-pos-bg)" : "var(--delta-neg-bg)"}
                    stroke={isPos ? "var(--delta-pos-border)" : "var(--delta-neg-border)"}
                    strokeWidth="1"
                    className="chart-bar"
                  />

                  {/* Growth Percentage Label */}
                  <text
                    x={isPos ? zeroX + barLen + 8 : zeroX - barLen - 8}
                    y={y + 18}
                    textAnchor={isPos ? "start" : "end"}
                    fontSize="11"
                    fontFamily="var(--font-mono)"
                    fontWeight="800"
                    fill={isPos ? "var(--delta-pos-text)" : "var(--delta-neg-text)"}
                  >
                    {d.variancePct || `${isPos ? "+" : ""}${d.growthVal.toFixed(1)}%`}
                  </text>

                  {/* Variance Dollar in paren */}
                  <text
                    x={svgWidth - 15}
                    y={y + 18}
                    textAnchor="end"
                    fontSize="10"
                    fontFamily="var(--font-mono)"
                    fill="var(--text-dim)"
                  >
                    {d.varianceDollar || ""}
                  </text>
                </g>
              );
            })
          )}
        </svg>
      </div>

      {/* Floating Hover Context Card */}
      {hoveredIndex !== null && chartData[hoveredIndex] && (
        <div className="chart-tooltip-badge">
          <strong>{chartData[hoveredIndex].metric}:</strong>{" "}
          <span>{priorLabel}: {chartData[hoveredIndex].priorRaw}</span> →{" "}
          <span><strong>{currentLabel}: {chartData[hoveredIndex].currentRaw}</strong></span>{" "}
          <span className="tooltip-delta-tag">({chartData[hoveredIndex].variancePct})</span>
        </div>
      )}
    </div>
  );
}

