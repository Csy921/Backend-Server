# Using Wechaty Locally (Optional)

If you want to test the **built-in Wechaty bot** locally (not on Render), you need to install Wechaty dependencies.

## For Local Development with Built-in Wechaty

1. **Install Wechaty:**
   ```bash
   npm install wechaty wechaty-puppet-wechat
   ```

2. **Set environment variable:**
   ```bash
   USE_EXTERNAL_WECHATY=false
   ```

3. **Run the server:**
   ```bash
   npm start
   ```

## For Render Deployment (External Wechaty)

**Wechaty is NOT needed** because:
- ✅ You're using external Wechaty service
- ✅ Wechaty cannot run on cloud servers anyway
- ✅ The code uses `wechatyAdapter` when `USE_EXTERNAL_WECHATY=true`

**No action needed** - just deploy without Wechaty dependencies.

## Deprecation Warnings

If you see deprecation warnings when installing Wechaty locally, they are **harmless**:
- They come from Wechaty's dependencies (not your code)
- They don't affect functionality
- Wechaty maintainers are aware and will update in future versions

You can safely ignore them for now.

