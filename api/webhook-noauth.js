// 署名検証なしのテスト版
module.exports = async function handler(req, res) {
  console.log('Webhook called:', req.method);
  console.log('Body:', JSON.stringify(req.body));
  
  // CORS対応
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Line-Signature');
    return res.status(200).end();
  }

  // GETリクエスト（ヘルスチェック）
  if (req.method === 'GET') {
    return res.status(200).json({ 
      status: 'ok', 
      message: 'Webhook (no auth) is working',
      env: {
        hasAccessToken: !!process.env.LINE_CHANNEL_ACCESS_TOKEN,
        hasSecret: !!process.env.LINE_CHANNEL_SECRET
      }
    });
  }

  // POSTリクエスト（Webhook）
  if (req.method === 'POST') {
    const accessToken = process.env.LINE_CHANNEL_ACCESS_TOKEN;
    
    if (!accessToken) {
      console.error('No access token');
      return res.status(200).json({ 
        success: true,
        warning: 'No access token configured'
      });
    }
    
    try {
      const events = req.body.events || [];
      console.log('Events:', events.length);
      
      for (const event of events) {
        console.log('Event type:', event.type);
        
        if (event.type === 'message' && event.message.type === 'text') {
          const text = event.message.text;
          console.log('Text message:', text);
          
          // シンプルなリプライ
          let replyText = 'メッセージを受信しました: ' + text;
          
          if (text.includes('予約')) {
            replyText = '予約機能のテストです。\n\nメニュー:\n1. カット (3,500円)\n2. カラー (7,000円)\n3. パーマ (8,000円)';
          } else if (text.includes('ヘルプ')) {
            replyText = '使い方:\n「予約」→ 新規予約\n「予約確認」→ 予約の確認\n「キャンセル」→ 予約取消';
          }
          
          // LINE APIでリプライ
          const replyBody = JSON.stringify({
            replyToken: event.replyToken,
            messages: [{
              type: 'text',
              text: replyText
            }]
          });
          
          console.log('Sending reply:', replyBody);
          
          const response = await fetch('https://api.line.me/v2/bot/message/reply', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${accessToken}`
            },
            body: replyBody
          });
          
          const result = await response.text();
          console.log('LINE API response:', response.status, result);
        }
      }
      
      return res.status(200).json({ success: true });
    } catch (error) {
      console.error('Error:', error);
      return res.status(200).json({ 
        success: true,
        error: error.message 
      });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
};