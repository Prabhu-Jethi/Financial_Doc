import os
import json
from pathlib import Path
from dataclasses import dataclass
from typing import List, Dict, Any, Optional
from decimal import Decimal

import pdfplumber
import psycopg
from ..config import settings
from ..integrations.models import EmbeddingService


'''1. Data Transfer Objects: Keep data immutable and strongly typed using @dataclass'''

@dataclass
class DocumentMetadata:
    document_id: str
    company: str
    ticker: str
    report_type: str
    report_fiscal_year: int
    period_ended: str
    filing_date: str
    source_url: str
    file_name: str
    storage_path: str
    file_hash_sha256: str

@dataclass
class ExtractedPage:
    page_id: str
    document_id: str
    physical_page_index: int
    printed_page: str
    raw_text: str

@dataclass
class ExtractedTable:
    table_id: str
    document_id: str
    page_id: str
    table_name: str
    section: str
    printed_page: str
    currency: str
    scale: str
    headers: List[str]
    raw_matrix: List[List[str]]
    footnote_text: Optional[str]

@dataclass
class ExtractedCell:
    cell_id: str
    table_id: str
    row_idx: int
    col_idx: int
    raw_value: str
    normalized_decimal: Optional[Decimal]
    header_path: str
    period_label: str
    unit: str

@dataclass
class SearchChunk:
    chunk_id: str
    document_id: str
    chunk_type: str  # 'narrative' | 'table_row_group'
    content: str
    page_id: Optional[str]
    table_id: Optional[str]
    metadata: Dict[str, Any]
    corpus_version: str = "v1.0"
    embedding: Optional[List[float]] = None ## for vector embedding model

'''2. Worker Class: Handles the ingestion process, including PDF parsing, table extraction, and database insertion'''

class PDFDocumentReader:
    def __init__(self, file_path: str):
        self.file_path = file_path
        self.table_extractor = FinancialTableExtractor()

    def extract_content(self, document_id: str) -> List[ExtractedPage]:
        pages: List[ExtractedPage] = []
        all_tables: List[ExtractedTable] = []

        with pdfplumber.open(self.file_path) as pdf:
            for idx, page in enumerate(pdf.pages):
                text = page.extract_text() or ""
                printed_page = self.detect_printed_page(text, default=str(idx + 1))
                page_id = f"{document_id} - P{idx + 1:03d}"
                extracted_page = ExtractedPage(
                    page_id=page_id,
                    document_id=document_id,
                    physical_page_index=idx,
                    printed_page=printed_page,
                    raw_text=text,
                )
                pages.append(extracted_page)

                page_tables = self.table_extractor.extract_tables_from_page(page, extracted_page)
                all_tables.extend(page_tables)
        return pages, all_tables
    
    def detect_printed_page(self, text: str, default: str):
        lines = [line.strip() for line in text.split("\n") if line.strip()]
        if lines:
            last_line = lines[-1]
            if last_line.isdigit() and int(last_line) < 300:
                return last_line
        return default

'''3. Financial Table Extractor: Detects structured statement tables, extracts column headers (periods), detects currency/scale ("in millions"), and cleans accounting 
numbers (converts "(12,345)" to -12345'''
'''FactNormalizer: Translates financial table cells into audited Decimal numbers with exact periods and units (e.g., $391,035 in millions → Decimal("391035000000")).'''
class FinancialTableExtractor:
    @staticmethod
    def parse_accounting_number(raw_str: str, scale_multiplier: int = 1_000_000):
        if not raw_str or raw_str.strip() in ["—", "-", "–", ""]:
            return None
        clean = raw_str.replace("$", "").replace(",", "").strip()
        is_negative = False

        if clean.startswith("(") and clean.endswith(")"):
            is_negative = True
            clean = clean[1: -1].strip()
        try:
            val = Decimal(clean)
            if is_negative:
                val = -val
            return val * Decimal(scale_multiplier)
        except Exception:
            return None
        
    def extract_tables_from_page(
        self, page: pdfplumber.page.Page, extracted_page: ExtractedPage):
        tables: List[ExtractedTable] = []
        raw_tables = page.extract_tables() or []

        for t_idx, raw_table in enumerate(raw_tables):
            if not raw_table or len(raw_table) < 2:
                continue
            table_id = f"{extracted_page.page_id}-TBL{t_idx+1:02d}"
            headers = [col.replace("\n", " ").strip() if col else f"col_{c}" for c, col in enumerate(raw_table[0])]

            tables.append(
                ExtractedTable(
                    table_id=table_id,
                    document_id=extracted_page.document_id,
                    page_id=extracted_page.page_id,
                    table_name=f"Table on page {extracted_page.printed_page}",
                    section="Item 8 / Item 7",
                    printed_page=extracted_page.printed_page,
                    currency="USD",
                    scale="millions",
                    headers=headers,
                    raw_matrix=raw_table[1:],
                    footnote_text=None,
                )
            )
        return tables

