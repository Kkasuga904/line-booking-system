export default async function handler(req, res) {
  // シンプルな応答 - どんなリクエストでも200を返す
  console.log('=== WEBHOOK DEBUG ===');
  console.log('Method:', req.method);
  console.log('Headers:', JSON.stringify(req.headers));
  console.log('Body:', JSON.stringify(req.body));
  console.log('===================');
  
  // GETリクエスト - 確認用
  if (req.method === 'GET') {
    return res.status(200).json({ 
      status: 'Webhook Debug Active',
      timestamp: new Date().toISOString()
    });
  }
  
  // POSTリクエスト - Webhook受信
  if (req.method === 'POST') {
    // 空のイベント（検証用）
    if (!req.body?.events || req.body.events.length === 0) {
      console.log('Empty events - verification request');
      return res.status(200).json({ verified: true });
    }
    
    // イベント処理
    const events = req.body.events || [];
    console.log(`Processing ${events.length} events`);
    
    for (const event of events) {
      console.log('Event type:', event.type);
      if (event.type === 'message' && event.message?.type === 'text') {
        console.log('Text message:', event.message.text);
        console.log('User ID:', event.source?.userId);
      }
    }
    
    // 必ず200を返す
    return res.status(200).json({ success: true });
  }
  
  return res.status(200).json({ method: req.method });
}