require('dotenv').config();

module.exports = {
  // Wechaty Puppet configuration
  puppet: process.env.WECHATY_PUPPET || 'wechaty-puppet-wechat',
  // WeChat session timeout (in milliseconds)
  sessionTimeout: 600000, // 10 minutes
  // Reply threshold
  replyThreshold: 3,
  // Maximum wait time in milliseconds (10 minutes)
  maxWaitTime: 600000,
  // Supplier groups mapping will be loaded from routingRules.json
  // This config can be extended with additional Wechaty settings
  name: process.env.WECHATY_NAME || 'automation-bot',
};

