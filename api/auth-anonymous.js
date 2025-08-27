/**
 * 匿名認証システム (Phase 1)
 * 
 * LINEのuserIdを使った簡易認証
 * パスワード不要・メールアドレス不要
 */

import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

// =====================================
// Supabase接続
// =====================================
const supabase = createClient(
  process.env.SUPABASE_URL || 'https://faenvzzeguvlconvrqgp.supabase.co',
  process.env.SUPABASE_ANON_KEY || ''
);

// =====================================
// 匿名ユーザー管理
// =====================================

/**
 * 匿名ユーザーの作成または取得
 * 
 * @param {string} lineUserId - LINE userId
 * @returns {object} ユーザー情報
 */
async function getOrCreateAnonymousUser(lineUserId) {
  // 入力検証
  if (!lineUserId) {
    throw new Error('LINE userId is required');
  }

  try {
    // 既存ユーザーチェック
    const { data: existingUser, error: fetchError } = await supabase
      .from('anonymous_users')
      .select('*')
      .eq('line_user_id', lineUserId)
      .single();

    // 既存ユーザーが見つかった場合
    if (existingUser && !fetchError) {
      // 最終アクセス日時を更新
      await supabase
        .from('anonymous_users')
        .update({ 
          last_accessed_at: new Date().toISOString(),
          access_count: existingUser.access_count + 1
        })
        .eq('id', existingUser.id);

      return {
        success: true,
        user: existingUser,
        isNewUser: false
      };
    }

    // 新規ユーザー作成
    const newUser = {
      id: generateUserId(lineUserId),
      line_user_id: lineUserId,
      created_at: new Date().toISOString(),
      last_accessed_at: new Date().toISOString(),
      access_count: 1,
      // 匿名ユーザーなので個人情報は保存しない
      display_name: `ユーザー${Date.now().toString().slice(-6)}`, // ランダムな表示名
      preferences: {
        notification: true,
        reminder: true
      }
    };

    const { data: createdUser, error: createError } = await supabase
      .from('anonymous_users')
      .insert([newUser])
      .select()
      .single();

    if (createError) {
      throw createError;
    }

    return {
      success: true,
      user: createdUser,
      isNewUser: true
    };

  } catch (error) {
    console.error('Anonymous user error:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * ユーザーIDの生成
 * LINE userIdをハッシュ化して匿名性を保つ
 */
function generateUserId(lineUserId) {
  const hash = crypto
    .createHash('sha256')
    .update(`${lineUserId}-${process.env.HASH_SALT || 'default-salt'}`)
    .digest('hex');
  
  return `anon_${hash.substring(0, 16)}`;
}

// =====================================
// セッション管理（簡易版）
// =====================================

/**
 * セッショントークンの生成
 * JWTの代わりに簡易トークンを使用
 */
function generateSessionToken(userId) {
  const payload = {
    userId,
    timestamp: Date.now(),
    random: crypto.randomBytes(16).toString('hex')
  };
  
  // 簡易署名
  const signature = crypto
    .createHmac('sha256', process.env.SESSION_SECRET || 'session-secret')
    .update(JSON.stringify(payload))
    .digest('hex');
  
  return Buffer.from(JSON.stringify({
    ...payload,
    signature
  })).toString('base64');
}

/**
 * セッショントークンの検証
 */
function verifySessionToken(token) {
  try {
    const decoded = JSON.parse(Buffer.from(token, 'base64').toString());
    
    // タイムアウトチェック（24時間）
    if (Date.now() - decoded.timestamp > 86400000) {
      return { valid: false, reason: 'expired' };
    }
    
    // 署名検証
    const { signature, ...payload } = decoded;
    const expectedSignature = crypto
      .createHmac('sha256', process.env.SESSION_SECRET || 'session-secret')
      .update(JSON.stringify(payload))
      .digest('hex');
    
    if (signature !== expectedSignature) {
      return { valid: false, reason: 'invalid signature' };
    }
    
    return { 
      valid: true, 
      userId: decoded.userId 
    };
    
  } catch (error) {
    return { valid: false, reason: 'invalid token' };
  }
}

// =====================================
// 権限管理
// =====================================

/**
 * ユーザー権限のチェック
 * Phase 1では全員が同じ権限
 */
async function checkUserPermissions(userId, action) {
  // Phase 1: 基本的な権限のみ
  const basicPermissions = [
    'create_reservation',
    'view_own_reservations',
    'cancel_own_reservation',
    'update_own_reservation'
  ];
  
  // 将来的な拡張用コメント
  // Phase 2: ロール別権限
  // - admin: 全権限
  // - staff: 予約管理権限
  // - user: 基本権限のみ
  
  return basicPermissions.includes(action);
}

// =====================================
// アクセス制御
// =====================================

/**
 * リソースへのアクセス権限チェック
 */
async function canAccessResource(userId, resourceType, resourceId) {
  // Phase 1: 自分のリソースのみアクセス可能
  if (resourceType === 'reservation') {
    const { data: reservation } = await supabase
      .from('reservations')
      .select('user_id')
      .eq('id', resourceId)
      .single();
    
    return reservation?.user_id === userId;
  }
  
  // 将来的な拡張用コメント
  // Phase 2: 
  // - グループ予約の場合、グループメンバー全員がアクセス可能
  // - スタッフは全予約にアクセス可能
  
  return false;
}

// =====================================
// 認証ミドルウェア
// =====================================

/**
 * LINE Webhookリクエストの認証
 */
export async function authenticateLineRequest(req) {
  const event = req.body?.events?.[0];
  if (!event) {
    return { authenticated: false, error: 'No event' };
  }
  
  const lineUserId = event.source?.userId;
  if (!lineUserId) {
    return { authenticated: false, error: 'No LINE userId' };
  }
  
  // 匿名ユーザーの取得/作成
  const result = await getOrCreateAnonymousUser(lineUserId);
  
  if (!result.success) {
    return { authenticated: false, error: result.error };
  }
  
  // セッショントークン生成
  const sessionToken = generateSessionToken(result.user.id);
  
  return {
    authenticated: true,
    user: result.user,
    sessionToken,
    isNewUser: result.isNewUser
  };
}

// =====================================
// APIハンドラー
// =====================================

export default async function handler(req, res) {
  // CORS設定
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }
  
  // GET: ヘルスチェック
  if (req.method === 'GET') {
    return res.status(200).json({
      status: 'healthy',
      authType: 'anonymous',
      phase: 1,
      features: [
        'LINE userId based authentication',
        'No password required',
        'No email required',
        'Session management',
        'Basic permissions'
      ]
    });
  }
  
  // POST: 認証処理
  if (req.method === 'POST') {
    const { lineUserId } = req.body;
    
    if (!lineUserId) {
      return res.status(400).json({
        error: 'LINE userId is required'
      });
    }
    
    try {
      // 匿名ユーザーの取得/作成
      const result = await getOrCreateAnonymousUser(lineUserId);
      
      if (!result.success) {
        return res.status(500).json({
          error: 'Authentication failed',
          details: result.error
        });
      }
      
      // セッショントークン生成
      const sessionToken = generateSessionToken(result.user.id);
      
      return res.status(200).json({
        success: true,
        user: {
          id: result.user.id,
          displayName: result.user.display_name,
          isNewUser: result.isNewUser
        },
        sessionToken,
        expiresIn: '24h'
      });
      
    } catch (error) {
      console.error('Auth error:', error);
      return res.status(500).json({
        error: 'Internal server error'
      });
    }
  }
  
  return res.status(405).json({ error: 'Method not allowed' });
}

// =====================================
// 将来の拡張用コメント
// =====================================

/**
 * Phase 2: LINEログイン連携
 * 
 * async function linkLineLogin(lineUserId, lineProfile) {
 *   // LINEログインAPIからプロフィール取得
 *   // displayName, pictureUrl等を保存
 *   // メールアドレスは任意
 * }
 */

/**
 * Phase 3: 通常ログイン追加
 * 
 * async function upgradeToFullAccount(userId, email, password) {
 *   // 匿名ユーザーを通常アカウントにアップグレード
 *   // メールアドレスとパスワードを追加
 *   // 過去の予約データは引き継ぎ
 * }
 */

/**
 * Phase 4: ソーシャルログイン
 * 
 * async function linkSocialAccount(userId, provider, socialId) {
 *   // Google, Facebook等の連携
 *   // 複数アカウントの統合
 * }
 */