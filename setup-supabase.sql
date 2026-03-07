-- ChromaBrain Supabase Setup SQL
-- Run this in Supabase SQL Editor

-- Enable vector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Create documents table
CREATE TABLE IF NOT EXISTS chromabrain_documents (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  source TEXT NOT NULL,
  content TEXT NOT NULL,
  type TEXT DEFAULT 'memory',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create chunks table with vector column
CREATE TABLE IF NOT EXISTS chromabrain_chunks (
  id TEXT PRIMARY KEY,
  document_id TEXT REFERENCES chromabrain_documents(id) ON DELETE CASCADE,
  chunk_index INTEGER NOT NULL,
  content TEXT NOT NULL,
  embedding vector(1536),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Note: IVFFlat index skipped due to memory constraints
-- Search will work but may be slower without the index
-- You can add it later via: CREATE INDEX ... USING ivfflat ... WITH (lists = 10);

-- Drop existing function if it exists (different signature)
DROP FUNCTION IF EXISTS match_chunks(vector,float,int);

-- Create function for semantic search
CREATE OR REPLACE FUNCTION match_chunks(
  query_embedding vector(1536),
  match_threshold float DEFAULT 0.7,
  match_count int DEFAULT 10
)
RETURNS TABLE (
  id text,
  document_id text,
  chunk_index integer,
  content text,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.id,
    c.document_id,
    c.chunk_index,
    c.content,
    (c.embedding <=> query_embedding) AS similarity
  FROM chromabrain_chunks c
  WHERE (c.embedding <=> query_embedding) > (1 - match_threshold)
  ORDER BY c.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Enable Row Level Security
ALTER TABLE chromabrain_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE chromabrain_chunks ENABLE ROW LEVEL SECURITY;

-- Allow public read access (adjust as needed)
CREATE POLICY "Allow public read" ON chromabrain_documents FOR SELECT USING (true);
CREATE POLICY "Allow public read" ON chromabrain_chunks FOR SELECT USING (true);
CREATE POLICY "Allow public insert" ON chromabrain_documents FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public insert" ON chromabrain_chunks FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update" ON chromabrain_documents FOR UPDATE USING (true);
CREATE POLICY "Allow public update" ON chromabrain_chunks FOR UPDATE USING (true);
CREATE POLICY "Allow public delete" ON chromabrain_documents FOR DELETE USING (true);
CREATE POLICY "Allow public delete" ON chromabrain_chunks FOR DELETE USING (true);

-- Create source column in chunks if needed
ALTER TABLE chromabrain_chunks ADD COLUMN IF NOT EXISTS source TEXT;
ALTER TABLE chromabrain_chunks ADD COLUMN IF NOT EXISTS title TEXT;

SELECT 'Setup complete!' AS status;
