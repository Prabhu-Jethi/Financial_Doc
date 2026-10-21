"use client";

const OFFICIAL_SEC_URLS = {
  "AAPL-10K-2024": "https://www.sec.gov/ix?doc=/Archives/edgar/data/0000320193/000032019324000106/aapl-20240928.htm",
  "AAPL-10K-2023": "https://www.sec.gov/ix?doc=/Archives/edgar/data/0000320193/000032019323000106/aapl-20230930.htm",
  "AAPL-10K-2022": "https://www.sec.gov/ix?doc=/Archives/edgar/data/0000320193/000032019322000108/aapl-20220924.htm",
  "MSFT-10K-2024": "https://www.sec.gov/ix?doc=/Archives/edgar/data/0000789019/000078901924000075/msft-20240630.htm",
  "MSFT-10K-2023": "https://www.sec.gov/ix?doc=/Archives/edgar/data/0000789019/000078901923000077/msft-20230630.htm",
  "MSFT-10K-2022": "https://www.sec.gov/ix?doc=/Archives/edgar/data/0000789019/000078901922000067/msft-20220630.htm",
  "AMZN-10K-2024": "https://www.sec.gov/ix?doc=/Archives/edgar/data/0001018724/000101872425000004/amzn-20241231.htm",
  "AMZN-10K-2023": "https://www.sec.gov/ix?doc=/Archives/edgar/data/0001018724/000101872424000008/amzn-20231231.htm",
  "AMZN-10K-2025": "https://www.sec.gov/edgar/browse/?CIK=0001018724",
  "META-10K-2024": "https://www.sec.gov/ix?doc=/Archives/edgar/data/0001326801/000132680125000018/meta-20241231.htm",
  "META-10K-2023": "https://www.sec.gov/ix?doc=/Archives/edgar/data/0001326801/000132680124000012/meta-20231231.htm",
};

export function getOfficialSecUrl(docId, company = "", year = "", sourceUrl = "") {
  if (sourceUrl && !sourceUrl.startsWith("local://") && sourceUrl !== "#") {
    const isAppleUrl = sourceUrl.includes("q4cdn") || sourceUrl.includes("0000320193");
    const isAppleDoc = String(docId).toUpperCase().includes("AAPL") || String(company).toUpperCase().includes("APPLE");
    if (!isAppleUrl || isAppleDoc) {
      return sourceUrl;
    }
  }

  const id = String(docId || "").toUpperCase();
  if (OFFICIAL_SEC_URLS[id]) {
    return OFFICIAL_SEC_URLS[id];
  }

  const comp = String(company || "").toUpperCase();
  const yr = String(year || "");

  if (comp.includes("MICROSOFT") || comp.includes("MSFT") || id.includes("MSFT")) {
    if (yr.includes("2023")) return OFFICIAL_SEC_URLS["MSFT-10K-2023"];
    if (yr.includes("2022")) return OFFICIAL_SEC_URLS["MSFT-10K-2022"];
    return OFFICIAL_SEC_URLS["MSFT-10K-2024"];
  }

  if (comp.includes("AMAZON") || comp.includes("AMZN") || id.includes("AMZN")) {
    if (yr.includes("2023")) return OFFICIAL_SEC_URLS["AMZN-10K-2023"];
    if (yr.includes("2025")) return OFFICIAL_SEC_URLS["AMZN-10K-2025"];
    return OFFICIAL_SEC_URLS["AMZN-10K-2024"];
  }

  if (comp.includes("META") || id.includes("META")) {
    if (yr.includes("2023")) return OFFICIAL_SEC_URLS["META-10K-2023"];
    return OFFICIAL_SEC_URLS["META-10K-2024"];
  }

  if (comp.includes("APPLE") || comp.includes("AAPL") || id.includes("AAPL")) {
    if (yr.includes("2023")) return OFFICIAL_SEC_URLS["AAPL-10K-2023"];
    if (yr.includes("2022")) return OFFICIAL_SEC_URLS["AAPL-10K-2022"];
    return OFFICIAL_SEC_URLS["AAPL-10K-2024"];
  }

  return "https://www.sec.gov/edgar/searchedgar/companysearch";
}

