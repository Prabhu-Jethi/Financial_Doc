import os
from typing import List
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_openai import ChatOpenAI
from dotenv import load_dotenv
load_dotenv()


class ModelService:
    def __init__(self, model_name: str = "sentence-transformers/all-MiniLM-L6-v2", chat_model: str = "gpt-6-luna", device: str = "cpu"):
        self.model_name = model_name
        self.chat_model = chat_model
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
    
    
    def get_chat_llm(self, temperature: float = 0.0) -> ChatOpenAI:
        api_key=os.environ["EXPLABS_API_KEY"]
        if not api_key:
            raise ValueError("EXPLABS_API_KEY environment variable not set..")
        return ChatOpenAI(
            model=self.chat_model,
            base_url="https://api.experientiallabs.ai/v1",
            api_key=api_key,
            temperature=temperature
        )



def main():
    ## text embedding generation
    service = ModelService(model_name="sentence-transformers/all-MiniLM-L6-v2", chat_model="gpt-6-luna")
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

    ##Test llm model
    llm = service.get_chat_llm(temperature=0.0)
    response = llm.invoke("Respond with: 'LLM is ready.'")
    print(f"LLM Response: {response.content}")

if __name__ == "__main__":
    main()