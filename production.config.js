/**
 * 本番環境設定ファイル
 * Production Configuration
 */

module.exports = {
    // 環境設定
    environment: 'production',
    
    // ログ設定
    logging: {
        level: 'error', // 本番では error のみ
        console: false, // コンソール出力を無効化
        file: true,     // ファイル出力有効
        maxFiles: 5,    // ログファイル最大数
        maxSize: '10m'  // ログファイル最大サイズ
    },
    
    // パフォーマンス設定
    performance: {
        // API レート制限
        rateLimit: {
            windowMs: 15 * 60 * 1000, // 15分
            max: 100 // 最大100リクエスト
        },
        
        // キャッシュ設定
        cache: {
            static: {
                maxAge: 31536000, // 1年（静的ファイル）
                immutable: true
            },
            api: {
                maxAge: 300 // 5分（APIレスポンス）
            }
        },
        
        // 監視設定
        monitoring: {
            enabled: true,
            interval: 10000, // 10秒ごと
            useIdleCallback: true // requestIdleCallback使用
        }
    },
    
    // セキュリティ設定
    security: {
        cors: {
            origin: process.env.ALLOWED_ORIGINS?.split(',') || ['https://liff.line.me'],
            credentials: true
        },
        helmet: {
            contentSecurityPolicy: {
                directives: {
                    defaultSrc: ["'self'"],
                    scriptSrc: ["'self'", "'unsafe-inline'", 'https://cdn.jsdelivr.net'],
                    styleSrc: ["'self'", "'unsafe-inline'", 'https://cdn.jsdelivr.net'],
                    imgSrc: ["'self'", 'data:', 'https:'],
                    connectSrc: ["'self'", 'https://api.line.me']
                }
            }
        }
    },
    
    // ビルド設定
    build: {
        minify: true,
        sourceMaps: false, // 本番ではソースマップ無効
        optimization: {
            splitChunks: true,
            treeshake: true,
            compression: 'gzip'
        }
    },
    
    // CDN設定（必要に応じて）
    cdn: {
        enabled: false, // CDN使用時は true に
        baseUrl: '', // CDN URL
        assets: [
            '/public/css/',
            '/public/js/',
            '/public/images/'
        ]
    }
};