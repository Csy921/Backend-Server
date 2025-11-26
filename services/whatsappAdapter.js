/**
 * WhatsApp Adapter Service
 * This adapter connects to your external WhatsApp service
 * Modify this file to match your WhatsApp service API
 */

const axios = require('axios');
const whatsappConfig = require('../config/whatsappConfig');
const { logger } = require('./logger');

class WhatsAppAdapter {
  constructor() {
    this.config = whatsappConfig;
    // Add your WhatsApp service base URL here
    this.baseUrl = process.env.WHATSAPP_SERVICE_URL || 'http://localhost:3001';
    this.apiKey = this.config.apiKey;
  }

  /**
   * Send message to WhatsApp
   * Modify this method to match your WhatsApp service API
   * @param {string} recipient - WhatsApp recipient ID (phone number or group ID)
   * @param {string} messageText - Message text to send
   * @param {string} sessionId - Optional session ID for tracking
   * @returns {Promise<boolean>} Success status
   */
  async sendMessage(recipient, messageText, sessionId = null) {
    try {
      // Option 1: If using WhatsApp Business API directly
      if (this.config.phoneNumberId && this.config.accessToken) {
        return await this.sendViaBusinessAPI(recipient, messageText);
      }

      // Option 2: If using your own WhatsApp service
      return await this.sendViaCustomService(recipient, messageText, sessionId);
    } catch (error) {
      logger.error('Error sending WhatsApp message', error);
      return false;
    }
  }

  /**
   * Send via WhatsApp Business API
   * @param {string} recipient - Recipient phone number (with country code, no +)
   * @param {string} messageText - Message text
   * @returns {Promise<boolean>} Success status
   */
  async sendViaBusinessAPI(recipient, messageText) {
    try {
      const response = await axios.post(
        `https://graph.facebook.com/v18.0/${this.config.phoneNumberId}/messages`,
        {
          messaging_product: 'whatsapp',
          to: recipient,
          type: 'text',
          text: { body: messageText },
        },
        {
          headers: {
            'Authorization': `Bearer ${this.config.accessToken}`,
            'Content-Type': 'application/json',
          },
        }
      );

      logger.info('WhatsApp message sent via Business API', {
        recipient,
        messageId: response.data?.messages?.[0]?.id,
      });

      return true;
    } catch (error) {
      logger.error('Error sending via WhatsApp Business API', {
        error: error.message,
        response: error.response?.data,
      });
      return false;
    }
  }

  /**
   * Send via your custom WhatsApp service
   * Modify this to match your service's API
   * @param {string} recipient - Recipient ID
   * @param {string} messageText - Message text
   * @param {string} sessionId - Session ID
   * @returns {Promise<boolean>} Success status
   */
  async sendViaCustomService(recipient, messageText, sessionId = null) {
    try {
      // Send message via WhatsApp service endpoint
      // Endpoint: /api/whatsapp/send-message
      // Format: { to, message, variables (optional) }
      const response = await axios.post(
        `${this.baseUrl}/api/whatsapp/send-message`,
        {
          to: recipient,
          message: messageText,
          // Optional: variables for message templating
          // variables: { name: "John" }
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
        }
      );

      logger.info('WhatsApp message sent via custom service', {
        recipient,
        sessionId,
        status: response.status,
      });

      return response.status === 200 || response.status === 201;
    } catch (error) {
      logger.error('Error sending via custom WhatsApp service', {
        error: error.message,
        baseUrl: this.baseUrl,
      });
      return false;
    }
  }

  /**
   * Send message to a WhatsApp group
   * @param {string} groupId - WhatsApp group ID
   * @param {string} messageText - Message text
   * @param {string} sessionId - Optional session ID
   * @returns {Promise<boolean>} Success status
   */
  async sendToGroup(groupId, messageText, sessionId = null) {
    return await this.sendMessage(groupId, messageText, sessionId);
  }

  /**
   * Verify webhook (for WhatsApp Business API)
   * @param {string} mode - Hub mode
   * @param {string} token - Verify token
   * @param {string} challenge - Challenge string
   * @returns {string|null} Challenge string if verified, null otherwise
   */
  verifyWebhook(mode, token, challenge) {
    if (mode === 'subscribe' && token === this.config.verifyToken) {
      return challenge;
    }
    return null;
  }
}

// Singleton instance
let instance = null;

function getWhatsAppAdapter() {
  if (!instance) {
    instance = new WhatsAppAdapter();
  }
  return instance;
}

module.exports = getWhatsAppAdapter;

