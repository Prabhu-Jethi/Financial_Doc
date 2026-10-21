import uuid
import time
from fastapi import APIRouter, Header, Depends
from ...schemas import QueryRequest, QueryResponse
from ...services.answering import AnswerService
from ...core.security import get_current_user, AuthenticatedUser

router = APIRouter(prefix="/query", tags=["Query"])

answering_service = AnswerService()


@router.post("", response_model=QueryResponse)
def execute_query(
    req: QueryRequest,
    x_request_id: str = Header(default=None),
    user: AuthenticatedUser = Depends(get_current_user),
):
    """
    Executes audited financial Q&A via AnswerService.
    Protected endpoint: Requires valid Supabase Bearer token.
    Extracts verified user_id from token 'sub' claim.
    """
    start_time = time.time()
    req_id = x_request_id or f"req_{uuid.uuid4().hex[:8]}"

    # Execute audited answering pipeline
    result = answering_service.answer_query(
        question=req.question,
        company=req.company,
        document_id=req.document_id
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
