/**
 * LINE Bot Webhook - 飲食店予約システム
 * 
 * 主な機能:
 * - 席タイプ選択（カウンター、テーブル、個室）
 * - 人数指定
 * - 時間帯選択
 * - 即時入店対応
 * 
 * コマンド:
 * - 「席」「予約」 - 予約開始
 * - 「今すぐ」 - 即時入店
 * - 「確認」 - 予約確認
 * - 「キャンセル」 - 予約キャンセル
 */

export const config = { api: { bodyParser: true } };

// 店舗設定（環境変数または固定値）
const RESTAURANT_CONFIG = {
  name: process.env.RESTAURANT_NAME || 'レストラン',
  
  // 席の詳細設定（席番号付き）
  seatLayout: {
    counter: [
      { id: 'C1', name: 'カウンター1', capacity: 1, status: 'available' },
      { id: 'C2', name: 'カウンター2', capacity: 1, status: 'available' },
      { id: 'C3', name: 'カウンター3', capacity: 1, status: 'available' },
      { id: 'C4', name: 'カウンター4', capacity: 1, status: 'available' },
      { id: 'C5', name: 'カウンター5', capacity: 1, status: 'available' },
      { id: 'C6', name: 'カウンター6', capacity: 1, status: 'available' },
      { id: 'C7', name: 'カウンター7', capacity: 1, status: 'available' },
      { id: 'C8', name: 'カウンター8', capacity: 1, status: 'available' }
    ],
    table: [
      { id: 'T1', name: 'テーブル1', capacity: 4, status: 'available' },
      { id: 'T2', name: 'テーブル2', capacity: 4, status: 'available' },
      { id: 'T3', name: 'テーブル3', capacity: 4, status: 'occupied' },
      { id: 'T4', name: 'テーブル4', capacity: 4, status: 'available' },
      { id: 'T5', name: 'テーブル5', capacity: 4, status: 'reserved' }
    ],
    private: [
      { id: 'P1', name: '個室1', capacity: 6, status: 'available' },
      { id: 'P2', name: '個室2', capacity: 8, status: 'occupied' },
      { id: 'P3', name: '個室3', capacity: 6, status: 'available' }
    ]
  },
  
  // 席タイプ別の集計
  seats: {
    counter: {
      name: 'カウンター席',
      emoji: '🪑'
    },
    table: {
      name: 'テーブル席',
      emoji: '🪑🪑'
    },
    private: {
      name: '個室',
      emoji: '🚪'
    }
  },
  
  // 営業時間
  hours: {
    lunch: { start: '11:30', end: '14:30' },
    dinner: { start: '17:00', end: '23:00' }
  },
  
  // 予約可能な時間枠
  timeSlots: [
    '11:30', '12:00', '12:30', '13:00', '13:30', '14:00',
    '17:00', '17:30', '18:00', '18:30', '19:00', '19:30', 
    '20:00', '20:30', '21:00', '21:30', '22:00'
  ]
};

