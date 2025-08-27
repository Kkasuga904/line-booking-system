/**
 * LINE Webhook Handler - ES Module版 (最終修正版)
 * POST /api/webhook-new
 */

const WEBHOOK_VERSION = '2.0.1';

export default async function handler(req, res) {
  console.log(`=== Webhook v${WEBHOOK_VERSION} Start ===`);
  
  // 即座に200を返す（重要！）
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
      
      const messageText = event.message.text.toLowerCase();
      let replyText = '';
      
      if (messageText.includes('予約')) {
        replyText = `ご予約はこちらから：\nhttps://liff.line.me/2006487876-xd1A5qJB\n\nまたは以下のリンクから：\nhttps://line-booking-system-seven.vercel.app/`;
      } else if (messageText.includes('確認') || messageText.includes('変更') || messageText.includes('キャンセル')) {
        replyText = '予約の確認・変更・キャンセルはこちら：\nhttps://line-booking-system-seven.vercel.app/manage';
      } else {
        replyText = `メッセージありがとうございます！\n\n【ご予約】\nhttps://liff.line.me/2006487876-xd1A5qJB\n\n【予約確認・変更】\nhttps://line-booking-system-seven.vercel.app/manage\n\nお気軽にご利用ください。`;
      }
      
      await sendReplyWithFetch(event.replyToken, replyText);
    }
    
    if (event.type === 'follow') {
      console.log('New follower:', event.source?.userId);
      const welcomeText = `友だち追加ありがとうございます！\n\n【ご予約はこちら】\nhttps://liff.line.me/2006487876-xd1A5qJB\n\n予約の確認・変更・キャンセルも承っております。`;
      await sendReplyWithFetch(event.replyToken, welcomeText);
    }
    
  } catch (err) {
    console.error('Process error:', err);
  }
}

// Fetchを使用したLINE返信（ES Module対応）
async function sendReplyWithFetch(replyToken, text) {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!token) {
    console.error('NO LINE TOKEN!');
    return;
  }
  
  console.log('Token found, sending reply with fetch...');
  
  const payload = {
    replyToken: replyToken,
    messages: [{
      type: 'text',
      text: text
    }]
  };
  
  try {
    const response = await fetch('https://api.line.me/v2/bot/message/reply', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });
    
    console.log('LINE Response Status:', response.status);
    
    if (response.ok) {
      console.log('✅ Reply sent successfully with fetch!');
    } else {
      const errorText = await response.text();
      console.error('❌ LINE API Error:', response.status);
      console.error('Response:', errorText);
    }
    
  } catch (error) {
    console.error('❌ Fetch Error:', error.message);
    // フォールバック: Node.js httpsモジュールを試す
    console.log('🔄 Falling back to HTTPS module...');
    await sendReplyWithHttps(replyToken, text);
  }
}

// HTTPS モジュールを使ったフォールバック（ES Module対応）
async function sendReplyWithHttps(replyToken, text) {
  return new Promise(async (resolve, reject) => {
    const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
    if (!token) {
      console.error('NO TOKEN for HTTPS fallback!');
      resolve();
      return;
    }
    
    // ES Moduleで動的import
    const https = await import('https');
    
    const postData = JSON.stringify({
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
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };
    
    console.log('Sending HTTPS request (fallback)...');
    
    const req = https.default.request(options, (res) => {
      console.log('HTTPS Response Status:', res.statusCode);
      
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        if (res.statusCode === 200) {
          console.log('✅ HTTPS fallback success!');
          resolve();
        } else {
          console.error('❌ HTTPS API Error:', res.statusCode, data);
          resolve(); // エラーでも解決して続行
        }
      });
    });
    
    req.on('error', (e) => {
      console.error('HTTPS Request error:', e.message);
      resolve(); // エラーでも解決して続行
    });
    
    req.write(postData);
    req.end();
  });
}