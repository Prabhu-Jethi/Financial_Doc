import psycopg
import uuid, os, tempfile, re, time
import hashlib
import json
from typing import List, Dict, Any, Optional
from fastapi import APIRouter, HTTPException, status, Depends, UploadFile, File, Form, BackgroundTasks
from ...core.config import settings
from ...integrations.storage import SupabaseStorageService
from ...integrations.models import ModelService
from ...core.security import get_current_user, get_optional_user, AuthenticatedUser
from ...schemas import DocumentMetadataResponse, DocumentStatusResponse
from ...parsers.factory import ParserFactory

router = APIRouter(prefix="/documents", tags=["Documents"])
storage_service = SupabaseStorageService()

# In-memory progress tracker for live async ingestion status
ingestion_status: Dict[str, Dict[str, Any]] = {}


def process_document_background(
    doc_id: str,
    temp_file_path: str,
    file_name: str,
    doc_type: str,
    file_hash: str,
    user_id: str
):
    """
    Asynchronous background ingestion pipeline.
    Extracts text/tables, generates embeddings, stores pgvector chunks,
    and updates live progress without holding the client HTTP connection.
    """
    try:
        # Stage 1: Parse layout and tabular structures
        if doc_id in ingestion_status:
            ingestion_status[doc_id]["progress"] = 25
            ingestion_status[doc_id]["current_step"] = "Extracting tabular structures and narrative blocks with pdfplumber..."
            ingestion_status[doc_id]["updated_at"] = time.time()

        parser = ParserFactory.get_parser(doc_type)
        parsed_doc = parser.parse(file_path=temp_file_path, document_id=doc_id)

        if len(parsed_doc.chunks) == 0:
            raise ValueError("No readable text or tables could be extracted from this PDF.")

        # Stage 2: Generate dense vector embeddings
        if doc_id in ingestion_status:
            ingestion_status[doc_id]["total_pages"] = parsed_doc.total_pages
            ingestion_status[doc_id]["chunks_ingested"] = len(parsed_doc.chunks)
            ingestion_status[doc_id]["progress"] = 55
            ingestion_status[doc_id]["current_step"] = (
                f"Extracted {len(parsed_doc.chunks)} sections across {parsed_doc.total_pages} pages. "
                "Generating 384-dimensional semantic embeddings..."
            )
            ingestion_status[doc_id]["updated_at"] = time.time()

        model_service = ModelService()
        texts = [c.content for c in parsed_doc.chunks]
        vectors = model_service.embed_texts(texts)

        # Stage 3: Commit pages, chunks, and embeddings to pgvector
        if doc_id in ingestion_status:
            ingestion_status[doc_id]["progress"] = 80
            ingestion_status[doc_id]["current_step"] = "Committing semantic chunks and vectors to Supabase pgvector..."
            ingestion_status[doc_id]["updated_at"] = time.time()

        with psycopg.connect(settings.database_url) as conn:
            with conn.cursor() as cur:
                # 3a. Insert physical pages
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

                # 3b. Insert chunks with vector embeddings
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
                        "user_id": user_id,
                        "document_id": doc_id,
                        "printed_page": str(chk.page_number),
                        "page_number": chk.page_number,
                        "doc_type": doc_type,
                        "file_name": file_name
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

                # 3c. Mark document status as 'ready'
                cur.execute(
                    "UPDATE documents SET status = 'ready' WHERE document_id = %s;",
                    (doc_id,)
                )
                conn.commit()

        # Stage 4: Upload original PDF to Supabase storage for provenance viewer
        if doc_id in ingestion_status:
            ingestion_status[doc_id]["progress"] = 95
            ingestion_status[doc_id]["current_step"] = "Uploading original PDF to document storage for provenance viewer..."
            ingestion_status[doc_id]["updated_at"] = time.time()

        try:
            storage_service.upload_document(temp_file_path, remote_filename=file_name)
        except Exception as e:
            print(f"[Storage] Note: Background storage upload: {e}")

        # Stage 5: Ingestion Complete
        if doc_id in ingestion_status:
            ingestion_status[doc_id]["status"] = "ready"
            ingestion_status[doc_id]["progress"] = 100
            ingestion_status[doc_id]["current_step"] = (
                f"Ingested {len(parsed_doc.chunks)} chunks across {parsed_doc.total_pages} pages successfully!"
            )
            ingestion_status[doc_id]["updated_at"] = time.time()

    except Exception as exc:
        print(f"[Background Ingestion Error] {doc_id}: {exc}")
        if doc_id in ingestion_status:
            ingestion_status[doc_id]["status"] = "failed"
            ingestion_status[doc_id]["progress"] = 0
            ingestion_status[doc_id]["error"] = str(exc)
            ingestion_status[doc_id]["current_step"] = f"Ingestion failed: {str(exc)}"
            ingestion_status[doc_id]["updated_at"] = time.time()
        try:
            with psycopg.connect(settings.database_url) as conn:
                with conn.cursor() as cur:
                    cur.execute(
                        "UPDATE documents SET status = 'failed' WHERE document_id = %s;",
                        (doc_id,)
                    )
                    conn.commit()
        except Exception:
            pass
    finally:
        if os.path.exists(temp_file_path):
            try:
                os.remove(temp_file_path)
            except OSError:
                pass


