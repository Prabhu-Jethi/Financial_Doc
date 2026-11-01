"use client";

import { useState, useEffect, useRef } from "react";
import Sidebar from "../components/workspace/Sidebar";
import MessageThread from "../components/workspace/MessageThread";
import ChatInput from "../components/workspace/ChatInput";
import InspectorDrawer from "../components/workspace/InspectorDrawer";
import UploadModal from "../components/modals/UploadModal";
import PdfViewerModal from "../components/modals/PdfViewerModal";
import CompareMatrixModal from "../components/modals/CompareMatrixModal";
import ProfileModal from "../components/modals/ProfileModal";
import SettingsModal from "../components/modals/SettingsModal";
import AuditGuideModal from "../components/modals/AuditGuideModal";
import { createClient } from "../lib/supabase/browser";

export default function Home() {
  const [question, setQuestion] = useState("");
  const [period, setPeriod] = useState("");
  const [loading, setLoading] = useState(false);
  // Instant hydration from localStorage on initial render
  const [messages, setMessages] = useState(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("docintel_active_messages");
        if (saved) return JSON.parse(saved);
      } catch (e) {}
    }
    return [];
  });
  const [history, setHistory] = useState(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("docintel_recent_analyses");
        if (saved) return JSON.parse(saved);
      } catch (e) {}
    }
    return [];
  });
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [inspectorOpen, setInspectorOpen] = useState(false);

  // Exclusive Active Feature Modal: exactly one can be opened at once
  // null | "upload" | "pdf" | "compare" | "profile" | "settings" | "guide"
  const [activeModal, setActiveModal] = useState(null);

  // Authenticated Supabase User
  const [currentUser, setCurrentUser] = useState(null);

  // Active Inspector Target
  const [activeCitation, setActiveCitation] = useState(null);
  const [activeDocument, setActiveDocument] = useState(null);

  // Target Citation/Document for PDF Viewer Modal
  const [pdfTargetCitation, setPdfTargetCitation] = useState(null);
  const [pdfTargetDoc, setPdfTargetDoc] = useState(null);

  // Documents
  const [documents, setDocuments] = useState(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("docintel_custom_documents");
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        }
      } catch (e) {}
    }
    return [];
  });
  const [selectedDocIds, setSelectedDocIds] = useState([]);
  const [health, setHealth] = useState({ active_engine: "sec_10k_index" });

  // Theme State (Dark / Light)
  const [theme, setTheme] = useState(() => {
    if (typeof window !== "undefined") {
      try {
        const savedTheme = localStorage.getItem("docintel_theme");
        if (savedTheme === "dark" || savedTheme === "light") return savedTheme;
      } catch (e) {}
    }
    return "light";
  });

  // Application & Search Settings (Persisted to localStorage)
  const [appSettings, setAppSettings] = useState(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("docintel_settings");
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed && typeof parsed === "object") return parsed;
        }
      } catch (e) {}
    }
    return {
      retrievalMode: "hybrid",
      topK: 7,
      showCitationScore: true,
    };
  });

  const openModal = (modalName) => {
    setActiveModal(modalName);
  };

  const closeModal = () => {
    setActiveModal(null);
  };

  const abortControllerRef = useRef(null);
  const scrollRef = useRef(null);

  useEffect(() => {
    fetchHealth();
    fetchDocuments();
    fetchUserHistory();

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

    // Hydrate locally saved uploaded documents immediately
    try {
      const savedDocs = localStorage.getItem("docintel_custom_documents");
      if (savedDocs) {
        const parsedDocs = JSON.parse(savedDocs);
        if (Array.isArray(parsedDocs) && parsedDocs.length > 0) {
          setDocuments((prev) => {
            const existingIds = new Set(prev.map((d) => d.document_id));
            const unique = parsedDocs.filter((d) => !existingIds.has(d.document_id));
            return [...unique, ...prev];
          });
        }
      }
    } catch (e) {}

    // 3. Responsive initial state: auto-collapse sidebar on smaller screens (<900px)
    if (typeof window !== "undefined" && window.innerWidth < 900) {
      setSidebarOpen(false);
    }

    // 4. Restore persisted conversation history, active thread, and settings from localStorage
    try {
      const savedHistory = localStorage.getItem("docintel_recent_analyses");
      if (savedHistory) {
        const parsed = JSON.parse(savedHistory);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setHistory(parsed);
        }
      }

      const savedMessages = localStorage.getItem("docintel_active_messages");
      if (savedMessages) {
        const parsedMsgs = JSON.parse(savedMessages);
        if (Array.isArray(parsedMsgs) && parsedMsgs.length > 0) {
          setMessages(parsedMsgs);
        }
      }

      const savedSettings = localStorage.getItem("docintel_settings");
      if (savedSettings) {
        const parsedSettings = JSON.parse(savedSettings);
        setAppSettings((prev) => ({ ...prev, ...parsedSettings }));
      }
    } catch (e) {
      console.warn("[Storage] Error restoring persisted state", e);
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

  const fetchUserHistory = async () => {
    try {
      let fetchedHistory = [];
      try {
        const res = await fetch("/api/history");
        if (res.ok) {
          const data = await res.json();
          if (data.history && Array.isArray(data.history) && data.history.length > 0) {
            fetchedHistory = data.history;
          }
        }
      } catch (err) {}

      // Direct client-side Supabase query fallback for authenticated users
      if (fetchedHistory.length === 0) {
        try {
          const supabase = createClient();
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            const { data: dbHistory, error } = await supabase
              .from("user_query_history")
              .select("id, question, company, reporting_periods, answer_text, citations, calculations, timings_ms, created_at")
              .eq("user_id", user.id)
              .order("created_at", { ascending: false })
              .limit(50);

            if (!error && Array.isArray(dbHistory) && dbHistory.length > 0) {
              fetchedHistory = dbHistory.map((row) => ({
                history_id: row.id,
                question: row.question,
                company: row.company,
                period: row.reporting_periods?.[0] || "",
                reporting_periods: row.reporting_periods || [],
                timestamp: new Date(row.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
                result: {
                  question: row.question,
                  company: row.company,
                  reporting_periods: row.reporting_periods,
                  answer_text: row.answer_text,
                  citations: row.citations || [],
                  facts: [],
                  calculations: row.calculations || [],
                  timings_ms: row.timings_ms || {},
                  status: "answered",
                },
              }));
            }
          }
        } catch (authErr) {}
      }

      if (fetchedHistory.length > 0) {
        setHistory(fetchedHistory);
        try {
          localStorage.setItem("docintel_recent_analyses", JSON.stringify(fetchedHistory));
        } catch (e) {}
      }
    } catch (e) {
      // quiet fallback
    }
  };

  const fetchDocuments = async () => {
    try {
      let serverDocs = [];
      try {
        const res = await fetch("/api/documents");
        if (res.ok) {
          const data = await res.json();
          if (data.documents && Array.isArray(data.documents)) {
            serverDocs = data.documents;
          }
        }
      } catch (e) {}

      // Resilient client-side query to guarantee custom uploaded documents always appear
      try {
        const supabase = createClient();
        const { data: dbDocs, error } = await supabase
          .from("documents")
          .select("document_id, company, ticker, report_type, report_fiscal_year, period_ended, filing_date, source_url, file_name, status, created_at, user_id")
          .order("created_at", { ascending: false });

        if (!error && Array.isArray(dbDocs) && dbDocs.length > 0) {
          const existingIds = new Set(serverDocs.map((d) => d.document_id));
          const newFromDb = dbDocs.filter((d) => !existingIds.has(d.document_id));
          serverDocs = [...serverDocs, ...newFromDb];
        }
      } catch (dbErr) {}

      // Merge with locally saved custom documents so nothing vanishes during network delay
      let localCustom = [];
      try {
        localCustom = JSON.parse(localStorage.getItem("docintel_custom_documents") || "[]");
      } catch (e) {}

      const allServerIds = new Set(serverDocs.map((d) => d.document_id));
      const fullList = [
        ...localCustom.filter((cd) => !allServerIds.has(cd.document_id)),
        ...serverDocs,
      ];

      if (fullList.length > 0) {
        setDocuments(fullList);

        // Keep localStorage updated with custom docs
        const customDocs = fullList.filter(
          (d) => d.report_type === "general" || d.ticker === "DOC" || d.isCustom || d.document_id?.startsWith("doc_")
        );
        if (customDocs.length > 0) {
          try {
            localStorage.setItem("docintel_custom_documents", JSON.stringify(customDocs));
          } catch (e) {}
        }
      }
    } catch (e) {
      // quiet fallback
    }
  };

  const handleDocumentUploaded = (newDoc) => {
    // Persist custom document in localStorage immediately so it never vanishes
    try {
      const existing = JSON.parse(localStorage.getItem("docintel_custom_documents") || "[]");
      const filtered = existing.filter((d) => d.document_id !== newDoc.document_id);
      const updated = [newDoc, ...filtered];
      localStorage.setItem("docintel_custom_documents", JSON.stringify(updated));
    } catch (e) {}

    setDocuments((prev) => [newDoc, ...prev.filter((d) => d.document_id !== newDoc.document_id)]);
    setSelectedDocIds([newDoc.document_id]);
    fetchDocuments();
  };

  const handleToggleDocSelection = (docId) => {
    setSelectedDocIds((prev) =>
      prev.includes(docId) ? prev.filter((id) => id !== docId) : [...prev, docId]
    );
  };

  const handleSelectDocs = (ids) => {
    setSelectedDocIds((prev) => Array.from(new Set([...prev, ...ids])));
  };

  const handleDeselectDocs = (ids) => {
    setSelectedDocIds((prev) => prev.filter((id) => !ids.includes(id)));
  };

  const handleExecuteQuery = async (queryText, queryPeriod) => {
    const q = (queryText || question).trim();
    if (!q) return;

    // Auto-dismiss sidebar on small screens when query executes
    if (typeof window !== "undefined" && window.innerWidth < 900) {
      setSidebarOpen(false);
    }

    setLoading(true);
    setQuestion("");

    abortControllerRef.current = new AbortController();

    try {
      // 1. Resolve document scoping and company context
      let queryCompany = undefined;
      let queryDocId = undefined;
      let queryDocIds = undefined;

      const qLower = q.toLowerCase();
      if (selectedDocIds.length > 0) {
        // User has explicitly checked one or more documents in the sidebar: STRICT SCOPE
        queryDocIds = [...selectedDocIds];
        queryDocId = selectedDocIds[0];

        const selectedDocs = documents.filter((d) => selectedDocIds.includes(d.document_id));
        const companies = [...new Set(selectedDocs.map((d) => d.company).filter(Boolean))];
        if (companies.length === 1 && !["General", "General Document", "Uploaded Document"].includes(companies[0])) {
          queryCompany = companies[0];
        } else {
          queryCompany = "All";
        }
      } else {
        // No documents explicitly checked in sidebar: infer target company from keywords across the full corpus
        if (qLower.includes("microsoft") || qLower.includes("msft")) {
          queryCompany = "Microsoft Corporation";
        } else if (qLower.includes("amazon") || qLower.includes("amzn") || qLower.includes("aws")) {
          queryCompany = "Amazon.com, Inc.";
        } else if (qLower.includes("meta") || qLower.includes("reality labs")) {
          queryCompany = "Meta Platforms, Inc.";
        } else if (qLower.includes("apple") || qLower.includes("iphone") || qLower.includes("ipad") || qLower.includes("mac")) {
          queryCompany = "Apple Inc.";
        } else {
          queryCompany = "All";
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
          company: queryCompany || "All",
          document_id: queryDocId,
          document_ids: queryDocIds,
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

      setMessages((prev) => {
        const updated = [...prev, newTurn];
        try {
          localStorage.setItem("docintel_active_messages", JSON.stringify(updated.slice(-25)));
        } catch (e) {}
        return updated;
      });

      // Add to session history (persisted locally and synced to user account)
      const newHistoryItem = {
        question: q,
        period: queryPeriod || period,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        result: data,
      };

      setHistory((prev) => {
        const updated = [
          newHistoryItem,
          ...prev.filter((h) => h.question !== q).slice(0, 49),
        ];
        try {
          localStorage.setItem("docintel_recent_analyses", JSON.stringify(updated));
        } catch (e) {}
        return updated;
      });

      // Persist permanently in user's cloud account forever (ChatGPT-style)
      try {
        fetch("/api/history", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            question: q,
            company: queryCompany || "All",
            reporting_periods: queryPeriod || period ? [queryPeriod || period] : [],
            answer_text: data.answer_text,
            citations: data.citations || [],
            calculations: data.calculations || [],
            timings_ms: data.timings_ms || {},
          }),
        })
          .then((r) => r.json())
          .then((saved) => {
            if (saved?.item?.id) {
              setHistory((current) =>
                current.map((item) =>
                  item.question === q ? { ...item, history_id: saved.item.id } : item
                )
              );
            }
          })
          .catch(() => {});

        // Direct browser client fallback to Supabase table
        if (currentUser?.id) {
          const supabase = createClient();
          supabase
            .from("user_query_history")
            .insert([
              {
                user_id: currentUser.id,
                question: q,
                company: queryCompany || "All",
                reporting_periods: queryPeriod || period ? [queryPeriod || period] : [],
                answer_text: data.answer_text,
                citations: data.citations || [],
                calculations: data.calculations || [],
                timings_ms: data.timings_ms || {},
              },
            ])
            .then(() => {})
            .catch(() => {});
        }
      } catch (e) {}

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
    openModal("pdf");
    setInspectorOpen(true);
  };

  const handlePreviewDocument = (doc) => {
    setPdfTargetDoc(doc);
    setPdfTargetCitation(null);
    openModal("pdf");
  };

  const handleSelectHistory = (hItem) => {
    // Auto-dismiss sidebar on small screens when history is picked
    if (typeof window !== "undefined" && window.innerWidth < 900) {
      setSidebarOpen(false);
    }

    if (hItem.result) {
      const restored = [
        {
          question: hItem.question,
          period: hItem.period,
          ...hItem.result,
        },
      ];
      setMessages(restored);
      try {
        localStorage.setItem("docintel_active_messages", JSON.stringify(restored));
      } catch (e) {}
    } else {
      handleExecuteQuery(hItem.question, hItem.period);
    }
  };

  const handleNewSession = () => {
    setMessages([]);
    setQuestion("");
    setActiveCitation(null);
    try {
      localStorage.removeItem("docintel_active_messages");
    } catch (e) {}
  };

  const handleDeleteHistoryItem = async (indexToDelete) => {
    const itemToDelete = history[indexToDelete];
    setHistory((prev) => {
      const updated = prev.filter((_, idx) => idx !== indexToDelete);
      try {
        localStorage.setItem("docintel_recent_analyses", JSON.stringify(updated));
      } catch (e) {}
      return updated;
    });

    if (itemToDelete?.history_id) {
      try {
        await fetch(`/api/history?id=${encodeURIComponent(itemToDelete.history_id)}`, {
          method: "DELETE",
        });
      } catch (e) {}
    }
  };

  const handleClearAllHistory = async () => {
    setHistory([]);
    try {
      localStorage.removeItem("docintel_recent_analyses");
    } catch (e) {}
    try {
      await fetch("/api/history", { method: "DELETE" });
    } catch (e) {}
  };

  const handleSaveSettings = (newSettings) => {
    setAppSettings((prev) => {
      const updated = { ...prev, ...newSettings };
      try {
        localStorage.setItem("docintel_settings", JSON.stringify(updated));
      } catch (e) {}
      return updated;
    });
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
        onSelectDocs={handleSelectDocs}
        onDeselectDocs={handleDeselectDocs}
        onOpenUpload={() => openModal("upload")}
        onPreviewDocument={handlePreviewDocument}
        onOpenCompare={() => openModal("compare")}
        currentUser={currentUser}
        onSignOut={handleSignOut}
        history={history}
        onSelectHistory={handleSelectHistory}
        onDeleteHistoryItem={handleDeleteHistoryItem}
        onClearHistory={handleClearAllHistory}
        onNewSession={handleNewSession}
        activeEngine={health.active_engine}
        theme={theme}
        onToggleTheme={toggleTheme}
        onOpenProfile={() => openModal("profile")}
        onOpenSettings={() => openModal("settings")}
        onOpenHelp={() => openModal("guide")}
      />

      {/* Mobile Sidebar Dimming Backdrop */}
      {sidebarOpen && (
        <div
          className="sidebar-mobile-backdrop"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

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
              onClick={() => openModal("compare")}
              title="Compare 4-Company Benchmark Matrix (AAPL, MSFT, AMZN, META)"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 20V10" />
                <path d="M12 20V4" />
                <path d="M6 20v-6" />
              </svg>
              <span>Compare Matrix</span>
            </button>

            {messages.length > 0 && (
              <button
                type="button"
                className="btn-top-action"
                onClick={handleNewSession}
                title="Clear current analysis thread"
                aria-label="Clear Thread"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M3 6h18" />
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                </svg>
                <span>Clear Thread</span>
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
          onOpenUpload={() => openModal("upload")}
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
          openModal("pdf");
        }}
      />

      {/* Mobile Inspector Drawer Dimming Backdrop */}
      {inspectorOpen && (
        <div
          className="inspector-mobile-backdrop"
          onClick={() => setInspectorOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* =========================================================================
          EXCLUSIVE MODAL PORTALS (Only one feature can be opened at once)
         ========================================================================= */}
      {/* 1. Upload Document Modal */}
      {activeModal === "upload" && (
        <UploadModal
          isOpen={true}
          onClose={closeModal}
          onDocumentUploaded={handleDocumentUploaded}
        />
      )}

      {/* 2. Interactive PDF Provenance Viewer Modal */}
      {activeModal === "pdf" && (
        <PdfViewerModal
          isOpen={true}
          onClose={closeModal}
          citation={pdfTargetCitation}
          document={pdfTargetDoc}
        />
      )}

      {/* 3. Multi-Company Comparison Benchmark Matrix Modal */}
      {activeModal === "compare" && (
        <CompareMatrixModal
          isOpen={true}
          onClose={closeModal}
          onSelectPrompt={(p) => {
            closeModal();
            handleExecuteQuery(p);
          }}
        />
      )}

      {/* 4. User Profile Modal */}
      {activeModal === "profile" && (
        <ProfileModal
          isOpen={true}
          onClose={closeModal}
          currentUser={currentUser}
        />
      )}

      {/* 5. User & Application Settings Modal */}
      {activeModal === "settings" && (
        <SettingsModal
          isOpen={true}
          onClose={closeModal}
          theme={theme}
          onToggleTheme={toggleTheme}
          activeEngine={health.active_engine}
          onClearThread={handleNewSession}
          settings={appSettings}
          onSaveSettings={handleSaveSettings}
        />
      )}

      {/* 6. Help & Audit Integrity Guide Modal */}
      {activeModal === "guide" && (
        <AuditGuideModal
          isOpen={true}
          onClose={closeModal}
        />
      )}
    </div>
  );
}
