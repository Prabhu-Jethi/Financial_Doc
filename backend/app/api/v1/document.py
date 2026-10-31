import psycopg
import uuid, os, tempfile
import hashlib
import json
from typing import List
from fastapi import APIRouter, HTTPException, status, Depends, UploadFile, File, Form
from ...core.config import settings
from ...integrations.storage import SupabaseStorageService
from ...integrations.models import ModelService
from ...core.security import get_current_user, AuthenticatedUser
from ...schemas import DocumentMetadataResponse
from ...parsers.factory import ParserFactory


router = APIRouter(prefix="/documents", tags=["Documents"])
storage_service = SupabaseStorageService()

@router.get("", response_model=List[DocumentMetadataResponse])
def list_document(user: AuthenticatedUser = Depends(get_current_user)):
    """Lists curated documents accessible to authenticated users."""
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

@router.get('/{document_id}/pdf_url')
def get_document_pdf_url(document_id: str, user: AuthenticatedUser = Depends(get_current_user)):
    """Generates signed URL for document PDF. Protected by authentication."""
    with psycopg.connect(settings.database_url) as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT file_name FROM documents WHERE document_id = %s;", (document_id,))
            row = cur.fetchone()
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")
    file_name = row[0]
    signed_url = storage_service.get_signed_url(remote_filename=file_name, expires_in_seconds=3600)
    return {"document_id": document_id, "file_name": file_name, "signed_url": signed_url}


@router.post('/upload')
async def upload_document(file: UploadFile = File(...), 
                          doc_type: str = Form("general"), 
                          user: AuthenticatedUser = Depends(get_current_user)):
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are supported.")
    doc_id = f"doc_{uuid.uuid4().hex[:8]}"

    file_bytes = await file.read()
    # Security: Enforce maximum file size (30MB) to prevent memory exhaustion DoS
    if len(file_bytes) > 30 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="File too large. Maximum supported PDF size is 30 MB.")
    # Security: Validate PDF magic bytes header to prevent MIME-type spoofing
    if not file_bytes.startswith(b"%PDF"):
        raise HTTPException(status_code=400, detail="Invalid PDF format: file header magic bytes mismatch.")

    with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp:
        tmp.write(file_bytes)
        temp_file_path = tmp.name
    file_hash = hashlib.sha256(file_bytes).hexdigest()
    try:
        # Check if identical file was already ingested by SHA-256 hash
        with psycopg.connect(settings.database_url) as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT d.document_id, d.file_name, d.report_type,
                           (SELECT count(*) FROM chunks c WHERE c.document_id = d.document_id)
                    FROM documents d
                    WHERE d.file_hash_sha256 = %s
                    LIMIT 1;
                    """,
                    (file_hash,)
                )
                existing = cur.fetchone()
                if existing:
                    return {
                        "document_id": existing[0],
                        "file_name": existing[1] or file.filename,
                        "doc_type": existing[2],
                        "total_pages": 1,
                        "chunks_ingested": existing[3] or 1,
                        "status": "ready",
                        "message": "Document already ingested and ready."
                    }

        parser = ParserFactory.get_parser(doc_type)
        parsed_doc = parser.parse(file_path=temp_file_path, document_id=doc_id)

        if len(parsed_doc.chunks) == 0:
            raise HTTPException(status_code=422, detail="No readable text or tables could be extracted.")
        model_service = ModelService()
        texts = [c.content for c in parsed_doc.chunks]
        vectors = model_service.embed_texts(texts)
        
        with psycopg.connect(settings.database_url) as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO documents (
                        document_id, company, ticker, report_type, report_fiscal_year,
                        source_url, file_name, storage_path, file_hash_sha256, status
                    ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                    ON CONFLICT (document_id) DO NOTHING;
                    """, 
                    (
                        doc_id,
                        "General",
                        "DOC",
                        doc_type,
                        2026,
                        "user_upload",
                        file.filename,
                        f"uploads/{doc_id}.pdf",
                        file_hash,
                        "ready"
                    )   
                )
                page_query = """
                INSERT INTO pages (
                    page_id, document_id, physical_page_index, printed_page, raw_text
                ) VALUES (%s, %s, %s, %s, %s)
                ON CONFLICT (document_id, physical_page_index) DO NOTHING;
                """
                distinct_pages = set(range(1, parsed_doc.total_pages + 1))
                for chk in parsed_doc.chunks:
                    if chk.page_number:
                        distinct_pages.add(chk.page_number)

                for p_num in sorted(distinct_pages):
                    cur.execute(
                        page_query,
                        (f"{doc_id}_p{p_num}", doc_id, p_num, str(p_num), "")
                    )

                chunk_query = """
                INSERT INTO chunks (
                    chunk_id, document_id, page_id, table_id, chunk_type, content, embedding, metadata
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s::jsonb)
                ON CONFLICT (chunk_id) DO NOTHING;
                """
                for chk, vec in zip(parsed_doc.chunks, vectors):
                    vec_str = f"[{','.join(str(x) for x in vec)}]"
                    db_chunk_type = "table_row_group" if chk.chunk_type == "table" else "narrative"
                    meta = {
                        **chk.metadata,
                        "user_id": user.user_id,
                        "document_id": doc_id,
                        "printed_page": str(chk.page_number),
                        "page_number": chk.page_number,
                        "doc_type": doc_type,
                        "file_name": file.filename
                    }
                    cur.execute(
                        chunk_query,
                        (
                            chk.chunk_id,
                            doc_id,
                            f"{doc_id}_p{chk.page_number}" if chk.page_number else None,
                            None,
                            db_chunk_type,
                            chk.content,
                            vec_str,
                            json.dumps(meta)
                        )
                    )
                conn.commit()

        # Upload original PDF to Supabase storage for provenance viewing
        try:
            storage_service.upload_document(temp_file_path, remote_filename=file.filename)
        except Exception as e:
            print(f"[Storage] Note: Storage upload: {e}")

        return {
            "document_id": doc_id,
            "file_name": file.filename,
            "doc_type": doc_type,
            "total_pages": parsed_doc.total_pages,
            "chunks_ingested": len(parsed_doc.chunks),
            "status": "ready"
        }
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to process document: {str(exc)}")
    finally:
        if os.path.exists(temp_file_path):
            os.remove(temp_file_path)

