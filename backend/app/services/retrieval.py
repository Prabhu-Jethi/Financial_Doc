import psycopg
from typing import List, Optional
from langchain_core.retrievers import BaseRetriever
from langchain_core.documents import Document
from langchain_core.callbacks import CallbackManagerForRetrieverRun

from ..config import settings
from ..integrations.models import ModelService


class FinancialRetriever(BaseRetriever):
    ## Enforces ready-corpus isolation, similarity ranking, and table metadata recovery.
    top_k: int = 5
    document_id: Optional[str] = None
    min_similarity: float = 0.0
    embedding_service: ModelService = None
    db_url: str = settings.database_url

    class Config:
        arbitary_types_allowed = True
    
    def __init__(self, **data):
        super().__init__(**data)
        if not self.embedding_service:
            self.embedding_service = ModelService(model_name="sentence-transformers/all-MiniLM-L6-v2")
    
    def _get_relevant_documents(self, query: str, *, run_manager: Optional[CallbackManagerForRetrieverRun] = None) -> List[Document]:
        ## 1. Embeds query 
        query_vector = self.embedding_service.embed_query(query)
        vec_str = f"[{','.join(str(x) for x in query_vector)}]"

        ## 2. Query ready corpus versions
        where_clauses = [
            "corpus_version IN (SELECT version_id FROM corpus_versions WHERE status = 'ready')"
        ]
        params = [vec_str]

        if self.document_id:
            where_clauses.append("document_id = %s")
            params.append(self.document_id)

        sql_query = f"""
        SELECT
            chunk_id,
            document_id,
            page_id,
            table_id,
            chunk_type,
            content,
            metadata,
            1 - (embedding <=> %s::vector) AS similarity_score
        FROM chunks
        WHERE {" AND ".join(where_clauses)}
        ORDER BY embedding <=> %s::vector ASC
        LIMIT %s;
        """
        params.extend([vec_str, self.top_k])

        docs: List[Document] = []
        with psycopg.connect(self.db_url) as conn:
            with conn.cursor() as cur:
                cur.execute(sql_query, params)
                for row in cur.fetchall():
                    score = float(row[7]) if row[7] is not None else 0.0
                    if score < self.min_similarity:
                        continue

                    meta = row[6] if isinstance(row[6], dict) else {}
                    meta.update({
                        "chunk_id": row[0],
                        "document_id": row[1],
                        "page_id": row[2],
                        "table_id": row[3],
                        "chunk_type": row[4],
                        "similarity_score": round(score, 4),
                        "printed_page": meta.get("printed_page", "N/A"),
                        "section": "Item 8 / Item 7",
                    })

                    docs.append(
                        Document(
                            page_content=row[5],
                            metadata=meta
                        )
                    )

        return docs