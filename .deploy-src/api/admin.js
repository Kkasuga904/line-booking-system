/**
 * 統合管理API - すべての管理機能を一つのエンドポイントに集約
 * POST /api/admin?action=auth
 * POST /api/admin?action=create
 * DELETE /api/admin?action=delete&id=xxx
 * GET /api/admin?action=supabase
 */

import { createClient } from '@supabase/supabase-js';
import { getEnv } from '../utils/env-helper.js';
import { getStoreId } from '../utils/store-config.js';
import { authenticateMultiple } from '../middleware/jwt-auth.js';
import crypto from 'crypto';

// Supabase初期化 - 環境変数から取得
const SUPABASE_URL = getEnv('SUPABASE_URL', 'https://faenvzzeguvlconvrqgp.supabase.co');
const SUPABASE_ANON_KEY = getEnv('SUPABASE_ANON_KEY');
const SUPABASE_SERVICE_ROLE_KEY = getEnv('SUPABASE_SERVICE_ROLE_KEY');

if (!SUPABASE_ANON_KEY) {
  console.error('ERROR: SUPABASE_ANON_KEY is not set in environment variables');
  throw new Error('SUPABASE_ANON_KEY is required');
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// サービスロールクライアント（RLSバイパス用）- 専門家推奨
const supabaseAdmin = SUPABASE_SERVICE_ROLE_KEY 
  ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { 
      auth: { persistSession: false } 
    })
  : supabase; // フォールバック

