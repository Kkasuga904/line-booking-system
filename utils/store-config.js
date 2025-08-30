/**
 * Store Configuration Utility
 * マルチテナント対応のための店舗設定管理
 * 
 * @レビュー観点
 * - store依存値がコードに埋まっていないか: このファイルで一元管理
 * - getStoreId()を必ず通しているか: 全箇所でこの関数を使用
 * - 既存挙動に影響を与えていないか: デフォルト値で互換性維持
 */

/**
 * 店舗IDを取得する統一関数
 * 優先順位:
 * 1. 関数引数で明示的に指定された値
 * 2. URLパラメータ (store_id)
 * 3. 環境変数 (STORE_ID)
 * 4. デフォルト値 ('default-store')
 * 
 * @param {string} explicitStoreId - 明示的に指定された店舗ID（オプション）
 * @returns {string} 店舗ID
 */
function getStoreId(explicitStoreId = null) {
  // サーバーサイド環境チェック
  if (typeof window === 'undefined') {
    // Node.js環境
    return explicitStoreId || process.env.STORE_ID || 'default-store';
  }
  
  // クライアントサイド環境
  if (explicitStoreId) {
    return explicitStoreId;
  }
  
  // URLパラメータから取得
  const urlParams = new URLSearchParams(window.location.search);
  const urlStoreId = urlParams.get('store_id');
  if (urlStoreId) {
    return urlStoreId;
  }
  
  // 環境変数から取得（ビルド時に埋め込まれる場合）
  if (typeof process !== 'undefined' && process.env && process.env.STORE_ID) {
    return process.env.STORE_ID;
  }
  
  // デフォルト値
  return 'default-store';
}

/**
 * 店舗設定を取得する
 * 将来的に店舗ごとの設定を返す
 * 
 * @param {string} storeId - 店舗ID（オプション）
 * @returns {Object} 店舗設定
 */
function getStoreConfig(storeId = null) {
  const id = getStoreId(storeId);
  
  // 現在はすべての店舗で同じ設定
  // 将来的にはDBまたは設定ファイルから取得
  return {
    storeId: id,
    storeName: id === 'default-store' ? 'デフォルト店舗' : id,
    timezone: 'Asia/Tokyo',
    locale: 'ja-JP',
    currency: 'JPY',
    // 予約制限のデフォルト値
    defaultCapacity: {
      maxGroups: null,
      maxPeople: null,
      maxPerGroup: null
    },
    // LocalStorageのキープレフィックス
    storagePrefix: `store_${id}_`,
    // APIエンドポイントのベースURL（将来的に店舗ごとに変更可能）
    apiBaseUrl: '',
  };
}

/**
 * LocalStorageのキーを店舗ごとに生成
 * 
 * @param {string} key - ベースキー
 * @param {string} storeId - 店舗ID（オプション）
 * @returns {string} 店舗固有のキー
 */
function getStorageKey(key, storeId = null) {
  const config = getStoreConfig(storeId);
  return `${config.storagePrefix}${key}`;
}

/**
 * 予約制限ルールのLocalStorageキーを取得
 * 既存コードとの互換性のため専用関数
 * 
 * @param {string} storeId - 店舗ID（オプション）
 * @returns {string} LocalStorageキー
 */
function getCapacityRulesKey(storeId = null) {
  const id = getStoreId(storeId);
  return `capacity_control_rules_${id}`;
}

// CommonJS/ES6両対応のエクスポート
if (typeof module !== 'undefined' && module.exports) {
  // Node.js環境
  module.exports = {
    getStoreId,
    getStoreConfig,
    getStorageKey,
    getCapacityRulesKey
  };
} else if (typeof window !== 'undefined') {
  // ブラウザ環境
  window.StoreConfig = {
    getStoreId,
    getStoreConfig,
    getStorageKey,
    getCapacityRulesKey
  };
}