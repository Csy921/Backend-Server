# API Contracts for External Services

This document specifies the expected API contracts for external WhatsApp, Wechaty, and LLM services.

## WhatsApp Service API

### Send Message

**Endpoint:** `POST /send`

**Request:**
```json
{
  "to": "1234567890",
  "message": "Message text here",
  "sessionId": "optional-session-id"
}
```

**Response:**
```json
{
  "success": true,
  "messageId": "msg_123456",
  "status": "sent"
}
```

**Error Response:**
```json
{
  "success": false,
  "error": "Error message"
}
```

---

## Wechaty Service API

Base URL: `https://3001.share.zrok.io`

### Public Endpoints (No Authentication)

#### Health Check

**Endpoint:** `GET /health`

**Response:**
```json
{
  "status": "online",
  "botLoggedIn": true,
  "service": "wechaty-xp-bot",
  "timestamp": "2025-12-02T14:30:00.000+08:00"
}
```

### Protected Endpoints (Require API Key)

All endpoints below require:
```
Authorization: Bearer 07a4161616db38e537faa58d73de461ac971fd036e6a89526a15b478ac288b28
```

#### Service Info

**Endpoint:** `GET /`

**Response:**
```json
{
  "service": "Wechaty XP Bot HTTP API",
  "status": "ready",
  "botLoggedIn": true,
  "endpoints": {
    "health": "/health",
    "sendMessage": "POST /api/send"
  },
  "timestamp": "2025-12-02T14:30:00.000+08:00"
}
```

#### Send Message to WeChat

**Endpoint:** `POST /api/send`

**Request:**
```json
{
  "message": "Hello from WhatsApp",
  "roomId": "27551115736@chatroom",
  "groupId": "27551115736@chatroom",
  "roomName": "Supplier Group 1"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Message sent to group",
  "roomId": "27551115736@chatroom",
  "roomName": "Supplier Group 1"
}
```

#### Status Check

**Endpoint:** `GET /api/status`

**Response:**
```json
{
  "success": true,
  "status": "online",
  "botLoggedIn": true,
  "ready": true,
  "service": "wechaty-xp-bot",
  "wechatyServiceUrl": "http://localhost:3001",
  "webhookUrl": "https://backend-server-6wmd.onrender.com/webhook/wechat/webhook",
  "registeredWebhook": {
    "url": "https://backend-server-6wmd.onrender.com/webhook/wechat/webhook",
    "events": ["message", "group_message"]
  },
  "endpoints": {
    "send": "/api/send",
    "status": "/api/status",
    "health": "/health",
    "webhookRegister": "/webhook/register"
  },
  "timestamp": "2025-12-02T14:30:00.000+08:00"
}
```

#### Register Webhook

**Endpoint:** `POST /webhook/register` or `POST /api/webhook/register`

**Request:**
```json
{
  "webhookUrl": "https://backend-server-6wmd.onrender.com/webhook/wechat/webhook",
  "events": ["message", "group_message"]
}
```

**Response:**
```json
{
  "success": true,
  "message": "Webhook registered successfully",
  "webhookUrl": "https://backend-server-6wmd.onrender.com/webhook/wechat/webhook",
  "events": ["message", "group_message"]
}
```

#### Poll Messages (Deprecated)

**Endpoint:** `GET /api/messages` or `GET /api/poll`

**Note:** Messages are now delivered via webhook. This endpoint is kept for backward compatibility.

**Response:**
```json
{
  "success": true,
  "messages": [],
  "message": "Messages are delivered via webhook. Use POST /api/send to send messages.",
  "botLoggedIn": true,
  "timestamp": "2025-12-02T14:30:00.000+08:00"
}
```

### Webhook Callback (Wechaty calls your backend)

**Endpoint:** `POST https://backend-server-6wmd.onrender.com/webhook/wechat/webhook`

**Request Body:**
```json
{
  "roomId": "27551115736@chatroom",
  "roomTopic": "Supplier Group 1",
  "talkerName": "John Doe",
  "text": "Message text",
  "timestamp": "2025-12-02T14:30:00.000+08:00",
  "isGroup": true
}
```

---

## LLM Service API

### Extract Category

**Endpoint:** `POST /extract-category`

**Request:**
```json
{
  "message": "I need a basin for my bathroom"
}
```

**Response (Option 1):**
```json
{
  "category": "basin"
}
```

**Response (Option 2):**
```json
{
  "result": "basin"
}
```

**Error Response:**
```json
{
  "error": "Could not determine category",
  "category": null
}
```

### Summarize Replies

**Endpoint:** `POST /summarize`

**Request:**
```json
{
  "replies": [
    {
      "groupId": "wxid_supplier1",
      "from": "Supplier A",
      "text": "We have basins available in stock",
      "timestamp": "2024-01-01T00:00:00Z"
    },
    {
      "groupId": "wxid_supplier2",
      "from": "Supplier B",
      "text": "Our basins are on sale this week",
      "timestamp": "2024-01-01T00:01:00Z"
    }
  ]
}
```

**Response (Option 1):**
```json
{
  "summary": "Two suppliers responded: Supplier A has basins in stock, and Supplier B has basins on sale this week."
}
```

**Response (Option 2):**
```json
{
  "result": "Two suppliers responded: Supplier A has basins in stock, and Supplier B has basins on sale this week."
}
```

### Health Check

**Endpoint:** `GET /health`

**Response:**
```json
{
  "status": "ok"
}
```

---

## Implementation Notes

### For WhatsApp Service

- The `to` field can be a phone number (with country code, no +) or group ID
- The `sessionId` is optional and used for tracking
- Implement proper error handling and retries

### For Wechaty Service

- Group IDs should match the format used in `routingRules.json`
- Messages should only be sent/received from groups, not individual chats
- Webhook is preferred over polling for real-time updates
- If webhook fails, the adapter will fall back to polling

### For LLM Service

- Category extraction should return lowercase category names
- If category cannot be determined, return `null` or `"unknown"`
- Summarization should be concise but informative
- Handle rate limiting and API errors gracefully

---

## Testing Your APIs

### Test WhatsApp Service

```bash
curl -X POST http://localhost:3001/send \
  -H "Content-Type: application/json" \
  -d '{
    "to": "1234567890",
    "message": "Test message",
    "sessionId": "test-123"
  }'
```

### Test Wechaty Service

```bash
# Send message
curl -X POST http://localhost:3002/send \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "groupId": "wxid_test",
    "message": "Test message"
  }'

# Register webhook
curl -X POST http://localhost:3002/webhook/register \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "http://localhost:3000/webhook/wechat",
    "events": ["message"]
  }'
```

### Test LLM Service

```bash
# Extract category
curl -X POST http://localhost:3003/extract-category \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "I need a basin"
  }'

# Summarize
curl -X POST http://localhost:3003/summarize \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "replies": [
      {
        "groupId": "wxid_1",
        "from": "Supplier A",
        "text": "We have it",
        "timestamp": "2024-01-01T00:00:00Z"
      }
    ]
  }'
```

