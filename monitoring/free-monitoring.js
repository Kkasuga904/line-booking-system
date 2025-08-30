/**
 * 無料監視システム
 * GCPコストを最小限に抑えた監視実装
 */

import express from 'express';
import { createClient } from '@supabase/supabase-js';

const app = express();
const PORT = process.env.MONITOR_PORT || 3001;

// Supabaseクライアント（既存の無料DBを活用）
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

// メモリ内メトリクス（永続化不要な短期データ）
const metrics = {
  requests: [],
  errors: [],
  capacityChecks: [],
  alerts: []
};

// メトリクス保持期間（1時間）
const RETENTION_PERIOD = 60 * 60 * 1000;

// メトリクスのクリーンアップ
function cleanupMetrics() {
  const cutoff = Date.now() - RETENTION_PERIOD;
  
  Object.keys(metrics).forEach(key => {
    metrics[key] = metrics[key].filter(item => item.timestamp > cutoff);
  });
}

// 定期クリーンアップ（5分ごと）
setInterval(cleanupMetrics, 5 * 60 * 1000);

/**
 * ヘルスチェックエンドポイント
 * Cloud Run/UptimeRobotから呼び出し
 */
app.get('/health', async (req, res) => {
  try {
    // システムヘルスチェック
    const checks = {
      server: true,
      database: false,
      capacity: false,
      timestamp: new Date().toISOString()
    };
    
    // DB接続チェック（軽量クエリ）
    try {
      const { error } = await supabase
        .from('reservations')
        .select('id')
        .limit(1);
      checks.database = !error;
    } catch (e) {
      console.error('DB check failed:', e);
    }
    
    // 容量チェック機能の確認
    try {
      const { error } = await supabase.rpc('get_capacity_status', {
        _store_id: 'default-store',
        _date: new Date().toISOString().split('T')[0]
      });
      checks.capacity = !error;
    } catch (e) {
      console.error('Capacity check failed:', e);
    }
    
    // ステータス判定
    const isHealthy = checks.server && checks.database;
    
    res.status(isHealthy ? 200 : 503).json(checks);
    
    // メトリクス記録
    metrics.requests.push({
      timestamp: Date.now(),
      endpoint: '/health',
      status: isHealthy ? 'healthy' : 'unhealthy'
    });
    
  } catch (error) {
    res.status(503).json({ error: error.message });
  }
});

/**
 * メトリクス表示（簡易ダッシュボード）
 */
app.get('/metrics', (req, res) => {
  const now = Date.now();
  const fiveMinutesAgo = now - (5 * 60 * 1000);
  
  // 直近5分間の統計
  const recentRequests = metrics.requests.filter(r => r.timestamp > fiveMinutesAgo);
  const recentErrors = metrics.errors.filter(e => e.timestamp > fiveMinutesAgo);
  
  const stats = {
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    requests: {
      total: metrics.requests.length,
      recent: recentRequests.length,
      rpm: (recentRequests.length / 5).toFixed(2)
    },
    errors: {
      total: metrics.errors.length,
      recent: recentErrors.length,
      rate: recentRequests.length > 0 
        ? ((recentErrors.length / recentRequests.length) * 100).toFixed(2) + '%'
        : '0%'
    },
    capacity: {
      checks: metrics.capacityChecks.length,
      lastCheck: metrics.capacityChecks[metrics.capacityChecks.length - 1]
    },
    alerts: metrics.alerts.slice(-10) // 最新10件のアラート
  };
  
  res.json(stats);
});

/**
 * アラート記録エンドポイント
 * サーバーから呼び出される
 */
app.post('/alert', express.json(), (req, res) => {
  const { type, message, severity, data } = req.body;
  
  const alert = {
    timestamp: Date.now(),
    type,
    message,
    severity,
    data
  };
  
  metrics.alerts.push(alert);
  
  // 重要度が高い場合は通知
  if (severity === 'critical') {
    notifyAlert(alert);
  }
  
  res.json({ success: true });
});

/**
 * 容量監視
 * 定期的に容量状態をチェック
 */
async function monitorCapacity() {
  try {
    const today = new Date().toISOString().split('T')[0];
    
    const { data, error } = await supabase.rpc('get_capacity_status', {
      _store_id: 'default-store',
      _date: today
    });
    
    if (error) throw error;
    
    // 満席の時間帯をカウント
    const fullSlots = data.filter(slot => slot.status === 'full').length;
    const limitedSlots = data.filter(slot => slot.status === 'limited').length;
    
    metrics.capacityChecks.push({
      timestamp: Date.now(),
      date: today,
      fullSlots,
      limitedSlots,
      totalSlots: data.length
    });
    
    // 80%以上満席の場合アラート
    if (fullSlots / data.length > 0.8) {
      metrics.alerts.push({
        timestamp: Date.now(),
        type: 'capacity',
        message: `High capacity usage: ${fullSlots}/${data.length} slots full`,
        severity: 'warning'
      });
    }
    
  } catch (error) {
    console.error('Capacity monitoring error:', error);
    metrics.errors.push({
      timestamp: Date.now(),
      type: 'capacity_monitor',
      error: error.message
    });
  }
}

// 10分ごとに容量チェック
setInterval(monitorCapacity, 10 * 60 * 1000);

/**
 * 簡易アラート通知
 * 無料のWebhookサービスを使用
 */
