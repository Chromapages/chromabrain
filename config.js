require('dotenv').config();

module.exports = {
  port: process.env.PORT || 3456,
  supabase: {
    url: process.env.SUPABASE_URL || '',
    apiKey: process.env.SUPABASE_API_KEY || ''
  },
  openai: {
    apiKey: process.env.OPENAI_API_KEY,
    embeddingModel: 'text-embedding-3-small'
  },
  gemini: {
    apiKey: process.env.GEMINI_API_KEY,
    embeddingModel: 'gemini-embedding-001'
  },
  provider: process.env.EMBEDDING_PROVIDER || 'openai', // 'openai' or 'gemini'
  workspacePath: '/Volumes/MiDRIVE/Chroma-Team/openclaw-workspace'
};
