"use client";

import { useState, useRef, useEffect } from "react";

export default function UploadModal({ isOpen, onClose, onDocumentUploaded }) {
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [companyName, setCompanyName] = useState("");
  const [docType, setDocType] = useState("general");
  const [fiscalYear, setFiscalYear] = useState(new Date().getFullYear().toString());
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [uploadStatus, setUploadStatus] = useState("");
  const [uploadError, setUploadError] = useState("");
  const fileInputRef = useRef(null);
  const timerRef = useRef(null);

  // Reset state when modal opens/closes
  useEffect(() => {
    if (!isOpen) {
      setSelectedFile(null);
      setCompanyName("");
      setDocType("general");
      setFiscalYear(new Date().getFullYear().toString());
      setUploading(false);
      setProgress(0);
      setUploadStatus("");
      setUploadError("");
      if (timerRef.current) clearInterval(timerRef.current);
    }
  }, [isOpen]);

  // Handle ESC key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape" && isOpen && !uploading) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, uploading, onClose]);

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
      handleFileSelected(files[0]);
    }
  };

  const handleFileInputChange = (e) => {
    const files = e.target.files;
    if (files.length > 0) {
      handleFileSelected(files[0]);
    }
  };

  const handleFileSelected = (file) => {
    setUploadError("");
    if (!file.name.toLowerCase().endsWith(".pdf")) {
      setUploadError("Only PDF documents (.pdf) are supported by the intelligence parser.");
      return;
    }
    setSelectedFile(file);
    // Infer document title or company name from filename
    const baseName = file.name
      .replace(/\.[^/.]+$/, "")
      .replace(/[-_]/g, " ")
      .replace(/(10-?k|annual report|filing|202\d)/gi, "")
      .trim();
    setCompanyName(baseName || "General Document");
  };

  const formatFileSize = (bytes) => {
    if (!bytes) return "0 KB";
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handleStartUpload = async () => {
    if (!selectedFile || uploading) return;

    setUploading(true);
    setUploadError("");
    setProgress(15);
    setUploadStatus("Uploading PDF to document intelligence pipeline...");

    // Smooth status messages during background extraction & embedding
    let curProgress = 15;
    timerRef.current = setInterval(() => {
      curProgress = Math.min(curProgress + 8, 88);
      setProgress(curProgress);
      if (curProgress >= 30 && curProgress < 60) {
        setUploadStatus("Extracting tabular structures & narrative blocks with pdfplumber...");
      } else if (curProgress >= 60 && curProgress < 85) {
        setUploadStatus("Generating vector embeddings & committing chunks to pgvector...");
      } else if (curProgress >= 85) {
        setUploadStatus("Persisting original document & finalizing indexes...");
      }
    }, 450);

    try {
      const formData = new FormData();
      formData.append("file", selectedFile);
      formData.append("doc_type", docType);

      const res = await fetch("/api/documents/upload", {
        method: "POST",
        body: formData,
      });

      if (timerRef.current) clearInterval(timerRef.current);

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.detail || `Upload failed with HTTP ${res.status}`);
      }

      const data = await res.json();

      setProgress(100);
      setUploadStatus(
        `Ingested ${data.chunks_ingested || 0} chunks across ${data.total_pages || 1} pages successfully!`
      );

      const cleanCo = companyName.trim() || selectedFile.name.replace(/\.[^/.]+$/, "");
      const newDoc = {
        document_id: data.document_id,
        company: cleanCo,
        ticker: docType === "sec_10k" ? "10-K" : "DOC",
        report_type: docType,
        report_fiscal_year: parseInt(fiscalYear, 10) || new Date().getFullYear(),
        period_ended: new Date().toISOString().split("T")[0],
        filing_date: new Date().toISOString().split("T")[0],
        file_name: data.file_name,
        source_url: `/api/documents/${data.document_id}/pdf`,
        status: "ready",
        page_count: data.total_pages || 1,
        chunks_ingested: data.chunks_ingested || 0,
        isCustom: true,
      };

      setTimeout(() => {
        if (onDocumentUploaded) {
          onDocumentUploaded(newDoc);
        }
        setUploading(false);
        onClose();
      }, 700);
    } catch (err) {
      if (timerRef.current) clearInterval(timerRef.current);
      setUploading(false);
      setProgress(0);
      setUploadStatus("");
      setUploadError(err.message || "Failed to upload and parse document. Please try again.");
    }
  };

  return (
    <div className="upload-modal-overlay" onClick={uploading ? undefined : onClose} role="dialog" aria-modal="true">
      <div className="upload-modal-card" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="upload-modal-header">
          <div className="upload-modal-header-left">
            <div className="upload-badge-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="12" y1="18" x2="12" y2="12" />
                <polyline points="9 15 12 12 15 15" />
              </svg>
            </div>
            <div>
              <h3 className="upload-modal-title">Upload Document or Filing</h3>
              <p className="upload-modal-subtitle">
                Upload general PDF contracts, invoices, notes, or SEC reports for audited multi-page querying
              </p>
            </div>
          </div>

          {!uploading && (
            <button
              type="button"
              className="btn-upload-close"
              onClick={onClose}
              title="Close modal"
              aria-label="Close"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          )}
        </div>

        {/* Hidden File Input */}
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileInputChange}
          style={{ display: "none" }}
          accept=".pdf"
        />

        {/* Modal Body */}
        <div className="upload-modal-body">
          {uploadError && (
            <div className="upload-error-banner" style={{
              background: "rgba(239, 68, 68, 0.1)",
              border: "1px solid rgba(239, 68, 68, 0.3)",
              color: "#dc2626",
              borderRadius: "6px",
              padding: "0.6rem 0.8rem",
              fontSize: "0.78rem",
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
              marginBottom: "0.8rem"
            }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0 }}>
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <span>{uploadError}</span>
            </div>
          )}

          {!selectedFile ? (
            /* Dropzone */
            <div
              className={`upload-dropzone-modern ${isDragging ? "dragging" : ""}`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <div className="dropzone-icon-circle">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="17 8 12 3 7 8" />
                  <line x1="12" y1="3" x2="12" y2="15" />
                </svg>
              </div>

              <div className="dropzone-text-group">
                <div className="dropzone-primary-text">
                  <span>Drag &amp; drop document here, or </span>
                  <span className="dropzone-browse-link">browse files</span>
                </div>
                <div className="dropzone-format-pills">
                  <span className="dropzone-chip">PDF Document</span>
                  <span className="dropzone-chip">Contracts &amp; Invoices</span>
                  <span className="dropzone-chip">SEC 10-K</span>
                  <span className="dropzone-chip">Max 50MB</span>
                </div>
              </div>
            </div>
          ) : (
            /* Selected File Preview Card */
            <div className="selected-file-container">
              <div className="selected-file-card">
                <div className="file-type-badge">
                  <span>PDF</span>
                </div>
                <div className="selected-file-info">
                  <span className="selected-file-name" title={selectedFile.name}>
                    {selectedFile.name}
                  </span>
                  <span className="selected-file-size">
                    {formatFileSize(selectedFile.size)} • Ready for table &amp; text extraction
                  </span>
                </div>
                {!uploading && (
                  <button
                    type="button"
                    className="btn-remove-selected-file"
                    onClick={() => setSelectedFile(null)}
                    title="Remove file and select another"
                  >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                )}
              </div>

              {/* Metadata Inputs */}
              {!uploading && (
                <div className="upload-metadata-grid">
                  <div className="metadata-field">
                    <label className="metadata-label">Document / Company Name</label>
                    <input
                      type="text"
                      className="metadata-input"
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      placeholder="e.g. Master Services Agreement, NVIDIA Corp"
                    />
                  </div>

                  <div className="metadata-row-twin">
                    <div className="metadata-field">
                      <label className="metadata-label">Parser Strategy</label>
                      <select
                        className="metadata-select"
                        value={docType}
                        onChange={(e) => setDocType(e.target.value)}
                      >
                        <option value="general">General PDF (Contracts, Notes, Tables)</option>
                        <option value="sec_10k">SEC 10-K (Item 8 Tables &amp; Items)</option>
                      </select>
                    </div>

                    <div className="metadata-field">
                      <label className="metadata-label">Reference Year</label>
                      <select
                        className="metadata-select"
                        value={fiscalYear}
                        onChange={(e) => setFiscalYear(e.target.value)}
                      >
                        <option value="2026">2026</option>
                        <option value="2025">2025</option>
                        <option value="2024">2024</option>
                        <option value="2023">2023</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Upload Progress Bar */}
          {uploading && (
            <div className="upload-progress-wrapper">
              <div className="upload-progress-header">
                <span className="upload-status-text">{uploadStatus}</span>
                <span className="upload-pct-badge font-mono">{progress}%</span>
              </div>
              <div className="upload-progress-track">
                <div className="upload-progress-fill" style={{ width: `${progress}%` }} />
              </div>
            </div>
          )}

          {/* Privacy & Security Callout */}
          <div className="upload-security-callout">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0 }}>
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
            <span>
              Secure sandboxed pipeline. PDF tables are converted to GFM markdown grids and indexed with pgvector for grounded citations.
            </span>
          </div>
        </div>

        {/* Modal Footer Actions */}
        <div className="upload-modal-footer">
          <button
            type="button"
            className="btn-upload-cancel"
            onClick={onClose}
            disabled={uploading}
          >
            Cancel
          </button>

          <button
            type="button"
            className="btn-upload-submit"
            onClick={handleStartUpload}
            disabled={!selectedFile || uploading}
          >
            {uploading ? (
              <>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="spinner-circle">
                  <circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
                  <path d="M12 2a10 10 0 0 1 10 10" />
                </svg>
                <span>Processing Document...</span>
              </>
            ) : (
              <span>Process &amp; Index Document</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
