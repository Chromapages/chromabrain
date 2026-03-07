const { createClient } = require('@supabase/supabase-js');
const config = require('./config');

let supabase = null;

function initSupabase() {
  if (supabase) return supabase;
  
  supabase = createClient(
    config.supabase.url,
    config.supabase.apiKey
  );
  
  console.log('✅ Connected to Supabase');
  return supabase;
}

async function getClient() {
  if (!supabase) {
    initSupabase();
  }
  return supabase;
}

// Initialize tables if needed
async function initDatabase() {
  const client = await getClient();
  
  // Create tables if they don't exist
  const { error } = await client.rpc('exec_sql', {
    sql: `
      CREATE TABLE IF NOT EXISTS chromabrain_documents (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        source TEXT NOT NULL,
        content TEXT NOT NULL,
        type TEXT DEFAULT 'memory',
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      
      CREATE TABLE IF NOT EXISTS chromabrain_chunks (
        id TEXT PRIMARY KEY,
        document_id TEXT REFERENCES chromabrain_documents(id) ON DELETE CASCADE,
        chunk_index INTEGER NOT NULL,
        content TEXT NOT NULL,
        embedding VECTOR(1536),
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      
      CREATE INDEX IF NOT EXISTS chromabrain_chunks_embedding 
      ON chromabrain_chunks 
      USING ivfflat (embedding vector_cosine_ops);
    `
  });
  
  if (error) {
    console.log('Note: Database init error (may need manual setup):', error.message);
  }
}

async function searchChunks(queryEmbedding, topK = 10) {
  const client = await getClient();
  
  const { data, error } = await client.rpc('match_chunks', {
    query_embedding: queryEmbedding,
    match_threshold: 0.7,
    match_count: topK
  });
  
  if (error) {
    // Fallback to simpler query if function doesn't exist
    const { data: simpleData, error: simpleError } = await client
      .from('chromabrain_chunks')
      .select('*')
      .limit(topK);
    
    if (simpleError) throw simpleError;
    return simpleData || [];
  }
  
  return data || [];
}

async function insertChunks(documentId, chunks) {
  const client = await getClient();
  
  const records = chunks.map((chunk, i) => ({
    id: `${documentId}-${i}`,
    document_id: documentId,
    chunk_index: i,
    content: chunk.content,
    embedding: chunk.embedding
  }));
  
  const { error } = await client
    .from('chromabrain_chunks')
    .upsert(records, { onConflict: 'id' });
  
  if (error) throw error;
  return records.length;
}

async function clearChunks() {
  const client = await getClient();
  const { error } = await client.from('chromabrain_chunks').delete().neq('id', '');
  if (error) throw error;
}

module.exports = { 
  initSupabase, 
  getClient, 
  initDatabase, 
  searchChunks, 
  insertChunks, 
  clearChunks 
};