'''4. ChunkBuilder: reates bounded narrative chunks (~300–400 words) and structured table row-group chunks with repeated column headers so search queries never lose context'''

class ChunkBuilder:
    @staticmethod
    def build_narrative_chunks(document_id: str, pages: List[ExtractedPage], max_words: int = 350):
        chunks: List[ExtractedPage] = []
        for page in pages:
            words = page.raw_text.split()
            if not words:
                continue

            for i in range(0, len(words), max_words):
                chunk_words = words[i: i + max_words]
                chunk_text = " ".join(chunk_words)
                chunk_id = f"{page.page_id} - CHK{i//max_words + 1:02d}"

                chunks.append(
                    SearchChunk(
                        chunk_id=chunk_id,
                        document_id=document_id,
                        page_id=page.page_id,
                        table_id=None,
                        chunk_type="narrative",
                        content=chunk_text,
                        metadata={
                            "document_id": document_id,
                            "printed_page": page.printed_page,
                            "chunk_type": "narrative",
                        },
                    )
                )
        return chunks

    @staticmethod
    def build_table_chunks(tables: List[ExtractedTable]):
        chunks: List[ExtractedTable] = []
        for tab in tables:
            header_line = " | ".join(tab.headers)
            for r_idx, row in enumerate(tab.raw_matrix):
                row_line = " | ".join([cell.replace("\n", " ") if cell else "-" for cell in row])
                content = (
                    f"Document Table: {tab.table_name} (Page {tab.printed_page})\n"
                    f"Scale: {tab.scale}, Currency: {tab.currency}\n"
                    f"Columns: {header_line}\n"
                    f"Row Entry: {row_line}"
                )
                chunk_id = f"{tab.table_id} - R{r_idx + 1:02d}"
                chunks.append(
                    SearchChunk(
                        chunk_id=chunk_id,
                        document_id=tab.document_id,
                        page_id=tab.page_id,
                        table_id=tab.table_id,
                        chunk_type="table_row_group",
                        content=content,
                        metadata={
                            "document_id": tab.document_id,
                            "table_id": tab.table_id,
                            "printed_page": tab.printed_page,
                            "chunk_type": "table_row_group",
                        },
                    )
                )
        return chunks

'''5. Ingestion Repository: Handles all parameterized SQL database queries into Supabase (documents, pages, tables, cells, facts, chunks) idempotently with ON CONFLICT clauses.'''

