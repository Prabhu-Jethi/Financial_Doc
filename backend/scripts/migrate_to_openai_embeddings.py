"""
Database Migration: Re-embed SEC Document Chunks to OpenAI text-embedding-3-small (1536 Dimensions)

This script:
1. Adds a temporary 'embedding_v2 vector(1536)' column to the 'chunks' table.
2. Embeds all existing chunks in batches of 50 using text-embedding-3-small via Experiential Labs API.
3. Swaps 'embedding_v2' to 'embedding' and recreates the HNSW index (m=16, ef_construction=64).
4. Verifies vector similarity and validates the migration.

Fully idempotent and resumable if interrupted.
"""

import os
import sys
import time
import requests
from pathlib import Path
from dotenv import load_dotenv
import psycopg

# Load environment
PROJECT_ROOT = Path(__file__).resolve().parents[2]
load_dotenv(PROJECT_ROOT / ".env")

DATABASE_URL = os.environ.get("DATABASE_URL")
EXPLABS_API_KEY = os.environ.get("EXPLABS_API_KEY")
BASE_URL = "https://api.experientiallabs.ai/v1"
MODEL_NAME = "text-embedding-3-small"
BATCH_SIZE = 100
TARGET_DIM = 1536


def get_embeddings_batch(texts: list[str], max_retries: int = 3) -> list[list[float]]:
    """Fetches embeddings for a batch of texts with retry logic."""
    # Clean text to prevent null byte issues and ensure no empty strings (OpenAI rejects empty inputs)
    cleaned = [
        t.replace("\x00", "").strip() if t and t.replace("\x00", "").strip() else "(empty chunk)"
        for t in texts
    ]
    for attempt in range(1, max_retries + 1):
        try:
            resp = requests.post(
                f"{BASE_URL}/embeddings",
                headers={
                    "Authorization": f"Bearer {EXPLABS_API_KEY}",
                    "Content-Type": "application/json"
                },
                json={
                    "model": MODEL_NAME,
                    "input": cleaned
                },
                timeout=60
            )
            if resp.status_code == 200:
                data = resp.json()
                return [item["embedding"] for item in data["data"]]
            elif resp.status_code == 429:
                wait_time = attempt * 5
                print(f"Rate limited (429). Retrying in {wait_time}s...")
                time.sleep(wait_time)
            else:
                print(f"API Error {resp.status_code}: {resp.text[:200]}")
                time.sleep(2)
        except Exception as e:
            print(f"Request exception on attempt {attempt}: {e}")
            time.sleep(2)

    raise RuntimeError(f"Failed to fetch embeddings after {max_retries} attempts.")


