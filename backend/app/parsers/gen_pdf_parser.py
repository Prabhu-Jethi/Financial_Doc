import gc
import pdfplumber
import re
from typing import List
from pathlib import Path
from .base import BaseParser, ParsedChunk, ParsedDocument


class GeneralPDFParser(BaseParser):
    def parse(self, file_path, document_id, **kwargs):
        self.file_path = file_path
        self.document_id = document_id

        all_chunks = []
        chunk_cnt = 0

        with pdfplumber.open(self.file_path) as pdf:
            total_pages = len(pdf.pages)
            for idx, page in enumerate(pdf.pages):
                page_num = idx + 1
                tables = []
                try:
                    tables = page.find_tables() or []
                except Exception as e:
                    print(f"[Parser] Note: find_tables skipped on page {page_num}: {e}")
                    tables = []

                # 1. Extract tabular data
                for table in tables:
                    try:
                        raw_grid = table.extract()
                        if raw_grid:
                            markdown_text = self._grid_to_markdown(raw_grid)
                            if markdown_text and markdown_text.strip():
                                chunk_cnt += 1
                                parsed = ParsedChunk(
                                    chunk_id=f"{document_id}_p{page_num}_t{chunk_cnt}",
                                    page_number=page_num,
                                    chunk_type="table",
                                    content=markdown_text,
                                    metadata={"source": "table_extraction"}
                                )
                                all_chunks.append(parsed)
                    except Exception as e:
                        print(f"[Parser] Note: Table extraction error on page {page_num}: {e}")

                # 2. Extract remaining narrative text outside table boundaries
                remaining_text = ""
                try:
                    filtered_page = page
                    for table in tables:
                        if hasattr(table, "bbox"):
                            try:
                                filtered_page = filtered_page.outside_bbox(table.bbox)
                            except Exception:
                                pass
                    remaining_text = filtered_page.extract_text() or ""
                except Exception:
                    # Fallback to standard page text extraction if bbox filtering encounters layout issues
                    try:
                        remaining_text = page.extract_text() or ""
                    except Exception:
                        remaining_text = ""

                # 3. Sliding window chunking for narrative text
                if remaining_text and remaining_text.strip():
                    text_chunks = self._sliding_window(remaining_text, chunk_size=500, overlap=100)
                    for text_char in text_chunks:
                        if text_char.strip():
                            chunk_cnt += 1
                            parsed = ParsedChunk(
                                chunk_id=f"{document_id}_p{page_num}_c{chunk_cnt}",
                                page_number=page_num,
                                chunk_type="text",
                                content=text_char.strip(),
                                metadata={"source": "narrative_extraction"}
                            )
                            all_chunks.append(parsed)

                # Crucial memory hygiene: Flush pdfminer layout cache after each page to prevent MemoryError
                try:
                    page.flush_cache()
                except Exception:
                    pass

                if idx > 0 and idx % 20 == 0:
                    gc.collect()

        return ParsedDocument(
            document_id=document_id,
            total_pages=total_pages,
            chunks=all_chunks
        )

    def _grid_to_markdown(self, grid: List[List[str]]) -> str:
        if not grid or not grid[0]:
            return ""

        cleaned = []
        for row in grid:
            new_row = []
            for cell in row:
                if not cell:
                    new_row.append("")
                else:
                    # Replace newlines with spaces to maintain valid GFM markdown table rows
                    cleaned_cell = re.sub(r'\s+', ' ', str(cell)).strip().replace("|", "\\|")
                    new_row.append(cleaned_cell)
            cleaned.append(new_row)

        if not cleaned or not any(any(cell for cell in row) for row in cleaned):
            return ""

        header_row = cleaned[0]
        header_line = "| " + " | ".join(header_row) + " |"
        separator = "| " + " | ".join([":---"] * len(header_row)) + " |"

        data_lines = []
        for row in cleaned[1:]:
            # Pad row if columns are ragged
            if len(row) < len(header_row):
                row = row + [""] * (len(header_row) - len(row))
            elif len(row) > len(header_row):
                row = row[:len(header_row)]
            data_lines.append("| " + " | ".join(row) + " |")

        return "\n".join([header_line, separator] + data_lines)

    def _sliding_window(self, text: str, chunk_size: int = 500, overlap: int = 100) -> List[str]:
        if not text:
            return []

        # Split on sentence boundaries or double newlines
        splitted_text = re.split(r'(?<=[.?!])\s+|\n\n+', text)
        sentences = [s.strip() for s in splitted_text if s.strip()]

        chunks = []
        curr_chunk = ""

        for sentence in sentences:
            # If a single sentence exceeds chunk_size, split it into hard word slices
            if len(sentence) > chunk_size:
                if curr_chunk:
                    chunks.append(curr_chunk.strip())
                    curr_chunk = ""
                words = sentence.split()
                sub_chunk = ""
                for word in words:
                    if len(sub_chunk) + len(word) + 1 > chunk_size:
                        if sub_chunk:
                            chunks.append(sub_chunk.strip())
                        sub_chunk = word
                    else:
                        sub_chunk = f"{sub_chunk} {word}".strip()
                if sub_chunk:
                    curr_chunk = sub_chunk
                continue

            if len(curr_chunk) + len(sentence) + 1 > chunk_size:
                if curr_chunk:
                    chunks.append(curr_chunk.strip())
                curr_chunk = (curr_chunk[-overlap:] + " " + sentence).strip() if overlap < len(curr_chunk) else sentence
            else:
                curr_chunk = f"{curr_chunk} {sentence}".strip()

        if curr_chunk and curr_chunk.strip():
            chunks.append(curr_chunk.strip())

        return chunks