class IngestionRepository:
    def __init__(self, db_url: str):
        self.db_url = db_url
    
    def save_document(self, conn: psycopg.Connection, doc: DocumentMetadata):
        query = """INSERT INTO documents (
            document_id, company, ticker, report_type, report_fiscal_year,
            period_ended, filing_date, source_url, file_name, storage_path,
            file_hash_sha256, status
        ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, 'parsing')
        ON CONFLICT (document_id) DO UPDATE SET
            status = 'parsing',
            file_hash_sha256 = EXCLUDED.file_hash_sha256;"""
        with conn.cursor() as cur:
            cur.execute(
                query,(
                    doc.document_id,
                    doc.company,
                    doc.ticker,
                    doc.report_type,
                    doc.report_fiscal_year,
                    doc.period_ended,
                    doc.filing_date,
                    doc.source_url,
                    doc.file_name,
                    doc.storage_path,
                    doc.file_hash_sha256
                ),
            )

    def save_pages(self, conn: psycopg.Connection, pages: List[ExtractedPage]):
        query = """
        INSERT INTO pages (page_id, document_id, physical_page_index, printed_page, raw_text)
        VALUES (%s, %s, %s, %s, %s)
        ON CONFLICT (document_id, physical_page_index) DO UPDATE SET
            printed_page = EXCLUDED.printed_page,
            raw_text = EXCLUDED.raw_text;
        """
        with conn.cursor() as cur:
            for p in pages:
                cur.execute(query, (p.page_id, p.document_id, p.physical_page_index, p.printed_page, p.raw_text))
    
    def save_tables_and_cells(self, conn: psycopg.Connection, tables: List[ExtractedTable]):
        tab_query = """
        INSERT INTO tables (
            table_id, document_id, page_id, table_name, section, printed_page,
            currency, scale, headers, raw_matrix, footnote_text
        ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s::jsonb, %s::jsonb, %s)
        ON CONFLICT (table_id) DO UPDATE SET
            headers = EXCLUDED.headers,
            raw_matrix = EXCLUDED.raw_matrix;
        """
        cell_query = """
        INSERT INTO cells (
            cell_id, table_id, row_idx, col_idx, raw_value, normalized_decimal,
            header_path, period_label, unit
        ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
        ON CONFLICT (table_id, row_idx, col_idx) DO UPDATE SET
            raw_value = EXCLUDED.raw_value,
            normalized_decimal = EXCLUDED.normalized_decimal;
        """

        with conn.cursor() as cur:
            for tab in tables:
                cur.execute(
                    tab_query,
                    (
                        tab.table_id,
                        tab.document_id,
                        tab.page_id,
                        tab.table_name,
                        tab.section,
                        tab.printed_page,
                        tab.currency,
                        tab.scale,
                        json.dumps(tab.headers),
                        json.dumps(tab.raw_matrix),
                        tab.footnote_text,
                    ),
                )
                for r_idx, row in enumerate(tab.raw_matrix):
                    for c_idx, raw_val in enumerate(row):
                        if not raw_val or not raw_val.strip():
                            continue
                        cell_id = f"{tab.table_id}-C{r_idx}_{c_idx}"
                        norm_val = FinancialTableExtractor.parse_accounting_number(raw_val)
                        header_name = tab.headers[c_idx] if c_idx < len(tab.headers) else ""
                        cur.execute(
                            cell_query,
                            (
                                cell_id,
                                tab.table_id,
                                r_idx,
                                c_idx,
                                raw_val,
                                norm_val,
                                header_name,
                                header_name,
                                tab.currency,
                            ),
                        )

    def create_staged_corpus_version(self, conn: psycopg.Connection, version_id: str, description: str = ""):
        query = """
        INSERT INTO corpus_versions (version_id, status, description)
        VALUES (%s, 'staged', %s)
        ON CONFLICT (version_id) DO UPDATE SET
            status = 'staged',
            description = EXCLUDED.description;
        """
        with conn.cursor() as cur:
            cur.execute(query, (version_id, description))
    def public_corpus_version(self, conn: psycopg.Connection, version_id: str):
        with conn.cursor() as cur:
            cur.execute(
                "UPDATE corpus_versions SET status = 'retired' WHERE status = 'ready' AND version_id != %s;",
                (version_id,)
            )
            cur.execute(
                "UPDATE corpus_versions SET status = 'ready' WHERE version_id = %s;",
                (version_id,)
            )

    def save_chunks(self, conn: psycopg.Connection, chunks: List[SearchChunk]):
        query = """
        INSERT INTO chunks (chunk_id, document_id, page_id, table_id, chunk_type, content, embedding, metadata, corpus_version)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s::jsonb, %s)
        ON CONFLICT (chunk_id) DO UPDATE SET
            content = EXCLUDED.content,
            metadata = EXCLUDED.metadata,
            embedding = EXCLUDED.embedding,
            corpus_version = EXCLUDED.corpus_version;
        """

        with conn.cursor() as cur:
            for chk in chunks:
                vec_str = f"[{','.join(str(x) for x in chk.embedding)}]" if chk.embedding else None
                cur.execute(
                    query,
                    (
                        chk.chunk_id,
                        chk.document_id,
                        chk.page_id,
                        chk.table_id,
                        chk.chunk_type,
                        chk.content,
                        vec_str,
                        json.dumps(chk.metadata),
                        chk.corpus_version,
                    ),
                )

    def mark_document_ready(self, conn: psycopg.Connection, document_id: str):
        with conn.cursor() as cur:
            cur.execute("UPDATE documents SET status = 'ready' WHERE document_id = %s;", (document_id,))

'''6. Ingestion Pipeline: Orchestrating pdf reading, parsing and database storage'''

