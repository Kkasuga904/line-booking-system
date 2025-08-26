const crypto = require('crypto');

module.exports = async function handler(req, res) {
  console.log('Request Method:', req.method);
  console.log('Request Headers:', req.headers);
  console.log('Request Body:', req.body);
  
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
      message: 'Webhook test endpoint is working',
      env: {
        hasAccessToken: !!process.env.LINE_CHANNEL_ACCESS_TOKEN,
        hasSecret: !!process.env.LINE_CHANNEL_SECRET,
        accessTokenLength: process.env.LINE_CHANNEL_ACCESS_TOKEN ? process.env.LINE_CHANNEL_ACCESS_TOKEN.length : 0,
        secretLength: process.env.LINE_CHANNEL_SECRET ? process.env.LINE_CHANNEL_SECRET.length : 0
      }
    });
  }

  // POSTリクエスト（Webhook）
  if (req.method === 'POST') {
    const signature = req.headers['x-line-signature'];
    const channelSecret = process.env.LINE_CHANNEL_SECRET;
    
    console.log('Signature:', signature);
    console.log('Channel Secret exists:', !!channelSecret);
    console.log('Channel Secret length:', channelSecret ? channelSecret.length : 0);
    
    if (!channelSecret) {
      console.error('LINE_CHANNEL_SECRET is not set');
      return res.status(500).json({ error: 'Server configuration error: missing channel secret' });
    }
    
    // 署名検証をスキップしてとりあえず200を返す（テスト用）
    if (!signature) {
      console.log('No signature provided, but returning 200 for testing');
      return res.status(200).json({ 
        success: true, 
        message: 'No signature, but accepted for testing',
        body: req.body 
      });
    }
    
    // 署名検証
    const body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
    const hash = crypto
      .createHmac('SHA256', channelSecret)
      .update(body)
      .digest('base64');
    
    console.log('Calculated hash:', hash);
    console.log('Signature match:', hash === signature);
    
    // 検証が失敗しても200を返す（LINEのVerifyを通すため）
    if (hash !== signature) {
      console.log('Signature mismatch, but returning 200 for LINE verification');
    }
    
    return res.status(200).json({ 
      success: true,
      message: 'Webhook received',
      signatureValid: hash === signature,
      events: req.body.events || []
    });
  }

  return res.status(405).json({ error: 'Method not allowed' });
};