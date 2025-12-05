/**
 * WeChat Webhook Route
 * This endpoint receives messages from your external Wechaty service
 */

const express = require('express');
const router = express.Router();
const { logger } = require('../services/logger');
const getWechatyAdapter = require('../services/wechatyAdapter');
const getWhatsAppAdapter = require('../services/whatsappAdapter');
const whatsappConfig = require('../config/whatsappConfig');

/**
 * Webhook endpoint for receiving WeChat messages from external service
 * POST /webhook/wechat
 */
router.post('/webhook', async (req, res) => {
  try {
    // Acknowledge receipt immediately
    res.status(200).json({ status: 'ok' });

    const message = req.body;

    // Log all incoming webhook requests
    logger.info('[WECHATY WEBHOOK RECEIVED]', {
      type: 'webhook_request',
      direction: 'wechaty → backend',
      endpoint: '/webhook/wechat/webhook',
      rawBody: req.body,
      headers: req.headers,
      timestamp: new Date().toISOString(),
    });

    // Filter out messages from self (if isFromSelf is true)
    // Also filter out outgoing messages (only process incoming)
    if (message.isFromSelf === true || message.direction === 'outgoing') {
      logger.debug('Skipping message from self or outgoing message', {
        isFromSelf: message.isFromSelf,
        direction: message.direction,
      });
      return;
    }

    // Forward every incoming WeChat message to WhatsApp group (no filters)
    // This happens regardless of validation - we want to forward all messages
    await forwardMessageToWhatsAppGroup(message);

    // Validate message format for session handling
    // Support multiple formats:
    // 1. New Wechaty format: { roomId, roomTopic, talkerName, text, timestamp }
    // 2. Old nested format: { chat: { groupId, isGroup }, sender: { name }, message, timestamp }
    // 3. Old flat format: { groupId/roomId, from, text, timestamp }
    const chat = message.chat || {};
    const hasGroupId = 
      message.roomId ||        // New Wechaty format
      chat.groupId ||          // Old nested format
      message.groupId ||       // Old flat format
      message.roomId;          // Fallback
    const isGroup = message.isGroup !== undefined 
      ? message.isGroup 
      : (chat.isGroup !== undefined ? chat.isGroup : true); // Default to true if not specified
    
    // Only validate if we need to process for sessions
    // Messages are still forwarded even without groupId
    if (!message) {
      logger.warn('Invalid WeChat message format received - empty message', { 
        body: req.body,
      });
      return;
    }
    
    // Only process for session handling if groupId is present
    // Forwarding to WhatsApp happens regardless
    if (hasGroupId) {
      // Handle the message via adapter for session management
      const wechatyAdapter = getWechatyAdapter();
      await wechatyAdapter.handleMessage(message);
    } else {
      // Log that message was forwarded but not processed for sessions
      logger.info('WeChat message forwarded to WhatsApp but no groupId for session handling', {
        hasMessage: !!(message.text || message.message || message.content),
        hasSender: !!(message.talkerName || message.sender?.name || message.from),
        body: req.body,
      });
    }
  } catch (error) {
    logger.error('Error processing WeChat webhook', error);
  }
});

/**
 * Health check endpoint for WeChat service
 */
router.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'wechat-webhook' });
});

/**
 * Webhook verification endpoint (for Wechaty service to verify webhook)
 * This endpoint responds immediately to help with webhook registration
 */
router.get('/webhook', (req, res) => {
  // Respond immediately for webhook verification
  res.status(200).json({ 
    status: 'ok', 
    message: 'Webhook endpoint is active',
    timestamp: new Date().toISOString()
  });
});

/**
 * Format message with sender name, group name, and timestamp
 * @param {Object} message - Raw message payload from Wechaty service
 * @returns {string} Formatted message string
 */
function formatMessageWithMetadata(message) {
  // Extract message text
  // Support both old format and new Wechaty format
  const messageText =
    message.text ||           // New Wechaty format
    message.message ||        // Old format
    message.content ||        // Fallback
    message.payload ||        // Fallback
    '';

  // Extract sender name
  // Support both old format and new Wechaty format
  const senderName =
    message.talkerName ||     // New Wechaty format
    (message.sender && message.sender.name) ||  // Old nested format
    message.from ||           // Old flat format
    message.contact ||        // Fallback
    'Unknown';

  // Extract group name
  // Support both old format and new Wechaty format
  const groupName =
    message.roomTopic ||      // New Wechaty format
    (message.chat && message.chat.groupName) ||  // Old nested format
    message.groupName ||      // Old flat format
    message.roomName ||       // Fallback
    'Unknown Group';

  // Extract and format timestamp from Wechaty
  let formattedTime = '';
  if (message.timestamp) {
    try {
      // Parse timestamp string directly to preserve timezone
      // Format: "2025-11-28T13:13:07.032+08:00"
      const timestampStr = message.timestamp;
      
      // Extract date and time parts directly from the ISO string
      // Match pattern: YYYY-MM-DDTHH:MM:SS
      const isoMatch = timestampStr.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})/);
      
      if (isoMatch) {
        // isoMatch[1] = year, [2] = month, [3] = day, [4] = hour, [5] = minute, [6] = second
        const year = isoMatch[1];
        const month = isoMatch[2];
        const day = isoMatch[3];
        const hours = isoMatch[4];
        const minutes = isoMatch[5];
        const seconds = isoMatch[6];
        
        // Format: dd-mm-yyyy HH:MM:SS
        formattedTime = `${day}-${month}-${year} ${hours}:${minutes}:${seconds}`;
      } else {
        // Fallback: try parsing with Date object
        const timestamp = new Date(timestampStr);
        const day = String(timestamp.getDate()).padStart(2, '0');
        const month = String(timestamp.getMonth() + 1).padStart(2, '0');
        const year = timestamp.getFullYear();
        const dateFormatted = `${day}-${month}-${year}`;
        const hours = String(timestamp.getHours()).padStart(2, '0');
        const minutes = String(timestamp.getMinutes()).padStart(2, '0');
        const seconds = String(timestamp.getSeconds()).padStart(2, '0');
        const timeFormatted = `${hours}:${minutes}:${seconds}`;
        formattedTime = `${dateFormatted} ${timeFormatted}`;
      }
    } catch (e) {
      // Fallback: if timestamp parsing fails, use current time
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
    // If no timestamp provided, use current time
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

  // Format: [WeChat → WhatsApp]
  // From: 
  // Group: 
  // Time: {dd-mm-yyyy} {timestamp from wechaty}
  // Message text
  return `[WeChat → WhatsApp]\n\nFrom: ${senderName}\nGroup: ${groupName}\nTime: ${formattedTime}\n\n${messageText}`;
}

