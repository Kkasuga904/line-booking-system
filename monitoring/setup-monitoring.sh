#!/bin/bash

# 監視設定セットアップスクリプト
# 使用方法: ./setup-monitoring.sh [PROJECT_ID]

set -e

PROJECT_ID=${1:-"line-booking-prod-20241228"}

echo "=========================================="
echo "📊 Setting up Monitoring for $PROJECT_ID"
echo "=========================================="

# ログベースメトリクスの作成
echo ""
echo "📈 Creating log-based metrics..."

# store_id別リクエスト数
gcloud logging metrics create requests_by_store \
  --description="Requests by store_id" \
  --project=$PROJECT_ID \
  --log-filter='
    resource.type="cloud_run_revision"
    jsonPayload.store_id!=""
  ' \
  --value-extractor='EXTRACT(jsonPayload.store_id)' \
  --metric-kind=DELTA \
  --value-type=INT64 || echo "Metric already exists"

# エラーログカウント
gcloud logging metrics create error_logs_by_store \
  --description="Error logs by store_id" \
  --project=$PROJECT_ID \
  --log-filter='
    resource.type="cloud_run_revision"
    severity>=ERROR
    jsonPayload.store_id!=""
  ' \
  --value-extractor='EXTRACT(jsonPayload.store_id)' \
  --metric-kind=DELTA \
  --value-type=INT64 || echo "Metric already exists"

# 予約成功/失敗
gcloud logging metrics create reservation_outcomes \
  --description="Reservation success/failure" \
  --project=$PROJECT_ID \
  --log-filter='
    resource.type="cloud_run_revision"
    jsonPayload.msg=~"Reservation.*"
    jsonPayload.action=~"created|failed"
  ' \
  --value-extractor='EXTRACT(jsonPayload.action)' \
  --metric-kind=DELTA \
  --value-type=INT64 || echo "Metric already exists"

echo "✅ Log-based metrics created"

# アラートポリシーの作成
echo ""
echo "🚨 Creating alert policies..."

# 5xxエラー率アラート
cat > /tmp/error_rate_alert.yaml << EOF
displayName: "High 5xx Error Rate (Multi-tenant)"
conditions:
  - displayName: "5xx error rate > 1%"
    conditionThreshold:
      filter: |
        metric.type="run.googleapis.com/request_count"
        AND resource.type="cloud_run_revision"
        AND resource.labels.service_name="line-booking-api"
        AND metric.labels.response_code_class="5xx"
      aggregations:
        - perSeriesAligner: ALIGN_RATE
          crossSeriesReducer: REDUCE_SUM
      comparison: COMPARISON_GT
      thresholdValue: 0.01
      duration: 60s
enabled: true
EOF

gcloud alpha monitoring policies create --policy-from-file=/tmp/error_rate_alert.yaml \
  --project=$PROJECT_ID || echo "Alert policy already exists"

# P95レイテンシアラート
cat > /tmp/latency_alert.yaml << EOF
displayName: "High P95 Latency (Multi-tenant)"
conditions:
  - displayName: "P95 latency > 2 seconds"
    conditionThreshold:
      filter: |
        metric.type="run.googleapis.com/request_latencies"
        AND resource.type="cloud_run_revision"
        AND resource.labels.service_name="line-booking-api"
      aggregations:
        - perSeriesAligner: ALIGN_PERCENTILE_95
          crossSeriesReducer: REDUCE_MEAN
      comparison: COMPARISON_GT
      thresholdValue: 2000
      duration: 300s
enabled: true
EOF

gcloud alpha monitoring policies create --policy-from-file=/tmp/latency_alert.yaml \
  --project=$PROJECT_ID || echo "Alert policy already exists"

echo "✅ Alert policies created"

# カスタムダッシュボード作成用のJSONを生成
echo ""
echo "📊 Generating dashboard configuration..."

cat > /tmp/dashboard.json << 'EOF'
{
  "displayName": "LINE Booking - Multi-tenant Monitoring",
  "mosaicLayout": {
    "columns": 12,
    "tiles": [
      {
        "width": 6,
        "height": 4,
        "widget": {
          "title": "5xx Error Rate by Store",
          "xyChart": {
            "dataSets": [{
              "timeSeriesQuery": {
                "timeSeriesFilter": {
                  "filter": "metric.type=\"run.googleapis.com/request_count\" AND resource.type=\"cloud_run_revision\" AND metric.labels.response_code_class=\"5xx\"",
                  "aggregation": {
                    "alignmentPeriod": "60s",
                    "perSeriesAligner": "ALIGN_RATE"
                  }
                }
              }
            }]
          }
        }
      },
      {
        "xPos": 6,
        "width": 6,
        "height": 4,
        "widget": {
          "title": "P95 Latency",
          "xyChart": {
            "dataSets": [{
              "timeSeriesQuery": {
                "timeSeriesFilter": {
                  "filter": "metric.type=\"run.googleapis.com/request_latencies\" AND resource.type=\"cloud_run_revision\"",
                  "aggregation": {
                    "alignmentPeriod": "60s",
                    "perSeriesAligner": "ALIGN_PERCENTILE_95"
                  }
                }
              }
            }]
          }
        }
      },
      {
        "yPos": 4,
        "width": 12,
        "height": 4,
        "widget": {
          "title": "Request Count by Store",
          "xyChart": {
            "dataSets": [{
              "timeSeriesQuery": {
                "timeSeriesFilter": {
                  "filter": "metric.type=\"logging.googleapis.com/user/requests_by_store\" AND resource.type=\"cloud_run_revision\"",
                  "aggregation": {
                    "alignmentPeriod": "60s",
                    "perSeriesAligner": "ALIGN_RATE"
                  }
                }
              }
            }]
          }
        }
      }
    ]
  }
}
EOF

echo "Dashboard JSON saved to /tmp/dashboard.json"
echo ""
echo "To create the dashboard, visit:"
echo "https://console.cloud.google.com/monitoring/dashboards?project=$PROJECT_ID"
echo "And import /tmp/dashboard.json"

# ログビューの作成
echo ""
echo "📝 Creating useful log queries..."

cat > /tmp/useful_queries.txt << 'EOF'
# 店舗別エラーログ
resource.type="cloud_run_revision"
severity>=ERROR
jsonPayload.store_id="store-a"

# 予約作成ログ
resource.type="cloud_run_revision"
jsonPayload.msg=~"Reservation created"
jsonPayload.store_id="store-a"

# 高レイテンシリクエスト（>1秒）
resource.type="cloud_run_revision"
jsonPayload.ms>1000

# 容量制限によるブロック
resource.type="cloud_run_revision"
jsonPayload.msg=~"Capacity.*blocked"

# store_id が設定されていないリクエスト（問題の検出）
resource.type="cloud_run_revision"
jsonPayload.store_id="unknown"
EOF

echo "Useful queries saved to /tmp/useful_queries.txt"

echo ""
echo "=========================================="
echo "✅ Monitoring setup complete!"
echo "=========================================="
echo ""
echo "📊 View dashboards:"
echo "   https://console.cloud.google.com/monitoring/dashboards?project=$PROJECT_ID"
echo ""
echo "📝 View logs:"
echo "   https://console.cloud.google.com/logs?project=$PROJECT_ID"
echo ""
echo "🚨 View alerts:"
echo "   https://console.cloud.google.com/monitoring/alerting/policies?project=$PROJECT_ID"
echo ""
echo "📈 Key metrics to watch:"
echo "   - 5xx error rate < 0.1%"
echo "   - P95 latency < 1 second"
echo "   - All logs contain store_id"
echo "   - No 'unknown' store_id entries"
echo "=========================================="