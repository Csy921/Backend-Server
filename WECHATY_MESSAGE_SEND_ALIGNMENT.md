# Wechaty Message Send Implementation Alignment

## ✅ Backend Implementation Matches Wechaty Service Processing

**Date:** December 1, 2025  
**Wechaty Service:** https://3001.share.zrok.io  
**Backend Endpoint:** `POST /api/send`

---

## Request Flow

```
Backend Server → zrok Tunnel → Wechaty Bot HTTP Server → WeChat
```

---

## Step-by-Step Alignment

### Step 1: Backend Sends Request ✅

**Backend Implementation:**
```javascript
// services/wechatyAdapter.js
const endpoint = `${baseUrlClean}/api/send`;
const requestBody = {
  message: messageText,  // Required
  roomId: groupId,        // Primary
  groupId: groupId,      // Alias
  roomName: options.roomName  // Optional fallback
};

await axios.post(endpoint, requestBody, {
  headers: {
    'Authorization': `Bearer ${this.apiKey}`,
    'Content-Type': 'application/json',
  }
});
```

**Request Sent:**
```http
POST https://3001.share.zrok.io/api/send HTTP/1.1
Content-Type: application/json
Authorization: Bearer {apiKey}

{
  "message": "Hello from WhatsApp!",
  "roomId": "27551115736@chatroom",
  "groupId": "27551115736@chatroom"
}
```

**Wechaty Service Receives:**
- ✅ Endpoint: `POST /api/send` (Line 608: `if (req.method === "POST" && req.url === "/api/send")`)

---

### Step 2: Wechaty Validates Bot Status ✅

**Wechaty Service:**
```javascript
// Line 610: Verify bot is logged in
if (!bot.isLoggedIn) {
  return error: "Bot is not logged in yet"
}
```

**Backend Handling:**
- ✅ Detects 503 status code
- ✅ Logs: "Service unavailable - Bot may not be logged in yet"
- ✅ Provides hint: "Wait for the bot to connect to WeChat"

---

### Step 3: Wechaty Parses Request Body ✅

**Wechaty Service:**
```javascript
// Line 644-646: Parse JSON
const data = JSON.parse(body);
const { contactId, message, roomId, contactName, roomName, groupId } = data;
```

**Backend Sends:**
- ✅ `message` - Required field
- ✅ `roomId` - Primary field
- ✅ `groupId` - Alias field
- ✅ `roomName` - Optional fallback
- ⚠️ `contactId`, `contactName` - Not sent (not needed for group messages)

**Alignment:** ✅ **PERFECT MATCH**

---

### Step 4: Wechaty Validates Message ✅

**Wechaty Service:**
```javascript
// Line 651: Check message exists
if (!message || !message.trim()) {
  return error: "Message is required"
}
```

**Backend Validation:**
```javascript
// Matches Wechaty validation exactly
if (!messageText || typeof messageText !== 'string' || messageText.trim().length === 0) {
  logger.error('Cannot send empty message to WeChat');
  return false;
}
```

**Alignment:** ✅ **PERFECT MATCH** - Prevents invalid requests before sending

---

### Step 5: Wechaty Determines Target ✅

**Wechaty Service:**
```javascript
// Line 660: Get target room/contact
const targetRoomId = roomId || groupId || BACKEND_CONFIG.defaultTargetRoomId;
```

**Backend Sends:**
- ✅ `roomId` - Primary (checked first)
- ✅ `groupId` - Alias (checked second)
- ✅ Both included for maximum compatibility

**Alignment:** ✅ **PERFECT MATCH** - Wechaty will use `roomId` first, then `groupId` if needed

---

### Step 6: Wechaty Sends to WeChat Group ✅

**Wechaty Service:**
```javascript
// Line 664-696: Find room and send message
const room = await bot.Room.find({ id: targetRoomId });
if (room) {
  await room.say(message);
  console.log(`📤 Sent message to group: ${targetRoomId}`);
}
```

**Backend Expects:**
- ✅ Success response (200 status)
- ✅ Response data with `success`, `message`, `roomId`, `roomName`

---

### Step 7: Wechaty Returns Response ✅

