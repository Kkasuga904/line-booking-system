// 最小限のエコーボット（Next.js形式に修正）
export const config = { api: { bodyParser: true } };

export default async function handler(req, res) {
  // ログ出力
  console.log('=== WEBHOOK RECEIVED ===');
  console.log('Timestamp:', new Date().toISOString());
  console.log('Method:', req.method);
  console.log('URL:', req.url);
  console.log('Headers:', JSON.stringify(req.headers, null, 2));
  console.log('Body type:', typeof req.body);
  console.log('BODY:', JSON.stringify(req.body, null, 2));
  
  // 環境変数の確認
  console.log('Environment check:');
  console.log('- NODE_ENV:', process.env.NODE_ENV);
  console.log('- Has TOKEN:', !!process.env.LINE_CHANNEL_ACCESS_TOKEN);
  console.log('- Has SECRET:', !!process.env.LINE_CHANNEL_SECRET);
  
  // POSTメソッド以外は405を返す
  if (req.method !== 'POST') {
    return res.status(405).end();
  }
  
  // POSTリクエストの処理
  const TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  
  if (!TOKEN) {
    console.error('ERROR: No LINE_CHANNEL_ACCESS_TOKEN');
    return res.status(200).end();
  }
  
  console.log('Token exists:', TOKEN.substring(0, 10) + '...');
  
  try {
    const events = req.body?.events || [];
    console.log('Events count:', events.length);
    
    for (const event of events) {
      console.log('Processing event:', JSON.stringify(event, null, 2));
      
      // メッセージイベントのみ処理
      if (event.type === 'message' && 
          event.message?.type === 'text' && 
          event.replyToken) {
        
        const userMessage = event.message.text;
        console.log('User message:', userMessage);
        console.log('Reply token:', event.replyToken);
        console.log('Reply token length:', event.replyToken.length);
        
        // LINE APIにリプライを送信
        const replyData = {
          replyToken: event.replyToken,
          messages: [
            {
              type: 'text',
              text: `エコー: ${userMessage}`
            }
          ]
        };
        
        console.log('Sending reply:', JSON.stringify(replyData));
        
        const apiUrl = 'https://api.line.me/v2/bot/message/reply';
        console.log('API URL:', apiUrl);
        console.log('Authorization:', 'Bearer ' + TOKEN.substring(0, 10) + '...');
        
        const response = await fetch(apiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${TOKEN}`
          },
          body: JSON.stringify(replyData)
        });
        
        const responseText = await response.text();
        console.log('LINE API Status:', response.status);
        console.log('LINE API Response:', responseText);
        
        if (!response.ok) {
          console.error('LINE API Error:', response.status, responseText);
        } else {
          console.log('Reply sent successfully!');
        }
      }
    }
    
    console.log('=== WEBHOOK COMPLETED ===');
    return res.status(200).end();
    
  } catch (error) {
    console.error('ERROR:', error.message);
    console.error('Stack:', error.stack);
    // エラーでも200を返す（再配信ループ防止）
    return res.status(200).end();
  }
};