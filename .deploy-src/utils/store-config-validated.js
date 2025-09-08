/**
 * 店舗設定管理（スキーマ検証付き）
 * zodによる型安全な設定管理
 * 
 * @レビュー観点
 * - 設定の型安全性が保証されているか
 * - 不正な設定で起動時にエラーになるか
 * - デフォルト値が適切に設定されているか
 */

const { z } = require('zod');
const fs = require('fs').promises;
const path = require('path');

/**
 * 設定スキーマ定義
 */
const ConfigSchema = z.object({
  liffId: z.string(),
  ui: z.object({
    theme: z.object({
      primaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
      secondaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/)
    }).default({ primaryColor: '#667eea', secondaryColor: '#764ba2' }),
    storeName: z.string().optional(),
    storeDescription: z.string().optional(),
    showCoupon: z.boolean().default(false),
    showLoyaltyPoints: z.boolean().default(false)
  }).default({}),
  booking: z.object({
    open: z.string().regex(/^\d{2}:\d{2}$/),
    close: z.string().regex(/^\d{2}:\d{2}$/),
    intervalMin: z.number().int().positive().min(5).max(120),
    maxPerGroup: z.number().int().positive().optional(),
    defaultPeople: z.number().int().positive().default(2),
    allowSameDay: z.boolean().default(true),
    requirePhone: z.boolean().default(true),
    requireEmail: z.boolean().default(false)
  }),
  capacity: z.object({
    defaultMaxGroups: z.number().int().positive().nullable().default(null),
    defaultMaxPeople: z.number().int().positive().nullable().default(null),
    defaultMaxPerGroup: z.number().int().positive().nullable().default(null)
  }).default({}),
  notifications: z.object({
    sendConfirmation: z.boolean().default(true),
    sendReminder: z.boolean().default(true),
    reminderHoursBefore: z.number().int().positive().default(24)
  }).default({}),
  flags: z.record(z.boolean()).default({})
});

/**
 * 設定キャッシュ
 */
const configCache = new Map();

/**
 * 設定ファイルを読み込む
 */
async function loadConfigFile(filePath) {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    if (error.code === 'ENOENT') {
      return null; // ファイルが存在しない
    }
    throw error;
  }
}

/**
 * 店舗設定を読み込んで検証
 * 
 * @param {string} storeId - 店舗ID
 * @returns {Promise<Object>} 検証済みの設定オブジェクト
 * @throws {Error} 設定が無効な場合
 */
async function loadValidatedConfig(storeId = 'default-store') {
  // キャッシュチェック
  if (configCache.has(storeId)) {
    return configCache.get(storeId);
  }
  
  try {
    // デフォルト設定を読み込み
    const defaultConfig = await loadConfigFile(
      path.join(__dirname, '..', 'config', 'default.json')
    );
    
    if (!defaultConfig) {
      throw new Error('Default configuration file not found');
    }
    
    // 店舗固有設定を読み込み（存在する場合）
    const storeConfig = await loadConfigFile(
      path.join(__dirname, '..', 'config', 'store', `${storeId}.json`)
    );
    
    // 設定をマージ（店舗固有設定が優先）
    const merged = deepMerge(defaultConfig, storeConfig || {});
    
    // スキーマで検証
    const validated = ConfigSchema.parse(merged);
    
    // メタデータを追加
    validated.storeId = storeId;
    validated.loadedAt = new Date().toISOString();
    
    // キャッシュに保存
    configCache.set(storeId, validated);
    
    console.log(`[CONFIG] Successfully loaded and validated config for store: ${storeId}`);
    
    return validated;
    
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error(`[CONFIG ERROR] Invalid configuration for store ${storeId}:`, error.errors);
      throw new Error(`Configuration validation failed for store ${storeId}: ${error.errors.map(e => e.message).join(', ')}`);
    }
    throw error;
  }
}

/**
 * 深いマージを行うヘルパー関数
 */
function deepMerge(target, source) {
  const result = { ...target };
  
  for (const key in source) {
    if (source[key] instanceof Object && !Array.isArray(source[key])) {
      if (target[key] instanceof Object && !Array.isArray(target[key])) {
        result[key] = deepMerge(target[key], source[key]);
      } else {
        result[key] = source[key];
      }
    } else {
      result[key] = source[key];
    }
  }
  
  return result;
}

/**
 * 設定の再読み込み（キャッシュクリア）
 */
function reloadConfig(storeId) {
  if (storeId) {
    configCache.delete(storeId);
  } else {
    configCache.clear();
  }
}

/**
 * 店舗設定を同期的に取得（既にロード済みの場合）
 */
function getConfigSync(storeId = 'default-store') {
  if (!configCache.has(storeId)) {
    throw new Error(`Configuration for store ${storeId} has not been loaded yet. Call loadValidatedConfig() first.`);
  }
  return configCache.get(storeId);
}

/**
 * 設定値を安全に取得するヘルパー
 */
function getConfigValue(storeId, path, defaultValue) {
  try {
    const config = getConfigSync(storeId);
    const keys = path.split('.');
    let value = config;
    
    for (const key of keys) {
      value = value[key];
      if (value === undefined) {
        return defaultValue;
      }
    }
    
    return value;
  } catch (error) {
    return defaultValue;
  }
}

/**
 * Express ミドルウェア：設定を req オブジェクトに追加
 */
async function configMiddleware(req, res, next) {
  try {
    const { getStoreId } = require('./store-config');
    const storeId = getStoreId(
      req.query?.store_id || 
      req.body?.store_id || 
      req.params?.store_id
    );
    
    req.storeConfig = await loadValidatedConfig(storeId);
    req.storeId = storeId;
    
    next();
  } catch (error) {
    console.error('[CONFIG MIDDLEWARE] Error loading config:', error);
    res.status(500).json({
      success: false,
      error: 'Configuration loading failed',
      message: error.message
    });
  }
}

module.exports = {
  loadValidatedConfig,
  getConfigSync,
  getConfigValue,
  reloadConfig,
  configMiddleware,
  ConfigSchema
};