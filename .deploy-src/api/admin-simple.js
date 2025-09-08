/**
 * 管理API（シンプル版）
 * Supabase依存なしで動作するフォールバック版
 */

export default async function handler(req, res) {
  // CORS設定
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  const url = new URL(req.url, `http://${req.headers.host}`);
  const action = url.searchParams.get('action');
  
  if (!action) {
    return res.status(400).json({ error: 'actionパラメータが必要です' });
  }
  
  try {
    switch (action) {
      case 'auth':
        return handleAuth(req, res);
      case 'list':
        return handleList(req, res);
      case 'create':
        return handleCreate(req, res);
      case 'update':
        return handleUpdate(req, res);
      case 'delete':
        return handleDelete(req, res);
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
function handleAuth(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  const { password } = req.body;
  
  if (!password) {
    return res.status(400).json({
      error: 'パスワードを入力してください'
    });
  }
  
  // デフォルトパスワード
  const adminPassword = process.env.ADMIN_PASSWORD || 'admin2024';
  
  if (password !== adminPassword) {
    return res.status(401).json({
      error: 'パスワードが正しくありません'
    });
  }
  
  // 認証成功
  const token = Buffer.from(`admin:${Date.now()}`).toString('base64');
  
  return res.status(200).json({
    success: true,
    message: '認証成功',
    token: token,
    expiresIn: 3600
  });
}

// 予約一覧取得（ダミーデータ）
function handleList(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  // ダミーデータを返す
  const dummyReservations = [
    {
      id: 1,
      customer_name: 'テスト太郎',
      phone: '090-1234-5678',
      date: new Date().toISOString().split('T')[0],
      time: '18:00',
      people: 2,
      status: 'confirmed',
      created_at: new Date().toISOString()
    }
  ];
  
  return res.status(200).json({
    reservations: dummyReservations,
    total: dummyReservations.length,
    message: 'Using fallback data (database not connected)'
  });
}

// 予約作成
function handleCreate(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  const {
    customer_name,
    customerName,
    customerPhone,
    date,
    time,
    people,
    message,
    notes,
    phone,
    email,
    seat_id
  } = req.body;
  
  const finalCustomerName = customer_name || customerName;
  const finalPhone = phone || customerPhone;
  const finalMessage = message || notes;
  const finalPeople = people || 1;
  
  if (!finalCustomerName || !date || !time) {
    return res.status(400).json({ 
      error: '必須項目が不足しています',
      required: ['customerName', 'date', 'time']
    });
  }
  
  // ダミーの予約データを作成
  const newReservation = {
    id: Date.now(),
    customer_name: finalCustomerName,
    phone: finalPhone || '',
    email: email || '',
    date: date,
    time: time,
    people: finalPeople,
    message: finalMessage || '',
    seat_id: seat_id || null,
    status: 'confirmed',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
  
  return res.status(200).json({
    success: true,
    reservation: newReservation,
    message: '予約を作成しました（ローカルモード）'
  });
}

// 予約更新
function handleUpdate(req, res) {
  if (req.method !== 'PUT') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  const { id, ...updates } = req.body;
  
  if (!id) {
    return res.status(400).json({ error: 'IDが必要です' });
  }
  
  return res.status(200).json({
    success: true,
    id: id,
    updates: updates,
    message: '予約を更新しました（ローカルモード）'
  });
}

// 予約削除
function handleDelete(req, res) {
  if (req.method !== 'DELETE') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  const url = new URL(req.url, `http://${req.headers.host}`);
  const id = url.searchParams.get('id');
  
  if (!id) {
    return res.status(400).json({ error: 'IDが必要です' });
  }
  
  return res.status(200).json({
    success: true,
    id: id,
    message: '予約を削除しました（ローカルモード）'
  });
}