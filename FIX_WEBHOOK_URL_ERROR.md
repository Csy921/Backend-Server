# Fix: "webhookUrl is not defined" Error

## Error Message

```
2025-12-01 08:46:37 [SYSTEM]: Failed to initialize Wechaty adapter webhookUrl is not defined
2025-12-01 08:46:37 [SYSTEM]: Failed to initialize Wechaty adapter
```

## Root Cause

The `WEBHOOK_URL` environment variable is **not set** in your deployment environment (Render.com).

## Solution

### Step 1: Set WEBHOOK_URL Environment Variable

**In Render.com Dashboard:**

1. Go to your service dashboard
2. Navigate to **Environment** tab
3. Add or update the environment variable:

   **Key:** `WEBHOOK_URL`  
   **Value:** `https://backend-server-6wmd.onrender.com/webhook/wechat/webhook`

### Step 2: Verify Configuration

After setting the environment variable, your configuration should have:

```bash
WECHATY_SERVICE_URL=https://3001.share.zrok.io
WECHATY_API_KEY=your_api_key
WEBHOOK_URL=https://backend-server-6wmd.onrender.com/webhook/wechat/webhook
```

### Step 3: Restart Service

After adding the environment variable:
1. **Save** the environment variable in Render dashboard
2. **Redeploy** your service (or wait for auto-deploy)
3. Check logs to verify initialization succeeds

## What WEBHOOK_URL Is Used For

The `WEBHOOK_URL` is used to register your backend's webhook endpoint with the Wechaty service.

**Purpose:**
- Allows Wechaty service to send incoming WeChat messages back to your backend
- Used for **WeChat → WhatsApp** message forwarding

**Registration Request:**
```http
POST https://3001.share.zrok.io/webhook/register
Content-Type: application/json
Authorization: Bearer {WECHATY_API_KEY}

{
  "url": "https://backend-server-6wmd.onrender.com/webhook/wechat/webhook",
  "events": ["message", "group_message"]
}
```

## Code Fix Applied

The code has been updated to:
1. ✅ Define `webhookUrl` at function scope (always available)
2. ✅ Warn if `WEBHOOK_URL` is not set (uses default localhost)
3. ✅ Provide better error messages

**Before:**
```javascript
async registerWebhook() {
  try {
    const webhookUrl = process.env.WEBHOOK_URL || '...';
    // ... rest of code
  } catch (error) {
    // webhookUrl might not be defined if error occurs early
    webhookUrl: webhookUrl, // ❌ Could be undefined
  }
}
```

**After:**
```javascript
async registerWebhook() {
  // Define at function scope - always available
  const webhookUrl = process.env.WEBHOOK_URL || 'http://localhost:3000/webhook/wechat/webhook';
  
  // Warn if not set
  if (!webhookUrl || webhookUrl === 'http://localhost:3000/webhook/wechat/webhook') {
    logger.warn('WEBHOOK_URL not set, using default localhost URL...');
  }
  
  try {
    // ... rest of code
  } catch (error) {
    // webhookUrl is always defined ✅
    webhookUrl: webhookUrl,
  }
}
```

## Verification

After setting `WEBHOOK_URL` and restarting, you should see:

**Success Logs:**
```
[SYSTEM]: Initializing Wechaty adapter connection...
[SYSTEM]: Wechaty service connection test successful
[SYSTEM]: Webhook registered with Wechaty service
[SYSTEM]: Wechaty adapter initialized
```

**Instead of:**
```
[SYSTEM]: Failed to initialize Wechaty adapter webhookUrl is not defined
```

## Impact

**Without WEBHOOK_URL:**
- ❌ Webhook registration fails
- ❌ Backend falls back to polling (less efficient)
- ❌ May cause initialization errors

**With WEBHOOK_URL:**
- ✅ Webhook registration succeeds
- ✅ Real-time message delivery from WeChat
- ✅ Proper bidirectional communication

## Summary

**Action Required:**
1. Set `WEBHOOK_URL=https://backend-server-6wmd.onrender.com/webhook/wechat/webhook` in Render.com
2. Restart service
3. Verify logs show successful initialization

**Code Status:**
- ✅ Fixed scope issue
- ✅ Added warning for missing env var
- ✅ Better error handling

