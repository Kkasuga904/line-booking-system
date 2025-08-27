/**
 * 統合管理API - すべての管理機能を一つのエンドポイントに集約
 * POST /api/admin?action=auth
 * POST /api/admin?action=create
 * DELETE /api/admin?action=delete&id=xxx
 * GET /api/admin?action=supabase
 */

import { createClient } from '@supabase/supabase-js';
import { getEnv } from '../utils/env-helper.js';

// Supabase初期化
const SUPABASE_URL = '***REMOVED-ROTATE-CREDENTIAL***';
const SUPABASE_ANON_KEY = '***REMOVED-ROTATE-CREDENTIAL***';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export default async function handler(req, res) {
  // CORS設定
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  // URLパラメータからactionを取得
  const url = new URL(req.url, `http://${req.headers.host}`);
  const action = url.searchParams.get('action');
  
  if (!action) {
    return res.status(400).json({ error: 'actionパラメータが必要です' });
  }
  
  try {
    switch (action) {
      case 'auth':
        return await handleAuth(req, res);
      case 'create':
        return await handleCreate(req, res);
      case 'delete':
        return await handleDelete(req, res, url);
      case 'supabase':
        return await handleSupabase(req, res);
      default:
        return res.status(400).json({ error: `不正なaction: ${action}` });
    }
  } catch (error) {
    console.error(`Admin API error (${action}):`, error);
    return res.status(500).json({
      error: 'サーバーエラーが発生しました',
      details: error.message
    });
  }
}

// 認証処理
async function handleAuth(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  const { password } = req.body;
  
  if (!password) {
    return res.status(400).json({
      error: 'パスワードを入力してください'
    });
  }
  
  // 環境変数から管理者パスワードを取得
  const adminPassword = getEnv('ADMIN_PASSWORD', 'admin2024');
  
  // パスワード検証
  if (password !== adminPassword) {
    // セキュリティのため、少し遅延を入れる（ブルートフォース対策）
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    return res.status(401).json({
      error: 'パスワードが正しくありません'
    });
  }
  
  // 認証成功 - トークンを生成（簡易版）
  const token = Buffer.from(`admin:${Date.now()}`).toString('base64');
  
  return res.status(200).json({
    success: true,
    message: '認証成功',
    token: token,
    expiresIn: 3600 // 1時間有効
  });
}

// 予約作成処理
async function handleCreate(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  // アクションタイプで分岐
  const { action: subAction } = req.body;
  
  if (subAction === 'send-confirmation') {
    return handleSendConfirmation(req, res);
  }
  
  const {
    customer_name,
    date,
    time,
    people,
    message,
    phone,
    email,
    seat_id
  } = req.body;
  
  // 必須項目チェック
  if (!customer_name || !date || !time || !people) {
    return res.status(400).json({ 
      error: '必須項目が不足しています',
      required: ['customer_name', 'date', 'time', 'people']
    });
  }
  
  // 人数チェック（1-20名）
  const peopleNum = parseInt(people);
  if (peopleNum < 1 || peopleNum > 20) {
    return res.status(400).json({ 
      error: '人数は1〜20名の範囲で指定してください' 
    });
  }
  
  // 日付チェック（過去日付は不可）
  const today = new Date().toISOString().split('T')[0];
  if (date < today) {
    return res.status(400).json({ 
      error: '過去の日付は指定できません' 
    });
  }
  
  // store_idを環境変数から取得
  const storeId = getEnv('STORE_ID', '***REMOVED-ROTATE-CREDENTIAL***');
  const storeName = getEnv('STORE_NAME', 'レストラン');
  
  // 予約データ作成
  const reservationData = {
    store_id: storeId,
    store_name: decodeURIComponent(storeName),
    user_id: 'admin-manual', // 管理画面から手動追加
    customer_name: customer_name,
    date: date,
    time: time + ':00', // HH:MM を HH:MM:SS形式に
    people: peopleNum,
    message: message || null,
    phone: phone || null,
    email: email || null,
    seat_id: seat_id || null, // 席ID（オプション）
    status: 'pending',
    created_at: new Date().toISOString()
  };
  
  console.log('Creating reservation:', reservationData);
  
  // Supabaseに保存
  const { data, error } = await supabase
    .from('reservations')
    .insert([reservationData])
    .select();
  
  if (error) {
    console.error('Insert error:', error);
    return res.status(500).json({ 
      error: '予約の作成に失敗しました',
      details: error.message 
    });
  }
  
  console.log('Successfully created reservation:', data[0]);
  
  // 席名を取得（席IDが設定されている場合）
  if (data[0].seat_id) {
    const { data: seat } = await supabase
      .from('seats')
      .select('name')
      .eq('id', data[0].seat_id)
      .single();
    
    if (seat) {
      data[0].seat_name = seat.name;
    }
  }
  
  // 確認メッセージ送信フラグが設定されていて、user_idがある場合
  const { sendConfirmation, userId } = req.body;
  if (sendConfirmation && userId && userId !== 'admin-manual') {
    const message = createConfirmationMessage(data[0]);
    const result = await sendLineMessage(userId, message);
    console.log('Confirmation message sent:', result);
  }
  
  return res.status(200).json({
    success: true,
    message: '予約を作成しました',
    reservation: data[0]
  });
}

