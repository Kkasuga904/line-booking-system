/**
 * パフォーマンス最適化版 Webhook
 * 
 * 最適化内容:
 * - 接続プーリング
 * - キャッシング
 * - バッチ処理
 * - 非同期最適化
 * - メモリ管理
 */

import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

// =====================================
// グローバル接続プール（コールドスタート対策）
// =====================================
let supabaseClient = null;
let connectionPool = null;

function getSupabase() {
  if (!supabaseClient) {
    supabaseClient = createClient(
      process.env.SUPABASE_URL || 'https://faenvzzeguvlconvrqgp.supabase.co',
      process.env.SUPABASE_ANON_KEY || '',
      {
        auth: { persistSession: false },
        global: {
          headers: { 'x-connection-pool': 'true' }
        }
      }
    );
  }
  return supabaseClient;
}

// =====================================
// インメモリキャッシュ（LRU実装）
// =====================================
class LRUCache {
  constructor(maxSize = 100, ttl = 300000) { // 5分TTL
    this.maxSize = maxSize;
    this.ttl = ttl;
    this.cache = new Map();
  }

  set(key, value) {
    // 既存のキーを削除して末尾に追加（LRU）
    if (this.cache.has(key)) {
      this.cache.delete(key);
    } else if (this.cache.size >= this.maxSize) {
      // 最も古いエントリを削除
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    
    this.cache.set(key, {
      value,
      expires: Date.now() + this.ttl
    });
  }

  get(key) {
    const item = this.cache.get(key);
    if (!item) return null;
    
    // 有効期限チェック
    if (Date.now() > item.expires) {
      this.cache.delete(key);
      return null;
    }
    
    // アクセスされたキーを末尾に移動
    this.cache.delete(key);
    this.cache.set(key, item);
    
    return item.value;
  }

  clear() {
    this.cache.clear();
  }
}

// キャッシュインスタンス
const reservationCache = new LRUCache(100, 300000);
const userCache = new LRUCache(200, 600000);

// =====================================
// バッチ処理キュー
// =====================================
class BatchProcessor {
  constructor(batchSize = 10, flushInterval = 1000) {
    this.queue = [];
    this.batchSize = batchSize;
    this.flushInterval = flushInterval;
    this.timer = null;
  }

  async add(item) {
    this.queue.push(item);
    
    if (this.queue.length >= this.batchSize) {
      await this.flush();
    } else if (!this.timer) {
      this.timer = setTimeout(() => this.flush(), this.flushInterval);
    }
  }

  async flush() {
    if (this.queue.length === 0) return;
    
    const batch = this.queue.splice(0, this.batchSize);
    clearTimeout(this.timer);
    this.timer = null;
    
    try {
      // バッチ挿入
      const supabase = getSupabase();
      const { error } = await supabase
        .from('reservations')
        .insert(batch);
      
      if (error) throw error;
      
      // キャッシュ更新
      batch.forEach(item => {
        reservationCache.set(`reservation:${item.user_id}:latest`, item);
      });
      
    } catch (error) {
      console.error('Batch processing failed:', error);
      // 失敗したアイテムを再キューイング
      this.queue.unshift(...batch);
    }
  }
}

const batchProcessor = new BatchProcessor();

// =====================================
// 最適化された関数
// =====================================

/**
 * 署名検証（最適化版）
 * - タイミングセーフな比較
 * - 事前計算されたハッシュ
 */
const validateSignature = (() => {
  const secret = process.env.LINE_CHANNEL_SECRET;
  let hmac = null;
  
  return (body, signature) => {
    if (!secret || !signature) return false;
    
    // HMAC再利用
    if (!hmac) {
      hmac = crypto.createHmac('SHA256', secret);
    }
    
    const hash = hmac.update(body).digest('base64');
    hmac = crypto.createHmac('SHA256', secret); // リセット
    
    // タイミング攻撃対策
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(hash)
    );
  };
})();

/**
 * 高速サニタイズ（正規表現の事前コンパイル）
 */
