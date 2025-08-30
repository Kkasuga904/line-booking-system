#!/bin/bash

# 無料監視システムセットアップスクリプト
# コスト: $0/月

echo "🚀 Setting up free monitoring system..."

# 1. UptimeRobot設定（無料プラン: 50モニターまで）
echo "📊 Step 1: UptimeRobot Setup"
echo "Please set up UptimeRobot monitoring:"
echo "1. Go to https://uptimerobot.com"
echo "2. Create a free account"
echo "3. Add HTTP(s) monitor:"
echo "   - URL: https://line-booking-api-116429620992.asia-northeast1.run.app/api/ping"
echo "   - Check interval: 5 minutes"
echo "   - Alert contacts: Your email"
echo ""

# 2. Google Cloud Monitoring（無料枠）
echo "📈 Step 2: Google Cloud Monitoring (Free tier)"
cat << EOF > monitoring-policy.json
{
  "displayName": "Free CPU Alert",
  "conditions": [{
    "displayName": "CPU usage > 80%",
    "conditionThreshold": {
      "filter": "resource.type=\"cloud_run_revision\" AND metric.type=\"run.googleapis.com/container/cpu/utilizations\"",
      "comparison": "COMPARISON_GT",
      "thresholdValue": 0.8,
      "duration": "60s",
      "aggregations": [{
        "alignmentPeriod": "60s",
        "perSeriesAligner": "ALIGN_MEAN"
      }]
    }
  }],
  "notificationChannels": [],
  "alertStrategy": {
    "autoClose": "1800s"
  }
}
EOF

echo "Creating alert policy..."
gcloud alpha monitoring policies create --policy-from-file=monitoring-policy.json || true

# 3. Cloud Logging設定（無料枠: 50GB/月）
echo "📝 Step 3: Cloud Logging Setup"
cat << EOF > logging-sink.json
{
  "name": "critical-errors",
  "destination": "logging.googleapis.com/projects/line-booking-prod-20241228/logs/critical",
  "filter": "severity >= ERROR AND resource.type=\"cloud_run_revision\"",
  "description": "Critical errors from Cloud Run"
}
EOF

echo "Creating log sink..."
gcloud logging sinks create critical-errors \
  logging.googleapis.com/projects/line-booking-prod-20241228/logs/critical \
  --log-filter='severity >= ERROR AND resource.type="cloud_run_revision"' || true

# 4. 無料Webhook設定（Slack/Discord）
echo "🔔 Step 4: Webhook Setup (Optional)"
echo "For free alerting, set up one of these:"
echo ""
echo "Option A - Slack (Free):"
echo "1. Create Slack workspace"
echo "2. Add Incoming Webhook app"
echo "3. Copy webhook URL"
echo ""
echo "Option B - Discord (Free):"
echo "1. Create Discord server"
echo "2. Server Settings > Integrations > Webhooks"
echo "3. Copy webhook URL"
echo ""
echo "Option C - IFTTT (Free tier: 2 applets):"
echo "1. Create IFTTT account"
echo "2. Create Webhook applet"
echo "3. Copy webhook URL"
echo ""

# 5. cron-job.org設定（無料クーロンジョブ）
echo "⏰ Step 5: Free Cron Job Setup"
echo "Visit https://cron-job.org/en/"
echo "Create a free account and add job:"
echo "- URL: https://line-booking-api-116429620992.asia-northeast1.run.app/api/ping"
echo "- Schedule: Every 5 minutes"
echo "- Request method: GET"
echo ""

# 6. 環境変数設定
echo "🔧 Step 6: Environment Variables"
cat << EOF > .env.monitoring
# Monitoring Configuration (Free Tier)
MONITOR_PORT=3001
ALERT_WEBHOOK_URL=your_webhook_url_here
SUPABASE_URL=https://faenvzzeguvlconvrqgp.supabase.co
SUPABASE_ANON_KEY=your_key_here

# Monitoring Thresholds
MAX_ERROR_RATE=0.05
MAX_RESPONSE_TIME=2000
MIN_UPTIME=0.99
EOF

echo "✅ Created .env.monitoring - Please update with your values"

# 7. ローカル監視サーバー起動スクリプト
cat << 'EOF' > start-monitoring.sh
#!/bin/bash
# ローカル監視サーバー起動

# 環境変数読み込み
if [ -f .env.monitoring ]; then
  export $(cat .env.monitoring | grep -v '^#' | xargs)
fi

# 監視サーバー起動
node monitoring/free-monitoring.js &
MONITOR_PID=$!

echo "Monitoring server started (PID: $MONITOR_PID)"
echo "Dashboard: http://localhost:3001/dashboard"

# 終了時にクリーンアップ
trap "kill $MONITOR_PID" EXIT

# 待機
wait $MONITOR_PID
EOF

chmod +x start-monitoring.sh

# 8. サマリー表示
echo ""
echo "========================================="
echo "✅ Free Monitoring Setup Complete!"
echo "========================================="
echo ""
echo "📊 Monitoring Stack (Cost: $0/month):"
echo "  - UptimeRobot: External uptime monitoring"
echo "  - Google Cloud Monitoring: Free tier (up to 1M metrics)"
echo "  - Google Cloud Logging: 50GB/month free"
echo "  - Cron-job.org: Free scheduled health checks"
echo "  - Local dashboard: http://localhost:3001/dashboard"
echo ""
echo "🎯 Next Steps:"
echo "1. Set up UptimeRobot monitoring"
echo "2. Configure webhook URL in .env.monitoring"
echo "3. Run: ./start-monitoring.sh"
echo ""
echo "💡 Tips:"
echo "- Keep Cloud Run min-instances=0 to save cost"
echo "- Use batched requests to reduce API calls"
echo "- Archive old logs to Cloud Storage (cheaper)"
echo "- Use client-side caching to reduce server load"
echo ""

# クリーンアップ
rm -f monitoring-policy.json logging-sink.json

echo "🎉 Setup complete!"