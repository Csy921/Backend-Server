# WeChat Message Processing Flow

This document explains what happens after a message is received from Wechaty.

## Overview

When a WeChat message arrives from your Wechaty service, it goes through several processing steps to track replies, check thresholds, and eventually send a summary back to WhatsApp.

## Complete Processing Flow

```
Wechaty Service
    ↓ (POST /webhook/wechat/webhook)
Backend Webhook Route
    ↓ (Validates format)
Wechaty Adapter
    ↓ (Extracts data, finds session)
Session Controller
    ↓ (Adds reply, checks threshold)
    ├─→ Threshold Reached? → Complete Session
    └─→ Timeout? → Complete Session
Session Completion
    ↓ (Summarizes replies)
WhatsApp Adapter
    ↓ (Sends summary)
WhatsApp (Sales Person)
```

## Step-by-Step Processing

### Step 1: Webhook Receives Message
**File:** `routes/wechat.js`

```javascript
POST /webhook/wechat/webhook
```

**Actions:**
1. ✅ Immediately responds with `200 OK` (acknowledges receipt)
2. ✅ Logs incoming webhook request
3. ✅ Validates message format:
   - Checks for `chat.groupId` or `groupId` or `roomId`
   - Verifies `chat.isGroup === true` (ignores private messages)
4. ✅ Passes message to `wechatyAdapter.handleMessage()`

**Log Entry:**
```json
{
  "level": "info",
  "message": "[WECHATY WEBHOOK RECEIVED]",
  "type": "webhook_request",
  "direction": "wechaty → backend",
  "rawBody": { ... }
}
```

---

### Step 2: Wechaty Adapter Processes Message
**File:** `services/wechatyAdapter.js` → `handleMessage()`

**Actions:**
1. ✅ Extracts data from message:
   ```javascript
   const groupId = chat.groupId || message.groupId || message.roomId;
   const from = sender.name || message.from || 'Unknown';
   const text = message.message || message.text || '';
   const timestamp = message.timestamp || new Date().toISOString();
   ```

2. ✅ Looks up session ID from group ID:
   ```javascript
   const sessionId = this.getSessionFromGroup(groupId);
   ```
   - Uses `groupToSessionMap` to find which session this group belongs to
   - If no session found → **Message ignored** (not part of active session)

3. ✅ Creates reply data object:
   ```javascript
   const replyData = {
     sessionId,
     groupId,
     from,
     text,
     timestamp
   };
   ```

4. ✅ Logs the incoming message:
   ```json
   {
     "level": "info",
     "message": "[WECHATY INCOMING]",
     "type": "received_message",
     "direction": "wechaty → backend",
     "sessionId": "...",
     "groupId": "27551115736@chatroom",
     "from": "Supplier A",
     "message": "We have basins available"
   }
   ```

5. ✅ Calls registered message handler:
   ```javascript
   const handler = this.messageHandlers.get(sessionId);
   if (handler) {
     await handler(replyData);
   }
   ```

**If no session found:**
- Message is logged as debug
- Processing stops (message ignored)

---

### Step 3: Session Controller Handles Reply
**File:** `controllers/sessionController.js` → `handleReply()`

**Actions:**
1. ✅ Validates session is active:
   ```javascript
   const session = this.sessions.get(sessionId);
   if (!session || session.status !== 'active') {
     return; // Session not active, ignore
   }
   ```

2. ✅ Adds reply to session:
   ```javascript
   session.replies.push(replyData);
   session.repliesReceived = session.replies.length;
   ```

3. ✅ Logs reply received:
   ```json
   {
     "level": "info",
     "message": "Reply received for session",
     "sessionId": "...",
     "replyCount": 1,
     "threshold": 3
   }
   ```

4. ✅ Checks if threshold reached:
   ```javascript
   if (session.repliesReceived >= wechatyConfig.replyThreshold) {
     await this.completeSession(sessionId);
   }
   ```

**Threshold Check:**
- Default threshold: **3 replies** (from `config/wechatyConfig.js`)
- If threshold reached → **Go to Step 4**
- If threshold not reached → **Wait for more replies**

---

### Step 4: Session Completion
**File:** `controllers/sessionController.js` → `completeSession()`

**Triggered by:**
- ✅ Threshold reached (3 replies)
- ✅ Timeout (10 minutes maximum wait time)

