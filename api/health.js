/**
 * ヘルスチェック・デバッグエンドポイント
 * 
 * このエンドポイントは以下の用途で使用します：
 * - APIの死活監視
 * - 環境変数の設定確認
 * - Vercelデプロイの成功確認
 * - トラブルシューティング
 * 
 * アクセス方法:
 * GET https://your-domain.vercel.app/api/health
 */

export const config = { api: { bodyParser: true } };

export default async function handler(req, res) {
  // 現在時刻（日本時間）
  const now = new Date();
  const jstTime = new Date(now.getTime() + (9 * 60 * 60 * 1000));
  
  // 環境変数の状態確認（値は隠蔽）
  const envStatus = {
    LINE_CHANNEL_ACCESS_TOKEN: !!process.env.LINE_CHANNEL_ACCESS_TOKEN,
    LINE_CHANNEL_SECRET: !!process.env.LINE_CHANNEL_SECRET,
    NODE_ENV: process.env.NODE_ENV || 'not set',
    VERCEL: !!process.env.VERCEL,
    VERCEL_ENV: process.env.VERCEL_ENV || 'not set'
  };
  
  // トークンの一部を表示（デバッグ用）
  let tokenPreview = 'not set';
  if (process.env.LINE_CHANNEL_ACCESS_TOKEN) {
    const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
    tokenPreview = `${token.substring(0, 10)}...${token.substring(token.length - 5)}`;
  }
  
  // APIエンドポイント一覧
  const endpoints = [
    '/api/booking - メイン予約システム',
    '/api/echo - エコーボット（テスト用）',
    '/api/ping - 簡易ログ確認',
    '/api/health - このエンドポイント'
  ];
  
  // レスポンス
  const response = {
    status: 'healthy',
    timestamp: jstTime.toISOString(),
    timezone: 'Asia/Tokyo',
    environment: envStatus,
    tokenPreview: tokenPreview,
    endpoints: endpoints,
    message: 'LINE Bot API is running',
    debug: {
      method: req.method,
      url: req.url,
      headers: {
        'user-agent': req.headers['user-agent'],
        'content-type': req.headers['content-type']
      }
    }
  };
  
  // クエリパラメータ ?detailed=true で詳細情報表示
  if (req.query.detailed === 'true') {
    response.detailed = {
      allHeaders: req.headers,
      query: req.query,
      body: req.body
    };
  }
  
  res.status(200).json(response);
}