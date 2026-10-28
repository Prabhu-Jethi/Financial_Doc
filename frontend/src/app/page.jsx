"use client";

import { useState, useEffect, useRef } from "react";
import Sidebar from "../components/workspace/Sidebar";
import MessageThread from "../components/workspace/MessageThread";
import ChatInput from "../components/workspace/ChatInput";
import InspectorDrawer from "../components/workspace/InspectorDrawer";
import UploadModal from "../components/modals/UploadModal";
import PdfViewerModal from "../components/modals/PdfViewerModal";
import CompareMatrixModal from "../components/modals/CompareMatrixModal";
import { createClient } from "../lib/supabase/browser";

export default function Home() {
  const [question, setQuestion] = useState("");
  const [period, setPeriod] = useState("");
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState([]);
  const [history, setHistory] = useState([]);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [uploadModalOpen, setUploadModalOpen] = useState(false);

  // Authenticated Supabase User
  const [currentUser, setCurrentUser] = useState(null);

  // Active Inspector Target
  const [activeCitation, setActiveCitation] = useState(null);
  const [activeDocument, setActiveDocument] = useState(null);

  // PDF Viewer Modal State
  const [pdfModalOpen, setPdfModalOpen] = useState(false);
  const [pdfTargetCitation, setPdfTargetCitation] = useState(null);
  const [pdfTargetDoc, setPdfTargetDoc] = useState(null);

  // Multi-Company Benchmark Matrix Modal State
  const [compareModalOpen, setCompareModalOpen] = useState(false);

  // Documents
  const [documents, setDocuments] = useState([]);
  const [selectedDocIds, setSelectedDocIds] = useState([]);
  const [health, setHealth] = useState({ active_engine: "sec_10k_index" });

  // Theme State (Dark / Light)
  const [theme, setTheme] = useState("light");

  const abortControllerRef = useRef(null);
  const scrollRef = useRef(null);

  useEffect(() => {
    fetchHealth();
    fetchDocuments();

    // 1. Initialize and monitor Supabase user session
    try {
      const supabase = createClient();
      supabase.auth.getUser().then(({ data }) => {
        if (data?.user) {
          setCurrentUser(data.user);
        }
      });

      const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
        setCurrentUser(session?.user || null);
        if (event === "SIGNED_OUT") {
          window.location.href = "/login";
        }
      });

      // Cleanup subscription
      return () => {
        authListener?.subscription?.unsubscribe();
      };
    } catch (e) {
      // quiet fallback in local testing
    }

    // 2. Theme initialization
    try {
      const savedTheme = localStorage.getItem("docintel_theme");
      if (savedTheme === "dark" || savedTheme === "light") {
        setTheme(savedTheme);
        document.documentElement.setAttribute("data-theme", savedTheme);
      } else if (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches) {
        setTheme("dark");
        document.documentElement.setAttribute("data-theme", "dark");
      }
    } catch (e) {
      // quiet fallback
    }
  }, []);

  const handleSignOut = async () => {
    try {
      const supabase = createClient();
      await supabase.auth.signOut();
    } catch (e) {
      // quiet fallback
    }
    window.location.href = "/login";
  };

  const toggleTheme = () => {
    const nextTheme = theme === "dark" ? "light" : "dark";
    setTheme(nextTheme);
    document.documentElement.setAttribute("data-theme", nextTheme);
    try {
      localStorage.setItem("docintel_theme", nextTheme);
    } catch (e) {
      // quiet fallback
    }
  };

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
            setSelectedDocIds(data.documents.map((d) => d.document_id));
          }
        }
      }
    } catch (e) {
      // quiet fallback
    }
  };

  const handleDocumentUploaded = (newDoc) => {
    setDocuments((prev) => [newDoc, ...prev.filter((d) => d.document_id !== newDoc.document_id)]);
    setSelectedDocIds([newDoc.document_id]);
    fetchDocuments();
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
      // 1. Resolve company context dynamically from question or selected document
      let queryCompany = "All";
      let queryDocId = undefined;

      const qLower = q.toLowerCase();
      if (qLower.includes("microsoft") || qLower.includes("msft")) {
        queryCompany = "Microsoft Corporation";
      } else if (qLower.includes("amazon") || qLower.includes("amzn") || qLower.includes("aws")) {
        queryCompany = "Amazon.com, Inc.";
      } else if (qLower.includes("meta") || qLower.includes("reality labs")) {
        queryCompany = "Meta Platforms, Inc.";
      } else if (qLower.includes("apple") || qLower.includes("iphone") || qLower.includes("ipad") || qLower.includes("mac")) {
        queryCompany = "Apple Inc.";
      } else if (selectedDocIds.length === 1) {
        const selectedDoc = documents.find((d) => d.document_id === selectedDocIds[0]);
        if (selectedDoc) {
          queryCompany = selectedDoc.company || "All";
          queryDocId = selectedDoc.document_id;
        }
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
    setPdfTargetCitation(cite);
    setPdfTargetDoc(null);
    setPdfModalOpen(true);
    setInspectorOpen(true);
  };

  const handlePreviewDocument = (doc) => {
    setPdfTargetDoc(doc);
    setPdfTargetCitation(null);
    setPdfModalOpen(true);
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
  const singleDoc = activeDocCount === 1 ? documents.find((d) => d.document_id === selectedDocIds[0]) : null;
  const activeDocSummary = singleDoc
    ? `${singleDoc.company || "Company"} FY${singleDoc.report_fiscal_year || ""} ${singleDoc.report_type || "10-K"}`
    : activeDocCount > 1
    ? `${activeDocCount} Filings Active (Multi-Company Corpus)`
    : "All Corporate Filings Active";

  return (
    <div className="webapp-root">
      {/* Left Sidebar */}
      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        documents={documents}
        selectedDocIds={selectedDocIds}
        onToggleDocSelection={handleToggleDocSelection}
        onOpenUpload={() => setUploadModalOpen(true)}
        onPreviewDocument={handlePreviewDocument}
        onOpenCompare={() => setCompareModalOpen(true)}
        currentUser={currentUser}
        onSignOut={handleSignOut}
        history={history}
        onSelectHistory={handleSelectHistory}
        onNewSession={handleNewSession}
        activeEngine={health.active_engine}
        theme={theme}
        onToggleTheme={toggleTheme}
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
              title={sidebarOpen ? "Collapse sidebar" : "Open sidebar"}
              aria-label="Toggle sidebar"
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
            {/* Multi-Company Comparison Matrix Button */}
            <button
              type="button"
              className="btn-top-action btn-compare-highlight"
              onClick={() => setCompareModalOpen(true)}
              title="Compare 4-Company Benchmark Matrix (AAPL, MSFT, AMZN, META)"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 20V10" />
                <path d="M12 20V4" />
                <path d="M6 20v-6" />
              </svg>
              <span>Compare Matrix</span>
            </button>

            {/* Theme Light/Dark Toggler Button */}
            <button
              type="button"
              className="btn-theme-toggle"
              onClick={toggleTheme}
              title={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
              aria-label="Toggle color theme"
            >
              {theme === "dark" ? (
                <>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="5" />
                    <line x1="12" y1="1" x2="12" y2="3" />
                    <line x1="12" y1="21" x2="12" y2="23" />
                    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                    <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                    <line x1="1" y1="12" x2="3" y2="12" />
                    <line x1="21" y1="12" x2="23" y2="12" />
                    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
                    <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
                  </svg>
                  <span>Light</span>
                </>
              ) : (
                <>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                  </svg>
                  <span>Dark</span>
                </>
              )}
            </button>

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

            {/* Authenticated User Profile Pill */}
            {currentUser ? (
              <div className="top-bar-user-badge" title={`Signed in as ${currentUser.email}`}>
                <div className="user-avatar-circle mini">
                  {currentUser.user_metadata?.avatar_url ? (
                    <img
                      src={currentUser.user_metadata.avatar_url}
                      alt="User"
                      className="user-avatar-img"
                    />
                  ) : (
                    <span>
                      {currentUser.user_metadata?.full_name
                        ? currentUser.user_metadata.full_name
                            .split(/\s+/)
                            .map((n) => n[0])
                            .slice(0, 2)
                            .join("")
                            .toUpperCase()
                        : (currentUser.email || "U")[0].toUpperCase()}
                    </span>
                  )}
                </div>
                <span className="user-email-label">
                  {currentUser.user_metadata?.full_name || currentUser.email?.split("@")[0]}
                </span>
                <button
                  type="button"
                  className="btn-top-signout"
                  onClick={handleSignOut}
                  title="Sign out of your account"
                >
                  Sign Out
                </button>
              </div>
            ) : (
              <a
                href="/login"
                className="btn-top-action btn-top-login"
                title="Sign in with Google"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
                  <polyline points="10 17 15 12 10 7" />
                  <line x1="15" y1="12" x2="3" y2="12" />
                </svg>
                <span>Sign In</span>
              </a>
            )}
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
          activeDocSummary={activeDocSummary}
        />
      </main>

      {/* Right Inspector Drawer */}
      <InspectorDrawer
        isOpen={inspectorOpen}
        onClose={() => setInspectorOpen(false)}
        activeCitation={activeCitation}
        activeDocument={activeDocument}
        onOpenPdfModal={(target) => {
          if (target?.exact_quote || target?.printed_page) {
            setPdfTargetCitation(target);
            setPdfTargetDoc(null);
          } else {
            setPdfTargetDoc(target);
            setPdfTargetCitation(null);
          }
          setPdfModalOpen(true);
        }}
      />

      {/* Upload Document Modal */}
      <UploadModal
        isOpen={uploadModalOpen}
        onClose={() => setUploadModalOpen(false)}
        onDocumentUploaded={handleDocumentUploaded}
      />

      {/* Interactive PDF Provenance Viewer Modal */}
      <PdfViewerModal
        isOpen={pdfModalOpen}
        onClose={() => setPdfModalOpen(false)}
        citation={pdfTargetCitation}
        document={pdfTargetDoc}
      />

      {/* Multi-Company Comparison Benchmark Matrix Modal */}
      <CompareMatrixModal
        isOpen={compareModalOpen}
        onClose={() => setCompareModalOpen(false)}
        onSelectPrompt={(p) => handleExecuteQuery(p)}
      />
    </div>
  );
}
