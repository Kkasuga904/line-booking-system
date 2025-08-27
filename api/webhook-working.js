// Working webhook with ES Module format
import https from 'https';

export default async function handler(req, res) {
  console.log('=== Webhook Working v1.0 ===');
  
  const debugInfo = {
    timestamp: new Date().toISOString(),
    hasToken: !!process.env.LINE_CHANNEL_ACCESS_TOKEN,
    tokenLength: process.env.LINE_CHANNEL_ACCESS_TOKEN ? process.env.LINE_CHANNEL_ACCESS_TOKEN.length : 0,
    method: req.method,
    bodyExists: !!req.body,
    eventsCount: req.body?.events?.length || 0
  };
  
  console.log('Debug info:', JSON.stringify(debugInfo, null, 2));
  
  // Return 200 immediately for LINE
  res.status(200).json({ status: 'ok', debug: debugInfo });
  
  // Process in background
  if (req.body?.events?.[0] && process.env.LINE_CHANNEL_ACCESS_TOKEN) {
    const event = req.body.events[0];
    
    if (event.type === 'message' && event.message?.type === 'text' && event.replyToken) {
      console.log('Sending reply for message:', event.message.text);
      
      const data = JSON.stringify({
        replyToken: event.replyToken,
        messages: [{
          type: 'text',
          text: `[Account 1] メッセージを受信しました: ${event.message.text}\nTimestamp: ${new Date().toISOString()}`
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
        let responseData = '';
        res.on('data', (chunk) => responseData += chunk);
        res.on('end', () => {
          console.log(`LINE API Response: ${res.statusCode}`, responseData);
        });
      });
      
      req.on('error', (error) => {
        console.error('HTTPS Error:', error);
      });
      
      req.write(data);
      req.end();
    }
  } else if (!process.env.LINE_CHANNEL_ACCESS_TOKEN) {
    console.error('CRITICAL: LINE_CHANNEL_ACCESS_TOKEN not set!');
  }
}