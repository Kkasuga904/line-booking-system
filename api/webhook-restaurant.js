/**
 * LINE Bot Webhook - レストラン予約連携
 * LINE予約を受け取ってローカルサーバーに転送
 */

const line = require('@line/bot-sdk');
const axios = require('axios');

// LINE Bot設定
const config = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET
};

const client = new line.Client(config);

// ローカルサーバーのURL（環境変数で設定可能）
const LOCAL_SERVER_URL = process.env.LOCAL_SERVER_URL || 'http://localhost:3001';

module.exports = async (req, res) => {
  // 署名検証
  const signature = req.headers['x-line-signature'];
  if (!signature) {
    return res.status(401).json({ error: 'No signature' });
  }

  try {
    const events = req.body.events;
    
    for (const event of events) {
      if (event.type === 'message' && event.message.type === 'text') {
        const userMessage = event.message.text;
        
        // 予約メッセージのパース
        const reservationData = parseReservationMessage(userMessage);
        
        if (reservationData) {
          // ユーザープロフィール取得
          const profile = await client.getProfile(event.source.userId);
          
          // 予約データを構築
          const reservation = {
            ...reservationData,
            customerName: profile.displayName,
            lineUserId: event.source.userId,
            source: 'LINE',
            timestamp: event.timestamp
          };
          
          // ローカルサーバーに予約を送信
          try {
            await axios.post(`${LOCAL_SERVER_URL}/api/reservations`, reservation, {
              headers: { 'Content-Type': 'application/json' }
            });
            
            // 確認メッセージを送信
            await client.replyMessage(event.replyToken, {
              type: 'text',
              text: `予約を承りました！\n\n📅 日時: ${formatDateTime(reservation.dateTime)}\n👥 人数: ${reservation.people}名\n\nご来店をお待ちしております。`
            });
          } catch (error) {
            console.error('Failed to save reservation:', error);
            
            await client.replyMessage(event.replyToken, {
              type: 'text',
              text: '申し訳ございません。予約の処理中にエラーが発生しました。お手数ですが、もう一度お試しください。'
            });
          }
        }
      }
      
      // Postbackイベント（予約ボタンなど）
      if (event.type === 'postback') {
        const data = new URLSearchParams(event.postback.data);
        const action = data.get('action');
        
        if (action === 'reserve') {
          // ユーザープロフィール取得
          const profile = await client.getProfile(event.source.userId);
          
          // 予約データ
          const reservation = {
            customerName: profile.displayName,
            lineUserId: event.source.userId,
            dateTime: data.get('datetime') || new Date().toISOString(),
            people: parseInt(data.get('people')) || 2,
            seatType: data.get('seatType') || 'any',
            notes: data.get('notes') || '',
            source: 'LINE',
            timestamp: event.timestamp
          };
          
          // ローカルサーバーに送信
          try {
            await axios.post(`${LOCAL_SERVER_URL}/api/reservations`, reservation, {
              headers: { 'Content-Type': 'application/json' }
            });
            
            await client.replyMessage(event.replyToken, {
              type: 'text',
              text: `予約が完了しました！\n\n📅 ${formatDateTime(reservation.dateTime)}\n👥 ${reservation.people}名\n\nご来店をお待ちしております。`
            });
          } catch (error) {
            console.error('Failed to save reservation:', error);
            
            await client.replyMessage(event.replyToken, {
              type: 'text',
              text: '予約の処理中にエラーが発生しました。'
            });
          }
        }
      }
    }
    
    res.status(200).json({ success: true });
  } catch (err) {
    console.error('Webhook error:', err);
    res.status(500).json({ error: err.message });
  }
};

// 予約メッセージをパース
function parseReservationMessage(message) {
  // 簡単な予約パターンを認識
  // 例: "今日の19時に2名で予約"
  const patterns = [
    /(?:今日|明日|明後日)?.*?(\d{1,2})[:時].*?(\d{1,2})名/,
    /(\d{1,2})名.*?(?:今日|明日)?.*?(\d{1,2})[:時]/,
    /予約.*?(\d{1,2})[:時].*?(\d{1,2})名/
  ];
  
  for (const pattern of patterns) {
    const match = message.match(pattern);
    if (match) {
      const hour = parseInt(match[1]);
      const people = parseInt(match[2]) || parseInt(match[1]);
      
      // 日付を決定
      const date = new Date();
      if (message.includes('明日')) {
        date.setDate(date.getDate() + 1);
      } else if (message.includes('明後日')) {
        date.setDate(date.getDate() + 2);
      }
      
      date.setHours(hour, 0, 0, 0);
      
      return {
        dateTime: date.toISOString(),
        people: people,
        notes: message
      };
    }
  }
  
  // キーワードベースの予約検出
  if (message.includes('予約')) {
    // デフォルト値で予約を作成
    const date = new Date();
    date.setHours(date.getHours() + 2); // 2時間後
    
    return {
      dateTime: date.toISOString(),
      people: 2,
      notes: message
    };
  }
  
  return null;
}

// 日時フォーマット
function formatDateTime(dateTimeStr) {
  const date = new Date(dateTimeStr);
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const hour = date.getHours();
  const minute = date.getMinutes().toString().padStart(2, '0');
  
  return `${month}月${day}日 ${hour}:${minute}`;
}