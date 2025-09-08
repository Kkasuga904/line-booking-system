// エンタープライズ級セキュリティミドルウェア
import crypto from 'crypto';
import { rateLimiter } from '../utils/resilience.js';

class SecurityManager {
  constructor() {
    this.suspiciousIPs = new Map();
    this.blockedIPs = new Set();
    this.requestPatterns = new Map();
    
    // セキュリティ設定
    this.config = {
      maxRequestsPerMinute: 60,
      maxConsecutiveErrors: 10,
      suspiciousPatternThreshold: 5,
      autoBlockDuration: 3600000, // 1時間
      allowedUserAgents: [
        'LineBotWebhook/2.0',
        'Line-BotSDK/',
        'Mozilla/',
        'Chrome/',
        'Safari/'
      ]
    };
  }

  // IPアドレスベースのセキュリティチェック
  checkIPSecurity(ip) {
    // ブロックされたIPの確認
    if (this.blockedIPs.has(ip)) {
      return {
        allowed: false,
        reason: 'IP blocked',
        action: 'block'
      };
    }

    // レート制限チェック
    if (!rateLimiter.isAllowed(ip)) {
      this.flagSuspiciousActivity(ip, 'rate_limit_exceeded');
      return {
        allowed: false,
        reason: 'Rate limit exceeded',
        action: 'rate_limit'
      };
    }

    return { allowed: true };
  }

  // User-Agentの検証
  validateUserAgent(userAgent) {
    if (!userAgent) {
      return { valid: false, reason: 'Missing User-Agent' };
    }

    // LINE Webhook以外のアクセスの場合はより厳しくチェック
    const isLineWebhook = userAgent.includes('LineBotWebhook');
    if (!isLineWebhook) {
      const isValidBrowser = this.config.allowedUserAgents.some(pattern => 
        userAgent.includes(pattern)
      );
      
      if (!isValidBrowser) {
        return { valid: false, reason: 'Suspicious User-Agent' };
      }
    }

    return { valid: true };
  }

  // リクエストパターン分析
  analyzeRequestPattern(ip, path, method) {
    const key = `${ip}:${path}:${method}`;
    const now = Date.now();
    
    if (!this.requestPatterns.has(key)) {
      this.requestPatterns.set(key, []);
    }
    
    const pattern = this.requestPatterns.get(key);
    pattern.push(now);
    
    // 1分以内のリクエストのみ保持
    const oneMinuteAgo = now - 60000;
    while (pattern.length > 0 && pattern[0] < oneMinuteAgo) {
      pattern.shift();
    }
    
    // 異常なパターンの検出
    if (pattern.length > this.config.suspiciousPatternThreshold) {
      const intervals = [];
      for (let i = 1; i < pattern.length; i++) {
        intervals.push(pattern[i] - pattern[i-1]);
      }
      
      // 非常に短い間隔での連続リクエスト（Bot的動作）
      const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
      if (avgInterval < 100) { // 100ms以下の間隔
        this.flagSuspiciousActivity(ip, 'bot_like_behavior');
        return { suspicious: true, reason: 'Bot-like request pattern' };
      }
    }
    
    return { suspicious: false };
  }

  // 疑わしい活動のフラグ付け
  flagSuspiciousActivity(ip, reason) {
    if (!this.suspiciousIPs.has(ip)) {
      this.suspiciousIPs.set(ip, {
        firstSeen: Date.now(),
        incidents: [],
        score: 0
      });
    }
    
    const record = this.suspiciousIPs.get(ip);
    record.incidents.push({
      reason: reason,
      timestamp: Date.now()
    });
    
    // スコアリング
    const scoreMap = {
      'rate_limit_exceeded': 10,
      'bot_like_behavior': 15,
      'invalid_signature': 20,
      'suspicious_user_agent': 5,
      'malformed_request': 10
    };
    
    record.score += scoreMap[reason] || 5;
    
    // 自動ブロック判定
    if (record.score >= 50) {
      this.blockIP(ip, `Auto-blocked: score ${record.score}`);
    }
    
    console.log(JSON.stringify({
      severity: 'WARNING',
      msg: 'Suspicious activity detected',
      ip: ip,
      reason: reason,
      score: record.score,
      incidents: record.incidents.length
    }));
  }

