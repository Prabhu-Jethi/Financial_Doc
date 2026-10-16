from typing import List
from langchain_huggingface import HuggingFaceEmbeddings
from dotenv import load_dotenv
load_dotenv()


class EmbeddingService:
    def __init__(self, model_name: str = "sentence-transformers/all-MiniLM-L6-v2", device: str = "cpu"):
        self.model_name = model_name
        self.device = device
        print(f"\n Loading embedding models {self.model_name} on {self.device}...")
        self.embed = HuggingFaceEmbeddings(
            model_name=self.model_name,
            model_kwargs={"device": self.device, "trust_remote_code": True},
            encode_kwargs={"normalize_embeddings": True},   ## crucial for accurate cosine similarity
        )
        print("\nEmbedding Model loaded successfully..")
        

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
    

def main():
    ## text embedding generation
    service = EmbeddingService(model_name="sentence-transformers/all-MiniLM-L6-v2")
    sample_chunks = [
        "Apple Inc. reported total net sales of $391,035 million for fiscal year 2024.",
        "Operating income was $123,216 million compared to $114,301 million in 2023.",
    ]
    vectors = service.embed_texts(sample_chunks)
    print(f"\nGenerated {len(vectors)} chunk vectors.")
    print(f"Vector length (dimensions): {len(vectors[0])}")

    # Test single query embedding
    query_vector = service.embed_query("What were total net sales in 2024?")
    print(f"\nGenerated query vector of dimension {len(query_vector)}.")


if __name__ == "__main__":
    main()