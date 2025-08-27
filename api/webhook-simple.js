// Account 1 Simple Webhook with proper messages and error prevention
export default async function handler(req, res) {
  const startTime = Date.now();
  console.log('=== Webhook Simple Start ===');
  console.log('Timestamp:', new Date().toISOString());
  console.log('Method:', req.method);
  console.log('Body:', JSON.stringify(req.body));
  
  // 環境変数チェック
  if (!process.env.LINE_CHANNEL_ACCESS_TOKEN) {
    console.error('CRITICAL: LINE_CHANNEL_ACCESS_TOKEN not configured');
  }
  
  // LINE Webhook検証用
  if (req.method === 'POST' && req.body?.events) {
    const event = req.body.events[0];
    
    // 友だち追加イベント
    if (event?.type === 'follow' && event?.replyToken) {
      const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
      const liffId = process.env.LIFF_ID || '***REMOVED-ROTATE-CREDENTIAL***';
      const liffUrl = `https://liff.line.me/${liffId}`;
      
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
                text: `友だち追加ありがとうございます！\n\n【ご予約はこちら】\n📱 LINE内で予約（おすすめ）\n${liffUrl}\n\n予約の確認・変更・キャンセルも承っております。`
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
        const liffId = process.env.LIFF_ID || '***REMOVED-ROTATE-CREDENTIAL***';
        const liffUrl = `https://liff.line.me/${liffId}`;
        
        if (userMessage.includes('予約')) {
          replyText = `ご予約はこちらから：\n\n📱 LINE内で予約（おすすめ）\n${liffUrl}\n\n🌐 ブラウザで予約\nhttps://line-booking-system-seven.vercel.app/liff-calendar`;
        } else if (userMessage.includes('確認') || userMessage.includes('変更') || userMessage.includes('キャンセル')) {
          replyText = `予約の確認・変更・キャンセル：\n\n📊 管理画面\nhttps://line-booking-system-seven.vercel.app/admin-calendar\n\n📋 予約一覧\nhttps://line-booking-system-seven.vercel.app/`;
        } else {
          replyText = `メッセージありがとうございます！\n\n【ご予約】\n📱 LINE内で予約\n${liffUrl}\n\n【予約管理】\n📊 管理画面\nhttps://line-booking-system-seven.vercel.app/admin-calendar\n\nお気軽にご利用ください。`;
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
          // エラー詳細をログ
          console.error('Error Details:', {
            type: error.constructor.name,
            message: error.message,
            stack: error.stack?.split('\n').slice(0, 3)
          });
        }
      } else {
        console.error('No LINE TOKEN');
      }
    }
  }
  
  // 処理時間を記録
  const processingTime = Date.now() - startTime;
  console.log(`Processing time: ${processingTime}ms`);
  
  // 必ず200を返す（重要：LINEは200を期待）
  res.status(200).json({ 
    ok: true,
    processingTime: processingTime,
    timestamp: new Date().toISOString()
  });
}