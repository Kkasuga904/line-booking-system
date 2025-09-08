// インメモリキャッシュマネージャー
// Supabaseへのクエリを削減してコスト削減

class CacheManager {
  constructor() {
    this.cache = new Map();
    this.ttl = 5 * 60 * 1000; // 5分のTTL
    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0
    };
  }

  // キャッシュキー生成
  generateKey(prefix, params) {
    return `${prefix}:${JSON.stringify(params)}`;
  }

  // データ取得（キャッシュ優先）
  async get(key, fetchFunction) {
    const cached = this.cache.get(key);
    
    // キャッシュヒット
    if (cached && cached.expiry > Date.now()) {
      this.stats.hits++;
      console.log(`Cache hit for key: ${key}`);
      return cached.data;
    }
    
    // キャッシュミス - データ取得
    this.stats.misses++;
    console.log(`Cache miss for key: ${key}`);
    
    try {
      const data = await fetchFunction();
      this.set(key, data);
      return data;
    } catch (error) {
      console.error('Cache fetch error:', error);
      throw error;
    }
  }

  // データ設定
  set(key, data, customTtl = null) {
    const ttl = customTtl || this.ttl;
    this.cache.set(key, {
      data,
      expiry: Date.now() + ttl
    });
    this.stats.sets++;
    
    // メモリ管理（最大100エントリ）
    if (this.cache.size > 100) {
      const oldestKey = this.cache.keys().next().value;
      this.cache.delete(oldestKey);
    }
  }

  // キャッシュ削除
  delete(key) {
    this.cache.delete(key);
    this.stats.deletes++;
  }

  // パターンマッチで削除
  deletePattern(pattern) {
    for (const key of this.cache.keys()) {
      if (key.includes(pattern)) {
        this.delete(key);
      }
    }
  }

  // 予約データキャッシュ
  async getCachedReservations(storeId, date, supabase) {
    const key = this.generateKey('reservations', { storeId, date });
    
    return this.get(key, async () => {
      const { data, error } = await supabase
        .from('reservations')
        .select('*')
        .eq('store_id', storeId)
        .eq('date', date)
        .eq('status', 'confirmed');
      
      if (error) throw error;
      return data || [];
    });
  }

  // 時間制限キャッシュ
  async getCachedRestrictions(storeId, date, supabase) {
    const key = this.generateKey('restrictions', { storeId, date });
    
    return this.get(key, async () => {
      const { data, error } = await supabase
        .from('time_restrictions')
        .select('*')
        .eq('store_id', storeId)
        .eq('date', date);
      
      if (error) throw error;
      return data || [];
    });
  }

  // 統計情報取得
  getStats() {
    const total = this.stats.hits + this.stats.misses;
    const hitRate = total > 0 ? (this.stats.hits / total * 100).toFixed(2) : 0;
    
    return {
      ...this.stats,
      hitRate: `${hitRate}%`,
      cacheSize: this.cache.size,
      estimatedMemoryMB: (JSON.stringify([...this.cache]).length / 1024 / 1024).toFixed(2)
    };
  }

  // 期限切れエントリの削除
  cleanup() {
    const now = Date.now();
    let cleaned = 0;
    
    for (const [key, value] of this.cache.entries()) {
      if (value.expiry < now) {
        this.cache.delete(key);
        cleaned++;
      }
    }
    
    console.log(`Cache cleanup: removed ${cleaned} expired entries`);
    return cleaned;
  }
}

// シングルトンインスタンス
const cacheManager = new CacheManager();

// 定期クリーンアップ（1分ごと）
setInterval(() => {
  cacheManager.cleanup();
}, 60 * 1000);

export default cacheManager;