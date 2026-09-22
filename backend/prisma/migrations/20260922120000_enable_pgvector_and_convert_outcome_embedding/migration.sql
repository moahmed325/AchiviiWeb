-- Enable pgvector. The earlier migration folder was named as though it did this,
-- but it never actually ran this statement.
CREATE EXTENSION IF NOT EXISTS vector;

-- Convert outcomeEmbedding from a JSON-serialized text array to a real vector column.
-- pgvector's text input format is '[0.1,0.2,...]', which is byte-identical to what
-- JSON.stringify produced, so existing rows cast across without a data rewrite step.
ALTER TABLE "research_cache"
  ALTER COLUMN "outcomeEmbedding" DROP NOT NULL;

ALTER TABLE "research_cache"
  ALTER COLUMN "outcomeEmbedding" TYPE vector(768)
  USING NULLIF("outcomeEmbedding", '')::vector(768);

-- Approximate nearest-neighbour index for Stage 1.5 Tier 2 lookups.
-- vector_cosine_ops matches the <=> operator used by the resolver.
CREATE INDEX IF NOT EXISTS "research_cache_outcome_embedding_idx"
  ON "research_cache"
  USING hnsw ("outcomeEmbedding" vector_cosine_ops);

-- Supports the Tier 0 raw-input containment lookup, which previously scanned every row.
CREATE INDEX IF NOT EXISTS "research_cache_raw_inputs_idx"
  ON "research_cache"
  USING gin (("canonicalMethod" -> 'rawInputs') jsonb_path_ops);
