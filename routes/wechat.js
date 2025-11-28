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