**Wechaty Service Response:**
```javascript
// Line 693-694: Send success response
res.writeHead(200, { "Content-Type": "application/json" });
res.end(JSON.stringify({
  success: true,
  message: "Message sent to group",
  roomId: targetRoomId,
  roomName: roomTopic
}));
```

**Backend Handles:**
```javascript
// Checks for 200 or 201 status
if (response.status === 200 || response.status === 201) {
  // Logs response data
  logger.debug('Message sent to WeChat group via adapter', {
    roomId: groupId,
    status: response.status,
    responseData: response.data,  // Contains: { success, message, roomId, roomName }
  });
  return true;
}
```

**Alignment:** ✅ **PERFECT MATCH**

---

## Request Format Comparison

### Backend Sends:
```json
{
  "message": "Hello from WhatsApp!",
  "roomId": "27551115736@chatroom",
  "groupId": "27551115736@chatroom"
}
```

### Wechaty Parses:
```javascript
const { contactId, message, roomId, contactName, roomName, groupId } = data;
// ✅ message: "Hello from WhatsApp!"
// ✅ roomId: "27551115736@chatroom"
// ✅ groupId: "27551115736@chatroom"
```

**Result:** ✅ All fields match perfectly

---

## Response Format Comparison

### Wechaty Returns:
```json
{
  "success": true,
  "message": "Message sent to group",
  "roomId": "27551115736@chatroom",
  "roomName": "Zoee,逞楠"
}
```

### Backend Receives:
```javascript
response.data = {
  success: true,
  message: "Message sent to group",
  roomId: "27551115736@chatroom",
  roomName: "Zoee,逞楠"
}
```

**Result:** ✅ Backend logs and processes all response fields

---

## Error Handling Alignment

### Wechaty Service Errors:

1. **Bot Not Logged In:**
   - Wechaty: Returns error if `!bot.isLoggedIn`
   - Backend: Detects 503, logs "Bot may not be logged in yet"

2. **Message Required:**
   - Wechaty: Returns error if `!message || !message.trim()`
   - Backend: Validates before sending, prevents invalid requests

3. **Room Not Found:**
   - Wechaty: Returns error if `room` is null
   - Backend: Detects 404, logs "Room not found - Check if roomId exists"

**Alignment:** ✅ **PERFECT MATCH** - All error scenarios handled

---

## Validation Comparison

| Validation | Wechaty Service | Backend | Status |
|------------|----------------|---------|--------|
| Message exists | `!message \|\| !message.trim()` | `!messageText \|\| typeof messageText !== 'string' \|\| messageText.trim().length === 0` | ✅ Match |
| Bot logged in | `!bot.isLoggedIn` | Detects 503 status | ✅ Match |
| Room exists | `room === null` | Detects 404 status | ✅ Match |
| Target determination | `roomId \|\| groupId \|\| default` | Sends both `roomId` and `groupId` | ✅ Match |

---

## Code Reference

### Backend Implementation
**File:** `services/wechatyAdapter.js`  
**Method:** `sendToGroup(groupId, messageText, options = {})`

### Wechaty Service Implementation
**File:** Wechaty bot HTTP server  
**Endpoint:** `POST /api/send` (Line 608)

---

## Summary

✅ **Request Format:** Matches Wechaty parsing exactly  
✅ **Message Validation:** Prevents invalid requests before sending  
✅ **Target Determination:** Sends both `roomId` and `groupId` for compatibility  
✅ **Response Handling:** Processes all response fields correctly  
✅ **Error Handling:** Handles all error scenarios with appropriate messages  

**Status:** ✅ **FULLY ALIGNED** - Backend implementation perfectly matches Wechaty service processing flow.

---

## Verification

To verify alignment, check server logs when sending a message:

1. **Request Log:**
   ```
   Sending message to Wechaty service
   requestBody: {
     message: "...",
     roomId: "27551115736@chatroom",
     groupId: "27551115736@chatroom"
   }
   ```

2. **Response Log:**
   ```
   Message sent to WeChat group via adapter
   responseData: {
     success: true,
     message: "Message sent to group",
     roomId: "27551115736@chatroom",
     roomName: "Zoee,逞楠"
   }
   ```

Both logs confirm perfect alignment with Wechaty service processing.

