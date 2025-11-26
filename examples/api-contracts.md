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

### Send Message to Group

**Endpoint:** `POST /send`

**Request:**
```json
{
  "groupId": "wxid_abc123",
  "message": "Message text here"
}
```

**Headers:**
```
Authorization: Bearer YOUR_API_KEY
Content-Type: application/json
```

**Response:**
```json
{
  "success": true,
  "messageId": "msg_123456"
}
```

### Register Webhook (Optional)

**Endpoint:** `POST /webhook/register`

**Request:**
```json
{
  "url": "http://localhost:3000/webhook/wechat",
  "events": ["message", "group_message"]
}
```

**Response:**
```json
{
  "success": true,
  "webhookId": "webhook_123"
}
```

### Webhook Callback (Your service calls this backend)

**Endpoint:** `POST http://your-backend/webhook/wechat`

**Request Body:**
```json
{
  "groupId": "wxid_abc123",
  "from": "Contact Name",
  "text": "Message text",
  "timestamp": "2024-01-01T00:00:00Z"
}
```

### Poll Messages (Alternative to webhook)

**Endpoint:** `GET /messages/pending`

**Response:**
```json
{
  "messages": [
    {
      "groupId": "wxid_abc123",
      "from": "Contact Name",
      "text": "Message text",
      "timestamp": "2024-01-01T00:00:00Z"
    }
  ]
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

