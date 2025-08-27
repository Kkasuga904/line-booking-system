/**
 * 予約確認メッセージ送信API
 * POST /api/send-confirmation
 */

import { createClient } from '@supabase/supabase-js';
import { getEnv } from '../utils/env-helper.js';

const SUPABASE_URL = '***REMOVED-ROTATE-CREDENTIAL***';
const SUPABASE_ANON_KEY = '***REMOVED-ROTATE-CREDENTIAL***';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// LINEメッセージ送信
async function sendLineMessage(userId, message) {
  const accessToken = getEnv('LINE_CHANNEL_ACCESS_TOKEN');
  if (!accessToken || !userId || userId === 'admin-manual') {
    return { success: false, error: 'LINE設定がないか、手動予約です' };
  }
  
  try {
    const response = await fetch('https://api.line.me/v2/bot/message/push', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      },
      body: JSON.stringify({
        to: userId,
        messages: [message]
      })
    });
    
    if (!response.ok) {
      const error = await response.text();
      console.error('LINE API error:', error);
      return { success: false, error };
    }
    
    return { success: true };
  } catch (error) {
    console.error('Failed to send LINE message:', error);
    return { success: false, error: error.message };
  }
}

// 予約確認メッセージを作成
function createConfirmationMessage(reservation) {
  const days = ['日', '月', '火', '水', '木', '金', '土'];
  const date = new Date(reservation.date);
  const dayOfWeek = days[date.getDay()];
  const formattedDate = `${date.getMonth() + 1}月${date.getDate()}日(${dayOfWeek})`;
  const time = reservation.time.substring(0, 5);
  
  // Flex Messageで見やすい確認メッセージ
  return {
    type: 'flex',
    altText: '✅ ご予約を承りました',
    contents: {
      type: 'bubble',
      size: 'kilo',
      header: {
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            type: 'text',
            text: '✅ ご予約完了',
            weight: 'bold',
            size: 'lg',
            color: '#ffffff'
          },
          {
            type: 'text',
            text: 'ご予約ありがとうございます',
            size: 'sm',
            color: '#ffffff99'
          }
        ],
        backgroundColor: '#06c755',
        paddingAll: '15px'
      },
      body: {
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            type: 'box',
            layout: 'horizontal',
            contents: [
              {
                type: 'text',
                text: '予約ID',
                size: 'sm',
                color: '#999999',
                flex: 0,
                width: '70px'
              },
              {
                type: 'text',
                text: `#${reservation.id}`,
                size: 'sm',
                color: '#333333',
                weight: 'bold'
              }
            ]
          },
          {
            type: 'separator',
            margin: 'md'
          },
          {
            type: 'box',
            layout: 'horizontal',
            contents: [
              {
                type: 'text',
                text: '📅 日付',
                size: 'sm',
                flex: 0,
                width: '70px'
              },
              {
                type: 'text',
                text: formattedDate,
                size: 'sm',
                weight: 'bold'
              }
            ],
            margin: 'md'
          },
          {
            type: 'box',
            layout: 'horizontal',
            contents: [
              {
                type: 'text',
                text: '⏰ 時間',
                size: 'sm',
                flex: 0,
                width: '70px'
              },
              {
                type: 'text',
                text: time,
                size: 'sm',
                weight: 'bold'
              }
            ],
            margin: 'md'
          },
          {
            type: 'box',
            layout: 'horizontal',
            contents: [
              {
                type: 'text',
                text: '👥 人数',
                size: 'sm',
                flex: 0,
                width: '70px'
              },
              {
                type: 'text',
                text: `${reservation.people}名様`,
                size: 'sm',
                weight: 'bold'
              }
            ],
            margin: 'md'
          },
          reservation.seat_name ? {
            type: 'box',
            layout: 'horizontal',
            contents: [
              {
                type: 'text',
                text: '🪑 お席',
                size: 'sm',
                flex: 0,
                width: '70px'
              },
              {
                type: 'text',
                text: reservation.seat_name,
                size: 'sm',
                weight: 'bold'
              }
            ],
            margin: 'md'
          } : {
            type: 'spacer',
            size: 'sm'
          }
        ],
        paddingAll: '15px'
      },
      footer: {
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            type: 'box',
            layout: 'vertical',
            contents: [
              {
                type: 'text',
                text: '⚠️ ご注意事項',
                size: 'xs',
                color: '#999999',
                weight: 'bold'
              },
              {
                type: 'text',
                text: '• キャンセルは前日までにお願いします',
                size: 'xxs',
                color: '#999999',
                margin: 'sm'
              },
              {
                type: 'text',
                text: '• 遅れる場合はご連絡ください',
                size: 'xxs',
                color: '#999999'
              }
            ],
            backgroundColor: '#f5f5f5',
            paddingAll: '10px',
            cornerRadius: '8px'
          },
          {
            type: 'separator',
            margin: 'md'
          },
          {
            type: 'box',
            layout: 'horizontal',
            contents: [
              {
                type: 'button',
                action: {
                  type: 'message',
                  label: '予約確認',
                  text: '予約確認'
                },
                style: 'secondary',
                height: 'sm'
              },
              {
                type: 'button',
                action: {
                  type: 'message',
                  label: 'キャンセル',
                  text: '予約キャンセル'
                },
                style: 'secondary',
                height: 'sm',
                margin: 'md'
              }
            ],
            margin: 'md'
          }
        ],
        paddingAll: '10px'
      }
    }
  };
}

export default async function handler(req, res) {
  // CORS設定
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  try {
    const { reservationId, userId, customMessage } = req.body;
    
    if (!reservationId) {
      return res.status(400).json({ error: '予約IDが必要です' });
    }
    
    // 予約情報を取得
    const { data: reservation, error } = await supabase
      .from('reservations')
      .select(`
        *,
        seats (
          name,
          seat_type
        )
      `)
      .eq('id', reservationId)
      .single();
    
    if (error || !reservation) {
      return res.status(404).json({ error: '予約が見つかりません' });
    }
    
    // 席名を追加
    if (reservation.seats) {
      reservation.seat_name = reservation.seats.name;
    }
    
    // LINE送信先を決定（userIdが指定されていればそれを使用、なければ予約のuser_idを使用）
    const targetUserId = userId || reservation.user_id;
    
    // メッセージを作成
    const message = customMessage || createConfirmationMessage(reservation);
    
    // LINE送信
    const result = await sendLineMessage(targetUserId, message);
    
    return res.status(200).json({
      success: result.success,
      message: result.success ? '確認メッセージを送信しました' : '送信に失敗しました',
      error: result.error,
      reservation: {
        id: reservation.id,
        date: reservation.date,
        time: reservation.time,
        people: reservation.people,
        seat_name: reservation.seat_name
      }
    });
    
  } catch (error) {
    console.error('Send confirmation error:', error);
    return res.status(500).json({
      error: 'サーバーエラーが発生しました',
      details: error.message
    });
  }
}