"use client";

import { useState, useRef, useCallback } from "react";

/**
 * useChat Hook
 * Handles financial query execution, streaming aborts, message conversation threads,
 * and session history management.
 */
export function useChat({ documents = [], selectedDocIds = [] } = {}) {
  const [question, setQuestion] = useState("");
  const [period, setPeriod] = useState("");
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState([]);
  const [history, setHistory] = useState([]);
  const [activeCitation, setActiveCitation] = useState(null);

  const abortControllerRef = useRef(null);

  const executeQuery = useCallback(
    async (queryText, queryPeriod) => {
      const q = (queryText || question).trim();
      if (!q) return;

      const tempId = `temp-${Date.now()}`;
      const optimisticUserMsg = {
        id: tempId,
        question: q,
        period: queryPeriod || period,
        isPending: true,
      };
      setMessages((prev) => [...prev, optimisticUserMsg]);
      setLoading(true);
      setQuestion("");

      abortControllerRef.current = new AbortController();

      try {
        // 1. Resolve company context dynamically from question or selected document
        let queryCompany = "All";
        let queryDocId = undefined;

        const qLower = q.toLowerCase();
        const mentionedCompanies = [];
        if (qLower.match(/\b(microsoft|msft|azure)\b/)) mentionedCompanies.push("Microsoft Corporation");
        if (qLower.match(/\b(amazon|amzn|aws)\b/)) mentionedCompanies.push("Amazon.com, Inc.");
        if (qLower.match(/\b(meta|reality labs|facebook)\b/)) mentionedCompanies.push("Meta Platforms, Inc.");
        if (qLower.match(/\b(apple|aapl|iphone|ipad|mac)\b/)) mentionedCompanies.push("Apple Inc.");

        if (mentionedCompanies.length === 1) {
          queryCompany = mentionedCompanies[0];
        } else if (selectedDocIds.length === 1) {
          const selectedDoc = documents.find((d) => d.document_id === selectedDocIds[0]);
          if (selectedDoc) {
            queryCompany = selectedDoc.company || "All";
            queryDocId = selectedDoc.document_id;
          }
        } else {
          queryCompany = "All";
        }

        const res = await fetch("/api/query", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Request-ID": `req_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          },
          body: JSON.stringify({
            question: q,
            company: queryCompany,
            document_id: queryDocId,
            reporting_periods: queryPeriod || period ? [queryPeriod || period] : undefined,
          }),
          signal: abortControllerRef.current.signal,
        });

        if (!res.ok) {
          const errJson = await res.json().catch(() => ({}));
          throw new Error(errJson.error || `Server responded with HTTP ${res.status}`);
        }

        const data = await res.json();

        const newTurn = {
          id: data.request_id || tempId,
          question: q,
          period: queryPeriod || period,
          ...data,
          isPending: false,
        };

        setMessages((prev) =>
          prev.map((m) => (m.id === tempId ? newTurn : m))
        );

        // Add to session history
        setHistory((prev) => [
          {
            question: q,
            period: queryPeriod || period,
            timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
            result: data,
          },
          ...prev.filter((h) => h.question !== q).slice(0, 9),
        ]);

        if (data.citations && data.citations.length > 0) {
          setActiveCitation(data.citations[0]);
        }

        return data;
      } catch (err) {
        if (err.name !== "AbortError") {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === tempId
                ? {
                    id: tempId,
                    question: q,
                    status: "error",
                    answer_text: `Error retrieving document answer: ${err.message}`,
                    isPending: false,
                  }
                : m
            )
          );
        } else {
          setMessages((prev) => prev.filter((m) => m.id !== tempId));
        }
      } finally {
        setLoading(false);
      }
    },
    [question, period, documents, selectedDocIds]
  );

  const clearSession = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setMessages([]);
    setQuestion("");
    setActiveCitation(null);
  }, []);

  const selectHistoryItem = useCallback((item) => {
    setMessages([
      {
        question: item.question,
        period: item.period,
        ...item.result,
      },
    ]);
    if (item.result?.citations && item.result.citations.length > 0) {
      setActiveCitation(item.result.citations[0]);
    }
  }, []);

  const exportMarkdown = useCallback((item) => {
    if (!item) return;

    const md = `# DocIntel Financial Analysis
**Generated:** ${new Date().toLocaleString()}
**Question:** ${item.question}
${item.period ? `**Reporting Period:** ${item.period}` : ""}
**Answer Status:** ${item.status || "verified"}

---

### Executive Answer
${item.answer_text || "No direct narrative answer returned."}

${
  item.calculation_steps && item.calculation_steps.length > 0
    ? `### Audited Calculation Ledger
${item.calculation_steps.map((s, idx) => `${idx + 1}. **${s.step_name}**: \`${s.formula}\` = ${s.result} (${s.source})`).join("\n")}`
    : ""
}

${
  item.citations && item.citations.length > 0
    ? `### Verified SEC 10-K Citations
${item.citations
  .map(
    (c, i) =>
      `[${i + 1}] ${c.company} • Page ${c.printed_page} (${c.section})\nQuote: "${c.exact_quote}"`
  )
  .join("\n\n")}`
    : ""
}
`;

    const blob = new Blob([md], { type: "text/markdown;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `DocIntel_Memo_${Date.now()}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }, []);

  return {
    question,
    setQuestion,
    period,
    setPeriod,
    loading,
    messages,
    setMessages,
    history,
    setHistory,
    activeCitation,
    setActiveCitation,
    executeQuery,
    clearSession,
    selectHistoryItem,
    exportMarkdown,
  };
}

