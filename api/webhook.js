const crypto = require('crypto');

// LINE設定
const config = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET
};

// メモリ内データストア
const bookings = [];
const customers = {};
const shopSettings = {
  name: 'サンプル美容室',
  openTime: '10:00',
  closeTime: '20:00',
  lunchBreak: { start: '13:00', end: '14:00' },
  slotDuration: 60,
  menus: [
    { id: 1, name: 'カット', duration: 60, price: 3500 },
    { id: 2, name: 'カラー', duration: 90, price: 7000 },
    { id: 3, name: 'パーマ', duration: 120, price: 8000 },
    { id: 4, name: 'トリートメント', duration: 30, price: 2000 }
  ]
};

// 署名検証
function validateSignature(body, signature, secret) {
  const hash = crypto
    .createHmac('SHA256', secret)
    .update(body)
    .digest('base64');
  
  return hash === signature;
}

// LINEリプライ
async function replyMessage(replyToken, messages) {
  const accessToken = config.channelAccessToken;
  
  if (!accessToken) {
    console.error('No access token available');
    return;
  }
  
  const body = JSON.stringify({
    replyToken,
    messages: Array.isArray(messages) ? messages : [messages]
  });
  
  try {
    const response = await fetch('https://api.line.me/v2/bot/message/reply', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      },
      body
    });
    
    if (!response.ok) {
      const error = await response.text();
      console.error('LINE API error:', response.status, error);
    } else {
      console.log('Reply sent successfully');
    }
  } catch (error) {
    console.error('Failed to send reply:', error);
  }
}

// 利用可能な時間枠を生成
function generateAvailableSlots(date) {
  const slots = [];
  const startHour = 10;
  const endHour = 20;
  const lunchStart = 13;
  const lunchEnd = 14;
  
  for (let hour = startHour; hour < endHour; hour++) {
    if (hour >= lunchStart && hour < lunchEnd) continue;
    
    const slotTime = `${hour}:00`;
    const isBooked = bookings.some(b => 
      b.date === date && b.time === slotTime && b.status === 'confirmed'
    );
    
    if (!isBooked) {
      slots.push(slotTime);
    }
  }
  
  return slots;
}

// 予約を作成
function createBooking(userId, date, time, menuId, userName) {
  const menu = shopSettings.menus.find(m => m.id === menuId);
  const booking = {
    id: Date.now().toString(),
    userId,
    userName: userName || 'お客様',
    date,
    time,
    menu: menu.name,
    duration: menu.duration,
    price: menu.price,
    status: 'confirmed',
    createdAt: new Date().toISOString()
  };
  
  bookings.push(booking);
  
  if (!customers[userId]) {
    customers[userId] = {
      userId,
      name: userName || 'お客様',
      bookings: []
    };
  }
  customers[userId].bookings.push(booking.id);
  
  return booking;
}

// 予約をキャンセル
function cancelBooking(bookingId, userId) {
  const bookingIndex = bookings.findIndex(b => b.id === bookingId && b.userId === userId);
  if (bookingIndex !== -1) {
    bookings[bookingIndex].status = 'cancelled';
    return true;
  }
  return false;
}

// ユーザーの予約を取得
function getUserBookings(userId) {
  return bookings.filter(b => b.userId === userId && b.status === 'confirmed');
}

// テキストメッセージ処理
async function handleTextMessage(event) {
  const userId = event.source.userId;
  const text = event.message.text.toLowerCase();
  
  let messageToSend;
  
  if (text.includes('予約')) {
    if (text.includes('確認') || text.includes('チェック')) {
      const userBookings = getUserBookings(userId);
      if (userBookings.length === 0) {
        messageToSend = {
          type: 'text',
          text: '現在、ご予約はありません。'
        };
      } else {
        const bookingList = userBookings.map(b => 
          `📅 ${b.date} ${b.time}\n📝 ${b.menu}\n💰 ${b.price.toLocaleString()}円`
        ).join('\n\n');
        
        messageToSend = {
          type: 'text',
          text: `現在のご予約:\n\n${bookingList}`
        };
      }
    } else {
      // 予約開始
      messageToSend = {
        type: 'template',
        altText: '予約メニューを選択',
        template: {
          type: 'buttons',
          text: 'ご希望のメニューを選択してください',
          actions: shopSettings.menus.map(menu => ({
            type: 'postback',
            label: `${menu.name} (${menu.price}円)`,
            data: `action=selectMenu&menuId=${menu.id}`
          }))
        }
      };
    }
  } else if (text.includes('キャンセル')) {
    const userBookings = getUserBookings(userId);
    if (userBookings.length === 0) {
      messageToSend = {
        type: 'text',
        text: 'キャンセルできる予約がありません。'
      };
    } else {
      messageToSend = {
        type: 'template',
        altText: 'キャンセルする予約を選択',
        template: {
          type: 'buttons',
          text: 'キャンセルする予約を選択してください',
          actions: userBookings.slice(0, 4).map(b => ({
            type: 'postback',
            label: `${b.date} ${b.time} ${b.menu}`,
            data: `action=cancelBooking&bookingId=${b.id}`
          }))
        }
      };
    }
  } else if (text.includes('ヘルプ') || text.includes('help')) {
    messageToSend = {
      type: 'text',
      text: `使い方:\n\n「予約」→ 新規予約\n「予約確認」→ 予約の確認\n「キャンセル」→ 予約取消\n\n営業時間: ${shopSettings.openTime}-${shopSettings.closeTime}\n昼休み: ${shopSettings.lunchBreak.start}-${shopSettings.lunchBreak.end}`
    };
  } else {
    messageToSend = {
      type: 'text',
      text: 'メニューをお選びください:\n・予約\n・予約確認\n・キャンセル\n・ヘルプ'
    };
  }
  
  await replyMessage(event.replyToken, messageToSend);
}

