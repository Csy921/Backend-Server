const winston = require('winston');
const path = require('path');

// Create logs directory if it doesn't exist
const fs = require('fs');
const logsDir = path.join(__dirname, '../logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Custom transport for JSON array format
class JsonArrayFileTransport extends winston.Transport {
  constructor(options) {
    super(options);
    this.filename = options.filename;
    this.level = options.level || 'info';
    this.format = options.format || winston.format.json();
  }

  log(info, callback) {
    setImmediate(() => {
      this.emit('logged', info);
    });

    // Format the log entry
    let logEntry;
    try {
      logEntry = this.format.transform(info, { all: true });
    } catch (e) {
      logEntry = info;
    }

    try {
      // Read existing logs
      let logs = [];
      if (fs.existsSync(this.filename)) {
        try {
          const content = fs.readFileSync(this.filename, 'utf8').trim();
          if (content) {
            logs = JSON.parse(content);
            if (!Array.isArray(logs)) {
              logs = [];
            }
          }
        } catch (e) {
          // If file is corrupted or not valid JSON, start fresh
          logs = [];
        }
      }

      // Add new log entry
      logs.push(logEntry);

      // Write back as JSON array
      fs.writeFileSync(this.filename, JSON.stringify(logs, null, 2) + '\n', 'utf8');
    } catch (error) {
      // If write fails, log error but don't crash
      console.error('Error writing to log file:', error.message);
    }

    if (callback) {
      callback(null, true);
    }
  }
}

// Safe JSON stringify that handles circular references
function safeStringify(obj, space = 2) {
  const seen = new WeakSet();
  return JSON.stringify(obj, (key, value) => {
    if (typeof value === 'object' && value !== null) {
      if (seen.has(value)) {
        return '[Circular]';
      }
      seen.add(value);
      // Remove circular references and non-serializable properties
      if (value instanceof Error) {
        return {
          message: value.message,
          stack: value.stack,
          name: value.name,
        };
      }
      // Remove socket/http related objects that cause circular refs
      if (value.constructor && value.constructor.name === 'Socket') {
        return '[Socket]';
      }
      if (value.constructor && value.constructor.name === 'ClientRequest') {
        return '[ClientRequest]';
      }
    }
    return value;
  }, space);
}

// Configure Winston logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.splat(),
    winston.format.json() // JSON format for all logs
  ),
  defaultMeta: { service: 'whatsapp-wechat-automation' },
  transports: [
    // Write all logs to console (simplified format: timestamp, source, message)
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.printf(({ timestamp, level, message, ...meta }) => {
          // Determine source from message or metadata
          let source = 'SYSTEM';
          
          // Extract source from message patterns
          if (message.includes('[WECHATY')) {
            source = 'WECHATY';
          } else if (message.includes('WhatsApp') || message.includes('whatsapp')) {
            source = 'WHATSAPP';
          } else if (message.includes('Session')) {
            source = 'SESSION';
          } else if (message.includes('WeChat')) {
            source = 'WECHAT';
          } else if (message.includes('Error') || level === 'error') {
            source = 'ERROR';
          } else if (message.includes('Routing')) {
            source = 'ROUTING';
          }
          
          // Simple format: timestamp [SOURCE] message
          return `${timestamp} [${source}]: ${message}`;
        })
      ),
    }),
    // Write all logs with level 'error' and below to error.log (JSON array format)
    new JsonArrayFileTransport({
      filename: path.join(logsDir, 'error.log'),
      level: 'error',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
      ),
    }),
    // Write all logs to combined.log (JSON array format)
    new JsonArrayFileTransport({
      filename: path.join(logsDir, 'combined.log'),
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
      ),
    }),
  ],
});

/**
 * Logs a message from WhatsApp
 * @param {string} sessionId - Session identifier
 * @param {Object} message - Message object
 */
