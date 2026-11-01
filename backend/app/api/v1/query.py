import uuid
import time
from typing import Optional
from fastapi import APIRouter, Header, Depends
from ...schemas import QueryRequest, QueryResponse
from ...services.answering import AnswerService
from ...core.security import get_optional_user, AuthenticatedUser

router = APIRouter(prefix="/query", tags=["Query"])

_answering_service = None


def get_answering_service() -> AnswerService:
    """Lazy-initializes AnswerService on first query to prevent blocking ASGI startup."""
    global _answering_service
    if _answering_service is None:
        _answering_service = AnswerService()
    return _answering_service


@router.post("", response_model=QueryResponse)
def execute_query(
    req: QueryRequest,
    x_request_id: str = Header(default=None),
    user: Optional[AuthenticatedUser] = Depends(get_optional_user),
):
    """
    Executes audited financial and document Q&A via AnswerService.
    Supports optional Supabase Bearer token authentication.
    """
    start_time = time.time()
    req_id = x_request_id or f"req_{uuid.uuid4().hex[:8]}"

    # Execute audited answering pipeline via lazy-initialized service
    answering_svc = get_answering_service()
    doc_ids = req.document_ids or ([req.document_id] if req.document_id else None)
    result = answering_svc.answer_query(
        question=req.question,
        company=req.company,
        document_id=req.document_id,
        document_ids=doc_ids
    )

    elapsed_ms = (time.time() - start_time) * 1000

    return QueryResponse(
        answer_id=f"ans_{uuid.uuid4().hex[:8]}",
        request_id=req_id,
        status=result["status"],
        question=req.question,
        company=req.company,
        reporting_periods=req.reporting_periods or [],
        answer_text=result["answer_text"],
        citations=result["citations"],
        facts=result.get("facts", []),
        calculations=result.get("calculations", []),
        missing_information=result.get("missing_information", []),
        timings_ms={"total": round(elapsed_ms, 2)}
    )

