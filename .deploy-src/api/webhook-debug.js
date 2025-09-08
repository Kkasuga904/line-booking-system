// デバッグ版 Webhook - 詳細なログ出力
export default async function handler(req, res) {
  const startTime = Date.now();
  
  // すべての受信データをログ
  console.log('=== WEBHOOK DEBUG START ===');
  console.log('Time:', new Date().toISOString());
  console.log('Method:', req.method);
  console.log('Headers:', JSON.stringify(req.headers, null, 2));
  console.log('Body:', JSON.stringify(req.body, null, 2));
  console.log('Query:', JSON.stringify(req.query, null, 2));
  
  // 環境変数チェック
  const envCheck = {
    LINE_CHANNEL_ACCESS_TOKEN: !!process.env.LINE_CHANNEL_ACCESS_TOKEN,
    LINE_CHANNEL_SECRET: !!process.env.LINE_CHANNEL_SECRET,
    LIFF_ID: process.env.LIFF_ID,
    STORE_ID: process.env.STORE_ID
  };
  console.log('Environment Check:', envCheck);
  
  // GETリクエスト（ヘルスチェック）
  if (req.method === 'GET') {
    return res.status(200).json({
      status: 'ok',
      webhook: 'debug-mode',
      env: envCheck,
      timestamp: new Date().toISOString()
    });
  }
  
  // POSTリクエスト（LINE Webhook）
  if (req.method === 'POST') {
    try {
      const events = req.body?.events || [];
      console.log(`Processing ${events.length} events`);
      
      for (const event of events) {
        console.log('Event Type:', event.type);
        console.log('Reply Token:', event.replyToken);
        
        if (event.type === 'message' && event.message?.type === 'text' && event.replyToken) {
          const userMessage = event.message.text;
          console.log('User Message:', userMessage);
          
          // アクセストークン確認
          const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
          if (!token) {
            console.error('CRITICAL: No LINE_CHANNEL_ACCESS_TOKEN');
            continue;
          }
          
          console.log('Token exists, length:', token.length);
          console.log('Token preview:', token.substring(0, 20) + '...');
          
          // 返信メッセージ作成
          const replyMessage = {
            type: 'text',
            text: `デバッグモード: "${userMessage}" を受信しました\n\n環境変数:\n` +
                  `TOKEN: ${token ? '✅設定済み' : '❌未設定'}\n` +
                  `LIFF_ID: ${process.env.LIFF_ID || '未設定'}\n` +
                  `STORE_ID: ${process.env.STORE_ID || '未設定'}\n` +
                  `\n時刻: ${new Date().toLocaleString('ja-JP')}`
          };
          
          // LINE API呼び出し
          console.log('Calling LINE Reply API...');
          const apiUrl = 'https://api.line.me/v2/bot/message/reply';
          
          const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              replyToken: event.replyToken,
              messages: [replyMessage]
            })
          });
          
          const responseText = await response.text();
          console.log('LINE API Response Status:', response.status);
          console.log('LINE API Response Headers:', JSON.stringify(Object.fromEntries(response.headers.entries()), null, 2));
          console.log('LINE API Response Body:', responseText);
          
          if (!response.ok) {
            console.error('LINE API Error:', {
              status: response.status,
              statusText: response.statusText,
              body: responseText
            });
          } else {
            console.log('✅ Reply sent successfully');
          }
        }
      }
      
      // 処理時間記録
      const processingTime = Date.now() - startTime;
      console.log(`Processing completed in ${processingTime}ms`);
      console.log('=== WEBHOOK DEBUG END ===');
      
      // 必ず200を返す（LINEプラットフォーム要件）
      return res.status(200).json({
        ok: true,
        processed: events.length,
        time: processingTime
      });
      
    } catch (error) {
      console.error('Fatal Error:', {
        name: error.name,
        message: error.message,
        stack: error.stack
      });
      
      // エラーでも200を返す
      return res.status(200).json({
        ok: false,
        error: error.message
      });
    }
  }
  
  // その他のメソッド
  return res.status(405).json({
    error: 'Method not allowed'
  });
}