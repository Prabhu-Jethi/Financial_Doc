"""
Unit tests for API Contracts, Access, and Health Boundaries.
Tests Pydantic models (QueryRequest, QueryResponse, AnswerStatus) and FastAPI endpoints.
"""
import warnings
warnings.filterwarnings('ignore')
import sys
from pathlib import Path
import pytest
from pydantic import ValidationError
from fastapi.testclient import TestClient
from app.schemas import (
    QueryRequest,
    QueryResponse,
    AnswerStatus,
)
from app.main import app
from app.core.security import AuthenticatedUser, get_current_user, get_optional_user
from unittest.mock import patch, MagicMock


# Ensure project root is in sys.path
PROJECT_ROOT = Path(__file__).resolve().parents[2]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))


class TestAccessAndContracts:
    def setup_method(self):
        self.client = TestClient(app)
        ## override auth dependency for offline test execution
        app.dependency_overrides[get_current_user] = lambda: AuthenticatedUser(
            user_id="test_user_id",
            email="analyst@example.com",
            role="authenticated",
            claims={"sub": "test_user_id", "email": "analyst@example.com", "role": "authenticated"}
        )
    
    def teardown_method(self):
        app.dependency_overrides.clear()


    # 1. SCHEMA CONTRACT VALIDATIONS

    def test_query_request_valid(self):
        """Valid query request should construct cleanly."""
        req = QueryRequest(
            question="What was Apple's total net sales in FY2024?",
            company="Apple",
            reporting_periods=["FY2024"]
        )
        assert req.question == "What was Apple's total net sales in FY2024?"
        assert req.company == "Apple"
        assert req.reporting_periods == ["FY2024"]

    def test_query_request_rejects_too_short_question(self):
        """Questions shorter than 5 characters must fail validation."""
        with pytest.raises(ValidationError):
            QueryRequest(question="Hi")

    def test_query_request_default_company(self):
        """Omitting company defaults to Apple Inc."""
        req = QueryRequest(question="What was total revenue?")
        assert req.company == "Apple Inc."

    def test_answer_status_enum_values(self):
        assert AnswerStatus.ANSWERED == "answered"
        assert AnswerStatus.PARTIAL == "partial"
        assert AnswerStatus.NEEDS_CLARIFICATION == "needs_clarification"
        assert AnswerStatus.INSUFFICIENT_EVIDENCE == "insufficient_evidence"
        assert AnswerStatus.OUT_OF_SCOPE == "out_of_scope"

    def test_query_response_minimal_valid(self):
        """QueryResponse should require core fields and default empty evidence lists."""
        res = QueryResponse(
            answer_id="ans_test_001",
            request_id="req_test_001",
            status=AnswerStatus.ANSWERED,
            question="What is the gross margin?",
            answer_text="The gross margin was 46.21%."
        )
        assert res.answer_id == "ans_test_001"
        assert res.citations == []
        assert res.calculations == []
        assert res.status == AnswerStatus.ANSWERED


    # 2. API ENDPOINTS & ACCESS CONTROL

    def test_get_root_metadata(self):
        """GET / must return service metadata without requiring authentication."""
        response = self.client.get("/")
        assert response.status_code == 200
        data = response.json()
        assert "version" in data
        assert data["health_check"] == "/health/ready"

    def test_health_live_endpoint(self):
        """GET /health/live must respond 200 OK without making billed LLM or DB calls."""
        response = self.client.get("/health/live")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "ok"

    def test_query_endpoint_rejects_invalid_payload(self):
        """POST /api/v1/query should reject malformed or too-short queries with HTTP 422."""
        response = self.client.post("/api/v1/query", json={"question": "hi"})
        assert response.status_code == 422

    def test_query_endpoint_rejects_out_of_scope_trading_advice(self):
        """POST /api/v1/query must intercept investment/trading advice and return OUT_OF_SCOPE without initializing models."""
        from app.api.v1 import query as query_module
        query_module._answering_service = None

        advice_queries = [
            "Should I buy or sell Apple stock?",
            "Is Microsoft stock a good buy right now?",
            "Give me stock advice on whether to invest in Amazon"
        ]
        for q in advice_queries:
            response = self.client.post("/api/v1/query", json={"question": q})
            assert response.status_code == 200
            data = response.json()
            assert data["status"] == "out_of_scope"
            assert "investment advice" in data["answer_text"].lower()
            assert len(data["citations"]) == 0
            assert len(data["calculations"]) == 0

        # Assert answering service and its embedding models were never instantiated
        assert query_module._answering_service is None

    def test_upload_endpoint_requires_authentication(self):
        """POST /api/v1/documents/upload must reject unauthenticated requests with HTTP 401."""
        app.dependency_overrides.clear()
        try:
            response = self.client.post(
                "/api/v1/documents/upload",
                files={"file": ("test.pdf", b"%PDF-1.4 mock content", "application/pdf")},
                data={"doc_type": "general"}
            )
            assert response.status_code == 401
        finally:
            mock_user = AuthenticatedUser(
                user_id="test_user_id",
                email="analyst@example.com",
                role="authenticated",
                claims={"sub": "test_user_id", "email": "analyst@example.com", "role": "authenticated"}
            )
            app.dependency_overrides[get_current_user] = lambda: mock_user
            app.dependency_overrides[get_optional_user] = lambda: mock_user

    def test_list_documents_guest_mode_omits_user_uploads(self):
        """GET /api/v1/documents without auth token must return only public SEC benchmark filings, never user uploads."""
        

        mock_rows = [
            ("AAPL-10K-2024", "Apple Inc.", "AAPL", "10-K", 2024, "2024-09-28", "2024-10-31", "local://data/originals/AAPL.pdf", "AAPL.pdf", "ready", "2026-10-01", None),
            ("MSFT-10K-2024", "Microsoft Corporation", "MSFT", "10-K", 2024, "2024-06-30", "2024-08-01", "local://data/originals/MSFT.pdf", "MSFT.pdf", "ready", "2026-10-01", None),
        ]

        mock_conn = MagicMock()
        mock_cur = MagicMock()
        mock_cur.fetchall.return_value = mock_rows
        mock_conn.__enter__.return_value = mock_conn
        mock_conn.cursor.return_value.__enter__.return_value = mock_cur

        app.dependency_overrides[get_optional_user] = lambda: None
        try:
            with patch("app.api.v1.document.psycopg.connect", return_value=mock_conn):
                response = self.client.get("/api/v1/documents")
                assert response.status_code == 200
                docs = response.json()
                assert len(docs) == 2
                for doc in docs:
                    assert not doc["document_id"].startswith("doc_")
                    assert doc.get("source_url") != "user_upload"

                executed_query, executed_params = mock_cur.execute.call_args[0]
                assert "source_url != 'user_upload'" in executed_query
                assert "user_id IS NULL" in executed_query
                assert executed_params == ()
        finally:
            mock_user = AuthenticatedUser(
                user_id="test_user_id",
                email="analyst@example.com",
                role="authenticated",
                claims={"sub": "test_user_id", "email": "analyst@example.com", "role": "authenticated"}
            )
            app.dependency_overrides[get_current_user] = lambda: mock_user
            app.dependency_overrides[get_optional_user] = lambda: mock_user

    def test_list_documents_authenticated_user_includes_own_uploads(self):
        """GET /api/v1/documents with auth token must query for public SEC filings plus user's own uploads."""
        from unittest.mock import patch, MagicMock

        mock_rows = [
            ("AAPL-10K-2024", "Apple Inc.", "AAPL", "10-K", 2024, "2024-09-28", "2024-10-31", "local://data/originals/AAPL.pdf", "AAPL.pdf", "ready", "2026-10-01", None),
            ("doc_custom01", "General", "DOC", "general", 2026, "2026-11-19", "2026-11-19", "user_upload", "contract.pdf", "ready", "2026-11-19", "test_user_id"),
        ]

        mock_conn = MagicMock()
        mock_cur = MagicMock()
        mock_cur.fetchall.return_value = mock_rows
        mock_conn.__enter__.return_value = mock_conn
        mock_conn.cursor.return_value.__enter__.return_value = mock_cur

        with patch("app.api.v1.document.psycopg.connect", return_value=mock_conn):
            response = self.client.get("/api/v1/documents")
            assert response.status_code == 200
            docs = response.json()
            assert len(docs) == 2

            executed_query, executed_params = mock_cur.execute.call_args[0]
            assert "user_id = %s" in executed_query
            assert executed_params == ("test_user_id",)



def main():
    print("Running API Access & Schema Contract unit tests with pytest...\n")
    exit_code = pytest.main([__file__, "-v", "--tb=short"])
    sys.exit(exit_code)


if __name__ == "__main__":
    main()

