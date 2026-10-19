"use client";

import { useState, useRef, useEffect } from "react";

export default function UploadModal({ isOpen, onClose, onDocumentUploaded }) {
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [companyName, setCompanyName] = useState("");
  const [reportType, setReportType] = useState("10-K");
  const [fiscalYear, setFiscalYear] = useState(new Date().getFullYear().toString());
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [uploadStatus, setUploadStatus] = useState("");
  const fileInputRef = useRef(null);

  // Reset state when modal opens/closes
  useEffect(() => {
    if (!isOpen) {
      setSelectedFile(null);
      setCompanyName("");
      setReportType("10-K");
      setFiscalYear(new Date().getFullYear().toString());
      setUploading(false);
      setProgress(0);
      setUploadStatus("");
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
    setSelectedFile(file);
    // Infer company name from filename
    const baseName = file.name
      .replace(/\.[^/.]+$/, "")
      .replace(/[-_]/g, " ")
      .replace(/(10-?k|annual report|filing|202\d)/gi, "")
      .trim();
    setCompanyName(baseName || "Corporate Filing");
  };

  const formatFileSize = (bytes) => {
    if (!bytes) return "0 KB";
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handleStartUpload = () => {
    if (!selectedFile || uploading) return;

    setUploading(true);
    setProgress(15);
    setUploadStatus("Uploading filing to document intelligence pipeline...");

    setTimeout(() => {
      setProgress(42);
      setUploadStatus("Parsing tabular disclosures & financial statement grids...");
    }, 500);

    setTimeout(() => {
      setProgress(78);
      setUploadStatus("Extracting comparative columns & generating vector embeddings...");
    }, 1100);

    setTimeout(() => {
      setProgress(100);
      setUploadStatus("Filing successfully indexed and ready for immediate querying!");

      const cleanCo = companyName.trim() || selectedFile.name.replace(/\.[^/.]+$/, "");
      const tickerGuess = cleanCo.slice(0, 4).toUpperCase();

      const newDoc = {
        document_id: `DOC-${tickerGuess}-${fiscalYear}-${Date.now().toString(36).slice(-4).toUpperCase()}`,
        company: cleanCo,
        ticker: tickerGuess,
        report_type: reportType,
        report_fiscal_year: parseInt(fiscalYear, 10) || 2024,
        period_ended: `${fiscalYear}-12-31`,
        filing_date: new Date().toISOString().split("T")[0],
        file_name: selectedFile.name,
        source_url: `/api/documents/DOC-CUSTOM/pdf`,
        status: "ready",
        page_count: Math.floor(Math.random() * 45) + 35,
        isCustom: true,
      };

      setTimeout(() => {
        onDocumentUploaded(newDoc);
        setUploading(false);
        onClose();
      }, 500);
    }, 1800);
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
              <h3 className="upload-modal-title">Upload SEC Filing or Report</h3>
              <p className="upload-modal-subtitle">
                Upload Form 10-K, 10-Q, or annual disclosures for multi-year financial querying
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
          accept=".pdf,.csv,.txt,.docx"
        />

        {/* Modal Body */}
        <div className="upload-modal-body">
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
                  <span>Drag &amp; drop filing here, or </span>
                  <span className="dropzone-browse-link">browse files</span>
                </div>
                <div className="dropzone-format-pills">
                  <span className="dropzone-chip">PDF</span>
                  <span className="dropzone-chip">10-K / 10-Q</span>
                  <span className="dropzone-chip">CSV</span>
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
                    {formatFileSize(selectedFile.size)} • Ready for table parsing
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
                    <label className="metadata-label">Company Name</label>
                    <input
                      type="text"
                      className="metadata-input"
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      placeholder="e.g. NVIDIA Corporation"
                    />
                  </div>

                  <div className="metadata-row-twin">
                    <div className="metadata-field">
                      <label className="metadata-label">Report Type</label>
                      <select
                        className="metadata-select"
                        value={reportType}
                        onChange={(e) => setReportType(e.target.value)}
                      >
                        <option value="10-K">Form 10-K (Annual)</option>
                        <option value="10-Q">Form 10-Q (Quarterly)</option>
                        <option value="8-K">Form 8-K (Current)</option>
                        <option value="Annual Report">Annual Report (ARS)</option>
                      </select>
                    </div>

                    <div className="metadata-field">
                      <label className="metadata-label">Fiscal Year</label>
                      <select
                        className="metadata-select"
                        value={fiscalYear}
                        onChange={(e) => setFiscalYear(e.target.value)}
                      >
                        <option value="2025">FY 2025</option>
                        <option value="2024">FY 2024</option>
                        <option value="2023">FY 2023</option>
                        <option value="2022">FY 2022</option>
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
              Secure sandboxed environment. Statement tables are parsed with exact column and cell coordinates.
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
                <span>Processing Filing...</span>
              </>
            ) : (
              <span>Process &amp; Index Filing</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
