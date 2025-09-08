/**
 * モニタリング＆アラートシステム
 * 
 * システムの健全性を監視し、問題を早期発見
 */

const THRESHOLDS = {
  RESPONSE_TIME: 1000,        // 1秒
  ERROR_RATE: 0.05,           // 5%
  RATE_LIMIT_USAGE: 0.8,      // 80%
  DB_CONNECTION_FAILURES: 3,   // 3回連続失敗
  MEMORY_USAGE: 0.9,          // 90%
};

class MonitoringSystem {
  constructor() {
    this.metrics = {
      requests: [],
      errors: [],
      dbConnections: [],
      memoryUsage: [],
      rateLimitHits: new Map()
    };
    this.alerts = [];
  }

  /**
   * リクエストのトラッキング
   */
  trackRequest(endpoint, duration, status) {
    const metric = {
      endpoint,
      duration,
      status,
      timestamp: Date.now()
    };
    
    this.metrics.requests.push(metric);
    
    // 古いデータをクリーンアップ（1時間以上前）
    const oneHourAgo = Date.now() - 3600000;
    this.metrics.requests = this.metrics.requests.filter(
      r => r.timestamp > oneHourAgo
    );
    
    // アラートチェック
    this.checkResponseTime(duration, endpoint);
    this.checkErrorRate();
  }

  /**
   * レスポンスタイム監視
   */
  checkResponseTime(duration, endpoint) {
    if (duration > THRESHOLDS.RESPONSE_TIME) {
      this.createAlert('PERFORMANCE', {
        message: `Slow response time: ${duration}ms on ${endpoint}`,
        severity: duration > THRESHOLDS.RESPONSE_TIME * 2 ? 'critical' : 'warning'
      });
    }
  }

  /**
   * エラーレート監視
   */
  checkErrorRate() {
    const recent = this.metrics.requests.slice(-100);
    if (recent.length < 10) return;
    
    const errorCount = recent.filter(r => r.status >= 500).length;
    const errorRate = errorCount / recent.length;
    
    if (errorRate > THRESHOLDS.ERROR_RATE) {
      this.createAlert('RELIABILITY', {
        message: `High error rate: ${(errorRate * 100).toFixed(1)}%`,
        severity: 'critical'
      });
    }
  }

  /**
   * データベース接続監視
   */
  trackDatabaseConnection(success) {
    this.metrics.dbConnections.push({
      success,
      timestamp: Date.now()
    });
    
    // 最新3件をチェック
    const recent = this.metrics.dbConnections.slice(-3);
    const failures = recent.filter(c => !c.success).length;
    
    if (failures >= THRESHOLDS.DB_CONNECTION_FAILURES) {
      this.createAlert('DATABASE', {
        message: 'Database connection failures detected',
        severity: 'critical',
        action: 'Check Supabase status and credentials'
      });
    }
  }

  /**
   * メモリ使用量監視
   */
  trackMemoryUsage() {
    if (typeof process !== 'undefined' && process.memoryUsage) {
      const usage = process.memoryUsage();
      const heapUsedRatio = usage.heapUsed / usage.heapTotal;
      
      this.metrics.memoryUsage.push({
        heapUsedRatio,
        rss: usage.rss,
        timestamp: Date.now()
      });
      
      if (heapUsedRatio > THRESHOLDS.MEMORY_USAGE) {
        this.createAlert('RESOURCE', {
          message: `High memory usage: ${(heapUsedRatio * 100).toFixed(1)}%`,
          severity: 'warning',
          action: 'Consider scaling or optimizing'
        });
      }
    }
  }

  /**
   * レート制限監視
   */
  trackRateLimit(userId, limited) {
    if (!this.metrics.rateLimitHits.has(userId)) {
      this.metrics.rateLimitHits.set(userId, []);
    }
    
    const userHits = this.metrics.rateLimitHits.get(userId);
    userHits.push({
      limited,
      timestamp: Date.now()
    });
    
    // 異常なアクセスパターンを検出
    const recentHits = userHits.filter(
      h => Date.now() - h.timestamp < 300000 // 5分以内
    );
    
    if (recentHits.filter(h => h.limited).length > 5) {
      this.createAlert('SECURITY', {
        message: `Potential abuse detected from user: ${userId}`,
        severity: 'warning',
        action: 'Consider blocking user'
      });
    }
  }

  /**
   * アラート作成
   */
  createAlert(type, details) {
    const alert = {
      id: Date.now().toString(),
      type,
      ...details,
      timestamp: new Date().toISOString()
    };
    
    this.alerts.push(alert);
    
    // 通知送信
    this.sendNotification(alert);
    
    // アラートログ
    console.error(`[ALERT] ${type}: ${details.message}`);
  }

