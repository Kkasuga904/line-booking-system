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
                text: `友だち追加ありがとうございます！🎉\n\n当店のLINE予約システムへようこそ！\n\n📅 ご予約はいつでも可能です\n💬 「予約」と送信してください\n\n【営業時間】\n平日: 10:00～20:00\n土日祝: 10:00～19:00\n\nご利用お待ちしております！`
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
          replyText = `📅 ご予約はこちらから\n\n▼ Web予約フォーム\nhttps://line-booking-system-seven.vercel.app/\n\n▼ 管理画面\nhttps://line-booking-system-seven.vercel.app/admin-calendar\n\n営業時間: 10:00-20:00\nお気軽にご予約ください！`;
        } else if (userMessage.includes('確認') || userMessage.includes('変更') || userMessage.includes('キャンセル')) {
          replyText = `📋 予約の確認・変更・キャンセル\n\n以下のリンクから手続きできます：\nhttps://line-booking-system-seven.vercel.app/\n\nご不明な点がございましたら、お電話でもお問い合わせください。`;
        } else if (userMessage.includes('営業') || userMessage.includes('時間')) {
          replyText = `🕐 営業時間のご案内\n\n平日: 10:00～20:00\n土日祝: 10:00～19:00\n定休日: 毎週水曜日\n\nご来店お待ちしております！`;
        } else if (userMessage.includes('場所') || userMessage.includes('アクセス') || userMessage.includes('住所')) {
          replyText = `📍 アクセス情報\n\n東京都渋谷区〇〇1-2-3\nABCビル 5F\n\n▼ 最寄り駅\n・渋谷駅 徒歩5分\n・表参道駅 徒歩8分\n\nGoogle Maps:\nhttps://maps.google.com/`;
        } else {
          replyText = `こんにちは！ご連絡ありがとうございます😊\n\n【よくあるご質問】\n\n📅 予約 → 「予約」と送信\n📋 予約確認 → 「確認」と送信\n🕐 営業時間 → 「営業時間」と送信\n📍 アクセス → 「場所」と送信\n\nその他のお問い合わせは、お電話でも承っております。\n☎️ 03-xxxx-xxxx`;
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