// Postback処理
async function handlePostback(event) {
  const userId = event.source.userId;
  const data = new URLSearchParams(event.postback.data);
  const action = data.get('action');
  
  let reply;
  
  if (action === 'selectMenu') {
    const menuId = parseInt(data.get('menuId'));
    const today = new Date();
    const dates = [];
    
    for (let i = 1; i <= 7; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);
      dates.push(`${date.getMonth() + 1}/${date.getDate()}`);
    }
    
    reply = {
      type: 'template',
      altText: '予約日を選択',
      template: {
        type: 'buttons',
        text: '予約日を選択してください',
        actions: dates.slice(0, 4).map(date => ({
          type: 'postback',
          label: date,
          data: `action=selectDate&menuId=${menuId}&date=${date}`
        }))
      }
    };
  } else if (action === 'selectDate') {
    const menuId = parseInt(data.get('menuId'));
    const date = data.get('date');
    const availableSlots = generateAvailableSlots(date);
    
    if (availableSlots.length === 0) {
      reply = {
        type: 'text',
        text: `${date}は予約が満席です。別の日をお選びください。`
      };
    } else {
      reply = {
        type: 'template',
        altText: '予約時間を選択',
        template: {
          type: 'buttons',
          text: `${date}の空き時間を選択してください`,
          actions: availableSlots.slice(0, 4).map(time => ({
            type: 'postback',
            label: time,
            data: `action=confirmBooking&menuId=${menuId}&date=${date}&time=${time}`
          }))
        }
      };
    }
  } else if (action === 'confirmBooking') {
    const menuId = parseInt(data.get('menuId'));
    const date = data.get('date');
    const time = data.get('time');
    
    const booking = createBooking(userId, date, time, menuId, 'お客様');
    
    reply = {
      type: 'text',
      text: `✅ 予約が完了しました!\n\n📅 ${booking.date} ${booking.time}\n📝 ${booking.menu}\n💰 ${booking.price.toLocaleString()}円\n\n予約番号: ${booking.id}\n\nご来店をお待ちしております。`
    };
  } else if (action === 'cancelBooking') {
    const bookingId = data.get('bookingId');
    const success = cancelBooking(bookingId, userId);
    
    if (success) {
      reply = {
        type: 'text',
        text: '✅ 予約をキャンセルしました。'
      };
    } else {
      reply = {
        type: 'text',
        text: '❌ 予約のキャンセルに失敗しました。'
      };
    }
  }
  
  await replyMessage(event.replyToken, reply);
}

// Webhook handler
module.exports = async function handler(req, res) {
  console.log('Webhook called:', req.method);
  console.log('Headers:', JSON.stringify(req.headers));
  
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
      message: 'LINE予約システム稼働中',
      env: {
        hasAccessToken: !!config.channelAccessToken,
        hasSecret: !!config.channelSecret
      }
    });
  }

  // POSTリクエスト（Webhook）
  if (req.method === 'POST') {
    const signature = req.headers['x-line-signature'];
    
    console.log('POST body:', JSON.stringify(req.body));
    console.log('Signature:', signature);
    console.log('Environment:', {
      hasSecret: !!config.channelSecret,
      hasToken: !!config.channelAccessToken
    });
    
    // 環境変数チェック
    if (!config.channelSecret || !config.channelAccessToken) {
      console.error('Missing environment variables');
      return res.status(200).json({ 
        success: true, 
        warning: 'Environment variables not configured' 
      });
    }
    
    // LINEのWebhook検証リクエスト（署名なし）
    if (!signature) {
      console.log('No signature - LINE verification request');
      return res.status(200).json({ success: true });
    }
    
    // 署名検証
    const body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
    const isValid = validateSignature(body, signature, config.channelSecret);
    
    console.log('Signature validation:', isValid);
    
    if (!isValid) {
      console.error('Invalid signature');
      // とりあえず200を返してLINEの検証を通す
      return res.status(200).json({ 
        success: true,
        warning: 'Invalid signature' 
      });
    }

    try {
      const events = req.body.events || [];
      console.log('Processing events:', events.length);
      
      for (const event of events) {
        console.log('Event:', JSON.stringify(event));
        
        if (event.type === 'message' && event.message.type === 'text') {
          await handleTextMessage(event);
        } else if (event.type === 'postback') {
          await handlePostback(event);
        }
      }
      
      return res.status(200).json({ success: true });
    } catch (error) {
      console.error('Webhook error:', error);
      return res.status(200).json({ 
        success: true,
        error: error.message 
      });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
};