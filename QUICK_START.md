# Quick Start: Connecting External Services

## Environment Variables Setup

Create a `.env` file in the root directory with these variables:

```bash
# ============================================
# Service Selection
# ============================================
# Set to 'true' to use your external services
USE_EXTERNAL_WECHATY=false
USE_EXTERNAL_LLM=false

# ============================================
# Server Configuration
# ============================================
PORT=3000
WEBHOOK_URL=http://localhost:3000/webhook/wechat

# ============================================
# WhatsApp Configuration
# ============================================
# Option 1: WhatsApp Business API (Recommended)
WHATSAPP_PHONE_NUMBER_ID=your_phone_number_id
WHATSAPP_ACCESS_TOKEN=your_access_token
WHATSAPP_VERIFY_TOKEN=your_verify_token

# Option 2: Custom WhatsApp Service
WHATSAPP_SERVICE_URL=http://localhost:3001
WHATSAPP_API_KEY=your_whatsapp_api_key

# ============================================
# Wechaty Configuration
# ============================================
# If using external Wechaty service:
WECHATY_SERVICE_URL=http://localhost:3002
WECHATY_API_KEY=your_wechaty_api_key

# If using built-in Wechaty (default):
WECHATY_PUPPET=wechaty-puppet-wechat
WECHATY_NAME=automation-bot

# ============================================
# LLM Configuration
# ============================================
# Option 1: External LLM Service
LLM_SERVICE_URL=http://localhost:3003
LLM_API_KEY=your_llm_api_key

# Option 2: Direct API (OpenAI, etc.)
LLM_PROVIDER=openai
LLM_API_KEY=your_openai_api_key
LLM_API_URL=https://api.openai.com/v1/chat/completions
LLM_MODEL=gpt-3.5-turbo
LLM_TEMPERATURE=0.7
LLM_MAX_TOKENS=500

# ============================================
# Logging
# ============================================
LOG_LEVEL=info
```

## Quick Connection Steps

### 1. For WhatsApp Business API:
```bash
# Get credentials from Meta Developer Console
# Add to .env file
WHATSAPP_PHONE_NUMBER_ID=xxx
WHATSAPP_ACCESS_TOKEN=xxx
WHATSAPP_VERIFY_TOKEN=xxx

# Configure webhook in Meta Console:
# URL: https://your-domain.com/webhook/whatsapp/webhook
# Verify Token: (same as WHATSAPP_VERIFY_TOKEN)
```

### 2. For External Wechaty Service:
```bash
# Enable external Wechaty
USE_EXTERNAL_WECHATY=true

# Add your service URL
WECHATY_SERVICE_URL=http://your-wechaty-service:port
WECHATY_API_KEY=your_key

# Update services/wechatyAdapter.js to match your API
```

### 3. For External LLM Service:
```bash
# Enable external LLM
USE_EXTERNAL_LLM=true

# Add your service URL
LLM_SERVICE_URL=http://your-llm-service:port
LLM_API_KEY=your_key

# Update services/llmAdapter.js to match your API
```

## Files to Modify for Your Services

1. **`services/whatsappAdapter.js`** - Modify `sendViaCustomService()` method
2. **`services/wechatyAdapter.js`** - Modify API endpoints and message format
3. **`services/llmAdapter.js`** - Modify API endpoints for category extraction and summarization
4. **`data/routingRules.json`** - Update with real WeChat group IDs

## Testing

```bash
# Start server
npm start

# Test WhatsApp webhook
curl "http://localhost:3000/webhook/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=your_token&hub.challenge=test"

# Test WeChat webhook
curl -X POST http://localhost:3000/webhook/wechat \
  -H "Content-Type: application/json" \
  -d '{"groupId":"wxid_test","from":"Test","text":"Hello"}'
```

See `CONNECTION_GUIDE.md` for detailed instructions.

