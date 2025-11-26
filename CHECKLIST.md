# Implementation Checklist

Use this checklist to track your progress connecting the backend.

## Phase 1: Initial Setup

- [ ] Install dependencies: `npm install`
- [ ] Run setup script: `npm run setup`
- [ ] Review generated `.env` file
- [ ] Test connections: `npm run test-connections`

## Phase 2: WhatsApp Configuration

### Option A: WhatsApp Business API
- [ ] Get Phone Number ID from Meta Developer Console
- [ ] Get Access Token from Meta Developer Console
- [ ] Create Verify Token (any secure string)
- [ ] Add credentials to `.env`
- [ ] Configure webhook in Meta Console
  - [ ] Set webhook URL: `https://your-domain.com/webhook/whatsapp/webhook`
  - [ ] Set verify token (same as `.env`)
  - [ ] Subscribe to `messages` event
- [ ] Test webhook verification: `curl "http://localhost:3000/webhook/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=YOUR_TOKEN&hub.challenge=test"`
- [ ] Send test message and verify it's received

### Option B: Custom WhatsApp Service
- [ ] Review `services/whatsappAdapter.js`
- [ ] Update `sendViaCustomService()` method to match your API
- [ ] Set `WHATSAPP_SERVICE_URL` in `.env`
- [ ] Set `WHATSAPP_API_KEY` in `.env`
- [ ] Test sending message via your service
- [ ] Verify message format matches expected structure

## Phase 3: Wechaty Configuration

### Option A: External Wechaty Service
- [ ] Review `services/wechatyAdapter.js`
- [ ] Update `sendToGroup()` method to match your API
- [ ] Update `handleMessage()` method to parse your message format
- [ ] Update `registerWebhook()` method if needed
- [ ] Set `USE_EXTERNAL_WECHATY=true` in `.env`
- [ ] Set `WECHATY_SERVICE_URL` in `.env`
- [ ] Set `WECHATY_API_KEY` in `.env`
- [ ] Set `WEBHOOK_URL` in `.env`
- [ ] Test webhook registration
- [ ] Test sending message to group
- [ ] Test receiving message via webhook

### Option B: Built-in Wechaty
- [ ] Set `USE_EXTERNAL_WECHATY=false` in `.env`
- [ ] Start server: `npm start`
- [ ] Scan QR code with WeChat mobile app
- [ ] Verify bot is logged in
- [ ] Get actual WeChat group IDs
- [ ] Update `data/routingRules.json` with real group IDs

## Phase 4: LLM Configuration

### Option A: External LLM Service
- [ ] Review `services/llmAdapter.js`
- [ ] Update `extractCategoryViaService()` method
- [ ] Update `summarizeViaService()` method
- [ ] Set `USE_EXTERNAL_LLM=true` in `.env`
- [ ] Set `LLM_SERVICE_URL` in `.env`
- [ ] Set `LLM_API_KEY` in `.env`
- [ ] Test category extraction endpoint
- [ ] Test summarization endpoint

### Option B: Direct LLM API
- [ ] Set `USE_EXTERNAL_LLM=false` in `.env`
- [ ] Set `LLM_PROVIDER` (e.g., `openai`)
- [ ] Set `LLM_API_KEY`
- [ ] Set `LLM_MODEL` (e.g., `gpt-3.5-turbo`)
- [ ] Test API connection

## Phase 5: Routing Configuration

- [ ] Open `data/routingRules.json`
- [ ] Update category mappings with real product categories
- [ ] Update supplier groups with real WeChat group IDs
- [ ] Verify group IDs match actual WeChat groups
- [ ] Test category extraction with sample messages

## Phase 6: Testing

- [ ] Start server: `npm start`
- [ ] Check health endpoint: `curl http://localhost:3000/health`
- [ ] Test WhatsApp webhook receives messages
- [ ] Test message routing to correct supplier groups
- [ ] Test WeChat replies are received and tracked
- [ ] Test reply threshold (3 replies) triggers completion
- [ ] Test timeout (10 minutes) triggers completion
- [ ] Test summary is sent back to WhatsApp
- [ ] Review logs: `logs/combined.log`

## Phase 7: Full Integration Test

- [ ] Send test message: "I need a basin"
- [ ] Verify message forwarded to correct supplier groups
- [ ] Send 3 test replies from supplier groups
- [ ] Verify summary is generated and sent to WhatsApp
- [ ] Test timeout scenario (wait 10 minutes with < 3 replies)
- [ ] Verify all edge cases work correctly

## Phase 8: Production Deployment

- [ ] Set up production environment variables
- [ ] Configure HTTPS for webhook URLs
- [ ] Set up reverse proxy (if needed)
- [ ] Configure production logging
- [ ] Set up monitoring and alerts
- [ ] Test production webhook URLs
- [ ] Deploy and monitor

## Troubleshooting Checklist

If something doesn't work:

- [ ] Check `.env` file has all required variables
- [ ] Verify service URLs are correct and accessible
- [ ] Check API keys are valid
- [ ] Review `logs/combined.log` for errors
- [ ] Test each service individually
- [ ] Verify webhook URLs are accessible from internet
- [ ] Check firewall/network settings
- [ ] Verify group IDs match actual groups

## Quick Commands Reference

```bash
# Setup
npm install
npm run setup

# Test
npm run test-connections

# Start
npm start
# or
npm run dev

# Test endpoints
curl http://localhost:3000/health
curl "http://localhost:3000/webhook/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=TOKEN&hub.challenge=test"
curl -X POST http://localhost:3000/webhook/wechat -H "Content-Type: application/json" -d '{"groupId":"test","from":"Test","text":"Hello"}'
```