export default async function handler(req, res) {
  // CORS設定
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Idempotency-Key');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  // URLパラメータからactionを取得
  const url = new URL(req.url, `http://${req.headers.host}`);
  const rawAction = url.searchParams.get('action');
  
  // actionパラメータの詳細ログ
  console.log('Admin API Request:', {
    method: req.method,
    url: req.url,
    rawAction: rawAction,
    actionType: typeof rawAction,
    actionValue: rawAction ? rawAction : 'null',
    allParams: Array.from(url.searchParams.entries())
  });
  
  // アクションパラメータの正規化と検証
  let action = null;
  
  if (rawAction) {
    // 文字列に変換し、小文字化
    action = String(rawAction).toLowerCase().trim();
    
    // コロンが含まれる場合は最初の部分だけ取る（例: "create:1" -> "create"）
    if (action.includes(':')) {
      console.log('Action contains colon, extracting first part:', action);
      action = action.split(':')[0];
    }
    
    // 不正な文字を除去（英数字とハイフンのみ許可）
    action = action.replace(/[^a-z0-9-]/g, '');
    
    // 末尾の数字を除去（例: "create1" -> "create"）
    if (/^(create|update|delete|list|auth|supabase)\d+$/.test(action)) {
      console.log('Action has trailing numbers, removing:', action);
      action = action.replace(/\d+$/, '');
    }
    
    // 空文字になった場合はnullに
    if (action === '') {
      action = null;
    }
  }
  
  console.log('Processed action:', {
    raw: rawAction,
    normalized: action
  });
  
  // GETリクエストでactionがない場合はヘルスチェック
  if (!action && req.method === 'GET') {
    const now = new Date();
    const timestamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}T${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
    return res.status(200).json({ 
      status: 'healthy',
      endpoint: 'admin',
      timestamp: timestamp
    });
  }
  
  // actionパラメータのバリデーション
  const validActions = ['auth', 'list', 'create', 'update', 'delete', 'supabase'];
  
  if (!action) {
    return res.status(400).json({ 
      error: 'actionパラメータが必要です',
      received: rawAction,
      validActions: validActions
    });
  }
  
  if (!validActions.includes(action)) {
    return res.status(400).json({ 
      error: 'actionパラメータが無効です',
      received: rawAction,
      normalized: action,
      validActions: validActions
    });
  }
  
  // JWT認証チェック（authアクション以外は認証必須）
  // ADMIN_AUTH_MODE=offの場合は認証処理全体をスキップ（専門家推奨）
  const mode = process.env.ADMIN_AUTH_MODE || 'on';
  
  if (action !== 'auth' && mode !== 'off') {
    // 認証ミドルウェアを適用
    const authMiddleware = authenticateMultiple();
    
    // ミドルウェアを実行し、認証エラーがあれば処理を中断
    await new Promise((resolve, reject) => {
      authMiddleware(req, res, (err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    }).catch((authError) => {
      console.error('Authentication failed:', authError);
      // レスポンスが送信されていない場合のみエラーレスポンスを送信
      if (!res.headersSent) {
        return res.status(401).json({ 
          error: 'Authentication required'
        });
      }
      return;
    });
    
    // 認証が成功した場合、req.userが設定されている
    if (!req.user && action !== 'auth') {
      console.log('Authentication failed - no req.user set');
      return res.status(401).json({ 
        error: 'Authentication required'
      });
    }
    
    console.log('Authentication successful:', {
      userEmail: req.user?.email,
      authType: req.user ? 'JWT' : 'API key'
    });
  }
  
  try {
    // createアクションの事前処理
    if (action === 'create') {
      const b = req.body || {};
      
      // ============================================================
      // 【重要】時間フォーマットはserver.jsのミドルウェアで正規化済み
      // ここでは絶対に:00を追加しない（二重付与防止）
      // 参照: /docs/KNOWLEDGE_TIME_FORMAT_FIX.md
      // ============================================================
      
      // seat_idがUUID形式でない場合はnullに矯正
      if (b.seat_id && !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(b.seat_id)) {
        console.log('Invalid seat_id detected, setting to null:', b.seat_id);
        b.seat_id = null;
      }
      
      // 明らかにおかしいuser_idを無効化（"T2"のような座席コード混入）
      if (typeof b.user_id === 'string' && (/^[A-Z]\d+$/i.test(b.user_id) || b.user_id.length < 10)) {
        console.log('Invalid user_id detected, removing:', b.user_id);
        delete b.user_id; // 削除してサーバー側で設定させる
      }
      
      // ============================================================
      // 【アーキテクチャ変更】2025-09-02
      // global.__create_guard を完全廃止
      // データベースレベルのUNIQUE制約で重複検出を実装
      // 参照: /migrations/001_add_unique_constraint.sql
      // ============================================================
      // 以前のメモリベースの重複検出は削除されました
      // 新しい実装はhandleCreate関数内でDB制約により処理されます
    }
    
    switch (action) {
      case 'auth':
        return await handleAuth(req, res);
      case 'list':
        return await handleList(req, res);
      case 'create':
        return await handleCreate(req, res);
      case 'update':
        return await handleUpdate(req, res, url);
      case 'delete':
        return await handleDelete(req, res, url);
      case 'supabase':
        return await handleSupabase(req, res);
      default:
        // ここには到達しないはず（事前検証済み）
        console.error('Unexpected action in switch:', action);
        return res.status(500).json({ 
          error: 'Internal server error',
          message: 'Unexpected action value after validation'
        });
    }
  } catch (e) {
    // ここで"何が落ちたか"を確実に取る
    console.error('[admin] fatal error:', {
      url: req.originalUrl,
      method: req.method,
      query: req.query,
      body: req.body,
      action: action,
      error: e?.message,
      stack: e?.stack,
    });
    return res.status(500).json({ 
      error: 'Admin API failed', 
      message: e?.message,
      action: action,
      details: process.env.NODE_ENV === 'development' ? e?.stack : undefined
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

// 予約一覧取得処理
async function handleList(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  try {
    // サーバー側で強制決定されたstore_idを使用
    const store_id = req.store_id;
    
    console.log('Fetching reservations for store:', store_id);
    
    // FullCalendarから来る期間パラメータ
    const { start, end } = req.query;
    
    // supabaseAdminを使用（RLSバイパス）- 専門家推奨
    let query = supabaseAdmin
      .from('reservations')
      .select('id, store_id, store_name, user_id, customer_name, date, time, people, message, phone, email, seat_id, seat_code, status, created_at, updated_at, source')
      .eq('store_id', store_id);
    
    // date が 'YYYY-MM-DD' で保存されている前提
    if (start && end) {
      const s = start.slice(0, 10);
      const e = end.slice(0, 10);
      query = query.gte('date', s).lte('date', e);
      console.log(`Date range filter: ${s} to ${e}`);
    }
    
    const { data, error } = await query
      .order('date', { ascending: true })
      .order('time', { ascending: true })
      .limit(200);
    
    if (error) {
      // ← ブラウザ時だけ失敗していないかを見たい
      console.error('Supabase error:', error);
      return res.status(502).json({ 
        error: 'supabase error',
        details: error.message 
      });
    }
    
    // デバッグ：取得したデータの最初の1件を確認
    if (data && data.length > 0) {
      console.log('Sample reservation from DB:', {
        id: data[0].id,
        customer_name: data[0].customer_name,
        seat_id: data[0].seat_id,
        seat_code: data[0].seat_code,
        has_seat_code: 'seat_code' in data[0]
      });
    }
    
    // データを整形（admin-full-featured.htmlが期待する形式に変換）
    // 日付と時間を確実に文字列として返す（Dateオブジェクトを経由しない）
    const rows = (data || []).map(r => {
      // 日付の文字列化（toISOStringを使わない、Dateオブジェクトも使わない）
      let dateStr = '';
      
      // デバッグ：元データの確認
      console.log(`[DEBUG] Processing date for ID ${r.id}:`, {
        date_raw: r.date,
        date_type: typeof r.date,
        date_instanceof_date: r.date instanceof Date
      });
      
      if (typeof r.date === 'string') {
        // 文字列の場合、T区切りがあれば日付部分のみ取得、なければそのまま使用
        if (r.date.includes('T')) {
          dateStr = r.date.split('T')[0];
        } else if (r.date.includes(' ')) {
          // スペース区切りの場合も日付部分のみ
          dateStr = r.date.split(' ')[0];
        } else {
          // すでにYYYY-MM-DD形式の場合はそのまま
          dateStr = r.date;
        }
        
        // 日付形式の検証（YYYY-MM-DD形式であることを確認）
        if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
          console.warn(`[DEBUG] Invalid date format for ID ${r.id}: ${dateStr}`);
        }
        
        console.log(`[DEBUG] String date processed: ${r.date} → ${dateStr}`);
      } else if (r.date instanceof Date) {
        // Dateオブジェクトの場合は避けるべきだが、念のため処理
        // UTCを使わず、ローカル時間として処理
        const y = r.date.getFullYear();
        const m = String(r.date.getMonth() + 1).padStart(2, '0');
        const d = String(r.date.getDate()).padStart(2, '0');
        dateStr = `${y}-${m}-${d}`;
        console.warn(`[DEBUG] Date object found (should be avoided):`, {
          original: r.date,
          result: dateStr
        });
      } else {
        dateStr = String(r.date ?? '');
        console.log(`[DEBUG] Other type processed: ${r.date} → ${dateStr}`);
      }
      
      // 時間の文字列化とフォーマット調整（秒を補完）
      let timeStr = r.time ?? '';
      if (typeof timeStr !== 'string') timeStr = String(timeStr ?? '');
      
      // HH:MM形式の場合は:00を追加、それ以外はそのまま
      if (/^\d{2}:\d{2}$/.test(timeStr)) {
        timeStr += ':00';
      } else if (timeStr.length > 8) {
        // HH:MM:SS.xxx などの場合は秒まで切り取る
        timeStr = timeStr.slice(0, 8);
      }
      
      return {
        id: r.id,
        customer_name: r.customer_name,  // フロントエンドが期待する形式も追加
        customerName: r.customer_name,
        date: dateStr,  // 確実に"YYYY-MM-DD"形式の文字列
        time: timeStr,  // 確実に"HH:MM:SS"形式の文字列
        people: r.people || 0,
        numberOfPeople: r.people || 0, // ← ここで undefined による例外を避ける
        status: r.status,
        message: r.message,
        phone: r.phone,
        email: r.email,
        seatId: r.seat_id,
        seat_id: r.seat_id,
        seat_code: r.seat_code,  // 席コードを追加
        createdAt: r.created_at,
        updatedAt: r.updated_at
      };
    });
    
    console.log(`Found ${rows.length} reservations for store ${store_id}`);
    
    // 専門家推奨: ok:true と items を返す
    return res.status(200).json({
      ok: true,
      success: true, // 互換性のため両方を含める
      items: rows,  // 専門家推奨形式
      data: rows,   // 互換性
      rows: rows,   // 互換性
      count: rows.length
    });
  } catch (e) {
    console.error('[handleList] error:', {
      msg: e?.message,
      stack: e?.stack
    });
    return res.status(500).json({ 
      error: 'Failed to fetch reservations', 
      message: e?.message 
    });
  }
}

// 予約作成処理
async function handleCreate(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  // Idempotency-Keyヘッダーを取得
  const idempotencyKey = req.headers['idempotency-key'] || req.headers['Idempotency-Key'];
  
  // アクションタイプで分岐
  const { action: subAction } = req.body;
  
  if (subAction === 'send-confirmation') {
    return handleSendConfirmation(req, res);
  }
  
  const {
    customer_name,
    customerName,  // フロントからの両方のキーに対応
    date,
    time,
    people,
    numberOfPeople,  // フロントからの別キー
    message,
    notes,  // フロントからの別キー
    phone,
    phoneNumber,  // フロントからの別キー
    email,
    seat_id,
    seat_code
  } = req.body;
  
  // キー名の統一
  const name = customer_name || customerName || '予約';
  const peopleCount = Number(people || numberOfPeople || 1);
  const phoneNum = phone || phoneNumber || null;
  const messageText = message || notes || null;
  
  // サーバー側で強制決定されたstore_idを使用
  const store_id = req.store_id;
  
  // 最低限のバリデーション
  if (!date || !time) {
    return res.status(400).json({ 
      ok: false, 
      error: 'date/time is required' 
    });
  }
  
  // データ作成前の詳細ログ（専門家推奨）
  console.log('Creating reservation - input validation:', {
    customer_name: name,
    date: date,
    time: time,
    people: peopleCount,
    seat_id: seat_id,
    seat_code: seat_code,
    store_id: store_id,
    phone: phoneNum,
    email: email,
    message: messageText
  });
  
  // 詳細なバリデーション（専門家推奨）
  const problems = [];
  
  if (!name) problems.push('customer_name is required');
  if (!date) problems.push('date is required');
  if (!time) problems.push('time is required');
  
  // 時間の正規化
  let timeStr = time;
  if (timeStr && timeStr.length > 8) {
    timeStr = timeStr.slice(0, 8); // "09:30:00.000Z" → "09:30:00"
  }
  if (timeStr && !/^\d{2}:\d{2}(:\d{2})?$/.test(timeStr)) {
    problems.push(`time format invalid: ${timeStr} (expected HH:MM or HH:MM:SS)`);
  }
  
  // 人数のバリデーション（文字列やnullに対応）
  const peopleNum = parseInt(peopleCount) || 0;
  if (peopleNum < 1 || peopleNum > 20) {
    problems.push(`people must be 1-20: ${peopleCount} (type: ${typeof peopleCount})`);
  }
  
  if (problems.length > 0) {
    console.log('Validation failed:', {
      problems,
      body: req.body,
      bodyType: typeof req.body,
      peopleType: typeof peopleCount
    });
    return res.status(400).json({ 
      error: 'Validation failed',
      problems: problems,
      received: {
        customer_name: name,
        date,
        time: timeStr,
        people: peopleCount,
        peopleType: typeof peopleCount
      }
    });
  }
  
  // 日付チェック（過去日付は不可）
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  if (date < today) {
    return res.status(400).json({ 
      error: '過去の日付は指定できません' 
    });
  }
  
  // 店舗名を取得（store_idは既に上で設定済み）
  const storeName = getEnv('STORE_NAME', 'レストラン');
  
  // UUID形式チェック
  const isValidUUID = (str) => {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(str);
  };
  
  // 予約データ作成（store_idは上で定義済み）
  const reservationData = {
    store_id: store_id,
    store_name: decodeURIComponent(storeName),
    user_id: 'admin-manual', // 管理画面から手動追加
    customer_name: name,  // 統一した名前を使用
    date: date,
    time: timeStr, // 正規化済みの時間
    people: peopleNum,
    message: messageText || null,  // 統一したメッセージ
    phone: phoneNum || null,  // 統一した電話番号
    email: email || null,
    seat_id: (seat_id && isValidUUID(seat_id)) ? seat_id : null, // UUID形式の場合のみ
    seat_code: seat_code || seat_id || null, // 席コード（T1, T2など）
    status: 'confirmed',
    source: 'admin',
    created_at: new Date()  // Supabaseが自動で処理
  };
  
  console.log('Creating reservation with seat info:', {
    seat_id_received: seat_id,
    seat_code_received: seat_code,
    seat_id_saving: reservationData.seat_id,
    seat_code_saving: reservationData.seat_code,
    full_data: reservationData
  });
  
  // Idempotency-Keyのサポート（必須フィールド）
  if (idempotencyKey) {
    reservationData.idempotency_key = idempotencyKey;
    console.log('Using Idempotency-Key:', idempotencyKey);
  } else {
    // Idempotency-Keyがない場合は必ず自動生成
    const fallbackKey = crypto.randomUUID();
    reservationData.idempotency_key = fallbackKey;
    console.log('Generated fallback Idempotency-Key:', fallbackKey);
  }
  
  // ログ出力（デバッグ用）
  console.log('[create] idempo(before):', reservationData.idempotency_key, 'path=', req.path, 'action=', req.query?.action);
  
  // 作成前の最終整形: NULLを送らない（専門家推奨）
  if (!reservationData.idempotency_key) {
    // NULLの場合はフィールド自体を削除（DBのDEFAULTが効くように）
    delete reservationData.idempotency_key;
    console.log('Deleting null idempotency_key to allow DB DEFAULT');
  }
  
  // 通常のINSERT（UPSERTはインデックス名が必要なため一旦通常のINSERTに戻す）
  const { data, error } = await supabaseAdmin
    .from('reservations')
    .insert([reservationData])
    .select('*')
    .single();
  
  // ログ出力（デバッグ用）
  console.log('[create] idempo(after):', data?.idempotency_key);
  
  if (error) {
    console.error('Upsert error:', error);
    
    // PostgreSQLのユニーク制約違反エラーを検出
    // error.code: '23505' = unique_violation
    // error.details に制約名が含まれる
    if (error.code === '23505') {
      // 制約名で判定
      if (error.message?.includes('idempotency_key') || 
          error.details?.includes('idempotency_key')) {
        // Idempotency-Keyの重複（同じリクエストが既に処理済み）
        console.log('Idempotency key collision detected, fetching existing reservation');
        
        // 既存の予約を取得して返す
        const { data: existingData, error: fetchError } = await supabase
          .from('reservations')
          .select('*')
          .eq('idempotency_key', reservationData.idempotency_key)
          .single();
        
        if (!fetchError && existingData) {
          return res.status(200).json({
            success: true,
            message: '予約が既に作成されています（重複リクエスト）',
            reservation: existingData,
            data: existingData,
            idempotent: true
          });
        }
      }
      
      if (error.message?.includes('unique_reservation_slot') || 
          error.details?.includes('unique_reservation_slot')) {
        // 時間枠の重複（同じ席が既に予約されている）
        return res.status(409).json({ 
          error: 'slot_taken',
          message: 'この時間帯の席は既に予約されています',
          details: {
            date: date,
            time: time,
            seat: seat_code || seat_id || '指定席'
          }
        });
      }
      
      // その他のユニーク制約違反
      return res.status(409).json({ 
        error: 'constraint_violation',
        message: '予約の作成に失敗しました（重複）',
        details: error.message
      });
    }
    
    // その他のエラー
    return res.status(500).json({ 
      error: '予約の作成に失敗しました',
      details: error.message 
    });
  }
  
  console.log('Successfully created reservation:', data);
  
  // 席名を取得（席IDが設定されている場合）
  if (data && data.seat_id) {
    const { data: seat } = await supabaseAdmin
      .from('seats')
      .select('name')
      .eq('id', data.seat_id)
      .single();
    
    if (seat) {
      data.seat_name = seat.name;
    }
  }
  
  // 確認メッセージ送信フラグが設定されていて、user_idがある場合
  const { sendConfirmation, userId } = req.body;
  if (sendConfirmation && userId && userId !== 'admin-manual') {
    const message = createConfirmationMessage(data);
    const result = await sendLineMessage(userId, message);
    console.log('Confirmation message sent:', result);
  }
  
  // 専門家推奨: ok:true と item を返す
  return res.status(200).json({
    ok: true,
    success: true,
    message: '予約を作成しました',
    item: data,  // 専門家推奨形式
    reservation: data,
    data: data  // クライアント側の互換性のため全形式を返す
  });
}

// 予約更新処理
async function handleUpdate(req, res, url) {
  if (req.method !== 'PUT' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  // URLパラメータからIDを取得（優先）、なければbodyから
  const urlId = url ? url.searchParams.get('id') : null;
  
  const {
    id: bodyId,
    customer_name,
    date,
    time,
    people,
    message,
    phone,
    email,
    seat_id,
    seat_code,
    status
  } = req.body;
  
  // IDを決定（URLパラメータ優先）
  const id = urlId || bodyId;
  
  // 必須項目チェック
  if (!id) {
    return res.status(400).json({ 
      error: '予約IDが指定されていません' 
    });
  }
  
  if (!customer_name || !date || !time || !people) {
    return res.status(400).json({ 
      error: '必須項目が不足しています',
      required: ['customer_name', 'date', 'time', 'people']
    });
  }
  
  // 人数チェック（1-20名）
  const peopleNum = Number(people);
  if (peopleNum < 1 || peopleNum > 20) {
    return res.status(400).json({ 
      error: '人数は1〜20名の範囲で指定してください' 
    });
  }
  
  // UUID形式チェック
  const isValidUUID = (str) => {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(str);
  };
  
  // 更新データ作成
  const updateData = {
    customer_name: customer_name,
    date: date,
    time: time, // すでにミドルウェアで正規化済み
    people: peopleNum,
    message: message || null,
    phone: phone || null,
    email: email || null,
    seat_id: (seat_id && isValidUUID(seat_id)) ? seat_id : null,  // UUID形式の場合のみ
    seat_code: seat_code || seat_id || null,  // 席コード（T1, T2など）
    status: status || 'confirmed',
    updated_at: new Date()  // Supabaseが自動で処理
  };
  
  console.log('Updating reservation:', id, 'for store:', req.store_id, updateData);
  
  // Supabaseで更新（自テナントのみ更新可）
  const { data, error } = await supabase
    .from('reservations')
    .update(updateData)
    .eq('id', id)
    .eq('store_id', req.store_id)  // 自テナントのみ更新可
    .select();
  
  if (error) {
    console.error('Update error:', error);
    return res.status(500).json({ 
      error: '予約の更新に失敗しました',
      details: error.message 
    });
  }
  
  if (!data || data.length === 0) {
    return res.status(404).json({ 
      error: '指定された予約が見つかりません' 
    });
  }
  
  console.log('Successfully updated reservation:', data[0]);
  
  return res.status(200).json({
    success: true,
    message: '予約を更新しました',
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
  
  console.log('Deleting reservation:', reservationId, 'for store:', req.store_id);
  
  // 予約を削除（自テナントのみ削除可）
  const { data, error } = await supabase
    .from('reservations')
    .delete()
    .eq('id', reservationId)
    .eq('store_id', req.store_id)  // 自テナントのみ削除可
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
  // @レビュー: getStoreId()を通して店舗IDを取得
  const storeId = getStoreId(req.query.store_id);
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
  // Dateオブジェクトを作らずに文字列処理
  const [year, month, day] = reservation.date.split('-').map(Number);
  // 曜日を取得するためにのみDateを使う（ローカル時間として）
  const dateObj = new Date(year, month - 1, day);
  const dayOfWeek = days[dateObj.getDay()];
  const formattedDate = `${month}月${day}日(${dayOfWeek})`;
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
