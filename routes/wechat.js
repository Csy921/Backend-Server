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

    // Forward every incoming WeChat message to WhatsApp group (no filters)
    await forwardMessageToWhatsAppGroup(message);

    // Validate message format
    // Support both formats:
    // 1. New format: { chat: { groupId, isGroup }, sender: { name }, message, timestamp }
    // 2. Old format: { groupId/roomId, from, text, timestamp }
    const chat = message.chat || {};
    const hasGroupId = chat.groupId || message.groupId || message.roomId;
    const isGroup = chat.isGroup !== undefined ? chat.isGroup : true; // Default to true if not specified
    
    if (!message || !hasGroupId) {
      logger.warn('Invalid WeChat message format received', { 
        body: req.body,
        reason: 'Missing groupId/roomId or chat.groupId'
      });
      return;
    }
    
    // Handle the message via adapter
    const wechatyAdapter = getWechatyAdapter();
    await wechatyAdapter.handleMessage(message);
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
 * Format message with sender name, group name, and timestamp
 * @param {Object} message - Raw message payload from Wechaty service
 * @returns {string} Formatted message string
 */
function formatMessageWithMetadata(message) {
  // Extract message text
  const messageText =
    message.message ||
    message.text ||
    message.content ||
    message.payload ||
    '';

  // Extract sender name
  const sender = message.sender || {};
  const senderName = sender.name || message.from || message.contact || 'Unknown';

  // Extract group name
  const chat = message.chat || {};
  const groupName = chat.groupName || message.groupName || message.roomName || 'Unknown Group';

  // Extract and format timestamp in ISO format
  let formattedTime = '';
  if (message.timestamp) {
    try {
      const timestamp = new Date(message.timestamp);
      formattedTime = timestamp.toISOString();
    } catch (e) {
      formattedTime = new Date().toISOString();
    }
  } else {
    formattedTime = new Date().toISOString();
  }

  // Format: [WeChat → WhatsApp]
  // From: 
  // Group: 
  // Time: 2025-11-27T08:27:22.208Z
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

    const whatsappAdapter = getWhatsAppAdapter();
    
    // Format message with sender name, group name, and time
    const formattedMessage = formatMessageWithMetadata(message);

    logger.info('Forwarding WeChat message content to WhatsApp group', {
      groupId: salesGroupId,
      sender: message.sender?.name || message.from,
      groupName: message.chat?.groupName || message.groupName,
      preview: formattedMessage.slice(0, 120),
    });

    const sent = await whatsappAdapter.sendToGroup(salesGroupId, formattedMessage);

    if (!sent) {
      logger.error('Failed to forward WeChat message to WhatsApp group', {
        groupId: salesGroupId,
      });
    }
  } catch (error) {
    logger.error('Error forwarding WeChat message to WhatsApp group', error);
  }
}

module.exports = router;

