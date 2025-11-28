# Wechaty Message Format for Backend

This document specifies the exact message format your Wechaty bot should send to the backend webhook endpoint.

## Webhook Endpoint

**URL:** `POST https://backend-server-6wmd.onrender.com/webhook/wechat/webhook`

**Headers:**
```
Content-Type: application/json
```

## Expected Message Format

The backend supports **multiple formats**. The **actual format** from your Wechaty bot is:

### Actual Wechaty Format (Current)

```json
{
  "timestamp": "2025-11-28T16:17:11.400+08:00",
  "messageId": "cmiila7dw000p90aeb6vye3v9",
  "messageAge": 0,
  "typeCode": 7,
  "typeName": "Text",
  "direction": "incoming",
  "isFromSelf": false,
  "talkerId": "F100003144676538",
  "talkerName": "ChanSinYing",
  "text": "hi",
  "payload": null,
  "attachmentPath": null,
  "isGroup": true,
  "roomId": "27551115736@chatroom",
  "roomTopic": "Zoee,逞楠"
}
```

### Alternative Formats (Also Supported)

**Old Nested Format:**
```json
{
  "message": "The actual message text content",
  "sender": {
    "id": "wxid_xxx",
    "name": "Contact Name"
  },
  "chat": {
    "isGroup": true,
    "groupId": "27551115736@chatroom",
    "groupName": "Group Name"
  },
  "timestamp": "2025-11-28T13:02:12.311+08:00"
}
```

### Alternative Format (Also Supported)

If you can't provide the nested structure, this simpler format also works:

```json
{
  "groupId": "27551115736@chatroom",
  "from": "Contact Name",
  "text": "Message text",
  "timestamp": "2025-11-28T13:02:12.311+08:00"
}
```

## Field Requirements

### Required Fields

1. **Message Text** (at least one of these):
   - `text` (current Wechaty format - preferred)
   - `message` (old format)
   - `content` (fallback)
   - `payload` (fallback)

2. **Group ID** (for session handling, but forwarding works without it):
   - `roomId` (current Wechaty format - preferred)
   - `chat.groupId` (old nested format)
   - `groupId` (old flat format)

### Important Fields

- **`direction`**: Should be `"incoming"` (outgoing messages are ignored)
- **`isFromSelf`**: Should be `false` (messages from self are ignored)
- **`isGroup`**: Should be `true` for group messages

### Optional Fields (with fallbacks)

- **Sender Name**: `sender.name` or `from` or `contact` (defaults to "Unknown")
- **Group Name**: `chat.groupName` or `groupName` or `roomName` (defaults to "Unknown Group")
- **Timestamp**: ISO 8601 format with timezone (defaults to current time if missing)

## Timestamp Format

**Required Format:** ISO 8601 with timezone offset

**Examples:**
- ✅ `"2025-11-28T13:02:12.311+08:00"` (with milliseconds and timezone)
- ✅ `"2025-11-28T13:02:12+08:00"` (without milliseconds)
- ✅ `"2025-11-28T13:02:12.311Z"` (UTC timezone)

**Important:** The backend extracts the time directly from the string to preserve your timezone. Don't convert it to server timezone.

## Complete Example

Here's a complete example of what your Wechaty bot should send:

```json
{
  "message": "Hello, this is a test message from WeChat",
  "sender": {
    "id": "wxid_abc123def456",
    "name": "John Doe"
  },
  "chat": {
    "isGroup": true,
    "groupId": "27551115736@chatroom",
    "groupName": "Sales Team"
  },
  "timestamp": "2025-11-28T13:02:12.311+08:00"
}
```

## Minimal Example (Still Works)

Even this minimal format will work for forwarding:

```json
{
  "text": "Quick message",
  "from": "Jane Smith",
  "timestamp": "2025-11-28T13:02:12.311+08:00"
}
```

## Response from Backend

The backend will respond immediately with:

```json
{
  "status": "ok"
}
```

HTTP Status: `200 OK`

## How Backend Processes the Message

1. **Immediately responds** with `200 OK` (to prevent retries)
2. **Forwards to WhatsApp** (if `SALES_GROUP_ID` is configured)
3. **Processes for sessions** (only if `groupId` is present)

## Field Extraction Logic

The backend extracts fields in this order (first match wins):

### Message Text
1. `message`
2. `text`
3. `content`
4. `payload`
5. Empty string if none found

### Sender Name
1. `talkerName` (current Wechaty format - preferred)
2. `sender.name` (old nested format)
3. `from` (old flat format)
4. `contact` (fallback)
5. `"Unknown"` if none found

### Group ID
1. `roomId` (current Wechaty format - preferred)
2. `chat.groupId` (old nested format)
3. `groupId` (old flat format)
4. `null` if none found (forwarding still works, but no session handling)

### Group Name
1. `roomTopic` (current Wechaty format - preferred)
2. `chat.groupName` (old nested format)
3. `groupName` (old flat format)
4. `roomName` (fallback)
5. `"Unknown Group"` if none found

### Timestamp
1. `timestamp` (if provided)
2. Current server time (if missing)

## Testing

You can test the format with curl:

```bash
curl -X POST https://backend-server-6wmd.onrender.com/webhook/wechat/webhook \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Test message",
    "sender": {
      "name": "Test User"
    },
    "chat": {
      "isGroup": true,
      "groupId": "27551115736@chatroom",
      "groupName": "Test Group"
    },
    "timestamp": "2025-11-28T13:02:12.311+08:00"
  }'
```

## Implementation in Your Wechaty Bot

Your Wechaty bot is already sending the correct format! Just make sure:

1. **Only send incoming messages** (not outgoing):
   - Check `direction === "incoming"` or `isFromSelf === false`
   - Don't send messages where `isFromSelf === true`

2. **Include all required fields**:
   - `text` - message content
   - `roomId` - group ID
   - `talkerName` - sender name
   - `roomTopic` - group name
   - `timestamp` - ISO format with timezone
   - `isGroup` - should be `true`
   - `direction` - should be `"incoming"`

3. **Example payload** (what you're already sending):
```json
{
  "timestamp": "2025-11-28T16:17:11.400+08:00",
  "messageId": "cmiila7dw000p90aeb6vye3v9",
  "direction": "incoming",
  "isFromSelf": false,
  "talkerId": "F100003144676538",
  "talkerName": "ChanSinYing",
  "text": "hi",
  "isGroup": true,
  "roomId": "27551115736@chatroom",
  "roomTopic": "Zoee,逞楠"
}
```

## Summary

**Minimum Required:**
- Message text (in `message`, `text`, `content`, or `payload`)

**Recommended:**
- Use the new format with nested objects
- Include `groupId` for session handling
- Include `timestamp` with timezone
- Include `sender.name` and `chat.groupName` for better formatting

**Note:** Messages will be forwarded to WhatsApp even without `groupId`, but session handling requires it.

