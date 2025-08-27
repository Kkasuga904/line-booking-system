// LINE Webhook Handler - Version 1.0.8 - COMMONJS ONLY - FINAL FIX
// Deploy Date: 2025-08-27
// ⚠️ CRITICAL: DO NOT CHANGE TO ES MODULES - CAUSES FUNCTION_INVOCATION_FAILED
const https = require('https');

const WEBHOOK_VERSION = '1.0.8';
const DEPLOY_DATE = '2025-08-27';

// CommonJS export - DO NOT CHANGE
exports.default = async function handler(req, res) {
  console.log(`=== Account1 Webhook v${WEBHOOK_VERSION} Start ===`);
  
  // 即座に200を返す
  res.status(200).end();
  
  // バックグラウンド処理
  try {
    console.log('Body:', JSON.stringify(req.body));
    
    if (!req.body?.events?.[0]) {
      console.log('No events');
      return;
    }
    
    const event = req.body.events[0];
    
    if (event.type === 'message' && event.message?.type === 'text') {
      console.log('Message:', event.message.text);
      console.log('User:', event.source?.userId || 'unknown');
      
      const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
      if (!token) {
        console.error('NO TOKEN!');
        return;
      }
      
      console.log('Token found, sending reply...');
      
      const postData = JSON.stringify({
        replyToken: event.replyToken,
        messages: [{
          type: 'text',
          text: `メッセージありがとうございます！\n\n【ご予約】\nhttps://liff.line.me/2006487876-xd1A5qJB\n\n【予約確認・変更】\nhttps://line-booking-system-seven.vercel.app/manage\n\nお気軽にご利用ください。`
        }]
      });
      
      const options = {
        hostname: 'api.line.me',
        port: 443,
        path: '/v2/bot/message/reply',
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData)
        }
      };
      
      const req2 = https.request(options, (res2) => {
        console.log('LINE Response Status:', res2.statusCode);
        
        let data = '';
        res2.on('data', (chunk) => {
          data += chunk;
        });
        
        res2.on('end', () => {
          if (res2.statusCode === 200) {
            console.log('✅ SUCCESS!');
          } else {
            console.error('❌ ERROR:', res2.statusCode, data);
          }
        });
      });
      
      req2.on('error', (e) => {
        console.error('Request error:', e);
      });
      
      req2.write(postData);
      req2.end();
    }
    
  } catch (err) {
    console.error('Process error:', err);
  }
};