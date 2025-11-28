/**
 * Wechaty Adapter Service
 * This adapter connects to your external Wechaty service
 * Modify this file to match your Wechaty service API
 */

const axios = require('axios');
const wechatyConfig = require('../config/wechatyConfig');
const { logger, logWeChatReply } = require('./logger');

class WechatyAdapter {
  constructor() {
    this.config = wechatyConfig;
    // Add your Wechaty service base URL here
    this.baseUrl = process.env.WECHATY_SERVICE_URL || 'http://localhost:3002';
    this.apiKey = process.env.WECHATY_API_KEY || '';
    this.isReady = false;
    this.messageHandlers = new Map(); // sessionId -> handler function
    this.groupToSessionMap = new Map(); // groupId -> sessionId
    this.pollingInterval = null;
  }

  /**
   * Initialize connection to external Wechaty service
   * This could be:
   * 1. WebSocket connection for real-time messages
   * 2. HTTP polling setup
   * 3. Webhook registration
   */
  async initialize() {
    try {
      logger.info('Initializing Wechaty adapter connection...');

      // Option 1: Register webhook with your Wechaty service
      await this.registerWebhook();

      // Option 2: Start polling for messages (if webhook not available)
      // this.startPolling();

      // Option 3: Connect via WebSocket (if your service supports it)
      // await this.connectWebSocket();

      this.isReady = true;
      logger.info('Wechaty adapter initialized');
    } catch (error) {
      logger.error('Failed to initialize Wechaty adapter', error);
      throw error;
    }
  }

  /**
   * Register webhook with your Wechaty service
   * Modify this to match your service's webhook registration API
   */
  async registerWebhook() {
    try {
      const webhookUrl = process.env.WEBHOOK_URL || 'http://localhost:3000/webhook/wechat/webhook';
      
      const response = await axios.post(
        `${this.baseUrl}/webhook/register`,
        {
          url: webhookUrl,
          events: ['message', 'group_message'],
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
          timeout: 30000, // 30 seconds timeout for webhook registration
        }
      );

      logger.info('Webhook registered with Wechaty service', {
        webhookUrl,
        status: response.status,
      });
      
      // Detailed log for webhook registration
      logger.info('[WECHATY OUTGOING]', {
        type: 'webhook_registration',
        direction: 'backend → wechaty',
        endpoint: `${this.baseUrl}/webhook/register`,
        requestBody: {
          url: webhookUrl,
          events: ['message', 'group_message'],
        },
        responseStatus: response.status,
        responseData: response.data,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.warn('Webhook registration failed, will use polling instead', {
        error: error.message,
      });
      
      // Log failed webhook registration
      logger.warn('[WECHATY OUTGOING FAILED]', {
        type: 'webhook_registration_failed',
        direction: 'backend → wechaty',
        endpoint: `${this.baseUrl}/webhook/register`,
        error: error.message,
        errorDetails: error.response?.data || error.stack,
        timestamp: new Date().toISOString(),
      });
      
      this.startPolling();
    }
  }

  /**
   * Start polling for messages from Wechaty service
   * Use this if webhooks are not available
   */
  startPolling() {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
    }

    this.pollingInterval = setInterval(async () => {
      await this.pollMessages();
    }, 10000); // Poll every 10 seconds (reduced frequency to avoid spam)

    logger.info('Started polling for Wechaty messages', {
      serviceUrl: this.baseUrl,
      note: 'Polling will be silent if service is not available',
    });
  }

  /**
   * Poll for new messages from Wechaty service
   */
  async pollMessages() {
    try {
      const response = await axios.get(
        `${this.baseUrl}/messages/pending`,
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
          },
          timeout: 3000, // 3 second timeout
        }
      );

      if (response.data && response.data.messages) {
        logger.info('[WECHATY POLLING]', {
          type: 'poll_response',
          direction: 'wechaty → backend',
          endpoint: `${this.baseUrl}/messages/pending`,
          messageCount: response.data.messages.length,
          messages: response.data.messages,
          timestamp: new Date().toISOString(),
        });
        
        for (const message of response.data.messages) {
          await this.handleMessage(message);
        }
      }
    } catch (error) {
      // Silently handle connection errors (service might not be running yet)
      // Only log if it's not a connection refused error
      if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
        // Service not available - this is expected if service isn't running
        // Don't log every poll attempt to avoid spam
        return;
      }
      
