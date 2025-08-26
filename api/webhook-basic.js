export default async function handler(req, res) {
  // GETリクエストの場合
  if (req.method === 'GET') {
    return res.status(200).json({ 
      status: 'OK',
      message: 'Webhook is ready'
    });
  }
  
  // POSTリクエストの場合（LINEからのWebhook）
  if (req.method === 'POST') {
    // 空のイベント配列の場合（Webhook URL検証）
    if (!req.body || !req.body.events || req.body.events.length === 0) {
      return res.status(200).send('OK');
    }
    
    // イベントがある場合も、とりあえず200を返す
    return res.status(200).send('OK');
  }
  
  // その他のメソッド
  return res.status(405).json({ error: 'Method not allowed' });
}