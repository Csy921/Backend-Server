/**
 * Test WeChat Webhook Endpoint
 * Tests if the backend is listening for POST requests at /webhook/wechat/webhook
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

const PORT = process.env.PORT || 3000;
const BASE_URL = `http://localhost:${PORT}`;
const WEBHOOK_URL = `${BASE_URL}/webhook/wechat/webhook`;

async function testServerHealth() {
  log('\n=== Testing Server Health ===', 'blue');
  
  try {
    const response = await axios.get(`${BASE_URL}/health`, {
      timeout: 2000,
    });
    
    if (response.status === 200) {
      log('✓ Server is running and healthy', 'green');
      log(`  Status: ${response.data.status}`, 'yellow');
      return true;
    }
  } catch (error) {
    if (error.code === 'ECONNREFUSED') {
      log('✗ Server is not running', 'red');
      log('  Start the server with: npm start', 'yellow');
    } else {
      log(`✗ Error: ${error.message}`, 'red');
    }
    return false;
  }
}

async function testWeChatWebhook() {
  log('\n=== Testing WeChat Webhook Endpoint ===', 'blue');
  log(`Endpoint: ${WEBHOOK_URL}`, 'yellow');
  
  const testMessage = {
    groupId: 'wxid_test_group_123',
    from: 'Test User',
    text: 'This is a test message',
    timestamp: new Date().toISOString(),
  };
  
  try {
    log('\nSending test message...', 'yellow');
    const response = await axios.post(WEBHOOK_URL, testMessage, {
      timeout: 5000,
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    if (response.status === 200) {
      log('✓ Webhook endpoint is working!', 'green');
      log(`  Status: ${response.status}`, 'yellow');
      log(`  Response: ${JSON.stringify(response.data)}`, 'yellow');
      return true;
    }
  } catch (error) {
    if (error.code === 'ECONNREFUSED') {
      log('✗ Server is not running', 'red');
      log('  Start the server with: npm start', 'yellow');
    } else if (error.response) {
      log(`✗ Server responded with error: ${error.response.status}`, 'red');
      log(`  Response: ${JSON.stringify(error.response.data)}`, 'yellow');
    } else {
      log(`✗ Error: ${error.message}`, 'red');
    }
    return false;
  }
}

async function testWeChatHealthEndpoint() {
  log('\n=== Testing WeChat Health Endpoint ===', 'blue');
  
  try {
    const response = await axios.get(`${BASE_URL}/webhook/wechat/health`, {
      timeout: 2000,
    });
    
    if (response.status === 200) {
      log('✓ WeChat health endpoint is working', 'green');
      log(`  Response: ${JSON.stringify(response.data)}`, 'yellow');
      return true;
    }
  } catch (error) {
    log(`⚠ WeChat health endpoint: ${error.message}`, 'yellow');
    return false;
  }
}

async function runTests() {
  log('\n🔍 Testing WeChat Webhook Configuration\n', 'blue');
  
  const healthOk = await testServerHealth();
  if (!healthOk) {
    log('\n⚠ Server is not running. Please start it first:', 'yellow');
    log('  npm start', 'yellow');
    return;
  }
  
  await testWeChatHealthEndpoint();
  await testWeChatWebhook();
  
  log('\n=== Test Complete ===', 'blue');
  log('\nIf all tests passed, your backend is ready to receive WeChat messages!', 'green');
  log(`\nConfigure your Wechaty service to send messages to:`, 'yellow');
  log(`  ${WEBHOOK_URL}`, 'blue');
  log('');
}

runTests().catch(console.error);

