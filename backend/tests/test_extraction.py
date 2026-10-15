'''Unit tests for Fact Extraction and Normalization. 
Tests EvidenceService.extract_verified_facts against mock SEC 10-K document chunks.'''

import sys
import pytest
from pathlib import Path
from langchain_core.documents import Document
from app.services.evidence import EvidenceService

Project_root = Path(__file__).resolve().parents[2]
if str (Project_root) not in sys.path:
    sys.path.insert(0, str(Project_root))


class TestFactExtraction:
    def setup_method(self):
        self.evidence_service = EvidenceService()

## Metric Extraction

    def test_extract_apple_stmt_ops(self):
        table_chunk = """
        Apple Inc. Consolidated Statements of Operations
        (In millions, except number of shares which are reflected in thousands)
        Years ended September 28, 2024, September 30, 2023, September 24, 2022
        Total net sales $ 391,035   $ 383,285   $ 394,328
        Total cost of sales 210,352   214,137     223,546
        Gross margin 180,683   169,148     170,782
        Research and development 31,370    29,915      26,251
        Selling, general and administrative 26,097    24,932      25,094
        Total operating expenses 57,467    54,847      51,345
        Operating income 123,216   114,301     119,437
        Net income $ 93,736    $ 96,995    $ 99,803
        """
        doc = Document(
            page_content=table_chunk,
            metadata={
                "document_id": "aapl-202410-10k",
                "company": "Apple",
                "report_fiscal_year": 2024,
                "printed_page": "29"
            }
        )

        facts = self.evidence_service.extract_verified_facts([doc])
        # Validate Total Net Sales
        sales_fact = next(f for f in facts if f.canonical_metric == "total_net_sales" and f.reporting_period == "FY2024")
        assert sales_fact.reported_value == "$391,035"
        assert sales_fact.normalized_decimal == "391035000000"
        assert sales_fact.scale == "millions"

        # Validate Operating Income
        op_fact = next(f for f in facts if f.canonical_metric == "operating_income" and f.reporting_period == "FY2024")
        assert op_fact.reported_value == "$123,216"
        assert op_fact.normalized_decimal == "123216000000"

    def test_aapl_product_segment(self):
        table_chunk = """
        Net Sales by Product Category
        (In millions)
        iPhone $ 201,183  $ 200,583  $ 205,489
        Mac 29,984     29,357     40,177
        iPad 26,694     28,300     29,292
        Wearables, Home and Accessories 37,005     39,845     41,241
        Services 96,169     85,200     78,129
        Total net sales $ 391,035  $ 383,285  $ 394,328
        """
        doc = Document(
            page_content=table_chunk,
            metadata={
                "document_id": "aapl-202410-10k",
                "company": "Apple",
                "report_fiscal_year": 2024,
                "printed_page": "Item 7"
            }
        )

        facts = self.evidence_service.extract_verified_facts([doc])

        # Verify iPhone & Services
        iphone_fact = next(f for f in facts if f.canonical_metric == "iphone_net_sales" and f.reporting_period == "FY2024")
        assert iphone_fact.reported_value == "$201,183"

        services_fact = next(f for f in facts if f.canonical_metric == "services_net_sales" and f.reporting_period == "FY2024")
        assert services_fact.reported_value == "$96,169"


    def test_extract_msft_income_stmt(self):
        table_chunk = """
        Microsoft Corporation Income Statements
        (In millions, except per share amounts)
        Year Ended June 30, 2024   2023   2022
        Total revenue $ 245,122  $ 211,915  $ 198,270
        Cost of revenue 72,610     65,863     62,650
        Gross margin 172,512    146,052    135,620
        Research and development 29,510     27,195     24,512
        Operating income 109,433     88,523     83,383
        Net income $ 88,136   $ 72,361   $ 72,738
        """
        doc = Document(
            page_content=table_chunk,
            metadata={
                "document_id": "msft-202406-10k",
                "company": "Microsoft",
                "report_fiscal_year": 2024,
                "printed_page": "64"
            }
        )

        facts = self.evidence_service.extract_verified_facts([doc])

        msft_rev = next(f for f in facts if f.canonical_metric == "total_net_sales" and f.reporting_period == "FY2024")
        assert msft_rev.reported_value == "$245,122"
        assert msft_rev.normalized_decimal == "245122000000"

        msft_op = next(f for f in facts if f.canonical_metric == "operating_income" and f.reporting_period == "FY2024")
        assert msft_op.reported_value == "$109,433"
        assert msft_op.normalized_decimal == "109433000000"

    

    def test_extract_amzn_ops_aws_segment(self):
        table_chunk = """
        Amazon.com, Inc. Note 10 - Segment Information
        Year Ended December 31, 2024  2023  2022
        Net Sales:
        North America $ 387,489  $ 352,828  $ 315,880
        International 148,004    131,200    118,016
        AWS 107,556     90,752     80,096
        Consolidated $ 643,049  $ 574,780  $ 513,992
        """
        doc = Document(
            page_content=table_chunk,
            metadata={
                "document_id": "amzn-202412-10k",
                "company": "Amazon",
                "report_fiscal_year": 2024,
                "printed_page": "24"
            }
        )

        facts = self.evidence_service.extract_verified_facts([doc])

        aws_fact = next(f for f in facts if f.canonical_metric == "aws_net_sales" and f.reporting_period == "FY2024")
        assert aws_fact.reported_value == "$107,556"
        assert aws_fact.normalized_decimal == "107556000000"

    

    def test_extract_meta_income_reality_lab_loss(self):
        table_chunk = """
        Meta Platforms, Inc. Consolidated Statements of Income
        Year Ended December 31, 2024  2023  2022
        Revenue $ 164,501  $ 134,902  $ 116,609
        Costs and expenses 95,050     88,151     87,665
        Income from operations 69,451     46,751     28,944
        Segment operating results:
        Family of Apps 83,085     52,709     35,274
        Reality Labs (17,729)   (16,128)   (13,717)
        """
        doc = Document(
            page_content=table_chunk,
            metadata={
                "document_id": "meta-202412-10k",
                "company": "Meta",
                "report_fiscal_year": 2024,
                "printed_page": "71"
            }
        )
        facts = self.evidence_service.extract_verified_facts([doc])
        # Verify Meta Revenue
        meta_rev = next(f for f in facts if f.canonical_metric == "total_net_sales" and f.reporting_period == "FY2024")
        assert meta_rev.reported_value == "$164,501"
        assert meta_rev.normalized_decimal == "164501000000"
        # Verify Reality Labs Loss with parentheses
        rl_loss = next(f for f in facts if f.canonical_metric == "reality_labs_revenue" and f.reporting_period == "FY2024")
        assert rl_loss.reported_value == "$(17,729)"
        assert rl_loss.normalized_decimal == "-17729000000"


    ## Cross Cutting integrity tests
    def test_ignore_calendar_years_as_dollar_amounts(self):
        """Ensures that column headers like '2024' are never parsed as $2,024M."""
        header_chunk = """
        Years Ended December 31,
        2024    2023    2022
        Revenue:
        Total revenue $ 245,120 $ 211,915 $ 198,270
        """
        doc = Document(
            page_content=header_chunk,
            metadata={"document_id": "msft-202406-10k", "report_fiscal_year": 2024}
        )

        facts = self.evidence_service.extract_verified_facts([doc])

        extracted_values = {f.reported_value.replace("$", "") for f in facts}
        assert "2024" not in extracted_values
        assert "2023" not in extracted_values
        assert "2022" not in extracted_values

    def test_deduplicate_identical_lines_across_chunks(self):
        """Multiple chunks containing identical line items must not emit duplicate facts."""
        chunk = "Total net sales $ 391,035"
        doc1 = Document(page_content=chunk, metadata={"document_id": "doc1", "report_fiscal_year": 2024})
        doc2 = Document(page_content=chunk, metadata={"document_id": "doc1", "report_fiscal_year": 2024})

        facts = self.evidence_service.extract_verified_facts([doc1, doc2])
        assert len(facts) == 1


def main():
    print("Running multi-company Fact Extraction unit tests with pytest...\n")
    exit_code = pytest.main([__file__, "-v", "--tb=short"])
    sys.exit(exit_code)



if __name__ == "__main__":
    main()
