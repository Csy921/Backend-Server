/**
 * Message validation utilities
 */

/**
 * Validates WhatsApp message format
 * @param {Object} message - Message object from WhatsApp
 * @returns {boolean} True if valid
 */
function validateWhatsAppMessage(message) {
  if (!message) return false;
  if (!message.from || !message.body) return false;
  return true;
}

/**
 * Validates WeChat message format
 * @param {Object} message - Message object from WeChat
 * @returns {boolean} True if valid
 */
function validateWeChatMessage(message) {
  if (!message) return false;
  if (!message.from || !message.text) return false;
  return true;
}

/**
 * Validates session ID format
 * @param {string} sessionId - Session identifier
 * @returns {boolean} True if valid
 */
function validateSessionId(sessionId) {
  if (!sessionId || typeof sessionId !== 'string') return false;
  if (sessionId.length < 1 || sessionId.length > 100) return false;
  return true;
}

/**
 * Validates product category
 * @param {string} category - Product category
 * @param {Object} routingRules - Routing rules object
 * @returns {boolean} True if valid category exists
 */
function validateCategory(category, routingRules) {
  if (!category || typeof category !== 'string') return false;
  if (!routingRules || !routingRules.categories) return false;
  return category.toLowerCase() in routingRules.categories;
}

/**
 * Sanitizes message text
 * @param {string} text - Raw message text
 * @returns {string} Sanitized text
 */
function sanitizeMessage(text) {
  if (!text || typeof text !== 'string') return '';
  // Remove excessive whitespace
  return text.trim().replace(/\s+/g, ' ');
}

/**
 * Extracts product category from message text
 * @param {string} text - Message text
 * @param {Object} routingRules - Routing rules object
 * @returns {string|null} Category name or null
 */
function extractCategory(text, routingRules) {
  if (!text || !routingRules || !routingRules.categories) return null;
  
  const lowerText = text.toLowerCase();
  const categories = Object.keys(routingRules.categories);
  
  for (const category of categories) {
    if (lowerText.includes(category)) {
      return category;
    }
  }
  
  return null;
}

module.exports = {
  validateWhatsAppMessage,
  validateWeChatMessage,
  validateSessionId,
  validateCategory,
  sanitizeMessage,
  extractCategory,
};

