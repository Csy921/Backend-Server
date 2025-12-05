const express = require('express');
const router = express.Router();
const whatsappConfig = require('../config/whatsappConfig');
const { validateWhatsAppMessage, validateSessionId } = require('../utils/validator');
const { logger, logWhatsAppMessage } = require('../services/logger');
const getSessionController = require('../controllers/sessionController');
const getWechatyAdapter = require('../services/wechatyAdapter');

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
          // Extract image if present
          let imageUrl = null;
          let imageCaption = null;
          
          if (message.type === 'image' && message.image) {
            imageUrl = message.image.id || message.image.link;
            imageCaption = message.image.caption || message.text?.body || '';
          }
          
          await processWhatsAppMessage({
            from: message.from,
            body: message.text?.body || message.body?.text || '',
            messageId: message.id,
            timestamp: message.timestamp,
            imageUrl: imageUrl,
            imageCaption: imageCaption,
            hasImage: !!imageUrl,
          });
        }
      }
    } else {
      // Handle custom webhook format (including IFTTT format, wsmanager format)
      // IFTTT typically sends: { value1, value2, value3 } or custom JSON
      // wsmanager may send different formats depending on webhook pattern
      
      // Check if this is a message webhook or a status/event webhook
      // Status webhooks (delivery receipts, read receipts, etc.) don't have message content
      const isStatusWebhook = body.status || body.type === 'status' || body.event || 
                              (body.entry && body.entry[0]?.changes?.[0]?.value?.statuses);
      
      if (isStatusWebhook) {
        // This is a status/event webhook, not a message - ignore it
        logger.debug('WhatsApp status webhook received (ignored)', {
          type: body.type,
          status: body.status,
          event: body.event,
        });
        return;
      }
      
      // Extract message fields - support multiple formats including wsmanager
      // wsmanager format: senderNumber, senderName, messageBody, chatId
      // Also support: from, sender, author, contact, phone, number, participant
      // Also support: body, text, message, content, data, payload
      // Also handle nested objects (e.g., body.from.id, body.message.text)
      
      // Extract sender - handle wsmanager format first, then other formats
      let from = body.senderNumber ||      // wsmanager format
                 body.senderName ||        // wsmanager format (fallback to name)
                 body.from || 
                 body.sender || 
                 body.author || 
                 body.contact || 
                 body.phone || 
                 body.number || 
                 body.participant ||
                 body.value1;  // IFTTT format
      
      // If from is an object, extract the actual value
      if (from && typeof from === 'object' && from !== null) {
        from = from.id || from.number || from.phone || from.name || from.value || JSON.stringify(from);
      }
      
      // Extract body/content - handle wsmanager format first, then other formats
      let messageBody = body.messageBody ||  // wsmanager format (preferred)
                        (body.message && body.message.conversation) ||  // wsmanager nested format
                        body.body || 
                        body.text || 
                        body.message || 
                        body.content || 
                        body.data || 
                        body.payload ||
                        body.value2;  // IFTTT format
      
      // If body is an object, extract text from common fields
      if (messageBody && typeof messageBody === 'object' && messageBody !== null) {
        messageBody = messageBody.conversation ||  // wsmanager nested format
                      messageBody.text || 
                      messageBody.body || 
                      messageBody.message || 
                      messageBody.content ||
                      messageBody.data ||
                      JSON.stringify(messageBody);
      }
      
      // Extract image/media information
      let imageUrl = null;
      let imageCaption = null;
      
      // Check for image in various formats
      if (body.image || body.media || body.attachment) {
        const imageData = body.image || body.media || body.attachment;
        if (typeof imageData === 'string') {
          imageUrl = imageData;
        } else if (typeof imageData === 'object' && imageData !== null) {
          imageUrl = imageData.url || imageData.link || imageData.src || imageData.id;
          imageCaption = imageData.caption || imageData.text || messageBody;
        }
      }
      
      // Also check for WhatsApp Business API format
      if (body.type === 'image' || body.messageType === 'image') {
        const imageObj = body.image || body.media || body.attachment;
        if (imageObj) {
          imageUrl = imageObj.url || imageObj.link || imageObj.id || imageObj.media_id;
          imageCaption = imageObj.caption || messageBody;
        }
      }

      const message = {
        from: from,
        body: messageBody,
        messageId: body.messageId || 
                   body.id || 
                   body.message_id ||
                   body.msgId ||
                   body.value3 ||  // IFTTT format
                   `msg_${Date.now()}`,
        timestamp: body.timestamp || 
                   body.time || 
                   body.created_at ||
                   body.date ||
                   Date.now(),
        // Also extract group ID if present (for filtering)
        groupId: body.chatId ||      // wsmanager format (preferred)
                 body.groupId || 
                 body.group_id || 
                 body.chat_id ||
                 body.to,
        // Image information
        imageUrl: imageUrl,
        imageCaption: imageCaption,
        hasImage: !!imageUrl,
      };

      // Log the raw body for debugging (first time only to avoid spam)
      // Safely convert body to string for preview
      const bodyPreview = message.body 
        ? (typeof message.body === 'string' 
            ? message.body.substring(0, 50) 
            : JSON.stringify(message.body).substring(0, 50))
        : null;
      
      logger.info('WhatsApp webhook received (custom format)', {
        bodyKeys: Object.keys(body || {}),
        extractedMessage: {
          hasFrom: !!message.from,
          hasBody: !!message.body,
          bodyType: typeof message.body,
          from: message.from,
          bodyPreview: bodyPreview,
          groupId: message.groupId,
        },
      });

      if (validateWhatsAppMessage(message)) {
        await processWhatsAppMessage(message);
      } else {
        // Log with more details to help debug - include full body structure
        logger.warn('Invalid WhatsApp message format received', { 
          fullBody: body, // Log entire body for debugging
          extractedMessage: message,
          hasFrom: !!message.from,
          hasBody: !!message.body,
          bodyType: typeof message.body,
          bodyKeys: Object.keys(body || {}),
          bodySample: JSON.stringify(body).substring(0, 1000), // First 1000 chars for debugging
          validationDetails: {
            hasSender: !!(message.from || message.sender || message.author || message.contact || message.phone || message.number || message.participant),
            hasContent: !!(message.body || message.text || message.message || message.content || message.data || message.payload),
            senderFields: {
              from: message.from,
              sender: message.sender,
              author: message.author,
              contact: message.contact,
              phone: message.phone,
              number: message.number,
              participant: message.participant,
            },
            contentFields: {
              body: message.body,
              text: message.text,
              message: message.message,
              content: message.content,
              data: message.data,
              payload: message.payload,
            },
          },
        });
      }
    }
  } catch (error) {
    logger.error('Error processing WhatsApp webhook', error);
  }
});

