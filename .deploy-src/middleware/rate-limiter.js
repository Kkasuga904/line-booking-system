// レート制限ミドルウェア
// APIの過剰利用を防ぎ、GCPコストを削減

class RateLimiter {
  constructor() {
    this.requests = new Map();
    this.blacklist = new Set();
    
    // 設定
    this.limits = {
      perMinute: 60,      // 1分あたり60リクエスト
      perHour: 1000,      // 1時間あたり1000リクエスト
      perDay: 10000,      // 1日あたり10000リクエスト
      burst: 10           // バースト許容量
    };
    
    // 統計
    this.stats = {
      blocked: 0,
      passed: 0,
      blacklisted: 0
    };
  }

  // IPアドレス取得
  getClientIp(req) {
    return req.headers['x-forwarded-for']?.split(',')[0] || 
           req.connection.remoteAddress || 
           req.ip;
  }

  // レート制限チェック
  checkLimit(identifier, limit, window) {
    const key = `${identifier}:${window}`;
    const now = Date.now();
    const requests = this.requests.get(key) || [];
    
    // 期限切れリクエストを削除
    const validRequests = requests.filter(time => time > now - window);
    
    if (validRequests.length >= limit) {
      return false; // 制限超過
    }
    
    // リクエスト記録
    validRequests.push(now);
    this.requests.set(key, validRequests);
    
    return true; // 許可
  }

  // ミドルウェア関数
  middleware() {
    return (req, res, next) => {
      // ヘルスチェックは除外
      if (req.path === '/api/ping' || req.path === '/api/health') {
        return next();
      }
      
      const identifier = this.getClientIp(req);
      
      // ブラックリストチェック
      if (this.blacklist.has(identifier)) {
        this.stats.blacklisted++;
        return res.status(429).json({
          error: 'Too many requests - IP blocked',
          retryAfter: 3600
        });
      }
      
      // レート制限チェック
      const checks = [
        { limit: this.limits.burst, window: 1000 },        // 1秒
        { limit: this.limits.perMinute, window: 60000 },   // 1分
        { limit: this.limits.perHour, window: 3600000 },   // 1時間
        { limit: this.limits.perDay, window: 86400000 }    // 1日
      ];
      
      for (const check of checks) {
        if (!this.checkLimit(identifier, check.limit, check.window)) {
          this.stats.blocked++;
          
          // 頻繁な違反者をブラックリスト
          const violationKey = `${identifier}:violations`;
          const violations = (this.requests.get(violationKey) || 0) + 1;
          this.requests.set(violationKey, violations);
          
          if (violations > 10) {
            this.blacklist.add(identifier);
            console.log(`Blacklisted IP: ${identifier}`);
          }
          
          return res.status(429).json({
            error: 'Too many requests',
            retryAfter: Math.ceil(check.window / 1000),
            limit: check.limit,
            window: `${check.window / 1000}s`
          });
        }
      }
      
      this.stats.passed++;
      next();
    };
  }

  // LINE Webhook用の特別レート制限
  webhookLimiter() {
    return (req, res, next) => {
      const userId = req.body?.events?.[0]?.source?.userId;
      
      if (!userId) {
        return next();
      }
      
      // ユーザーごとに1分10メッセージまで
      if (!this.checkLimit(`webhook:${userId}`, 10, 60000)) {
        console.log(`Rate limit for LINE user: ${userId}`);
        // Webhookは200を返す必要がある
        return res.status(200).end();
      }
      
      next();
    };
  }

  // 統計取得
  getStats() {
    return {
      ...this.stats,
      blacklistSize: this.blacklist.size,
      activeRequests: this.requests.size,
      passRate: this.stats.passed > 0 ? 
        ((this.stats.passed / (this.stats.passed + this.stats.blocked)) * 100).toFixed(2) + '%' : 
        '100%'
    };
  }

  // ブラックリスト解除
  unblock(identifier) {
    this.blacklist.delete(identifier);
    const violationKey = `${identifier}:violations`;
    this.requests.delete(violationKey);
  }

  // クリーンアップ
  cleanup() {
    const now = Date.now();
    let cleaned = 0;
    
    // 1時間以上古いエントリを削除
    for (const [key, value] of this.requests.entries()) {
      if (Array.isArray(value)) {
        const filtered = value.filter(time => time > now - 3600000);
        if (filtered.length === 0) {
          this.requests.delete(key);
          cleaned++;
        } else {
          this.requests.set(key, filtered);
        }
      }
    }
    
    console.log(`Rate limiter cleanup: ${cleaned} entries removed`);
    return cleaned;
  }
}

// シングルトンインスタンス
const rateLimiter = new RateLimiter();

// 定期クリーンアップ（5分ごと）
setInterval(() => {
  rateLimiter.cleanup();
}, 5 * 60 * 1000);

export default rateLimiter;