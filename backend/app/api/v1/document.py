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
from ...core.rate_limit import rate_limit
from ...schemas import DocumentMetadataResponse, DocumentStatusResponse
from ...parsers.factory import ParserFactory

router = APIRouter(prefix="/documents", tags=["Documents"])
storage_service = SupabaseStorageService()

MAX_PDF_UPLOAD_BYTES = 30 * 1024 * 1024
UPLOAD_READ_CHUNK_BYTES = 1024 * 1024
INGESTION_STATUS_TTL_SECONDS = 3600

_limit_upload = rate_limit(5, 300, "upload")
_limit_pdf = rate_limit(60, 60, "pdf")

# In-memory progress tracker for live async ingestion status
ingestion_status: Dict[str, Dict[str, Any]] = {}


def _is_public_document(document_id: str, source_url: Optional[str], doc_user_id: Optional[str]) -> bool:
    """Returns True only for built-in public SEC filings, never user-uploaded documents."""
    return (
        doc_user_id is None
        and source_url != "user_upload"
        and not str(document_id).startswith("doc_")
    )


def _authorize_document_access(
    document_id: str,
    source_url: Optional[str],
    doc_user_id: Optional[str],
    user: Optional[AuthenticatedUser],
) -> None:
    """Enforces strict owner-only access for user-uploaded documents."""
    if _is_public_document(document_id, source_url, doc_user_id):
        return
    if not user or not user.user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required to access this document.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    if doc_user_id != user.user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to access this document.",
        )


