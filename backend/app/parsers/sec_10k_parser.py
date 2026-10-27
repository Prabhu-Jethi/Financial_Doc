from pathlib import Path
from ..services.ingestion import PDFDocumentReader, ChunkBuilder
from .base import BaseParser, ParsedChunk, ParsedDocument


class Sec10kParser(BaseParser):
    def parse(self, file_path: str | Path, document_id: str, **kwargs) -> ParsedDocument:
        ''' Re-used PDF Reader and Chunk builder classes from ingestion'''
        reader = PDFDocumentReader(str(file_path))
        pages, tables = reader.extract_content(document_id)

        nar_chunks = ChunkBuilder.build_narrative_chunks(document_id, pages)
        tab_chunks = ChunkBuilder.build_table_chunks(tables)

        all_search_chunks = nar_chunks + tab_chunks
        page_map = {p.page_id: p.physical_page_index for p in pages}
        parsed_chunks = []
        for sc in all_search_chunks:
            parsed_chunks.append(
                ParsedChunk(
                    chunk_id=sc.chunk_id,
                    page_number=page_map.get(sc.page_id, 1),
                    chunk_type="table" if "table" in sc.chunk_type else "text",
                    content=sc.content,
                    metadata=sc.metadata
                )
            )

        return ParsedDocument(
            document_id=document_id,
            total_pages=len(pages),
            chunks=parsed_chunks
        )
    

if __name__ == "__main__":
    project_root = Path(__file__).resolve().parents[3]
    sample_pdf = project_root / "data" / "originals" / "_10-K-2022-(As-Filed).pdf"
    if not sample_pdf.exists():
        print(f"File not found at: {sample_pdf.resolve()}")
    else:
        print(f"Testing Sec10kParser on: {sample_pdf.name}...")
        parser = Sec10kParser()
        doc = parser.parse(file_path=sample_pdf, document_id="AAPL_2022")

        print(f"\n--- Parsing Summary ---")
        print(f"Document ID : {doc.document_id}")
        print(f"Total Pages : {doc.total_pages}")
        print(f"Total Chunks: {len(doc.chunks)}")
        table_chunks = [c for c in doc.chunks if c.chunk_type == "table"]
        text_chunks = [c for c in doc.chunks if c.chunk_type == "text"]
        print(f"  • Table chunks: {len(table_chunks)}")
        print(f"  • Text chunks : {len(text_chunks)}")
        
        if doc.chunks:
            first = doc.chunks[0]
            print(f"\n--- First Chunk Preview ({first.chunk_type.upper()} | Page {first.page_number}) ---")
            print(first.content[:300] + ("..." if len(first.content) > 300 else ""))