# WhatsApp Service Configuration

## Endpoints Configured

### Send Message Endpoint
- **URL**: `https://wsmanager.bigbath.com.my/api/whatsapp/send-message`
- **Method**: POST
- **Authentication**: Bearer token in Authorization header
- **Purpose**: Send replies back to WhatsApp when suppliers respond

### Webhook Configuration
- **IFTTT Webhook URL**: `https://ifttt.bigbath.com.my/webhook/99ad5030-ac54-4637-ad8a-4c58f0c13c26`
- **Purpose**: This is where your WhatsApp service sends incoming messages

## Setup Instructions

### 1. Configure Environment Variables

Add to your `.env` file:

```bash
# WhatsApp Service Configuration
WHATSAPP_SERVICE_URL=https://wsmanager.bigbath.com.my
WHATSAPP_API_KEY=your_api_key_here
```

### 2. Configure Webhook in Your WhatsApp Service

Your WhatsApp service needs to send incoming messages to:
- **Your Backend Webhook**: `http://your-backend-url/webhook/whatsapp/webhook`

**Note**: The IFTTT webhook URL (`https://ifttt.bigbath.com.my/webhook/...`) appears to be an intermediate service. You may need to:
- Configure IFTTT to forward messages to your backend webhook
- Or configure your WhatsApp service to send directly to your backend

### 3. Test the Connection

#### Test Sending a Message:
```bash
curl -X POST https://wsmanager.bigbath.com.my/api/whatsapp/send-message \
  -H "Authorization: Bearer YOUR_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "to": "60123456789",
    "message": "Test message"
  }'
```

**Note**: The API supports optional `variables` for message templating:
```json
{
  "to": "60123456789",
  "message": "Hello {name}!",
  "variables": {"name": "John"}
}
```

#### Test Receiving Messages:
Send a test message from WhatsApp, and check your backend logs:
```bash
tail -f logs/combined.log
```

## Message Flow

1. **Sales person sends message** → WhatsApp Service → IFTTT → Your Backend (`/webhook/whatsapp/webhook`)
2. **Backend processes** → Routes to WeChat supplier groups
3. **Suppliers reply** → WeChat → Backend tracks replies
4. **Backend sends summary** → WhatsApp Service (`/whatsapp/send-message`) → Sales person receives reply

## Troubleshooting

### Messages not sending?
- Verify `WHATSAPP_API_KEY` is correct
- Check if endpoint requires different authentication
- Review request format - may need to adjust field names

### Messages not receiving?
- Verify webhook is configured in WhatsApp service
- Check if IFTTT is forwarding correctly
- Review webhook format in logs

### Need to adjust request format?

If your service uses different field names, update `services/whatsappAdapter.js`:

```javascript
// Current format:
{
  to: recipient,
  message: messageText,
  sessionId: sessionId,
}

// If your service needs different format, change to:
{
  recipient: recipient,    // or phone, number, etc.
  text: messageText,       // or content, body, etc.
  // sessionId might not be needed
}
```

