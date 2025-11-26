# How to Connect to Wechaty

There are two ways to connect to Wechaty: **Built-in** (default) or **External Service**.

---

## Option 1: Built-in Wechaty (Default - Recommended for Testing)

This uses Wechaty SDK directly in your backend. No separate service needed.

### Step 1: Configure Environment

Add to your `.env` file:

```bash
# Use built-in Wechaty
USE_EXTERNAL_WECHATY=false

# Optional: Customize bot name
WECHATY_NAME=automation-bot
WECHATY_PUPPET=wechaty-puppet-wechat
```

### Step 2: Start the Server

```bash
npm start
```

### Step 3: Scan QR Code

When the server starts, you'll see a QR code in the console:

```
Scan QR Code to login: https://wechaty.js.org/qrcode/...
```

**To connect:**
1. Open WeChat on your mobile phone
2. Tap the "+" icon → "Add Contacts" → "Scan QR Code"
3. Scan the QR code from the console
4. Confirm login on your phone

### Step 4: Verify Connection

After scanning, you should see:
```
WeChat bot logged in: Your Bot Name
Wechaty bot initialized
```

### Step 5: Update Group IDs

1. Get your WeChat group IDs (the bot needs to be in these groups)
2. Update `data/routingRules.json` with actual group IDs:

```json
{
  "categories": {
    "basin": {
      "suppliers": [
        {
          "groupId": "supplier_basin_1",
          "name": "Basin Supplier A",
          "wechatGroupId": "wxid_YOUR_ACTUAL_GROUP_ID"
        }
      ]
    }
  }
}
```

**How to get group IDs:**
- Check Wechaty logs when bot receives messages
- Use Wechaty API to list groups
- Or check your WeChat groups and identify them

---

## Option 2: External Wechaty Service

If you have a separate Wechaty service running, connect to it via API.

### Step 1: Configure Environment

Add to your `.env` file:

```bash
# Use external Wechaty service
USE_EXTERNAL_WECHATY=true

# Your Wechaty service URL
WECHATY_SERVICE_URL=http://localhost:3002

# API key for authentication
WECHATY_API_KEY=your_api_key

# Your backend's webhook URL (where Wechaty service sends messages)
WEBHOOK_URL=http://localhost:3000/webhook/wechat
```

### Step 2: Update Adapter Code

Modify `services/wechatyAdapter.js` to match your service's API:

#### a) Update Send Message Endpoint (around line 169)

```javascript
async sendToGroup(groupId, messageText) {
  const response = await axios.post(
    `${this.baseUrl}/send`,  // Change to your endpoint
    {
      groupId: groupId,      // Match your API format
      message: messageText,   // Match your API format
    },
    {
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
      },
    }
  );
}
```

#### b) Update Message Format Handling (around line 133)

```javascript
async handleMessage(message) {
  // Update to parse your service's message format
  const groupId = message.groupId || message.roomId || message.room_id;
  const from = message.from || message.contact || message.sender;
  const text = message.text || message.content || message.message;
  // ... rest of the logic
}
```

#### c) Update Webhook Registration (around line 55)

```javascript
async registerWebhook() {
  const response = await axios.post(
    `${this.baseUrl}/webhook/register`,  // Change to your endpoint
    {
      url: webhookUrl,
      events: ['message', 'group_message'],
    },
    {
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
      },
    }
  );
}
```

### Step 3: Configure Your Wechaty Service

Your external Wechaty service should:

1. **Accept send message requests:**
   - Endpoint: `POST /send` (or your custom endpoint)
   - Body: `{ "groupId": "wxid_xxx", "message": "text" }`

2. **Send messages to your backend:**
   - POST to: `http://your-backend-url/webhook/wechat`
   - Body format:
     ```json
     {
       "groupId": "wxid_xxx",
       "from": "Contact Name",
       "text": "Message text",
       "timestamp": "2024-01-01T00:00:00Z"
     }
     ```

3. **Register webhook (optional):**
   - Endpoint: `POST /webhook/register`
   - Body: `{ "url": "http://your-backend-url/webhook/wechat" }`

### Step 4: Start the Server

```bash
npm start
```

The backend will:
1. Try to register webhook with your Wechaty service
2. If webhook fails, it will start polling for messages
3. Listen for incoming messages on `/webhook/wechat`

---

## Testing the Connection

### Test Built-in Wechaty:

1. Start server: `npm start`
2. Scan QR code
3. Send a test message to a group the bot is in
4. Check logs: `tail -f logs/combined.log`

### Test External Wechaty:

```bash
# Test sending message
curl -X POST http://localhost:3002/send \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "groupId": "wxid_test",
    "message": "Test message"
  }'

# Test webhook (send test message to your backend)
curl -X POST http://localhost:3000/webhook/wechat \
  -H "Content-Type: application/json" \
  -d '{
    "groupId": "wxid_test",
    "from": "Test User",
    "text": "Test message",
    "timestamp": "2024-01-01T00:00:00Z"
  }'
```

---

## Troubleshooting

### Built-in Wechaty Issues:

**QR code not showing:**
- Check if port is available
- Verify Wechaty dependencies installed: `npm install`
- Check logs for errors

**Can't scan QR code:**
- Make sure QR code URL is accessible
- Try opening URL in browser
- Use WeChat mobile app (not desktop)

**Bot not receiving messages:**
- Verify bot is logged in (check logs)
- Ensure bot is member of the groups
- Check group IDs in `routingRules.json` are correct

### External Wechaty Issues:

**Service not reachable:**
- Verify `WECHATY_SERVICE_URL` is correct
- Check if service is running
- Test with: `curl http://your-service-url/health`

**Messages not sending:**
- Check API key is correct
- Verify endpoint URL matches your service
- Review request format in adapter code

**Messages not receiving:**
- Verify webhook is registered
- Check webhook URL is accessible
- Review message format in adapter code

---

## Quick Reference

### Environment Variables:

**Built-in:**
```bash
USE_EXTERNAL_WECHATY=false
WECHATY_NAME=automation-bot
```

**External:**
```bash
USE_EXTERNAL_WECHATY=true
WECHATY_SERVICE_URL=http://localhost:3002
WECHATY_API_KEY=your_key
WEBHOOK_URL=http://localhost:3000/webhook/wechat
```

### Files to Modify:

- **Built-in**: No code changes needed, just configure `.env`
- **External**: Modify `services/wechatyAdapter.js` to match your API

---

## Which Option to Choose?

- **Use Built-in** if:
  - You're testing/developing
  - You don't have a separate Wechaty service
  - You want simple setup

- **Use External** if:
  - You already have a Wechaty service
  - You need centralized Wechaty management
  - Multiple backends need to use the same Wechaty instance

