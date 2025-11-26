/**
 * WeChat Webhook Route
 * This endpoint receives messages from your external Wechaty service
 */

const express = require('express');
const router = express.Router();
const { logger } = require('../services/logger');
const getWechatyAdapter = require('../services/wechatyAdapter');

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
    
    // Only process group messages
    if (chat.isGroup === false) {
      logger.debug('Ignoring private message (not a group message)', {
        sender: message.sender?.name || message.from,
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

module.exports = router;