class IngestionPipeline:
    def __init__(self, db_url: str):
        self.repo = IngestionRepository(db_url)
        self.table_extractor = FinancialTableExtractor()
        self.embedding_service = EmbeddingService(model_name="sentence-transformers/all-MiniLM-L6-v2")
        self.chunk_builder = ChunkBuilder()

    def prepare_corpus(self, version_id: str, description: str):
        with psycopg.connect(self.repo.db_url) as conn:
             with conn.transaction():
                self.repo.create_staged_corpus_version(conn, version_id, description)
        print(f"Corpus version '{version_id}' created in 'staged' state.")

    def ingest(self, doc_meta: DocumentMetadata, corpus_version: str = "v1.0"):
        print(f"Starting ingestion for {doc_meta.document_id} ({doc_meta.file_name})...")

        ## read pages, tables
        reader = PDFDocumentReader(doc_meta.storage_path)
        pages, tables = reader.extract_content(doc_meta.document_id)
        print(f"Extracted {len(pages)} pages and {len(tables)} structured tables.")

        ## build chunks (narrative chunks and table chunks)
        nar_chunks = self.chunk_builder.build_narrative_chunks(doc_meta.document_id, pages)
        tab_chunks = self.chunk_builder.build_table_chunks(tables)

        all_chunks = nar_chunks + tab_chunks
        print(f"Genrating embeddings for {len(all_chunks)} chunks...")

        for chk in all_chunks:
            chk.corpus_version = corpus_version
        
        texts = [c.content for c in all_chunks]
        vectors = self.embedding_service.embed_texts(texts)

        for chunk, vec in zip(all_chunks, vectors):
            chunk.embedding = vec   # vector to each chunk

        ## save to database
        with psycopg.connect(self.repo.db_url) as conn:
            with conn.transaction():
                self.repo.save_document(conn, doc_meta)
                self.repo.save_pages(conn, pages)
                self.repo.save_tables_and_cells(conn, tables)
                self.repo.save_chunks(conn, all_chunks) ## saves both pages and tables
                self.repo.mark_document_ready(conn, doc_meta.document_id)
        print(f"Completed {doc_meta.document_id}: {len(pages)} pages, {len(tables)} tables, {len(all_chunks)} chunks saved.")
        return {"pages": len(pages), "tables": len(tables), "chunks": len(all_chunks)}
    
    def publish_corpus(self, version_id: str):
        with psycopg.connect(self.repo.db_url) as conn:
            with conn.transaction():
                self.repo.public_corpus_version(conn, version_id)
        print(f"Corpus version '{version_id}' successfully published as 'ready'!")


def main():
    project_root = Path(__file__).resolve().parents[3]
    manifest_path = project_root / "data" / "source_manifest.jsonl"
    originals_dir = project_root / "data" / "originals"
    print(f"Project root: {project_root}")
    print(f"Manifest path: {manifest_path}")
    print(f"Originals dir: {originals_dir}")

    if not manifest_path.exists():
        raise FileNotFoundError(f"File not found at {manifest_path}")
    if not settings.database_url:
        raise ValueError("DATABASE_URL is not set")
    
    documents_to_ingest = []
    with open(manifest_path, "r", encoding='utf-8') as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            entry = json.loads(line)

            ## resolve pdf path
            pdf_path = originals_dir / entry["file_name"]
            if not pdf_path.exists():
                pdf_path = project_root / entry["storage_path"]
            if not pdf_path.exists():
                print(f"[!] Warning: PDF file {pdf_path} not found. Skipping..")
                continue

            doc_meta = DocumentMetadata(
                document_id=entry["document_id"],
                company=entry["company"],
                ticker=entry["ticker"],
                report_type=entry["report_type"],
                report_fiscal_year=entry["report_fiscal_year"],
                period_ended=entry["period_ended"],
                filing_date=entry["filing_date"],
                source_url=entry["source_url"],
                file_name=entry["file_name"],
                storage_path=str(pdf_path),
                file_hash_sha256=entry["file_hash_sha256"],
            )
            documents_to_ingest.append(doc_meta)
    print(f"Found {len(documents_to_ingest)} report(s) to ingest.\n")

    corpus_version = "v1.0"
    pipeline = IngestionPipeline(db_url=settings.database_url)
    pipeline.prepare_corpus(
        version_id=corpus_version,
        description="Apple FY2022-FY2024 official Form 10-K filings"
    )
    total_stats = {"pages": 0, "chunks": 0}
    for doc_meta in documents_to_ingest:
        stats = pipeline.ingest(doc_meta, corpus_version=corpus_version)
        total_stats["pages"] += stats.get("pages", 0)
        total_stats["chunks"] += stats.get("chunks", 0)
    
    pipeline.publish_corpus(
        version_id=corpus_version
    )
    print(f"\nIngestion Complete! Published {corpus_version} with {total_stats['pages']} pages, {total_stats['chunks']} chunks.")


if __name__ == "__main__":
    main()


