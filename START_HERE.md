# 🚀 Start Here: Step-by-Step Implementation

Follow these steps in order to connect your backend to WhatsApp and Wechaty.

## Quick Start (5 minutes)

```bash
# 1. Install dependencies
npm install

# 2. Run interactive setup
npm run setup

# 3. Validate configuration
npm run validate

# 4. Test connections
npm run test-connections

# 5. Start server
npm start
```

---

## Detailed Step-by-Step Guide

### Step 1: Install Dependencies ⏱️ 2 minutes

```bash
npm install
```

This installs all required packages including Express, Axios, Wechaty, etc.

---

### Step 2: Configure Environment Variables ⏱️ 5 minutes

**Option A: Interactive Setup (Recommended)**
```bash
npm run setup
```

This will ask you questions and create your `.env` file automatically.

**Option B: Manual Setup**

1. Create `.env` file in root directory
2. Copy from example (if exists) or create new
3. Fill in your service URLs and API keys

**Required Variables:**

For **WhatsApp Business API**:
```bash
WHATSAPP_PHONE_NUMBER_ID=your_id
WHATSAPP_ACCESS_TOKEN=your_token
WHATSAPP_VERIFY_TOKEN=your_verify_token
```

For **Custom WhatsApp Service**:
```bash
WHATSAPP_SERVICE_URL=http://localhost:3001
WHATSAPP_API_KEY=your_key
```

For **External Wechaty**:
```bash
USE_EXTERNAL_WECHATY=true
WECHATY_SERVICE_URL=http://localhost:3002
WECHATY_API_KEY=your_key
WEBHOOK_URL=http://localhost:3000/webhook/wechat
```

For **Built-in Wechaty** (default):
```bash
USE_EXTERNAL_WECHATY=false
```

For **External LLM**:
```bash
USE_EXTERNAL_LLM=true
LLM_SERVICE_URL=http://localhost:3003
LLM_API_KEY=your_key
```

For **Direct LLM API** (default):
```bash
USE_EXTERNAL_LLM=false
LLM_PROVIDER=openai
LLM_API_KEY=your_openai_key
LLM_MODEL=gpt-3.5-turbo
```

---

### Step 3: Customize Adapter Files ⏱️ 10-30 minutes

If you're using **external services**, you need to modify the adapter files to match your APIs.

#### 3.1: WhatsApp Adapter (`services/whatsappAdapter.js`)

**If using custom WhatsApp service:**

1. Open `services/whatsappAdapter.js`
2. Find `sendViaCustomService()` method (around line 75)
3. Update the request format to match your API:

```javascript
async sendViaCustomService(recipient, messageText, sessionId = null) {
  const response = await axios.post(
    `${this.baseUrl}/send`,  // Your endpoint
    {
      // Update this to match your API format
      to: recipient,
      message: messageText,
      sessionId: sessionId,
    },
    {
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
    }
  );
  // Update response handling
}
```

#### 3.2: Wechaty Adapter (`services/wechatyAdapter.js`)

**If using external Wechaty service:**

1. Open `services/wechatyAdapter.js`
2. Update `sendToGroup()` method (around line 169):
   - Match your send message API format
3. Update `handleMessage()` method (around line 133):
   - Parse your message format correctly
4. Update `registerWebhook()` method (around line 50):
   - Match your webhook registration API

**Example modifications:**

```javascript
// In sendToGroup() - update request format
async sendToGroup(groupId, messageText) {
  const response = await axios.post(
    `${this.baseUrl}/send`,  // Your endpoint
    {
      groupId: groupId,      // Match your API
      message: messageText,  // Match your API
    },
    {
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
      },
    }
  );
}

// In handleMessage() - update parsing
async handleMessage(message) {
  // Update to parse your message format
  const groupId = message.groupId || message.roomId || message.room_id;
  const from = message.from || message.contact || message.sender;
  const text = message.text || message.content || message.message;
  // ... rest of the logic
}
```

#### 3.3: LLM Adapter (`services/llmAdapter.js`)

**If using external LLM service:**

