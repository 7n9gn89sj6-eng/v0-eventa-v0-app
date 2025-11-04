-- Create indexes for optimized search after Prisma migrations

-- Full-text search index using pg_trgm
CREATE INDEX IF NOT EXISTS idx_event_search_text_trgm ON "Event" USING gin (search_text gin_trgm_ops);

-- Vector similarity search index (if using embeddings)
-- CREATE INDEX IF NOT EXISTS idx_event_embedding ON "Event" USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- Composite index for geo + time queries
CREATE INDEX IF NOT EXISTS idx_event_geo_time ON "Event" (lat, lng, starts_at);

-- Index for category filtering
CREATE INDEX IF NOT EXISTS idx_event_categories_gin ON "Event" USING gin (categories);
