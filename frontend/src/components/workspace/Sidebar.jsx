"use client";

import { useState, useRef, useEffect } from "react";

export default function Sidebar({
  isOpen,
  onClose,
  documents = [],
  selectedDocIds = [],
  onToggleDocSelection,
  onSelectDocs,
  onDeselectDocs,
  onOpenUpload,
  onPreviewDocument,
  history = [],
  onSelectHistory,
  onNewSession,
  onOpenCompare,
  currentUser = null,
  onSignOut,
  activeEngine,
  theme = "light",
  onToggleTheme,
  onOpenProfile,
  onOpenSettings,
  onOpenHelp,
}) {
  const [secExpanded, setSecExpanded] = useState(true);
  const [uploadedExpanded, setUploadedExpanded] = useState(true);
  const [activeCompanyFilter, setActiveCompanyFilter] = useState("All");
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef(null);

  const companies = ["All", "AAPL", "AMZN", "MSFT", "META"];

  // Click-outside listener for the ChatGPT-style bottom user popover
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target)) {
        setUserMenuOpen(false);
      }
    };
    if (userMenuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [userMenuOpen]);

  const handleAutoCloseMobile = () => {
    if (typeof window !== "undefined" && window.innerWidth < 900 && onClose) {
      onClose();
    }
  };

  // Separate SEC 10-K Filings from User-Uploaded General Documents
  const secDocs = documents.filter(
    (d) =>
      (d.report_type === "10-K" || (d.ticker && ["AAPL", "AMZN", "MSFT", "META"].includes(d.ticker))) &&
      !d.isCustom &&
      d.report_type !== "general"
  );

  const uploadedDocs = documents.filter(
    (d) =>
      d.report_type === "general" ||
      d.ticker === "DOC" ||
      d.isCustom ||
      d.document_id?.startsWith("doc_")
  );

  const filteredSecDocs = secDocs.filter((doc) => {
    if (activeCompanyFilter === "All") return true;
    return doc.ticker === activeCompanyFilter || (doc.company && doc.company.toUpperCase().includes(activeCompanyFilter));
  });

  const selectedSecInFilter = filteredSecDocs.filter((d) => selectedDocIds.includes(d.document_id));
  const selectedUploadCount = uploadedDocs.filter((d) => selectedDocIds.includes(d.document_id)).length;

  const handleSelectAllSec = (e) => {
    e.stopPropagation();
    const ids = filteredSecDocs.map((d) => d.document_id);
    if (onSelectDocs) {
      onSelectDocs(ids);
    } else {
      ids.forEach((id) => {
        if (!selectedDocIds.includes(id)) onToggleDocSelection(id);
      });
    }
  };

  const handleDeselectAllSec = (e) => {
    e.stopPropagation();
    const ids = filteredSecDocs.map((d) => d.document_id);
    if (onDeselectDocs) {
      onDeselectDocs(ids);
    } else {
      ids.forEach((id) => {
        if (selectedDocIds.includes(id)) onToggleDocSelection(id);
      });
    }
  };

  const handleSelectAllUploads = (e) => {
    e.stopPropagation();
    const ids = uploadedDocs.map((d) => d.document_id);
    if (onSelectDocs) {
      onSelectDocs(ids);
    } else {
      ids.forEach((id) => {
        if (!selectedDocIds.includes(id)) onToggleDocSelection(id);
      });
    }
  };

  const handleDeselectAllUploads = (e) => {
    e.stopPropagation();
    const ids = uploadedDocs.map((d) => d.document_id);
    if (onDeselectDocs) {
      onDeselectDocs(ids);
    } else {
      ids.forEach((id) => {
        if (selectedDocIds.includes(id)) onToggleDocSelection(id);
      });
    }
  };

  const userFullName =
    currentUser?.user_metadata?.full_name ||
    currentUser?.email?.split("@")[0] ||
    "Donald Trump";

  const userInitials = userFullName
    ? userFullName
        .split(/\s+/)
        .map((n) => n[0])
        .slice(0, 2)
        .join("")
        .toUpperCase()
    : "DT";

  const userRole = currentUser?.user_metadata?.role || "Pro Analyst";

  return (
    <aside className={`webapp-sidebar ${isOpen ? "open" : ""}`} aria-label="Application Sidebar">
      {/* Top Header */}
      <div className="sidebar-header">
        <div className="app-brand">
          <div className="brand-icon">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
            </svg>
          </div>
          <div>
            <span className="brand-name">DocIntel</span>
            <span className="brand-tag">Multi-Tenant</span>
          </div>
        </div>

        {/* Mobile close toggle */}
        {onClose && (
          <button
            type="button"
            className="sidebar-close-btn"
            onClick={onClose}
            title="Collapse sidebar"
            aria-label="Collapse sidebar"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        )}
      </div>

      {/* Main Scrollable Area */}
      <div className="sidebar-scroll-area">
        {/* ChatGPT-Style New Analysis Button */}
        <button
          type="button"
          className="btn-new-query"
          onClick={() => {
            onNewSession();
            handleAutoCloseMobile();
          }}
          title="Start a new analysis thread"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          <span>New Analysis</span>
        </button>

        {/* Multi-Company Comparison Matrix Launcher */}
        {onOpenCompare && (
          <button
            type="button"
            className="btn-compare-launcher"
            onClick={() => {
              onOpenCompare();
              handleAutoCloseMobile();
            }}
            title="Open 4-Company Benchmark Scorecard (AAPL, MSFT, AMZN, META)"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 20V10" />
              <path d="M12 20V4" />
              <path d="M6 20v-6" />
            </svg>
            <span>Compare Filings</span>
            <span className="badge-matrix-pill">Matrix</span>
          </button>
        )}

        {/* =========================================================================
            1. CURATED SEC 10-K FILINGS ACCORDION
           ========================================================================= */}
        <div className="documents-accordion-container">
          <div
            className="accordion-header"
            onClick={() => setSecExpanded(!secExpanded)}
            title="Toggle SEC Filings Container"
          >
            <div className="accordion-title-group">
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                className={`accordion-chevron ${secExpanded ? "expanded" : ""}`}
              >
                <polyline points="9 18 15 12 9 6" />
              </svg>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: "var(--c-charcoal)" }}>
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
              </svg>
              <span>SEC 10-K Filings</span>
              <span className="doc-count-badge">{secDocs.length}</span>
            </div>
          </div>

          {/* Accordion Content */}
          {secExpanded && (
            <div className="accordion-content">
              {/* Company Filter Chips */}
              <div className="company-filter-bar">
                {companies.map((co) => (
                  <button
                    key={co}
                    type="button"
                    className={`company-chip ${activeCompanyFilter === co ? "active" : ""}`}
                    onClick={() => setActiveCompanyFilter(co)}
                  >
                    {co}
                  </button>
                ))}
              </div>

              {/* Check & Uncheck All Helper Bar */}
              <div className="doc-section-actions-bar">
                <span className="doc-selection-summary">
                  {selectedSecInFilter.length} / {filteredSecDocs.length} selected
                </span>
                <div className="doc-selection-btn-group">
                  <button
                    type="button"
                    className="btn-select-action"
                    onClick={handleSelectAllSec}
                    title="Check all visible SEC filings"
                  >
                    Select All
                  </button>
                  <span className="action-dot-divider">•</span>
                  <button
                    type="button"
                    className="btn-select-action"
                    onClick={handleDeselectAllSec}
                    title="Uncheck all visible SEC filings"
                  >
                    Uncheck All
                  </button>
                </div>
              </div>

              {/* Compact Document Rows */}
              <div className="compact-doc-list">
                {filteredSecDocs.map((doc) => {
                  const isSelected = selectedDocIds.includes(doc.document_id);
                  const ticker = doc.ticker || "SEC";
                  const year = doc.report_fiscal_year || "2024";

                  return (
                    <div
                      key={doc.document_id}
                      className={`compact-doc-row ${isSelected ? "selected" : ""}`}
                      onClick={() => onToggleDocSelection(doc.document_id)}
                      title={`${doc.company || "Filing"} FY${year} — Click to toggle selection`}
                    >
                      <input
                        type="checkbox"
                        className="doc-mini-checkbox"
                        checked={isSelected}
                        onChange={() => onToggleDocSelection(doc.document_id)}
                        onClick={(e) => e.stopPropagation()}
                        aria-label={`Select ${doc.company}`}
                      />

                      <span className={`mini-ticker-pill ticker-${ticker.toLowerCase()}`}>
                        {ticker}
                      </span>

                      <div className="compact-doc-label">
                        <span className="doc-main-name">
                          {doc.company ? doc.company.replace(", Inc.", "").replace(" Corporation", "") : "SEC Filing"}
                        </span>
                        <span className="doc-year-tag">FY{year}</span>
                      </div>

                      {/* PDF Preview Icon Button */}
                      {onPreviewDocument && (
                        <button
                          type="button"
                          className="btn-preview-pdf"
                          onClick={(e) => {
                            e.stopPropagation();
                            onPreviewDocument(doc);
                            handleAutoCloseMobile();
                          }}
                          title="Open original filing PDF"
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                            <circle cx="12" cy="12" r="3" />
                          </svg>
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* =========================================================================
            2. MY UPLOADED DOCUMENTS ACCORDION
           ========================================================================= */}
        <div className="documents-accordion-container">
          <div
            className="accordion-header full-cover"
            onClick={() => setUploadedExpanded(!uploadedExpanded)}
            title="Toggle Uploaded Documents Container"
          >
            <div className="accordion-title-group" style={{ width: "100%" }}>
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                className={`accordion-chevron ${uploadedExpanded ? "expanded" : ""}`}
              >
                <polyline points="9 18 15 12 9 6" />
              </svg>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: "var(--c-charcoal)" }}>
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="12" y1="18" x2="12" y2="12" />
                <polyline points="9 15 12 12 15 15" />
              </svg>
              <span className="accordion-main-title">Uploaded Documents</span>
              <span className="doc-count-badge">{uploadedDocs.length}</span>
            </div>
          </div>

          {/* Accordion Content */}
          {uploadedExpanded && (
            <div className="accordion-content">
              {/* Minimalist Upload Button */}
              <div
                className="compact-upload-pill"
                onClick={() => {
                  onOpenUpload();
                  handleAutoCloseMobile();
                }}
                title="Upload PDF (contracts, invoices, research papers)"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="17 8 12 3 7 8" />
                  <line x1="12" y1="3" x2="12" y2="15" />
                </svg>
                <span>Upload General PDF</span>
              </div>

              {/* Check & Uncheck All Helper Bar for Uploads */}
              {uploadedDocs.length > 0 && (
                <div className="doc-section-actions-bar">
                  <span className="doc-selection-summary">
                    {selectedUploadCount} / {uploadedDocs.length} selected
                  </span>
                  <div className="doc-selection-btn-group">
                    <button
                      type="button"
                      className="btn-select-action"
                      onClick={handleSelectAllUploads}
                      title="Check all uploaded documents"
                    >
                      Select All
                    </button>
                    <span className="action-dot-divider">•</span>
                    <button
                      type="button"
                      className="btn-select-action"
                      onClick={handleDeselectAllUploads}
                      title="Uncheck all uploaded documents"
                    >
                      Uncheck All
                    </button>
                  </div>
                </div>
              )}

              {/* Uploaded Documents List */}
              {uploadedDocs.length === 0 ? (
                <div className="history-empty-state" style={{ padding: "0.5rem 0.25rem", textAlign: "center" }}>
                  <span>No uploaded documents yet. Upload a PDF contract, invoice, or note to parse.</span>
                </div>
              ) : (
                <div className="compact-doc-list">
                  {uploadedDocs.map((doc) => {
                    const isSelected = selectedDocIds.includes(doc.document_id);
                    const docName = doc.file_name || doc.company || doc.document_id;
                    const pageText = doc.page_count ? `${doc.page_count}p` : "PDF";

                    return (
                      <div
                        key={doc.document_id}
                        className={`compact-doc-row ${isSelected ? "selected" : ""}`}
                        onClick={() => onToggleDocSelection(doc.document_id)}
                        title={`${docName} — Click to toggle selection`}
                      >
                        <input
                          type="checkbox"
                          className="doc-mini-checkbox"
                          checked={isSelected}
                          onChange={() => onToggleDocSelection(doc.document_id)}
                          onClick={(e) => e.stopPropagation()}
                          aria-label={`Select ${docName}`}
                        />

                        <span className="mini-ticker-pill ticker-upload">
                          PDF
                        </span>

                        <div className="compact-doc-label">
                          <span className="doc-main-name" title={docName}>
                            {docName}
                          </span>
                          <span className="doc-year-tag">{pageText}</span>
                        </div>

                        {/* PDF Preview Icon Button */}
                        {onPreviewDocument && (
                          <button
                            type="button"
                            className="btn-preview-pdf"
                            onClick={(e) => {
                              e.stopPropagation();
                              onPreviewDocument(doc);
                              handleAutoCloseMobile();
                            }}
                            title="Open uploaded PDF in viewer"
                          >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                              <circle cx="12" cy="12" r="3" />
                            </svg>
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* =========================================================================
            3. CHATGPT-STYLE CONVERSATION THREADS (Recent Analyses)
           ========================================================================= */}
        <div className="history-section">
          <div className="sidebar-section-title">
            <span>Recent Analyses</span>
          </div>

          {history.length === 0 ? (
            <div className="history-empty-state">
              <span>No prior queries yet. Ask any financial question to start.</span>
            </div>
          ) : (
            <div className="history-thread-list">
              {history.map((h, idx) => (
                <button
                  key={idx}
                  type="button"
                  className="history-thread-item"
                  onClick={() => {
                    onSelectHistory(h);
                    handleAutoCloseMobile();
                  }}
                  title={h.question}
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="thread-icon">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                  </svg>
                  <span className="thread-title">{h.question}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* =========================================================================
          4. CHATGPT-STYLE USER PROFILE & FLOATING POPOVER MENU (Screenshot 4)
         ========================================================================= */}
      <div className="sidebar-chatgpt-user-wrapper" ref={userMenuRef}>
        {/* Floating Upward Popover Menu */}
        {userMenuOpen && (
          <div className="chatgpt-popover-menu" role="menu" aria-label="User Options Menu">
            {/* Popover Header Card (Profile Link) */}
            <button
              type="button"
              className="chatgpt-popover-item user-header-item"
              onClick={() => {
                setUserMenuOpen(false);
                if (onOpenProfile) onOpenProfile();
                handleAutoCloseMobile();
              }}
              role="menuitem"
            >
              <div className="user-avatar-circle mini">
                {currentUser?.user_metadata?.avatar_url ? (
                  <img
                    src={currentUser.user_metadata.avatar_url}
                    alt={userFullName}
                    className="user-avatar-img"
                  />
                ) : (
                  <span>{userInitials}</span>
                )}
              </div>
              <div className="chatgpt-item-details">
                <span className="chatgpt-user-title">{userFullName}</span>
                <span className="chatgpt-user-subtitle">{userRole}</span>
              </div>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="chevron-right">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </button>

            <div className="chatgpt-menu-divider" />

            {/* Theme Toggle Item */}
            {onToggleTheme && (
              <button
                type="button"
                className="chatgpt-popover-item"
                onClick={() => {
                  onToggleTheme();
                }}
                role="menuitem"
              >
                {theme === "dark" ? (
                  <>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
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
                    <span>Theme: Light Mode</span>
                  </>
                ) : (
                  <>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                    </svg>
                    <span>Theme: Dark Mode</span>
                  </>
                )}
              </button>
            )}

            {/* Profile Trigger */}
            <button
              type="button"
              className="chatgpt-popover-item"
              onClick={() => {
                setUserMenuOpen(false);
                if (onOpenProfile) onOpenProfile();
                handleAutoCloseMobile();
              }}
              role="menuitem"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
              <span>Profile</span>
            </button>

            {/* Settings Trigger */}
            <button
              type="button"
              className="chatgpt-popover-item"
              onClick={() => {
                setUserMenuOpen(false);
                if (onOpenSettings) onOpenSettings();
                handleAutoCloseMobile();
              }}
              role="menuitem"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
              <span>Settings</span>
            </button>

            <div className="chatgpt-menu-divider" />

            {/* Help / Guide Trigger */}
            <button
              type="button"
              className="chatgpt-popover-item"
              onClick={() => {
                setUserMenuOpen(false);
                if (onOpenHelp) onOpenHelp();
                handleAutoCloseMobile();
              }}
              role="menuitem"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
              <span>Help &amp; Documentation</span>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="chevron-right">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </button>

            {/* Log Out */}
            {onSignOut && (
              <button
                type="button"
                className="chatgpt-popover-item logout-item"
                onClick={() => {
                  setUserMenuOpen(false);
                  onSignOut();
                }}
                role="menuitem"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                  <polyline points="16 17 21 12 16 7" />
                  <line x1="21" y1="12" x2="9" y2="12" />
                </svg>
                <span>Log out</span>
              </button>
            )}
          </div>
        )}

        {/* ChatGPT Bottom User Profile Bar (Screenshot 4: PA Parkar Plus) */}
        <button
          type="button"
          className={`chatgpt-user-bar ${userMenuOpen ? "active" : ""}`}
          onClick={() => setUserMenuOpen(!userMenuOpen)}
          title="Account settings &amp; profile"
          aria-expanded={userMenuOpen}
          aria-haspopup="true"
        >
          <div className="user-avatar-circle mini">
            {currentUser?.user_metadata?.avatar_url ? (
              <img
                src={currentUser.user_metadata.avatar_url}
                alt={userFullName}
                className="user-avatar-img"
              />
            ) : (
              <span>{userInitials}</span>
            )}
          </div>

          <div className="chatgpt-bar-user-info">
            <span className="chatgpt-bar-name">{userFullName}</span>
            <span className="chatgpt-bar-role">{userRole}</span>
          </div>

          <div className="chatgpt-bar-indicator">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </div>
        </button>
      </div>
    </aside>
  );
}
