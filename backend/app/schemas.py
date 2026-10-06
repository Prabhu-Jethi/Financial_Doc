from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional, Dict, Any
from enum import Enum

## Status Enums
class AnswerStatus(str, Enum):
    """Auditable query answer status compliant"""
    ANSWERED = "answered"
    PARTIAL = "partial"
    NEEDS_CLARIFICATION = "needs_clarification"
    INSUFFICIENT_EVIDENCE = "insufficient_evidence"
    OUT_OF_SCOPE = "out_of_scope"

## Citations
class Citation(BaseModel):
    """
    Direct provenance link to an original filing page or table.
    Matches citation cards rendered in frontend/src/app/page.jsx.
    """
    citation_id: Optional[str] = None
    company: str = "Apple Inc."
    report_year: int = Field(..., description="Fiscal year (e.g. 2024)")
    report_type: str = Field(default="10-K", description="SEC Filing type (10-K, 10-Q)")
    printed_page: str = Field(..., description="Printed page number from PDF footer")
    section: str = Field(..., description="Filing section (e.g. 'Item 8 - Note 12' or 'Item 7 - MD&A')")
    exact_quote: Optional[str] = Field(None, description="Verbatim snippet from narrative or table cell")
    document_id: Optional[str] = None
    table_id: Optional[str] = None
    source_url: Optional[str] = None
    pdf_url: Optional[str] = Field(None, description="Temporary pre-signed URL to open filing in viewer")

class VerifiedFact(BaseModel):
    """
    Atomic audited financial metric extracted from structured tables.
    Matches facts table in Supabase.
    """
    fact_id: str
    canonical_metric: str = Field(..., description="Normalized metric key, e.g. 'net_sales'")
    metric_label: str = Field(..., description="Original row label, e.g. 'Total net sales'")
    reporting_period: str = Field(..., description="Exact fiscal period, e.g. 'FY2024'")
    reported_value: str = Field(..., description="Raw text from table, e.g. '$391,035'")
    normalized_decimal: str = Field(..., description="Scale-normalized Decimal string, e.g. '391035000000'")
    currency: str = "USD"
    scale: str = "millions"
    verification_status: str = "verified"


## Calculations 
class CalculationOperand(BaseModel):
    """Individual operand sourced for a deterministic formula."""
    name: str = Field(..., description="Operand name, e.g. 'Net Sales FY2024'")
    raw_value: str = Field(..., description="Reported value, e.g. '$391,035M'")
    source_statement: Optional[str] = Field(None, description="e.g. 'Consolidated Statements of Operations'")
    printed_page: Optional[str] = Field(None, description="Page number of the operand cell")

class CalculationLedgerItem(BaseModel):
    """
    Step-by-step verifiable math calculation.
    Rendered in the 'Auditable Calculation Ledger' panel in the UI.
    """
    formula: str = Field(..., description="Standard formula name or definition, e.g. 'Operating Margin %'")
    operands: List[CalculationOperand] = Field(default_factory=list)
    display_value: str = Field(..., description="Calculated Decimal result, e.g. '31.51'")
    unit: str = Field(default="%", description="Unit, e.g. '%', 'percentage points', 'USD in millions'")


## Request and Response 
class QueryRequest(BaseModel):
    """
    Incoming query from the frontend or API client.
    Validated body capped at 16 KiB per TRD § 6.
    """
    question: str = Field(
        ...,
        min_length=5,
        max_length=4000,
        description="Natural language question about Apple 10-K filings."
    )
    company: str = Field(default="Apple Inc.", description="Target company")
    reporting_periods: Optional[List[str]] = Field(
        default=None,
        description="Optional period filters (e.g. ['FY2024'], ['FY2023'])"
    )
    document_id: Optional[str] = Field(None, description="Optional specific document ID filter")
    model_config = ConfigDict(extra="ignore")

class QueryResponse(BaseModel):
    """
    Complete response contract returned by POST /api/v1/query.
    Directly consumed by frontend/src/app/page.jsx.
    """
    answer_id: str
    request_id: str
    status: AnswerStatus = AnswerStatus.ANSWERED
    question: str
    company: str = "Apple Inc."
    reporting_periods: List[str] = Field(default_factory=list)
    answer_text: str = Field(..., description="Cited natural language explanation")
    # Auditable evidence arrays
    citations: List[Citation] = Field(default_factory=list)
    facts: List[VerifiedFact] = Field(default_factory=list)
    calculations: List[CalculationLedgerItem] = Field(default_factory=list)
    missing_information: List[str] = Field(default_factory=list)
    # Provenance metadata
    corpus_version: Optional[str] = "v1.0"
    model_version: Optional[str] = None
    timings_ms: Dict[str, float] = Field(default_factory=dict)
    model_config = ConfigDict(use_enum_values=True)


## Document metadata and system health response
class DocumentMetadataResponse(BaseModel):
    """Returned by GET /api/v1/documents."""
    document_id: str
    company: str
    ticker: str
    report_type: str
    report_fiscal_year: int
    period_ended: Optional[str] = None
    filing_date: Optional[str] = None
    source_url: str
    file_name: str
    status: str
    created_at: Optional[str] = None

class HealthResponse(BaseModel):
    """Returned by GET /health/ready and GET /health/live."""
    status: str
    app: str
    version: str
    database: Optional[str] = None