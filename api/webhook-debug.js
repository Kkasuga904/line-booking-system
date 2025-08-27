// Debug webhook with detailed logging
const https = require('https');

module.exports = async function handler(req, res) {
  const debugInfo = {
    timestamp: new Date().toISOString(),
    hasToken: !!process.env.LINE_CHANNEL_ACCESS_TOKEN,
    tokenLength: process.env.LINE_CHANNEL_ACCESS_TOKEN ? process.env.LINE_CHANNEL_ACCESS_TOKEN.length : 0,
    method: req.method,
    bodyExists: !!req.body,
    eventsCount: req.body?.events?.length || 0
  };
  
  console.log('=== WEBHOOK DEBUG START ===');
  console.log(JSON.stringify(debugInfo, null, 2));
  
  // 即座に200を返す
  res.status(200).json({ debug: debugInfo });
  
  if (!process.env.LINE_CHANNEL_ACCESS_TOKEN) {
    console.error('CRITICAL: LINE_CHANNEL_ACCESS_TOKEN is not set in environment variables!');
    console.error('Please set it in Vercel Dashboard > Settings > Environment Variables');
    return;
  }
  
  if (req.body?.events?.[0]) {
    const event = req.body.events[0];
    console.log('Processing event:', event.type);
    
    if (event.type === 'message' && event.replyToken) {
      console.log('Attempting to send reply...');
      
      const data = JSON.stringify({
        replyToken: event.replyToken,
        messages: [{
          type: 'text',
          text: `Debug response from Account 1\nToken exists: ${!!process.env.LINE_CHANNEL_ACCESS_TOKEN}\nTimestamp: ${new Date().toISOString()}`
        }]
      });
      
      const options = {
        hostname: 'api.line.me',
        port: 443,
        path: '/v2/bot/message/reply',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}`,
          'Content-Length': Buffer.byteLength(data)
        }
      };
      
      const req = https.request(options, (res) => {
        console.log('LINE API Response Status:', res.statusCode);
        
        let responseData = '';
        res.on('data', (chunk) => {
          responseData += chunk;
        });
        
        res.on('end', () => {
          console.log('LINE API Response:', responseData);
        });
      });
      
      req.on('error', (error) => {
        console.error('HTTPS Request Error:', error);
      });
      
      req.write(data);
      req.end();
    }
  }
  
  console.log('=== WEBHOOK DEBUG END ===');
};// Force rebuild Wed, Aug 27, 2025  8:02:06 PM
