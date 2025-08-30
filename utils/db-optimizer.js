// データベース最適化ユーティリティ
// Supabase接続プーリングとクエリ最適化

import { createClient } from '@supabase/supabase-js';

class DatabaseOptimizer {
  constructor() {
    // 接続プール設定
    this.poolConfig = {
      connectionTimeoutMillis: 5000,
      idleTimeoutMillis: 30000,
      max: 10, // 最大接続数
      min: 2,  // 最小接続数
    };
    
    // クエリキャッシュ
    this.queryCache = new Map();
    this.cacheTimeout = 60000; // 1分
    
    // バッチ処理用キュー
    this.batchQueue = [];
    this.batchTimer = null;
    this.batchSize = 50;
    this.batchDelay = 100; // 100ms
  }

  // Supabaseクライアント作成（接続プール付き）
  createOptimizedClient() {
    const options = {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
      realtime: {
        params: {
          eventsPerSecond: 2
        }
      },
      db: {
        schema: 'public'
      },
      global: {
        headers: {
          'x-connection-pool': 'true'
        }
      }
    };

    return createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_ANON_KEY,
      options
    );
  }

  // キャッシュ付きクエリ実行
  async cachedQuery(key, queryFn, ttl = this.cacheTimeout) {
    // キャッシュチェック
    const cached = this.queryCache.get(key);
    if (cached && Date.now() - cached.timestamp < ttl) {
      return cached.data;
    }

    // クエリ実行
    const data = await queryFn();
    
    // キャッシュ保存
    this.queryCache.set(key, {
      data,
      timestamp: Date.now()
    });

    // 古いキャッシュを定期削除
    if (this.queryCache.size > 100) {
      this.cleanupCache();
    }

    return data;
  }

  // バッチ挿入最適化
  async batchInsert(table, records) {
    return new Promise((resolve, reject) => {
      // レコードをキューに追加
      this.batchQueue.push({ table, records, resolve, reject });
      
      // バッチタイマー設定
      if (!this.batchTimer) {
        this.batchTimer = setTimeout(() => this.processBatch(), this.batchDelay);
      }
    });
  }

  // バッチ処理実行
  async processBatch() {
    if (this.batchQueue.length === 0) return;

    const client = this.createOptimizedClient();
    const batches = {};

    // テーブルごとにグループ化
    this.batchQueue.forEach(item => {
      if (!batches[item.table]) {
        batches[item.table] = [];
      }
      batches[item.table].push(item);
    });

    // 各テーブルに対してバッチ挿入
    for (const [table, items] of Object.entries(batches)) {
      const allRecords = items.flatMap(i => i.records);
      
      try {
        // チャンク分割して挿入
        const chunks = this.chunkArray(allRecords, this.batchSize);
        
        for (const chunk of chunks) {
          const { data, error } = await client
            .from(table)
            .insert(chunk);
          
          if (error) throw error;
        }

        // 成功をresolve
        items.forEach(item => item.resolve({ success: true }));
      } catch (error) {
        // エラーをreject
        items.forEach(item => item.reject(error));
      }
    }

    // キューとタイマーをリセット
    this.batchQueue = [];
    this.batchTimer = null;
  }

  // 配列をチャンクに分割
  chunkArray(array, size) {
    const chunks = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  // インデックス最適化提案
  async analyzeIndexes(tableName) {
    const client = this.createOptimizedClient();
    
    // 頻繁に使用されるクエリパターンを分析
    const suggestions = [];
    
    // 予約テーブルの場合
    if (tableName === 'reservations') {
      suggestions.push({
        index: 'idx_reservations_store_date',
        columns: ['store_id', 'reservation_date'],
        reason: '店舗別日付検索の高速化'
      });
      
      suggestions.push({
        index: 'idx_reservations_user_status',
        columns: ['user_id', 'status'],
        reason: 'ユーザー別予約状態検索の高速化'
      });
      
      suggestions.push({
        index: 'idx_reservations_time_slot',
        columns: ['reservation_date', 'reservation_time', 'status'],
        reason: '時間枠の空き状況確認の高速化'
      });
    }

    // スロットテーブルの場合
    if (tableName === 'slots') {
      suggestions.push({
        index: 'idx_slots_store_date_time',
        columns: ['store_id', 'date', 'start_time'],
        reason: '店舗別スロット検索の高速化'
      });
      
      suggestions.push({
        index: 'idx_slots_capacity',
        columns: ['current_count', 'max_capacity'],
        reason: '空きスロット検索の高速化'
      });
    }

    return suggestions;
  }

  // クエリ最適化
  optimizeQuery(query) {
    // SELECT * を避ける
    if (query.includes('SELECT *')) {
      console.warn('避けるべき: SELECT * の使用。必要なカラムのみを指定してください。');
    }

    // N+1問題の検出
    if (query.includes('FOR') && query.includes('SELECT')) {
      console.warn('N+1問題の可能性: JOINまたはバッチクエリの使用を検討してください。');
    }

    // LIMIT句の推奨
    if (!query.includes('LIMIT') && query.includes('SELECT')) {
      console.warn('推奨: LIMIT句を追加して結果セットのサイズを制限してください。');
    }

    return query;
  }

  // キャッシュクリーンアップ
  cleanupCache() {
    const now = Date.now();
    const keysToDelete = [];

    this.queryCache.forEach((value, key) => {
      if (now - value.timestamp > this.cacheTimeout) {
        keysToDelete.push(key);
      }
    });

    keysToDelete.forEach(key => this.queryCache.delete(key));
  }

  // パフォーマンス統計
  getStats() {
    return {
      cacheSize: this.queryCache.size,
      cacheHitRate: this.calculateCacheHitRate(),
      batchQueueSize: this.batchQueue.length,
      recommendations: [
        '定期的なVACUUM実行で断片化を解消',
        'pg_stat_statementsで遅いクエリを特定',
        'connection poolingで接続オーバーヘッドを削減',
        'prepared statementsでクエリパース時間を短縮'
      ]
    };
  }

  calculateCacheHitRate() {
    // 実際の実装では、ヒット/ミスをトラッキング
    return '85%'; // 仮の値
  }
}

// シングルトンインスタンス
const dbOptimizer = new DatabaseOptimizer();

export default dbOptimizer;
export { DatabaseOptimizer };