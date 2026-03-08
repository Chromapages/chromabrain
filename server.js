const express = require('express');
const cors = require('cors');
const config = require('./config');
const { initSupabase, initDatabase, searchChunks, insertChunks, clearChunks, getClient } = require('./supabase');
const { getEmbedding } = require('./embeddings');
const { indexAll, getFilesToIndex } = require('./indexer');

const app = express();
let chromabaseCache = null;
let lastSyncTime = null;

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

// Index a specific folder (for pipeline outputs)
app.post('/api/index/folder', async (req, res) => {
  try {
    const { folder, metadata } = req.body;
    
    if (!folder) {
      return res.status(400).json({ error: 'folder is required' });
    }
    
    const fs = require('fs');
    const path = require('path');
    
    // Check if folder exists
    if (!fs.existsSync(folder)) {
      return res.status(404).json({ error: 'Folder not found', folder });
    }
    
    // Read all files in folder
    const files = fs.readdirSync(folder);
    let indexedCount = 0;
    let chunksIndexed = 0;
    
    for (const file of files) {
      const filePath = path.join(folder, file);
      const stat = fs.statSync(filePath);
      
      // Skip directories
      if (stat.isDirectory()) continue;
      
      // Skip binary files (images, etc)
      const ext = path.extname(file).toLowerCase();
      if (['.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico', '.zip', '.pdf'].includes(ext)) {
        console.log(`Skipping binary file: ${file}`);
        continue;
      }
      
      try {
        const content = fs.readFileSync(filePath, 'utf-8');
        
        // Split content into chunks (simple chunking by paragraphs/lines)
        const chunks = content.split(/\n\n+/).filter(c => c.trim().length > 10);
        
        for (const chunk of chunks) {
          const embedding = await getEmbedding(chunk);
          await insertChunks(file, chunk, embedding, {
            ...metadata,
            source: 'ahm-pipeline',
            indexedAt: new Date().toISOString()
          });
          chunksIndexed++;
        }
        
        indexedCount++;
        console.log(`Indexed ${file}: ${chunks.length} chunks`);
      } catch (fileError) {
        console.error(`Error indexing ${file}:`, fileError.message);
      }
    }
    
    res.json({
      success: true,
      filesIndexed: indexedCount,
      totalChunks: chunksIndexed,
      folder,
      metadata,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Index folder error:', error.message);
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

// ChromaBase Sync Endpoint
app.get('/api/sync/chromabase', async (req, res) => {
  try {
    const { url, userId } = config.chromabase;
    const syncUrl = `${url}/api/sync?userId=${userId}`;
    
    const response = await fetch(syncUrl);
    if (!response.ok) {
      throw new Error(`ChromaBase sync failed: ${response.status}`);
    }
    
    const data = await response.json();
    chromabaseCache = data.data;
    lastSyncTime = new Date().toISOString();
    
    // Also index key data into ChromaBrain
    if (data.data && data.data.tasks) {
      const taskChunks = data.data.tasks.map(task => ({
        document_id: `chromabase_task_${task.id}`,
        title: `Task: ${task.title}`,
        content: `Task: ${task.title}\nStatus: ${task.status}\nPriority: ${task.priority}\nDescription: ${task.description || ''}\nDue Date: ${task.dueDate ? new Date(task.dueDate).toISOString() : 'N/A'}`,
        source: 'chromabase_tasks'
      }));
      
      // Insert into ChromaBrain
      try {
        const client = await getClient();
        for (const chunk of taskChunks.slice(0, 10)) { // Limit to avoid too many
          await client.from('chromabrain_chunks').upsert({
            document_id: chunk.document_id,
            title: chunk.title,
            content: chunk.content,
            source: chunk.source,
            embedding: await getEmbedding(chunk.content)
          }, { onConflict: 'document_id' });
        }
      } catch (e) {
        console.warn('Could not index tasks:', e.message);
      }
    }
    
    res.json({
      success: true,
      synced: {
        clients: data.data.clients?.length || 0,
        leads: data.data.leads?.length || 0,
        tasks: data.data.tasks?.length || 0,
        activities: data.data.activities?.length || 0
      },
      lastSync: lastSyncTime
    });
  } catch (error) {
    console.error('Sync error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Get cached ChromaBase data
app.get('/api/chromabase', (req, res) => {
  res.json({
    data: chromabaseCache,
    lastSync: lastSyncTime
  });
});

// Heartbeat: sync on startup
async function heartbeat() {
  try {
    console.log('❤️ ChromaBase Heartbeat: Syncing...');
    const { url, userId } = config.chromabase;
    const response = await fetch(`${url}/api/sync?userId=${userId}`);
    if (response.ok) {
      const data = await response.json();
      chromabaseCache = data.data;
      lastSyncTime = new Date().toISOString();
      console.log(`❤️ ChromaBase Heartbeat: Synced ${data.data.tasks?.length || 0} tasks, ${data.data.clients?.length || 0} clients`);
    }
  } catch (error) {
    console.error('❤️ ChromaBase Heartbeat failed:', error.message);
  }
}

// Start server
async function start() {
  try {
    // Initialize Supabase
    initSupabase();
    
    // Initialize database tables
    await initDatabase();
    
    // Run initial ChromaBase sync (heartbeat)
    await heartbeat();
    
    // Set up periodic sync every hour
    setInterval(heartbeat, 60 * 60 * 1000);
    
    app.listen(config.port, '0.0.0.0', () => {
      console.log(`🧠 ChromaBrain API running on port ${config.port}`);
      console.log(`   Search: http://0.0.0.0:${config.port}/api/search`);
      console.log(`   Sources: http://0.0.0.0:${config.port}/api/sources`);
      console.log(`   ChromaBase Sync: http://0.0.0.0:${config.port}/api/sync/chromabase`);
      console.log(`   ChromaBase Data: http://0.0.0.0:${config.port}/api/chromabase`);
    });
  } catch (error) {
    console.error('Failed to start server:', error.message);
    process.exit(1);
  }
}

start();
