const express = require('express');
const whatsappConfig = require('./config/whatsappConfig');
const { logger } = require('./services/logger');
const whatsappRoutes = require('./routes/whatsapp');
const wechatRoutes = require('./routes/wechat');
const useExternalWechaty = process.env.USE_EXTERNAL_WECHATY === 'true';

const app = express();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Routes
app.use('/webhook/whatsapp', whatsappRoutes);
app.use('/webhook/wechat', wechatRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
  logger.error('Express error handler', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Initialize Wechaty service (only when running the built-in bot)
let wechatyService = null;

async function initializeServices() {
  try {
    logger.info('Initializing services...');
    
    if (!useExternalWechaty) {
      // Only load wechatyService if not using external
      const getWechatyService = require('./services/wechatyService');
      wechatyService = getWechatyService();
      await wechatyService.initialize();
      logger.info('Internal Wechaty service initialized');
    } else {
      logger.info('USE_EXTERNAL_WECHATY=true — skipping internal Wechaty startup (using external service)');
    }

    logger.info('Services initialized successfully');
  } catch (error) {
    logger.error('Failed to initialize services', error);
    // Don't exit if using external Wechaty and error is about missing Wechaty
    if (useExternalWechaty && error.message && error.message.includes('Wechaty is required')) {
      logger.warn('Wechaty not installed, but using external service - continuing...');
    } else {
      process.exit(1);
    }
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM signal received, shutting down gracefully...');
  if (wechatyService) {
    await wechatyService.stop();
  }
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT signal received, shutting down gracefully...');
  if (wechatyService) {
    await wechatyService.stop();
  }
  process.exit(0);
});

// Start server
const PORT = whatsappConfig.port || 3000;

async function startServer() {
  await initializeServices();
  
  app.listen(PORT, () => {
    const baseUrl = process.env.RENDER_EXTERNAL_URL || `http://localhost:${PORT}`;
    logger.info(`Server running on port ${PORT}`);
    logger.info(`WhatsApp webhook endpoint: ${baseUrl}/webhook/whatsapp/webhook`);
    logger.info(`WeChat webhook endpoint: ${baseUrl}/webhook/wechat/webhook`);
    logger.info(`Health check: ${baseUrl}/health`);
  });
}

startServer().catch((error) => {
  logger.error('Failed to start server', error);
  process.exit(1);
});

module.exports = app;

