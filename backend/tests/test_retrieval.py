"""
Unit tests for FinancialRetriever (Dense, Lexical, and Reciprocal Rank Fusion Hybrid Search).
Tests RRF mathematics, compound score boosting, search_mode dispatch, where filter builders, and fallbacks.
"""

import sys
from pathlib import Path
from unittest.mock import patch
import pytest
# Ensure project root & backend are in sys.path
PROJECT_ROOT = Path(__file__).resolve().parents[2]
BACKEND_DIR = Path(__file__).resolve().parents[1]
for path in (PROJECT_ROOT, BACKEND_DIR):
    if str(path) not in sys.path:
        sys.path.insert(0, str(path))

from langchain_core.documents import Document
from app.integrations.models import ModelService
from app.services.retrieval import FinancialRetriever


class MockModelService(ModelService):
    """Mock ModelService to avoid loading HuggingFace/PyTorch weights during unit tests."""
    def __init__(self):
        pass

    def embed_query(self, query: str):
        return [0.1] * 384


class TestFinancialRetriever:
    def setup_method(self):
        self.mock_embedder = MockModelService()
        self.retriever = FinancialRetriever(
            embedding_service=self.mock_embedder,
            db_url="postgresql://mock_user:mock_pass@localhost:5432/mock_db",
            top_k=5,
            rrf_k=60,
            search_mode="hybrid"
        )

    # =========================================================================
    # 1. RECIPROCAL RANK FUSION (RRF) MATHEMATICAL VERIFICATION
    # =========================================================================

    def test_rrf_compounding_boost_single_overlap(self):
        """
        A chunk present in both dense (rank 1) and lexical (rank 1) lists
        must receive a compounded RRF score (1/61 + 1/61 = 0.032787) and rank #1,
        beating a chunk only present in dense (rank 1) or lexical (rank 1).
        """
        dense_docs = [
            Document(page_content="Overlap Content", metadata={"chunk_id": "chunk_OVERLAP", "dense_rank": 1}),
            Document(page_content="Dense Only Content", metadata={"chunk_id": "chunk_DENSE_ONLY", "dense_rank": 2}),
        ]
        lexical_docs = [
            Document(page_content="Overlap Content", metadata={"chunk_id": "chunk_OVERLAP", "lexical_rank": 1, "lexical_score": 0.85}),
            Document(page_content="Lexical Only Content", metadata={"chunk_id": "chunk_LEX_ONLY", "lexical_rank": 2, "lexical_score": 0.72}),
        ]

        fused = self.retriever._reciprocal_rank_fusion(dense_docs, lexical_docs)

        # chunk_OVERLAP should be at rank 0
        assert len(fused) == 3
        top_doc = fused[0]
        assert top_doc.metadata["chunk_id"] == "chunk_OVERLAP"
        
        # Expected score: 1/(60+1) + 1/(60+1) = 2/61 ≈ 0.032787
        expected_score = round((1.0 / 61.0) + (1.0 / 61.0), 6)
        assert top_doc.metadata["rrf_score"] == expected_score

        # Metadata preservation check
        assert top_doc.metadata["dense_rank"] == 1
        assert top_doc.metadata["lexical_rank"] == 1
        assert top_doc.metadata["lexical_score"] == 0.85

    def test_rrf_pure_disjoint_lists_ranked_by_individual_ranks(self):
        """
        When dense and lexical documents are completely disjoint,
        ranks 1 from each branch tie at 1/(60+1) ≈ 0.016393,
        and ranks 2 tie at 1/(60+2) ≈ 0.016129.
        """
        dense_docs = [
            Document(page_content="D1", metadata={"chunk_id": "D1", "dense_rank": 1}),
            Document(page_content="D2", metadata={"chunk_id": "D2", "dense_rank": 2}),
        ]
        lexical_docs = [
            Document(page_content="L1", metadata={"chunk_id": "L1", "lexical_rank": 1, "lexical_score": 0.9}),
            Document(page_content="L2", metadata={"chunk_id": "L2", "lexical_rank": 2, "lexical_score": 0.8}),
        ]

        fused = self.retriever._reciprocal_rank_fusion(dense_docs, lexical_docs)
        assert len(fused) == 4
        
        # Ranks 1 should have score 1/61 ≈ 0.016393
        r1_score = round(1.0 / 61.0, 6)
        r2_score = round(1.0 / 62.0, 6)

        chunk_scores = {doc.metadata["chunk_id"]: doc.metadata["rrf_score"] for doc in fused}
        assert chunk_scores["D1"] == r1_score
        assert chunk_scores["L1"] == r1_score
        assert chunk_scores["D2"] == r2_score
        assert chunk_scores["L2"] == r2_score

    def test_rrf_truncates_to_top_k(self):
        """Fusion must respect self.top_k limit when total candidates exceed top_k."""
        dense_docs = [
            Document(page_content=f"D{i}", metadata={"chunk_id": f"D{i}", "dense_rank": i})
            for i in range(1, 10)
        ]
        lexical_docs = [
            Document(page_content=f"L{i}", metadata={"chunk_id": f"L{i}", "lexical_rank": i, "lexical_score": 0.5})
            for i in range(1, 10)
        ]
        # Total distinct docs = 18. top_k = 5.
        fused = self.retriever._reciprocal_rank_fusion(dense_docs, lexical_docs)
        assert len(fused) == 5

    def test_rrf_empty_inputs_return_empty(self):
        """When both dense and lexical lists are empty, fusion should return empty list."""
        fused = self.retriever._reciprocal_rank_fusion([], [])
        assert fused == []

    # =========================================================================
    # 2. SEARCH MODE ROUTING AND DISPATCH
    # =========================================================================

    def test_search_mode_dense_only(self):
        """search_mode='dense' must invoke only _query_dense."""
        self.retriever.search_mode = "dense"
        mock_dense = [Document(page_content=f"Dense {i}", metadata={"chunk_id": f"C{i}"}) for i in range(10)]
        
        with patch.object(self.retriever, "_query_dense", return_value=mock_dense) as mock_d, \
             patch.object(self.retriever, "_query_lexical") as mock_l:
            
            docs = self.retriever._get_relevant_documents("What was Apple's revenue in 2024?")
            
            mock_d.assert_called_once()
            mock_l.assert_not_called()
            assert len(docs) == self.retriever.top_k
            assert docs[0].page_content == "Dense 0"

    def test_search_mode_lexical_only(self):
        """search_mode='lexical' must invoke only _query_lexical."""
        self.retriever.search_mode = "lexical"
        mock_lexical = [Document(page_content=f"Lexical {i}", metadata={"chunk_id": f"C{i}"}) for i in range(10)]
        
        with patch.object(self.retriever, "_query_dense") as mock_d, \
             patch.object(self.retriever, "_query_lexical", return_value=mock_lexical) as mock_l:
            
            docs = self.retriever._get_relevant_documents("What was Apple's revenue in 2024?")
            
            mock_l.assert_called_once()
            mock_d.assert_not_called()
            assert len(docs) == self.retriever.top_k
            assert docs[0].page_content == "Lexical 0"

    def test_search_mode_hybrid_invokes_both_and_fuses(self):
        """search_mode='hybrid' must invoke both branches and run RRF."""
        self.retriever.search_mode = "hybrid"
        mock_dense = [Document(page_content="D1", metadata={"chunk_id": "C1", "dense_rank": 1})]
        mock_lexical = [Document(page_content="L1", metadata={"chunk_id": "C2", "lexical_rank": 1, "lexical_score": 0.8})]
        
        with patch.object(self.retriever, "_query_dense", return_value=mock_dense) as mock_d, \
             patch.object(self.retriever, "_query_lexical", return_value=mock_lexical) as mock_l, \
             patch.object(self.retriever, "_reciprocal_rank_fusion", wraps=self.retriever._reciprocal_rank_fusion) as mock_rrf:
            
            docs = self.retriever._get_relevant_documents("Total net sales FY2024")
            
            mock_d.assert_called_once()
            mock_l.assert_called_once()
            mock_rrf.assert_called_once()
            assert len(docs) == 2

    def test_search_mode_hybrid_lexical_empty_fallback(self):
        """When lexical search returns 0 results, hybrid cleanly falls back to top dense docs."""
        self.retriever.search_mode = "hybrid"
        mock_dense = [Document(page_content=f"D{i}", metadata={"chunk_id": f"C{i}"}) for i in range(10)]
        
        with patch.object(self.retriever, "_query_dense", return_value=mock_dense), \
             patch.object(self.retriever, "_query_lexical", return_value=[]), \
             patch.object(self.retriever, "_reciprocal_rank_fusion") as mock_rrf:
            
            docs = self.retriever._get_relevant_documents("Some niche financial term")
            
            mock_rrf.assert_not_called()
            assert len(docs) == self.retriever.top_k
            assert docs[0].page_content == "D0"

    # =========================================================================
    # 3. SQL WHERE CLAUSE & METADATA FILTER GENERATION
    # =========================================================================

    def test_where_filters_default_ready_corpus(self):
        """Always enforces ready-corpus isolation."""
        clauses, params = self.retriever._build_where_filters("What is Apple's revenue?")
        assert any("corpus_version IN" in c for c in clauses)
        assert any("status = 'ready'" in c for c in clauses)

    def test_where_filters_company_scoping(self):
        """Specific company scopes document_id query with ILIKE parameter."""
        retriever = FinancialRetriever(
            embedding_service=self.mock_embedder,
            company="Microsoft",
            db_url="postgresql://mock"
        )
        clauses, params = retriever._build_where_filters("What was cloud revenue?")
        assert any("company ILIKE %s" in c for c in clauses)
        assert "%Microsoft%" in params

    def test_where_filters_company_all_ignores_filter(self):
        """Company 'All' or 'Cross-Company' should not constrain by company."""
        for c_name in ["All", "Cross-Company"]:
            retriever = FinancialRetriever(
                embedding_service=self.mock_embedder,
                company=c_name,
                db_url="postgresql://mock"
            )
            clauses, params = retriever._build_where_filters("Compare operating cash flows")
            assert not any("company ILIKE %s" in c for c in clauses)

    def test_where_filters_fiscal_year_detection(self):
        """Detects 2024 / FY24 and 2023 / FY23 tokens in query text."""
        clauses_24, _ = self.retriever._build_where_filters("What was net sales in FY2024?")
        assert any("report_fiscal_year' = '2024'" in c for c in clauses_24)

        clauses_23, _ = self.retriever._build_where_filters("Compare with FY23 results")
        assert any("report_fiscal_year' IN ('2023', '2024')" in c for c in clauses_23)

    def test_where_filters_document_id_isolation(self):
        """When document_id is provided, explicitly filters by document_id = %s."""
        retriever = FinancialRetriever(
            embedding_service=self.mock_embedder,
            document_id="aapl-2024-10k",
            db_url="postgresql://mock"
        )
        clauses, params = retriever._build_where_filters("Gross margin")
        assert any("document_id = %s" in c for c in clauses)
        assert "aapl-2024-10k" in params

def main():
    print("Running FinancialRetriever Hybrid Search & RRF unit tests with pytest...\n")
    exit_code = pytest.main([__file__, "-v", "--tb=short"])
    sys.exit(exit_code)


if __name__ == "__main__":
    main()














if __name__ == "__main__":
    main()