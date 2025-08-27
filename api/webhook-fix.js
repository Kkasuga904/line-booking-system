// Account 1 Webhook Handler - CommonJS Fix
// Version: 3.0.0
// Store ID: account-001

const https = require('https');

const WEBHOOK_VERSION = '3.0.0';
const STORE_ID = 'account-001';

// CommonJS export for Vercel
module.exports = async function handler(req, res) {
  console.log(`=== Account 1 Webhook v${WEBHOOK_VERSION} Start ===`);
  console.log('Store ID:', STORE_ID);
  console.log('Method:', req.method);
  
  // 即座に200を返す（LINE要件）
  res.status(200).end();
  
  // バックグラウンドで処理
  processWebhook(req.body).catch(err => {
    console.error('Background error:', err);
  });
};

async function processWebhook(body) {
  console.log('Processing webhook...');
  
  if (!body || !body.events || body.events.length === 0) {
    console.log('No events in body');
    return;
  }
  
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!token) {
    console.error('ERROR: LINE_CHANNEL_ACCESS_TOKEN not set!');
    return;
  }
  
  console.log('Token found, processing events...');
  
  for (const event of body.events) {
    console.log(`Event type: ${event.type}`);
    
    if (event.type === 'message' && event.message?.type === 'text') {
      const userMessage = event.message.text;
      const replyToken = event.replyToken;
      
      console.log(`Message: "${userMessage}"`);
      console.log(`Reply token: ${replyToken?.substring(0, 20)}...`);
      
      let replyText = '';
      
      if (userMessage.includes('予約')) {
        replyText = `📅 ご予約を承ります！\n\n下記リンクから詳細をご入力ください：\nhttps://liff.line.me/2008001308-gDrXL5Y1\n\n[Account 1 - ${STORE_ID}]`;
      } else if (userMessage.includes('キャンセル')) {
        replyText = `❌ 予約のキャンセルを承りました。\n\n[Account 1 - ${STORE_ID}]`;
      } else if (userMessage.includes('変更')) {
        replyText = `✏️ 予約の変更を承りました。\n\n[Account 1 - ${STORE_ID}]`;
      } else {
        replyText = `こんにちは！Account 1へようこそ。\n\n「予約」と入力して予約を開始してください。\n\n[Store: ${STORE_ID}]`;
      }
      
      await sendReply(replyToken, replyText, token);
    }
  }
}

function sendReply(replyToken, text, token) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({
      replyToken: replyToken,
      messages: [{
        type: 'text',
        text: text
      }]
    });
    
    const options = {
      hostname: 'api.line.me',
      port: 443,
      path: '/v2/bot/message/reply',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'Content-Length': Buffer.byteLength(data)
      }
    };
    
    console.log('Sending reply to LINE API...');
    
    const req = https.request(options, (res) => {
      let responseData = '';
      
      res.on('data', (chunk) => {
        responseData += chunk;
      });
      
      res.on('end', () => {
        console.log(`LINE Response: ${res.statusCode}`);
        if (res.statusCode === 200) {
          console.log('✅ Reply sent successfully!');
        } else {
          console.error('❌ Reply failed:', responseData);
        }
        resolve();
      });
    });
    
    req.on('error', (error) => {
      console.error('Request error:', error);
      reject(error);
    });
    
    req.write(data);
    req.end();
  });
}