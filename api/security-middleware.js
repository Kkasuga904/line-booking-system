/**
 * 🔐 セキュリティミドルウェア
 * 
 * APIエンドポイントを保護し、不正アクセスを防止
 * レート制限、認証、データ検証を実装
 */

import crypto from 'crypto';

// レート制限用のメモリストア（本番環境ではRedis推奨）
const rateLimitStore = new Map();

/**
 * レート制限ミドルウェア
 * 同一IPからの過度なリクエストを防止
 */
export function rateLimit(maxRequests = 100, windowMs = 60000) {
  return (req) => {
    const ip = req.headers['x-forwarded-for'] || req.connection?.remoteAddress || 'unknown';
    const now = Date.now();
    const windowStart = now - windowMs;
    
    // 古いエントリをクリーンアップ
    if (!rateLimitStore.has(ip)) {
      rateLimitStore.set(ip, []);
    }
    
    const requests = rateLimitStore.get(ip).filter(time => time > windowStart);
    
    if (requests.length >= maxRequests) {
      return {
        error: 'Too many requests',
        statusCode: 429,
        retryAfter: Math.ceil((requests[0] + windowMs - now) / 1000)
      };
    }
    
    requests.push(now);
    rateLimitStore.set(ip, requests);
    
    return null; // 制限なし
  };
}

/**
 * LINE署名検証
 * Webhookリクエストの真正性を確認
 */
export function validateLineSignature(body, signature, channelSecret) {
  const hash = crypto
    .createHmac('SHA256', channelSecret)
    .update(body)
    .digest('base64');
  
  return hash === signature;
}

/**
 * 入力データのサニタイゼーション
 * XSS攻撃を防ぐため、危険な文字をエスケープ
 */