**Actions:**
1. ✅ Stops timer:
   ```javascript
   if (session.timer) {
     session.timer.stop();
   }
   ```

2. ✅ Updates session status:
   ```javascript
   session.status = 'completed';
   session.endTime = Date.now();
   session.duration = session.endTime - session.startTime;
   session.isTimeout = isTimeout;
   ```

3. ✅ Gets all replies:
   ```javascript
   const finalReplies = session.replies.length > 0 
     ? session.replies 
     : logReplies; // Fallback to logs
   ```

4. ✅ Summarizes replies:
   ```javascript
   // Option 1: Use LLM (if available)
   if (this.llmService) {
     summary = await this.llmService.summarizeReplies(finalReplies);
   }
   // Option 2: Simple format (if LLM not available)
   else {
     summary = this.formatRepliesSimple(finalReplies);
   }
   ```

5. ✅ Stores summary in session:
   ```javascript
   session.summary = summary;
   session.finalReplies = finalReplies;
   ```

6. ✅ Logs session completion:
   ```json
   {
     "level": "info",
     "message": "Session completed",
     "sessionId": "...",
     "repliesCount": 3,
     "isTimeout": false,
     "duration": 125000
   }
   ```

7. ✅ Returns session result:
   ```javascript
   return {
     sessionId,
     replies: finalReplies,
     summary,
     isTimeout
   };
   ```

---

### Step 5: Send Summary to WhatsApp
**File:** `routes/whatsapp.js` → `waitForSessionCompletion()`

**How it works:**
- The WhatsApp route uses `waitForSessionCompletion()` which polls the session status
- When session status becomes `'completed'`, it retrieves the summary

**Actions:**
1. ✅ Gets completed session:
   ```javascript
   const session = sessionController.getSession(sessionId);
   if (session && session.status === 'completed') {
     const result = {
       sessionId,
       replies: session.finalReplies || session.replies,
       summary: session.summary || 'Processing replies...',
     };
   }
   ```

2. ✅ Sends summary via WhatsApp adapter:
   ```javascript
   const whatsappAdapter = getWhatsAppAdapter();
   await whatsappAdapter.sendMessage(
     message.from,      // Original WhatsApp sender
     result.summary,    // Summarized replies
     sessionId
   );
   ```

3. ✅ Logs WhatsApp message sent:
   ```json
   {
     "level": "info",
     "message": "WhatsApp message sent",
     "sessionId": "...",
     "to": "60123456789",
     "message": "Summary of replies..."
   }
   ```

---

## Session Data Structure

### Active Session
```javascript
{
  sessionId: "uuid-here",
  status: "active",
  startTime: 1234567890,
  originalMessage: "Looking for basins",
  routingResult: { ... },
  replies: [
    {
      sessionId: "...",
      groupId: "27551115736@chatroom",
      from: "Supplier A",
      text: "We have basins available",
      timestamp: "2025-11-24T13:47:12.000Z"
    },
    // ... more replies
  ],
  repliesReceived: 2,
  timer: TimerObject,
  groupToSessionMap: Map
}
```

### Completed Session
```javascript
{
  sessionId: "uuid-here",
  status: "completed",
  startTime: 1234567890,
  endTime: 1234692890,
  duration: 125000, // milliseconds
  isTimeout: false,
  originalMessage: "Looking for basins",
  routingResult: { ... },
  replies: [ ... ],
  repliesReceived: 3,
  finalReplies: [ ... ],
  summary: "Summary of all replies...",
  timer: null
}
```

---

## Timeout Handling

### Timer Setup
When a session is created, a timer is started:
```javascript
const timeoutCallback = () => {
  this.handleTimeout(sessionId);
};
sessionData.timer = createTimer(timeoutCallback, wechatyConfig.maxWaitTime);
sessionData.timer.start();
```

**Default timeout:** 10 minutes (600,000 ms)

### Timeout Trigger
**File:** `controllers/sessionController.js` → `handleTimeout()`

**Actions:**
1. ✅ Validates session is still active
2. ✅ Logs timeout event
3. ✅ Calls `completeSession(sessionId, true)` with `isTimeout = true`

**Result:**
- Session completes even if threshold not reached
- Summary includes whatever replies were received
- If no replies: `"No replies received from suppliers within the time limit."`

---

## Reply Threshold Logic