/**
 * Format WhatsApp message for forwarding to WeChat
 * @param {Object} message - WhatsApp message object
 * @returns {string} Formatted message string
 */
function formatWhatsAppMessageForWeChat(message) {
  // Extract message text - handle both string and object formats
  let messageText = '';
  const rawBody = message.body || message.text || message.message || message.content || message.data || message.payload || '';
  
  // Convert to string if it's an object
  if (typeof rawBody === 'string') {
    messageText = rawBody;
  } else if (typeof rawBody === 'object' && rawBody !== null) {
    // If body is an object, try to extract text from common fields
    messageText = rawBody.text || rawBody.body || rawBody.message || rawBody.content || JSON.stringify(rawBody);
  } else {
    messageText = String(rawBody || '');
  }

  // Extract sender name/number
  const senderName = message.from || message.sender || 'Unknown';

  // Extract and format timestamp
  let formattedTime = '';
  if (message.timestamp) {
    try {
      // Convert Unix timestamp (seconds) to milliseconds if needed
      const timestamp = typeof message.timestamp === 'string' 
        ? new Date(message.timestamp) 
        : new Date(message.timestamp * 1000);
      
      // Extract date in dd-mm-yyyy format
      const day = String(timestamp.getDate()).padStart(2, '0');
      const month = String(timestamp.getMonth() + 1).padStart(2, '0');
      const year = timestamp.getFullYear();
      const dateFormatted = `${day}-${month}-${year}`;
      
      // Extract time in HH:MM:SS format
      const hours = String(timestamp.getHours()).padStart(2, '0');
      const minutes = String(timestamp.getMinutes()).padStart(2, '0');
      const seconds = String(timestamp.getSeconds()).padStart(2, '0');
      const timeFormatted = `${hours}:${minutes}:${seconds}`;
      
      formattedTime = `${dateFormatted} ${timeFormatted}`;
    } catch (e) {
      const now = new Date();
      const day = String(now.getDate()).padStart(2, '0');
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const year = now.getFullYear();
      const dateFormatted = `${day}-${month}-${year}`;
      const hours = String(now.getHours()).padStart(2, '0');
      const minutes = String(now.getMinutes()).padStart(2, '0');
      const seconds = String(now.getSeconds()).padStart(2, '0');
      const timeFormatted = `${hours}:${minutes}:${seconds}`;
      formattedTime = `${dateFormatted} ${timeFormatted}`;
    }
  } else {
    const now = new Date();
    const day = String(now.getDate()).padStart(2, '0');
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const year = now.getFullYear();
    const dateFormatted = `${day}-${month}-${year}`;
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    const timeFormatted = `${hours}:${minutes}:${seconds}`;
    formattedTime = `${dateFormatted} ${timeFormatted}`;
  }

  // Format: [WhatsApp → WeChat]
  // From: 
  // Time: {dd-mm-yyyy} {HH:MM:SS}
  // Message text
  return `[WhatsApp → WeChat]\n\nFrom: ${senderName}\nTime: ${formattedTime}\n\n${messageText}`;
}

