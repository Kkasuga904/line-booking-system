const line = require('@line/bot-sdk');

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  
  // Handle GET request (for LINE Verify)
  if (req.method === 'GET') {
    return res.status(200).send('OK');
  }
  
  // Handle OPTIONS request
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  // Handle POST request (LINE Webhook)
  if (req.method === 'POST') {
    const config = {
      channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
      channelSecret: process.env.LINE_CHANNEL_SECRET
    };
    
    // Check credentials
    if (!config.channelAccessToken || !config.channelSecret) {
      console.error('Missing LINE credentials');
      return res.status(200).json({ error: 'Configuration error' });
    }
    
    const client = new line.Client(config);
    
    try {
      // Validate signature
      const signature = req.headers['x-line-signature'];
      const body = JSON.stringify(req.body);
      
      if (!line.validateSignature(body, config.channelSecret, signature)) {
        return res.status(401).send('Invalid signature');
      }
      
      // Process events
      const events = req.body.events || [];
      
      for (const event of events) {
        if (event.type === 'message' && event.message.type === 'text') {
          const userMessage = event.message.text;
          
          let replyText = 'こんにちは！Smart Web Worksです。';
          
          if (userMessage === '予約する') {
            replyText = 'サービスをお選びください：\n1. Webサイト制作\n2. LINE予約システム\n3. 無料相談';
          } else if (userMessage === '料金プラン') {
            replyText = '【料金プラン】\nWebサイト制作: 月額5,500円〜\nLINE予約システム: 月額5,000円〜';
          } else if (userMessage === 'お問い合わせ') {
            replyText = 'support@smartwebworks.com までご連絡ください。';
          }
          
          await client.replyMessage(event.replyToken, {
            type: 'text',
            text: replyText
          });
        }
      }
      
      return res.status(200).json({ success: true });
      
    } catch (error) {
      console.error('Error:', error);
      return res.status(200).json({ error: error.message });
    }
  }
  
  return res.status(405).send('Method Not Allowed');
}