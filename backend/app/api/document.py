import psycopg
from typing import List
from fastapi import APIRouter, HTTPException, status
from ..config import settings
from ..integrations.storage import SupabaseStorageService
from ..schemas import DocumentMetadataResponse

router = APIRouter(prefix="/documents", tags=["Documents"])
storage_service = SupabaseStorageService()

@router.get("", response_model=List[DocumentMetadataResponse])
def list_document():
    query = """
    SELECT document_id, company, ticker, report_type, report_fiscal_year,
           period_ended::text, filing_date::text, source_url, file_name, status, created_at::text
    FROM documents
    ORDER BY report_fiscal_year DESC;
    """
    with psycopg.connect(settings.database_url) as conn:
        with conn.cursor() as cur:
            cur.execute(query)
            rows = cur.fetchall()
        
    return [
        DocumentMetadataResponse(
            document_id=r[0], company=r[1], ticker=r[2], report_type=r[3], report_fiscal_year=r[4],
            period_ended=r[5], filing_date=r[6], source_url=r[7], file_name=r[8], status=r[9], created_at=r[10] 
        )
            for r in rows
    ]

@router.get('/{document_id}/{pdf_url}')
def get_document_pdf_url(document_id: str):
    with psycopg.connect(settings.database_url) as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT file_name FROM documents WHERE document_id = %s;", (document_id,))
            row = cur.fetchone()
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")
    file_name = row[0]
    signed_url = storage_service.get_signed_url(remote_filename=file_name, expires_in_seconds=3600)
    return {"document_id": document_id, "file_name": file_name, "signed_url": signed_url}