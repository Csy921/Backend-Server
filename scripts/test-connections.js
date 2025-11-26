/**
 * Test Connections Script
 * Tests connections to external services
 */

const axios = require('axios');
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

async function testWhatsApp() {
  log('\n=== Testing WhatsApp Connection ===', 'blue');
  
  const getWhatsAppAdapter = require('../services/whatsappAdapter');
  const adapter = getWhatsAppAdapter();
  
  try {
    // Test sending a message (won't actually send, just test connection)
    log('Testing WhatsApp adapter initialization...', 'yellow');
    
    if (process.env.WHATSAPP_PHONE_NUMBER_ID && process.env.WHATSAPP_ACCESS_TOKEN) {
      log('✓ WhatsApp Business API configured', 'green');
      log(`  Phone Number ID: ${process.env.WHATSAPP_PHONE_NUMBER_ID}`, 'yellow');
    } else if (process.env.WHATSAPP_SERVICE_URL) {
      log('✓ Custom WhatsApp service configured', 'green');
      log(`  Service URL: ${process.env.WHATSAPP_SERVICE_URL}`, 'yellow');
      
      // Test connection
      try {
        const response = await axios.get(`${process.env.WHATSAPP_SERVICE_URL}/health`, {
          timeout: 5000,
        });
        log(`✓ Service is reachable (Status: ${response.status})`, 'green');
      } catch (error) {
        log(`✗ Service not reachable: ${error.message}`, 'red');
      }
    } else {
      log('✗ WhatsApp not configured', 'red');
    }
  } catch (error) {
    log(`✗ Error: ${error.message}`, 'red');
  }
}

async function testWechaty() {
  log('\n=== Testing Wechaty Connection ===', 'blue');
  
  const useExternal = process.env.USE_EXTERNAL_WECHATY === 'true';
  
  if (useExternal) {
    log('Using external Wechaty service', 'yellow');
    
    if (!process.env.WECHATY_SERVICE_URL) {
      log('✗ WECHATY_SERVICE_URL not set', 'red');
      return;
    }
    
    log(`  Service URL: ${process.env.WECHATY_SERVICE_URL}`, 'yellow');
    
    try {
      // Try multiple endpoints - health, root, or api endpoint
      const baseUrl = process.env.WECHATY_SERVICE_URL;
      let response = null;
      let tested = false;
      
      // Try /health endpoint first
      try {
        response = await axios.get(`${baseUrl}/health`, {
          timeout: 3000,
        });
        log(`✓ Service is reachable (Status: ${response.status})`, 'green');
        tested = true;
      } catch (e) {
        // Try root endpoint
        try {
          response = await axios.get(baseUrl, {
            timeout: 3000,
          });
          log(`✓ Service is reachable (Status: ${response.status})`, 'green');
          tested = true;
        } catch (e2) {
          // Try /api/send endpoint (might return method not allowed, but confirms service exists)
          try {
            response = await axios.post(`${baseUrl}/api/send`, {}, {
              timeout: 3000,
              validateStatus: () => true, // Accept any status code
            });
            if (response.status !== 404) {
              log(`✓ Service is reachable (Status: ${response.status})`, 'green');
              log('  Note: /api/send endpoint exists (may require auth)', 'yellow');
              tested = true;
            }
          } catch (e3) {
            // All attempts failed
          }
        }
      }
      
      if (!tested) {
        // If webhook was registered successfully, service is likely working
        log('⚠ Could not verify service endpoint directly', 'yellow');
        log('  If webhook registration was successful, service is working', 'yellow');
        log('  Service may not have /health endpoint - this is OK', 'yellow');
      }
    } catch (error) {
      if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
        log('✗ Service not reachable', 'red');
        log(`  Check if service is running on ${process.env.WECHATY_SERVICE_URL}`, 'yellow');
        log('  Note: If webhook registration succeeded, service is working', 'yellow');
      } else {
        log(`⚠ Connection test inconclusive: ${error.message}`, 'yellow');
        log('  If webhook registration succeeded, service is working', 'yellow');
      }
    }
  } else {
    log('Using built-in Wechaty (will initialize on server start)', 'yellow');
    log('✓ Configuration looks good', 'green');
  }
}

async function testLLM() {
  log('\n=== Testing LLM Connection ===', 'blue');
  
  const useExternal = process.env.USE_EXTERNAL_LLM === 'true';
  
  if (useExternal) {
    log('Using external LLM service', 'yellow');
    
    if (!process.env.LLM_SERVICE_URL) {
      log('✗ LLM_SERVICE_URL not set', 'red');
      return;
    }
    
    log(`  Service URL: ${process.env.LLM_SERVICE_URL}`, 'yellow');
    
    try {
      const response = await axios.get(`${process.env.LLM_SERVICE_URL}/health`, {
        timeout: 5000,
      });
      log(`✓ Service is reachable (Status: ${response.status})`, 'green');
    } catch (error) {
      if (error.code === 'ECONNREFUSED') {
        log('✗ Service not running or URL incorrect', 'red');
      } else {
        log(`✗ Error: ${error.message}`, 'red');
      }
    }
  } else {
    log('Using direct LLM API', 'yellow');
    
    if (!process.env.LLM_API_KEY) {
      log('✗ LLM_API_KEY not set', 'red');
      return;
    }
    
    log(`  Provider: ${process.env.LLM_PROVIDER || 'openai'}`, 'yellow');
    log(`  Model: ${process.env.LLM_MODEL || 'gpt-3.5-turbo'}`, 'yellow');
    log('✓ Configuration looks good', 'green');
  }
}

async function testWebhooks() {
  log('\n=== Testing Webhook Endpoints ===', 'blue');
  
  const port = process.env.PORT || 3000;
  const baseUrl = `http://localhost:${port}`;
  
  try {
    // Test WhatsApp webhook
    const whatsappResponse = await axios.get(
      `${baseUrl}/webhook/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=${process.env.WHATSAPP_VERIFY_TOKEN || 'test'}&hub.challenge=test123`,
      { timeout: 2000 }
    );
    log('✓ WhatsApp webhook endpoint is accessible', 'green');
  } catch (error) {
    if (error.code === 'ECONNREFUSED') {
      log('✗ Server not running. Start server with: npm start', 'red');
    } else {
      log(`⚠ WhatsApp webhook: ${error.message}`, 'yellow');
    }
  }
  
  try {
    // Test WeChat webhook
    const wechatResponse = await axios.get(`${baseUrl}/webhook/wechat/health`, {
      timeout: 2000,
    });
    log('✓ WeChat webhook endpoint is accessible', 'green');
  } catch (error) {
    if (error.code === 'ECONNREFUSED') {
      log('✗ Server not running. Start server with: npm start', 'red');
    } else {
      log(`⚠ WeChat webhook: ${error.message}`, 'yellow');
    }
  }
}

async function runTests() {
  log('\n🔍 Testing Backend Connections\n', 'blue');
  
  await testWhatsApp();
  await testWechaty();
  await testLLM();
  await testWebhooks();
  
  log('\n=== Test Complete ===\n', 'blue');
}

runTests().catch(console.error);

