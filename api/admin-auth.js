import { getEnv } from '../utils/env-helper.js';

/**
 * 管理画面認証API
 * POST /api/admin-auth
 * Body: { password: string }
 * 
 * シンプルなパスワード認証（本番環境では要強化）
 */
export default async function handler(req, res) {
  // CORS設定
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  try {
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
    // 本番環境では JWT などを使用すべき
    const token = Buffer.from(`admin:${Date.now()}`).toString('base64');
    
    return res.status(200).json({
      success: true,
      message: '認証成功',
      token: token,
      expiresIn: 3600 // 1時間有効
    });
    
  } catch (error) {
    console.error('Admin auth error:', error);
    return res.status(500).json({
      error: 'サーバーエラーが発生しました'
    });
  }
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

/**
 * セキュリティ強化案（本番環境向け）:
 * 
 * 1. JWT（JSON Web Token）の使用
 *    - jsonwebtoken ライブラリ
 *    - RSA公開鍵暗号化
 * 
 * 2. 2要素認証（2FA）
 *    - Google Authenticator連携
 *    - SMS認証
 * 
 * 3. IPアドレス制限
 *    - 管理者のIPアドレスをホワイトリスト化
 * 
 * 4. ログイン試行回数制限
 *    - 失敗回数をカウント
 *    - 一定回数失敗でアカウントロック
 * 
 * 5. セッション管理
 *    - Redis等でセッション管理
 *    - 自動ログアウト機能
 * 
 * 6. 監査ログ
 *    - ログイン履歴の記録
 *    - 不正アクセス検知
 */