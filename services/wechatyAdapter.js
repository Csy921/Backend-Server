/**
 * Wechaty Adapter Service
 * This adapter connects to your external Wechaty service
 * Modify this file to match your Wechaty service API
 * 
 * Authentication:
 * - ALL endpoints except /health require API key
 * - Format: Authorization: Bearer <API_KEY>
 * - Set WECHATY_API_KEY environment variable
 */

const axios = require('axios');
const wechatyConfig = require('../config/wechatyConfig');
const { logger, logWeChatReply } = require('./logger');

class WechatyAdapter {
  constructor() {
    this.config = wechatyConfig;
    // Add your Wechaty service base URL here
    this.baseUrl = process.env.WECHATY_SERVICE_URL || 'http://localhost:3002';
    // API key is required for all endpoints except /health
    // Format: Authorization: Bearer <API_KEY>
    this.apiKey = process.env.WECHATY_API_KEY || '';
    this.isReady = false;
    this.messageHandlers = new Map(); // sessionId -> handler function
    this.groupToSessionMap = new Map(); // groupId -> sessionId
  }

  /**
   * Initialize connection to external Wechaty service
   * 
   * Two separate operations:
   * 1. Receiving: Registers webhook URL via POST /webhook/register
   *    - This allows WeChat → Wechaty → backend message flow
   *    - Only needed once at startup
   * 
   * 2. Sending: Uses POST /api/send directly (no registration needed)
   *    - This allows backend → Wechaty → WeChat message flow
   *    - Called whenever sending a message
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

      // Register webhook for RECEIVING messages from WeChat
      // This is separate from sending - sending uses /api/send directly
      await this.registerWebhook();

      this.isReady = true;
      logger.info('Wechaty adapter initialized - webhook registered for receiving messages');
    } catch (error) {
      logger.error('Failed to initialize Wechaty adapter', error);
      throw error;
    }
  }

  /**
   * Test connection to Wechaty service
   * 
   * Authentication:
   * - ALL endpoints except /health require API key
   * - Format: Authorization: Bearer <API_KEY>
   * 
   * Available endpoints:
   * - GET /health (public, no auth required)
   * - GET / (protected, requires API key)
   * - GET /api/status (protected, requires API key)
   */
  async testConnection() {
    try {
      // First try health endpoint (public, no auth required)
      try {
        const healthResponse = await axios.get(`${this.baseUrl}/health`, {
          timeout: 5000,
          validateStatus: () => true,
        });
        
        logger.info('Wechaty service connection test successful (health check)', {
          url: `${this.baseUrl}/health`,
          status: healthResponse.status,
        });
        
        // If health check works, try protected endpoints with API key
        if (this.apiKey) {
          // Test /api/status (requires API key)
          try {
            const statusResponse = await axios.get(`${this.baseUrl}/api/status`, {
              headers: {
                'Authorization': `Bearer ${this.apiKey}`,
              },
              timeout: 5000,
              validateStatus: () => true,
            });
            
            if (statusResponse.status === 200) {
              logger.info('Wechaty service status check successful', {
                url: `${this.baseUrl}/api/status`,
                status: statusResponse.status,
                botLoggedIn: statusResponse.data?.botLoggedIn,
              });
              return true;
            } else if (statusResponse.status === 401) {
              logger.warn('Wechaty service status check failed - API key may be invalid', {
                url: `${this.baseUrl}/api/status`,
                status: statusResponse.status,
              });
            }
          } catch (statusError) {
            // Status check failed, but health check passed, so service is reachable
            logger.debug('Status check failed, but health check passed', {
              error: statusError.message,
            });
          }
        } else {
          logger.warn('WECHATY_API_KEY not set - cannot test protected endpoints', {
            note: 'Health check passed, but /api/status requires API key',
          });
        }
        
        return true; // Health check passed, service is reachable
      } catch (healthError) {
        // Health check failed, try protected endpoints as fallback
        if (this.apiKey) {
          // Try /api/status with API key
          try {
            const statusResponse = await axios.get(`${this.baseUrl}/api/status`, {
              headers: {
                'Authorization': `Bearer ${this.apiKey}`,
              },
              timeout: 5000,
              validateStatus: () => true,
            });
            
            logger.info('Wechaty service connection test successful (status check)', {
              url: `${this.baseUrl}/api/status`,
              status: statusResponse.status,
            });
            return true;
          } catch (statusError) {
            // Both failed
          }
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
   * Register webhook with Wechaty service for RECEIVING messages
   * 
   * This is for RECEIVING messages: WeChat → Wechaty → backend
   * For SENDING messages, use sendToGroup() which calls POST /api/send directly (no registration needed)
   * 
   * Endpoint: POST /webhook/register (or POST /api/webhook/register)
   * Authentication: Required - ALL endpoints except /health require API key
   * Format: Authorization: Bearer <API_KEY>
   * 
   * Request Format (New Format - Preferred):
   * POST https://3001.share.zrok.io/webhook/register
   * Authorization: Bearer 07a4161616db38e537faa58d73de461ac971fd036e6a89526a15b478ac288b28
   * {
   *   "webhook_url": "https://backend-server-6wmd.onrender.com/webhook/wechat/webhook",
   *   "token": "optional_auth_token",
   *   "platform": "whatsapp",
   *   "description": "WhatsApp to WeChat bridge",
   *   "timestamp": "2025-12-02T19:45:30.123+08:00"
   * }
   * 
   * Legacy formats also supported:
   * - { "webhookUrl": "...", "events": ["message", "group_message"] }
   * - { "url": "...", "events": ["message", "group_message"] }
   * 
   * Response:
   * {
   *   "success": true,
   *   "message": "Webhook registered successfully",
   *   "webhook_url": "https://backend-server-6wmd.onrender.com/webhook/wechat/webhook",
   *   "events": ["message", "group_message"],
   *   "registered_at": "2025-12-02T19:45:30.123+08:00"
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
      // Use new format (webhook_url with underscore) - preferred format
      // Also supports legacy formats for backward compatibility
      const requestBody = {
        webhook_url: webhookUrl, // New format (preferred)
        platform: 'whatsapp',
        description: 'WhatsApp to WeChat bridge',
        timestamp: new Date().toISOString(),
        // Include legacy fields for backward compatibility
        webhookUrl: webhookUrl, // Legacy format 1
        url: webhookUrl, // Legacy format 2
        events: ['message', 'group_message'], // Legacy format 2
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
      // Response may use webhook_url (new) or webhookUrl (legacy)
      const registeredUrl = response.data?.webhook_url || response.data?.webhookUrl || response.data?.url;
      logger.info('Webhook registered with Wechaty service', {
        webhookUrl,
        status: response.status,
        responseData: response.data,
        success: response.data?.success,
        registeredUrl: registeredUrl,
        events: response.data?.events,
        registeredAt: response.data?.registered_at,
      });
      
      // Detailed log for webhook registration
      logger.info('[WECHATY OUTGOING]', {
        type: 'webhook_registration',
        direction: 'backend → wechaty',
        endpoint: `${this.baseUrl}/webhook/register`,
        requestBody: requestBody, // Format: { webhook_url, platform, description, timestamp, ...legacy fields }
        responseStatus: response.status,
        responseData: response.data, // Expected: { success, message, webhook_url, events, registered_at }
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
      
      logger.error('Webhook registration failed', errorDetails);
      
      // Log failed webhook registration with full details
      logger.error('[WECHATY OUTGOING FAILED]', {
        type: 'webhook_registration_failed',
        direction: 'backend → wechaty',
        endpoint: `${this.baseUrl}/webhook/register`,
        error: error.message,
        errorCode: error.code,
        status: error.response?.status,
        statusText: error.response?.statusText,
        responseData: error.response?.data,
        requestBody: {
          webhookUrl: webhookUrl, // Now always defined
          events: ['message', 'group_message'],
        },
        timestamp: new Date().toISOString(),
      });
      
      // Provide specific hints based on error type
      if (error.code === 'ECONNREFUSED') {
        logger.error('Webhook registration: Connection refused - Wechaty service may not be running', {
          baseUrl: this.baseUrl,
        });
      } else if (error.code === 'ETIMEDOUT') {
        logger.error('Webhook registration: Timeout - Wechaty service may be slow to respond', {
          baseUrl: this.baseUrl,
          timeout: '30 seconds',
        });
      } else if (error.response?.status === 401) {
        logger.error('Webhook registration: Unauthorized - Check WECHATY_API_KEY', {
          hasApiKey: !!this.apiKey,
        });
      } else if (error.response?.status === 404) {
        logger.error('Webhook registration: Endpoint not found - Check if /webhook/register exists', {
          endpoint: `${this.baseUrl}/webhook/register`,
        });
      } else if (error.response?.status >= 500) {
        logger.error('Webhook registration: Server error - Check Wechaty service logs', {
          status: error.response?.status,
          responseData: error.response?.data,
        });
      }
      
      // Throw error - webhook registration is required
      throw new Error(`Webhook registration failed: ${error.message}`);
    }
  }

  /**
   * Handle incoming message from Wechaty service
   * This is called by webhook endpoint
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
   * Send message to a WeChat group via Wechaty service
   * 
   * This is for SENDING messages: backend → Wechaty → WeChat
   * Uses POST /api/send directly - NO registration needed
   * 
   * For RECEIVING messages, webhook must be registered via registerWebhook()
   * 
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
      // Endpoint: POST /api/send
      // URL: https://3001.share.zrok.io/api/send (via zrok tunnel)
      // Authentication: Required - ALL endpoints except /health require API key
      // Format: Authorization: Bearer <API_KEY>
      // 
      // Request Format:
      // {
      //   "message": "string (required)",
      //   "roomId": "string (optional, primary identifier)",
      //   "groupId": "string (optional, alias for roomId)",
      //   "roomName": "string (optional, fallback if roomId not found)"
      // }
      //
      // Response:
      // {
      //   "success": true,
      //   "message": "Message sent to group",
      //   "roomId": "27551115736@chatroom",
      //   "roomName": "Supplier Group 1"
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
      // This log appears BEFORE the request is sent, so you can see exactly what will be sent
      logger.info('═══════════════════════════════════════════════════════════');
      logger.info('📤 SENDING REQUEST TO WECHATY SERVICE');
      logger.info('═══════════════════════════════════════════════════════════');
      logger.info('📍 Full URL:', endpoint);
      logger.info('🔗 Base URL:', this.baseUrl);
      logger.info('📋 Method: POST');
      logger.info('📦 Request Body:', JSON.stringify(requestBody, null, 2));
      logger.info('📏 Message Length:', messageText.length);
      logger.info('🔑 Has API Key:', !!this.apiKey);
      logger.info('🏠 Has RoomId:', !!requestBody.roomId, requestBody.roomId || 'N/A');
      logger.info('👥 Has GroupId:', !!requestBody.groupId, requestBody.groupId || 'N/A');
      logger.info('📝 Has RoomName:', !!requestBody.roomName, requestBody.roomName || 'N/A');
      logger.info('═══════════════════════════════════════════════════════════');
      
      // Also log in structured format for parsing
      logger.info('Sending message to Wechaty service', {
        fullUrl: endpoint,
        baseUrl: this.baseUrl,
        endpoint: '/api/send',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey ? '***' + this.apiKey.slice(-4) : 'NOT_SET'}`,
        },
        requestBody: JSON.parse(JSON.stringify(requestBody)), // Deep copy to show exact format
        messageLength: messageText.length,
        messagePreview: messageText.substring(0, 100) + (messageText.length > 100 ? '...' : ''),
        hasRoomId: !!requestBody.roomId,
        hasGroupId: !!requestBody.groupId,
        hasRoomName: !!requestBody.roomName,
      });

      // Log immediately before sending request
      logger.info('🚀 EXECUTING HTTP POST REQUEST NOW...');
      logger.info('   URL:', endpoint);
      logger.info('   Body:', JSON.stringify(requestBody));
      
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
      
      logger.info('✅ REQUEST COMPLETED - Status:', response.status);
      
      // Check if response indicates an error
      if (response.status < 200 || response.status >= 300) {
        logger.error('═══════════════════════════════════════════════════════════');
        logger.error('❌ ERROR RESPONSE RECEIVED');
        logger.error('═══════════════════════════════════════════════════════════');
        logger.error('📍 Request URL:', endpoint);
        logger.error('📦 Request Body Sent:', JSON.stringify(requestBody, null, 2));
        logger.error('📊 Response Status:', response.status, response.statusText);
        logger.error('📄 Response Data:', JSON.stringify(response.data, null, 2));
        logger.error('═══════════════════════════════════════════════════════════');
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