const sanitizePatterns = {
  dangerous: /[<>\"'`;]/g,
  control: /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g,
  whitespace: /^\s+|\s+$/g
};

function fastSanitize(input) {
  if (typeof input !== 'string') return input;
  
  return input
    .replace(sanitizePatterns.dangerous, '')
    .replace(sanitizePatterns.control, '')
    .replace(sanitizePatterns.whitespace, '')
    .substring(0, 500);
}

/**
 * 並列処理最適化
 */
async function processEventsParallel(events) {
  // イベントを並列処理（最大10並列）
  const chunkSize = 10;
  const chunks = [];
  
  for (let i = 0; i < events.length; i += chunkSize) {
    chunks.push(events.slice(i, i + chunkSize));
  }
  
  for (const chunk of chunks) {
    await Promise.all(chunk.map(event => processEvent(event)));
  }
}

/**
 * イベント処理（最適化版）
 */
async function processEvent(event) {
  if (event.type !== 'message' || event.message?.type !== 'text') {
    return;
  }
  
  const userId = event.source?.userId;
  const text = fastSanitize(event.message.text);
  const replyToken = event.replyToken;
  
  // キャッシュチェック
  if (text === '予約確認') {
    const cached = reservationCache.get(`reservation:${userId}:latest`);
    if (cached) {
      await replyMessageOptimized(replyToken, [{
        type: 'text',
        text: `キャッシュから取得:\n予約ID: ${cached.id}\n日付: ${cached.date}\n時間: ${cached.time}`
      }]);
      return;
    }
  }
  
  // 予約処理
  if (text && text.includes('予約')) {
    const reservationData = parseReservation(text);
    
    // バッチ処理に追加
    await batchProcessor.add({
      store_id: process.env.STORE_ID || 'account-001',
      user_id: userId,
      message: text,
      ...reservationData,
      status: 'pending',
      created_at: new Date().toISOString()
    });
    
    await replyMessageOptimized(replyToken, [{
      type: 'text',
      text: '✅ 予約を受け付けました（処理中）'
    }]);
  }
}

/**
 * LINE返信（接続再利用）
 */
const replyMessageOptimized = (() => {
  let agent = null;
  
  return async (replyToken, messages) => {
    if (!agent) {
      const https = require('https');
      agent = new https.Agent({
        keepAlive: true,
        keepAliveMsecs: 30000,
        maxSockets: 10
      });
    }
    
    try {
      const response = await fetch('https://api.line.me/v2/bot/message/reply', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}`
        },
        body: JSON.stringify({ replyToken, messages }),
        agent
      });
      
      return response.ok;
    } catch (error) {
      console.error('Reply failed:', error);
      return false;
    }
  };
})();

/**
 * 予約パース（最適化版）
 */
function parseReservation(text) {
  const now = new Date();
  const result = {
    people: 2,
    date: now.toISOString().split('T')[0],
    time: '19:00:00'
  };
  
  // 数値抽出（最適化された正規表現）
  const peopleMatch = text.match(/(\d{1,2})[人名]/);
  if (peopleMatch) {
    result.people = Math.min(20, Math.max(1, parseInt(peopleMatch[1])));
  }
  
  // 時間抽出
  const timeMatch = text.match(/(\d{1,2})時/);
  if (timeMatch) {
    const hour = Math.min(21, Math.max(11, parseInt(timeMatch[1])));
    result.time = `${hour.toString().padStart(2, '0')}:00:00`;
  }
  
  // 日付抽出（高速化）
  if (text.indexOf('明日') !== -1) {
    now.setDate(now.getDate() + 1);
    result.date = now.toISOString().split('T')[0];
  } else if (text.indexOf('明後日') !== -1) {
    now.setDate(now.getDate() + 2);
    result.date = now.toISOString().split('T')[0];
  }
  
  return result;
}

// =====================================
// メモリ管理
// =====================================
let lastGC = Date.now();

function checkMemory() {
  const now = Date.now();
  
  // 5分ごとにガベージコレクション
  if (now - lastGC > 300000) {
    if (global.gc) {
      global.gc();
    }
    
    // キャッシュクリーンアップ
    reservationCache.clear();
    userCache.clear();
    
    lastGC = now;
  }
  
  // メモリ使用量監視
  const usage = process.memoryUsage();
  const heapUsed = usage.heapUsed / usage.heapTotal;
  
  if (heapUsed > 0.9) {
    console.warn('High memory usage:', heapUsed);
    // 緊急クリーンアップ
    reservationCache.clear();
    userCache.clear();
  }
}

// =====================================
// メインハンドラー（最適化版）
// =====================================
export default async function handler(req, res) {
  // メモリチェック
  checkMemory();
  
  // レスポンスヘッダー最適化
  res.setHeader('X-Response-Time', Date.now());
  res.setHeader('Cache-Control', 'no-cache');
  
  // OPTIONS（高速リターン）
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }
  
  // GET: ヘルスチェック（軽量版）
  if (req.method === 'GET') {
    const memUsage = process.memoryUsage();
    return res.status(200).json({
      status: 'optimized',
      memory: {
        heapUsed: Math.round(memUsage.heapUsed / 1048576) + 'MB',
        heapTotal: Math.round(memUsage.heapTotal / 1048576) + 'MB'
      },
      cache: {
        reservations: reservationCache.cache.size,
        users: userCache.cache.size
      },
      uptime: process.uptime()
    });
  }
  
  // POST: Webhook処理
  if (req.method === 'POST') {
    const startTime = Date.now();
    
    try {
      // 早期リターン
      if (!req.body?.events?.length) {
        return res.status(200).send('OK');
      }
      
      // 署名検証（本番環境のみ）
      if (process.env.NODE_ENV === 'production') {
        const signature = req.headers['x-line-signature'];
        if (!validateSignature(JSON.stringify(req.body), signature)) {
          return res.status(401).send('Unauthorized');
        }
      }
      
      // イベント並列処理
      await processEventsParallel(req.body.events);
      
      // バッチフラッシュ
      await batchProcessor.flush();
      
      // パフォーマンスメトリクス
      const duration = Date.now() - startTime;
      res.setHeader('X-Processing-Time', duration);
      
      if (duration > 1000) {
        console.warn(`Slow processing: ${duration}ms`);
      }
      
      return res.status(200).send('OK');
      
    } catch (error) {
      console.error('Handler error:', error);
      // エラーでも200を返す
      return res.status(200).send('OK');
    }
  }
  
  return res.status(405).json({ error: 'Method not allowed' });
}

// =====================================
// プロセス終了時のクリーンアップ
// =====================================
if (typeof process !== 'undefined') {
  process.on('SIGTERM', async () => {
    console.log('SIGTERM received, flushing batch...');
    await batchProcessor.flush();
    process.exit(0);
  });
}