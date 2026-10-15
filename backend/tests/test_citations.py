"""
Unit tests for Citation Provenance and Numerical Grounding Audit.
Tests EvidenceService.verify_provenance_citations and EvidenceService.audit_numerical_grounding.
"""

import sys
from pathlib import Path
import pytest
from langchain_core.documents import Document
from app.services.evidence import EvidenceService
from app.schemas import (
    CalculationLedgerItem,
    CalculationOperand,
)

# Ensure project root is in sys.path
PROJECT_ROOT = Path(__file__).resolve().parents[2]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))



class TestCitationsAndGrounding:
    def setup_method(self):
        self.evidence_service = EvidenceService()

    # =========================================================================
    # 1. VERBATIM PROVENANCE CITATION TESTS
    # =========================================================================
    def test_verify_provenance_extracts_verbatim_operand_quote(self):
        """Should extract the exact line matching the calculation operand."""
        content = """
        Apple Inc. Consolidated Statements of Operations
        Total net sales $ 391,035   $ 383,285
        Operating income 123,216   114,301
        Net income $ 93,736    $ 96,995
        """
        doc = Document(
            page_content=content,
            metadata={
                "document_id": "aapl-202410-10k",
                "company": "Apple Inc.",
                "report_fiscal_year": 2024,
                "printed_page": "29",
                "section": "Consolidated Statements of Operations",
                "chunk_id": "CHK_AAPL_OP_29"
            }
        )

        calculations = [
            CalculationLedgerItem(
                formula="(Operating Income / Total Net Sales) * 100",
                display_value="31.51",
                unit="%",
                operands=[
                    CalculationOperand(name="Operating Income", raw_value="123,216", printed_page="29"),
                    CalculationOperand(name="Total Net Sales", raw_value="391,035", printed_page="29"),
                ]
            )
        ]

        citations = self.evidence_service.verify_provenance_citations(
            docs=[doc],
            answer_text="Apple's operating margin for FY2024 was 31.51%.",
            calculations=calculations
        )

        assert len(citations) == 1
        cite = citations[0]
        assert cite.company == "Apple Inc."
        assert cite.printed_page == "29"
        assert cite.report_year == 2024
        # Verbatim quote should capture the operand line
        assert "123,216" in cite.exact_quote or "391,035" in cite.exact_quote

    def test_verify_provenance_deduplicates_chunks_on_same_page(self):
        """Should not emit duplicate citations for multiple chunks from identical page & section."""
        doc1 = Document(
            page_content="Total revenue $ 245,122",
            metadata={"document_id": "msft-1", "company": "Microsoft", "printed_page": "64", "section": "Income Statements"}
        )
        doc2 = Document(
            page_content="Operating income 109,433",
            metadata={"document_id": "msft-1", "company": "Microsoft", "printed_page": "64", "section": "Income Statements"}
        )

        citations = self.evidence_service.verify_provenance_citations(
            docs=[doc1, doc2],
            answer_text="Microsoft generated $245,122 million in total revenue.",
            calculations=[]
        )

        assert len(citations) == 1
        assert citations[0].printed_page == "64"

    # =========================================================================
    # 2. NUMERICAL GROUNDING AUDITOR TESTS
    # =========================================================================
    def test_audit_grounding_clean_supported_answer(self):
        """Answer containing only verified facts and ledger numbers must pass audit."""
        doc = Document(
            page_content="Total net sales $ 391,035\nOperating income 123,216",
            metadata={"document_id": "doc1", "printed_page": "29"}
        )

        calculations = [
            CalculationLedgerItem(
                formula="(Operating Income / Net Sales) * 100",
                display_value="31.51",
                unit="%",
                operands=[
                    CalculationOperand(name="Operating Income", raw_value="123,216", printed_page="29"),
                    CalculationOperand(name="Net Sales", raw_value="391,035", printed_page="29"),
                ]
            )
        ]

        answer = "In FY2024, Apple reported Total Net Sales of $391,035 million and Operating Income of $123,216 million, yielding an operating margin of 31.51% (page 29)."

        audit = self.evidence_service.audit_numerical_grounding(
            answer_text=answer,
            docs=[doc],
            calculations=calculations,
            facts=[]
        )

        assert audit["is_grounded"] is True
        assert len(audit["unverified_numbers"]) == 0
        assert audit["grounded_ratio"] == 1.0

    def test_audit_grounding_catches_hallucinated_number(self):
        """Auditor must flag numbers in answer_text that appear nowhere in evidence or ledger."""
        doc = Document(
            page_content="Total net sales $ 391,035",
            metadata={"document_id": "doc1", "printed_page": "29"}
        )

        answer = "Apple reported Total Net Sales of $391,035 million with a secret bonus of $888,888 million."

        audit = self.evidence_service.audit_numerical_grounding(
            answer_text=answer,
            docs=[doc],
            calculations=[],
            facts=[]
        )

        assert audit["is_grounded"] is False
        assert any("888,888" in num for num in audit["unverified_numbers"])
        assert audit["grounded_ratio"] < 1.0

    def test_audit_grounding_ignores_formula_multiplier_100(self):
        """Formula constant 100 in explanation must never be flagged as an ungrounded hallucination."""
        doc = Document(
            page_content="AWS 107,556\nTotal net sales 643,049",
            metadata={"document_id": "doc1", "printed_page": "24"}
        )

        answer = "Operating margin was computed as (107,556 / 643,049) * 100 = 16.73%."

        calculations = [
            CalculationLedgerItem(
                formula="(AWS / Total) * 100",
                display_value="16.73",
                unit="%",
                operands=[
                    CalculationOperand(name="AWS", raw_value="107,556"),
                    CalculationOperand(name="Total", raw_value="643,049"),
                ]
            )
        ]

        audit = self.evidence_service.audit_numerical_grounding(
            answer_text=answer,
            docs=[doc],
            calculations=calculations,
            facts=[]
        )

        assert "100" not in audit["unverified_numbers"]
        assert audit["is_grounded"] is True

    def test_audit_grounding_accepts_derived_variance_differences(self):
        """Derived differences between document numbers (e.g. $10,969M) should be accepted as grounded."""
        doc = Document(
            page_content="Services 96,169 85,200",
            metadata={"document_id": "doc1", "printed_page": "29"}
        )

        # 96,169 - 85,200 = 10,969
        answer = "Services revenue grew from $85,200 million to $96,169 million, an increase of $10,969 million."

        audit = self.evidence_service.audit_numerical_grounding(
            answer_text=answer,
            docs=[doc],
            calculations=[],
            facts=[]
        )

        assert audit["is_grounded"] is True
        assert len(audit["unverified_numbers"]) == 0



def main():
    print("Running Citation & Provenance Grounding unit tests with pytest...\n")
    exit_code = pytest.main([__file__, "-v", "--tb=short"])
    sys.exit(exit_code)


if __name__ == "__main__":
    main()