/**
 * Forward all incoming WeChat messages to the configured WhatsApp group
 * @param {Object} message - Raw message payload from Wechaty service
 */
async function forwardMessageToWhatsAppGroup(message) {
  try {
    const salesGroupId = whatsappConfig.salesGroupId;
    if (!salesGroupId) {
      logger.warn('SALES_GROUP_ID not configured, cannot forward WeChat message to WhatsApp group');
      return;
    }

    // Extract image information from WeChat message
    let imageUrl = null;
    let imageCaption = null;
    
    // Check for image in various formats
    if (message.type === 'image' || message.messageType === 'image' || message.mediaType === 'image') {
      imageUrl = message.imageUrl || message.image || message.media || message.attachment || 
                 message.fileUrl || message.url;
      imageCaption = message.caption || message.text || message.message || message.content;
    } else if (message.image || message.media || message.attachment) {
      const imageData = message.image || message.media || message.attachment;
      if (typeof imageData === 'string') {
        imageUrl = imageData;
      } else if (typeof imageData === 'object' && imageData !== null) {
        imageUrl = imageData.url || imageData.link || imageData.src || imageData.id;
        imageCaption = imageData.caption || message.text || message.message || message.content;
      }
    }
    
    // Check if message has any content to forward
    // Support all Wechaty message formats
    const hasContent = !!(
      message.text ||           // New Wechaty format (preferred)
      message.message ||        // Old format
      message.content ||        // Fallback
      message.payload ||         // Fallback
      (message.message && message.message.conversation) ||  // Nested format
      imageUrl                  // Image content
    );
    if (!hasContent) {
      logger.debug('WeChat message has no content to forward', {
        messageKeys: Object.keys(message || {}),
        messageType: typeof message,
      });
      return;
    }

    const whatsappAdapter = getWhatsAppAdapter();
    
    // Handle image forwarding
    if (imageUrl) {
      // Format caption with sender info
      let caption = imageCaption || '';
      const senderName = message.talkerName || message.sender?.name || message.from || 'Unknown';
      const groupName = message.roomTopic || message.chat?.groupName || message.groupName || 'Unknown Group';
      
      if (caption) {
        caption = `[WeChat → WhatsApp]\n\nFrom: ${senderName}\nGroup: ${groupName}\n\n${caption}`;
      } else {
        caption = `[WeChat → WhatsApp]\n\nFrom: ${senderName}\nGroup: ${groupName}`;
      }
      
      logger.info('Forwarding WeChat image to WhatsApp group', {
        groupId: salesGroupId,
        sender: senderName,
        groupName: groupName,
        imageUrl: imageUrl,
      });

      const imageSent = await whatsappAdapter.sendImage(salesGroupId, imageUrl, caption);

      if (imageSent) {
        logger.info('Successfully forwarded WeChat image to WhatsApp group', {
          groupId: salesGroupId,
        });
      } else {
        logger.error('Failed to forward WeChat image to WhatsApp group', {
          groupId: salesGroupId,
          imageUrl: imageUrl,
        });
      }
    } else {
      // Handle text message forwarding
      const formattedMessage = formatMessageWithMetadata(message);

      logger.info('Forwarding WeChat message content to WhatsApp group', {
        groupId: salesGroupId,
        sender: message.talkerName || message.sender?.name || message.from || 'Unknown',
        groupName: message.roomTopic || message.chat?.groupName || message.groupName || 'Unknown Group',
        messageLength: formattedMessage.length,
        preview: formattedMessage.slice(0, 120),
      });

      const sent = await whatsappAdapter.sendToGroup(salesGroupId, formattedMessage);

      if (sent) {
        logger.info('Successfully forwarded WeChat message to WhatsApp group', {
          groupId: salesGroupId,
        });
      } else {
        logger.error('Failed to forward WeChat message to WhatsApp group', {
          groupId: salesGroupId,
          formattedMessageLength: formattedMessage.length,
        });
      }
    }
  } catch (error) {
    logger.error('Error forwarding WeChat message to WhatsApp group', {
      error: error.message,
      stack: error.stack,
      messageKeys: message ? Object.keys(message) : 'no message',
    });
  }
}

module.exports = router;

