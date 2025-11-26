# Render.com Deployment Guide

## Required Environment Variables

Set these in Render.com's environment variables section:

### 1. **WEBHOOK_URL** (Critical)
```
WEBHOOK_URL=https://backend-server-6wmd.onrender.com/webhook/wechat/webhook
```
**Why:** Your Wechaty service needs to know where to send messages. This tells it your Render URL.

### 2. **WECHATY_SERVICE_URL** (If Wechaty is hosted)
```
WECHATY_SERVICE_URL=https://your-wechaty-service-url.com
```
**OR** if Wechaty runs locally:
```
WECHATY_SERVICE_URL=http://your-local-ip:port
```
**Note:** If Wechaty is local, it must be accessible from the internet (use ngrok/tunnel) OR host Wechaty on Render too.

### 3. **WHATSAPP_SERVICE_URL** (Already configured)
```
WHATSAPP_SERVICE_URL=https://wsmanager.bigbath.com.my
```
**Status:** ✅ Already correct - your WhatsApp service is public.

### 4. **WHATSAPP_API_KEY** (Required)
```
WHATSAPP_API_KEY=383556f29912501d4b68a6ac9e67e7c51baa6641b2e293b697591ffad5d472d4
```
**Status:** ✅ Already have this.

### 5. **PORT** (Optional)
```
PORT=3000
```
**Note:** Render automatically sets `PORT`, but you can override if needed.

## External Service Configuration

### WhatsApp Service (wsmanager.bigbath.com.my)
**Action Required:** Update webhook URL in wsmanager to:
```
https://backend-server-6wmd.onrender.com/webhook/whatsapp/webhook
```

### Wechaty Service
**Action Required:** 
1. If Wechaty is local, ensure it can reach Render (or host Wechaty on Render too)
2. Update Wechaty's webhook registration to use:
   ```
   https://backend-server-6wmd.onrender.com/webhook/wechat/webhook
   ```

## Code Modifications Needed

### ✅ Fixed:
- Server doesn't start Wechaty bot when `USE_EXTERNAL_WECHATY=true`
- `sessionController.js` conditionally loads Wechaty (only when not using external)
- `wechatyService.js` handles missing Wechaty gracefully
- Wechaty moved to `optionalDependencies` - won't crash if not installed

### ⚠️ Important:
**Remove Wechaty from dependencies for Render deployment:**
- Wechaty is now in `optionalDependencies` - npm will skip if installation fails
- This is safe because you're using external Wechaty service
- If you need to remove it completely, delete `wechaty` and `wechaty-puppet-wechat` from `optionalDependencies` in `package.json`

## Testing After Deployment

1. **Health Check:**
   ```bash
   curl https://backend-server-6wmd.onrender.com/health
   ```

2. **WhatsApp Webhook:**
   ```bash
   curl "https://backend-server-6wmd.onrender.com/webhook/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=YOUR_TOKEN&hub.challenge=test"
   ```

3. **WeChat Webhook:**
   ```bash
   curl -X POST https://backend-server-6wmd.onrender.com/webhook/wechat/webhook \
     -H "Content-Type: application/json" \
     -d '{"message":"test","sender":{"name":"Test"},"chat":{"isGroup":true,"groupId":"test"}}'
   ```

## Summary

**Required Changes:**
1. ✅ Set `WEBHOOK_URL` to Render URL in Render environment variables
2. ✅ Update wsmanager webhook to Render URL
3. ✅ Update Wechaty webhook registration to Render URL
4. ⚠️ If Wechaty is local, make it accessible (ngrok/tunnel) or host it on Render

**No Code Changes Needed** - Just environment variables and external service configuration.