export function sanitizeInput(data) {
  if (typeof data === 'string') {
    return data
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;')
      .replace(/&(?![\w#]+;)/g, '&amp;')
      .trim();
  }
  
  if (Array.isArray(data)) {
    return data.map(sanitizeInput);
  }
  
  if (data && typeof data === 'object') {
    const sanitized = {};
    for (const key in data) {
      sanitized[key] = sanitizeInput(data[key]);
    }
    return sanitized;
  }
  
  return data;
}

/**
 * SQLインジェクション対策
 * 危険なSQL文字列をチェック
 */
export function validateSQLSafe(value) {
  if (typeof value !== 'string') return true;
  
  const dangerousPatterns = [
    /(\b(DROP|DELETE|INSERT|UPDATE|ALTER|CREATE|TRUNCATE|EXEC|EXECUTE)\b)/gi,
    /(--|\/\*|\*\/|;|\||\\x00|\\n|\\r|\\t)/g,
    /(\bunion\b.*\bselect\b|\bselect\b.*\bfrom\b)/gi
  ];
  
  for (const pattern of dangerousPatterns) {
    if (pattern.test(value)) {
      return false;
    }
  }
  
  return true;
}

/**
 * 予約データのバリデーション
 * 必須項目と形式をチェック
 */
export function validateReservationData(data) {
  const errors = [];
  
  // 必須項目チェック
  if (!data.customer_name || data.customer_name.length < 1) {
    errors.push('お名前は必須です');
  }
  
  if (!data.phone) {
    errors.push('電話番号は必須です');
  } else if (!/^[\d-+\s()]+$/.test(data.phone)) {
    errors.push('電話番号の形式が不正です');
  }
  
  if (!data.date) {
    errors.push('日付は必須です');
  } else if (!/^\d{4}-\d{2}-\d{2}$/.test(data.date)) {
    errors.push('日付の形式が不正です');
  }
  
  if (!data.time) {
    errors.push('時間は必須です');
  } else if (!/^\d{2}:\d{2}(:\d{2})?$/.test(data.time)) {
    errors.push('時間の形式が不正です');
  }
  
  if (data.people && (data.people < 1 || data.people > 100)) {
    errors.push('人数は1〜100の範囲で指定してください');
  }
  
  // メールアドレスの形式チェック（オプション）
  if (data.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
    errors.push('メールアドレスの形式が不正です');
  }
  
  // SQLインジェクションチェック
  for (const key in data) {
    if (!validateSQLSafe(data[key])) {
      errors.push(`${key}に不正な文字が含まれています`);
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * APIキー認証
 * 管理者アクセスの認証
 */
export function authenticateAPIKey(req) {
  const apiKey = req.headers['x-api-key'] || req.query.api_key;
  const validApiKey = process.env.ADMIN_API_KEY;
  
  if (!validApiKey) {
    // API キーが設定されていない場合は警告
    console.warn('ADMIN_API_KEY is not set in environment variables');
    return true; // 開発環境では通す
  }
  
  return apiKey === validApiKey;
}

/**
 * CORS設定
 * クロスオリジンリクエストの制御
 */
export function setCORSHeaders(res, allowedOrigins = '*') {
  if (allowedOrigins === '*') {
    res.setHeader('Access-Control-Allow-Origin', '*');
  } else {
    const origins = Array.isArray(allowedOrigins) ? allowedOrigins : [allowedOrigins];
    res.setHeader('Access-Control-Allow-Origin', origins.join(', '));
  }
  
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-API-Key');
  res.setHeader('Access-Control-Max-Age', '86400'); // 24時間
}

/**
 * セキュリティヘッダー設定
 * 一般的なWeb脆弱性から保護
 */
export function setSecurityHeaders(res) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'");
}

/**
 * IPアドレスによるアクセス制限
 * 特定のIPからのアクセスをブロック
 */
const blockedIPs = new Set(); // 動的にIPを追加可能

export function blockIP(ip) {
  blockedIPs.add(ip);
}

export function isIPBlocked(req) {
  const ip = req.headers['x-forwarded-for'] || req.connection?.remoteAddress || '';
  return blockedIPs.has(ip);
}

/**
 * セッション管理
 * 簡易的なセッショントークン生成と検証
 */
const sessions = new Map();

export function createSession(userId) {
  const token = crypto.randomBytes(32).toString('hex');
  const session = {
    userId,
    token,
    createdAt: Date.now(),
    lastAccess: Date.now()
  };
  
  sessions.set(token, session);
  
  // 24時間後に自動削除
  setTimeout(() => {
    sessions.delete(token);
  }, 24 * 60 * 60 * 1000);
  
  return token;
}

export function validateSession(token) {
  const session = sessions.get(token);
  
  if (!session) {
    return null;
  }
  
  // セッションタイムアウト（1時間）
  if (Date.now() - session.lastAccess > 60 * 60 * 1000) {
    sessions.delete(token);
    return null;
  }
  
  session.lastAccess = Date.now();
  return session.userId;
}

/**
 * 統合セキュリティミドルウェア
 * すべてのセキュリティ機能を適用
 */
export function applySecurityMiddleware(handler, options = {}) {
  const {
    rateLimit: rateLimitOptions = { maxRequests: 100, windowMs: 60000 },
    requireAuth = false,
    validateInput = true,
    corsOrigins = '*'
  } = options;
  
  return async (req, res) => {
    // セキュリティヘッダー設定
    setSecurityHeaders(res);
    setCORSHeaders(res, corsOrigins);
    
    // OPTIONSリクエストの処理
    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }
    
    // IPブロックチェック
    if (isIPBlocked(req)) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    // レート制限チェック
    const rateLimitCheck = rateLimit(
      rateLimitOptions.maxRequests,
      rateLimitOptions.windowMs
    )(req);
    
    if (rateLimitCheck) {
      res.setHeader('Retry-After', rateLimitCheck.retryAfter);
      return res.status(429).json({ 
        error: rateLimitCheck.error,
        retryAfter: rateLimitCheck.retryAfter
      });
    }
    
    // 認証チェック
    if (requireAuth && !authenticateAPIKey(req)) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    // 入力データのサニタイズ
    if (validateInput && req.body) {
      req.body = sanitizeInput(req.body);
    }
    
    // ハンドラー実行
    try {
      return await handler(req, res);
    } catch (error) {
      console.error('Security middleware error:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  };
}

export default {
  rateLimit,
  validateLineSignature,
  sanitizeInput,
  validateSQLSafe,
  validateReservationData,
  authenticateAPIKey,
  setCORSHeaders,
  setSecurityHeaders,
  blockIP,
  isIPBlocked,
  createSession,
  validateSession,
  applySecurityMiddleware
};