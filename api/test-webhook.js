// Test webhook to check environment and configuration
module.exports = async function handler(req, res) {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  
  const result = {
    timestamp: new Date().toISOString(),
    environment: {
      hasToken: !!token,
      tokenLength: token ? token.length : 0,
      tokenPrefix: token ? token.substring(0, 10) + '...' : 'NO TOKEN',
      nodeVersion: process.version,
      platform: process.platform
    },
    request: {
      method: req.method,
      headers: req.headers,
      body: req.body
    }
  };
  
  console.log('Test webhook result:', JSON.stringify(result, null, 2));
  
  res.status(200).json(result);
};