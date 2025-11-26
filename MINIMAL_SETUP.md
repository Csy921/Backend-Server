# Minimal Setup: WhatsApp + Wechaty Only

This guide helps you set up just WhatsApp and Wechaty connections, skipping LLM configuration for now.

## Quick Configuration

### 1. Create `.env` file

Create a `.env` file in the root directory with:

```bash
# ============================================
# Server Configuration
# ============================================
PORT=3000
LOG_LEVEL=info

# ============================================
# WhatsApp Service Configuration
# ============================================
WHATSAPP_SERVICE_URL=https://wsmanager.bigbath.com.my
WHATSAPP_API_KEY=383556f29912501d4b68a6ac9e67e7c51baa6641b2e293b697591ffad5d472d4

# ============================================
# Wechaty Configuration
# ============================================
USE_EXTERNAL_WECHATY=true
WECHATY_SERVICE_URL=http://localhost:3002
WECHATY_API_KEY=your_wechaty_api_key
WEBHOOK_URL=http://localhost:3000/webhook/wechat/webhook

# ============================================
# LLM Configuration (Optional - Skip for now)
# ============================================
# Leave LLM settings empty or commented out
# The system will work without LLM using rule-based category extraction
```

### 2. Update Routing Rules

Edit `data/routingRules.json` with your product categories and WeChat group IDs:

```json
{
  "categories": {
    "basin": {
      "suppliers": [
        {
          "groupId": "supplier_basin_1",
          "name": "Basin Supplier A",
          "wechatGroupId": "wxid_YOUR_ACTUAL_GROUP_ID"
        }
      ]
    },
    "faucet": {
      "suppliers": [
        {
          "groupId": "supplier_faucet_1",
          "name": "Faucet Supplier A",
          "wechatGroupId": "wxid_YOUR_ACTUAL_GROUP_ID"
        }
      ]
    }
  }
}
```

**Important**: The system will use **rule-based category extraction** (looking for keywords like "basin", "faucet", etc. in the message). Make sure your categories match common keywords in messages.

### 3. Start the Server

```bash
npm start
```

## How It Works Without LLM

### Category Extraction
- **Rule-based**: Looks for category keywords in the message text
- Example: Message "I need a basin" → Extracts "basin"
- If no category found, message won't be routed (check logs)

### Reply Summarization
- **Simple format**: Concatenates all supplier replies
- Format: `"Supplier A: Reply text\n\nSupplier B: Reply text"`
- No AI summarization, just lists all replies

## Testing

### 1. Test WhatsApp Connection

```bash
# Test sending a message
curl -X POST https://wsmanager.bigbath.com.my/api/whatsapp/send-message \
  -H "Authorization: Bearer 383556f29912501d4b68a6ac9e67e7c51baa6641b2e293b697591ffad5d472d4" \
  -H "Content-Type: application/json" \
  -d '{
    "to": "60123456789",
    "message": "Test message"
  }'
```

### 2. Test WeChat Webhook

```bash
npm run test-wechat
```

### 3. Test Full Flow

1. Send a WhatsApp message containing a category keyword (e.g., "basin", "faucet")
2. Check logs: `tail -f logs/combined.log`
3. Verify message is forwarded to correct WeChat groups
4. Send replies from WeChat groups
5. Verify summary is sent back to WhatsApp

## Category Keywords

Make sure your messages contain these keywords (matching your routing rules):

- **basin** → Routes to basin suppliers
- **faucet** → Routes to faucet suppliers
- **toilet** → Routes to toilet suppliers

The system looks for these keywords in the message text (case-insensitive).

## Adding LLM Later

When you're ready to add LLM:

1. Add LLM configuration to `.env`:
   ```bash
   USE_EXTERNAL_LLM=false
   LLM_PROVIDER=openai
   LLM_API_KEY=your_key
   ```

2. Restart the server - it will automatically start using LLM for:
   - Better category extraction (understands context)
   - AI-powered reply summarization

## Troubleshooting

### Category not found?
- Check if message contains category keywords
- Review `data/routingRules.json` category names
- Check logs for category extraction attempts

### Replies not formatted nicely?
- This is expected without LLM - replies are just concatenated
- Add LLM later for better summarization

### Everything else works?
- Great! The system is functioning without LLM
- You can add LLM anytime for enhanced features

