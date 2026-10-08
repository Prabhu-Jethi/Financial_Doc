"use client";

import { useState, useEffect, useRef } from "react";
import Sidebar from "../components/Sidebar";
import MessageThread from "../components/MessageThread";
import ChatInput from "../components/ChatInput";
import InspectorDrawer from "../components/InspectorDrawer";
import UploadModal from "../components/UploadModal";

export default function Home() {
  const [question, setQuestion] = useState("");
  const [period, setPeriod] = useState("");
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState([]);
  const [history, setHistory] = useState([]);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [uploadModalOpen, setUploadModalOpen] = useState(false);

  // Active Inspector Target
  const [activeCitation, setActiveCitation] = useState(null);
  const [activeDocument, setActiveDocument] = useState(null);

  // Documents
  const [documents, setDocuments] = useState([]);
  const [selectedDocIds, setSelectedDocIds] = useState(["AAPL-10K-2024"]);
  const [health, setHealth] = useState({ active_engine: "sec_10k_index" });

  const abortControllerRef = useRef(null);
  const scrollRef = useRef(null);

  useEffect(() => {
    fetchHealth();
    fetchDocuments();
  }, []);

  const fetchHealth = async () => {
    try {
      const res = await fetch("/api/health");
      if (res.ok) {
        const data = await res.json();
        setHealth(data);
      }
    } catch (e) {
      // quiet fallback
    }
  };

  const fetchDocuments = async () => {
    try {
      const res = await fetch("/api/documents");
      if (res.ok) {
        const data = await res.json();
        if (data.documents) {
          setDocuments(data.documents);
          if (data.documents.length > 0) {
            setSelectedDocIds([data.documents[0].document_id]);
          }
        }
      }
    } catch (e) {
      // quiet fallback
    }
  };

  const handleDocumentUploaded = (newDoc) => {
    setDocuments((prev) => [newDoc, ...prev]);
    setSelectedDocIds((prev) => [newDoc.document_id, ...prev]);
  };

  const handleToggleDocSelection = (docId) => {
    setSelectedDocIds((prev) =>
      prev.includes(docId) ? prev.filter((id) => id !== docId) : [...prev, docId]
    );
  };

  const handleExecuteQuery = async (queryText, queryPeriod) => {
    const q = (queryText || question).trim();
    if (!q) return;

    setLoading(true);
    setQuestion("");

    abortControllerRef.current = new AbortController();

    try {
      const res = await fetch("/api/query", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Request-ID": `req_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        },
        body: JSON.stringify({
          question: q,
          company: "Apple Inc.",
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
        question: q,
        period: queryPeriod || period,
        ...data,
      };

      setMessages((prev) => [...prev, newTurn]);

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

      // If response includes citations, set active in inspector
      if (data.citations && data.citations.length > 0) {
        setActiveCitation(data.citations[0]);
      }

      // Scroll to bottom
      setTimeout(() => {
        if (scrollRef.current) {
          scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
      }, 100);
    } catch (err) {
      if (err.name === "AbortError") {
        // Cancelled
      } else {
        setMessages((prev) => [
          ...prev,
          {
            question: q,
            status: "error",
            answer_text: `Error retrieving document answer: ${err.message}`,
          },
        ]);
      }
    } finally {
      setLoading(false);
      abortControllerRef.current = null;
    }
  };

  const handleInspectCitation = (cite) => {
    setActiveCitation(cite);
    setActiveDocument(null);
    setInspectorOpen(true);
  };

  const handleSelectHistory = (hItem) => {
    if (hItem.result) {
      setMessages((prev) => [
        ...prev,
        {
          question: hItem.question,
          period: hItem.period,
          ...hItem.result,
        },
      ]);
    } else {
      handleExecuteQuery(hItem.question, hItem.period);
    }
  };

  const handleNewSession = () => {
    setMessages([]);
    setQuestion("");
    setActiveCitation(null);
  };

  const handleExportMemo = (item) => {
    const md = `# SEC 10-K Document Analysis Memo
**Query:** ${item.question}
**Period:** ${item.reporting_periods?.join(", ") || "FY2024"}
**Status:** ${item.status}
**Generated:** ${new Date().toUTCString()}

---

## Response
${item.answer_text}

${
  item.calculations && item.calculations.length > 0
    ? `## Calculations
${item.calculations
  .map(
    (c) =>
      `### Formula: ${c.formula}
${c.operands.map((op) => `- ${op.name}: ${op.raw_value} (Page ${op.printed_page})`).join("\n")}
**Result:** = ${c.display_value} ${c.unit}`
  )
  .join("\n\n")}`
    : ""
}

${
  item.citations && item.citations.length > 0
    ? `## Citations
${item.citations
  .map(
    (c, i) =>
      `[${i + 1}] ${c.company} • Page ${c.printed_page} (${c.section})
Quote: "${c.exact_quote}"`
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
  };

  const activeDocCount = selectedDocIds.length;
  const activeDocSummary =
    activeDocCount === 1
      ? documents.find((d) => d.document_id === selectedDocIds[0])?.report_fiscal_year
        ? `Apple FY${documents.find((d) => d.document_id === selectedDocIds[0])?.report_fiscal_year} Form 10-K (with FY23 & FY22 comparatives)`
        : "Apple FY2024 Form 10-K"
      : `${activeDocCount} Documents Active`;

  return (
    <div className="webapp-root">
      {/* Left Sidebar */}
      <Sidebar
        isOpen={sidebarOpen}
        documents={documents}
        selectedDocIds={selectedDocIds}
        onToggleDocSelection={handleToggleDocSelection}
        onOpenUpload={() => setUploadModalOpen(true)}
        history={history}
        onSelectHistory={handleSelectHistory}
        onNewSession={handleNewSession}
        activeEngine={health.active_engine}
      />

      {/* Main Chat & Query Stage */}
      <main className="webapp-main">
        {/* Top App Bar */}
        <header className="main-top-bar">
          <div className="top-bar-left">
            <button
              type="button"
              className="btn-sidebar-toggle"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              title="Toggle sidebar"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </svg>
            </button>

            <div className="scope-badge">
              <span>Source Scope:</span>
              <strong>{activeDocSummary}</strong>
            </div>
          </div>

          <div className="top-bar-right">
            {messages.length > 0 && (
              <button
                type="button"
                className="btn-top-action"
                onClick={handleNewSession}
                title="Clear current analysis thread"
              >
                Clear Thread
              </button>
            )}

            <button
              type="button"
              className={`btn-top-action ${inspectorOpen ? "active" : ""}`}
              onClick={() => setInspectorOpen(!inspectorOpen)}
              title="Toggle Chunk Inspector drawer"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <line x1="15" y1="3" x2="15" y2="21" />
              </svg>
              <span>Chunk Inspector</span>
            </button>
          </div>
        </header>

        {/* Conversation Stream */}
        <div ref={scrollRef} className="conversation-scroll">
          <MessageThread
            messages={messages}
            loading={loading}
            onSelectPrompt={(pQ, pP) => handleExecuteQuery(pQ, pP)}
            onInspectCitation={handleInspectCitation}
            onExportMemo={handleExportMemo}
          />
        </div>

        {/* Floating Chat Input Dock */}
        <ChatInput
          question={question}
          setQuestion={setQuestion}
          period={period}
          setPeriod={setPeriod}
          loading={loading}
          onSubmit={() => handleExecuteQuery(question, period)}
          onOpenUpload={() => setUploadModalOpen(true)}
        />
      </main>

      {/* Right Inspector Drawer */}
      <InspectorDrawer
        isOpen={inspectorOpen}
        onClose={() => setInspectorOpen(false)}
        activeCitation={activeCitation}
        activeDocument={activeDocument}
      />

      {/* Upload Document Modal */}
      <UploadModal
        isOpen={uploadModalOpen}
        onClose={() => setUploadModalOpen(false)}
        onDocumentUploaded={handleDocumentUploaded}
      />
    </div>
  );
}
