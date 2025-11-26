const axios = require('axios');
const llmConfig = require('../config/llmConfig');
const { logger } = require('./logger');

class LLMService {
  constructor() {
    this.config = llmConfig;
  }

  /**
   * Extract product category from message using LLM
   * @param {string} messageText - Message text from sales person
   * @returns {Promise<string|null>} Product category or null
   */
  async extractCategory(messageText) {
    try {
      const prompt = `Analyze the following message from a sales person and identify the product category. 
      Respond with ONLY the category name (e.g., "basin", "faucet", "toilet"). 
      If no clear category is found, respond with "unknown".
      
      Message: "${messageText}"
      
      Category:`;

      const category = await this.callLLM(prompt);
      return category && category.toLowerCase() !== 'unknown' ? category.toLowerCase().trim() : null;
    } catch (error) {
      logger.error('Error extracting category with LLM', error);
      return null;
    }
  }

  /**
   * Summarize multiple supplier replies
   * @param {Array} replies - Array of reply objects
   * @returns {Promise<string>} Summarized text
   */
  async summarizeReplies(replies) {
    try {
      if (!replies || replies.length === 0) {
        return 'No replies received from suppliers.';
      }

      const repliesText = replies.map((reply, index) => 
        `Supplier ${index + 1} (${reply.groupId}): ${reply.text}`
      ).join('\n\n');

      const prompt = `Summarize the following supplier replies into a concise response for the sales person:
      
      ${repliesText}
      
      Summary:`;

      const summary = await this.callLLM(prompt);
      return summary || 'Replies received from suppliers.';
    } catch (error) {
      logger.error('Error summarizing replies with LLM', error);
      // Fallback to simple concatenation
      return replies.map(r => r.text).join('\n\n');
    }
  }

  /**
   * Call LLM API
   * @param {string} prompt - Prompt text
   * @returns {Promise<string>} LLM response
   */
  async callLLM(prompt) {
    try {
      if (this.config.provider === 'openai') {
        return await this.callOpenAI(prompt);
      } else {
        // Add support for other providers here
        throw new Error(`Unsupported LLM provider: ${this.config.provider}`);
      }
    } catch (error) {
      logger.error('Error calling LLM', error);
      throw error;
    }
  }

  /**
   * Call OpenAI API
   * @param {string} prompt - Prompt text
   * @returns {Promise<string>} OpenAI response
   */
  async callOpenAI(prompt) {
    try {
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
            'Authorization': `Bearer ${this.config.apiKey}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (response.data && response.data.choices && response.data.choices.length > 0) {
        return response.data.choices[0].message.content.trim();
      }

      throw new Error('Invalid response from OpenAI API');
    } catch (error) {
      logger.error('Error calling OpenAI API', error);
      throw error;
    }
  }
}

// Singleton instance
let instance = null;

function getLLMService() {
  if (!instance) {
    instance = new LLMService();
  }
  return instance;
}

module.exports = getLLMService;

