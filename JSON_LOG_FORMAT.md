# JSON Log Format

The log files are now stored as **proper JSON arrays** instead of JSONL (one JSON per line).

## 📁 Log Files Location

```
logs/
├── combined.log    ← All logs (JSON array format)
└── error.log       ← Error logs only (JSON array format)
```

## 📄 Format

### Before (JSONL - one JSON per line):
```json
{"level":"info","message":"Session created","timestamp":"2025-11-24T13:47:12.000Z"}
{"level":"info","message":"Reply received","timestamp":"2025-11-24T13:47:13.000Z"}
{"level":"error","message":"Error occurred","timestamp":"2025-11-24T13:47:14.000Z"}
```

### After (JSON Array):
```json
[
  {
    "level": "info",
    "message": "Session created",
    "timestamp": "2025-11-24T13:47:12.000Z"
  },
  {
    "level": "info",
    "message": "Reply received",
    "timestamp": "2025-11-24T13:47:13.000Z"
  },
  {
    "level": "error",
    "message": "Error occurred",
    "timestamp": "2025-11-24T13:47:14.000Z"
  }
]
```

## 🔄 Converting Existing Logs

If you have existing log files in JSONL format, convert them to JSON array:

```bash
npm run logs:convert
```

This will:
1. ✅ Read existing log files
2. ✅ Convert from JSONL to JSON array
3. ✅ Create backup files (`.backup`)
4. ✅ Write new JSON array format

### Convert Specific Files

```bash
node scripts/convert-logs-to-json.js combined.log
node scripts/convert-logs-to-json.js error.log
```

## 📖 Viewing Logs

### View all logs:
```bash
npm run logs
```

### View error logs:
```bash
npm run logs:error
```

### View WeChat logs:
```bash
npm run logs:wechaty
```

### Watch logs in real-time:
```bash
npm run logs:watch
```

## 🔍 Direct File Access

You can now open the log files directly in any JSON viewer or editor:

1. **VS Code / Cursor**: Open `logs/combined.log` - it will be formatted as a JSON array
2. **Online JSON Viewer**: Copy the file content and paste into https://jsonformatter.org/
3. **Browser**: Some browsers can display JSON files directly

## 📊 Example Log Entry

```json
[
  {
    "level": "info",
    "message": "[WECHATY INCOMING]",
    "timestamp": "2025-11-24T13:47:12.000Z",
    "type": "received_message",
    "direction": "wechaty → backend",
    "sessionId": "abc-123",
    "groupId": "27551115736@chatroom",
    "from": "Supplier A",
    "message": "We have basins available",
    "service": "whatsapp-wechat-automation"
  }
]
```

## ⚙️ How It Works

The logger now uses a custom Winston transport (`JsonArrayFileTransport`) that:
1. Reads the existing JSON array from the file
2. Parses it (or creates empty array if file doesn't exist)
3. Appends the new log entry
4. Writes the entire array back as formatted JSON

## 🔄 Backward Compatibility

The system still supports reading JSONL format (for existing logs):
- `getReplyCount()` - Can read both formats
- `getRepliesFromLogs()` - Can read both formats
- `view-logs.js` - Can display both formats

## 📝 Notes

- **File Size**: JSON array format is slightly larger due to formatting, but more readable
- **Performance**: Writing is slightly slower (reads entire file, appends, writes back), but acceptable for typical log volumes
- **Backup**: Conversion script creates `.backup` files - you can delete them after verifying
- **Real-time**: Logs are written immediately as JSON array format

## 🎯 Benefits

✅ **Proper JSON format** - Can be opened in any JSON viewer  
✅ **Easier to parse** - Standard JSON array structure  
✅ **Better readability** - Formatted with indentation  
✅ **Compatible** - Still reads old JSONL format if needed  

---

**Quick Start:**
1. New logs are automatically in JSON array format
2. Convert existing logs: `npm run logs:convert`
3. View logs: `npm run logs`