### Configuration
**File:** `config/wechatyConfig.js`
```javascript
replyThreshold: 3,      // Number of replies needed
maxWaitTime: 600000,    // 10 minutes in milliseconds
```

### Behavior
- **Threshold reached:** Session completes immediately
- **Timeout reached:** Session completes with whatever replies received
- **Both conditions:** Threshold takes priority (completes immediately)

### Example Scenarios

**Scenario 1: Threshold Reached**
```
Reply 1 received → repliesReceived = 1 (waiting...)
Reply 2 received → repliesReceived = 2 (waiting...)
Reply 3 received → repliesReceived = 3 → ✅ Complete session!
```

**Scenario 2: Timeout**
```
Reply 1 received → repliesReceived = 1 (waiting...)
Reply 2 received → repliesReceived = 2 (waiting...)
⏰ 10 minutes elapsed → ✅ Complete session (with 2 replies)
```

**Scenario 3: No Replies**
```
⏰ 10 minutes elapsed → ✅ Complete session (summary: "No replies received...")
```

---

## Logging Throughout Flow

### 1. Webhook Received
```json
{
  "level": "info",
  "message": "[WECHATY WEBHOOK RECEIVED]",
  "type": "webhook_request"
}
```

### 2. Message Processed
```json
{
  "level": "info",
  "message": "[WECHATY INCOMING]",
  "type": "received_message",
  "sessionId": "...",
  "groupId": "27551115736@chatroom",
  "from": "Supplier A",
  "message": "We have basins"
}
```

### 3. Reply Added
```json
{
  "level": "info",
  "message": "Reply received for session",
  "sessionId": "...",
  "replyCount": 1,
  "threshold": 3
}
```

### 4. Session Completed
```json
{
  "level": "info",
  "message": "Session completed",
  "sessionId": "...",
  "repliesCount": 3,
  "isTimeout": false
}
```

### 5. WhatsApp Summary Sent
```json
{
  "level": "info",
  "message": "WhatsApp message sent",
  "sessionId": "...",
  "to": "60123456789"
}
```

---

## Error Handling

### Invalid Message Format
- **Action:** Log warning, ignore message
- **Log:** `"Invalid WeChat message format received"`

### Not a Group Message
- **Action:** Log debug, ignore message
- **Log:** `"Ignoring private message (not a group message)"`

### No Active Session
- **Action:** Log debug, ignore message
- **Log:** `"WeChat message received but not part of active session"`

### Session Not Active
- **Action:** Ignore reply (session already completed or doesn't exist)
- **No log** (silent ignore)

### LLM Summarization Fails
- **Action:** Fallback to simple format
- **Log:** `"LLM summarization failed, using simple format"`

---

## Summary

**Processing Steps:**
1. ✅ **Webhook receives** → Validates format
2. ✅ **Adapter extracts** → Finds session from group ID
3. ✅ **Controller adds reply** → Checks threshold
4. ✅ **Session completes** → Summarizes replies (threshold or timeout)
5. ✅ **Summary sent** → Back to WhatsApp

**Key Points:**
- Only group messages are processed
- Only messages from active sessions are processed
- Threshold: 3 replies OR 10 minutes timeout
- Summary sent automatically when session completes
- All steps are logged for debugging

---

## Viewing the Flow in Logs

### Watch all WeChat activity:
```bash
npm run logs:wechaty
```

### Watch session events:
```bash
npm run logs | grep -i session
```

### Watch complete flow:
```bash
npm run logs:watch
```

---

## Testing the Flow

### 1. Send a message from WhatsApp
```
Sales person: "Looking for basins"
```

### 2. Check logs for session creation
```bash
npm run logs | grep "Session created"
```

### 3. Send replies from WeChat groups
```
Supplier A: "We have basins available"
Supplier B: "Basins in stock"
Supplier C: "Yes, we can supply"
```

### 4. Check logs for replies
```bash
npm run logs:wechaty
```

### 5. Check session completion
```bash
npm run logs | grep "Session completed"
```

### 6. Verify summary sent to WhatsApp
```bash
npm run logs | grep "WhatsApp message sent"
```

---

## Next Steps

After understanding this flow, you can:
1. ✅ Monitor logs to see messages being processed
2. ✅ Adjust thresholds in `config/wechatyConfig.js`
3. ✅ Customize summary format in `sessionController.js`
4. ✅ Add additional processing steps if needed

