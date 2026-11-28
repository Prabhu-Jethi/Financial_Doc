"""
Unit tests for Security Controls:
- Tenant isolation in FinancialRetriever & AnswerService
- Document ownership authorization (_authorize_document_access)
- Sliding-window rate limiting (InMemoryRateLimiter)
- JWT error sanitization in verify_supabase_jwt
"""

from types import SimpleNamespace
from unittest.mock import MagicMock, patch
import pytest
from fastapi import HTTPException
from langchain_core.documents import Document

from app.api.v1.document import _authorize_document_access, _is_public_document, get_document_pdf_url
from app.core.rate_limit import InMemoryRateLimiter
from app.core.security import AuthenticatedUser, verify_supabase_jwt
from app.integrations.models import ModelService
from app.services.answering import AnswerService
from app.services.retrieval import FinancialRetriever


class DummyEmbedder(ModelService):
    def __init__(self):
        pass

    def embed_query(self, query: str):
        return [0.0] * 1536


class TestTenantIsolation:
    def test_retriever_guest_only_allows_public_documents(self):
        retriever = FinancialRetriever(
            embedding_service=DummyEmbedder(),
            db_url="postgresql://mock",
            user_id=None,
        )
        clauses, params = retriever._build_where_filters("revenue")
        joined = " ".join(clauses)
        assert "user_id IS NULL" in joined
        assert "user_id = %s" not in joined
        assert params == []

    def test_retriever_authenticated_user_scopes_to_public_or_owner(self):
        retriever = FinancialRetriever(
            embedding_service=DummyEmbedder(),
            db_url="postgresql://mock",
            user_id="user-abc-123",
        )
        clauses, params = retriever._build_where_filters("revenue")
        joined = " ".join(clauses)
        assert "user_id IS NULL" in joined
        assert "OR user_id = %s" in joined
        assert "user-abc-123" in params

    def test_answer_query_scopes_retriever_copy_per_request(self):
        base_retriever = FinancialRetriever(
            embedding_service=DummyEmbedder(),
            db_url="postgresql://mock",
            user_id=None,
        )
        captured = {}

        def fake_get_docs(self_ret, query, *, run_manager=None):
            captured["user_id"] = self_ret.user_id
            captured["document_id"] = self_ret.document_id
            return []

        mock_llm = MagicMock()
        service = AnswerService(retriever=base_retriever, llm=mock_llm)

        with patch.object(FinancialRetriever, "_get_relevant_documents", autospec=True, side_effect=fake_get_docs):
            res = service.answer_query(
                question="Summarize my contract",
                document_id="doc_12345678",
                user_id="user-owner-1",
            )

        assert res["status"] == "insufficient_evidence"
        assert captured["user_id"] == "user-owner-1"
        assert captured["document_id"] == "doc_12345678"
        # Shared base retriever must remain unmutated across concurrent requests
        assert base_retriever.user_id is None
        assert base_retriever.document_id is None


class TestDocumentAuthorization:
    def test_public_sec_document_allows_guest(self):
        assert _is_public_document("AAPL-10K-2024", "local://aapl.pdf", None) is True
        _authorize_document_access("AAPL-10K-2024", "local://aapl.pdf", None, None)

    def test_private_upload_rejects_unauthenticated_guest(self):
        with pytest.raises(HTTPException) as exc:
            _authorize_document_access("doc_abc12345", "user_upload", "user-1", None)
        assert exc.value.status_code == 401

    def test_private_upload_rejects_different_user(self):
        other_user = AuthenticatedUser(user_id="user-2")
        with pytest.raises(HTTPException) as exc:
            _authorize_document_access("doc_abc12345", "user_upload", "user-1", other_user)
        assert exc.value.status_code == 403

    def test_private_upload_allows_owner(self):
        owner = AuthenticatedUser(user_id="user-1")
        _authorize_document_access("doc_abc12345", "user_upload", "user-1", owner)

    def test_pdf_url_storage_error_returns_clean_404(self):
        mock_conn = MagicMock()
        mock_cur = MagicMock()
        mock_cur.fetchone.return_value = ("secret.pdf", "uploads/u1/doc_1.pdf", "u1", "user_upload")
        mock_conn.__enter__.return_value = mock_conn
        mock_conn.cursor.return_value.__enter__.return_value = mock_cur

        owner = AuthenticatedUser(user_id="u1")
        with patch("app.api.v1.document.psycopg.connect", return_value=mock_conn), \
             patch("app.api.v1.document.storage_service.get_signed_url", side_effect=ValueError("storage boom")):
            with pytest.raises(HTTPException) as exc:
                get_document_pdf_url("doc_1", user=owner)
            assert exc.value.status_code == 404


class TestRateLimiterAndJWT:
    def test_rate_limiter_blocks_after_quota_and_ignores_spoofed_xff(self):
        limiter = InMemoryRateLimiter(max_requests=2, window_seconds=60, key_prefix="test")
        req1 = SimpleNamespace(headers={"x-forwarded-for": "1.1.1.1"}, client=SimpleNamespace(host="127.0.0.1"))
        req2 = SimpleNamespace(headers={"x-forwarded-for": "2.2.2.2"}, client=SimpleNamespace(host="127.0.0.1"))
        req3 = SimpleNamespace(headers={"x-forwarded-for": "3.3.3.3"}, client=SimpleNamespace(host="127.0.0.1"))

        limiter.check(req1, None)
        limiter.check(req2, None)
        with pytest.raises(HTTPException) as exc:
            limiter.check(req3, None)
        assert exc.value.status_code == 429
        assert "Retry-After" in exc.value.headers

    def test_verify_jwt_does_not_leak_internal_exception_details(self):
        with patch("app.core.security.get_cached_jwk_client") as mock_client:
            mock_client.return_value.get_signing_key_from_jwt.side_effect = RuntimeError("internal_jwks_secret_trace")
            with pytest.raises(HTTPException) as exc:
                verify_supabase_jwt("not.a.valid.jwt")
            assert exc.value.status_code == 401
            assert "internal_jwks_secret_trace" not in exc.value.detail

    def test_storage_get_signed_url_supports_lowercase_signed_url_key(self):
        from app.integrations.storage import SupabaseStorageService

        mock_client = MagicMock()
        mock_client.storage.from_.return_value.create_signed_url.return_value = {
            "signedUrl": "/storage/v1/object/sign/original-documents/doc.pdf?token=abc"
        }
        with patch("app.integrations.storage.create_client", return_value=mock_client):
            svc = SupabaseStorageService(supabase_url="https://example.supabase.co", supabase_key="key")
            url = svc.get_signed_url("doc.pdf")

        assert url == "https://example.supabase.co/storage/v1/object/sign/original-documents/doc.pdf?token=abc"
