/**
 * 🏥 LINE予約システム ヘルスチェックAPI
 * 
 * システムの各コンポーネントの健康状態をリアルタイムで監視するAPIエンドポイント。
 * 本番環境での監視やトラブルシューティングに使用します。
 * 
 * エンドポイント: GET /api/health-check
 * 
 * 監視項目:
 * - API基本応答性
 * - 環境変数設定状況
 * - Store ID設定値
 * - データベース接続と応答速度
 * - データ整合性（予約・席の件数）
 * - 席の可用性
 * - 古いpending予約の存在
 * - LINE設定（トークン、LIFF ID）
 * 
 * レスポンス形式:
 * {
 *   "status": "healthy|degraded|unhealthy",
 *   "timestamp": "2024-01-15T10:30:00.000Z",
 *   "checks": { ... },
 *   "errors": [...],
 *   "warnings": [...],
 *   "summary": "システム状態の概要"
 * }
 * 
 * ステータスコード:
 * - 200: healthy または degraded
 * - 503: unhealthy (サービス利用不可)
 */

import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  // CORS設定（クロスオリジンアクセスを許可）
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  
  // プリフライトリクエストへの対応
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  // GETメソッド以外は拒否
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  // ヘルスチェック結果を格納するオブジェクト
  const health = {
    status: 'checking',                    // 全体ステータス
    timestamp: new Date().toISOString(),   // チェック実行時刻
    checks: {},                           // 個別チェック結果
    errors: [],                          // エラー一覧
    warnings: []                         // 警告一覧
  };
  
  // 1. 基本応答性チェック
  // このAPIが動作していること自体が基本的な健全性の証明
  health.checks.api = {
    status: 'healthy',
    message: 'API is responding',
    responseTime: Date.now()  // 後でレスポンス時間を計算するための開始時刻
  };
  
  // 2. 環境変数チェック
  // システム動作に必要な環境変数がすべて設定されているか確認
  const requiredEnvVars = [
    'LINE_CHANNEL_ACCESS_TOKEN',  // LINE Bot API用トークン
    'LINE_CHANNEL_SECRET',        // LINE Bot認証用シークレット
    'LIFF_ID',                   // LINE Frontend Framework ID
    'STORE_ID',                  // 店舗識別子（通常は'default-store'）
    'SUPABASE_URL',              // SupabaseプロジェクトURL
    'SUPABASE_ANON_KEY'          // Supabase匿名キー
  ];
  
  // 未設定の環境変数を検出
  const missingEnvVars = [];
  for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) {
      missingEnvVars.push(envVar);
    }
  }
  
  if (missingEnvVars.length === 0) {
    health.checks.environment = {
      status: 'healthy',
      message: 'All required environment variables are set'
    };
  } else {
    health.checks.environment = {
      status: 'unhealthy',
      message: `Missing environment variables: ${missingEnvVars.join(', ')}`,
      missing: missingEnvVars
    };
    health.errors.push('Missing environment variables');
  }
  
  // 3. Store ID設定チェック
  // 過去に'account-001'などの設定ミスが原因で予約が表示されない問題が発生したため重要
  const storeId = (process.env.STORE_ID || 'default-store').trim();
  if (storeId === 'default-store') {
    health.checks.storeId = {
      status: 'healthy',
      message: 'Store ID is correctly set to default-store',
      value: storeId
    };
  } else {
    health.checks.storeId = {
      status: 'warning',
      message: `Store ID is set to: ${storeId} (expected: default-store)`,
      value: storeId
    };
    health.warnings.push(`Store ID mismatch: ${storeId}`);
  }
  
  // 4. データベース接続チェック
  // Supabaseデータベースへの接続とクエリ実行を確認
  try {
    const supabase = createClient(
      process.env.SUPABASE_URL || '',
      process.env.SUPABASE_ANON_KEY || ''
    );
    
    // データベースレスポンス時間測定開始
    const startTime = Date.now();
    const { data: testQuery, error: dbError } = await supabase
      .from('reservations')
      .select('count')
      .limit(1);
    
    const queryTime = Date.now() - startTime;
    
    if (dbError) {
      health.checks.database = {
        status: 'unhealthy',
        message: `Database error: ${dbError.message}`,
        error: dbError.message
      };
      health.errors.push('Database connection failed');
    } else {
      health.checks.database = {
        status: 'healthy',
        message: 'Database connection successful',
        responseTime: `${queryTime}ms`
      };
      
      // データ整合性チェック
      // 指定されたstore_idのデータ件数を確認（Store ID不一致問題の早期発見のため）
      const { data: reservationCount } = await supabase
        .from('reservations')
        .select('*', { count: 'exact', head: true })
        .eq('store_id', storeId);
      
      const { data: seatCount } = await supabase
        .from('seats')
        .select('*', { count: 'exact', head: true })
        .eq('store_id', storeId);
      
      health.checks.dataIntegrity = {
        status: 'healthy',
        reservations: reservationCount || 0,
        seats: seatCount || 0,
        storeId: storeId
      };
      
      // 席の可用性チェック
      // 予約可能な席（アクティブかつ未ロック）の数を確認
      const { data: availableSeats } = await supabase
        .from('seats')
        .select('*')
        .eq('store_id', storeId)
        .eq('is_active', true)      // アクティブな席
        .eq('is_locked', false);    // ロックされていない席
      
      if (availableSeats && availableSeats.length > 0) {
        health.checks.seatAvailability = {
          status: 'healthy',
          message: `${availableSeats.length} seats available`,
          count: availableSeats.length
        };
      } else {
        health.checks.seatAvailability = {
          status: 'warning',
          message: 'No available seats',
          count: 0
        };
        health.warnings.push('No available seats');
      }
      
      // 古いpending予約チェック
      // 3日以上前のpending予約は異常なのでクリーンアップ対象として警告
      const threeDaysAgo = new Date();
      threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
      
      const { data: oldPending } = await supabase
        .from('reservations')
        .select('id')
        .eq('status', 'pending')                          // pending状態
        .lt('created_at', threeDaysAgo.toISOString());    // 3日以上前
      
      if (oldPending && oldPending.length > 0) {
        health.checks.pendingReservations = {
          status: 'warning',
          message: `${oldPending.length} old pending reservations found`,
          count: oldPending.length
        };
        health.warnings.push(`${oldPending.length} old pending reservations`);
      } else {
        health.checks.pendingReservations = {
          status: 'healthy',
          message: 'No old pending reservations',
          count: 0
        };
      }
    }
  } catch (error) {
    health.checks.database = {
      status: 'unhealthy',
      message: 'Database check failed',
      error: error.message
    };
    health.errors.push('Database check failed');
  }
  
  // 5. LINE設定チェック
  // LINE Bot機能に必要な設定が正しく行われているか確認
  if (process.env.LINE_CHANNEL_ACCESS_TOKEN && process.env.LIFF_ID) {
    // LIFF IDの形式チェック（数字-英数字の形式が正しい）
    const liffIdFormat = /^\d+-[a-zA-Z0-9]+$/.test(process.env.LIFF_ID);
    
    if (liffIdFormat) {
      health.checks.lineConfig = {
        status: 'healthy',
        message: 'LINE configuration is valid',
        liffId: process.env.LIFF_ID
      };
    } else {
      health.checks.lineConfig = {
        status: 'warning',
        message: 'LIFF ID format may be invalid',
        liffId: process.env.LIFF_ID
      };
      health.warnings.push('LIFF ID format warning');
    }
  } else {
    health.checks.lineConfig = {
      status: 'unhealthy',
      message: 'LINE configuration is incomplete'
    };
    health.errors.push('LINE configuration incomplete');
  }
  
  // 全体ステータス判定
  // エラーと警告の数に基づいてシステム全体の健全性を判定
  if (health.errors.length > 0) {
    health.status = 'unhealthy';     // 重大な問題あり（サービス停止レベル）
    health.summary = `System has ${health.errors.length} error(s)`;
  } else if (health.warnings.length > 0) {
    health.status = 'degraded';      // 軽微な問題あり（サービス継続可能）
    health.summary = `System is operational with ${health.warnings.length} warning(s)`;
  } else {
    health.status = 'healthy';       // 全て正常
    health.summary = 'All systems operational';
  }
  
  // HTTPステータスコード決定
  // unhealthyの場合は503（Service Unavailable）、それ以外は200 OK
  const statusCode = health.status === 'unhealthy' ? 503 : 200;
  
  return res.status(statusCode).json(health);
}