// 予約削除処理
async function handleDelete(req, res, url) {
  if (req.method !== 'DELETE') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  // URLパラメータから予約IDを取得
  const reservationId = url.searchParams.get('id');
  
  if (!reservationId) {
    return res.status(400).json({ 
      error: '予約IDが指定されていません' 
    });
  }
  
  console.log('Deleting reservation:', reservationId);
  
  // 予約を削除（物理削除）
  const { data, error } = await supabase
    .from('reservations')
    .delete()
    .eq('id', reservationId)
    .select();
  
  if (error) {
    console.error('Delete error:', error);
    return res.status(500).json({ 
      error: '削除に失敗しました',
      details: error.message 
    });
  }
  
  if (!data || data.length === 0) {
    return res.status(404).json({ 
      error: '指定された予約が見つかりません' 
    });
  }
  
  console.log('Successfully deleted reservation:', data[0]);
  
  return res.status(200).json({
    success: true,
    message: '予約を削除しました',
    deleted: data[0]
  });
}

// Supabaseデータ取得処理
async function handleSupabase(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  // store_idを取得（環境変数またはデフォルト）
  const storeId = (process.env.STORE_ID || '***REMOVED-ROTATE-CREDENTIAL***').trim();
  console.log('Fetching reservations for store_id:', storeId);
  
  // 予約データを取得（席情報も含む）
  const { data: reservations, error, count } = await supabase
    .from('reservations')
    .select(`
      *,
      seats (
        id,
        name,
        seat_type,
        capacity
      )
    `, { count: 'exact' })
    .eq('store_id', storeId)
    .order('created_at', { ascending: false })
    .limit(100);
  
  // 席情報を予約データに統合
  const data = reservations ? reservations.map(r => ({
    ...r,
    seat_name: r.seats?.name || null,
    seat_type: r.seats?.seat_type || null,
    seat_capacity: r.seats?.capacity || null
  })) : [];
  
  if (error) {
    console.error('Supabase fetch error:', error);
    return res.status(500).json({ 
      error: 'データの取得に失敗しました',
      details: error.message
    });
  }
  
  console.log(`Successfully fetched ${data.length} reservations (total: ${count})`);
  
  return res.status(200).json({
    success: true,
    data: data,
    count: count,
    storeId: storeId
  });
}

// 確認メッセージ送信用のハンドラー
async function handleSendConfirmation(req, res) {
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
}

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

/**
 * 認証トークン検証ヘルパー関数
 * 他のAPIで使用可能
 */
export function verifyAdminToken(token) {
  if (!token) return false;
  
  try {
    const decoded = Buffer.from(token, 'base64').toString();
    const [role, timestamp] = decoded.split(':');
    
    // 管理者権限チェック
    if (role !== 'admin') return false;
    
    // トークン有効期限チェック（1時間）
    const tokenAge = Date.now() - parseInt(timestamp);
    if (tokenAge > 3600000) return false; // 1時間 = 3600000ms
    
    return true;
  } catch (error) {
    return false;
  }
}