async function notifyAlert(alert) {
  // 環境変数でWebhook URLを設定（Slack、Discord、IFTTT等）
  const webhookUrl = process.env.ALERT_WEBHOOK_URL;
  
  if (!webhookUrl) {
    console.log('Alert:', alert);
    return;
  }
  
  try {
    // Webhook送信（例：Slack形式）
    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: `🚨 ${alert.severity.toUpperCase()}: ${alert.message}`,
        attachments: [{
          color: alert.severity === 'critical' ? 'danger' : 'warning',
          fields: [{
            title: 'Type',
            value: alert.type,
            short: true
          }, {
            title: 'Time',
            value: new Date(alert.timestamp).toISOString(),
            short: true
          }]
        }]
      })
    });
  } catch (error) {
    console.error('Alert notification failed:', error);
  }
}

/**
 * 簡易ダッシュボードHTML
 */
app.get('/dashboard', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Free Monitoring Dashboard</title>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body {
          font-family: Arial, sans-serif;
          margin: 0;
          padding: 20px;
          background: #f5f5f5;
        }
        .container {
          max-width: 1200px;
          margin: 0 auto;
        }
        .card {
          background: white;
          border-radius: 8px;
          padding: 20px;
          margin-bottom: 20px;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .metric {
          display: inline-block;
          margin: 10px 20px;
        }
        .metric-value {
          font-size: 2em;
          font-weight: bold;
          color: #333;
        }
        .metric-label {
          color: #666;
          font-size: 0.9em;
        }
        .status-healthy {
          color: #4CAF50;
        }
        .status-unhealthy {
          color: #f44336;
        }
        .alerts {
          max-height: 300px;
          overflow-y: auto;
        }
        .alert-item {
          padding: 10px;
          margin: 5px 0;
          border-left: 3px solid;
          background: #f9f9f9;
        }
        .alert-critical {
          border-color: #f44336;
        }
        .alert-warning {
          border-color: #ff9800;
        }
        .refresh-btn {
          background: #2196F3;
          color: white;
          border: none;
          padding: 10px 20px;
          border-radius: 4px;
          cursor: pointer;
        }
        .refresh-btn:hover {
          background: #1976D2;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>📊 Free Monitoring Dashboard</h1>
        
        <div class="card">
          <h2>System Health</h2>
          <div id="health-status">Loading...</div>
        </div>
        
        <div class="card">
          <h2>Metrics</h2>
          <div id="metrics">Loading...</div>
        </div>
        
        <div class="card">
          <h2>Recent Alerts</h2>
          <div id="alerts" class="alerts">Loading...</div>
        </div>
        
        <button class="refresh-btn" onclick="refresh()">Refresh</button>
      </div>
      
      <script>
        async function loadData() {
          try {
            // ヘルスチェック
            const healthRes = await fetch('/health');
            const health = await healthRes.json();
            
            document.getElementById('health-status').innerHTML = \`
              <div class="metric">
                <div class="metric-value \${health.database ? 'status-healthy' : 'status-unhealthy'}">
                  \${health.database ? '✓' : '✗'}
                </div>
                <div class="metric-label">Database</div>
              </div>
              <div class="metric">
                <div class="metric-value \${health.capacity ? 'status-healthy' : 'status-unhealthy'}">
                  \${health.capacity ? '✓' : '✗'}
                </div>
                <div class="metric-label">Capacity System</div>
              </div>
            \`;
            
            // メトリクス
            const metricsRes = await fetch('/metrics');
            const metrics = await metricsRes.json();
            
            document.getElementById('metrics').innerHTML = \`
              <div class="metric">
                <div class="metric-value">\${metrics.requests.rpm}</div>
                <div class="metric-label">Requests/min</div>
              </div>
              <div class="metric">
                <div class="metric-value">\${metrics.errors.rate}</div>
                <div class="metric-label">Error Rate</div>
              </div>
              <div class="metric">
                <div class="metric-value">\${Math.floor(metrics.uptime / 60)}m</div>
                <div class="metric-label">Uptime</div>
              </div>
              <div class="metric">
                <div class="metric-value">\${Math.floor(metrics.memory.heapUsed / 1024 / 1024)}MB</div>
                <div class="metric-label">Memory</div>
              </div>
            \`;
            
            // アラート
            const alertsHtml = metrics.alerts.length > 0
              ? metrics.alerts.reverse().map(alert => \`
                  <div class="alert-item alert-\${alert.severity}">
                    <strong>\${alert.type}</strong>: \${alert.message}
                    <br><small>\${new Date(alert.timestamp).toLocaleString()}</small>
                  </div>
                \`).join('')
              : '<p>No recent alerts</p>';
            
            document.getElementById('alerts').innerHTML = alertsHtml;
            
          } catch (error) {
            console.error('Failed to load data:', error);
          }
        }
        
        function refresh() {
          loadData();
        }
        
        // 初回ロード
        loadData();
        
        // 30秒ごとに自動更新
        setInterval(loadData, 30000);
      </script>
    </body>
    </html>
  `);
});

// サーバー起動
app.listen(PORT, () => {
  console.log(`Free monitoring system running on port ${PORT}`);
  console.log(`Dashboard: http://localhost:${PORT}/dashboard`);
  
  // 初回容量チェック
  monitorCapacity();
});

export default app;