      // Log other errors (like 404, 401, etc.) but not connection refused
      if (error.response?.status !== 404) {
        logger.warn('Error polling Wechaty messages', {
          error: error.message,
          status: error.response?.status,
        });
      }
    }
  }

  /**
   * Handle incoming message from Wechaty service
   * This is called by webhook endpoint or polling
   * @param {Object} message - Message object from Wechaty service
   */
  async handleMessage(message) {
    try {
      // Support multiple message formats:
      // 1. New Wechaty format: { roomId, roomTopic, talkerName, text, timestamp, isGroup }
      // 2. Old nested format: { chat: { groupId, isGroup }, sender: { name }, message, timestamp }
      // 3. Old flat format: { groupId/roomId, from, text, timestamp }

      // Extract group ID - support all formats
      const chat = message.chat || {};
      const groupId = 
        message.roomId ||        // New Wechaty format
        chat.groupId ||          // Old nested format
        message.groupId ||       // Old flat format
        null;
      
      // Check if it's a group message
      const isGroupMessage = 
        message.isGroup !== undefined ? message.isGroup :
        (chat.isGroup !== undefined ? chat.isGroup : true);
      
      // Only process group messages
      if (!isGroupMessage && !groupId) {
        return; // Not a group message
      }
      
      if (!groupId) {
        return; // No group ID found
      }

      const sessionId = this.getSessionFromGroup(groupId);
      if (!sessionId) {
        // Extract message text for logging
        const text = message.text || message.message || message.content || '';
        // Log that message was received but not part of active session
        logger.warn('WeChat message received but not part of active session', {
          groupId,
          from: message.talkerName || message.sender?.name || message.from,
          messageText: text.substring(0, 100),
          availableSessions: Array.from(this.groupToSessionMap.entries()).map(([gid, sid]) => ({
            groupId: gid,
            sessionId: sid
          })),
        });
        return; // Not related to any active session
      }
      
      logger.info('WeChat message matched to session', {
        sessionId,
        groupId,
        from: message.talkerName || message.sender?.name || message.from,
      });

      // Extract sender name - support all formats
      const from = 
        message.talkerName ||    // New Wechaty format
        (message.sender && message.sender.name) ||  // Old nested format
        message.from ||          // Old flat format
        message.contact ||       // Fallback
        'Unknown';
      
      // Extract message text - support all formats
      const text = 
        message.text ||          // New Wechaty format (preferred)
        message.message ||       // Old format
        message.content ||       // Fallback
        '';
      
      // Extract timestamp
      const timestamp = message.timestamp || new Date().toISOString();

      const replyData = {
        sessionId,
        groupId,
        from,
        text,
        timestamp,
      };

      logWeChatReply(sessionId, groupId, replyData);

      // Detailed log for all Wechaty communication
      logger.info('[WECHATY INCOMING]', {
        type: 'received_message',
        direction: 'wechaty → backend',
        sessionId,
        groupId,
        from,
        message: text,
        rawMessage: message,
        timestamp,
        receivedAt: new Date().toISOString(),
      });

      // Notify the handler
      const handler = this.messageHandlers.get(sessionId);
      if (handler) {
        await handler(replyData);
      }
    } catch (error) {
      logger.error('Error handling Wechaty message', error);
    }
  }

  /**
   * Send message to a WeChat group via your Wechaty service
   * @param {string} groupId - WeChat group ID
   * @param {string} messageText - Message text to send
   * @returns {Promise<boolean>} Success status
   */
  async sendToGroup(groupId, messageText) {
    try {
      if (!this.isReady) {
        throw new Error('Wechaty adapter is not ready');
      }

      // Send via HTTP API
      // Endpoint: /api/send (as per Wechaty service)
      const response = await axios.post(
        `${this.baseUrl}/api/send`,
        {
          groupId: groupId,
          message: messageText,
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
        }
      );

      logger.info('Message sent to WeChat group via adapter', {
        groupId,
        messageText,
        status: response.status,
        endpoint: `${this.baseUrl}/api/send`,
        timestamp: new Date().toISOString(),
      });
      
      // Detailed log for all Wechaty communication
      logger.info('[WECHATY OUTGOING]', {
        type: 'send_message',
        direction: 'backend → wechaty',
        groupId,
        message: messageText,
        endpoint: `${this.baseUrl}/api/send`,
        requestBody: {
          groupId,
          message: messageText,
        },
        responseStatus: response.status,
        responseData: response.data,
        timestamp: new Date().toISOString(),
      });

      return response.status === 200 || response.status === 201;
    } catch (error) {
      logger.error('Error sending message to WeChat group via adapter', {
        error: error.message,
        groupId,
        baseUrl: this.baseUrl,
      });
      
      // Log failed send attempt
      logger.error('[WECHATY OUTGOING FAILED]', {
        type: 'send_message_failed',
        direction: 'backend → wechaty',
        endpoint: `${this.baseUrl}/api/send`,
        groupId,
        message: messageText,
        error: error.message,
        errorDetails: error.response?.data || error.stack,
        timestamp: new Date().toISOString(),
      });
      
      return false;
    }
  }

  /**
   * Register a message handler for a session
   * @param {string} sessionId - Session identifier
   * @param {Function} handler - Handler function
   */
  registerMessageHandler(sessionId, handler) {
    this.messageHandlers.set(sessionId, handler);
  }

  /**
   * Unregister a message handler
   * @param {string} sessionId - Session identifier
   */
  unregisterMessageHandler(sessionId) {
    this.messageHandlers.delete(sessionId);
  }

  /**
   * Map group ID to session ID
   * @param {string} groupId - WeChat group ID
   * @param {string} sessionId - Session identifier
   */
  mapGroupToSession(groupId, sessionId) {
    this.groupToSessionMap.set(groupId, sessionId);
  }

  /**
   * Get session ID from group ID
   * @param {string} groupId - WeChat group ID
   * @returns {string|null} Session ID
   */
  getSessionFromGroup(groupId) {
    return this.groupToSessionMap.get(groupId) || null;
  }

  /**
   * Stop the adapter
   */
  async stop() {
    try {
      if (this.pollingInterval) {
        clearInterval(this.pollingInterval);
        this.pollingInterval = null;
      }

      // Optionally unregister webhook
      // await axios.delete(`${this.baseUrl}/webhook/register`, ...);

      this.isReady = false;
      logger.info('Wechaty adapter stopped');
    } catch (error) {
      logger.error('Error stopping Wechaty adapter', error);
    }
  }
}

// Singleton instance
let instance = null;

function getWechatyAdapter() {
  if (!instance) {
    instance = new WechatyAdapter();
  }
  return instance;
}

module.exports = getWechatyAdapter;

