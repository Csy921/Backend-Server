# Step-by-Step Implementation Guide

Follow these steps to connect your backend to WhatsApp and Wechaty services.

## Prerequisites

- Node.js installed
- Your WhatsApp service running (or WhatsApp Business API credentials)
- Your Wechaty service running (or use built-in)
- Your LLM service running (or use direct API)

---

## Step 1: Install Dependencies

```bash
npm install
```

---

## Step 2: Configure Environment Variables

### Option A: Interactive Setup (Recommended)

```bash
npm run setup
```

This will guide you through setting up your `.env` file.

### Option B: Manual Setup

Create a `.env` file in the root directory:

```bash
# Copy from example
cp .env.example .env
# Then edit .env with your values
```

---

## Step 3: Configure WhatsApp Connection

### Step 3.1: Choose WhatsApp Integration Method

**Option A: WhatsApp Business API** (Recommended for production)

1. Get credentials from [Meta Developer Console](https://developers.facebook.com/):
   - Phone Number ID
   - Access Token
   - Create a Verify Token (any string)

2. Add to `.env`:
```bash
WHATSAPP_PHONE_NUMBER_ID=your_phone_number_id
WHATSAPP_ACCESS_TOKEN=your_access_token
WHATSAPP_VERIFY_TOKEN=your_verify_token
```

3. Configure webhook in Meta Console:
   - URL: `https://your-domain.com/webhook/whatsapp/webhook`
   - Verify Token: (same as WHATSAPP_VERIFY_TOKEN)
   - Subscribe to: `messages` event

**Option B: Custom WhatsApp Service**

1. Update `services/whatsappAdapter.js`:
   - Modify `sendViaCustomService()` method (lines 75-105)
   - Match your service's API format

2. Add to `.env`:
```bash
WHATSAPP_SERVICE_URL=http://localhost:3001
WHATSAPP_API_KEY=your_api_key
```

3. Ensure your service accepts:
   - POST `/send` with body:
     ```json
     {
       "to": "recipient_id",
       "message": "message text",
       "sessionId": "optional_session_id"
     }
     ```

### Step 3.2: Test WhatsApp Connection

```bash
npm run test-connections
```

Or manually test:
```bash
# Test webhook verification
curl "http://localhost:3000/webhook/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=your_token&hub.challenge=test123"
```

---

## Step 4: Configure Wechaty Connection

### Step 4.1: Choose Wechaty Integration Method

**Option A: External Wechaty Service** (If you have one)

1. Update `services/wechatyAdapter.js`:
   - Modify `sendToGroup()` method (lines 130-160) to match your API
   - Modify `handleMessage()` method (lines 95-120) to parse your message format
   - Modify `registerWebhook()` method (lines 50-75) if needed

2. Add to `.env`:
```bash
USE_EXTERNAL_WECHATY=true
WECHATY_SERVICE_URL=http://localhost:3002
WECHATY_API_KEY=your_api_key
WEBHOOK_URL=http://localhost:3000/webhook/wechat
```

3. Your Wechaty service should provide:

   **a) Send Message Endpoint:**
   ```
   POST /send
   Body: {
     "groupId": "wxid_xxx",
     "message": "text"
   }
   ```

   **b) Webhook Registration (optional):**
   ```
   POST /webhook/register
   Body: {
     "url": "http://localhost:3000/webhook/wechat",
     "events": ["message", "group_message"]
   }
   ```

   **c) Message Format (sent to webhook):**
   ```json
   {
     "groupId": "wxid_xxx",
     "from": "Contact Name",
     "text": "Message text",
     "timestamp": "2024-01-01T00:00:00Z"
   }
   ```

**Option B: Built-in Wechaty** (Default)

1. Add to `.env`:
```bash
USE_EXTERNAL_WECHATY=false
WECHATY_PUPPET=wechaty-puppet-wechat
WECHATY_NAME=automation-bot
```

2. On first server start:
   - QR code will be displayed in console
   - Scan with WeChat mobile app
   - Bot will auto-login

### Step 4.2: Update Routing Rules

Edit `data/routingRules.json` with your actual WeChat group IDs:

```json
{
  "categories": {
    "basin": {
      "suppliers": [
        {
          "groupId": "supplier_basin_group_1",
          "name": "Basin Supplier A",
          "wechatGroupId": "wxid_YOUR_ACTUAL_GROUP_ID_HERE"
        }
      ]
    }
  }
}
```

### Step 4.3: Test Wechaty Connection

```bash
npm run test-connections
```

Or manually test webhook:
```bash
curl -X POST http://localhost:3000/webhook/wechat \
  -H "Content-Type: application/json" \
  -d '{
    "groupId": "wxid_test",
    "from": "Test Supplier",
    "text": "Test message",
    "timestamp": "2024-01-01T00:00:00Z"
  }'
```

---

## Step 5: Configure LLM Connection

### Step 5.1: Choose LLM Integration Method