export default function InspectorDrawer({
  isOpen,
  onClose,
  activeCitation,
  activeDocument,
  onOpenPdfModal,
}) {
  if (!isOpen) return null;

  const docId = activeCitation?.document_id || activeDocument?.document_id || "";
  const company = activeCitation?.company || activeDocument?.company || "SEC Filing";
  const year = activeCitation?.report_year || activeDocument?.report_fiscal_year || "2024";
  const page = activeCitation?.printed_page || "29";
  const section = activeCitation?.section || "Financial Statements / MD&A";
  const quote = activeCitation?.exact_quote || "Full document indexed with table cell bounding coordinates.";
  const rawUrl = activeCitation?.source_url || activeDocument?.source_url || "";
  const url = getOfficialSecUrl(docId, company, year, rawUrl);

  const companyShort = company
    ? company.replace(", Inc.", "").replace(" Corporation", "").replace(" Platforms", "")
    : "SEC";

  const title = activeCitation
    ? `${company} • ${year} ${activeCitation.report_type || "10-K"}`
    : activeDocument
    ? `${company} • FY${year}`
    : "Document Chunk Inspector";

  return (
    <aside className="webapp-inspector open" aria-label="Chunk & Table Provenance Inspector">
      {/* Header */}
      <div className="inspector-header">
        <div className="inspector-title">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--c-charcoal)" }}>
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <span>Citation &amp; Page Provenance</span>
        </div>
        <button
          type="button"
          className="btn-inspector-close"
          onClick={onClose}
          title="Close inspector drawer"
          aria-label="Close inspector"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      {/* Body */}
      <div className="inspector-body">
        {/* Source Coordinates Banner */}
        <div className="chunk-provenance-box">
          <div className="chunk-source-tag">
            <span className="provenance-doc-title">{title}</span>
            <span className="provenance-page-pill">PAGE {page}</span>
          </div>

          <div className="provenance-section-name">
            {section}
          </div>

          <div className="provenance-meta-detail">
            Source Anchor: Table Cell &amp; Dense Vector Match
          </div>
        </div>

        {/* Verbatim Excerpt */}
        <div className="chunk-quote-card">
          <span className="chunk-quote-label">
            Disclosed Verbatim Passage from Report
          </span>
          <div className="chunk-quote-display">
            "{quote}"
          </div>
        </div>

        {/* Multi-Year Comparison Note */}
        <div className="inspector-comparative-callout">
          <div className="inspector-callout-title">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0 }}>
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="16" x2="12" y2="12" />
              <line x1="12" y1="8" x2="12.01" y2="8" />
            </svg>
            <span>Comparative Multi-Year Disclosure</span>
          </div>
          <p className="inspector-callout-text">
            SEC Form 10-K financial statements report three consecutive years (FY24, FY23, FY22) on this page in side-by-side columns. You do not need to upload prior-year reports to verify comparisons.
          </p>
        </div>

        {/* Document Action */}
        <div className="inspector-action-box">
          <span className="inspector-action-hint">
            Verify original formatting and surrounding disclosures in the official SEC filing:
          </span>
          <div className="inspector-btn-row">
            {onOpenPdfModal && (
              <button
                type="button"
                className="btn-open-sec-pdf btn-open-modal-primary"
                onClick={() => onOpenPdfModal(activeCitation || activeDocument)}
                title={`Open PDF jump-linked to Page ${page}`}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                </svg>
                <span>View Page {page} in PDF</span>
              </button>
            )}
            <a
              href={url}
              target="_blank"
              rel="noreferrer noopener"
              className="btn-open-sec-pdf btn-open-sec-external"
              title={`Open official SEC EDGAR filing for ${company} (${year})`}
            >
              <span>SEC Link ({companyShort}) ↗</span>
            </a>
          </div>
        </div>
      </div>
    </aside>
  );
}
