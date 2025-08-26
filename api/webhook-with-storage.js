// 管理画面と連携するためのWebhook（1個目のアカウント用）
export const config = { api: { bodyParser: true } };

// 簡易的なメモリストレージ（本番はデータベース使用）
let reservations = [];

export default async function handler(req, res) {
  // CORS設定
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  // 予約データ取得API
  if (req.method === 'GET' && req.url === '/api/reservations') {
    return res.status(200).json(reservations);
  }
  
  // Webhook処理
  if (req.method !== 'POST') {
    return res.status(405).end();
  }
  
  const TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!TOKEN) {
    return res.status(200).end();
  }
  
  try {
    const events = req.body?.events || [];
    
    if (events.length === 0) {
      return res.status(200).end();
    }
    
    for (const event of events) {
      if (event.type === 'message' && 
          event.message?.type === 'text' && 
          event.replyToken) {
        
        const userMessage = event.message.text.trim();
        const userId = event.source?.userId || 'unknown';
        
        // 予約パターンを検出
        const reservationPattern = /(\d+)[時:：].*(\d+)[人名]/;
        if (userMessage.includes('12:30') || reservationPattern.test(userMessage)) {
          // 予約データを解析
          const timeMatch = userMessage.match(/(\d+):?(\d{0,2})/);
          const peopleMatch = userMessage.match(/(\d+)[人名]/);
          
          const hour = timeMatch ? timeMatch[1] : '12';
          const minute = timeMatch && timeMatch[2] ? timeMatch[2] : '30';
          const time = `${hour}:${minute.padStart(2, '0')}`;
          const people = peopleMatch ? peopleMatch[1] : '4';
          
          let date = '本日';
          if (userMessage.includes('明日')) date = '明日';
          if (userMessage.includes('明後日')) date = '明後日';
          
          // 予約データを保存
          const reservation = {
            id: Date.now(),
            userId: userId,
            storeName: 'レストラン',
            date: date,
            time: time,
            people: parseInt(people),
            status: 'pending',
            message: userMessage,
            createdAt: new Date().toISOString()
          };
          
          reservations.push(reservation);
          
          // 返信メッセージ
          const replyMessage = {
            type: 'text',
            text: `✅ ご予約を承りました！\n\n` +
                  `🏪 レストラン\n` +
                  `👥 人数: ${people}名様\n` +
                  `📅 ${userMessage.includes('テーブル席') ? '席: テーブル席\n' : ''}` +
                  `🕐 時間: ${time}\n\n` +
                  `予約番号: ${reservation.id.toString().slice(-8)}\n\n` +
                  `当日はこちらの番号をお伝えください。\n` +
                  `お待ちしております！`
          };
          
          // LINE APIで返信
          await fetch('https://api.line.me/v2/bot/message/reply', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${TOKEN}`
            },
            body: JSON.stringify({
              replyToken: event.replyToken,
              messages: [replyMessage]
            })
          });
          
          // ローカル管理画面にも通知（ngrok使用時）
          if (process.env.LOCAL_WEBHOOK_URL) {
            try {
              await fetch(process.env.LOCAL_WEBHOOK_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ reservation })
              });
            } catch (e) {
              console.log('Local webhook failed:', e.message);
            }
          }
        }
        // テーブル席の希望
        else if (userMessage.includes('テーブル席')) {
          const replyMessage = {
            type: 'text',
            text: 'テーブル席ですね。\n\nご希望の時間帯をお選びください：',
            quickReply: {
              items: [
                {
                  type: 'action',
                  action: {
                    type: 'message',
                    label: '12:30',
                    text: '12:30'
                  }
                },
                {
                  type: 'action',
                  action: {
                    type: 'message',
                    label: '18:00',
                    text: '18:00 4名 テーブル席'
                  }
                },
                {
                  type: 'action',
                  action: {
                    type: 'message',
                    label: '19:00',
                    text: '19:00 4名 テーブル席'
                  }
                }
              ]
            }
          };
          
          await fetch('https://api.line.me/v2/bot/message/reply', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${TOKEN}`
            },
            body: JSON.stringify({
              replyToken: event.replyToken,
              messages: [replyMessage]
            })
          });
        }
      }
    }
    
    return res.status(200).end();
    
  } catch (error) {
    console.error('ERROR:', error.message);
    return res.status(200).end();
  }
}