  /**
   * 通知送信（Slack/Email/LINE等）
   */
  async sendNotification(alert) {
    // Slack通知
    if (process.env.SLACK_WEBHOOK_URL) {
      try {
        await fetch(process.env.SLACK_WEBHOOK_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: `🚨 Alert: ${alert.type}`,
            attachments: [{
              color: alert.severity === 'critical' ? 'danger' : 'warning',
              fields: [
                { title: 'Message', value: alert.message },
                { title: 'Severity', value: alert.severity },
                { title: 'Time', value: alert.timestamp }
              ]
            }]
          })
        });
      } catch (error) {
        console.error('Failed to send Slack notification:', error);
      }
    }
    
    // LINE通知（管理者向け）
    if (process.env.ADMIN_LINE_USER_ID && process.env.LINE_CHANNEL_ACCESS_TOKEN) {
      try {
        await fetch('https://api.line.me/v2/bot/message/push', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}`
          },
          body: JSON.stringify({
            to: process.env.ADMIN_LINE_USER_ID,
            messages: [{
              type: 'text',
              text: `⚠️ システムアラート\n\n種類: ${alert.type}\n内容: ${alert.message}\n重要度: ${alert.severity}\n時刻: ${alert.timestamp}`
            }]
          })
        });
      } catch (error) {
        console.error('Failed to send LINE notification:', error);
      }
    }
  }

  /**
   * ヘルスチェックレポート生成
   */
  generateHealthReport() {
    const now = Date.now();
    const oneHourAgo = now - 3600000;
    
    // 直近1時間のメトリクス
    const recentRequests = this.metrics.requests.filter(
      r => r.timestamp > oneHourAgo
    );
    
    const totalRequests = recentRequests.length;
    const errorRequests = recentRequests.filter(r => r.status >= 500).length;
    const avgResponseTime = recentRequests.reduce(
      (sum, r) => sum + r.duration, 0
    ) / (totalRequests || 1);
    
    // 最新のメモリ使用量
    const latestMemory = this.metrics.memoryUsage[this.metrics.memoryUsage.length - 1];
    
    // 最近のアラート
    const recentAlerts = this.alerts.filter(
      a => new Date(a.timestamp).getTime() > oneHourAgo
    );
    
    return {
      timestamp: new Date().toISOString(),
      metrics: {
        requests: {
          total: totalRequests,
          errors: errorRequests,
          errorRate: `${((errorRequests / totalRequests) * 100).toFixed(2)}%`,
          avgResponseTime: `${avgResponseTime.toFixed(0)}ms`
        },
        memory: latestMemory ? {
          heapUsed: `${(latestMemory.heapUsedRatio * 100).toFixed(1)}%`,
          rss: `${(latestMemory.rss / 1024 / 1024).toFixed(1)}MB`
        } : null,
        database: {
          recentConnections: this.metrics.dbConnections.slice(-10),
          failureRate: this.calculateFailureRate(this.metrics.dbConnections)
        }
      },
      alerts: {
        recent: recentAlerts,
        critical: recentAlerts.filter(a => a.severity === 'critical'),
        warning: recentAlerts.filter(a => a.severity === 'warning')
      },
      status: this.calculateOverallStatus(recentAlerts)
    };
  }

  /**
   * 失敗率計算
   */
  calculateFailureRate(connections) {
    const recent = connections.slice(-100);
    if (recent.length === 0) return '0%';
    
    const failures = recent.filter(c => !c.success).length;
    return `${((failures / recent.length) * 100).toFixed(1)}%`;
  }

  /**
   * 全体ステータス判定
   */
  calculateOverallStatus(recentAlerts) {
    const criticalAlerts = recentAlerts.filter(a => a.severity === 'critical');
    
    if (criticalAlerts.length > 0) return 'critical';
    if (recentAlerts.length > 5) return 'warning';
    if (recentAlerts.length > 0) return 'caution';
    return 'healthy';
  }
}

// シングルトンインスタンス
const monitoring = new MonitoringSystem();

// 定期的なヘルスチェック
setInterval(() => {
  monitoring.trackMemoryUsage();
  
  // 1時間ごとにレポート生成
  if (Date.now() % 3600000 < 60000) {
    const report = monitoring.generateHealthReport();
    console.log('[Health Report]', JSON.stringify(report, null, 2));
  }
}, 60000); // 1分ごと

module.exports = monitoring;