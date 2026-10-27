import json
from fastapi import HTTPException, status
from .base import BaseParser, ParsedChunk, ParsedDocument
from .gen_pdf_parser import GeneralPDFParser
from .sec_10k_parser import Sec10kParser

class ParserFactory:
    @staticmethod
    def get_parser(doc_type: str = "general") -> BaseParser:
        normalized_type = (doc_type or "general").lower().strip()

        if normalized_type == "general":
            return GeneralPDFParser()
        elif normalized_type in ["sec_10k", "10-k", "financial"]:
                return Sec10kParser()
        else:
            raise HTTPException(status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE, detail="Invalid doc-type")
        

if __name__ == "__main__":
    p_gen = ParserFactory.get_parser("general")
    p_sec = ParserFactory.get_parser("sec_10k")
    print(f"Factory resolved 'general' -> {type(p_gen).__name__}")
    print(f"Factory resolved 'sec_10k' -> {type(p_sec).__name__}")