**Option A: External LLM Service**

1. Update `services/llmAdapter.js`:
   - Modify `extractCategoryViaService()` method (lines 40-65)
   - Modify `summarizeViaService()` method (lines 100-125)

2. Add to `.env`:
```bash
USE_EXTERNAL_LLM=true
LLM_SERVICE_URL=http://localhost:3003
LLM_API_KEY=your_api_key
```

3. Your LLM service should provide:

   **a) Category Extraction:**
   ```
   POST /extract-category
   Body: { "message": "text" }
   Response: { "category": "basin" } or { "result": "basin" }
   ```

   **b) Summarization:**
   ```
   POST /summarize
   Body: { "replies": [...] }
   Response: { "summary": "text" } or { "result": "text" }
   ```

**Option B: Direct LLM API** (OpenAI, Anthropic, etc.)

1. Add to `.env`:
```bash
USE_EXTERNAL_LLM=false
LLM_PROVIDER=openai
LLM_API_KEY=your_openai_api_key
LLM_MODEL=gpt-3.5-turbo
LLM_API_URL=https://api.openai.com/v1/chat/completions
```

### Step 5.2: Test LLM Connection

```bash
npm run test-connections
```

---

## Step 6: Start the Server

```bash
npm start
```

Or for development with auto-reload:
```bash
npm run dev
```

---

## Step 7: Verify Everything Works

### 7.1: Check Server Health

```bash
curl http://localhost:3000/health
```

Expected response:
```json
{"status":"ok","timestamp":"2024-01-01T00:00:00.000Z"}
```

### 7.2: Test Full Flow

1. **Send a test WhatsApp message** (via your WhatsApp service or Business API):
   ```
   "I need a basin"
   ```

2. **Check logs** (`logs/combined.log`):
   - Should see message received
   - Should see category extracted
   - Should see message forwarded to WeChat groups
   - Should see replies tracked

3. **Send test replies from WeChat groups**:
   - Replies should be logged
   - After 3 replies or 10 minutes, summary should be sent back to WhatsApp

### 7.3: Monitor Session Status

```bash
# Get session status (replace SESSION_ID with actual ID from logs)
curl http://localhost:3000/webhook/whatsapp/session/SESSION_ID
```

---

## Step 8: Troubleshooting

### Issue: WhatsApp webhook not receiving messages

**Solutions:**
1. Verify webhook URL is accessible (use ngrok for local testing)
2. Check `WHATSAPP_VERIFY_TOKEN` matches Meta console
3. Verify phone number ID and access token
4. Check server logs for errors

### Issue: Wechaty not sending/receiving

**Solutions:**
1. If external: Verify `WECHATY_SERVICE_URL` and API key
2. If built-in: Ensure QR code is scanned and bot is logged in
3. Check group IDs in `routingRules.json` match actual WeChat groups
4. Verify webhook is registered (if using external service)

### Issue: LLM not working

**Solutions:**
1. Verify API key is correct
2. Check service URL if using external LLM
3. Review logs for specific error messages
4. Test API directly with curl

### Issue: Messages not routing correctly

**Solutions:**
1. Check `data/routingRules.json` has correct category mappings
2. Verify category extraction is working (check logs)
3. Ensure supplier groups exist in routing rules

---

## Step 9: Production Deployment

1. **Set up environment variables** on your server
2. **Use HTTPS** for webhook URLs (required by WhatsApp Business API)
3. **Set up reverse proxy** (nginx, etc.) if needed
4. **Configure logging** to production log service
5. **Set up monitoring** and alerts
6. **Test thoroughly** before going live

---

## Quick Reference

### Environment Variables Checklist

- [ ] `PORT` - Server port
- [ ] `USE_EXTERNAL_WECHATY` - true/false
- [ ] `USE_EXTERNAL_LLM` - true/false
- [ ] WhatsApp credentials (Business API or custom service)
- [ ] Wechaty service URL and API key (if external)
- [ ] LLM service URL and API key (if external)
- [ ] `WEBHOOK_URL` - For Wechaty webhook registration

### Files to Modify

- [ ] `services/whatsappAdapter.js` - Match your WhatsApp API
- [ ] `services/wechatyAdapter.js` - Match your Wechaty API
- [ ] `services/llmAdapter.js` - Match your LLM API
- [ ] `data/routingRules.json` - Add real group IDs

### Testing Checklist

- [ ] WhatsApp webhook verification works
- [ ] WhatsApp messages are received
- [ ] Wechaty messages can be sent
- [ ] Wechaty replies are received
- [ ] LLM category extraction works
- [ ] LLM summarization works
- [ ] Full flow: WhatsApp → WeChat → Replies → WhatsApp

---

## Next Steps

1. Review adapter files and customize for your APIs
2. Update routing rules with real group IDs
3. Test each component individually
4. Test full integration flow
5. Deploy to production

For detailed API specifications, see `CONNECTION_GUIDE.md`.

