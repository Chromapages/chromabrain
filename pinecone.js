const { Pinecone } = require('@pinecone-database/pinecone');
const config = require('./config');

let pinecone = null;
let index = null;

async function initPinecone() {
  if (pinecone) return index;
  
  pinecone = new Pinecone({
    apiKey: config.pinecone.apiKey,
    environment: 'us-east-1-aws'
  });
  
  // Get or create index
  try {
    index = pinecone.index(config.pinecone.indexName);
    
    // Test connection
    await index.describeIndexStats();
    console.log('✅ Connected to Pinecone index:', config.pinecone.indexName);
  } catch (error) {
    console.error('Pinecone connection error:', error.message);
    throw error;
  }
  
  return index;
}

async function getIndex() {
  if (!index) {
    await initPinecone();
  }
  return index;
}

async function upsertVectors(namespace, vectors) {
  const idx = await getIndex();
  await idx.namespace(namespace).upsert(vectors);
}

async function queryNamespace(namespace, vector, topK = 10) {
  const idx = await getIndex();
  const results = await idx.namespace(namespace).query({
    vector,
    topK,
    includeMetadata: true,
    includeValues: false
  });
  return results;
}

async function deleteNamespace(namespace) {
  const idx = await getIndex();
  try {
    await idx.namespace(namespace).deleteAll();
  } catch (e) {
    // Namespace might not exist
  }
}

module.exports = { initPinecone, getIndex, upsertVectors, queryNamespace, deleteNamespace };
