// 何でもログに吐くだけの最小テストAPI
export const config = { api: { bodyParser: true } };

export default async function handler(req, res) {
  console.log('=== PING RECEIVED ===');
  console.log('Time:', new Date().toISOString());
  console.log('Method:', req.method);
  console.log('Headers:', JSON.stringify(req.headers, null, 2));
  console.log('BODY:', JSON.stringify(req.body, null, 2));
  
  // eventsが存在するかチェック
  if (req.body && req.body.events) {
    console.log('Events found! Count:', req.body.events.length);
    
    req.body.events.forEach((event, index) => {
      console.log(`Event ${index}:`, JSON.stringify(event, null, 2));
      
      if (event.type === 'message' && event.message?.type === 'text') {
        console.log('TEXT MESSAGE RECEIVED:', event.message.text);
        console.log('User ID:', event.source?.userId);
        console.log('Reply Token:', event.replyToken);
      }
    });
  } else {
    console.log('No events in body');
  }
  
  // 常に200を返す
  return res.status(200).json({ 
    received: true,
    timestamp: new Date().toISOString()
  });
}