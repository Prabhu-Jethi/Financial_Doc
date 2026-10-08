import uuid
import time
from fastapi import APIRouter, Header, status
from ..config import settings
from ..integrations.database import LangchainPostgresVector
from ..integrations.models import EmbeddingService
from ..schemas import QueryRequest, QueryResponse, AnswerStatus, Citation

router = APIRouter(prefix="/query", tags=["Query"])

embedding_service = EmbeddingService(model_name="sentence-transformers/all-MiniLM-L6-v2")
vector_store = LangchainPostgresVector(db_url=settings.database_url)

@router.post("", response_model=QueryResponse)
def execute_query(req: QueryRequest, x_request_id: str = Header(default=None)):
    """Executes dense vector search and returns cited response to frontend."""
    start_time = time.time()
    req_id = x_request_id or f"req_{uuid.uuid4().hex[:8]}"
    # 1. Embed query
    query_vector = embedding_service.embed_query(req.question)
    # 2. Retrieve top chunks from ready corpus
    search_results = vector_store.similiarity_search(
        query_embedding=query_vector,
        top_k=5
    )
    # 3. Format citations from retrieved evidence
    citations = []
    evidence_snippets = []
    for chunk in search_results:
        meta = chunk.get("metadata", {})
        citations.append(
            Citation(
                citation_id=chunk["chunk_id"],
                company=req.company,
                report_year=2024, # Default or parsed from doc metadata
                report_type="10-K",
                printed_page=meta.get("printed_page", "N/A"),
                section="Item 8 / Item 7",
                exact_quote=chunk["content"][:200] + "...",
                document_id=chunk.get("document_id"),
                table_id=chunk.get("table_id")
            )
        )
        evidence_snippets.append(chunk["content"])
    # 4. Synthesize answer text (Fixed baseline: cites top retrieved passage)
    if search_results:
        answer_text = (
            f"Based on Apple's Form 10-K filings:\n\n{search_results[0]['content']}"
        )
        query_status = AnswerStatus.ANSWERED
    else:
        answer_text = "No matching financial evidence found for the specified period."
        query_status = AnswerStatus.INSUFFICIENT_EVIDENCE
    elapsed_ms = (time.time() - start_time) * 1000
    return QueryResponse(
        answer_id=f"ans_{uuid.uuid4().hex[:8]}",
        request_id=req_id,
        status=query_status,
        question=req.question,
        company=req.company,
        reporting_periods=req.reporting_periods or [],
        answer_text=answer_text,
        citations=citations,
        facts=[],
        calculations=[],
        timings_ms={"total": round(elapsed_ms, 2)}
    )
