const express = require('express');
const router = express.Router();
const whatsappConfig = require('../config/whatsappConfig');
const { validateWhatsAppMessage, validateSessionId } = require('../utils/validator');
const { logger, logWhatsAppMessage } = require('../services/logger');
const getSessionController = require('../controllers/sessionController');

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

    // Session/routing workflow disabled.
    logger.info('Session workflow disabled - ignoring WhatsApp inbound message', {
      from: message.from || message.sender,
      preview: (message.body || '').slice(0, 120),
    });
  } catch (error) {
    logger.error('Error processing WhatsApp message', error);
  }
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