function logWhatsAppMessage(sessionId, message) {
  logger.info('WhatsApp message received', {
    sessionId,
    from: message.from,
    body: message.body,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Logs a reply from WeChat
 * @param {string} sessionId - Session identifier
 * @param {string} groupId - WeChat group ID
 * @param {Object} message - Message object
 */
function logWeChatReply(sessionId, groupId, message) {
  logger.info('WeChat reply received', {
    sessionId,
    groupId,
    from: message.from,
    text: message.text,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Logs session creation
 * @param {string} sessionId - Session identifier
 * @param {Object} sessionData - Session data
 */
function logSessionCreated(sessionId, sessionData) {
  logger.info('Session created', {
    sessionId,
    category: sessionData.category,
    supplierGroups: sessionData.supplierGroups,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Logs session completion
 * @param {string} sessionId - Session identifier
 * @param {Object} sessionData - Session data
 */
function logSessionCompleted(sessionId, sessionData) {
  logger.info('Session completed', {
    sessionId,
    repliesReceived: sessionData.repliesReceived,
    totalReplies: sessionData.replies.length,
    duration: sessionData.duration,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Logs session timeout
 * @param {string} sessionId - Session identifier
 */
function logSessionTimeout(sessionId) {
  logger.warn('Session timeout', {
    sessionId,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Logs errors
 * @param {string} message - Error message
 * @param {Error} error - Error object
 */
function logError(message, error) {
  logger.error(message, {
    error: error.message,
    stack: error.stack,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Gets reply count for a session from logs
 * @param {string} sessionId - Session identifier
 * @returns {Promise<number>} Number of replies
 */
async function getReplyCount(sessionId) {
  try {
    const logFile = path.join(logsDir, 'combined.log');
    if (!fs.existsSync(logFile)) {
      return 0;
    }
    
    const logContent = fs.readFileSync(logFile, 'utf8').trim();
    if (!logContent) {
      return 0;
    }
    
    // Try to parse as JSON array first
    let entries = [];
    try {
      entries = JSON.parse(logContent);
      if (!Array.isArray(entries)) {
        // Fallback: try JSONL format (one JSON per line)
        const lines = logContent.split('\n').filter(line => line.trim());
        entries = lines.map(line => {
          try {
            return JSON.parse(line);
          } catch (e) {
            return null;
          }
        }).filter(e => e !== null);
      }
    } catch (e) {
      // Fallback: try JSONL format (one JSON per line)
      const lines = logContent.split('\n').filter(line => line.trim());
      entries = lines.map(line => {
        try {
          return JSON.parse(line);
        } catch (e) {
          return null;
        }
      }).filter(e => e !== null);
    }
    
    let count = 0;
    for (const entry of entries) {
      // Check if it's a WeChat reply for this session
      if (entry.message === 'WeChat reply received' && entry.sessionId === sessionId) {
        count++;
      }
      // Also check for WECHATY INCOMING logs
      if (entry.message === '[WECHATY INCOMING]' && entry.sessionId === sessionId) {
        count++;
      }
    }
    
    return count;
  } catch (error) {
    logger.error('Error reading reply count from logs', { error: error.message });
    return 0;
  }
}

/**
 * Gets all replies for a session from logs
 * @param {string} sessionId - Session identifier
 * @returns {Promise<Array>} Array of reply objects
 */
async function getRepliesFromLogs(sessionId) {
  try {
    const logFile = path.join(logsDir, 'combined.log');
    if (!fs.existsSync(logFile)) {
      return [];
    }
    
    const logContent = fs.readFileSync(logFile, 'utf8').trim();
    if (!logContent) {
      return [];
    }
    
    // Try to parse as JSON array first
    let entries = [];
    try {
      entries = JSON.parse(logContent);
      if (!Array.isArray(entries)) {
        // Fallback: try JSONL format (one JSON per line)
        const lines = logContent.split('\n').filter(line => line.trim());
        entries = lines.map(line => {
          try {
            return JSON.parse(line);
          } catch (e) {
            return null;
          }
        }).filter(e => e !== null);
      }
    } catch (e) {
      // Fallback: try JSONL format (one JSON per line)
      const lines = logContent.split('\n').filter(line => line.trim());
      entries = lines.map(line => {
        try {
          return JSON.parse(line);
        } catch (e) {
          return null;
        }
      }).filter(e => e !== null);
    }
    
    const replies = [];
    for (const logEntry of entries) {
      // Check for WeChat reply logs
      if (logEntry.message === 'WeChat reply received' && logEntry.sessionId === sessionId) {
        replies.push({
          groupId: logEntry.groupId,
          from: logEntry.from,
          text: logEntry.text,
          timestamp: logEntry.timestamp,
        });
      }
      
      // Also check for WECHATY INCOMING logs
      if (logEntry.message === '[WECHATY INCOMING]' && logEntry.sessionId === sessionId) {
        replies.push({
          groupId: logEntry.groupId || logEntry.groupId,
          from: logEntry.from,
          text: logEntry.message || logEntry.text,
          timestamp: logEntry.timestamp || logEntry.receivedAt,
        });
      }
    }
    
    return replies;
  } catch (error) {
    logger.error('Error reading replies from logs', { error: error.message });
    return [];
  }
}

module.exports = {
  logger,
  logWhatsAppMessage,
  logWeChatReply,
  logSessionCreated,
  logSessionCompleted,
  logSessionTimeout,
  logError,
  getReplyCount,
  getRepliesFromLogs,
};

