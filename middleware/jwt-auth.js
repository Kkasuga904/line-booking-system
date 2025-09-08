/**
 * JWT認証ミドルウェア
 * Supabaseの認証を利用したJWT検証
 */

import { createClient } from '@supabase/supabase-js';
import { getEnv } from '../utils/env-helper.js';

// Supabase初期化
const SUPABASE_URL = getEnv('SUPABASE_URL');
const SUPABASE_ANON_KEY = getEnv('SUPABASE_ANON_KEY');

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('ERROR: Supabase credentials not set in environment');
  throw new Error('Supabase configuration is required');
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/**
 * JWT認証ミドルウェア
 * @param {boolean} required - 認証が必須かどうか
 */
export function authenticateJWT(required = true) {
  return async (req, res, next) => {
    try {
      // Authorizationヘッダーからトークンを取得
      const authHeader = req.headers.authorization;
      
      if (!authHeader) {
        if (required) {
          return res.status(401).json({ 
            error: 'Authentication required',
            message: 'No authorization header provided' 
          });
        }
        // 認証が必須でない場合は続行
        return next();
      }

      // Bearer トークンの形式を確認
      const parts = authHeader.split(' ');
      if (parts.length !== 2 || parts[0] !== 'Bearer') {
        return res.status(401).json({ 
          error: 'Invalid authorization format',
          message: 'Expected format: Bearer <token>' 
        });
      }

      const token = parts[1];

      // Supabaseでトークンを検証
      const { data: { user }, error } = await supabase.auth.getUser(token);

      if (error || !user) {
        console.error('JWT verification failed:', error);
        return res.status(401).json({ 
          error: 'Invalid or expired token',
          details: error?.message 
        });
      }

      // ユーザー情報をリクエストに追加
      req.user = {
        id: user.id,
        email: user.email,
        role: user.role || 'user',
        metadata: user.user_metadata
      };

      // 管理者権限のチェック（必要に応じて）
      if (req.path.includes('/admin') && req.user.role !== 'admin') {
        return res.status(403).json({ 
          error: 'Insufficient permissions',
          message: 'Admin access required' 
        });
      }

      next();
    } catch (error) {
      console.error('Authentication error:', error);
      res.status(500).json({ 
        error: 'Authentication failed',
        details: error.message 
      });
    }
  };
}

/**
 * APIキー認証（後方互換性のため）
 */
export function authenticateAPIKey() {
  return (req, res, next) => {
    const apiKey = req.headers['x-api-key'] || req.query.api_key;
    
    if (!apiKey) {
      return res.status(401).json({ 
        error: 'API key required' 
      });
    }

    // 簡易的なAPIキーチェック（本番環境では改善が必要）
    const validApiKey = getEnv('ADMIN_API_KEY', 'your-secure-api-key-here');
    
    if (apiKey !== validApiKey) {
      return res.status(401).json({ 
        error: 'Invalid API key' 
      });
    }

    next();
  };
}

/**
 * 複合認証（JWTまたはAPIキー）
 */
export function authenticateMultiple() {
  return async (req, res, next) => {
    // まずJWT認証を試みる
    const authHeader = req.headers.authorization;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      return authenticateJWT(true)(req, res, next);
    }
    
    // JWTがない場合はAPIキー認証を試みる
    const apiKey = req.headers['x-api-key'] || req.query.api_key;
    
    if (apiKey) {
      return authenticateAPIKey()(req, res, next);
    }
    
    // どちらの認証情報もない場合
    return res.status(401).json({ 
      error: 'Authentication required',
      message: 'Provide either JWT token or API key' 
    });
  };
}

export default authenticateJWT;