/**
 * 本番環境用サーバー設定
 * Production Server Configuration
 */

const express = require('express');
const compression = require('compression');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const productionConfig = require('./production.config');

// 本番環境フラグ設定
process.env.NODE_ENV = 'production';

// サーバーの基本設定を読み込み
const originalServer = require('./server');
const app = originalServer.app || express();

// 圧縮を有効化
app.use(compression({
    level: 6,
    threshold: 1024,
    filter: (req, res) => {
        if (req.headers['x-no-compression']) {
            return false;
        }
        return compression.filter(req, res);
    }
}));

// セキュリティヘッダー設定
app.use(helmet(productionConfig.security.helmet));

// レート制限設定
const limiter = rateLimit(productionConfig.performance.rateLimit);
app.use('/api/', limiter);

// 静的ファイルのキャッシュ設定
app.use('/public', express.static(path.join(__dirname, 'public'), {
    maxAge: productionConfig.performance.cache.static.maxAge * 1000,
    immutable: productionConfig.performance.cache.static.immutable,
    etag: true,
    lastModified: true,
    setHeaders: (res, path) => {
        // JavaScriptとCSSファイルには長期キャッシュを設定
        if (path.endsWith('.js') || path.endsWith('.css')) {
            res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        }
        // 画像ファイルにも長期キャッシュ
        if (/\.(jpg|jpeg|png|gif|svg|ico)$/i.test(path)) {
            res.setHeader('Cache-Control', 'public, max-age=2592000');
        }
    }
}));

// ログミドルウェアをオーバーライド（本番では最小限に）
if (productionConfig.logging.console === false) {
    // console.log をオーバーライド
    const originalLog = console.log;
    const originalWarn = console.warn;
    const originalInfo = console.info;
    
    console.log = (...args) => {
        if (process.env.DEBUG === 'true') {
            originalLog(...args);
        }
    };
    
    console.warn = (...args) => {
        if (productionConfig.logging.level === 'warn' || productionConfig.logging.level === 'error') {
            originalWarn(...args);
        }
    };
    
    console.info = (...args) => {
        if (process.env.DEBUG === 'true') {
            originalInfo(...args);
        }
    };
}

// エラーハンドリング強化
app.use((err, req, res, next) => {
    // 本番環境では詳細なエラー情報を隠す
    const message = process.env.NODE_ENV === 'production' 
        ? 'Internal Server Error' 
        : err.message;
    
    const status = err.status || 500;
    
    // エラーログ（本番では最小限）
    if (productionConfig.logging.level === 'error') {
        console.error(`[ERROR] ${new Date().toISOString()} - ${req.method} ${req.url} - ${err.message}`);
    }
    
    res.status(status).json({
        success: false,
        error: message
    });
});

// サーバー起動
const PORT = process.env.PORT || 8080;
const server = app.listen(PORT, () => {
    console.log(`Production server running on port ${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV}`);
    console.log(`Cache enabled: Static files cached for 1 year`);
    console.log(`Security: Helmet and rate limiting enabled`);
    console.log(`Compression: Gzip compression enabled`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM signal received: closing HTTP server');
    server.close(() => {
        console.log('HTTP server closed');
        process.exit(0);
    });
});

module.exports = { app, server };