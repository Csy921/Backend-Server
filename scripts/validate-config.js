/**
 * Validate Configuration Script
 * Checks if all required environment variables are set
 */

require('dotenv').config();

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

function checkRequired(envVar, description) {
  if (process.env[envVar]) {
    log(`✓ ${description}: Set`, 'green');
    return true;
  } else {
    log(`✗ ${description}: Missing (${envVar})`, 'red');
    return false;
  }
}

function validateConfig() {
  log('\n=== Configuration Validation ===\n', 'blue');
  
  let allValid = true;
  
  // Server config
  log('Server Configuration:', 'yellow');
  checkRequired('PORT', 'Port') || (process.env.PORT = '3000');
  
  // WhatsApp config
  log('\nWhatsApp Configuration:', 'yellow');
  const hasBusinessAPI = process.env.WHATSAPP_PHONE_NUMBER_ID && 
                         process.env.WHATSAPP_ACCESS_TOKEN;
  const hasCustomService = process.env.WHATSAPP_SERVICE_URL;
  
  if (hasBusinessAPI) {
    log('✓ Using WhatsApp Business API', 'green');
    checkRequired('WHATSAPP_VERIFY_TOKEN', 'Verify Token');
  } else if (hasCustomService) {
    log('✓ Using Custom WhatsApp Service', 'green');
    checkRequired('WHATSAPP_SERVICE_URL', 'Service URL');
    checkRequired('WHATSAPP_API_KEY', 'API Key');
  } else {
    log('✗ WhatsApp not configured', 'red');
    allValid = false;
  }
  
  // Wechaty config
  log('\nWechaty Configuration:', 'yellow');
  const useExternal = process.env.USE_EXTERNAL_WECHATY === 'true';
  
  if (useExternal) {
    log('✓ Using External Wechaty Service', 'green');
    if (!checkRequired('WECHATY_SERVICE_URL', 'Service URL')) allValid = false;
    if (!checkRequired('WECHATY_API_KEY', 'API Key')) allValid = false;
    if (!checkRequired('WEBHOOK_URL', 'Webhook URL')) allValid = false;
  } else {
    log('✓ Using Built-in Wechaty', 'green');
    log('  (Will require QR code scan on first start)', 'yellow');
  }
  
  // LLM config (optional)
  log('\nLLM Configuration (Optional):', 'yellow');
  const hasLLMConfig = process.env.LLM_API_KEY || process.env.LLM_SERVICE_URL;
  const useExternalLLM = process.env.USE_EXTERNAL_LLM === 'true';
  
  if (!hasLLMConfig) {
    log('⚠ LLM not configured (optional)', 'yellow');
    log('  System will use rule-based category extraction and simple reply formatting', 'yellow');
  } else if (useExternalLLM) {
    log('✓ Using External LLM Service', 'green');
    if (!checkRequired('LLM_SERVICE_URL', 'Service URL')) allValid = false;
    if (!checkRequired('LLM_API_KEY', 'API Key')) allValid = false;
  } else {
    log('✓ Using Direct LLM API', 'green');
    if (!checkRequired('LLM_API_KEY', 'API Key')) allValid = false;
    log(`  Provider: ${process.env.LLM_PROVIDER || 'openai'}`, 'yellow');
    log(`  Model: ${process.env.LLM_MODEL || 'gpt-3.5-turbo'}`, 'yellow');
  }
  
  // Routing rules
  log('\nRouting Configuration:', 'yellow');
  const fs = require('fs');
  const path = require('path');
  const routingRulesPath = path.join(__dirname, '../data/routingRules.json');
  
  if (fs.existsSync(routingRulesPath)) {
    try {
      const rules = JSON.parse(fs.readFileSync(routingRulesPath, 'utf8'));
      const categories = Object.keys(rules.categories || {});
      if (categories.length > 0) {
        log(`✓ Found ${categories.length} categories`, 'green');
        log(`  Categories: ${categories.join(', ')}`, 'yellow');
      } else {
        log('⚠ No categories defined in routingRules.json', 'yellow');
      }
    } catch (error) {
      log('✗ Error reading routingRules.json', 'red');
      allValid = false;
    }
  } else {
    log('✗ routingRules.json not found', 'red');
    allValid = false;
  }
  
  // Summary
  log('\n=== Validation Summary ===', 'blue');
  if (allValid) {
    log('✓ Configuration looks good!', 'green');
    log('\nNext steps:', 'yellow');
    log('1. Review adapter files if using external services');
    log('2. Update routingRules.json with real group IDs');
    log('3. Run: npm run test-connections');
    log('4. Start server: npm start');
  } else {
    log('✗ Configuration incomplete', 'red');
    log('\nPlease fix the missing configuration items above.', 'yellow');
    log('Run: npm run setup (to configure interactively)', 'yellow');
  }
  
  log('');
}

validateConfig();

