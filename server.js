// Load environment variables first
require('dotenv').config();

const express = require('express');
const whatsappConfig = require('./config/whatsappConfig');
const { logger } = require('./services/logger');

// Check environment variable early and log it
const useExternalWechaty = process.env.USE_EXTERNAL_WECHATY === 'true';
logger.info(`USE_EXTERNAL_WECHATY=${process.env.USE_EXTERNAL_WECHATY || 'not set'} (resolved to: ${useExternalWechaty})`);

const whatsappRoutes = require('./routes/whatsapp');
const wechatRoutes = require('./routes/wechat');

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
    
    // Log the environment variable value for debugging
    logger.info(`USE_EXTERNAL_WECHATY=${process.env.USE_EXTERNAL_WECHATY || 'not set'}`);
    
    if (!useExternalWechaty) {
      // Only load wechatyService if not using external
      try {
        const getWechatyService = require('./services/wechatyService');
        wechatyService = getWechatyService();
        await wechatyService.initialize();
        logger.info('Internal Wechaty service initialized');
      } catch (error) {
        if (error.message && error.message.includes('Wechaty is required')) {
          throw new Error('Wechaty is required for built-in bot. Either install Wechaty or set USE_EXTERNAL_WECHATY=true');
        }
        throw error;
      }
    } else {
      logger.info('USE_EXTERNAL_WECHATY=true — skipping internal Wechaty startup (using external service)');
    }

    logger.info('Services initialized successfully');
  } catch (error) {
    logger.error('Failed to initialize services', error);
    process.exit(1);
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

