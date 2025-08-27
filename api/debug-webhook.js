export default async function handler(req, res) {
  console.log('=== Debug Webhook Called ===');
  console.log('Method:', req.method);
  console.log('Headers:', JSON.stringify(req.headers, null, 2));
  console.log('Body:', JSON.stringify(req.body, null, 2));
  console.log('ENV CHECK:');
  console.log('- LINE_CHANNEL_ACCESS_TOKEN exists:', !!process.env.LINE_CHANNEL_ACCESS_TOKEN);
  console.log('- LINE_CHANNEL_SECRET exists:', !!process.env.LINE_CHANNEL_SECRET);
  console.log('- Token length:', process.env.LINE_CHANNEL_ACCESS_TOKEN?.length);
  console.log('- Token first 10 chars:', process.env.LINE_CHANNEL_ACCESS_TOKEN?.substring(0, 10));
  
  // テスト送信
  if (req.method === 'POST' && req.body?.test === true) {
    const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
    
    try {
      const response = await fetch('https://api.line.me/v2/bot/message/broadcast', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          messages: [{
            type: 'text',
            text: 'Debug test message'
          }]
        })
      });
      
      const result = await response.text();
      console.log('LINE API Response:', response.status, result);
      
      return res.json({
        status: 'test sent',
        lineApiStatus: response.status,
        lineApiResponse: result,
        tokenExists: !!token,
        tokenLength: token?.length
      });
    } catch (error) {
      console.error('Error calling LINE API:', error);
      return res.json({
        status: 'error',
        error: error.message
      });
    }
  }
  
  return res.json({
    status: 'debug endpoint active',
    method: req.method,
    hasToken: !!process.env.LINE_CHANNEL_ACCESS_TOKEN,
    hasSecret: !!process.env.LINE_CHANNEL_SECRET,
    tokenLength: process.env.LINE_CHANNEL_ACCESS_TOKEN?.length,
    bodyReceived: !!req.body
  });
}