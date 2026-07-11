-- Enable pgvector for semantic dedup / similarity search
CREATE EXTENSION IF NOT EXISTS vector;

-- Embedding of title + summary (nomic-embed-text, 768 dimensions)
ALTER TABLE "Article" ADD COLUMN IF NOT EXISTS "embedding" vector(768);

-- Approximate nearest-neighbour index for cosine distance (<=>)
CREATE INDEX IF NOT EXISTS "Article_embedding_cosine_idx"
  ON "Article"
  USING hnsw ("embedding" vector_cosine_ops);