def process_document_background(
    doc_id: str,
    temp_file_path: str,
    file_name: str,
    doc_type: str,
    file_hash: str,
    user_id: str,
    storage_key: Optional[str] = None
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
                "Generating 1536-dimensional semantic embeddings with text-embedding-3-small..."
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
            remote_path = storage_key or f"uploads/{user_id}/{doc_id}.pdf"
            storage_service.upload_document(temp_file_path, remote_filename=remote_path)
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
        safe_error = str(exc) if isinstance(exc, ValueError) else "Document processing failed."
        if doc_id in ingestion_status:
            ingestion_status[doc_id]["status"] = "failed"
            ingestion_status[doc_id]["progress"] = 0
            ingestion_status[doc_id]["error"] = safe_error
            ingestion_status[doc_id]["current_step"] = f"Ingestion failed: {safe_error}"
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
    """
    Lists curated documents accessible to the requester.
    - Unauthenticated guests: Returns ONLY public SEC Form 10-K benchmark filings (uploaded documents section is empty).
    - Authenticated users: Returns public SEC Form 10-K benchmark filings PLUS only their own uploaded documents.
    """
    if user is None or not user.user_id:
        query = """
        SELECT document_id, company, ticker, report_type, report_fiscal_year,
               period_ended::text, filing_date::text, source_url, file_name, status, created_at::text, user_id
        FROM documents
        WHERE (source_url != 'user_upload' AND document_id NOT LIKE 'doc_%%' AND user_id IS NULL)
        ORDER BY created_at DESC;
        """
        params = ()
    else:
        query = """
        SELECT document_id, company, ticker, report_type, report_fiscal_year,
               period_ended::text, filing_date::text, source_url, file_name, status, created_at::text, user_id
        FROM documents
        WHERE (source_url != 'user_upload' AND document_id NOT LIKE 'doc_%%' AND user_id IS NULL)
           OR user_id = %s
        ORDER BY created_at DESC;
        """
        params = (user.user_id,)

    with psycopg.connect(settings.database_url) as conn:
        with conn.cursor() as cur:
            cur.execute(query, params)
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
    # 1. Check in-memory live status (owner-restricted)
    if document_id in ingestion_status:
        st = ingestion_status[document_id]
        _authorize_document_access(document_id, "user_upload", st.get("user_id"), user)
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
                       (SELECT count(*) FROM chunks c WHERE c.document_id = d.document_id),
                       d.user_id, d.source_url
                FROM documents d
                WHERE d.document_id = %s;
                """,
                (document_id,)
            )
            row = cur.fetchone()

    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")

    _authorize_document_access(document_id, row[6], row[5], user)

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


@router.get('/{document_id}/pdf_url', dependencies=[Depends(_limit_pdf)])
def get_document_pdf_url(document_id: str, user: Optional[AuthenticatedUser] = Depends(get_optional_user)):
    """Generates signed URL for document PDF. Protected by document ownership authorization."""
    with psycopg.connect(settings.database_url) as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT file_name, storage_path, user_id, source_url FROM documents WHERE document_id = %s;",
                (document_id,)
            )
            row = cur.fetchone()
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")

    file_name, storage_path, doc_user_id, source_url = row
    _authorize_document_access(document_id, source_url, doc_user_id, user)

    is_public = _is_public_document(document_id, source_url, doc_user_id)
    remote_key = file_name if is_public else (storage_path or file_name)

    try:
        signed_url = storage_service.get_signed_url(remote_filename=remote_key, expires_in_seconds=3600)
    except Exception:
        # Backward compatibility fallback for legacy uploads stored under raw file_name
        if not is_public and remote_key != file_name:
            try:
                signed_url = storage_service.get_signed_url(remote_filename=file_name, expires_in_seconds=3600)
            except Exception:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document PDF not found")
        else:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document PDF not found")

    return {"document_id": document_id, "file_name": file_name, "signed_url": signed_url}


@router.post('/upload', status_code=status.HTTP_202_ACCEPTED, dependencies=[Depends(_limit_upload)])
async def upload_document(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...), 
    doc_type: str = Form("general"), 
    user: AuthenticatedUser = Depends(get_current_user)
):
    """
    Accepts PDF uploads and dispatches asynchronous background ingestion.
    Returns HTTP 202 Accepted immediately so large PDFs never cause gateway timeouts.
    """
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are supported.")

    # Validate doc_type early before reading upload stream
    ParserFactory.get_parser(doc_type)

    # Security: Stream upload in bounded chunks to prevent memory exhaustion DoS
    buffer = bytearray()
    while True:
        chunk = await file.read(UPLOAD_READ_CHUNK_BYTES)
        if not chunk:
            break
        if len(buffer) + len(chunk) > MAX_PDF_UPLOAD_BYTES:
            raise HTTPException(status_code=413, detail="File too large. Maximum supported PDF size is 30 MB.")
        buffer.extend(chunk)

    file_bytes = bytes(buffer)
    if not file_bytes:
        raise HTTPException(status_code=400, detail="Uploaded PDF file is empty.")

    # Security: Validate PDF magic bytes header to prevent MIME-type spoofing
    if not file_bytes.startswith(b"%PDF"):
        raise HTTPException(status_code=400, detail="Invalid PDF format: file header magic bytes mismatch.")

    file_hash = hashlib.sha256(file_bytes).hexdigest()
    # Strip both POSIX and Windows directory components regardless of host OS
    safe_display_name = re.split(r"[\\/]", file.filename)[-1] or "document.pdf"

    # Fast path: Check if identical file was already ingested by THIS user
    with psycopg.connect(settings.database_url) as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT d.document_id, d.file_name, d.report_type, d.status,
                       (SELECT count(*) FROM chunks c WHERE c.document_id = d.document_id)
                FROM documents d
                WHERE d.file_hash_sha256 = %s
                  AND d.user_id = %s
                LIMIT 1;
                """,
                (file_hash, user.user_id)
            )
            existing = cur.fetchone()
            if existing and existing[3] == "ready":
                return {
                    "document_id": existing[0],
                    "file_name": existing[1] or safe_display_name,
                    "doc_type": existing[2],
                    "total_pages": 1,
                    "chunks_ingested": existing[4] or 1,
                    "status": "ready",
                    "progress": 100,
                    "current_step": "Document already ingested and ready.",
                    "message": "Document already ingested and ready."
                }

    doc_id = f"doc_{uuid.uuid4().hex[:12]}"
    safe_name = re.sub(r'[^a-zA-Z0-9_.-]', '_', safe_display_name)
    temp_dir = tempfile.gettempdir()
    temp_file_path = os.path.join(temp_dir, f"{doc_id}_{safe_name}")
    storage_key = f"uploads/{user.user_id}/{doc_id}.pdf"

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
                    safe_display_name,
                    storage_key,
                    file_hash,
                    "parsing",
                    user.user_id
                )   
            )
            conn.commit()

    # Evict expired in-memory progress entries before inserting
    now = time.time()
    expired_ids = [
        k for k, v in ingestion_status.items()
        if now - v.get("updated_at", now) > INGESTION_STATUS_TTL_SECONDS
    ]
    for expired_id in expired_ids:
        ingestion_status.pop(expired_id, None)

    # Initialize live in-memory progress tracker
    ingestion_status[doc_id] = {
        "document_id": doc_id,
        "user_id": user.user_id,
        "file_name": safe_display_name,
        "doc_type": doc_type,
        "status": "parsing",
        "progress": 10,
        "current_step": "Document uploaded. Initializing background extraction worker...",
        "total_pages": 0,
        "chunks_ingested": 0,
        "error": None,
        "updated_at": now
    }

    # Dispatch asynchronous background worker
    background_tasks.add_task(
        process_document_background,
        doc_id=doc_id,
        temp_file_path=temp_file_path,
        file_name=safe_display_name,
        doc_type=doc_type,
        file_hash=file_hash,
        user_id=user.user_id,
        storage_key=storage_key
    )

    return {
        "document_id": doc_id,
        "file_name": safe_display_name,
        "doc_type": doc_type,
        "status": "parsing",
        "progress": 10,
        "current_step": "Document uploaded. Background ingestion running...",
        "message": "Document accepted for asynchronous ingestion."
    }
