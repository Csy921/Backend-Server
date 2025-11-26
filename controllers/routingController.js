const fs = require('fs');
const path = require('path');
const routingRulesPath = path.join(__dirname, '../data/routingRules.json');
const { validateCategory, extractCategory, sanitizeMessage } = require('../utils/validator');
const { logger } = require('../services/logger');
// LLM service is optional - only load if configured
function getLLMService() {
  try {
    if (process.env.USE_EXTERNAL_LLM === 'true') {
      return require('../services/llmAdapter');
    } else if (process.env.LLM_API_KEY) {
      // Only load if API key is configured
      return require('../services/llmService');
    }
    return null;
  } catch (error) {
    return null;
  }
}

class RoutingController {
  constructor() {
    this.routingRules = this.loadRoutingRules();
    // LLM service is optional - only initialize if configured
    try {
      this.llmService = getLLMService();
      // Test if LLM service is actually available (not just the module)
      if (!this.llmService || typeof this.llmService.extractCategory !== 'function') {
        this.llmService = null;
        logger.info('LLM service not available, using rule-based category extraction only');
      }
    } catch (error) {
      this.llmService = null;
      logger.info('LLM service not configured, using rule-based category extraction only');
    }
  }

  /**
   * Load routing rules from JSON file
   * @returns {Object} Routing rules object
   */
  loadRoutingRules() {
    try {
      const data = fs.readFileSync(routingRulesPath, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      logger.error('Error loading routing rules', error);
      return { categories: {} };
    }
  }

  /**
   * Reload routing rules from file
   */
  reloadRoutingRules() {
    this.routingRules = this.loadRoutingRules();
  }

  /**
   * Determine product category from message
   * @param {string} messageText - Message text
   * @returns {Promise<string|null>} Category name or null
   */
  async determineCategory(messageText) {
    try {
      const sanitized = sanitizeMessage(messageText);
      
      // First try rule-based extraction
      let category = extractCategory(sanitized, this.routingRules);
      
      // If not found, try LLM extraction (optional - gracefully handle if LLM not available)
      if (!category && this.llmService) {
        try {
          category = await this.llmService.extractCategory(sanitized);
          
          // Validate the LLM-extracted category
          if (category && !validateCategory(category, this.routingRules)) {
            logger.warn('LLM extracted invalid category', { category, messageText: sanitized });
            category = null;
          }
        } catch (error) {
          // LLM not available or failed - continue without it
          logger.warn('LLM category extraction failed, using rule-based only', { error: error.message });
        }
      }

      return category;
    } catch (error) {
      logger.error('Error determining category', error);
      return null;
    }
  }

  /**
   * Get supplier groups for a category
   * @param {string} category - Product category
   * @returns {Array} Array of supplier group objects
   */
  getSupplierGroups(category) {
    if (!category || !this.routingRules.categories) {
      return [];
    }

    const categoryData = this.routingRules.categories[category.toLowerCase()];
    if (!categoryData || !categoryData.suppliers) {
      logger.warn('No suppliers found for category', { category });
      return [];
    }

    return categoryData.suppliers;
  }

  /**
   * Route message to appropriate supplier groups
   * @param {string} messageText - Original message text
   * @param {string} category - Product category
   * @returns {Object} Routing result with supplier groups
   */
  routeMessage(messageText, category) {
    const supplierGroups = this.getSupplierGroups(category);

    if (supplierGroups.length === 0) {
      logger.warn('No supplier groups found for routing', { category, messageText });
      return {
        success: false,
        category,
        supplierGroups: [],
        error: 'No supplier groups found for this category',
      };
    }

    return {
      success: true,
      category,
      supplierGroups,
      messageText,
    };
  }

  /**
   * Process incoming message and determine routing
   * @param {string} messageText - Message text from sales person
   * @returns {Promise<Object>} Routing result
   */
  async processMessage(messageText) {
    try {
      // Determine category
      const category = await this.determineCategory(messageText);

      if (!category) {
        return {
          success: false,
          category: null,
          supplierGroups: [],
          error: 'Could not determine product category from message',
        };
      }

      // Route message
      return this.routeMessage(messageText, category);
    } catch (error) {
      logger.error('Error processing message for routing', error);
      return {
        success: false,
        category: null,
        supplierGroups: [],
        error: error.message,
      };
    }
  }
}

// Singleton instance
let instance = null;

function getRoutingController() {
  if (!instance) {
    instance = new RoutingController();
  }
  return instance;
}

module.exports = getRoutingController;

