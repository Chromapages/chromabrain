const express = require('express');
const cors = require('cors');
const config = require('./config');
const { initSupabase, initDatabase, searchChunks, insertChunks, clearChunks, getClient } = require('./supabase');
const { getEmbedding } = require('./embeddings');
const { indexAll, getFilesToIndex } = require('./indexer');

const app = express();

app.use(cors());
app.use(express.json());

// Root route
app.get('/', (req, res) => {
  res.json({
    name: 'ChromaBrain API',
    status: 'running',
    endpoints: {
      health: '/health',
      search: '/api/search?q=query',
      index: '/api/index/all',
      sources: '/api/sources'
    }
  });
});

// Health check
app.get('/health', async (req, res) => {
  try {
    const client = await getClient();
    const { data, error } = await client.from('chromabrain_chunks').select('id', { count: 'exact', head: true });
    
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      chunks: data?.length || 0
    });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// Search endpoint
app.get('/api/search', async (req, res) => {
  try {
    const { q } = req.query;
    
    if (!q) {
      return res.status(400).json({ error: 'Query parameter "q" is required' });
    }
    
    const startTime = Date.now();
    
    // Get query embedding
    const queryVector = await getEmbedding(q);
    
    // Search Supabase
    const results = await searchChunks(queryVector, 10);
    
    const formattedResults = results.map(match => ({
      title: match.title || match.document_id,
      source: match.source || '',
      snippet: match.content?.substring(0, 500) || '',
      score: match.similarity || 0.9
    }));
    
    res.json({
      results: formattedResults,
      took: `${Date.now() - startTime}ms`
    });
  } catch (error) {
    console.error('Search error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Index all files
app.post('/api/index/all', async (req, res) => {
  try {
    const result = await indexAll();
    res.json({
      success: true,
      ...result,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Index error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// List indexed sources
app.get('/api/sources', async (req, res) => {
  try {
    const files = getFilesToIndex();
    res.json({ sources: files.map(f => ({ name: f.name, type: f.type })) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Start server
async function start() {
  try {
    // Initialize Supabase
    initSupabase();
    
    // Initialize database tables
    await initDatabase();
    
    app.listen(config.port, '0.0.0.0', () => {
      console.log(`🧠 ChromaBrain API running on port ${config.port}`);
      console.log(`   Health: http://0.0.0.0:${config.port}/health`);
      console.log(`   Search: http://0.0.0.0:${config.port}/api/search`);
      console.log(`   Sources: http://0.0.0.0:${config.port}/api/sources`);
    });
  } catch (error) {
    console.error('Failed to start server:', error.message);
    process.exit(1);
  }
}

start();
