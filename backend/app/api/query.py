import uuid
import time
from fastapi import APIRouter, Header
from ..schemas import QueryRequest, QueryResponse
from ..services.answering import AnswerService

router = APIRouter(prefix="/query", tags=["Query"])

answering_service = AnswerService()


@router.post("", response_model=QueryResponse)
def execute_query(req: QueryRequest, x_request_id: str = Header(default=None)):
    """Executes audited financial Q&A via AnswerService and returns cited response to frontend."""
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
        facts=[],
        calculations=result.get("calculations", []),
        timings_ms={"total": round(elapsed_ms, 2)}
    )
