// デバッグ用Webhook - エラーの詳細を返す
let debugLog = [];

// LINE返信メッセージ送信
async function replyMessage(replyToken, messages) {
  const accessToken = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  debugLog.push(`Token exists: ${!!accessToken}`);
  
  if (!accessToken) {
    return { error: 'No token' };
  }
  
  try {
    const response = await fetch('https://api.line.me/v2/bot/message/reply', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      },
      body: JSON.stringify({
        replyToken: replyToken,
        messages: messages
      })
    });
    
    const result = await response.text();
    debugLog.push(`LINE API response: ${response.status} - ${result}`);
    return { status: response.status, result };
  } catch (error) {
    debugLog.push(`Reply error: ${error.message}`);
    return { error: error.message };
  }
}

// Supabase接続テスト
async function testSupabase() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;
  
  debugLog.push(`Supabase URL: ${url}`);
  debugLog.push(`Supabase key exists: ${!!key}`);
  
  if (!url || !key) {
    return { error: 'Missing Supabase credentials' };
  }
  
  try {
    // @supabase/supabase-jsを使わずに直接API呼び出し
    const response = await fetch(`${url}/rest/v1/reservations?limit=1`, {
      headers: {
        'apikey': key,
        'Authorization': `Bearer ${key}`
      }
    });
    
    const result = await response.text();
    debugLog.push(`Supabase test: ${response.status}`);
    return { status: response.status, result: result.substring(0, 100) };
  } catch (error) {
    debugLog.push(`Supabase error: ${error.message}`);
    return { error: error.message };
  }
}

export default async function handler(req, res) {
  // デバッグログをリセット
  debugLog = [];
  debugLog.push(`Method: ${req.method}`);
  
  // GET request - デバッグ情報を表示
  if (req.method === 'GET') {
    const supabaseTest = await testSupabase();
    
    return res.status(200).json({
      status: 'Debug mode active',
      environment: {
        has_line_token: !!process.env.LINE_CHANNEL_ACCESS_TOKEN,
        has_line_secret: !!process.env.LINE_CHANNEL_SECRET,
        has_supabase_url: !!process.env.SUPABASE_URL,
        has_supabase_key: !!process.env.SUPABASE_ANON_KEY,
        store_id: process.env.STORE_ID || 'not set',
        supabase_url: process.env.SUPABASE_URL || 'not set'
      },
      supabase_test: supabaseTest,
      debug_log: debugLog
    });
  }
  
  // POST request - Webhookを処理してデバッグ情報を返す
  if (req.method === 'POST') {
    try {
      // 空のイベント（検証）
      if (!req.body || !req.body.events || req.body.events.length === 0) {
        debugLog.push('Empty events - verification');
        return res.status(200).send('OK');
      }
      
      const events = req.body.events;
      debugLog.push(`Events: ${events.length}`);
      
      for (const event of events) {
        if (event.type === 'message' && event.message?.type === 'text') {
          const text = event.message.text;
          const replyToken = event.replyToken;
          
          debugLog.push(`Message: ${text}`);
          
          // デバッグメッセージを送信
          const debugMessages = [{
            type: 'text',
            text: `🔍 デバッグモード\n\n受信: "${text}"\n\n環境変数:\n- TOKEN: ${!!process.env.LINE_CHANNEL_ACCESS_TOKEN ? '✅' : '❌'}\n- SUPABASE: ${!!process.env.SUPABASE_URL ? '✅' : '❌'}\n- STORE_ID: ${process.env.STORE_ID || 'なし'}\n\nログ:\n${debugLog.join('\n')}`
          }];
          
          await replyMessage(replyToken, debugMessages);
        }
      }
      
      return res.status(200).send('OK');
      
    } catch (error) {
      debugLog.push(`Error: ${error.message}`);
      return res.status(200).json({ error: error.message, log: debugLog });
    }
  }
  
  return res.status(405).json({ error: 'Method not allowed' });
}