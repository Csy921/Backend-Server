// Conditionally load Wechaty - only if not using external service
let Wechaty = null;
const useExternalWechaty = process.env.USE_EXTERNAL_WECHATY === 'true';

// Only try to load Wechaty if we're actually going to use it
// This prevents errors when the module is loaded but Wechaty isn't installed
if (!useExternalWechaty) {
  try {
    // Try to load Wechaty - if it fails, we'll handle it in initialize()
    Wechaty = require('wechaty').Wechaty;
  } catch (error) {
    // Don't throw here - let initialize() handle it
    // This allows the module to be loaded even if Wechaty isn't installed
    Wechaty = null;
  }
}

const wechatyConfig = require('../config/wechatyConfig');
const { logger, logWeChatReply } = require('./logger');

class WechatyService {
  constructor() {
    this.bot = null;
    this.isReady = false;
    this.messageHandlers = new Map(); // sessionId -> handler function
  }

  /**
   * Initialize and start the Wechaty bot
   */
  async initialize() {
    try {
      if (!Wechaty) {
        // Try to load it one more time in case it wasn't available at module load
        if (!useExternalWechaty) {
          try {
            Wechaty = require('wechaty').Wechaty;
          } catch (error) {
            throw new Error('Wechaty is required but not installed. Install with: npm install wechaty wechaty-puppet-wechat');
          }
        } else {
          throw new Error('Wechaty is not available. This service should not be used when USE_EXTERNAL_WECHATY=true');
        }
      }
      
      this.bot = new Wechaty({
        name: wechatyConfig.name,
        puppet: wechatyConfig.puppet,
      });

      // Set up event handlers
      this.bot
        .on('scan', (qrcode, status) => {
          logger.info('WeChat QR code scan', { status });
          console.log(`Scan QR Code to login: ${status}\nhttps://wechaty.js.org/qrcode/${encodeURIComponent(qrcode)}`);
        })
        .on('login', (user) => {
          logger.info('WeChat bot logged in', { user: user.name() });
          this.isReady = true;
        })
        .on('logout', (user) => {
          logger.info('WeChat bot logged out', { user: user.name() });
          this.isReady = false;
        })
        .on('message', async (message) => {
          await this.handleMessage(message);
        })
        .on('error', (error) => {
          logger.error('WeChat bot error', error);
        });

      await this.bot.start();
      logger.info('Wechaty bot initialized');
    } catch (error) {
      logger.error('Failed to initialize Wechaty bot', error);
      throw error;
    }
  }

  /**
   * Handle incoming WeChat messages
   * @param {Object} message - Wechaty message object
   */
  async handleMessage(message) {
    try {
      // Ignore messages from self
      if (message.self()) return;

      // Only handle group messages
      const room = message.room();
      if (!room) return;

      const roomId = room.id;
      const contact = message.from();
      const text = message.text();

      // Check if this is a reply to an active session
      const sessionId = this.getSessionFromGroup(roomId);
      if (sessionId) {
        const replyData = {
          sessionId,
          groupId: roomId,
          from: contact.name(),
          text,
          timestamp: new Date().toISOString(),
        };

        logWeChatReply(sessionId, roomId, replyData);

        // Notify the handler
        const handler = this.messageHandlers.get(sessionId);
        if (handler) {
          await handler(replyData);
        }
      }
    } catch (error) {
      logger.error('Error handling WeChat message', error);
    }
  }


  /**
   * Send message to a WeChat group
   * @param {string} groupId - WeChat group ID
   * @param {string} messageText - Message text to send
   * @returns {Promise<boolean>} Success status
   */
  async sendToGroup(groupId, messageText) {
    try {
      if (!this.isReady || !this.bot) {
        throw new Error('Wechaty bot is not ready');
      }

      const room = await this.bot.Room.find({ id: groupId });
      if (!room) {
        logger.warn('WeChat group not found', { groupId });
        return false;
      }

      await room.say(messageText);
      logger.info('Message sent to WeChat group', { groupId, messageText });
      return true;
    } catch (error) {
      logger.error('Error sending message to WeChat group', { error: error.message, groupId });
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
   * Map group ID to session ID (called by session controller)
   * @param {string} groupId - WeChat group ID
   * @param {string} sessionId - Session identifier
   */
  mapGroupToSession(groupId, sessionId) {
    // Store mapping - simplified version
    // In production, use a proper data structure
    if (!this.groupToSessionMap) {
      this.groupToSessionMap = new Map();
    }
    this.groupToSessionMap.set(groupId, sessionId);
  }

  /**
   * Get session ID from group ID
   * @param {string} groupId - WeChat group ID
   * @returns {string|null} Session ID
   */
  getSessionFromGroup(groupId) {
    if (!this.groupToSessionMap) return null;
    return this.groupToSessionMap.get(groupId) || null;
  }

  /**
   * Stop the Wechaty bot
   */
  async stop() {
    try {
      if (this.bot) {
        await this.bot.stop();
        this.isReady = false;
        logger.info('Wechaty bot stopped');
      }
    } catch (error) {
      logger.error('Error stopping Wechaty bot', error);
    }
  }
}

// Singleton instance
let instance = null;

function getWechatyService() {
  if (!instance) {
    instance = new WechatyService();
  }
  return instance;
}

module.exports = getWechatyService;