  // IPブロック
  blockIP(ip, reason) {
    this.blockedIPs.add(ip);
    
    console.log(JSON.stringify({
      severity: 'ERROR',
      msg: 'IP blocked',
      ip: ip,
      reason: reason,
      timestamp: new Date().toISOString()
    }));
    
    // 自動ブロック解除タイマー
    setTimeout(() => {
      this.unblockIP(ip);
    }, this.config.autoBlockDuration);
  }

  // IPブロック解除
  unblockIP(ip) {
    this.blockedIPs.delete(ip);
    this.suspiciousIPs.delete(ip);
    
    console.log(JSON.stringify({
      severity: 'INFO',
      msg: 'IP unblocked',
      ip: ip,
      timestamp: new Date().toISOString()
    }));
  }

  // リクエスト詳細ログ（セキュリティ監査用）
  logSecurityEvent(req, eventType, details = {}) {
    const securityLog = {
      severity: 'INFO',
      type: 'security_event',
      eventType: eventType,
      timestamp: new Date().toISOString(),
      ip: this.getClientIP(req),
      userAgent: req.headers['user-agent'] || 'unknown',
      path: req.path,
      method: req.method,
      headers: {
        'content-type': req.headers['content-type'],
        'content-length': req.headers['content-length'],
        'x-forwarded-for': req.headers['x-forwarded-for']
      },
      ...details
    };
    
    console.log(JSON.stringify(securityLog));
  }

  // クライアントIPアドレス取得（プロキシ対応）
  getClientIP(req) {
    return req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
           req.headers['x-real-ip'] ||
           req.connection?.remoteAddress ||
           req.socket?.remoteAddress ||
           'unknown';
  }

  // セキュリティミドルウェア
  middleware() {
    return (req, res, next) => {
      const startTime = Date.now();
      const ip = this.getClientIP(req);
      const userAgent = req.headers['user-agent'] || '';
      
      // セキュリティチェック実行
      const ipCheck = this.checkIPSecurity(ip);
      if (!ipCheck.allowed) {
        this.logSecurityEvent(req, 'blocked_request', { 
          reason: ipCheck.reason,
          action: ipCheck.action
        });
        return res.status(429).json({ 
          error: 'Request blocked',
          reason: ipCheck.reason
        });
      }
      
      // User-Agent検証
      const uaCheck = this.validateUserAgent(userAgent);
      if (!uaCheck.valid) {
        this.flagSuspiciousActivity(ip, 'suspicious_user_agent');
        this.logSecurityEvent(req, 'suspicious_user_agent', { 
          userAgent: userAgent,
          reason: uaCheck.reason
        });
      }
      
      // リクエストパターン分析
      const patternCheck = this.analyzeRequestPattern(ip, req.path, req.method);
      if (patternCheck.suspicious) {
        this.logSecurityEvent(req, 'suspicious_pattern', {
          reason: patternCheck.reason
        });
      }
      
      // レスポンス時間記録用
      res.on('finish', () => {
        const responseTime = Date.now() - startTime;
        this.logSecurityEvent(req, 'request_completed', {
          statusCode: res.statusCode,
          responseTime: responseTime
        });
      });
      
      next();
    };
  }

  // セキュリティ統計取得
  getSecurityStats() {
    return {
      blockedIPs: Array.from(this.blockedIPs),
      suspiciousIPs: Array.from(this.suspiciousIPs.entries()).map(([ip, data]) => ({
        ip: ip,
        score: data.score,
        incidents: data.incidents.length,
        firstSeen: new Date(data.firstSeen).toISOString()
      })),
      totalPatterns: this.requestPatterns.size,
      timestamp: new Date().toISOString()
    };
  }

  // 手動IPブロック/ブロック解除
  manualBlockIP(ip, reason) {
    this.blockIP(ip, `Manual block: ${reason}`);
  }

  manualUnblockIP(ip) {
    this.unblockIP(ip);
  }
}

// シングルトンインスタンス
const securityManager = new SecurityManager();

export default securityManager;