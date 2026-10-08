"use client";

import { useState, useRef } from "react";

export default function UploadModal({ isOpen, onClose, onDocumentUploaded }) {
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [uploadStatus, setUploadStatus] = useState("");
  const fileInputRef = useRef(null);

  if (!isOpen) return null;

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      processFile(files[0]);
    }
  };

  const handleFileSelect = (e) => {
    const files = e.target.files;
    if (files.length > 0) {
      processFile(files[0]);
    }
  };

  const processFile = (file) => {
    setUploading(true);
    setProgress(15);
    setUploadStatus("Uploading document bytes...");

    // Simulated parsing & chunking pipeline
    setTimeout(() => {
      setProgress(45);
      setUploadStatus("Extracting narrative and table structures...");
    }, 600);

    setTimeout(() => {
      setProgress(80);
      setUploadStatus("Embedding chunks into pgvector corpus...");
    }, 1200);

    setTimeout(() => {
      setProgress(100);
      setUploadStatus("Indexed & Ready for Querying!");

      const newDoc = {
        document_id: `DOC-CUSTOM-${Date.now().toString(36).toUpperCase()}`,
        company: file.name.replace(/\.[^/.]+$/, ""),
        ticker: "USER",
        report_type: "Uploaded Doc",
        report_fiscal_year: new Date().getFullYear(),
        period_ended: new Date().toISOString().split("T")[0],
        filing_date: new Date().toISOString().split("T")[0],
        file_name: file.name,
        source_url: "#",
        status: "ready",
        page_count: Math.floor(Math.random() * 40) + 12,
        isCustom: true,
      };

      setTimeout(() => {
        onDocumentUploaded(newDoc);
        setUploading(false);
        setProgress(0);
        onClose();
      }, 500);
    }, 1800);
  };

  return (
    <div className="modal-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div className="upload-modal-box" onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <h3 style={{ fontSize: "1.08rem", fontWeight: 700, color: "var(--c-charcoal)" }}>
              Upload Financial Document
            </h3>
            <p style={{ fontSize: "0.78rem", color: "var(--text-muted)", marginTop: "0.15rem" }}>
              Upload SEC 10-K, 10-Q, or earnings report for table & chunk extraction
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: "1.2rem" }}
          >
            &times;
          </button>
        </div>

        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileSelect}
          style={{ display: "none" }}
          accept=".pdf,.txt,.docx,.csv"
        />

        <div
          className={`upload-dropzone ${isDragging ? "dragover" : ""}`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <div style={{
            width: "44px",
            height: "44px",
            borderRadius: "50%",
            background: "#f3f4f6",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "var(--c-charcoal)",
          }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
          </div>

          <div>
            <strong style={{ display: "block", color: "var(--c-charcoal)" }}>Click to upload or drag & drop</strong>
            <span style={{ color: "var(--text-muted)", fontSize: "0.75rem" }}>PDF, Word, or CSV financial statements (max 50MB)</span>
          </div>
        </div>

        {uploading && (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.72rem", color: "var(--text-muted)" }}>
              <span>{uploadStatus}</span>
              <span className="font-mono">{progress}%</span>
            </div>
            <div className="upload-progress-bar">
              <div className="upload-progress-fill" style={{ width: `${progress}%` }} />
            </div>
          </div>
        )}

        <div style={{
          background: "#f9fafb",
          border: "1px solid var(--border-subtle)",
          borderRadius: "8px",
          padding: "0.75rem",
          fontSize: "0.72rem",
          color: "var(--text-muted)",
          display: "flex",
          alignItems: "center",
          gap: "0.5rem",
        }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: "var(--c-charcoal)" }}>
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          </svg>
          <span>All documents are securely isolated and chunked with verified cell coordinates.</span>
        </div>
      </div>
    </div>
  );
}
