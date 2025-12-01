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
    this.pollingErrorLogged = false; // Track if we've logged polling errors to avoid spam
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
      logger.info('Initializing Wechaty adapter connection...', {
        baseUrl: this.baseUrl,
        hasApiKey: !!this.apiKey,
        apiKeyLength: this.apiKey ? this.apiKey.length : 0,
      });

      // Test connection first
      await this.testConnection();

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
   * Test connection to Wechaty service
   */
  async testConnection() {
    try {
      // Try to reach the health endpoint or root
      const testUrls = [
        `${this.baseUrl}/health`,
        `${this.baseUrl}/`,
        `${this.baseUrl}/api/send`, // Try the actual endpoint (will fail but confirms service is reachable)
      ];

      for (const url of testUrls) {
        try {
          const response = await axios.get(url, {
            timeout: 5000,
            validateStatus: () => true, // Accept any status code
          });
          
          logger.info('Wechaty service connection test successful', {
            url,
            status: response.status,
          });
          return true;
        } catch (error) {
          // Try next URL
          continue;
        }
      }

      // If all URLs fail, log warning but continue (service might not have health endpoint)
      logger.warn('Wechaty service connection test failed - service may not be reachable', {
        baseUrl: this.baseUrl,
        note: 'Will attempt to send messages anyway',
      });
      return false;
    } catch (error) {
      logger.warn('Error testing Wechaty service connection', {
        error: error.message,
        baseUrl: this.baseUrl,
      });
      return false;
    }
  }

  /**
   * Register webhook with your Wechaty service
   * 
   * Request Format (Format 1 - Backend's format):
   * {
   *   "url": "https://backend-server-6wmd.onrender.com/webhook/wechat/webhook",
   *   "events": ["message", "group_message"]
   * }
   * 
   * Alternative Format (Format 2):
   * {
   *   "webhookUrl": "https://backend-server-6wmd.onrender.com/webhook/wechat/webhook"
   * }
   * 
   * Expected Response:
   * {
   *   "success": true,
   *   "message": "Webhook registered successfully",
   *   "webhookUrl": "...",
   *   "url": "...",
   *   "events": ["message", "group_message"],
   *   "note": "Messages will be sent to this webhook URL"
   * }
   */
  async registerWebhook() {
    // Define webhookUrl at function scope to ensure it's always available
    const webhookUrl = process.env.WEBHOOK_URL || 'http://localhost:3000/webhook/wechat/webhook';
    
    // Validate webhookUrl is set
    if (!webhookUrl || webhookUrl === 'http://localhost:3000/webhook/wechat/webhook') {
      logger.warn('WEBHOOK_URL not set, using default localhost URL. This may not work in production.', {
        webhookUrl: webhookUrl,
        envVar: process.env.WEBHOOK_URL,
      });
    }
    
    try {
      // Format 1: Backend's format (url + events)
      const requestBody = {
        url: webhookUrl,
        events: ['message', 'group_message'],
      };
      
      const response = await axios.post(
        `${this.baseUrl}/webhook/register`,
        requestBody,
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
          timeout: 30000, // 30 seconds timeout for webhook registration
        }
      );

      // Log successful registration with response details
      logger.info('Webhook registered with Wechaty service', {
        webhookUrl,
        status: response.status,
        responseData: response.data,
        success: response.data?.success,
        registeredUrl: response.data?.webhookUrl || response.data?.url,
        events: response.data?.events,
      });
      
      // Detailed log for webhook registration
      logger.info('[WECHATY OUTGOING]', {
        type: 'webhook_registration',
        direction: 'backend → wechaty',
        endpoint: `${this.baseUrl}/webhook/register`,
        requestBody: requestBody, // Format 1: { url, events }
        responseStatus: response.status,
        responseData: response.data, // Expected: { success, message, webhookUrl, url, events, note }
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      // Extract detailed error information
      const errorDetails = {
        error: error.message,
        errorCode: error.code,
        status: error.response?.status,
        statusText: error.response?.statusText,
        responseData: error.response?.data,
        responseHeaders: error.response?.headers,
        webhookUrl: webhookUrl, // Now always defined
        endpoint: `${this.baseUrl}/webhook/register`,
      };
      
      logger.warn('Webhook registration failed, will use polling instead', errorDetails);
      
      // Log failed webhook registration with full details
      logger.warn('[WECHATY OUTGOING FAILED]', {
        type: 'webhook_registration_failed',
        direction: 'backend → wechaty',
        endpoint: `${this.baseUrl}/webhook/register`,
        error: error.message,
        errorCode: error.code,
        status: error.response?.status,
        statusText: error.response?.statusText,
        responseData: error.response?.data,
        requestBody: {
          url: webhookUrl, // Now always defined
          events: ['message', 'group_message'],
        },
        timestamp: new Date().toISOString(),
      });
      
      // Provide specific hints based on error type
      if (error.code === 'ECONNREFUSED') {
        logger.warn('Webhook registration: Connection refused - Wechaty service may not be running', {
          baseUrl: this.baseUrl,
        });
      } else if (error.code === 'ETIMEDOUT') {
        logger.warn('Webhook registration: Timeout - Wechaty service may be slow to respond', {
          baseUrl: this.baseUrl,
          timeout: '30 seconds',
        });
      } else if (error.response?.status === 401) {
        logger.warn('Webhook registration: Unauthorized - Check WECHATY_API_KEY', {
          hasApiKey: !!this.apiKey,
        });
      } else if (error.response?.status === 404) {
        logger.warn('Webhook registration: Endpoint not found - Check if /webhook/register exists', {
          endpoint: `${this.baseUrl}/webhook/register`,
        });
      } else if (error.response?.status >= 500) {
        logger.warn('Webhook registration: Server error - Check Wechaty service logs', {
          status: error.response?.status,
          responseData: error.response?.data,
        });
      }
      
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

    // Reset error flag when starting polling
    this.pollingErrorLogged = false;

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

      // Reset error flag on successful poll
      if (this.pollingErrorLogged) {
        this.pollingErrorLogged = false;
        logger.info('Wechaty polling connection restored', {
          endpoint: `${this.baseUrl}/messages/pending`,
        });
      }

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
      // Only log once to avoid spam
      if (!this.pollingErrorLogged) {
        // Determine error type
        const isConnectionError = error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT';
        const is404 = error.response?.status === 404;
        
        // Only log if it's not a 404 (endpoint might not exist, that's ok)
        if (!is404) {
          // Use a message that doesn't contain "Error" to avoid ERROR source detection
          const logMessage = isConnectionError 
            ? 'Wechaty polling: Service unavailable, will retry silently'
            : 'Wechaty polling: Request failed, will retry silently';
          
          logger.warn(logMessage, {
            errorMsg: error.message, // Use errorMsg instead of error to avoid detection
            errorCode: error.code,
            status: error.response?.status,
            endpoint: `${this.baseUrl}/messages/pending`,
            note: 'This message will not appear again until connection is restored',
          });
          this.pollingErrorLogged = true;
        }
      }
      // Silently return - don't log again
      return;
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
   * @param {string} groupId - WeChat group ID (e.g., "27551115736@chatroom")
   * @param {string} messageText - Message text to send
   * @param {Object} options - Optional parameters
   * @param {string} options.roomName - Group name as fallback if roomId not found
   * @returns {Promise<boolean>} Success status
   */
  async sendToGroup(groupId, messageText, options = {}) {
    try {
      if (!this.isReady) {
        throw new Error('Wechaty adapter is not ready');
      }

      // Send via HTTP API
      // Endpoint: POST /api/send (as per Wechaty service API spec)
      // URL: https://3001.share.zrok.io/api/send (via zrok tunnel)
      // 
      // Wechaty Service Processing Flow:
      // 1. Receives POST request at /api/send
      // 2. Validates bot is logged in
      // 3. Parses: { contactId, message, roomId, contactName, roomName, groupId }
      // 4. Validates: message exists and is not empty
      // 5. Determines target: roomId || groupId || defaultTargetRoomId
      // 6. Finds room and sends message
      // 7. Returns: { success: true, message: "...", roomId, roomName }
      //
      // Expected Request Format:
      // {
      //   "message": "string (required)",
      //   "roomId": "string (optional, primary)",
      //   "groupId": "string (optional, alias for roomId)",
      //   "roomName": "string (optional, fallback)",
      //   "contactId": "string (optional, for private messages)",
      //   "contactName": "string (optional, for private messages)"
      // }
      // Ensure baseUrl doesn't have trailing slash
      const baseUrlClean = this.baseUrl.replace(/\/$/, '');
      const endpoint = `${baseUrlClean}/api/send`;
      
      // Validate message before building request
      // Matches Wechaty validation: if (!message || !message.trim())
      if (!messageText || typeof messageText !== 'string' || messageText.trim().length === 0) {
        logger.error('Cannot send empty message to WeChat', {
          roomId: groupId,
          messageType: typeof messageText,
          messageLength: messageText?.length || 0,
        });
        return false;
      }
      
      // Build request body according to Wechaty API spec:
      // Required: message (string)
      // Optional: roomId (primary), groupId (alias), roomName (fallback)
      // Wechaty parses: const { contactId, message, roomId, contactName, roomName, groupId } = data;
      // Wechaty determines target: const targetRoomId = roomId || groupId || BACKEND_CONFIG.defaultTargetRoomId;
      const requestBody = {
        message: messageText, // Required field - validated by Wechaty: if (!message || !message.trim())
      };
      
      // Add roomId (primary field per API spec)
      // Wechaty uses: roomId || groupId || defaultTargetRoomId
      if (groupId) {
        requestBody.roomId = groupId; // Primary field
        // Also include groupId as alias (both work per API spec)
        requestBody.groupId = groupId; // Alias - Wechaty accepts both
      }
      
      // Add roomName if provided (fallback option per API spec)
      if (options.roomName) {
        requestBody.roomName = options.roomName;
      }

      // Log the exact request being sent (for verification)
      logger.info('Sending message to Wechaty service', {
        endpoint: endpoint,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey ? '***' + this.apiKey.slice(-4) : 'NOT_SET'}`,
        },
        requestBody: JSON.parse(JSON.stringify(requestBody)), // Deep copy to show exact format
        messageLength: messageText.length,
        hasRoomId: !!requestBody.roomId,
        hasGroupId: !!requestBody.groupId,
        hasRoomName: !!requestBody.roomName,
      });

      const response = await axios.post(
        endpoint,
        requestBody,
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
          timeout: 30000, // 30 second timeout
          validateStatus: () => true, // Don't throw on HTTP errors, handle them below
        }
      );
      
      // Check if response indicates an error
      if (response.status < 200 || response.status >= 300) {
        // Include status and error details in the message for better visibility
        const errorMsg = response.data?.error || response.data?.message || 'Unknown error';
        const statusCode = response.status;
        
        // Extract full error details
        const fullErrorDetails = {
          status: statusCode,
          statusText: response.statusText,
          error: errorMsg,
          responseData: response.data,
          responseHeaders: response.headers,
          endpoint: endpoint,
          requestBody: {
            message: messageText?.substring(0, 100) + (messageText.length > 100 ? '...' : ''),
            messageLength: messageText?.length || 0,
            roomId: requestBody.roomId,
            groupId: requestBody.groupId,
            hasRoomName: !!requestBody.roomName,
          },
        };
        
        logger.error(`Wechaty service returned error status ${statusCode}: ${errorMsg}`, fullErrorDetails);
        
        // For 500 errors, log the full response for debugging
        if (statusCode === 500) {
          logger.error('Full 500 error response details:', {
            status: statusCode,
            statusText: response.statusText,
            headers: response.headers,
            data: response.data,
            dataString: JSON.stringify(response.data),
            requestSent: requestBody,
          });
        }
        
        // Log specific error types for common issues
        if (statusCode === 400) {
          logger.error('Bad Request - Check message format and required fields', {
            hint: 'Ensure "message" field is provided and valid',
          });
        } else if (statusCode === 401) {
          logger.error('Unauthorized - Check WECHATY_API_KEY is correct', {
            hasApiKey: !!this.apiKey,
          });
        } else if (statusCode === 404) {
          logger.error('Room not found - Check if roomId exists and bot is in the group', {
            roomId: groupId,
            hint: response.data?.hint || 'Make sure the bot is in the group and the roomId is correct',
          });
        } else if (statusCode === 500) {
          logger.error('Internal Server Error - Wechaty service encountered an error', {
            hint: 'This is a server-side error. Check Wechaty service logs for details.',
            possibleCauses: [
              'Bot may have lost connection to WeChat',
              'WeChat API may be temporarily unavailable',
              'Room lookup may have failed',
              'Message sending may have encountered an error'
            ],
            responseData: response.data,
            requestBody: {
              messageLength: messageText?.length || 0,
              hasRoomId: !!requestBody.roomId,
              hasGroupId: !!requestBody.groupId,
              roomId: requestBody.roomId,
            },
          });
        } else if (statusCode === 503) {
          logger.error('Service unavailable - Bot may not be logged in yet', {
            hint: 'Wait for the bot to connect to WeChat',
          });
        }
        
        return false;
      }

      logger.debug('Message sent to WeChat group via adapter', {
        roomId: groupId,
        status: response.status,
        endpoint: endpoint,
        responseData: response.data,
      });
      
      // Detailed log for all Wechaty communication (debug level to reduce noise)
      logger.debug('[WECHATY OUTGOING]', {
        type: 'send_message',
        direction: 'backend → wechaty',
        roomId: groupId,
        endpoint: endpoint,
        requestBody: requestBody, // Show exact request sent
        responseStatus: response.status,
        responseData: response.data,
        timestamp: new Date().toISOString(),
      });

      return response.status === 200 || response.status === 201;
    } catch (error) {
      // Log detailed error information - ensure all details are captured
      const errorDetails = {
        error: error.message || 'Unknown error',
        errorCode: error.code || 'NO_CODE',
        errorName: error.name || 'Error',
        roomId: groupId,
        baseUrl: this.baseUrl,
        endpoint: `${this.baseUrl}/api/send`,
        responseStatus: error.response?.status || 'N/A',
        responseStatusText: error.response?.statusText || 'N/A',
        responseData: error.response?.data || 'N/A',
        requestBody: {
          roomId: groupId,
          groupId: groupId, // Alias
          message: messageText?.substring(0, 100), // Preview only
          ...(options.roomName && { roomName: options.roomName }),
        },
        stack: error.stack || 'No stack trace',
      };
      
      logger.error('Error sending message to WeChat group via adapter', errorDetails);
      
      // Also log a more readable summary
      if (error.code === 'ECONNREFUSED') {
        logger.error('Connection refused - Wechaty service may not be running or URL is incorrect', {
          baseUrl: this.baseUrl,
          endpoint: `${this.baseUrl}/api/send`,
        });
      } else if (error.code === 'ETIMEDOUT' || error.code === 'ECONNABORTED') {
        logger.error('Connection timeout - Wechaty service may be slow or unreachable', {
          baseUrl: this.baseUrl,
          endpoint: `${this.baseUrl}/api/send`,
        });
      } else if (error.response?.status === 401) {
        logger.error('Unauthorized - Check WECHATY_API_KEY is correct', {
          hasApiKey: !!this.apiKey,
        });
      } else if (error.response?.status === 404) {
        logger.error('Endpoint not found - Check if /api/send endpoint exists on Wechaty service', {
          endpoint: `${this.baseUrl}/api/send`,
        });
      } else if (error.response?.status >= 500) {
        logger.error('Wechaty service error - Service returned server error', {
          status: error.response?.status,
          data: error.response?.data,
        });
      }
      
      // Log failed send attempt (keep error but reduce verbosity)
      logger.error('[WECHATY OUTGOING FAILED]', {
        type: 'send_message_failed',
        direction: 'backend → wechaty',
        endpoint: `${this.baseUrl}/api/send`,
        groupId,
        error: error.message,
        errorCode: error.code,
        responseStatus: error.response?.status,
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

