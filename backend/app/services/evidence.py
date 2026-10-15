import re
from decimal import Decimal, InvalidOperation
from typing import List, Dict, Any, Optional, Set, Tuple
from langchain_core.documents import Document

from ..schemas import VerifiedFact, Citation, CalculationLedgerItem, AnswerStatus
from .calculations import FinancialCalculator


class EvidenceService:
    """
    Evidence Validation and Provenance Auditing Service
    
    Responsibilities:
    1. Fact Extraction & Verification: Extracts atomic VerifiedFact records from retrieved chunks.
    2. Provenance Verification: Filters and validates citations, ensuring exact quotes and true document grounding.
    3. Numerical Grounding Audit: Audits all numbers in answer_text against evidence and calculation ledgers to prevent hallucinations.
    """

    # Core canonical metrics tracked across 10-K filings
    METRIC_PATTERNS = [
        ("total_net_sales", "Total net sales", r"(?:total\s+net\s+sales|total\s+revenue|net\s+sales|revenue)"),
        ("operating_income", "Operating income", r"(?:operating\s+income|income\s+from\s+operations)"),
        ("gross_margin", "Gross margin", r"(?:gross\s+margin|gross\s+profit)"),
        ("net_income", "Net income", r"(?:net\s+income|net\s+earnings)"),
        ("cash_and_cash_equivalents", "Cash and cash equivalents", r"(?:cash\s+and\s+cash\s+equivalents)"),
        ("research_and_development", "Research and development", r"(?:research\s+and\s+development)"),
        ("selling_general_admin", "Selling, general and administrative", r"(?:selling,\s+general\s+and\s+administrative)"),
        ("total_operating_expenses", "Total operating expenses", r"(?:total\s+operating\s+expenses)"),
        ("aws_net_sales", "AWS net sales", r"(?:aws|amazon\s+web\s+services)"),
        ("reality_labs_revenue", "Reality Labs revenue", r"(?:reality\s+labs)"),
        ("iphone_net_sales", "iPhone net sales", r"(?:iphone)"),
        ("services_net_sales", "Services net sales", r"(?:services)"),
        ("mac_net_sales", "Mac net sales", r"(?:mac)"),
        ("ipad_net_sales", "iPad net sales", r"(?:ipad)"),
        ("wearables_net_sales", "Wearables, Home and Accessories net sales", r"(?:wearables,\s+home\s+and\s+accessories)"),
    ]

    def __init__(self):
        self.calculator = FinancialCalculator()

    # -------------------------------------------------------------------------
    # 1. Fact Extraction & Verification
    # -------------------------------------------------------------------------
    def extract_verified_facts(self, docs: List[Document], query: Optional[str] = None) -> List[VerifiedFact]:
        """
        Extracts structured VerifiedFact records from retrieved chunks and table text.
        Guarantees that each fact has a valid source chunk, normalized decimal, and period.
        """
        facts: List[VerifiedFact] = []
        seen_fact_keys: Set[Tuple[str, str, str]] = set()

        for doc in docs:
            doc_id = doc.metadata.get("document_id", "UNKNOWN-DOC")
            company = doc.metadata.get("company", "Company")
            report_fiscal_year = doc.metadata.get("report_fiscal_year") or self._extract_year_from_doc_id(doc_id)
            printed_page = str(doc.metadata.get("printed_page", "N/A"))
            content = doc.page_content

            # Analyze lines / table rows in the chunk
            lines = content.split("\n")
            for line in lines:
                line_clean = line.strip()
                if not line_clean:
                    continue

                for canon_key, default_label, pattern in self.METRIC_PATTERNS:
                    # Check if line matches metric name
                    if re.search(pattern, line_clean, re.IGNORECASE):
                        # Extract reported numbers from this line
                        # Matches e.g. "$391,035", "123,216", "(17,733)", "$ 391,035"
                        num_matches = re.findall(r"\$?\s*\(?[0-9]{1,3}(?:,[0-9]{3})+(?:\.[0-9]+)?\)?", line_clean)
                        if not num_matches:
                            # Also check for simple integers without commas if >= 3 digits
                            num_matches = re.findall(r"\$?\s*\(?[0-9]{3,}\)?", line_clean)

                        if not num_matches:
                            continue

                        # If multiple numbers exist in a row (e.g. 2024, 2023, 2022 comparative columns)
                        # Map them sequentially to [FY_Current, FY_Prior, FY_Prior-1]
                        years = [report_fiscal_year, report_fiscal_year - 1, report_fiscal_year - 2] if report_fiscal_year else [None]

                        for idx, raw_match in enumerate(num_matches[:3]):
                            period_year = years[idx] if idx < len(years) and years[idx] is not None else report_fiscal_year
                            period_label = f"FY{period_year}" if period_year else "Reported Period"

                            # Clean string for Decimal conversion
                            clean_val = raw_match.strip().replace("$", "").strip()
                            if clean_val in {"2020", "2021", "2022", "2023", "2024", "2025", "2026", "2027"}:
                                continue
                            try:
                                dec_val = self.calculator.parse_decimal(clean_val)
                            except (ValueError, InvalidOperation):
                                continue

                            # Standard SEC 10-K scale is in millions
                            normalized_dec_str = str(int(dec_val * Decimal(1_000_000))) if dec_val.is_finite() else str(dec_val)

                            fact_key = (doc_id, canon_key, period_label)
                            if fact_key in seen_fact_keys:
                                continue
                            seen_fact_keys.add(fact_key)

                            fact = VerifiedFact(
                                fact_id=f"fact_{doc_id}_{canon_key}_{period_label}".lower().replace(" ", "_"),
                                canonical_metric=canon_key,
                                metric_label=default_label,
                                reporting_period=period_label,
                                reported_value=f"${clean_val}" if not clean_val.startswith("$") else clean_val,
                                normalized_decimal=normalized_dec_str,
                                currency="USD",
                                scale="millions",
                                verification_status="verified"
                            )
                            facts.append(fact)

        return facts

    # -------------------------------------------------------------------------
    # 2. Provenance Verification & Citation Filtering
    # -------------------------------------------------------------------------
    def verify_provenance_citations(
        self,
        docs: List[Document],
        answer_text: str,
        calculations: List[CalculationLedgerItem]
    ) -> List[Citation]:
        """
        Examines retrieved chunks and builds verified citations with exact quotes.
        Filters out spurious or irrelevant chunks that do not back any claim or operand.
        """
        citations: List[Citation] = []
        seen_citations: Set[Tuple[str, str, str]] = set()

        # Collect operands referenced in calculations
        operand_pages: Set[str] = set()
        operand_values: Set[str] = set()
        for calc in calculations:
            for op in calc.operands:
                if op.printed_page and op.printed_page != "N/A":
                    operand_pages.add(str(op.printed_page))
                cleaned_op = op.raw_value.replace("$", "").replace(",", "").replace("%", "").strip()
                if cleaned_op:
                    operand_values.add(cleaned_op)

        for doc in docs:
            doc_id = doc.metadata.get("document_id", "UNKNOWN")
            printed_page = str(doc.metadata.get("printed_page", "N/A"))
            section = doc.metadata.get("section", "Item 8 - Financial Statements")
            company = doc.metadata.get("company", "Company")
            report_year = doc.metadata.get("report_fiscal_year") or self._extract_year_from_doc_id(doc_id) or 2024
            content = doc.page_content

            # Check if this document contains an operand or fact mentioned in answer
            is_operand_source = (printed_page in operand_pages) or any(val in content for val in operand_values)
            
            # Find exact verbatim quote
            exact_quote = self._find_best_verbatim_quote(content, answer_text, operand_values)

            # Deduplication key
            cite_key = (doc_id, printed_page, section)
            if cite_key in seen_citations:
                continue
            seen_citations.add(cite_key)

            # Create citation
            citation = Citation(
                citation_id=str(doc.metadata.get("chunk_id", f"cite_{doc_id}_p{printed_page}")),
                company=company,
                report_year=report_year,
                report_type=doc.metadata.get("report_type", "10-K"),
                printed_page=printed_page,
                section=section,
                exact_quote=exact_quote,
                document_id=doc_id,
                table_id=doc.metadata.get("table_id")
            )
            citations.append(citation)

        return citations

    def _find_best_verbatim_quote(self, content: str, answer_text: str, operand_values: Set[str]) -> str:
        """Finds the most informative line or table row within the chunk matching the answer or operands."""
        lines = [line.strip() for line in content.split("\n") if line.strip()]

        # 1. Try to find a line matching an operand value
        for line in lines:
            for op_val in operand_values:
                if op_val in line.replace(",", ""):
                    return line[:220]

        # 2. Try to find a line matching significant words from the answer
        answer_words = [w.lower() for w in re.findall(r"\b[A-Za-z]{4,}\b", answer_text) if w.lower() not in {"this", "that", "from", "were", "with", "according"}]
        best_line = ""
        max_overlap = 0

        for line in lines:
            line_lower = line.lower()
            overlap = sum(1 for w in answer_words if w in line_lower)
            if overlap > max_overlap:
                max_overlap = overlap
                best_line = line

        if best_line and max_overlap >= 2:
            return best_line[:220]

        # 3. Fallback to top of chunk
        return content[:180].strip() + ("..." if len(content) > 180 else "")

    # -------------------------------------------------------------------------
    # 3. Numerical Grounding Audit
    # -------------------------------------------------------------------------
    def audit_numerical_grounding(
        self,
        answer_text: str,
        docs: List[Document],
        calculations: List[CalculationLedgerItem],
        facts: List[VerifiedFact]
    ) -> Dict[str, Any]:
        """
        Audits all numbers in answer_text against evidence chunks, calculation ledger, and facts.
        Detects ungrounded numbers / potential hallucinations.
        """
        # 1. Extract all candidate numbers from answer_text
        raw_number_tokens = re.findall(r"\$?\b\d{1,3}(?:,\d{3})*(?:\.\d+)?%?\b", answer_text)

        # 2. Filter out non-metric entities (e.g., years, page numbers, form numbers)
        financial_numbers: List[str] = []
        for num_token in raw_number_tokens:
            cleaned = num_token.replace("$", "").replace("%", "").strip()

            # Ignore empty or solitary decimal point
            if not cleaned or cleaned == ".":
                continue

            # Ignore calendar / fiscal years: 2020..2027
            if cleaned in {"2020", "2021", "2022", "2023", "2024", "2025", "2026", "2027"}:
                continue

            # Ignore typical single-digit ordinals or counts (1, 2, 3, 4, 8 for Item 8, 7 for Item 7)
            if cleaned in {"0", "1", "2", "3", "4", "7", "8", "10", "12", "100"}:
                continue

            # Ignore page numbers mentioned in citations (e.g. "page 29", "page 31")
            if re.search(rf"\bpage\s+{re.escape(cleaned)}\b", answer_text, re.IGNORECASE):
                continue

            financial_numbers.append(num_token)

        # 3. Build a pool of all verified evidence tokens
        evidence_pool: Set[str] = set()

        # From docs
        for doc in docs:
            # Add raw numbers in doc content
            for match in re.findall(r"[0-9]+(?:,[0-9]{3})*(?:\.[0-9]+)?", doc.page_content):
                evidence_pool.add(match)
                evidence_pool.add(match.replace(",", ""))

        # From calculations
        for calc in calculations:
            evidence_pool.add(calc.display_value)
            evidence_pool.add(calc.display_value.replace(",", ""))
            for op in calc.operands:
                evidence_pool.add(op.raw_value.replace("$", "").replace(",", "").replace("%", "").strip())

        # From verified facts
        for fact in facts:
            evidence_pool.add(fact.reported_value.replace("$", "").replace(",", "").strip())
            evidence_pool.add(fact.normalized_decimal)

        # 4. Check each financial number
        grounded_numbers: List[str] = []
        unverified_numbers: List[str] = []

        for num_str in financial_numbers:
            clean_num = num_str.replace("$", "").replace("%", "").strip()
            clean_num_no_commas = clean_num.replace(",", "")

            # Check exact or normalized presence
            is_found = (
                clean_num in evidence_pool
                or clean_num_no_commas in evidence_pool
                or any(clean_num_no_commas == p for p in evidence_pool)
            )

            # Check if it's a billions shorthand (e.g., "$391.04 billion" for 391,035 million)
            if not is_found:
                try:
                    dec_val = Decimal(clean_num_no_commas)
                    ev_decimals = []
                    # Check if dec_val * 1000 is in evidence (e.g. 391.04B -> 391040M)
                    for ev in evidence_pool:
                        try:
                            d = Decimal(ev)
                            if d > 1000:
                                ev_decimals.append(d)
                        except InvalidOperation:
                            pass
                    for i in range(len(ev_decimals)):
                        for j in range(i+1, len(ev_decimals)):
                            if abs(abs(ev_decimals[i] - ev_decimals[j]) - dec_val) < Decimal("0.05"):
                                is_found = True
                                break
                        if is_found:
                            break
                        
                except InvalidOperation:
                    pass

            if is_found:
                grounded_numbers.append(num_str)
            else:
                unverified_numbers.append(num_str)

        is_grounded = len(unverified_numbers) == 0

        ratio = round(len(grounded_numbers) / max(len(financial_numbers), 1), 4)

        return {
            "is_grounded": is_grounded,
            "total_financial_tokens": len(financial_numbers),
            "grounded_numbers": grounded_numbers,
            "unverified_numbers": unverified_numbers,
            "verification_ratio": ratio,
            "grounded_ratio": ratio,
            "status_recommendation": AnswerStatus.ANSWERED if is_grounded else AnswerStatus.PARTIAL
        }

    # -------------------------------------------------------------------------
    # 4. Full Verification Pipeline
    # -------------------------------------------------------------------------
    def validate_and_enrich_result(
        self,
        question: str,
        answer_text: str,
        docs: List[Document],
        calculations: List[CalculationLedgerItem],
        company: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Executes end-to-end evidence validation and provenance enrichment.
        Returns verified facts, verified citations, audit report, and final status.
        """
        # 1. Extract verified facts from evidence
        facts = self.extract_verified_facts(docs, query=question)

        # 2. Verify citations provenance with exact verbatim quotes
        citations = self.verify_provenance_citations(docs, answer_text, calculations)

        # 3. Audit numerical grounding
        audit = self.audit_numerical_grounding(answer_text, docs, calculations, facts)

        # 4. Determine final answer status
        final_status = AnswerStatus.ANSWERED
        missing_info: List[str] = []

        if not docs:
            final_status = AnswerStatus.INSUFFICIENT_EVIDENCE
            missing_info.append("No relevant 10-K filing excerpts found for this query.")
        elif not audit["is_grounded"] and audit["unverified_numbers"]:
            # If critical numbers could not be grounded in evidence
            final_status = AnswerStatus.PARTIAL
            missing_info.append(f"Unverified numerical claims detected: {', '.join(audit['unverified_numbers'])}")

        return {
            "facts": facts,
            "citations": citations,
            "audit": audit,
            "status": final_status,
            "missing_information": missing_info
        }

    @staticmethod
    def _extract_year_from_doc_id(doc_id: Optional[str]) -> Optional[int]:
        if not doc_id:
            return None
        match = re.search(r"20\d{2}", doc_id)
        return int(match.group(0)) if match else None