/**
 * Forward WhatsApp message to WeChat group
 * @param {Object} message - WhatsApp message object
 */
async function forwardMessageToWeChatGroup(message) {
  try {
    const wechatGroupId = '27551115736@chatroom';
    const wechatyAdapter = getWechatyAdapter();
    
    logger.debug('Forwarding WhatsApp message to WeChat group', {
      groupId: wechatGroupId,
      from: message.from || message.sender || message.senderNumber || message.senderName,
      adapterReady: wechatyAdapter.isReady,
      hasImage: message.hasImage || !!message.imageUrl,
    });

    // Initialize adapter if not ready (fallback - should already be initialized at startup)
    if (!wechatyAdapter.isReady) {
      logger.warn('Wechaty adapter not ready, initializing now (should have been initialized at startup)...');
      try {
        await wechatyAdapter.initialize();
        logger.info('Wechaty adapter initialized successfully');
      } catch (initError) {
        logger.error('Failed to initialize Wechaty adapter', {
          error: initError.message,
          stack: initError.stack,
        });
        throw initError;
      }
    }

    // Handle image forwarding
    if (message.hasImage && message.imageUrl) {
      // Format caption with sender info if available
      let caption = message.imageCaption || '';
      if (message.from) {
        const senderInfo = `[From: ${message.from}]`;
        caption = caption ? `${senderInfo}\n${caption}` : senderInfo;
      }
      
      const imageSent = await wechatyAdapter.sendImage(wechatGroupId, message.imageUrl, caption);
      
      if (imageSent) {
        logger.info('Successfully forwarded WhatsApp image to WeChat group', {
          groupId: wechatGroupId,
          from: message.from || message.sender || message.senderNumber || message.senderName,
          imageUrl: message.imageUrl,
        });
      } else {
        logger.error('Failed to forward WhatsApp image to WeChat group', {
          groupId: wechatGroupId,
          imageUrl: message.imageUrl,
        });
      }
    } else {
      // Handle text message forwarding
      const formattedMessage = formatWhatsAppMessageForWeChat(message);
      const sent = await wechatyAdapter.sendToGroup(wechatGroupId, formattedMessage);

      if (sent) {
        logger.debug('Successfully forwarded WhatsApp message to WeChat group', {
          groupId: wechatGroupId,
          from: message.from || message.sender || message.senderNumber || message.senderName,
        });
      } else {
        // Only log errors, not failures (errors are logged in wechatyAdapter)
        logger.debug('Message forwarding returned false', {
          groupId: wechatGroupId,
        });
      }
    }
  } catch (error) {
    logger.error('Error forwarding WhatsApp message to WeChat group', {
      error: error.message,
      stack: error.stack,
      from: message.from || message.sender || message.senderNumber || message.senderName,
      groupId: '27551115736@chatroom',
    });
  }
}

/**
 * Process incoming WhatsApp message
 * @param {Object} message - WhatsApp message object
 */
async function processWhatsAppMessage(message) {
  try {
    // Log message receipt (without full content)
    logger.debug('WhatsApp message received', {
      messageId: message.messageId || 'unknown',
      from: message.from || message.sender || message.senderNumber || message.senderName,
      hasContent: !!(message.body || message.text || message.messageBody),
    });

    // Forward message to WeChat group
    await forwardMessageToWeChatGroup(message);
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

