require('dotenv').config();

module.exports = {
  webhookUrl: process.env.WHATSAPP_WEBHOOK_URL || '/webhook/whatsapp',
  port: process.env.PORT || 3000,
  apiKey: process.env.WHATSAPP_API_KEY || '',
  verifyToken: process.env.WHATSAPP_VERIFY_TOKEN || 'your_verify_token',
  // WhatsApp Business API configuration
  phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID || '',
  accessToken: process.env.WHATSAPP_ACCESS_TOKEN || '',
  // Group settings
  salesGroupId: process.env.SALES_GROUP_ID || '120363403868036748@g.us',
};

