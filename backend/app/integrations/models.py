import os
from typing import List, Dict, Any, Tuple
from langchain_huggingface import HuggingFaceEmbeddings, HuggingFaceEndpointEmbeddings
from langchain_openai import ChatOpenAI
from dotenv import load_dotenv

load_dotenv()

# Global singleton cache for embedding models to prevent repeated memory allocations
_SHARED_EMBEDDINGS: Dict[Tuple[str, str], Any] = {}


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
        self._local_fallback = None

        cache_key = (self.model_name, self.device)
        if cache_key not in _SHARED_EMBEDDINGS:
            hf_token = os.environ.get("HF_TOKEN") or os.environ.get("HUGGINGFACEHUB_API_TOKEN")
            use_endpoint = os.environ.get("USE_HF_ENDPOINT", "true").lower() in ("true", "1", "yes")

            if hf_token and use_endpoint:
                try:
                    print(f"\n Initializing Hugging Face Serverless Endpoint for {self.model_name}...")
                    _SHARED_EMBEDDINGS[cache_key] = HuggingFaceEndpointEmbeddings(
                        model=self.model_name,
                        huggingfacehub_api_token=hf_token
                    )
                    print("Hugging Face Endpoint initialized successfully (Cloud Accelerated).\n")
                except Exception as ep_err:
                    print(f"Endpoint init failed ({ep_err}). Falling back to local model.")

            if cache_key not in _SHARED_EMBEDDINGS:
                print(f"\n Loading local embedding model {self.model_name} on {self.device}...")
                _SHARED_EMBEDDINGS[cache_key] = HuggingFaceEmbeddings(
                    model_name=self.model_name,
                    model_kwargs={"device": self.device, "trust_remote_code": True},
                    encode_kwargs={"normalize_embeddings": True},  # Crucial for accurate cosine similarity
                )
                print("Local Embedding Model loaded successfully.\n")

        self.embed = _SHARED_EMBEDDINGS[cache_key]

    def _get_local_fallback(self):
        if self._local_fallback is None:
            self._local_fallback = HuggingFaceEmbeddings(
                model_name=self.model_name,
                model_kwargs={"device": self.device, "trust_remote_code": True},
                encode_kwargs={"normalize_embeddings": True},
            )
        return self._local_fallback

    def embed_texts(self, texts: List[str]):
        if not texts:
            return []
        try:
            return self.embed.embed_documents(texts)
        except Exception:
            # Automatic fallback to local engine if cloud endpoint fails
            return self._get_local_fallback().embed_documents(texts)

    def embed_query(self, query: str):
        if not query or not query.strip():
            raise ValueError("Query string cannot be empty")
        try:
            return self.embed.embed_query(query.strip())
        except Exception:
            # Automatic fallback to local engine if cloud endpoint fails
            return self._get_local_fallback().embed_query(query.strip())

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
