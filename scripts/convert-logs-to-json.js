/**
 * Convert existing JSONL log files to JSON array format
 * This script converts logs from one JSON per line to a proper JSON array
 */

const fs = require('fs');
const path = require('path');

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function convertLogFile(filePath) {
  try {
    if (!fs.existsSync(filePath)) {
      log(`✗ File not found: ${filePath}`, 'red');
      return false;
    }

    log(`\n📄 Converting: ${path.basename(filePath)}`, 'blue');

    const content = fs.readFileSync(filePath, 'utf8').trim();
    if (!content) {
      log(`   File is empty, creating empty array`, 'yellow');
      fs.writeFileSync(filePath, '[]\n', 'utf8');
      return true;
    }

    // Check if already in JSON array format
    try {
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed)) {
        log(`   ✓ Already in JSON array format`, 'green');
        return true;
      }
    } catch (e) {
      // Not JSON array, continue with conversion
    }

    // Parse as JSONL (one JSON per line)
    const lines = content.split('\n').filter(line => line.trim());
    const entries = [];

    for (const line of lines) {
      try {
        const entry = JSON.parse(line);
        entries.push(entry);
      } catch (e) {
        log(`   ⚠ Skipping invalid JSON line: ${line.substring(0, 50)}...`, 'yellow');
      }
    }

    // Create backup
    const backupPath = filePath + '.backup';
    fs.copyFileSync(filePath, backupPath);
    log(`   ✓ Backup created: ${path.basename(backupPath)}`, 'cyan');

    // Write as JSON array
    fs.writeFileSync(filePath, JSON.stringify(entries, null, 2) + '\n', 'utf8');
    log(`   ✓ Converted ${entries.length} entries to JSON array format`, 'green');

    return true;
  } catch (error) {
    log(`✗ Error converting file: ${error.message}`, 'red');
    return false;
  }
}

// Main execution
const logsDir = path.join(__dirname, '../logs');
const args = process.argv.slice(2);

let filesToConvert = [];

if (args.length > 0) {
  // Convert specific files
  args.forEach(arg => {
    const filePath = path.isAbsolute(arg) ? arg : path.join(logsDir, arg);
    filesToConvert.push(filePath);
  });
} else {
  // Convert all log files
  if (fs.existsSync(logsDir)) {
    const files = fs.readdirSync(logsDir);
    files.forEach(file => {
      if (file.endsWith('.log') && !file.endsWith('.backup')) {
        filesToConvert.push(path.join(logsDir, file));
      }
    });
  }
}

if (filesToConvert.length === 0) {
  log('No log files found to convert', 'yellow');
  process.exit(0);
}

log(`\n🔄 Converting ${filesToConvert.length} log file(s) to JSON array format...`, 'blue');

let successCount = 0;
filesToConvert.forEach(file => {
  if (convertLogFile(file)) {
    successCount++;
  }
});

log(`\n✓ Conversion complete: ${successCount}/${filesToConvert.length} files converted`, 'green');
log(`\nNote: Backup files (.backup) were created. You can delete them after verifying the conversion.`, 'yellow');

