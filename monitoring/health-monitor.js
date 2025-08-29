// エンタープライズ級ヘルスモニタリングシステム
import { createClient } from '@supabase/supabase-js';

class HealthMonitor {
  constructor() {
    this.metrics = {
      requestCount: 0,
      errorCount: 0,
      responseTime: [],
      lastHealthCheck: null,
      systemStatus: 'healthy'
    };
    
    this.thresholds = {
      maxErrorRate: 0.05, // 5%
      maxResponseTime: 3000, // 3秒
      maxConsecutiveErrors: 10
    };
    
    this.consecutiveErrors = 0;
  }

  // リクエスト処理時間を記録
  recordRequest(responseTime, isError = false) {
    this.metrics.requestCount++;
    this.metrics.responseTime.push(responseTime);
    
    // 直近100件のレスポンス時間のみ保持
    if (this.metrics.responseTime.length > 100) {
      this.metrics.responseTime.shift();
    }
    
    if (isError) {
      this.metrics.errorCount++;
      this.consecutiveErrors++;
    } else {
      this.consecutiveErrors = 0;
    }
    
    this.evaluateSystemHealth();
  }

  // システム健全性評価
  evaluateSystemHealth() {
    const errorRate = this.metrics.requestCount > 0 
      ? this.metrics.errorCount / this.metrics.requestCount 
      : 0;
    
    const avgResponseTime = this.metrics.responseTime.length > 0
      ? this.metrics.responseTime.reduce((a, b) => a + b, 0) / this.metrics.responseTime.length
      : 0;

    let status = 'healthy';
    let alerts = [];

    // エラー率チェック
    if (errorRate > this.thresholds.maxErrorRate) {
      status = 'degraded';
      alerts.push(`High error rate: ${(errorRate * 100).toFixed(2)}%`);
    }

    // レスポンス時間チェック
    if (avgResponseTime > this.thresholds.maxResponseTime) {
      status = 'degraded';
      alerts.push(`High response time: ${avgResponseTime.toFixed(0)}ms`);
    }

    // 連続エラーチェック
    if (this.consecutiveErrors >= this.thresholds.maxConsecutiveErrors) {
      status = 'critical';
      alerts.push(`Consecutive errors: ${this.consecutiveErrors}`);
    }

    if (status !== this.metrics.systemStatus) {
      this.metrics.systemStatus = status;
      this.sendAlert(status, alerts);
    }
  }

  // アラート送信
  async sendAlert(status, alerts) {
    const alertData = {
      timestamp: new Date().toISOString(),
      status: status,
      alerts: alerts,
      metrics: {
        requestCount: this.metrics.requestCount,
        errorCount: this.metrics.errorCount,
        errorRate: (this.metrics.errorCount / this.metrics.requestCount * 100).toFixed(2) + '%',
        avgResponseTime: this.getAverageResponseTime() + 'ms'
      }
    };

    console.log(JSON.stringify({
      severity: status === 'critical' ? 'ERROR' : 'WARNING',
      msg: 'System health alert',
      ...alertData
    }));

    // Slack/Discord/メール通知などをここに実装
    // await this.notifyAdministrators(alertData);
  }

  // 現在のメトリクスを取得
  getMetrics() {
    return {
      ...this.metrics,
      errorRate: this.metrics.requestCount > 0 
        ? (this.metrics.errorCount / this.metrics.requestCount * 100).toFixed(2) + '%'
        : '0%',
      avgResponseTime: this.getAverageResponseTime() + 'ms',
      lastUpdated: new Date().toISOString()
    };
  }

  // 平均レスポンス時間を計算
  getAverageResponseTime() {
    if (this.metrics.responseTime.length === 0) return 0;
    return Math.round(
      this.metrics.responseTime.reduce((a, b) => a + b, 0) / this.metrics.responseTime.length
    );
  }

  // ヘルスチェック実行
  async performHealthCheck() {
    const startTime = Date.now();
    let isHealthy = true;
    const checks = [];

    try {
      // データベース接続チェック
      const supabase = createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_ANON_KEY
      );
      
      const { data, error } = await supabase
        .from('reservations')
        .select('id')
        .limit(1);
      
      checks.push({
        name: 'Database',
        status: error ? 'failed' : 'ok',
        responseTime: Date.now() - startTime,
        error: error?.message
      });

      if (error) isHealthy = false;

    } catch (error) {
      checks.push({
        name: 'Database',
        status: 'failed',
        responseTime: Date.now() - startTime,
        error: error.message
      });
      isHealthy = false;
    }

    // LINE API接続チェック
    try {
      const lineResponse = await fetch('https://api.line.me/v2/bot/info', {
        headers: {
          'Authorization': `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}`
        }
      });

      checks.push({
        name: 'LINE API',
        status: lineResponse.ok ? 'ok' : 'failed',
        responseTime: Date.now() - startTime,
        statusCode: lineResponse.status
      });

      if (!lineResponse.ok) isHealthy = false;

    } catch (error) {
      checks.push({
        name: 'LINE API',
        status: 'failed',
        responseTime: Date.now() - startTime,
        error: error.message
      });
      isHealthy = false;
    }

    this.metrics.lastHealthCheck = {
      timestamp: new Date().toISOString(),
      status: isHealthy ? 'healthy' : 'unhealthy',
      checks: checks,
      totalResponseTime: Date.now() - startTime
    };

    return this.metrics.lastHealthCheck;
  }

  // メトリクスをリセット
  resetMetrics() {
    this.metrics = {
      requestCount: 0,
      errorCount: 0,
      responseTime: [],
      lastHealthCheck: null,
      systemStatus: 'healthy'
    };
    this.consecutiveErrors = 0;
  }
}

// シングルトンインスタンス
const healthMonitor = new HealthMonitor();

// 定期的なヘルスチェック（5分間隔）
setInterval(() => {
  healthMonitor.performHealthCheck();
}, 5 * 60 * 1000);

export default healthMonitor;