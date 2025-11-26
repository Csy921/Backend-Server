require('dotenv').config();

module.exports = {
  // LLM API configuration (e.g., OpenAI, Anthropic, etc.)
  provider: process.env.LLM_PROVIDER || 'openai',
  apiKey: process.env.LLM_API_KEY || '',
  apiUrl: process.env.LLM_API_URL || 'https://api.openai.com/v1/chat/completions',
  model: process.env.LLM_MODEL || 'gpt-3.5-turbo',
  // Temperature for text generation
  temperature: parseFloat(process.env.LLM_TEMPERATURE || '0.7'),
  // Max tokens for response
  maxTokens: parseInt(process.env.LLM_MAX_TOKENS || '500'),
};

