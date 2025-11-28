# WhatsApp → WeChat Message Forwarding Flow

This document describes the complete flow of how messages are forwarded from WhatsApp to WeChat.

## Overview

```
WhatsApp → Backend Server → Wechaty Service → WeChat Group
```

## Detailed Flow

### Step 1: WhatsApp Message Received

**Endpoint:** `POST /webhook/whatsapp/webhook`

**Location:** `routes/whatsapp.js` (line 28)

**Process:**
1. WhatsApp service sends webhook to backend
2. Backend immediately responds with `200 OK` (acknowledgment)
3. Backend parses the incoming message

**Supported Formats:**
- WhatsApp Business API format
- Custom webhook format (wsmanager, IFTTT, etc.)

**Example WhatsApp Message:**
```json
{
  "from": "60123456789",
  "body": "Hello from WhatsApp",
  "messageId": "msg_123",
  "timestamp": 1701172800
}
```

---

### Step 2: Message Processing

**Function:** `processWhatsAppMessage(message)`

**Location:** `routes/whatsapp.js` (line 177)

**Process:**
1. Logs the incoming WhatsApp message
2. Calls `forwardMessageToWeChatGroup(message)` to forward the message
3. Logs session workflow status (currently disabled)

---

### Step 3: Message Formatting

**Function:** `formatWhatsAppMessageForWeChat(message)`

**Location:** `routes/whatsapp.js` (line 77)

**Process:**
1. Extracts message text from `message.body`, `message.text`, or `message.message`
2. Extracts sender name/number from `message.from` or `message.sender`
3. Formats timestamp from `message.timestamp`:
   - Converts Unix timestamp (seconds) to Date object
   - Formats as `dd-mm-yyyy HH:MM:SS`
4. Creates formatted message string

**Output Format:**
```
[WhatsApp → WeChat]

From: 60123456789
Time: 28-11-2025 14:30:00

Hello from WhatsApp
```

---

### Step 4: Forward to WeChat Group

**Function:** `forwardMessageToWeChatGroup(message)`

**Location:** `routes/whatsapp.js` (line 142)

**Process:**
1. Sets target WeChat group ID: `27551115736@chatroom` (hardcoded)
2. Gets Wechaty adapter instance
3. Formats message using `formatWhatsAppMessageForWeChat()`
4. Initializes Wechaty adapter if not ready
5. Calls `wechatyAdapter.sendToGroup(groupId, formattedMessage)`
6. Logs success/failure

**Code:**
```javascript
const wechatGroupId = '27551115736@chatroom';
const wechatyAdapter = getWechatyAdapter();
const formattedMessage = formatWhatsAppMessageForWeChat(message);

if (!wechatyAdapter.isReady) {
  await wechatyAdapter.initialize();
}

const sent = await wechatyAdapter.sendToGroup(wechatGroupId, formattedMessage);
```

---

### Step 5: Wechaty Adapter - Send to Group

**Function:** `sendToGroup(groupId, messageText)`

**Location:** `services/wechatyAdapter.js` (line 292)

**Process:**
1. Validates adapter is ready (`isReady === true`)
2. Constructs API URL: `${baseUrl}/api/send`
   - `baseUrl` = `process.env.WECHATY_SERVICE_URL` (e.g., `https://3001.share.zrok.io`)
3. Sends HTTP POST request to Wechaty service

**Request:**
```http
POST https://3001.share.zrok.io/api/send
Content-Type: application/json
Authorization: Bearer {WECHATY_API_KEY}

{
  "groupId": "27551115736@chatroom",
  "message": "[WhatsApp → WeChat]\n\nFrom: 60123456789\nTime: 28-11-2025 14:30:00\n\nHello from WhatsApp"
}
```

**Response Handling:**
- Returns `true` if status is 200 or 201
- Returns `false` if error occurs
- Logs detailed request/response information

---

### Step 6: Wechaty Service Receives Request

**Location:** Your Wechaty service at `https://3001.share.zrok.io`

**Process:**
1. Receives POST request at `/api/send`
2. Validates API key (if required)
3. Extracts `groupId` and `message` from request body
4. Sends message to WeChat group using Wechaty bot

---

### Step 7: Message Appears in WeChat

**Location:** WeChat group `27551115736@chatroom`

**Result:**
The formatted message appears in the WeChat group:
```
[WhatsApp → WeChat]

From: 60123456789
Time: 28-11-2025 14:30:00

Hello from WhatsApp
```

---

