/**
 * Setup Connection Script
 * Interactive script to help configure connections to external services
 */

const readline = require('readline');
const fs = require('fs');
const path = require('path');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

async function setupConnection() {
  console.log('\n=== Backend Connection Setup ===\n');
  
  const envPath = path.join(__dirname, '../.env');
  let envContent = '';
  
  // Read existing .env if it exists
  if (fs.existsSync(envPath)) {
    envContent = fs.readFileSync(envPath, 'utf8');
  }

  console.log('Step 1: WhatsApp Configuration\n');
  const whatsappType = await question('Use WhatsApp Business API? (y/n): ');
  
  if (whatsappType.toLowerCase() === 'y') {
    const phoneNumberId = await question('WhatsApp Phone Number ID: ');
    const accessToken = await question('WhatsApp Access Token: ');
    const verifyToken = await question('WhatsApp Verify Token: ');
    
    envContent += `\n# WhatsApp Business API\n`;
    envContent += `WHATSAPP_PHONE_NUMBER_ID=${phoneNumberId}\n`;
    envContent += `WHATSAPP_ACCESS_TOKEN=${accessToken}\n`;
    envContent += `WHATSAPP_VERIFY_TOKEN=${verifyToken}\n`;
  } else {
    const serviceUrl = await question('WhatsApp Service URL (e.g., http://localhost:3001): ');
    const apiKey = await question('WhatsApp Service API Key: ');
    
    envContent += `\n# Custom WhatsApp Service\n`;
    envContent += `WHATSAPP_SERVICE_URL=${serviceUrl}\n`;
    envContent += `WHATSAPP_API_KEY=${apiKey}\n`;
  }

  console.log('\nStep 2: Wechaty Configuration\n');
  const useExternalWechaty = await question('Use external Wechaty service? (y/n): ');
  
  if (useExternalWechaty.toLowerCase() === 'y') {
    const serviceUrl = await question('Wechaty Service URL (e.g., http://localhost:3002): ');
    const apiKey = await question('Wechaty Service API Key: ');
    const webhookUrl = await question('Webhook URL (this backend URL where Wechaty should send messages, e.g., http://localhost:3000/webhook/wechat/webhook): ') || 'http://localhost:3000/webhook/wechat/webhook';
    
    envContent += `\n# External Wechaty Service\n`;
    envContent += `USE_EXTERNAL_WECHATY=true\n`;
    envContent += `WECHATY_SERVICE_URL=${serviceUrl}\n`;
    envContent += `WECHATY_API_KEY=${apiKey}\n`;
    envContent += `WEBHOOK_URL=${webhookUrl}\n`;
  } else {
    envContent += `\n# Built-in Wechaty\n`;
    envContent += `USE_EXTERNAL_WECHATY=false\n`;
    envContent += `WECHATY_PUPPET=wechaty-puppet-wechat\n`;
    envContent += `WECHATY_NAME=automation-bot\n`;
  }

  console.log('\nStep 3: LLM Configuration (Optional - can skip)\n');
  const configureLLM = await question('Configure LLM service? (y/n, default: n): ') || 'n';
  
  if (configureLLM.toLowerCase() === 'y') {
    const useExternalLLM = await question('Use external LLM service? (y/n): ');
    
    if (useExternalLLM.toLowerCase() === 'y') {
      const serviceUrl = await question('LLM Service URL (e.g., http://localhost:3003): ');
      const apiKey = await question('LLM Service API Key: ');
      
      envContent += `\n# External LLM Service\n`;
      envContent += `USE_EXTERNAL_LLM=true\n`;
      envContent += `LLM_SERVICE_URL=${serviceUrl}\n`;
      envContent += `LLM_API_KEY=${apiKey}\n`;
    } else {
      const provider = await question('LLM Provider (openai/anthropic/etc): ') || 'openai';
      const apiKey = await question('LLM API Key: ');
      const model = await question('LLM Model (default: gpt-3.5-turbo): ') || 'gpt-3.5-turbo';
      
      envContent += `\n# Direct LLM API\n`;
      envContent += `USE_EXTERNAL_LLM=false\n`;
      envContent += `LLM_PROVIDER=${provider}\n`;
      envContent += `LLM_API_KEY=${apiKey}\n`;
      envContent += `LLM_MODEL=${model}\n`;
      envContent += `LLM_API_URL=https://api.openai.com/v1/chat/completions\n`;
    }
  } else {
    envContent += `\n# LLM Configuration - Skipped (Optional)\n`;
    envContent += `# System will use rule-based category extraction and simple reply formatting\n`;
    envContent += `# Configure LLM later by adding LLM_API_KEY and related settings\n`;
  }

  console.log('\nStep 4: Server Configuration\n');
  const port = await question('Server Port (default: 3000): ') || '3000';
  
  envContent += `\n# Server\n`;
  envContent += `PORT=${port}\n`;
  envContent += `LOG_LEVEL=info\n`;

  // Write .env file
  fs.writeFileSync(envPath, envContent);
  console.log('\n✓ Configuration saved to .env file');
  console.log('\nNext steps:');
  console.log('1. Review and update adapter files if needed');
  console.log('2. Update data/routingRules.json with real WeChat group IDs');
  console.log('3. Run: npm start');
  
  rl.close();
}

setupConnection().catch(console.error);