// 予約データストレージ（本番環境ではDB使用）
const reservations = new Map();
// ユーザーの予約状態管理
const userStates = new Map();

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).end();
  }

  const TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!TOKEN) {
    console.error('ERROR: No LINE_CHANNEL_ACCESS_TOKEN');
    return res.status(200).end();
  }

  try {
    const events = req.body?.events || [];
    
    for (const event of events) {
      if (event.type === 'message' && 
          event.message?.type === 'text' && 
          event.replyToken) {
        
        const userMessage = event.message.text.trim();
        const userId = event.source?.userId;
        
        // ユーザーの状態を取得
        const userState = userStates.get(userId) || null;
        
        let replyMessages = [];
        
        // === コマンド処理 ===
        
        // 予約開始
        if (userMessage === '席' || userMessage === '予約') {
          replyMessages = [
            {
              type: 'text',
              text: `🍴 ${RESTAURANT_CONFIG.name}へようこそ！\n\n何名様でしょうか？`,
              quickReply: {
                items: [
                  { type: 'action', action: { type: 'message', label: '1名', text: '1名' }},
                  { type: 'action', action: { type: 'message', label: '2名', text: '2名' }},
                  { type: 'action', action: { type: 'message', label: '3名', text: '3名' }},
                  { type: 'action', action: { type: 'message', label: '4名', text: '4名' }},
                  { type: 'action', action: { type: 'message', label: '5名以上', text: '5名以上' }}
                ]
              }
            }
          ];
          userStates.set(userId, { step: 'people' });
          
        // 即時入店
        } else if (userMessage === '今すぐ' || userMessage === '即入店') {
          const availableSeats = getAvailableSeats();
          replyMessages = [
            {
              type: 'text',
              text: `📍 現在の空席状況\n\n${availableSeats}\n\n何名様でしょうか？`,
              quickReply: {
                items: [
                  { type: 'action', action: { type: 'message', label: '1名', text: '1名' }},
                  { type: 'action', action: { type: 'message', label: '2名', text: '2名' }},
                  { type: 'action', action: { type: 'message', label: '3-4名', text: '4名' }},
                  { type: 'action', action: { type: 'message', label: '5名以上', text: '5名以上' }}
                ]
              }
            }
          ];
          userStates.set(userId, { step: 'people', immediate: true });
          
        // 人数選択後の処理
        } else if (userState?.step === 'people' && userMessage.includes('名')) {
          const people = parseInt(userMessage);
          userState.people = people;
          
          if (userState.immediate) {
            // 即時入店の場合、空いている席を自動割り当て
            const assignedSeat = assignSeat(people);
            if (!assignedSeat) {
              replyMessages = [{
                type: 'text',
                text: `申し訳ございません。${people}名様でご利用いただける席が現在満席です。\n\nしばらくお待ちいただくか、後ほど再度お試しください。`
              }];
              userStates.delete(userId);
            } else {
              const reservationId = Date.now().toString();
              
              const reservation = {
                id: reservationId,
                userId: userId,
                people: people,
                seatId: assignedSeat.id,
                seatType: assignedSeat.type,
                time: '即入店',
                timestamp: new Date().toISOString(),
                status: 'confirmed',
                immediate: true
              };
              
              reservations.set(reservationId, reservation);
              
              // 席を使用中に更新
              updateSeatStatus(assignedSeat.id, 'occupied');
              
              replyMessages = [
                {
                  type: 'text',
                  text: `✅ ご案内準備ができました！\n\n` +
                        `👥 人数: ${people}名様\n` +
                        `📍 席番号: ${assignedSeat.id}\n` +
                        `${RESTAURANT_CONFIG.seats[assignedSeat.type].emoji} ${assignedSeat.name}\n` +
                        `⏰ 時間: 即入店\n\n` +
                        `スタッフが${assignedSeat.id}番席へご案内いたします。\n` +
                        `予約番号: ${reservationId}`
                }
              ];
              userStates.delete(userId);
            }
            
          } else {
            // 通常予約の場合、席タイプ選択へ
            userState.step = 'seat';
            const seatOptions = getSeatOptions(people);
            
            replyMessages = [
              {
                type: 'text',
                text: `${people}名様ですね。\n\nご希望の席タイプをお選びください：`,
                quickReply: {
                  items: seatOptions.map(seat => ({
                    type: 'action',
                    action: { type: 'message', label: seat.label, text: seat.text }
                  }))
                }
              }
            ];
          }
          
        // 席タイプ選択後の処理
        } else if (userState?.step === 'seat') {
          let seatType = null;
          if (userMessage.includes('カウンター')) seatType = 'counter';
          else if (userMessage.includes('テーブル')) seatType = 'table';
          else if (userMessage.includes('個室')) seatType = 'private';
          
          if (seatType) {
            userState.seatType = seatType;
            userState.step = 'time';
            
            const timeSlots = getAvailableTimeSlots();
            replyMessages = [
              {
                type: 'text',
                text: `${RESTAURANT_CONFIG.seats[seatType].name}ですね。\n\nご希望の時間帯をお選びください：`,
                quickReply: {
                  items: timeSlots.slice(0, 10).map(time => ({
                    type: 'action',
                    action: { type: 'message', label: time, text: time }
                  }))
                }
              }
            ];
          }
          
        // 時間選択後の処理
        } else if (userState?.step === 'time') {
          const time = userMessage;
          if (RESTAURANT_CONFIG.timeSlots.includes(time)) {
            const reservationId = Date.now().toString();
            
            const reservation = {
              id: reservationId,
              userId: userId,
              people: userState.people,
              seatType: userState.seatType,
              time: time,
              timestamp: new Date().toISOString(),
              status: 'confirmed'
            };
            
            reservations.set(reservationId, reservation);
            
            replyMessages = [
              {
                type: 'text',
                text: `✅ ご予約を承りました！\n\n` +
                      `🏪 ${RESTAURANT_CONFIG.name}\n` +
                      `👥 人数: ${userState.people}名様\n` +
                      `${RESTAURANT_CONFIG.seats[userState.seatType].emoji} 席: ${RESTAURANT_CONFIG.seats[userState.seatType].name}\n` +
                      `⏰ 時間: ${time}\n\n` +
                      `予約番号: ${reservationId}\n\n` +
                      `当日はこちらの番号をお伝えください。\n` +
                      `お待ちしております！`
              }
            ];
            userStates.delete(userId);
          }
          
        // 予約確認
        } else if (userMessage === '確認') {
          const userReservations = [];
          for (const [id, data] of reservations.entries()) {
            if (data.userId === userId && data.status === 'confirmed') {
              userReservations.push(data);
            }
          }
          
          if (userReservations.length > 0) {
            let message = '📋 ご予約一覧\n\n';
            userReservations.forEach(r => {
              const seatInfo = RESTAURANT_CONFIG.seats[r.seatType];
              message += `予約番号: ${r.id}\n`;
              message += `👥 ${r.people}名様\n`;
              message += `${seatInfo.emoji} ${seatInfo.name}\n`;
              message += `⏰ ${r.time}\n`;
              message += `━━━━━━━━━\n`;
            });
            replyMessages = [{ type: 'text', text: message }];
          } else {
            replyMessages = [{
              type: 'text',
              text: '現在、ご予約はありません。\n\n「予約」または「今すぐ」とお送りください。'
            }];
          }
          
        // キャンセル
        } else if (userMessage === 'キャンセル') {
          const userReservations = [];
          for (const [id, data] of reservations.entries()) {
            if (data.userId === userId && data.status === 'confirmed') {
              userReservations.push(data);
            }
          }
          
          if (userReservations.length > 0) {
            const latest = userReservations.sort((a, b) => b.id - a.id)[0];
            latest.status = 'cancelled';
            reservations.set(latest.id, latest);
            
            replyMessages = [{
              type: 'text',
              text: `予約番号 ${latest.id} をキャンセルしました。\nまたのご利用をお待ちしております。`
            }];
          } else {
            replyMessages = [{
              type: 'text',
              text: 'キャンセル可能な予約がありません。'
            }];
          }
          
        // ヘルプ
        } else if (userMessage === 'ヘルプ' || userMessage === 'help') {
          replyMessages = [{
            type: 'text',
            text: `🍴 ${RESTAURANT_CONFIG.name} 予約システム\n\n` +
                  `【コマンド一覧】\n` +
                  `「予約」「席」 - 事前予約\n` +
                  `「今すぐ」 - 即入店（空席確認）\n` +
                  `「確認」 - 予約確認\n` +
                  `「キャンセル」 - 予約取消\n` +
                  `「ヘルプ」 - この画面\n\n` +
                  `【営業時間】\n` +
                  `ランチ: ${RESTAURANT_CONFIG.hours.lunch.start}-${RESTAURANT_CONFIG.hours.lunch.end}\n` +
                  `ディナー: ${RESTAURANT_CONFIG.hours.dinner.start}-${RESTAURANT_CONFIG.hours.dinner.end}\n\n` +
                  `お気軽にご利用ください！`
          }];
          
        // その他のメッセージ
        } else {
          replyMessages = [{
            type: 'text',
            text: `申し訳ございません。\n以下のコマンドからお選びください：`,
            quickReply: {
              items: [
                { type: 'action', action: { type: 'message', label: '🍴 予約', text: '予約' }},
                { type: 'action', action: { type: 'message', label: '⚡ 今すぐ', text: '今すぐ' }},
                { type: 'action', action: { type: 'message', label: '📋 確認', text: '確認' }},
                { type: 'action', action: { type: 'message', label: '❌ キャンセル', text: 'キャンセル' }},
                { type: 'action', action: { type: 'message', label: '❓ ヘルプ', text: 'ヘルプ' }}
              ]
            }
          }];
        }
        
        // LINE APIで返信
        if (replyMessages.length > 0) {
          const response = await fetch('https://api.line.me/v2/bot/message/reply', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${TOKEN}`
            },
            body: JSON.stringify({
              replyToken: event.replyToken,
              messages: replyMessages
            })
          });
          
          if (!response.ok) {
            const error = await response.text();
            console.error('LINE API Error:', response.status, error);
          }
        }
      }
    }
    
    return res.status(200).end();
    
  } catch (error) {
    console.error('ERROR:', error.message);
    return res.status(200).end();
  }
}

// ヘルパー関数

// 空席状況取得（席番号付き）
function getAvailableSeats() {
  const { seatLayout } = RESTAURANT_CONFIG;
  let status = '';
  
  // カウンター席の空き状況
  const counterAvailable = seatLayout.counter.filter(s => s.status === 'available');
  status += `🪑 カウンター: ${counterAvailable.length}/8席\n`;
  if (counterAvailable.length > 0) {
    status += `  空席: ${counterAvailable.map(s => s.id).join(', ')}\n`;
  }
  
  // テーブル席の空き状況
  const tableAvailable = seatLayout.table.filter(s => s.status === 'available');
  status += `🪑🪑 テーブル: ${tableAvailable.length}/5席\n`;
  if (tableAvailable.length > 0) {
    status += `  空席: ${tableAvailable.map(s => s.id).join(', ')}\n`;
  }
  
  // 個室の空き状況
  const privateAvailable = seatLayout.private.filter(s => s.status === 'available');
  status += `🚪 個室: ${privateAvailable.length}/3室\n`;
  if (privateAvailable.length > 0) {
    status += `  空席: ${privateAvailable.map(s => s.id).join(', ')}\n`;
  }
  
  return status;
}

// 人数に応じた席タイプ推奨
function recommendSeatType(people) {
  if (people === 1) return 'counter';
  if (people <= 4) return 'table';
  return 'private';
}

// 人数に応じた席オプション取得
function getSeatOptions(people) {
  const options = [];
  
  if (people <= 2) {
    options.push({ label: '🪑 カウンター席', text: 'カウンター席' });
  }
  
  if (people <= 4) {
    options.push({ label: '🪑🪑 テーブル席', text: 'テーブル席' });
  }
  
  if (people >= 3) {
    options.push({ label: '🚪 個室', text: '個室' });
  }
  
  return options;
}

// 利用可能な時間枠取得
function getAvailableTimeSlots() {
  const now = new Date();
  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();
  
  return RESTAURANT_CONFIG.timeSlots.filter(slot => {
    const [hour, minute] = slot.split(':').map(Number);
    if (hour > currentHour || (hour === currentHour && minute > currentMinute)) {
      return true;
    }
    return false;
  });
}

// 席の自動割り当て
function assignSeat(people) {
  const { seatLayout } = RESTAURANT_CONFIG;
  
  // 人数に応じて適切な席を探す
  if (people === 1) {
    // カウンター席を優先
    const available = seatLayout.counter.find(s => s.status === 'available');
    if (available) return { ...available, type: 'counter' };
  }
  
  if (people <= 4) {
    // テーブル席を探す
    const available = seatLayout.table.find(s => s.status === 'available');
    if (available) return { ...available, type: 'table' };
    
    // なければ個室も検討
    const privateAvailable = seatLayout.private.find(s => s.status === 'available' && s.capacity >= people);
    if (privateAvailable) return { ...privateAvailable, type: 'private' };
  }
  
  if (people > 4) {
    // 個室を探す
    const available = seatLayout.private.find(s => s.status === 'available' && s.capacity >= people);
    if (available) return { ...available, type: 'private' };
  }
  
  return null; // 空席なし
}

// 席の状態更新
function updateSeatStatus(seatId, status) {
  const { seatLayout } = RESTAURANT_CONFIG;
  
  // 各タイプの席を検索して更新
  for (const type of ['counter', 'table', 'private']) {
    const seat = seatLayout[type].find(s => s.id === seatId);
    if (seat) {
      seat.status = status;
      return true;
    }
  }
  return false;
}