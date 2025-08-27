// Account 1 Simple Webhook with proper messages
export default async function handler(req, res) {
  console.log('=== Webhook Simple Start ===');
  console.log('Method:', req.method);
  console.log('Body:', JSON.stringify(req.body));
  
  // LINE Webhook検証用
  if (req.method === 'POST' && req.body?.events) {
    const event = req.body.events[0];
    
    // 友だち追加イベント
    if (event?.type === 'follow' && event?.replyToken) {
      const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
      if (token) {
        try {
          await fetch('https://api.line.me/v2/bot/message/reply', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              replyToken: event.replyToken,
              messages: [{
                type: 'text',
                text: `友だち追加ありがとうございます！\n\n【ご予約はこちら】\nhttps://liff.line.me/2006487876-xd1A5qJB\n\n予約の確認・変更・キャンセルも承っております。`
              }]
            })
          });
          console.log('Welcome message sent');
        } catch (error) {
          console.error('Welcome message error:', error);
        }
      }
    }
    
    // メッセージイベント
    if (event?.replyToken && event?.type === 'message') {
      console.log('ReplyToken:', event.replyToken);
      console.log('Message:', event.message?.text);
      
      // すぐに返信を試みる（非同期にしない）
      const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
      
      if (token && event.message?.text) {
        const userMessage = event.message.text.toLowerCase();
        let replyText = '';
        
        // メッセージ内容に応じた返信
        if (userMessage.includes('予約')) {
          replyText = `ご予約はこちらから：\nhttps://liff.line.me/2006487876-xd1A5qJB\n\nまたは以下のリンクから：\nhttps://line-booking-system-seven.vercel.app/`;
        } else if (userMessage.includes('確認') || userMessage.includes('変更') || userMessage.includes('キャンセル')) {
          replyText = `予約の確認・変更・キャンセルはこちら：\nhttps://line-booking-system-seven.vercel.app/manage`;
        } else {
          replyText = `メッセージありがとうございます！\n\n【ご予約】\nhttps://liff.line.me/2006487876-xd1A5qJB\n\n【予約確認・変更】\nhttps://line-booking-system-seven.vercel.app/manage\n\nお気軽にご利用ください。`;
        }
        
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
                text: replyText
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