/**
 * View Logs Script
 * Pretty-prints JSON log files for easy reading
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function formatLogEntry(entry) {
  if (!entry || typeof entry !== 'object') return entry;
  
  const level = entry.level || 'info';
  const timestamp = entry.timestamp || entry.time || '';
  const message = entry.message || '';
  
  let color = 'reset';
  if (level.includes('error')) color = 'red';
  else if (level.includes('warn')) color = 'yellow';
  else if (level.includes('info')) color = 'green';
  else if (level.includes('debug')) color = 'cyan';
  
  const levelColor = colors[color] || '';
  const reset = colors.reset;
  
  let output = `${levelColor}[${level.toUpperCase()}]${reset} ${timestamp} ${message}\n`;
  
  // Add metadata
  const meta = { ...entry };
  delete meta.level;
  delete meta.timestamp;
  delete meta.time;
  delete meta.message;
  delete meta.service;
  
  if (Object.keys(meta).length > 0) {
    output += `  ${JSON.stringify(meta, null, 2).split('\n').join('\n  ')}\n`;
  }
  
  return output;
}

function viewLogFile(filePath, filter = null, tail = false) {
  try {
    if (!fs.existsSync(filePath)) {
      log(`✗ Log file not found: ${filePath}`, 'red');
      return;
    }
    
    const content = fs.readFileSync(filePath, 'utf8').trim();
    if (!content) {
      log(`\n📄 Viewing: ${path.basename(filePath)}`, 'blue');
      log(`   No entries found\n`, 'yellow');
      return;
    }
    
    log(`\n📄 Viewing: ${path.basename(filePath)}`, 'blue');
    
    let entries = [];
    // Try to parse as JSON array first
    try {
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed)) {
        entries = parsed;
        log(`   Format: JSON Array`, 'cyan');
      } else {
        // Single object, wrap in array
        entries = [parsed];
        log(`   Format: Single JSON Object`, 'cyan');
      }
    } catch (e) {
      // Fallback: try JSONL format (one JSON per line)
      const lines = content.split('\n').filter(line => line.trim());
      log(`   Format: JSONL (one JSON per line)`, 'cyan');
      for (const line of lines) {
        try {
          const entry = JSON.parse(line);
          entries.push(entry);
        } catch (err) {
          // Skip invalid JSON lines
        }
      }
    }
    
    log(`   Total entries: ${entries.length}\n`, 'yellow');
    
    // Apply filter
    if (filter) {
      entries = entries.filter(entry => {
        const entryStr = JSON.stringify(entry).toLowerCase();
        return entryStr.includes(filter.toLowerCase());
      });
      log(`   Filtered entries: ${entries.length}\n`, 'yellow');
    }
    
    // Show last N entries if tail mode
    if (tail && entries.length > 20) {
      entries = entries.slice(-20);
      log(`   Showing last 20 entries\n`, 'yellow');
    }
    
    // Display entries
    entries.forEach(entry => {
      const formatted = formatLogEntry(entry);
      process.stdout.write(formatted);
    });
    
    log(`\n✓ Displayed ${entries.length} log entries`, 'green');
    
  } catch (error) {
    log(`✗ Error reading log file: ${error.message}`, 'red');
  }
}

function viewLogsRealtime(filePath, filter = null) {
  try {
    if (!fs.existsSync(filePath)) {
      log(`✗ Log file not found: ${filePath}`, 'red');
      return;
    }
    
    log(`\n👀 Watching: ${path.basename(filePath)} (Press Ctrl+C to stop)\n`, 'blue');
    log(`   Note: Real-time watching works best with JSON array format\n`, 'yellow');
    
    let lastSize = 0;
    const checkInterval = setInterval(() => {
      try {
        const stats = fs.statSync(filePath);
        if (stats.size > lastSize) {
          // File has grown, read new content
          const content = fs.readFileSync(filePath, 'utf8').trim();
          if (content) {
            try {
              const entries = JSON.parse(content);
              if (Array.isArray(entries)) {
                // Show only new entries
                const newEntries = entries.slice(lastSize === 0 ? 0 : entries.length - 1);
                newEntries.forEach(entry => {
                  if (filter) {
                    const entryStr = JSON.stringify(entry).toLowerCase();
                    if (!entryStr.includes(filter.toLowerCase())) return;
                  }
                  const formatted = formatLogEntry(entry);
                  process.stdout.write(formatted);
                });
                lastSize = stats.size;
              }
            } catch (e) {
              // If not JSON array, fallback to tail approach
              const readStream = fs.createReadStream(filePath, { 
                encoding: 'utf8',
                start: lastSize 
              });
              let buffer = '';
              
              readStream.on('data', (chunk) => {
                buffer += chunk;
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';
                
                lines.forEach(line => {
                  if (!line.trim()) return;
                  try {
                    const entry = JSON.parse(line);
                    if (filter) {
                      const entryStr = JSON.stringify(entry).toLowerCase();
                      if (!entryStr.includes(filter.toLowerCase())) return;
                    }
                    const formatted = formatLogEntry(entry);
                    process.stdout.write(formatted);
                  } catch (err) {
                    // Skip invalid JSON
                  }
                });
              });
              
              readStream.on('end', () => {
                lastSize = stats.size;
              });
            }
          }
        }
      } catch (error) {
        // File might be locked or deleted
      }
    }, 1000); // Check every second
    
    // Handle Ctrl+C
    process.on('SIGINT', () => {
      clearInterval(checkInterval);
      log(`\n\n✓ Stopped watching`, 'green');
      process.exit(0);
    });
    
  } catch (error) {
    log(`✗ Error watching log file: ${error.message}`, 'red');
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
const logsDir = path.join(__dirname, '../logs');

let logFile = 'combined.log';
let filter = null;
let tail = false;
let watch = false;

args.forEach((arg, index) => {
  if (arg === '--file' || arg === '-f') {
    logFile = args[index + 1] || 'combined.log';
  } else if (arg === '--filter' || arg === '-g') {
    filter = args[index + 1];
  } else if (arg === '--tail' || arg === '-t') {
    tail = true;
  } else if (arg === '--watch' || arg === '-w') {
    watch = true;
  } else if (arg === '--help' || arg === '-h') {
    console.log(`
Usage: node scripts/view-logs.js [options]

Options:
  -f, --file <file>    Log file to view (default: combined.log)
  -g, --filter <text>  Filter logs by text
  -t, --tail           Show last 20 entries only
  -w, --watch          Watch log file in real-time
  -h, --help           Show this help

Examples:
  node scripts/view-logs.js
  node scripts/view-logs.js --file error.log
  node scripts/view-logs.js --filter "WECHATY"
  node scripts/view-logs.js --tail
  node scripts/view-logs.js --watch
  node scripts/view-logs.js --filter "OUTGOING" --watch
    `);
    process.exit(0);
  }
});

const filePath = path.join(logsDir, logFile);

if (watch) {
  viewLogsRealtime(filePath, filter);
} else {
  viewLogFile(filePath, filter, tail);
}

