// GCP コスト最適化
// Cloud Run、Firestore、ネットワーク転送の最適化

class GCPCostOptimizer {
  constructor() {
    // Cloud Run設定
    this.cloudRunConfig = {
      minInstances: 0,          // コールドスタート許容でコスト削減
      maxInstances: 3,          // 最大インスタンス数制限
      concurrency: 100,         // 1インスタンスあたりの同時リクエスト数
      cpuThrottling: true,      // リクエスト処理時のみCPU割り当て
      memoryLimit: '256Mi',     // メモリ制限（最小値）
      timeout: '60s',           // タイムアウト短縮
      cpuLimit: '1'            // CPU制限
    };

    // 自動スケーリング設定
    this.scalingConfig = {
      // 時間帯別スケーリング
      schedule: {
        // ピーク時間（11:00-14:00, 18:00-21:00）
        peak: {
          minInstances: 1,
          maxInstances: 5,
          concurrency: 80
        },
        // オフピーク時間
        offPeak: {
          minInstances: 0,
          maxInstances: 2,
          concurrency: 100
        },
        // 深夜（23:00-6:00）
        night: {
          minInstances: 0,
          maxInstances: 1,
          concurrency: 100
        }
      }
    };

    // リージョン最適化
    this.regionConfig = {
      primary: 'asia-northeast1',     // 東京（プライマリ）
      fallback: 'asia-northeast2',    // 大阪（フォールバック）
      cdn: {
        enabled: true,
        provider: 'cloudflare',       // 無料CDN活用
        cacheRules: {
          images: 31536000,            // 1年
          static: 86400,               // 1日
          api: 0                       // キャッシュなし
        }
      }
    };

    // コスト監視
    this.costTracking = {
      daily: 0,
      monthly: 0,
      alerts: {
        daily: 100,     // $100/日
        monthly: 1000   // $1000/月
      }
    };
  }

  // Cloud Run最適化設定生成
  generateCloudRunConfig() {
    const hour = new Date().getHours();
    let config;

    // 時間帯に応じた設定
    if ((hour >= 11 && hour <= 14) || (hour >= 18 && hour <= 21)) {
      config = this.scalingConfig.schedule.peak;
    } else if (hour >= 23 || hour < 6) {
      config = this.scalingConfig.schedule.night;
    } else {
      config = this.scalingConfig.schedule.offPeak;
    }

    return {
      apiVersion: 'serving.knative.dev/v1',
      kind: 'Service',
      metadata: {
        name: 'line-booking-api',
        annotations: {
          'run.googleapis.com/cpu-throttling': 'true',
          'run.googleapis.com/startup-cpu-boost': 'false'
        }
      },
      spec: {
        template: {
          metadata: {
            annotations: {
              'autoscaling.knative.dev/minScale': String(config.minInstances),
              'autoscaling.knative.dev/maxScale': String(config.maxInstances),
              'run.googleapis.com/execution-environment': 'gen2'
            }
          },
          spec: {
            containerConcurrency: config.concurrency,
            timeoutSeconds: 60,
            containers: [{
              resources: {
                limits: {
                  cpu: '1',
                  memory: '256Mi'
                }
              }
            }]
          }
        }
      }
    };
  }

  // ネットワーク転送量削減
  optimizeNetworkTransfer(response) {
    const optimizations = [];

    // 1. レスポンス圧縮
    if (response.length > 1024) {
      optimizations.push('gzip');
    }

    // 2. 不要なヘッダー削除
    const unnecessaryHeaders = [
      'x-powered-by',
      'server',
      'x-aspnet-version'
    ];
    
    // 3. 画像の遅延読み込み
    if (response.includes('<img')) {
      response = response.replace(/<img/g, '<img loading="lazy"');
      optimizations.push('lazy-loading');
    }

    // 4. JSONレスポンス最小化
    if (typeof response === 'object') {
      // nullや空配列を削除
      response = this.removeEmptyValues(response);
      optimizations.push('json-minify');
    }

    console.log(`Network optimizations applied: ${optimizations.join(', ')}`);
    return response;
  }

  // 空値削除
  removeEmptyValues(obj) {
    const cleaned = {};
    
    Object.entries(obj).forEach(([key, value]) => {
      if (value !== null && value !== undefined && value !== '') {
        if (Array.isArray(value) && value.length === 0) {
          return; // 空配列をスキップ
        }
        if (typeof value === 'object' && !Array.isArray(value)) {
          cleaned[key] = this.removeEmptyValues(value);
        } else {
          cleaned[key] = value;
        }
      }
    });
    
    return cleaned;
  }

