const OpenAI = require('openai');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const config = require('./config');

const openai = new OpenAI({
  apiKey: config.openai.apiKey
});

const genAI = config.gemini?.apiKey ? new GoogleGenerativeAI(config.gemini.apiKey) : null;

async function getEmbedding(text) {
  if (config.provider === 'gemini' && genAI) {
    try {
      const model = genAI.getGenerativeModel({ model: config.gemini.embeddingModel });
      const result = await model.embedContent({
        content: { role: 'user', parts: [{ text }] },
        taskType: 'RETRIEVAL_QUERY',
        outputDimensionality: 1536
      });
      return result.embedding.values;
    } catch (error) {
      console.error('Gemini embedding error:', error.message);
      throw error;
    }
  }

  // Default to OpenAI
  try {
    const response = await openai.embeddings.create({
      model: config.openai.embeddingModel,
      input: text
    });
    return response.data[0].embedding;
  } catch (error) {
    console.error('OpenAI embedding error:', error.message);
    throw error;
  }
}

async function getEmbeddings(texts) {
  if (config.provider === 'gemini' && genAI) {
    try {
      const model = genAI.getGenerativeModel({ model: config.gemini.embeddingModel });
      const embeddings = await Promise.all(
        texts.map(async (text) => {
          const result = await model.embedContent({
            content: { role: 'user', parts: [{ text }] },
            taskType: 'RETRIEVAL_QUERY',
            outputDimensionality: 1536
          });
          return result.embedding.values;
        })
      );
      return embeddings;
    } catch (error) {
      console.error('Gemini batch embedding error:', error.message);
      throw error;
    }
  }

  // Default to OpenAI
  try {
    const response = await openai.embeddings.create({
      model: config.openai.embeddingModel,
      input: texts
    });
    return response.data.map(item => item.embedding);
  } catch (error) {
    console.error('OpenAI batch embedding error:', error.message);
    throw error;
  }
}

module.exports = { getEmbedding, getEmbeddings };
