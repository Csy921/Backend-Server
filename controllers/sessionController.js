const { createTimer, hasExceededTime } = require('../utils/timer');
const wechatyConfig = require('../config/wechatyConfig');
const { logger, logSessionCreated, logSessionCompleted, logSessionTimeout, getRepliesFromLogs } = require('../services/logger');
const getWechatyService = require('../services/wechatyService');
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

class SessionController {
  constructor() {
    this.sessions = new Map(); // sessionId -> session data
    this.groupToSessionMap = new Map(); // groupId -> sessionId
    this.wechatyService = getWechatyService();
    // LLM service is optional - only initialize if configured
    try {
      this.llmService = getLLMService();
      // Test if LLM service is actually available
      if (!this.llmService || typeof this.llmService.summarizeReplies !== 'function') {
        this.llmService = null;
        logger.info('LLM service not available, will use simple reply formatting');
      }
    } catch (error) {
      this.llmService = null;
      logger.info('LLM service not configured, will use simple reply formatting');
    }
  }

  /**
   * Create a new session
   * @param {string} sessionId - Unique session identifier
   * @param {Object} routingResult - Result from routing controller
   * @param {string} originalMessage - Original message from sales person
   * @returns {Promise<Object>} Session data
   */
  async createSession(sessionId, routingResult, originalMessage) {
    const sessionData = {
      sessionId,
      category: routingResult.category,
      supplierGroups: routingResult.supplierGroups,
      originalMessage,
      replies: [],
      repliesReceived: 0,
      startTime: Date.now(),
      status: 'active',
      timer: null,
    };

    // Map each supplier group to this session
    routingResult.supplierGroups.forEach(group => {
      this.groupToSessionMap.set(group.wechatGroupId, sessionId);
      this.wechatyService.mapGroupToSession(group.wechatGroupId, sessionId);
    });

    // Register message handler
    this.wechatyService.registerMessageHandler(sessionId, (replyData) => {
      this.handleReply(sessionId, replyData);
    });

    // Set up timeout timer
    const timeoutCallback = () => {
      this.handleTimeout(sessionId);
    };
    sessionData.timer = createTimer(timeoutCallback, wechatyConfig.maxWaitTime);
    sessionData.timer.start();

    this.sessions.set(sessionId, sessionData);
    logSessionCreated(sessionId, sessionData);

    return sessionData;
  }

  /**
   * Handle a reply from a WeChat group
   * @param {string} sessionId - Session identifier
   * @param {Object} replyData - Reply data from WeChat
   */
  async handleReply(sessionId, replyData) {
    const session = this.sessions.get(sessionId);
    if (!session || session.status !== 'active') {
      return;
    }

    // Add reply to session
    session.replies.push(replyData);
    session.repliesReceived = session.replies.length;

    logger.info('Reply received for session', {
      sessionId,
      replyCount: session.repliesReceived,
      threshold: wechatyConfig.replyThreshold,
    });

    // Check if threshold is reached
    if (session.repliesReceived >= wechatyConfig.replyThreshold) {
      await this.completeSession(sessionId);
    }
  }

  /**
   * Handle session timeout
   * @param {string} sessionId - Session identifier
   */
  async handleTimeout(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session || session.status !== 'active') {
      return;
    }

    logSessionTimeout(sessionId);
    await this.completeSession(sessionId, true);
  }

  /**
   * Complete a session and prepare response
   * @param {string} sessionId - Session identifier
   * @param {boolean} isTimeout - Whether completion is due to timeout
   * @returns {Promise<Object>} Session result with replies
   */
  async completeSession(sessionId, isTimeout = false) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return null;
    }

    // Stop timer
    if (session.timer) {
      session.timer.stop();
    }

    // Update status
    session.status = 'completed';
    session.endTime = Date.now();
    session.duration = session.endTime - session.startTime;
    session.isTimeout = isTimeout;

    // Get all replies from logs (as backup/verification)
    const logReplies = await getRepliesFromLogs(sessionId);
    
    // Use session replies, fallback to log replies if needed
    const finalReplies = session.replies.length > 0 ? session.replies : logReplies;

    // Summarize replies using LLM (optional - fallback to simple concatenation if LLM not available)
    let summary = '';
    if (finalReplies.length > 0) {
      if (this.llmService) {
        try {
          summary = await this.llmService.summarizeReplies(finalReplies);
        } catch (error) {
          // LLM not available or failed - use simple concatenation
          logger.warn('LLM summarization failed, using simple format', { error: error.message });
          summary = this.formatRepliesSimple(finalReplies);
        }
      } else {
        // No LLM service - use simple format
        summary = this.formatRepliesSimple(finalReplies);
      }
    } else {
      summary = 'No replies received from suppliers within the time limit.';
    }

    // Store summary in session for retrieval
    session.summary = summary;
    session.finalReplies = finalReplies;

    const result = {
      sessionId,
      category: session.category,
      replies: finalReplies,
      replyCount: finalReplies.length,
      summary,
      duration: session.duration,
      isTimeout,
    };

    logSessionCompleted(sessionId, result);

    // Don't cleanup immediately - keep session for a short time to allow retrieval
    // Cleanup will happen after a delay
    setTimeout(() => {
      this.cleanupSession(sessionId);
    }, 60000); // Keep for 1 minute after completion

    return result;
  }

  /**
   * Cleanup session resources
   * @param {string} sessionId - Session identifier
   */
  cleanupSession(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    // Unregister message handler
    this.wechatyService.unregisterMessageHandler(sessionId);

    // Remove group mappings
    session.supplierGroups.forEach(group => {
      this.groupToSessionMap.delete(group.wechatGroupId);
    });

    // Remove session
    this.sessions.delete(sessionId);
  }

  /**
   * Get session by ID
   * @param {string} sessionId - Session identifier
   * @returns {Object|null} Session data or null
   */
  getSession(sessionId) {
    return this.sessions.get(sessionId) || null;
  }

  /**
   * Get session ID from group ID
   * @param {string} groupId - WeChat group ID
   * @returns {string|null} Session ID or null
   */
  getSessionFromGroup(groupId) {
    return this.groupToSessionMap.get(groupId) || null;
  }

  /**
   * Check if session is active
   * @param {string} sessionId - Session identifier
   * @returns {boolean} True if active
   */
  isSessionActive(sessionId) {
    const session = this.sessions.get(sessionId);
    return session && session.status === 'active';
  }

  /**
   * Format replies in simple text format (fallback when LLM not available)
   * @param {Array} replies - Array of reply objects
   * @returns {string} Formatted text
   */
  formatRepliesSimple(replies) {
    if (!replies || replies.length === 0) {
      return 'No replies received from suppliers.';
    }

    const replyTexts = replies.map((reply, index) => {
      const supplier = reply.from || `Supplier ${index + 1}`;
      return `${supplier}: ${reply.text}`;
    });

    return `Received ${replies.length} reply/replies from suppliers:\n\n${replyTexts.join('\n\n')}`;
  }
}

// Singleton instance
let instance = null;

function getSessionController() {
  if (!instance) {
    instance = new SessionController();
  }
  return instance;
}

module.exports = getSessionController;

