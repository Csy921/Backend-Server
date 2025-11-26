# Wechaty Communication Logging

All messages between the backend server and Wechaty service are now logged with detailed information.

## Log Tags

All Wechaty-related logs are prefixed with tags for easy filtering:

- `[WECHATY OUTGOING]` - Messages sent FROM backend TO Wechaty
- `[WECHATY INCOMING]` - Messages received FROM Wechaty TO backend
- `[WECHATY WEBHOOK RECEIVED]` - Raw webhook requests received
- `[WECHATY POLLING]` - Polling responses from Wechaty
- `[WECHATY OUTGOING FAILED]` - Failed send attempts

## What Gets Logged

### 1. Outgoing Messages (Backend → Wechaty)

**When:** Backend sends a message to a WeChat group

**Log Example:**
```json
{
  "type": "send_message",
  "direction": "backend → wechaty",
  "groupId": "27551115736@chatroom",
  "message": "[Sales Inquiry]\n\nI need a basin\n\n[Session ID: abc-123]",
  "endpoint": "http://127.0.0.1:3001/api/send",
  "requestBody": {
    "groupId": "27551115736@chatroom",
    "message": "..."
  },
  "responseStatus": 200,
  "responseData": {...},
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### 2. Incoming Messages (Wechaty → Backend)

**When:** Wechaty service sends a reply from a WeChat group

**Log Example:**
```json
{
  "type": "received_message",
  "direction": "wechaty → backend",
  "sessionId": "abc-123",
  "groupId": "27551115736@chatroom",
  "from": "Supplier Name",
  "message": "We have basins available",
  "rawMessage": {
    "roomId": "27551115736@chatroom",
    "from": "Supplier Name",
    "text": "We have basins available",
    "timestamp": "2024-01-01T00:00:00Z"
  },
  "timestamp": "2024-01-01T00:00:00.000Z",
  "receivedAt": "2024-01-01T00:00:01.000Z"
}
```

### 3. Webhook Registration

**When:** Backend registers webhook with Wechaty service

**Log Example:**
```json
{
  "type": "webhook_registration",
  "direction": "backend → wechaty",
  "endpoint": "http://127.0.0.1:3001/webhook/register",
  "requestBody": {
    "url": "http://localhost:3000/webhook/wechat/webhook",
    "events": ["message", "group_message"]
  },
  "responseStatus": 200,
  "responseData": {...},
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### 4. Raw Webhook Requests

**When:** Wechaty service sends a webhook request to backend

**Log Example:**
```json
{
  "type": "webhook_request",
  "direction": "wechaty → backend",
  "endpoint": "/webhook/wechat/webhook",
  "rawBody": {
    "roomId": "27551115736@chatroom",
    "from": "Supplier",
    "text": "Message text"
  },
  "headers": {...},
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### 5. Polling Responses

**When:** Backend polls Wechaty service for messages (if webhook not available)

**Log Example:**
```json
{
  "type": "poll_response",
  "direction": "wechaty → backend",
  "endpoint": "http://127.0.0.1:3001/messages/pending",
  "messageCount": 2,
  "messages": [
    {
      "roomId": "27551115736@chatroom",
      "from": "Supplier A",
      "text": "Message 1"
    },
    {
      "roomId": "27551115736@chatroom",
      "from": "Supplier B",
      "text": "Message 2"
    }
  ],
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### 6. Failed Operations

**When:** Sending or registration fails

**Log Example:**
```json
{
  "type": "send_message_failed",
  "direction": "backend → wechaty",
  "endpoint": "http://127.0.0.1:3001/api/send",
  "groupId": "27551115736@chatroom",
  "message": "Message text",
  "error": "Error message",
  "errorDetails": {...},
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

## Viewing Logs

### Real-time Logs

```bash
# View all logs in real-time
tail -f logs/combined.log

# On Windows PowerShell
Get-Content logs/combined.log -Wait
```

### Filter Wechaty Logs

```bash
# Filter for Wechaty logs only
tail -f logs/combined.log | grep "WECHATY"

# On Windows PowerShell
Get-Content logs/combined.log -Wait | Select-String "WECHATY"
```

### Filter by Direction

```bash
# Outgoing messages (backend → wechaty)
grep "WECHATY OUTGOING" logs/combined.log

# Incoming messages (wechaty → backend)
grep "WECHATY INCOMING" logs/combined.log

# Webhook requests
grep "WECHATY WEBHOOK" logs/combined.log
```

### Filter by Type

```bash
# All send operations
grep "send_message" logs/combined.log

# All received messages
grep "received_message" logs/combined.log

# Webhook registrations
grep "webhook_registration" logs/combined.log
```

## Log File Locations

- **All logs**: `logs/combined.log`
- **Errors only**: `logs/error.log`
- **Console**: Real-time output when server is running

## Example Log Flow

### Complete Message Flow Logged:

1. **Webhook Registration** (on startup):
   ```
   [WECHATY OUTGOING] webhook_registration
   ```

2. **Send Inquiry** (when WhatsApp message arrives):
   ```
   [WECHATY OUTGOING] send_message
   ```

3. **Receive Reply** (when supplier responds):
   ```
   [WECHATY WEBHOOK RECEIVED] webhook_request
   [WECHATY INCOMING] received_message
   ```

4. **Complete Session** (after threshold):
   ```
   [WECHATY OUTGOING] send_message (summary back to WhatsApp)
   ```

## Log Format

All logs include:
- **Type**: What operation (send_message, received_message, etc.)
- **Direction**: backend → wechaty or wechaty → backend
- **Endpoint**: API endpoint used
- **Request/Response**: Full request body and response
- **Timestamp**: When it occurred
- **Error details**: If operation failed

## Benefits

1. **Debugging**: See exactly what's being sent/received
2. **Monitoring**: Track all communication
3. **Troubleshooting**: Identify where messages get lost
4. **Audit**: Complete record of all interactions

## Summary

All communication between backend and Wechaty is now logged with:
- ✅ Outgoing messages (backend → wechaty)
- ✅ Incoming messages (wechaty → backend)
- ✅ Webhook registrations
- ✅ Polling responses
- ✅ Failed operations
- ✅ Raw webhook requests

Check `logs/combined.log` to see all Wechaty communication!

