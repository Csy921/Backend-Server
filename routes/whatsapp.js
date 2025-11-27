const express = require('express');
const router = express.Router();
const whatsappConfig = require('../config/whatsappConfig');
const { validateWhatsAppMessage, validateSessionId } = require('../utils/validator');
const { logger, logWhatsAppMessage } = require('../services/logger');
const getRoutingController = require('../controllers/routingController');
const getSessionController = require('../controllers/sessionController');
// Choose one: Use adapter for external service OR built-in service
// Use lazy loading to avoid loading wechatyService when using external
function getWechatyService() {
  if (process.env.USE_EXTERNAL_WECHATY === 'true') {
    return require('../services/wechatyAdapter');
  } else {
    return require('../services/wechatyService');
  }
}
const getWhatsAppAdapter = require('../services/whatsappAdapter');
const { v4: uuidv4 } = require('uuid');

/**
 * Webhook verification endpoint (for WhatsApp Business API)
 */
router.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === whatsappConfig.verifyToken) {
    logger.info('WhatsApp webhook verified');
    res.status(200).send(challenge);
  } else {
    res.sendStatus(403);
  }
});

/**
 * Webhook endpoint for receiving WhatsApp messages
 */
router.post('/webhook', async (req, res) => {
  try {
    // Acknowledge receipt immediately
    res.status(200).send('OK');

    const body = req.body;

    // Handle WhatsApp Business API webhook format
    if (body.object === 'whatsapp_business_account') {
      const entry = body.entry?.[0];
      const changes = entry?.changes?.[0];
      const value = changes?.value;

      if (value?.messages) {
        for (const message of value.messages) {
          await processWhatsAppMessage({
            from: message.from,
            body: message.text?.body || message.body?.text || '',
            messageId: message.id,
            timestamp: message.timestamp,
          });
        }
      }
    } else {
      // Handle custom webhook format (including IFTTT format)
      // IFTTT typically sends: { value1, value2, value3 } or custom JSON
      const message = {
        from: body.from || body.sender || body.value1 || body.phone || body.number,
        body: body.body || body.text || body.message || body.value2 || body.content,
        messageId: body.messageId || body.id || body.value3 || `msg_${Date.now()}`,
        timestamp: body.timestamp || body.time || Date.now(),
      };

      if (validateWhatsAppMessage(message)) {
        await processWhatsAppMessage(message);
      } else {
        logger.warn('Invalid WhatsApp message format received', { body });
      }
    }
  } catch (error) {
    logger.error('Error processing WhatsApp webhook', error);
  }
});

/**
 * Process incoming WhatsApp message
 * @param {Object} message - WhatsApp message object
 */
async function processWhatsAppMessage(message) {
  try {
    logWhatsAppMessage(message.messageId || 'unknown', message);

    // Generate session ID
    const sessionId = uuidv4();

    // Get controllers and services
    const routingController = getRoutingController();
    const sessionController = getSessionController();
    const wechatyService = getWechatyService();

    // Process message for routing
    const routingResult = await routingController.processMessage(message.body);

    if (!routingResult.success) {
      logger.warn('Routing failed', { sessionId, error: routingResult.error });
      // Optionally send error message back to WhatsApp
      return;
    }

    // Create session
    const session = await sessionController.createSession(
      sessionId,
      routingResult,
      message.body
    );

    // Send message to each supplier group
    const sendPromises = routingResult.supplierGroups.map(async (group) => {
      const messageText = `[Sales Inquiry]\n\n${message.body}\n\n[Session ID: ${sessionId}]`;
      const sent = await wechatyService.sendToGroup(group.wechatGroupId, messageText);
      
      if (!sent) {
        logger.warn('Failed to send message to supplier group', {
          sessionId,
          groupId: group.wechatGroupId,
        });
      }
    });

    await Promise.all(sendPromises);

    // Wait for replies (with timeout handled by session controller)
    const result = await waitForSessionCompletion(sessionId, sessionController);

    // Send summary back to WhatsApp group
    if (result) {
      const whatsappAdapter = getWhatsAppAdapter();
      const salesGroupId = whatsappConfig.salesGroupId;
      
      if (salesGroupId) {
        // Format the summary message with session info
        const summaryMessage = `[Session: ${sessionId}]\n\n${result.summary}`;
        await whatsappAdapter.sendToGroup(salesGroupId, summaryMessage, sessionId);
        
        logger.info('Summary sent to WhatsApp sales group', {
          sessionId,
          groupId: salesGroupId,
          replyCount: result.replyCount,
        });
      } else {
        logger.warn('SALES_GROUP_ID not configured, cannot send summary to WhatsApp group', {
          sessionId,
        });
      }
    }
  } catch (error) {
    logger.error('Error processing WhatsApp message', error);
  }
}

/**
 * Wait for session completion
 * @param {string} sessionId - Session identifier
 * @param {Object} sessionController - Session controller instance
 * @returns {Promise<Object|null>} Session result or null
 */
async function waitForSessionCompletion(sessionId, sessionController) {
  return new Promise((resolve) => {
    const checkInterval = setInterval(() => {
      const session = sessionController.getSession(sessionId);
      
      if (!session || session.status === 'completed') {
        clearInterval(checkInterval);
        
        // Get final result
        if (session && session.status === 'completed') {
          resolve({
            sessionId,
            replies: session.finalReplies || session.replies,
            summary: session.summary || 'Processing replies...',
          });
        } else {
          resolve(null);
        }
      }
    }, 1000); // Check every second

    // Maximum wait time (safety net)
    setTimeout(() => {
      clearInterval(checkInterval);
      const session = sessionController.getSession(sessionId);
      if (session && session.status === 'active') {
        sessionController.completeSession(sessionId, true).then(resolve);
      } else {
        resolve(null);
      }
    }, 650000); // 10 minutes + buffer
  });
}


/**
 * Get session status endpoint
 */
router.get('/session/:sessionId', (req, res) => {
  try {
    const { sessionId } = req.params;
    
    if (!validateSessionId(sessionId)) {
      return res.status(400).json({ error: 'Invalid session ID' });
    }

    const sessionController = getSessionController();
    const session = sessionController.getSession(sessionId);

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    res.json({
      sessionId,
      status: session.status,
      category: session.category,
      repliesReceived: session.repliesReceived,
      duration: session.endTime ? session.endTime - session.startTime : Date.now() - session.startTime,
    });
  } catch (error) {
    logger.error('Error getting session status', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;