1. Open `services/llmAdapter.js`
2. Update `extractCategoryViaService()` method (around line 40)
3. Update `summarizeViaService()` method (around line 100)

**Example:**

```javascript
async extractCategoryViaService(messageText) {
  const response = await axios.post(
    `${this.baseUrl}/extract-category`,  // Your endpoint
    {
      message: messageText,  // Match your API
    },
    {
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
      },
    }
  );
  // Update response parsing
  return response.data?.category || response.data?.result;
}
```

---

### Step 4: Update Routing Rules ⏱️ 5 minutes

1. Open `data/routingRules.json`
2. Update with your actual product categories
3. Replace placeholder group IDs with real WeChat group IDs

**Example:**

```json
{
  "categories": {
    "basin": {
      "suppliers": [
        {
          "groupId": "supplier_basin_1",
          "name": "Basin Supplier A",
          "wechatGroupId": "wxid_YOUR_REAL_GROUP_ID_HERE"
        }
      ]
    }
  }
}
```

**To get WeChat group IDs:**
- If using built-in Wechaty: Check logs when bot joins groups
- If using external Wechaty: Check your Wechaty service documentation

---

### Step 5: Validate Configuration ⏱️ 1 minute

```bash
npm run validate
```

This checks if all required environment variables are set correctly.

---

### Step 6: Test Connections ⏱️ 2 minutes

```bash
npm run test-connections
```

This tests:
- WhatsApp service connectivity
- Wechaty service connectivity  
- LLM service connectivity
- Webhook endpoints

Fix any errors before proceeding.

---

### Step 7: Start Server ⏱️ 1 minute

```bash
npm start
```

**If using built-in Wechaty:**
- QR code will appear in console
- Scan with WeChat mobile app
- Bot will auto-login

**Check logs:**
- Server should start on port 3000 (or your configured port)
- Check `logs/combined.log` for detailed logs

---

### Step 8: Test Full Flow ⏱️ 5 minutes

#### 8.1: Test WhatsApp Webhook

```bash
# Test webhook verification
curl "http://localhost:3000/webhook/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=YOUR_TOKEN&hub.challenge=test123"
```

Should return: `test123`

#### 8.2: Send Test Message

Send a test message via your WhatsApp service:
```
"I need a basin"
```

**Check logs:**
```bash
tail -f logs/combined.log
```

You should see:
- Message received
- Category extracted
- Message forwarded to supplier groups

#### 8.3: Test WeChat Replies

Send test replies from your WeChat supplier groups.

After 3 replies (or 10 minutes), you should see:
- Replies tracked
- Summary generated
- Summary sent back to WhatsApp

---

## Troubleshooting

### Issue: "Service not reachable"

**Solution:**
1. Verify service is running
2. Check URL is correct
3. Check firewall/network settings
4. Test with curl directly

### Issue: "Webhook not receiving messages"

**Solution:**
1. Verify webhook URL is accessible (use ngrok for local testing)
2. Check verify token matches
3. Review service logs

### Issue: "Group IDs not working"

**Solution:**
1. Verify group IDs in `routingRules.json` match actual groups
2. Check if bot is member of groups
3. Review Wechaty logs

---

## Next Steps

1. ✅ Complete all steps above
2. 📖 Review `IMPLEMENTATION_STEPS.md` for detailed guide
3. 📋 Use `CHECKLIST.md` to track progress
4. 🔍 Check `examples/api-contracts.md` for API specifications
5. 🚀 Deploy to production

---

## Quick Reference

| Task | Command |
|------|---------|
| Setup | `npm run setup` |
| Validate | `npm run validate` |
| Test | `npm run test-connections` |
| Start | `npm start` |
| Dev mode | `npm run dev` |

---

## Need Help?

1. Check `CONNECTION_GUIDE.md` for detailed connection info
2. Review `IMPLEMENTATION_STEPS.md` for step-by-step guide
3. Check `examples/api-contracts.md` for API specifications
4. Review logs: `logs/combined.log`

---

**Ready? Start with Step 1!** 🚀

