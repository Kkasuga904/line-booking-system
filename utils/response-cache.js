// レスポンスキャッシュ最適化
// LINE APIレスポンスとSupabaseクエリ結果のキャッシング

import NodeCache from 'node-cache';
import crypto from 'crypto';

class ResponseCache {
  constructor() {
    // メインキャッシュ（短期間）
    this.cache = new NodeCache({
      stdTTL: 300,      // 5分デフォルトTTL
      checkperiod: 60,  // 60秒ごとに期限切れチェック
      useClones: false, // パフォーマンス向上のためクローンしない
      maxKeys: 1000     // 最大1000キー
    });

    // 長期キャッシュ（設定データ等）
    this.longCache = new NodeCache({
      stdTTL: 3600,     // 1時間デフォルトTTL
      checkperiod: 300, // 5分ごとにチェック
      useClones: false,
      maxKeys: 100
    });

    // 統計情報
    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0
    };

    // キャッシュ戦略
    this.strategies = {
      // 予約リスト（ユーザー別）
      reservations: {
        ttl: 180,  // 3分
        key: (userId, storeId) => `res:${storeId}:${userId}`
      },
      // 空きスロット（店舗・日付別）
      slots: {
        ttl: 120,  // 2分
        key: (storeId, date) => `slot:${storeId}:${date}`
      },
      // 店舗設定（長期キャッシュ）
      storeSettings: {
        ttl: 3600, // 1時間
        key: (storeId) => `settings:${storeId}`,
        useLongCache: true
      },
      // メニュー情報（長期キャッシュ）
      menus: {
        ttl: 1800, // 30分
        key: (storeId) => `menu:${storeId}`,
        useLongCache: true
      },
      // ユーザープロファイル
      userProfile: {
        ttl: 600,  // 10分
        key: (userId) => `user:${userId}`
      }
    };
  }

  // キャッシュキー生成
  generateKey(type, ...params) {
    const strategy = this.strategies[type];
    if (!strategy) {
      // 戦略が定義されていない場合はハッシュ化
      const hash = crypto.createHash('md5')
        .update(`${type}:${params.join(':')}`)
        .digest('hex');
      return hash.substring(0, 16);
    }
    return strategy.key(...params);
  }

  // キャッシュ取得
  async get(type, ...params) {
    const key = this.generateKey(type, ...params);
    const strategy = this.strategies[type];
    const cache = strategy?.useLongCache ? this.longCache : this.cache;

    const value = cache.get(key);
    
    if (value !== undefined) {
      this.stats.hits++;
      return value;
    }

    this.stats.misses++;
    return null;
  }

  // キャッシュ設定
  async set(type, value, ...params) {
    const key = this.generateKey(type, ...params);
    const strategy = this.strategies[type];
    const cache = strategy?.useLongCache ? this.longCache : this.cache;
    const ttl = strategy?.ttl || 300;

    const success = cache.set(key, value, ttl);
    if (success) {
      this.stats.sets++;
    }
    return success;
  }

  // キャッシュ削除
  async delete(type, ...params) {
    const key = this.generateKey(type, ...params);
    const strategy = this.strategies[type];
    const cache = strategy?.useLongCache ? this.longCache : this.cache;

    const deleted = cache.del(key);
    if (deleted > 0) {
      this.stats.deletes++;
    }
    return deleted;
  }

  // パターンで削除（例: 特定店舗の全キャッシュ）
  async deletePattern(pattern) {
    const keys = this.cache.keys();
    const longKeys = this.longCache.keys();
    let deletedCount = 0;

    // 通常キャッシュから削除
    keys.forEach(key => {
      if (key.includes(pattern)) {
        this.cache.del(key);
        deletedCount++;
      }
    });

    // 長期キャッシュから削除
    longKeys.forEach(key => {
      if (key.includes(pattern)) {
        this.longCache.del(key);
        deletedCount++;
      }
    });

    this.stats.deletes += deletedCount;
    return deletedCount;
  }

  // キャッシュまたは実行
  async getOrSet(type, fetchFn, ...params) {
    // キャッシュから取得試行
    const cached = await this.get(type, ...params);
    if (cached !== null) {
      return cached;
    }

    // キャッシュになければ実行
    try {
      const result = await fetchFn();
      
      // 結果をキャッシュ
      if (result !== null && result !== undefined) {
        await this.set(type, result, ...params);
      }
      
      return result;
    } catch (error) {
      console.error(`Cache fetch error for ${type}:`, error);
      throw error;
    }
  }

  // バッチキャッシュ取得
  async getMultiple(keys) {
    const results = {};
    const missingKeys = [];

    for (const key of keys) {
      const value = this.cache.get(key);
      if (value !== undefined) {
        results[key] = value;
        this.stats.hits++;
      } else {
        missingKeys.push(key);
        this.stats.misses++;
      }
    }

    return { results, missingKeys };
  }

  // バッチキャッシュ設定
  async setMultiple(items, ttl = 300) {
    let successCount = 0;
    
    for (const [key, value] of Object.entries(items)) {
      if (this.cache.set(key, value, ttl)) {
        successCount++;
      }
    }
    
    this.stats.sets += successCount;
    return successCount;
  }

  // キャッシュウォーミング（事前読み込み）
  async warmup(storeId) {
    const warmupTasks = [
      // 店舗設定を事前読み込み
      { type: 'storeSettings', params: [storeId] },
      // メニュー情報を事前読み込み
      { type: 'menus', params: [storeId] },
      // 今日と明日のスロットを事前読み込み
      { type: 'slots', params: [storeId, new Date().toISOString().split('T')[0]] },
      { type: 'slots', params: [storeId, new Date(Date.now() + 86400000).toISOString().split('T')[0]] }
    ];

    console.log(`Cache warmup started for store: ${storeId}`);
    
    // 並列で実行
    await Promise.all(warmupTasks.map(task => 
      this.get(task.type, ...task.params)
    ));
    
    console.log(`Cache warmup completed for store: ${storeId}`);
  }

  // 統計情報取得
  getStats() {
    const total = this.stats.hits + this.stats.misses;
    const hitRate = total > 0 ? (this.stats.hits / total * 100).toFixed(2) : 0;

    return {
      ...this.stats,
      hitRate: `${hitRate}%`,
      cacheSize: this.cache.keys().length,
      longCacheSize: this.longCache.keys().length,
      memoryUsage: this.estimateMemoryUsage()
    };
  }

  // メモリ使用量推定
  estimateMemoryUsage() {
    const avgValueSize = 1024; // 1KB平均と仮定
    const totalKeys = this.cache.keys().length + this.longCache.keys().length;
    const estimatedMB = (totalKeys * avgValueSize / 1024 / 1024).toFixed(2);
    return `${estimatedMB} MB (推定)`;
  }

  // キャッシュクリア
  clear() {
    this.cache.flushAll();
    this.longCache.flushAll();
    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0
    };
    console.log('All caches cleared');
  }

  // キャッシュ最適化提案
  getOptimizationSuggestions() {
    const suggestions = [];
    const hitRate = this.stats.hits / (this.stats.hits + this.stats.misses) * 100;

    if (hitRate < 50) {
      suggestions.push('ヒット率が低いです。TTLを延長するか、キャッシュ戦略を見直してください。');
    }

    if (this.cache.keys().length > 800) {
      suggestions.push('キャッシュサイズが大きくなっています。不要なキーを削除してください。');
    }

    if (this.stats.misses > this.stats.hits * 2) {
      suggestions.push('ミス率が高いです。よく使用されるデータのキャッシュを優先してください。');
    }

    return suggestions;
  }
}

// シングルトンインスタンス
const responseCache = new ResponseCache();

// Express ミドルウェア
export function cacheMiddleware(type) {
  return async (req, res, next) => {
    // キャッシュキーのパラメータを抽出
    const params = [req.params.storeId, req.params.userId, req.query.date].filter(Boolean);
    
    // キャッシュチェック
    const cached = await responseCache.get(type, ...params);
    if (cached) {
      return res.json(cached);
    }

    // レスポンスをインターセプトしてキャッシュ
    const originalJson = res.json;
    res.json = function(data) {
      responseCache.set(type, data, ...params);
      return originalJson.call(this, data);
    };

    next();
  };
}

export default responseCache;
export { ResponseCache };