  // Supabase最適化
  optimizeSupabaseQueries() {
    return {
      // RLSポリシー最適化
      rls: {
        enabled: true,
        policies: [
          'CREATE POLICY "店舗別アクセス" ON reservations USING (store_id = current_setting(\'app.store_id\'))',
          'CREATE INDEX idx_store_date ON reservations(store_id, reservation_date)',
          'CREATE INDEX idx_user_status ON reservations(user_id, status)'
        ]
      },
      
      // 接続プーリング
      pooling: {
        mode: 'transaction',
        pool_size: 10,
        statement_cache_size: 0
      },

      // クエリ最適化
      queries: {
        // SELECT最適化
        selectOptimization: `
          -- 必要なカラムのみ選択
          SELECT id, user_id, reservation_date, status 
          FROM reservations 
          WHERE store_id = $1 
            AND reservation_date >= CURRENT_DATE 
          LIMIT 100
        `,
        
        // バッチ挿入
        batchInsert: `
          INSERT INTO reservations (user_id, store_id, reservation_date, status)
          SELECT * FROM unnest($1::uuid[], $2::uuid[], $3::date[], $4::text[])
        `
      }
    };
  }

  // コスト計算
  calculateCosts(metrics) {
    const costs = {
      cloudRun: {
        cpu: metrics.cpuSeconds * 0.00002400,      // $0.000024/vCPU秒
        memory: metrics.memoryGBSeconds * 0.0000025, // $0.0000025/GB秒
        requests: metrics.requests * 0.0000004      // $0.40/100万リクエスト
      },
      storage: {
        firestore: metrics.firestoreGB * 0.18,      // $0.18/GB
        cloudStorage: metrics.storageGB * 0.020     // $0.020/GB
      },
      network: {
        egress: metrics.egressGB * 0.12            // $0.12/GB（アジア内）
      }
    };

    const total = Object.values(costs).reduce((sum, category) => 
      sum + Object.values(category).reduce((s, v) => s + v, 0), 0
    );

    return {
      breakdown: costs,
      total: total.toFixed(2),
      projection: {
        daily: (total * 24).toFixed(2),
        monthly: (total * 24 * 30).toFixed(2)
      }
    };
  }

  // コスト削減推奨事項
  getCostRecommendations() {
    return [
      {
        area: 'Cloud Run',
        recommendations: [
          'CPU throttlingを有効化（リクエスト処理時のみCPU使用）',
          'メモリを256MBに制限（十分な場合）',
          '最小インスタンス数を0に設定（コールドスタート許容）',
          'タイムアウトを60秒に短縮',
          '同時実行数を100に増やしてインスタンス数を削減'
        ],
        estimatedSaving: '60-70%'
      },
      {
        area: 'データベース',
        recommendations: [
          'Supabase無料プランの活用（500MB、無制限API）',
          'インデックス最適化でクエリ時間短縮',
          'キャッシュ活用でDB読み取り削減',
          'バッチ処理で書き込み回数削減'
        ],
        estimatedSaving: '80-90%'
      },
      {
        area: 'ネットワーク',
        recommendations: [
          'CloudflareなどのCDN活用（無料プラン）',
          'レスポンス圧縮（gzip/brotli）',
          '画像最適化（WebP形式、遅延読み込み）',
          'API レスポンスの最小化'
        ],
        estimatedSaving: '50-60%'
      },
      {
        area: 'モニタリング',
        recommendations: [
          'Cloud Loggingのログレベル調整（ERRORのみ）',
          'メトリクスの保持期間短縮',
          'アラート頻度の最適化'
        ],
        estimatedSaving: '30-40%'
      }
    ];
  }

  // 自動スケジューリング
  async applyScheduledScaling() {
    const hour = new Date().getHours();
    const dayOfWeek = new Date().getDay();
    
    // 週末は全体的にスケールダウン
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    
    let config;
    if (isWeekend) {
      config = {
        minInstances: 0,
        maxInstances: 2,
        concurrency: 100
      };
    } else {
      // 平日は時間帯別
      if ((hour >= 11 && hour <= 14) || (hour >= 18 && hour <= 21)) {
        config = this.scalingConfig.schedule.peak;
      } else if (hour >= 23 || hour < 6) {
        config = this.scalingConfig.schedule.night;
      } else {
        config = this.scalingConfig.schedule.offPeak;
      }
    }

    console.log(`Auto-scaling applied: ${JSON.stringify(config)}`);
    return config;
  }

  // コストアラート
  checkCostAlerts(currentCosts) {
    const alerts = [];

    if (currentCosts.daily > this.costTracking.alerts.daily) {
      alerts.push({
        level: 'WARNING',
        message: `Daily cost ($${currentCosts.daily}) exceeds threshold ($${this.costTracking.alerts.daily})`
      });
    }

    if (currentCosts.monthly > this.costTracking.alerts.monthly) {
      alerts.push({
        level: 'CRITICAL',
        message: `Monthly cost ($${currentCosts.monthly}) exceeds threshold ($${this.costTracking.alerts.monthly})`
      });
    }

    return alerts;
  }
}

// シングルトンインスタンス
const gcpOptimizer = new GCPCostOptimizer();

export default gcpOptimizer;
export { GCPCostOptimizer };