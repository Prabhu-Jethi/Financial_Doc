import os
from typing import List, Dict, Any, Optional
from langchain_openai import OpenAIEmbeddings, ChatOpenAI
from dotenv import load_dotenv

load_dotenv()

# Global singleton cache for embedding models to prevent repeated client allocations
_SHARED_EMBEDDINGS: Dict[str, Any] = {}


class ModelService:
    """
    Unified Model Service for Financial Document Intelligence.
    Uses OpenAI text-embedding-3-small (1536-dim) via Experiential Labs or OpenAI API
    for sub-100ms vector embeddings without local PyTorch memory bloat on Render.
    """
    def __init__(
        self,
        model_name: str = "text-embedding-3-small",
        chat_model: str = "gpt-6-luna",
        device: str = "cpu"
    ):
        self.model_name = model_name
        self.chat_model = chat_model
        self.device = device

        if self.model_name not in _SHARED_EMBEDDINGS:
            api_key = os.environ.get("EXPLABS_API_KEY") or os.environ.get("OPENAI_API_KEY", "")
            base_url = "https://api.experientiallabs.ai/v1" if os.environ.get("EXPLABS_API_KEY") else "https://api.openai.com/v1"

            _SHARED_EMBEDDINGS[self.model_name] = OpenAIEmbeddings(
                model=self.model_name,
                openai_api_key=api_key,
                openai_api_base=base_url,
                check_embedding_ctx_length=False
            )

        self.embed = _SHARED_EMBEDDINGS[self.model_name]

    def warmup(self):
        """Pre-warms connection to the embedding API so first live query is instantaneous."""
        try:
            self.embed_query("warmup financial intelligence query")
        except Exception:
            pass

    def embed_texts(self, texts: List[str]) -> List[List[float]]:
        if not texts:
            return []
        cleaned = [
            t.replace("\x00", "").strip() if t and t.replace("\x00", "").strip() else "(empty chunk)"
            for t in texts
        ]
        return self.embed.embed_documents(cleaned)

    def embed_query(self, query: str) -> List[float]:
        if not query or not query.strip():
            raise ValueError("Query string cannot be empty")
        return self.embed.embed_query(query.strip())

    @property
    def dimension(self) -> int:
        return 1536 if "text-embedding-3" in self.model_name else 384

    def get_chat_llm(self, temperature: float = 0.0) -> ChatOpenAI:
        api_key = os.environ.get("EXPLABS_API_KEY", "")
        if not api_key:
            raise ValueError("EXPLABS_API_KEY environment variable not set..")
        return ChatOpenAI(
            model=self.chat_model,
            base_url="https://api.experientiallabs.ai/v1",
            api_key=api_key,
            temperature=temperature
        )


EmbeddingService = ModelService
