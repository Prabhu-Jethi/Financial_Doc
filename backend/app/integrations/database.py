from typing import List, Dict, Any
import psycopg
from ..config import settings

'''Native sql vector search using psycopg & pgvector'''
class LangchainPostgresVector:
    def __init__(self, db_url: str = settings.database_url):
        self.db_url = db_url

    def similiarity_search(
            self,
            query_embedding: List[float],
            top_k: int = 5,
            document_id: str = None,
            chunk_type: str = None,
    ) -> List[Dict[str, Any]]:
        ### Executes native cosine similarity search: 1 - embedding <=> queryvector
        filters = []
        params = [query_embedding]

        if document_id:
            filters.append("document_id = %s")
            params.append(document_id)
        if chunk_type:
            filters.append("chunk_type = %s")
            params.append(chunk_type)
        where_clause = f"Where {' AND '.join(filters)}" if filters else ""

        ## order by cosine similarity operator
        query = f"""
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
        {where_clause}
        ORDER BY embedding <=> %s::vector ASC
        LIMIT %s;
        """
        params.extend([query_embedding, top_k])

        results = []
        with psycopg.connect(self.db_url) as conn:
            with conn.cursor() as cur:
                cur.execute(query, params)
                for row in cur.fetchall():
                    results.append({
                        "chunk_id": row[0],
                        "document_id": row[1],
                        "page_id": row[2],
                        "table_id": row[3],
                        "chunk_type": row[4],
                        "content": row[5],
                        "metadata": row[6],
                        "score": float(row[7]) if row[7] is not None else 0.0,
                    })
        return results
    

def main():
    print(f"Connecting to Supabase Vector Store...")
    if not settings.database_url:
        print("! Error: DATABASE_URL is not set.")
        return
    
    vect = LangchainPostgresVector(db_url=settings.database_url)

    ##dummy vector
    dummy_query_vector = [0.01] * 1536
    try:
        results = vect.similiarity_search(
            query_embedding=dummy_query_vector,
            top_k=3
        )
        print(f"Retrieved {len(results)} chunk(s):")
        for idx, res in enumerate(results):
            print(f"  {idx}. Chunk ID: {res['chunk_id']} | Score: {res['score']:.4f}")
            snippet = res['content'][:120].replace('\n', ' ')
            print(f"     Snippet: {snippet}...\n")
    except Exception as e:
        print(f"[!] Query failed: {e}")



if __name__ == "__main__":
    main()