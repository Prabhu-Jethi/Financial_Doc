import json
import os
from pathlib import Path
from dataclasses import dataclass
from abc import abstractmethod, ABC
from typing import List, Dict, Any


@dataclass
class ParsedChunk:
    chunk_id: str
    page_number: int
    chunk_type: str
    content: str
    metadata: Dict[str, Any]


@dataclass
class ParsedDocument:
    document_id: str
    total_pages: int
    chunks: List[ParsedChunk]


class BaseParser(ABC):
    @abstractmethod
    def parse(self, file_path: str | Path, document_id: str, **kwargs):
        pass
    
