"use client";

import { useState, useEffect } from "react";

export default function SettingsModal({
  isOpen,
  onClose,
  theme = "light",
  onToggleTheme,
  activeEngine = "fastapi_live",
  onClearThread,
  settings = {},
  onSaveSettings,
}) {
  const [activeTab, setActiveTab] = useState("general");
  const [retrievalMode, setRetrievalMode] = useState(settings?.retrievalMode || "hybrid");
  const [topK, setTopK] = useState(settings?.topK || 7);
  const [showCitationScore, setShowCitationScore] = useState(
    typeof settings?.showCitationScore === "boolean" ? settings.showCitationScore : true
  );

  // Sync saved settings from localStorage or props whenever modal opens or settings change
  useEffect(() => {
    try {
      const saved = localStorage.getItem("docintel_settings");
      const active = saved ? JSON.parse(saved) : settings;
      if (active) {
        if (active.retrievalMode) setRetrievalMode(active.retrievalMode);
        if (active.topK) setTopK(active.topK);
        if (typeof active.showCitationScore === "boolean") setShowCitationScore(active.showCitationScore);
      }
    } catch (e) {
      // quiet fallback
    }
  }, [isOpen, settings]);

  const handleUpdate = (updatedFields) => {
    try {
      const current = JSON.parse(localStorage.getItem("docintel_settings") || "{}");
      const nextSettings = { ...current, ...updatedFields };
      localStorage.setItem("docintel_settings", JSON.stringify(nextSettings));
      if (onSaveSettings) {
        onSaveSettings(nextSettings);
      }
    } catch (e) {
      // quiet fallback
    }
  };

  const handleSaveAndClose = () => {
    handleUpdate({ retrievalMode, topK, showCitationScore });
    onClose();
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="modal-backdrop" onClick={onClose} aria-label="Close modal backdrop">
      <div
        className="modal-container settings-modal-container"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-modal-title"
      >
        {/* Header */}
        <div className="modal-header">
          <div className="modal-title-group">
            <div className="modal-icon-badge">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
            </div>
            <div>
              <h2 id="settings-modal-title" className="modal-title">Settings</h2>
              <p className="modal-subtitle">Customize application behavior, theme, and retrieval parameters</p>
            </div>
          </div>

          <button
            type="button"
            className="modal-close-btn"
            onClick={onClose}
            title="Close settings"
            aria-label="Close"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Modal Body with Sidebar Tabs */}
        <div className="settings-modal-layout">
          {/* Settings Left Navigation */}
          <div className="settings-nav-sidebar">
            <button
              type="button"
              className={`settings-nav-item ${activeTab === "general" ? "active" : ""}`}
              onClick={() => setActiveTab("general")}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
              <span>General</span>
            </button>

            <button
              type="button"
              className={`settings-nav-item ${activeTab === "retrieval" ? "active" : ""}`}
              onClick={() => setActiveTab("retrieval")}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <span>Search &amp; Retrieval</span>
            </button>

            <button
              type="button"
              className={`settings-nav-item ${activeTab === "system" ? "active" : ""}`}
              onClick={() => setActiveTab("system")}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
                <line x1="8" y1="21" x2="16" y2="21" />
                <line x1="12" y1="17" x2="12" y2="21" />
              </svg>
              <span>System &amp; Engine</span>
            </button>

            <button
              type="button"
              className={`settings-nav-item ${activeTab === "shortcuts" ? "active" : ""}`}
              onClick={() => setActiveTab("shortcuts")}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="2" y="4" width="20" height="16" rx="2" />
                <path d="M6 8h.001M10 8h.001M14 8h.001M18 8h.001M8 12h.001M12 12h.001M16 12h.001M7 16h10" />
              </svg>
              <span>Shortcuts</span>
            </button>
          </div>

          {/* Settings Right Tab Pane */}
          <div className="settings-pane-content">
            {/* GENERAL TAB */}
            {activeTab === "general" && (
              <div className="settings-tab-section">
                <h3 className="settings-section-title">Appearance &amp; Theme</h3>
                <p className="settings-section-description">
                  Choose your preferred color theme or match your operating system appearance.
                </p>

                <div className="theme-selection-grid">
                  <div
                    className={`theme-card ${theme === "light" ? "active" : ""}`}
                    onClick={() => theme !== "light" && onToggleTheme && onToggleTheme()}
                  >
                    <div className="theme-card-preview light-preview">
                      <div className="preview-top-bar" />
                      <div className="preview-body">
                        <div className="preview-line" />
                        <div className="preview-line short" />
                      </div>
                    </div>
                    <div className="theme-card-footer">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="5" />
                        <line x1="12" y1="1" x2="12" y2="3" />
                        <line x1="12" y1="21" x2="12" y2="23" />
                        <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                        <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                        <line x1="1" y1="12" x2="3" y2="12" />
                        <line x1="21" y1="12" x2="23" y2="12" />
                      </svg>
                      <span>Light Theme</span>
                    </div>
                  </div>

                  <div
                    className={`theme-card ${theme === "dark" ? "active" : ""}`}
                    onClick={() => theme !== "dark" && onToggleTheme && onToggleTheme()}
                  >
                    <div className="theme-card-preview dark-preview">
                      <div className="preview-top-bar" />
                      <div className="preview-body">
                        <div className="preview-line" />
                        <div className="preview-line short" />
                      </div>
                    </div>
                    <div className="theme-card-footer">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                      </svg>
                      <span>Dark Theme</span>
                    </div>
                  </div>
                </div>

                <div className="settings-divider" />

                <h3 className="settings-section-title">Session Management</h3>
                <p className="settings-section-description">
                  Clear active conversation turns, retrieved tables, and temporary query state.
                </p>

                <div style={{ marginTop: "0.75rem" }}>
                  <button
                    type="button"
                    className="btn-danger-outline"
                    onClick={() => {
                      if (onClearThread) onClearThread();
                      onClose();
                    }}
                  >
                    Clear Active Thread History
                  </button>
                </div>
              </div>
            )}

            {/* RETRIEVAL TAB */}
            {activeTab === "retrieval" && (
              <div className="settings-tab-section">
                <h3 className="settings-section-title">Retrieval Strategy</h3>
                <p className="settings-section-description">
                  Configure how financial disclosure passages and table rows are ranked and retrieved.
                </p>

                <div className="settings-option-row">
                  <div>
                    <span className="settings-option-label">Hybrid Search (Vector + BM25)</span>
                    <span className="settings-option-sub">
                      Combines high-dimensional dense embeddings with lexical keyword matching (Reciprocal Rank Fusion).
                    </span>
                  </div>
                  <span className="settings-badge-active">Default &amp; Recommended</span>
                </div>

                <div className="settings-divider" />

                <h3 className="settings-section-title">Passage Density (Top K)</h3>
                <p className="settings-section-description">
                  Number of most relevant chunks passed to the reasoning model per query.
                </p>

                <div className="top-k-selector-group">
                  {[5, 7, 10, 15].map((val) => (
                    <button
                      key={val}
                      type="button"
                      className={`top-k-pill ${topK === val ? "active" : ""}`}
                      onClick={() => {
                        setTopK(val);
                        handleUpdate({ topK: val });
                      }}
                    >
                      {val} Chunks {val === 7 && "(Default)"}
                    </button>
                  ))}
                </div>

                <div className="settings-divider" />

                <div className="settings-toggle-row">
                  <div>
                    <span className="settings-option-label">Display Provenance Similarity Scores</span>
                    <span className="settings-option-sub">
                      Show vector cosine distance and BM25 relevance scores on citation tags.
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    className="settings-switch"
                    checked={showCitationScore}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      setShowCitationScore(checked);
                      handleUpdate({ showCitationScore: checked });
                    }}
                  />
                </div>
              </div>
            )}

            {/* SYSTEM TAB */}
            {activeTab === "system" && (
              <div className="settings-tab-section">
                <h3 className="settings-section-title">Infrastructure Status</h3>
                <p className="settings-section-description">
                  Live connection parameters and service health for backend workers.
                </p>

                <div className="system-specs-list">
                  <div className="spec-row">
                    <span className="spec-label">Backend Engine:</span>
                    <span className="spec-value font-mono">
                      {activeEngine === "fastapi_live" ? "FastAPI Live Microservice (Port 8000)" : "Mock/Demo Engine"}
                    </span>
                  </div>
                  <div className="spec-row">
                    <span className="spec-label">Vector Database:</span>
                    <span className="spec-value font-mono">Supabase PostgreSQL 15 + pgvector (HNSW Index)</span>
                  </div>
                  <div className="spec-row">
                    <span className="spec-label">Embedding Architecture:</span>
                    <span className="spec-value font-mono">sentence-transformers/all-MiniLM-L6-v2 (384 Dimensions)</span>
                  </div>
                  <div className="spec-row">
                    <span className="spec-label">PDF Processing:</span>
                    <span className="spec-value font-mono">pdfplumber table grid extractor + GFM Markdown</span>
                  </div>
                  <div className="spec-row">
                    <span className="spec-label">Multi-Tenancy Isolation:</span>
                    <span className="spec-value font-mono">Row-Level Security (RLS) &amp; user_id chunk filtering</span>
                  </div>
                </div>
              </div>
            )}

            {/* SHORTCUTS TAB */}
            {activeTab === "shortcuts" && (
              <div className="settings-tab-section">
                <h3 className="settings-section-title">Keyboard Shortcuts</h3>
                <p className="settings-section-description">
                  Speed up your financial research workflows with global keybindings.
                </p>

                <div className="shortcuts-table">
                  <div className="shortcut-row">
                    <span>Submit financial query</span>
                    <span className="kbd-badge">Enter</span>
                  </div>
                  <div className="shortcut-row">
                    <span>Add new line in query dock</span>
                    <span className="kbd-badge">Shift + Enter</span>
                  </div>
                  <div className="shortcut-row">
                    <span>Close open modal / drawer</span>
                    <span className="kbd-badge">Escape</span>
                  </div>
                  <div className="shortcut-row">
                    <span>Toggle Chunk Inspector</span>
                    <span className="kbd-badge">Alt + I</span>
                  </div>
                  <div className="shortcut-row">
                    <span>Open 4-Company Matrix</span>
                    <span className="kbd-badge">Alt + M</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="modal-footer">
          <button
            type="button"
            className="btn-modal-primary"
            onClick={handleSaveAndClose}
          >
            Save &amp; Close
          </button>
        </div>
      </div>
    </div>
  );
}