## Complete Flow Diagram

```
┌─────────────┐
│  WhatsApp   │
│   Service   │
└──────┬──────┘
       │
       │ POST /webhook/whatsapp/webhook
       │ { from, body, messageId, timestamp }
       │
       ▼
┌─────────────────────────────────────┐
│      Backend Server                 │
│  (backend-server-6wmd.onrender.com)│
│                                     │
│  1. Receive webhook                │
│  2. Respond 200 OK immediately     │
│  3. processWhatsAppMessage()       │
│     └─> forwardMessageToWeChatGroup()│
│         └─> formatWhatsAppMessageForWeChat()│
│             └─> Format message with metadata│
│         └─> wechatyAdapter.sendToGroup()│
└──────┬──────────────────────────────┘
       │
       │ POST https://3001.share.zrok.io/api/send
       │ Authorization: Bearer {API_KEY}
       │ { groupId: "27551115736@chatroom", message: "..." }
       │
       ▼
┌─────────────────────┐
│  Wechaty Service    │
│ (3001.share.zrok.io)│
│                     │
│ 1. Receive /api/send│
│ 2. Validate API key │
│ 3. Send to WeChat   │
└──────┬──────────────┘
       │
       │ Wechaty Bot API
       │ Send to group
       │
       ▼
┌─────────────┐
│   WeChat    │
│   Group     │
│27551115736@ │
│  chatroom   │
└─────────────┘
```

## Code Flow Summary

1. **`routes/whatsapp.js`** → `router.post('/webhook')`
   - Receives WhatsApp webhook
   - Calls `processWhatsAppMessage()`

2. **`routes/whatsapp.js`** → `processWhatsAppMessage()`
   - Logs message
   - Calls `forwardMessageToWeChatGroup()`

3. **`routes/whatsapp.js`** → `forwardMessageToWeChatGroup()`
   - Formats message with `formatWhatsAppMessageForWeChat()`
   - Gets Wechaty adapter
   - Calls `wechatyAdapter.sendToGroup()`

4. **`services/wechatyAdapter.js`** → `sendToGroup()`
   - Sends HTTP POST to Wechaty service
   - Endpoint: `${WECHATY_SERVICE_URL}/api/send`
   - Payload: `{ groupId, message }`

5. **Wechaty Service** → Receives and processes
   - Sends message to WeChat group via Wechaty bot

## Configuration Required

### Environment Variables

```env
# Wechaty Service URL
WECHATY_SERVICE_URL=https://3001.share.zrok.io

# Optional: API Key for authentication
WECHATY_API_KEY=your_api_key_if_needed

# External Wechaty flag
USE_EXTERNAL_WECHATY=true
```

### Hardcoded Values

- **WeChat Group ID:** `27551115736@chatroom` (in `routes/whatsapp.js` line 144)

## Error Handling

### At Each Step:

1. **Webhook Reception:**
   - Errors are caught and logged
   - Response still sent to prevent retries

2. **Message Formatting:**
   - Falls back to defaults if fields missing
   - Uses current time if timestamp invalid

3. **Wechaty Adapter:**
   - Initializes adapter if not ready
   - Logs errors if send fails
   - Returns `false` on failure

4. **Wechaty Service:**
   - Should handle errors and return appropriate status codes

## Logging

The flow includes comprehensive logging at each step:

- `[WECHAT]` - WhatsApp message received
- `Forwarding WhatsApp message to WeChat group` - Forwarding started
- `[WECHATY OUTGOING]` - Message sent to Wechaty service
- `Message sent to WeChat group via adapter` - Success
- `Failed to forward WhatsApp message to WeChat group` - Failure

## Testing

You can test the flow by sending a message to your WhatsApp webhook:

```bash
curl -X POST https://backend-server-6wmd.onrender.com/webhook/whatsapp/webhook \
  -H "Content-Type: application/json" \
  -d '{
    "from": "60123456789",
    "body": "Test message",
    "messageId": "test_123",
    "timestamp": 1701172800
  }'
```

This should:
1. Be received by the backend
2. Be formatted with metadata
3. Be sent to Wechaty service
4. Appear in WeChat group `27551115736@chatroom`

## Summary

**Input:** WhatsApp message via webhook  
**Processing:** Format with metadata (sender, time)  
**Output:** HTTP POST to Wechaty service  
**Result:** Message appears in WeChat group with formatted header

The entire flow is **asynchronous** - the backend responds immediately to WhatsApp and processes the forwarding in the background.

