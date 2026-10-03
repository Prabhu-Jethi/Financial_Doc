"use client";

import { useState, useEffect, useRef } from "react";

const SAMPLE_QUESTIONS = [
  { id: "DEV-001", label: "FY24 Total Net Sales", q: "What were Apple's total net sales in fiscal year 2024?" },
  { id: "DEV-002", label: "FY24 Operating Income", q: "What was Apple's total operating income for fiscal year 2024?" },
  { id: "DEV-005", label: "Services Growth (FY23 vs FY24)", q: "Compare Apple's Services net sales between fiscal year 2023 and fiscal year 2024." },
  { id: "DEV-006", label: "Operating Margin Calc", q: "What was Apple's operating margin for fiscal year 2024?" },
  { id: "DEV-008", label: "MD&A Services Drivers", q: "According to management in Item 7 of the FY2024 10-K, what primary factors drove the increase in Services net sales during 2024 compared to 2023?" },
  { id: "DEV-009", label: "Negative Test (Q2 FY25)", q: "What were Apple's total net sales in the second quarter of fiscal year 2025?" },
];

export default function Home() {
  const [question, setQuestion] = useState("");
  const [period, setPeriod] = useState("FY2024");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [health, setHealth] = useState({ live: { status: "checking" }, ready: { status: "checking" } });

  const abortControllerRef = useRef(null);

  useEffect(() => {
    fetchHealth();
  }, []);

  const fetchHealth = async () => {
    try {
      const res = await fetch("/api/health");
      if (res.ok) {
        const data = await res.json();
        setHealth({ live: data.backend_live, ready: data.database_ready });
      }
    } catch {
      setHealth({ live: { status: "offline" }, ready: { status: "offline" } });
    }
  };

  const handleQuery = async (e) => {
    if (e) e.preventDefault();
    if (!question.trim() || loading) return;

    setLoading(true);
    setError(null);
    setResult(null);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const res = await fetch("/api/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: question.trim(),
          company: "Apple Inc.",
          reporting_periods: period ? [period] : undefined,
        }),
        signal: controller.signal,
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to process query");
      }
      setResult(data);
    } catch (err) {
      if (err.name === "AbortError") {
        setError("Query was cancelled by user.");
      } else {
        setError(err.message || "An unexpected error occurred");
      }
    } finally {
      setLoading(false);
      abortControllerRef.current = null;
    }
  };

  const handleCancel = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  };

  const isFastApiLive = health?.live?.status === "ok";
  const isDbConnected = health?.ready?.database === "connected";

  return (
    <main>
      {/* Header */}
      <header className="header">
        <div>
          <h1 className="title">Financial Document Intelligence</h1>
          <p className="subtitle">
            Analysis engine for Apple Inc. Forms 10-K (FY2022–FY2024)
          </p>
        </div>

        {/* Live Status Indicators */}
        <div className="status-pill">
          <div>
            <span className={`status-indicator ${isFastApiLive ? "status-online" : "status-offline"}`} />
            <span>FastAPI: <strong>{isFastApiLive ? "Live" : "Offline"}</strong></span>
          </div>
          <div>
            <span className={`status-indicator ${isDbConnected ? "status-online" : "status-offline"}`} />
            <span>Supabase: <strong>{isDbConnected ? "Connected" : "Disconnected"}</strong></span>
          </div>
        </div>
      </header>

      {/* Preset Development Benchmark Queries */}
      <section className="presets-section">
        <div className="section-label">Sample Benchmark Queries</div>
        <div className="presets-grid">
          {SAMPLE_QUESTIONS.map((sample) => (
            <button
              key={sample.id}
              onClick={() => setQuestion(sample.q)}
              className="preset-btn"
            >
              <span className="preset-tag">[{sample.id}]</span> {sample.label}
            </button>
          ))}
        </div>
      </section>

      {/* Query Form */}
      <section className="card">
        <form onSubmit={handleQuery}>
          <textarea
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Ask a financial question (e.g. What were Apple's total net sales in fiscal year 2024?)..."
            className="query-textarea"
          />

          <div className="form-actions">
            <div>
              <span style={{ fontSize: "13px", marginRight: "8px", color: "#64748b" }}>Filter:</span>
              <select
                value={period}
                onChange={(e) => setPeriod(e.target.value)}
                className="period-select"
              >
                <option value="FY2024">FY2024</option>
                <option value="FY2023">FY2023</option>
                <option value="FY2022">FY2022</option>
                <option value="">All Periods</option>
              </select>
            </div>

            <div>
              {loading ? (
                <button type="button" onClick={handleCancel} className="btn-cancel">
                  ■ Cancel Query
                </button>
              ) : (
                <button type="submit" disabled={!question.trim()} className="btn-primary">
                  Submit Question
                </button>
              )}
            </div>
          </div>
        </form>
      </section>

      {/* Loading Indicator */}
      {loading && (
        <div className="card" style={{ textAlign: "center", color: "#64748b", padding: "30px" }}>
          Retrieving documents, validating facts, and generating cited answer...
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="error-banner">
          <strong>Notice:</strong> {error}
        </div>
      )}

      {/* Answer Output */}
      {result && (
        <div>
          {/* Main Answer Text */}
          <div className="card">
            <div className="meta-row">
              <span className={`badge ${result.status === "answered" ? "badge-answered" : "badge-warning"}`}>
                {result.status}
              </span>
              <span style={{ fontSize: "12px", color: "#94a3b8" }}>
                Request: {result.request_id}
              </span>
            </div>

            <div className="answer-body">
              {result.answer_text}
            </div>
          </div>

          {/* Auditable Calculation Ledger */}
          {result.calculations && result.calculations.length > 0 && (
            <div className="card" style={{ borderColor: "#bfdbfe", background: "#f0f9ff" }}>
              <strong style={{ fontSize: "14px", color: "#1e3a8a" }}>Auditable Calculation Ledger</strong>
              {result.calculations.map((calc, idx) => (
                <div key={idx} className="ledger-item">
                  <div style={{ fontFamily: "monospace", color: "#1d4ed8", marginBottom: "6px" }}>
                    Formula: {calc.formula}
                  </div>
                  <div>
                    <strong>Operands:</strong>
                    <ul style={{ paddingLeft: "20px", marginTop: "4px" }}>
                      {calc.operands?.map((op, oIdx) => (
                        <li key={oIdx}>
                          {op.name}: <strong>{op.raw_value}</strong> (Statement: {op.source_statement}, p. {op.printed_page})
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div style={{ marginTop: "8px", paddingTop: "8px", borderTop: "1px solid #e2e8f0" }}>
                    <strong>Calculated Output:</strong> {calc.display_value} {calc.unit}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Sourced Citations */}
          {result.citations && result.citations.length > 0 && (
            <div className="card">
              <strong style={{ fontSize: "14px", color: "#334155" }}>Verified Citations</strong>
              <div className="citation-grid">
                {result.citations.map((cite, idx) => (
                  <div key={idx} className="citation-card">
                    <div style={{ display: "flex", justifyContent: "space-between", fontWeight: "600" }}>
                      <span>{cite.company} ({cite.report_year} {cite.report_type})</span>
                      <span style={{ color: "#2563eb" }}>p. {cite.printed_page}</span>
                    </div>
                    <div style={{ color: "#64748b", marginTop: "4px" }}>{cite.section}</div>
                    {cite.exact_quote && (
                      <div style={{ fontStyle: "italic", background: "#ffffff", padding: "6px", marginTop: "6px", border: "1px solid #f1f5f9" }}>
                        &quot;{cite.exact_quote}&quot;
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </main>
  );
}