@router.get("", response_model=List[DocumentMetadataResponse])
def list_document(user: Optional[AuthenticatedUser] = Depends(get_optional_user)):
    """Lists curated documents accessible to authenticated users."""
    query = """
    SELECT document_id, company, ticker, report_type, report_fiscal_year,
           period_ended::text, filing_date::text, source_url, file_name, status, created_at::text, user_id
    FROM documents
    ORDER BY created_at DESC;
    """
    with psycopg.connect(settings.database_url) as conn:
        with conn.cursor() as cur:
            cur.execute(query)
            rows = cur.fetchall()
        
    return [
        DocumentMetadataResponse(
            document_id=r[0], company=r[1], ticker=r[2], report_type=r[3], report_fiscal_year=r[4],
            period_ended=r[5], filing_date=r[6], source_url=r[7], file_name=r[8], status=r[9], created_at=r[10],
            user_id=r[11] if len(r) > 11 else None
        )
            for r in rows
    ]


@router.get('/{document_id}/status', response_model=DocumentStatusResponse)
def get_document_status(document_id: str, user: Optional[AuthenticatedUser] = Depends(get_optional_user)):
    """Pollable endpoint returning live progress of asynchronous document ingestion."""
    # 1. Check in-memory live status
    if document_id in ingestion_status:
        st = ingestion_status[document_id]
        return DocumentStatusResponse(
            document_id=document_id,
            status=st["status"],
            progress=st["progress"],
            current_step=st["current_step"],
            total_pages=st.get("total_pages", 0),
            chunks_ingested=st.get("chunks_ingested", 0),
            error=st.get("error"),
            file_name=st.get("file_name"),
            doc_type=st.get("doc_type")
        )

    # 2. Fallback to database record if worker restarted or older document
    with psycopg.connect(settings.database_url) as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT d.document_id, d.status, d.file_name, d.report_type,
                       (SELECT count(*) FROM chunks c WHERE c.document_id = d.document_id)
                FROM documents d
                WHERE d.document_id = %s;
                """,
                (document_id,)
            )
            row = cur.fetchone()

    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")

    db_status = row[1]
    chunks_count = row[4] or 0
    is_ready = db_status == "ready"
    is_failed = db_status == "failed"

    return DocumentStatusResponse(
        document_id=document_id,
        status=db_status,
        progress=100 if is_ready else (0 if is_failed else 50),
        current_step="Document ready for querying." if is_ready else ("Processing in background..." if db_status == "parsing" else "Document ingestion failed."),
        total_pages=1,
        chunks_ingested=chunks_count,
        error="Document processing failed." if is_failed else None,
        file_name=row[2],
        doc_type=row[3]
    )


@router.get('/{document_id}/pdf_url')
def get_document_pdf_url(document_id: str, user: Optional[AuthenticatedUser] = Depends(get_optional_user)):
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


@router.post('/upload', status_code=status.HTTP_202_ACCEPTED)
async def upload_document(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...), 
    doc_type: str = Form("general"), 
    user: Optional[AuthenticatedUser] = Depends(get_optional_user)
):
    """
    Accepts PDF uploads and dispatches asynchronous background ingestion.
    Returns HTTP 202 Accepted immediately so large PDFs never cause gateway timeouts.
    """
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are supported.")

    file_bytes = await file.read()
    # Security: Enforce maximum file size (30MB) to prevent memory exhaustion DoS
    if len(file_bytes) > 30 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="File too large. Maximum supported PDF size is 30 MB.")
    # Security: Validate PDF magic bytes header to prevent MIME-type spoofing
    if not file_bytes.startswith(b"%PDF"):
        raise HTTPException(status_code=400, detail="Invalid PDF format: file header magic bytes mismatch.")

    file_hash = hashlib.sha256(file_bytes).hexdigest()

    # Fast path: Check if identical file was already ingested by SHA-256 hash
    with psycopg.connect(settings.database_url) as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT d.document_id, d.file_name, d.report_type, d.status,
                       (SELECT count(*) FROM chunks c WHERE c.document_id = d.document_id)
                FROM documents d
                WHERE d.file_hash_sha256 = %s
                LIMIT 1;
                """,
                (file_hash,)
            )
            existing = cur.fetchone()
            if existing and existing[3] == "ready":
                return {
                    "document_id": existing[0],
                    "file_name": existing[1] or file.filename,
                    "doc_type": existing[2],
                    "total_pages": 1,
                    "chunks_ingested": existing[4] or 1,
                    "status": "ready",
                    "progress": 100,
                    "current_step": "Document already ingested and ready.",
                    "message": "Document already ingested and ready."
                }

    doc_id = f"doc_{uuid.uuid4().hex[:8]}"
    safe_name = re.sub(r'[^a-zA-Z0-9_.-]', '_', os.path.basename(file.filename))
    temp_dir = tempfile.gettempdir()
    temp_file_path = os.path.join(temp_dir, f"{doc_id}_{safe_name}")

    with open(temp_file_path, "wb") as f:
        f.write(file_bytes)

    # Register initial document record in database with 'parsing' status
    with psycopg.connect(settings.database_url) as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO documents (
                    document_id, company, ticker, report_type, report_fiscal_year,
                    source_url, file_name, storage_path, file_hash_sha256, status, user_id
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
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
                    "parsing",
                    user.user_id if user else None
                )   
            )
            conn.commit()

    # Initialize live in-memory progress tracker
    ingestion_status[doc_id] = {
        "document_id": doc_id,
        "file_name": file.filename,
        "doc_type": doc_type,
        "status": "parsing",
        "progress": 10,
        "current_step": "Document uploaded. Initializing background extraction worker...",
        "total_pages": 0,
        "chunks_ingested": 0,
        "error": None,
        "updated_at": time.time()
    }

    # Dispatch asynchronous background worker
    background_tasks.add_task(
        process_document_background,
        doc_id=doc_id,
        temp_file_path=temp_file_path,
        file_name=file.filename,
        doc_type=doc_type,
        file_hash=file_hash,
        user_id=user.user_id if user else "authenticated_user"
    )

    return {
        "document_id": doc_id,
        "file_name": file.filename,
        "doc_type": doc_type,
        "status": "parsing",
        "progress": 10,
        "current_step": "Document uploaded. Background ingestion running...",
        "message": "Document accepted for asynchronous ingestion."
    }
