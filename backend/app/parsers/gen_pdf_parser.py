import pdfplumber
import re
from typing import List
from pathlib import Path
from .base import BaseParser, ParsedChunk, ParsedDocument


class GeneralPDFParser(BaseParser):
    def parse(self, file_path, document_id, **kwargs):
        self.file_path = file_path
        self.document_id = document_id

        with pdfplumber.open(self.file_path) as pdf:
            all_chunks = []
            chunk_cnt = 0
            for idx, page in enumerate(pdf.pages):
                page_num = idx + 1
                tables = page.find_tables()

                for table in tables:
                    raw_grid = table.extract()
                    markdown_text = self._grid_to_markdown(raw_grid)

                    if markdown_text.strip():
                        chunk_cnt += 1
                        parsed = ParsedChunk(
                            chunk_id=f"{document_id}_p{page_num}_t{chunk_cnt}",
                            page_number=page_num,
                            chunk_type="table",
                            content=markdown_text,
                            metadata={"source": "table_extraction"}
                        )
                        all_chunks.append(parsed)

                filtered_page = page
                for table in tables:
                    filtered_page = filtered_page.outside_bbox(table.bbox)
                
                remaining_text = filtered_page.extract_text()

                if remaining_text.strip():
                    text_chunks = self._sliding_window(remaining_text, chunk_size=500, overlap=100)
                    for text_char in text_chunks:
                        chunk_cnt += 1
                        parsed = ParsedChunk(
                            chunk_id=f"{document_id}_p{page_num}_c{chunk_cnt}",
                            page_number=page_num,
                            chunk_type="text",
                            content=text_char,
                            metadata={"source": "narrative_extraction"}
                        )
                        all_chunks.append(parsed)
        
            return ParsedDocument(
                document_id=document_id,
                total_pages=len(pdf.pages),
                chunks=all_chunks
            )   
    
    def _grid_to_markdown(self, grid: List[List[str]]):
        cleaned = []
        if not grid or not grid[0]:
            return ""
        for row in grid:
            new_row = []
            for cell in row:
                if not cell:
                    new_row.append("")
                else:
                    new_row.append(cell.strip())
            cleaned.append(new_row)
        
        header_row = cleaned[0]
        header_line = "| " + " | ".join(header_row) + " |"

        separator = "| " + " | ".join([":---"] * len(header_row)) + " |"

        data_lines = []
        for row in cleaned[1:]:
            line = "| " + " | ".join(row) + " |"
            data_lines.append(line)
        
        return "\n".join([header_line, separator] + data_lines)
    

    def _sliding_window(self, text, chunk_size=500, overlap=100):
        if not text:
            return []
        splitted_text = re.split(r'(?<=[.?!])\s+|\n\n', text)
        sentences = splitted_text

        chunks = []
        curr_chunk = ""

        for sentence in sentences:
            if len(curr_chunk) + len(sentence) > chunk_size:
                chunks.append(curr_chunk.strip())
                curr_chunk = curr_chunk[-overlap:] + " " + sentence
            else:
                if not curr_chunk:
                    curr_chunk = sentence
                else:
                    curr_chunk = curr_chunk + " " + sentence

        if curr_chunk:
            chunks.append(curr_chunk.strip())

        return chunks
    


if __name__ == "__main__":
    project_root = Path(__file__).resolve().parents[3]
    sample_pdf = project_root / "data" / "originals" / "MSFT_FY24Q4_10K.pdf"

    if sample_pdf.exists():
        parser = GeneralPDFParser()
        doc = parser.parse(file_path=sample_pdf, document_id="TEST_01_PDF")
        print(f"Parsed {len(doc.chunks)} chunks across {doc.total_pages} pages.")

        
