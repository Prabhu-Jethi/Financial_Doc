import os
from typing import List, Dict, Any, Tuple
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_openai import ChatOpenAI
from dotenv import load_dotenv

load_dotenv()

# Global singleton cache for embedding models to prevent repeated memory allocations
_SHARED_EMBEDDINGS: Dict[Tuple[str, str], HuggingFaceEmbeddings] = {}


class ModelService:
    def __init__(
        self,
        model_name: str = "sentence-transformers/all-MiniLM-L6-v2",
        chat_model: str = "gpt-6-luna",
        device: str = "cpu"
    ):
        self.model_name = model_name
        self.chat_model = chat_model
        self.device = device

        cache_key = (self.model_name, self.device)
        if cache_key not in _SHARED_EMBEDDINGS:
            print(f"\n Loading embedding model {self.model_name} on {self.device}...")
            _SHARED_EMBEDDINGS[cache_key] = HuggingFaceEmbeddings(
                model_name=self.model_name,
                model_kwargs={"device": self.device, "trust_remote_code": True},
                encode_kwargs={"normalize_embeddings": True},  # Crucial for accurate cosine similarity
            )
            print("Embedding Model loaded successfully.\n")

        self.embed = _SHARED_EMBEDDINGS[cache_key]

    def embed_texts(self, texts: List[str]):
        if not texts:
            return []
        return self.embed.embed_documents(texts)

    def embed_query(self, query: str):
        if not query or not query.strip():
            raise ValueError("Query string cannot be empty")
        return self.embed.embed_query(query.strip())

    @property
    def dimension(self) -> int:
        return 384

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
