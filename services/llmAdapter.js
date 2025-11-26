/**
 * LLM Adapter Service
 * This adapter connects to your external LLM service
 * Modify this file to match your LLM service API
 */

const axios = require('axios');
const llmConfig = require('../config/llmConfig');
const { logger } = require('./logger');

class LLMAdapter {
  constructor() {
    this.config = llmConfig;
    // Add your LLM service base URL here
    this.baseUrl = process.env.LLM_SERVICE_URL || 'http://localhost:3003';
    this.apiKey = this.config.apiKey;
  }

  /**
   * Extract product category from message using external LLM service
   * @param {string} messageText - Message text from sales person
   * @returns {Promise<string|null>} Product category or null
   */
  async extractCategory(messageText) {
    try {
      // Option 1: Use your external LLM service
      if (this.baseUrl && this.baseUrl !== 'http://localhost:3003') {
        return await this.extractCategoryViaService(messageText);
      }

      // Option 2: Use direct API (OpenAI, etc.)
      return await this.extractCategoryViaAPI(messageText);
    } catch (error) {
      logger.error('Error extracting category with LLM adapter', error);
      return null;
    }
  }

  /**
   * Extract category via your custom LLM service
   * @param {string} messageText - Message text
   * @returns {Promise<string|null>} Category or null
   */
  async extractCategoryViaService(messageText) {
    try {
      const response = await axios.post(
        `${this.baseUrl}/extract-category`,
        {
          message: messageText,
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
        }
      );

      const category = response.data?.category || response.data?.result;
      return category && category.toLowerCase() !== 'unknown' 
        ? category.toLowerCase().trim() 
        : null;
    } catch (error) {
      logger.error('Error calling LLM service for category extraction', error);
      return null;
    }
  }

  /**
   * Extract category via direct API (OpenAI, Anthropic, etc.)
   * @param {string} messageText - Message text
   * @returns {Promise<string|null>} Category or null
   */
  async extractCategoryViaAPI(messageText) {
    try {
      const prompt = `Analyze the following message from a sales person and identify the product category. 
      Respond with ONLY the category name (e.g., "basin", "faucet", "toilet"). 
      If no clear category is found, respond with "unknown".
      
      Message: "${messageText}"
      
      Category:`;

      const response = await axios.post(
        this.config.apiUrl,
        {
          model: this.config.model,
          messages: [
            {
              role: 'user',
              content: prompt,
            },
          ],
          temperature: this.config.temperature,
          max_tokens: this.config.maxTokens,
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (response.data && response.data.choices && response.data.choices.length > 0) {
        const category = response.data.choices[0].message.content.trim();
        return category && category.toLowerCase() !== 'unknown' 
          ? category.toLowerCase().trim() 
          : null;
      }

      return null;
    } catch (error) {
      logger.error('Error calling LLM API for category extraction', error);
      return null;
    }
  }

  /**
   * Summarize multiple supplier replies using external LLM service
   * @param {Array} replies - Array of reply objects
   * @returns {Promise<string>} Summarized text
   */
  async summarizeReplies(replies) {
    try {
      if (!replies || replies.length === 0) {
        return 'No replies received from suppliers.';
      }

      // Option 1: Use your external LLM service
      if (this.baseUrl && this.baseUrl !== 'http://localhost:3003') {
        return await this.summarizeViaService(replies);
      }

      // Option 2: Use direct API
      return await this.summarizeViaAPI(replies);
    } catch (error) {
      logger.error('Error summarizing replies with LLM adapter', error);
      // Fallback to simple concatenation
      return replies.map(r => r.text).join('\n\n');
    }
  }

  /**
   * Summarize via your custom LLM service
   * @param {Array} replies - Reply objects
   * @returns {Promise<string>} Summary
   */
  async summarizeViaService(replies) {
    try {
      const response = await axios.post(
        `${this.baseUrl}/summarize`,
        {
          replies: replies,
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
        }
      );

      return response.data?.summary || response.data?.result || 'Replies received from suppliers.';
    } catch (error) {
      logger.error('Error calling LLM service for summarization', error);
      return replies.map(r => r.text).join('\n\n');
    }
  }

  /**
   * Summarize via direct API
   * @param {Array} replies - Reply objects
   * @returns {Promise<string>} Summary
   */
  async summarizeViaAPI(replies) {
    try {
      const repliesText = replies.map((reply, index) => 
        `Supplier ${index + 1} (${reply.groupId}): ${reply.text}`
      ).join('\n\n');

      const prompt = `Summarize the following supplier replies into a concise response for the sales person:
      
      ${repliesText}
      
      Summary:`;

      const response = await axios.post(
        this.config.apiUrl,
        {
          model: this.config.model,
          messages: [
            {
              role: 'user',
              content: prompt,
            },
          ],
          temperature: this.config.temperature,
          max_tokens: this.config.maxTokens,
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (response.data && response.data.choices && response.data.choices.length > 0) {
        return response.data.choices[0].message.content.trim();
      }

      return replies.map(r => r.text).join('\n\n');
    } catch (error) {
      logger.error('Error calling LLM API for summarization', error);
      return replies.map(r => r.text).join('\n\n');
    }
  }
}

// Singleton instance
let instance = null;

function getLLMAdapter() {
  if (!instance) {
    instance = new LLMAdapter();
  }
  return instance;
}

module.exports = getLLMAdapter;

