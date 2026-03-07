const fs = require('fs-extra');
const path = require('path');
const glob = require('glob');
const slugify = require('slugify');
const config = require('./config');
const { getEmbedding } = require('./embeddings');
const { insertChunks, clearChunks, getClient } = require('./supabase');

function getFilesToIndex() {
  const files = [];
  const basePath = config.workspacePath;
  
  // MEMORY.md
  const memoryPath = path.join(basePath, 'MEMORY.md');
  if (fs.existsSync(memoryPath)) {
    files.push({ path: memoryPath, type: 'memory', name: 'MEMORY.md' });
  }
  
  // memory/ folder
  const memoryDir = path.join(basePath, 'memory');
  if (fs.existsSync(memoryDir)) {
    const mdFiles = glob.sync('**/*.md', { cwd: memoryDir });
    mdFiles.forEach(f => {
      files.push({
        path: path.join(memoryDir, f),
        type: 'memory',
        name: f
      });
    });
  }
  
  // projects/ folder
  const projectsDir = path.join(basePath, 'projects');
  if (fs.existsSync(projectsDir)) {
    const projectFiles = glob.sync('**/*.{md,txt}', { cwd: projectsDir });
    projectFiles.forEach(f => {
      files.push({
        path: path.join(projectsDir, f),
        type: 'project',
        name: f
      });
    });
  }
  
  return files;
}

function chunkText(text, maxChunkSize = 1000) {
  const chunks = [];
  const lines = text.split('\n');
  let currentChunk = '';
  
  for (const line of lines) {
    if ((currentChunk + line).length > maxChunkSize && currentChunk.length > 0) {
      chunks.push(currentChunk.trim());
      currentChunk = '';
    }
    currentChunk += line + '\n';
  }
  
  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }
  
  return chunks;
}

async function indexFile(fileInfo) {
  try {
    const content = await fs.readFile(fileInfo.path, 'utf-8');
    const chunks = chunkText(content);
    
    const vectors = [];
    
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      if (chunk.length < 20) continue;
      
      const embedding = await getEmbedding(chunk);
      
      vectors.push({
        content: chunk,
        embedding: embedding
      });
    }
    
    return { file: fileInfo.name, chunks: vectors.length };
  } catch (error) {
    console.error(`Error indexing ${fileInfo.name}:`, error.message);
    return { file: fileInfo.name, error: error.message, chunks: 0 };
  }
}

async function indexAll() {
  console.log('🔄 Starting full reindex...');
  
  const files = getFilesToIndex();
  console.log(`📁 Found ${files.length} files to index`);
  
  // Clear existing chunks
  await clearChunks();
  
  let indexedCount = 0;
  let totalChunks = 0;
  
  for (const file of files) {
    const result = await indexFile(file);
    
    if (result.chunks > 0) {
      // Re-read and re-chunk
      const content = await fs.readFile(file.path, 'utf-8');
      const chunks = chunkText(content);
      
      const vectors = [];
      
      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        if (chunk.length < 20) continue;
        
        const embedding = await getEmbedding(chunk);
        
        vectors.push({
          content: chunk,
          embedding: embedding
        });
        
        totalChunks++;
      }
      
      // Insert into Supabase
      await insertChunks(slugify(file.name, { lower: true }), vectors);
      
      indexedCount++;
      console.log(`  ✅ ${file.name} (${result.chunks} chunks)`);
    }
  }
  
  console.log(`✅ Indexed ${totalChunks} chunks from ${indexedCount} files`);
  
  return {
    filesIndexed: indexedCount,
    totalChunks: totalChunks
  };
}

module.exports = { indexAll, getFilesToIndex };
