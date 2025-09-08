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
 * 店舗IDを取得する統一関数（純ESM版）
 * 優先順位:
 * 1. 明示の query (req.query.store_id)
 * 2. パス params (req.params.store_id)
 * 3. サブドメインから解決 (foo.localhost → foo)
 * 4. 環境変数 (STORE_ID)
 * 5. デフォルト値 ('default-store')
 * 
 * @param {any} reqOrExplicitId - Expressのreqオブジェクト、または明示的な店舗ID
 * @returns {string} 店舗ID
 */
export function getStoreId(reqOrExplicitId = null) {
  // サーバーサイド環境（Node.js）
  if (typeof window === 'undefined') {
    // 文字列が直接渡された場合
    if (typeof reqOrExplicitId === 'string') {
      return reqOrExplicitId;
    }
    
    // reqオブジェクトの場合
    const req = reqOrExplicitId;
    
    // ① 明示の query
    if (req?.query?.store_id) return String(req.query.store_id);
    
    // ② パス /api/s/:store_id のような場合（必要なら）
    if (req?.params?.store_id) return String(req.params.store_id);
    
    // ③ サブドメインから解決 (foo.localhost → foo)
    const host = req?.headers?.host || '';
    const sub = host.split(':')[0].split('.')[0];
    if (sub && sub !== 'www' && sub !== 'localhost') return sub;
    
    // ④ 環境変数
    if (process.env.STORE_ID) return process.env.STORE_ID;
    
    // ⑤ デフォルト
    return 'default-store';
  }
  
  // クライアントサイド環境（ブラウザ）
  if (typeof reqOrExplicitId === 'string') {
    return reqOrExplicitId;
  }
  
  // URLパラメータから取得
  const urlParams = new URLSearchParams(window.location.search);
  const urlStoreId = urlParams.get('store_id');
  if (urlStoreId) {
    return urlStoreId;
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
export function getStoreConfig(storeId = null) {
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
export function getStorageKey(key, storeId = null) {
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
export function getCapacityRulesKey(storeId = null) {
  const id = getStoreId(storeId);
  return `capacity_control_rules_${id}`;
}

// 各関数は既にexport functionで定義されているため、追加のexport文は不要