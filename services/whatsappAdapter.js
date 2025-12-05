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
   * Supports both WhatsApp Business API and custom WhatsApp service (wsmanager)
   * 
   * @param {string} recipient - WhatsApp recipient ID (phone number or group ID)
   *   - Individual: Phone number with country code (e.g., "60123456789")
   *   - Group: Group ID (e.g., "120363123456789012@g.us")
   * @param {string} messageText - Message text to send
   * @param {string} sessionId - Optional session ID for tracking
   * @param {Object} variables - Optional variables for message templating
   * @returns {Promise<boolean>} Success status
   */
  async sendMessage(recipient, messageText, sessionId = null, variables = null) {
    try {
      // Option 1: If using WhatsApp Business API directly
      if (this.config.phoneNumberId && this.config.accessToken) {
        return await this.sendViaBusinessAPI(recipient, messageText);
      }

      // Option 2: If using your own WhatsApp service (wsmanager)
      return await this.sendViaCustomService(recipient, messageText, sessionId, variables);
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
   * API: POST /api/whatsapp/send-message
   * 
   * Request Body:
   * {
   *   "to": "60123456789" or "120363123456789012@g.us",
   *   "message": "Hello {name}, welcome!",
   *   "variables": { "name": "John" } // optional
   * }
   * 
   * Response:
   * {
   *   "success": true,
   *   "messageId": "3EB0123456789ABCDEF",
   *   "to": "60123456789@s.whatsapp.net"
   * }
   * 
   * @param {string} recipient - Recipient ID (phone number or group ID)
   * @param {string} messageText - Message text
   * @param {string} sessionId - Session ID (for tracking)
   * @param {Object} variables - Optional variables for message templating
   * @returns {Promise<boolean>} Success status
   */
  async sendViaCustomService(recipient, messageText, sessionId = null, variables = null) {
    try {
      // Prepare request body according to API spec
      const requestBody = {
        to: recipient,
        message: messageText,
      };

      // Add variables if provided
      if (variables && typeof variables === 'object') {
        requestBody.variables = variables;
      }

      const response = await axios.post(
        `${this.baseUrl}/api/whatsapp/send-message`,
        requestBody,
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
        }
      );

      // Check response format according to API spec
      const responseData = response.data || {};
      const isSuccess = response.status === 200 || response.status === 201;
      const apiSuccess = responseData.success === true;

      if (isSuccess && apiSuccess) {
        logger.info('WhatsApp message sent via custom service', {
          recipient,
          sessionId,
          messageId: responseData.messageId,
          to: responseData.to,
          status: response.status,
        });
        return true;
      } else {
        logger.warn('WhatsApp API returned unsuccessful response', {
          recipient,
          sessionId,
          status: response.status,
          responseData,
        });
        return false;
      }
    } catch (error) {
      logger.error('Error sending via custom WhatsApp service', {
        error: error.message,
        recipient,
        sessionId,
        baseUrl: this.baseUrl,
        response: error.response?.data,
      });
      return false;
    }
  }

  /**
   * Send message to a WhatsApp group
   * @param {string} groupId - WhatsApp group ID (e.g., "120363123456789012@g.us")
   * @param {string} messageText - Message text
   * @param {string} sessionId - Optional session ID
   * @param {Object} variables - Optional variables for message templating
   * @returns {Promise<boolean>} Success status
   */
  async sendToGroup(groupId, messageText, sessionId = null, variables = null) {
    return await this.sendMessage(groupId, messageText, sessionId, variables);
  }

  /**
   * Send image to WhatsApp
   * @param {string} recipient - WhatsApp recipient ID (phone number or group ID)
   * @param {string} imageUrl - URL of the image to send
   * @param {string} caption - Optional caption for the image
   * @returns {Promise<boolean>} Success status
   */
  async sendImage(recipient, imageUrl, caption = '') {
    try {
      // Option 1: If using WhatsApp Business API directly
      if (this.config.phoneNumberId && this.config.accessToken) {
        return await this.sendImageViaBusinessAPI(recipient, imageUrl, caption);
      }

      // Option 2: If using your own WhatsApp service (wsmanager)
      return await this.sendImageViaCustomService(recipient, imageUrl, caption);
    } catch (error) {
      logger.error('Error sending WhatsApp image', error);
      return false;
    }
  }

  /**
   * Send image via WhatsApp Business API
   * @param {string} recipient - Recipient phone number (with country code, no +)
   * @param {string} imageUrl - URL of the image
   * @param {string} caption - Optional caption
   * @returns {Promise<boolean>} Success status
   */
  async sendImageViaBusinessAPI(recipient, imageUrl, caption = '') {
    try {
      const response = await axios.post(
        `https://graph.facebook.com/v18.0/${this.config.phoneNumberId}/messages`,
        {
          messaging_product: 'whatsapp',
          to: recipient,
          type: 'image',
          image: {
            link: imageUrl,
            caption: caption || undefined,
          },
        },
        {
          headers: {
            'Authorization': `Bearer ${this.config.accessToken}`,
            'Content-Type': 'application/json',
          },
        }
      );

      logger.info('WhatsApp image sent via Business API', {
        recipient,
        messageId: response.data?.messages?.[0]?.id,
      });

      return true;
    } catch (error) {
      logger.error('Error sending image via WhatsApp Business API', {
        error: error.message,
        response: error.response?.data,
      });
      return false;
    }
  }

  /**
   * Send image via your custom WhatsApp service
   * API: POST /api/whatsapp/send-image or POST /api/whatsapp/send-message with type=image
   * 
   * @param {string} recipient - Recipient ID (phone number or group ID)
   * @param {string} imageUrl - URL of the image
   * @param {string} caption - Optional caption
   * @returns {Promise<boolean>} Success status
   */
  async sendImageViaCustomService(recipient, imageUrl, caption = '') {
    try {
      // Try image-specific endpoint first
      const requestBody = {
        to: recipient,
        imageUrl: imageUrl,
        caption: caption,
      };

      let response;
      try {
        response = await axios.post(
          `${this.baseUrl}/api/whatsapp/send-image`,
          requestBody,
          {
            headers: {
              'Authorization': `Bearer ${this.apiKey}`,
              'Content-Type': 'application/json',
            },
          }
        );
      } catch (endpointError) {
        // If image endpoint doesn't exist, try send-message with type
        if (endpointError.response?.status === 404) {
          response = await axios.post(
            `${this.baseUrl}/api/whatsapp/send-message`,
            {
              to: recipient,
              type: 'image',
              imageUrl: imageUrl,
              message: caption, // Use message field for caption
            },
            {
              headers: {
                'Authorization': `Bearer ${this.apiKey}`,
                'Content-Type': 'application/json',
              },
            }
          );
        } else {
          throw endpointError;
        }
      }

      const responseData = response.data || {};
      const isSuccess = response.status === 200 || response.status === 201;
      const apiSuccess = responseData.success === true;

      if (isSuccess && apiSuccess) {
        logger.info('WhatsApp image sent via custom service', {
          recipient,
          messageId: responseData.messageId,
          status: response.status,
        });
        return true;
      } else {
        logger.warn('WhatsApp API returned unsuccessful response for image', {
          recipient,
          status: response.status,
          responseData,
        });
        return false;
      }
    } catch (error) {
      logger.error('Error sending image via custom WhatsApp service', {
        error: error.message,
        recipient,
        baseUrl: this.baseUrl,
        response: error.response?.data,
      });
      return false;
    }
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

