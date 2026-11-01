import psycopg
from typing import List, Optional, Any, Dict
from pydantic import ConfigDict
from langchain_core.retrievers import BaseRetriever
from langchain_core.documents import Document
from langchain_core.callbacks import CallbackManagerForRetrieverRun

from ..core.config import settings
from ..integrations.models import ModelService


class FinancialRetriever(BaseRetriever):
    """
    Production Hybrid Retriever combining:
    1. Dense Vector Search (SentenceTransformers MiniLM via pgvector <=>)
    2. Lexical Full-Text Search (PostgreSQL tsvector via websearch_to_tsquery)
    3. Reciprocal Rank Fusion (RRF with k=60)
    """
    ## Enforces ready-corpus isolation, similarity ranking, and table metadata recovery.
    top_k: int = 8
    candidate_limit: int = 15       ## no. of candidates pulled by each branch before fusion
    rrf_k: int = 60                 ## Reciprocal Rank Fusion 
    search_mode: str = "hybrid"    ## "hybrid" | "dense" | "lexical"
    document_id: Optional[str] = None
    document_ids: Optional[List[str]] = None
    company: Optional[str] = None
    min_similarity: float = 0.0
    embedding_service: ModelService = None
    db_url: str = settings.database_url

    model_config = ConfigDict(arbitrary_types_allowed=True)
    
    def __init__(self, **data):
        super().__init__(**data)
        if not self.embedding_service:
            self.embedding_service = ModelService(model_name="sentence-transformers/all-MiniLM-L6-v2")
    
    def _build_where_filters(self, query: str) -> tuple[List[str], List[Any]]:
        ## Reusable SQL where clauses for corpus status, document scoping, company and year
        where_clauses = [
            "(corpus_version IN (SELECT version_id FROM corpus_versions WHERE status = 'ready') OR corpus_version IS NULL)"
        ]
        params: List[Any] = []

        # 1. Strict Document Scoping takes absolute priority
        if self.document_ids and len(self.document_ids) > 0:
            if len(self.document_ids) == 1:
                where_clauses.append("document_id = %s")
                params.append(self.document_ids[0])
            else:
                where_clauses.append("document_id = ANY(%s)")
                params.append(list(self.document_ids))
        elif self.document_id:
            where_clauses.append("document_id = %s")
            params.append(self.document_id)
        elif self.company and self.company not in ["All", "Cross-Company", "General", "Uploaded Document"]:
            where_clauses.append("document_id IN (SELECT document_id FROM documents WHERE company ILIKE %s)")
            params.append(f"%{self.company}%")

        # 2. Fiscal year heuristics ONLY apply when not explicitly scoped to document(s)
        has_doc_scope = bool(self.document_id) or bool(self.document_ids and len(self.document_ids) > 0)
        if not has_doc_scope:
            q_lower = query.lower()
            if "2024" in q_lower or "fy24" in q_lower or "fy2024" in q_lower:
                where_clauses.append("(metadata->>'report_fiscal_year' = '2024' OR metadata->>'report_fiscal_year' IS NULL)")
            elif "2023" in q_lower or "fy23" in q_lower:
                where_clauses.append("(metadata->>'report_fiscal_year' IN ('2023', '2024') OR metadata->>'report_fiscal_year' IS NULL)")

        return where_clauses, params
    
    #### Dense Vector Query Branch
    def _query_dense(self, query: str, where_clauses: List[str], base_params: List[Any]) -> List[Document]:
        query_vector = self.embedding_service.embed_query(query)
        vec_str = f"[{','.join(str(x) for x in query_vector)}]"
        sql = f"""
        SELECT
            chunk_id, document_id, page_id, table_id, chunk_type, content, metadata,
            1 - (embedding <=> %s::vector) AS similarity_score
        FROM chunks
        WHERE {" AND ".join(where_clauses)}
        ORDER BY embedding <=> %s::vector ASC
        LIMIT %s;
        """
        params = [vec_str] + base_params + [vec_str, self.candidate_limit]
        docs: List[Document] = []
        with psycopg.connect(self.db_url) as conn:
            with conn.cursor() as cur:
                cur.execute(sql, params)
                for rank, row in enumerate(cur.fetchall(), start=1):
                    score = float(row[7]) if row[7] is not None else 0.0
                    meta = row[6] if isinstance(row[6], dict) else {}
                    sec_default = "Item 8 - Financial Statements" if "10-k" in str(row[1]).lower() else "Document Passage"
                    meta.update({
                        "chunk_id": row[0],
                        "document_id": row[1],
                        "page_id": row[2],
                        "table_id": row[3],
                        "chunk_type": row[4],
                        "similarity_score": round(score, 4),
                        "dense_rank": rank,
                        "printed_page": meta.get("printed_page", "N/A"),
                        "section": meta.get("section") or sec_default,
                    })
                    docs.append(Document(page_content=row[5], metadata=meta))
        return docs
    

    ## Lexical Full-Text Query
    def _query_lexical(self, query: str, where_clauses: List[str], base_params: List[Any]) -> List[Document]:
        """PostgreSQL Full-Text Search using websearch_to_tsquery for exact keyword matches."""
        # Clean query of special punctuation that could disrupt tsquery parsing
        clean_query = query.replace("?", "").replace("'", "").strip()
        if not clean_query:
            return []
        
        sql = f"""
        SELECT
            chunk_id, document_id, page_id, table_id, chunk_type, content, metadata,
            ts_rank_cd(to_tsvector('english', content), websearch_to_tsquery('english', %s)) AS lexical_score
        FROM chunks
        WHERE {" AND ".join(where_clauses)}
          AND to_tsvector('english', content) @@ websearch_to_tsquery('english', %s)
        ORDER BY lexical_score DESC
        LIMIT %s;
        """
        params = [clean_query] + base_params + [clean_query, self.candidate_limit]
        docs: List[Document] = []
        try:
            with psycopg.connect(self.db_url) as conn:
                with conn.cursor() as cur:
                    cur.execute(sql, params)
                    for rank, row in enumerate(cur.fetchall(), start=1):
                        lexical_score = float(row[7]) if row[7] is not None else 0.0
                        meta = row[6] if isinstance(row[6], dict) else {}
                        sec_default = "Item 8 - Financial Statements" if "10-k" in str(row[1]).lower() else "Document Passage"
                        meta.update({
                            "chunk_id": row[0],
                            "document_id": row[1],
                            "page_id": row[2],
                            "table_id": row[3],
                            "chunk_type": row[4],
                            "lexical_score": round(lexical_score, 4),
                            "lexical_rank": rank,
                            "printed_page": meta.get("printed_page", "N/A"),
                            "section": meta.get("section") or sec_default,
                        })
                    docs.append(Document(page_content=row[5], metadata=meta))
        except Exception:
            ## Full-text query encounters an issue, return empty
            return []
        return docs


    ### Reciprocal Rank Fusion (RRF k=60)
    def _reciprocal_rank_fusion(self, dense_docs: List[Document], lexical_docs: List[Document]):
        '''Fuses ranked candidate lists using RRF score 1/(k + rank). Chunks present in both dense and lexical lists receives
        a compound score boost'''
        rrf_scores: Dict[str, float] = {}
        doc_store: Dict[str, Document] = {}

        ## score of dense candidates
        for doc in dense_docs:
            cid = doc.metadata["chunk_id"]
            rank = doc.metadata.get("dense_rank", 100)
            score = 1.0 / (self.rrf_k + rank)
            rrf_scores[cid] = rrf_scores.get(cid, 0.0) + score
            doc_store[cid] = doc

        ## score of lexical candidates
        for doc in lexical_docs:
            cid = doc.metadata["chunk_id"]
            rank = doc.metadata.get("lexical_rank", 100)
            score = 1.0 / (self.rrf_k + rank)
            rrf_scores[cid] = rrf_scores.get(cid, 0.0) + score
            if cid in doc_store:
                ## Merge metadatas
                doc_store[cid].metadata["lexical_rank"] = rank
                doc_store[cid].metadata["lexical_score"] = doc.metadata.get("lexical_score", 0.0)
            else:
                doc_store[cid] = doc

        sorted_chunk_ids = sorted(rrf_scores.keys(), key=lambda cid: rrf_scores[cid], reverse=True)
        fused_docs: List[Document] = []
        for cid in sorted_chunk_ids[:self.top_k]:
            doc = doc_store[cid]
            doc.metadata["rrf_score"] = round(rrf_scores[cid], 6)
            fused_docs.append(doc)
        return fused_docs


    def _get_relevant_documents(self, query: str, *, run_manager: Optional[CallbackManagerForRetrieverRun] = None) -> List[Document]:
        where_clauses, base_params = self._build_where_filters(query)

        ## 1. Pure Dense (Baseline)
        if self.search_mode == "dense":
            return self._query_dense(query, where_clauses, base_params)[:self.top_k]
        
        ## 2. Pure Lexical (Keyword search only)
        if self.search_mode == "lexical":
            return self._query_lexical(query, where_clauses, base_params)[:self.top_k]
        
        ## 3. Hybrid RAG (DENSE + LEXICAL via RRF)
        dense_docs = self._query_dense(query, where_clauses, base_params)
        lexical_docs = self._query_lexical(query, where_clauses, base_params)

        if not lexical_docs:
            return dense_docs[:self.top_k]
        return self._reciprocal_rank_fusion(dense_docs, lexical_docs)
    