def main():
    if not DATABASE_URL:
        print("DATABASE_URL not set.")
        sys.exit(1)
    if not EXPLABS_API_KEY:
        print("EXPLABS_API_KEY not set.")
        sys.exit(1)

    print("==================================================================")
    print("MIGRATING CHUNKS TO OPENAI text-embedding-3-small (1536-DIM)")
    print(f"API Endpoint: {BASE_URL}/embeddings")
    print("==================================================================")

    with psycopg.connect(DATABASE_URL) as conn:
        with conn.cursor() as cur:
            # 1. Ensure embedding_v2 column exists
            print("\n1. Checking database schema...")
            cur.execute("""
                DO $$
                BEGIN
                    IF NOT EXISTS (
                        SELECT 1 FROM information_schema.columns 
                        WHERE table_name = 'chunks' AND column_name = 'embedding_v2'
                    ) THEN
                        ALTER TABLE chunks ADD COLUMN embedding_v2 vector(1536);
                    END IF;
                END $$;
            """)
            conn.commit()

            # 2. Count total chunks vs remaining chunks
            cur.execute("SELECT count(*) FROM chunks;")
            total_chunks = cur.fetchone()[0]

            cur.execute("SELECT count(*) FROM chunks WHERE embedding_v2 IS NULL;")
            remaining_chunks = cur.fetchone()[0]

            completed = total_chunks - remaining_chunks
            print(f"Total chunks: {total_chunks}")
            print(f"Already embedded: {completed} ({completed/total_chunks*100:.1f}%)")
            print(f"Remaining to embed: {remaining_chunks}")

            # 3. Process remaining chunks in batches
            if remaining_chunks > 0:
                print(f"\n2. Embedding {remaining_chunks} chunks in batches of {BATCH_SIZE}...")
                processed = completed
                start_time = time.time()

                while True:
                    # Fetch next batch of un-embedded chunks
                    cur.execute(
                        "SELECT chunk_id, content FROM chunks WHERE embedding_v2 IS NULL ORDER BY chunk_id LIMIT %s;",
                        (BATCH_SIZE,)
                    )
                    rows = cur.fetchall()
                    if not rows:
                        break

                    chunk_ids = [r[0] for r in rows]
                    contents = [r[1] for r in rows]

                    # Embed batch via API
                    t_b0 = time.time()
                    vectors = get_embeddings_batch(contents)

                    # Update database in batch
                    update_data = [
                        (str(v), cid) for cid, v in zip(chunk_ids, vectors)
                    ]
                    cur.executemany(
                        "UPDATE chunks SET embedding_v2 = %s::vector WHERE chunk_id = %s;",
                        update_data
                    )
                    conn.commit()

                    processed += len(rows)
                    elapsed = time.time() - start_time
                    rate = (processed - completed) / elapsed if elapsed > 0 else 0
                    eta_sec = (total_chunks - processed) / rate if rate > 0 else 0
                    print(
                        f"[{processed}/{total_chunks}] {processed/total_chunks*100:5.1f}% | "
                        f"Batch {len(rows)} in {time.time()-t_b0:.2f}s | "
                        f"Rate: {rate:.1f} chunks/s | ETA: {eta_sec:.0f}s",
                        flush=True
                    )

                print(f"\nAll {total_chunks} chunks successfully embedded in {time.time()-start_time:.1f}s!")

            # 4. Final verification & Column Swap
            print("\n3. Finalizing schema swap...")
            cur.execute("SELECT count(*) FROM chunks WHERE embedding_v2 IS NULL;")
            null_count = cur.fetchone()[0]
            if null_count > 0:
                print(f"ERROR: {null_count} chunks still have NULL embedding_v2. Aborting swap.")
                sys.exit(1)

            # Drop old HNSW index
            print("Dropping legacy HNSW index...")
            cur.execute("DROP INDEX IF EXISTS idx_chunks_embedding_hnsw;")
            conn.commit()

            # Swap columns
            print("Swapping embedding_v2 -> embedding...")
            cur.execute("""
                ALTER TABLE chunks DROP COLUMN IF EXISTS embedding;
                ALTER TABLE chunks RENAME COLUMN embedding_v2 TO embedding;
            """)
            conn.commit()

            # Recreate HNSW index with 1536 dimensions
            print("Creating HNSW index on 1536-dimensional vectors...")
            t_idx0 = time.time()
            cur.execute("""
                CREATE INDEX IF NOT EXISTS idx_chunks_embedding_hnsw 
                ON chunks USING hnsw (embedding vector_cosine_ops) 
                WITH (m = 16, ef_construction = 64);
            """)
            conn.commit()
            print(f"HNSW index created in {time.time()-t_idx0:.2f}s.")

            # 5. Sanity Test Query
            print("\n4. Running validation query with text-embedding-3-small...")
            test_q = "What were Apple's total net sales in fiscal year 2024?"
            q_vec = get_embeddings_batch([test_q])[0]

            cur.execute("""
                SELECT chunk_id, document_id, 1 - (embedding <=> %s::vector) AS similarity, content
                FROM chunks
                WHERE document_id = 'AAPL-10K-2024'
                ORDER BY embedding <=> %s::vector ASC
                LIMIT 3;
            """, (str(q_vec), str(q_vec)))
            top_results = cur.fetchall()

            print("Top Results:")
            for rank, r in enumerate(top_results, start=1):
                print(f"Rank {rank}: [Sim: {r[2]:.4f}] {r[0]} | {r[3][:120]}...")

            print("\n==================================================================")
            print("MIGRATION COMPLETED SUCCESSFULLY!")
            print("==================================================================")


if __name__ == "__main__":
    main()
