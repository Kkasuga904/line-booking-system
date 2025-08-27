/**
 * 最小限のLINE Webhook - 確実に動作する版
 */

export default async function handler(req, res) {
  console.log('=== Webhook Simple Start ===');
  console.log('Method:', req.method);
  console.log('Body:', JSON.stringify(req.body));
  
  // LINE Webhook検証用
  if (req.method === 'POST' && req.body?.events) {
    const event = req.body.events[0];
    
    if (event?.replyToken) {
      console.log('ReplyToken:', event.replyToken);
      console.log('Message:', event.message?.text);
      
      // すぐに返信を試みる（非同期にしない）
      const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
      
      if (token) {
        try {
          const response = await fetch('https://api.line.me/v2/bot/message/reply', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              replyToken: event.replyToken,
              messages: [{
                type: 'text',
                text: 'テスト返信: ' + (event.message?.text || 'メッセージなし')
              }]
            })
          });
          
          console.log('LINE API Response:', response.status);
          const result = await response.text();
          console.log('Result:', result);
          
        } catch (error) {
          console.error('Error:', error.message);
        }
      } else {
        console.error('No LINE TOKEN');
      }
    }
  }
  
  // 必ず200を返す
  res.status(200).json({ ok: true });
}