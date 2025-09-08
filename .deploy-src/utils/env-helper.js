/**
 * 環境変数ヘルパー
 * 環境変数の取得時に自動的にtrimして改行・空白を除去
 * これにより、Vercelの環境変数設定時の改行混入を防ぐ
 */

/**
 * 環境変数を安全に取得（自動trim付き）
 * @param {string} key - 環境変数のキー
 * @param {string} defaultValue - デフォルト値
 * @returns {string} trimされた環境変数値
 */
export function getEnv(key, defaultValue = '') {
  const value = process.env[key] || defaultValue;
  // 文字列の場合のみtrim（改行・前後の空白を除去）
  return typeof value === 'string' ? value.trim() : value;
}

/**
 * 複数の環境変数を一括取得
 * @param {Object} config - { key: defaultValue } の形式
 * @returns {Object} trimされた環境変数のオブジェクト
 */
export function getEnvs(config) {
  const result = {};
  for (const [key, defaultValue] of Object.entries(config)) {
    result[key] = getEnv(key, defaultValue);
  }
  return result;
}

/**
 * 必須環境変数のチェック
 * @param {string[]} requiredKeys - 必須の環境変数キーの配列
 * @throws {Error} 必須環境変数が未設定の場合
 */
export function validateEnvs(requiredKeys) {
  const missing = [];
  for (const key of requiredKeys) {
    if (!process.env[key] || !process.env[key].trim()) {
      missing.push(key);
    }
  }
  
  if (missing.length > 0) {
    throw new Error(`必須環境変数が未設定: ${missing.join(', ')}`);
  }
}

/**
 * URLを安全に生成（改行を確実に除去）
 * @param {string} url - URL文字列
 * @returns {string} 改行を除去したURL
 */
export function sanitizeUrl(url) {
  return url
    .replace(/\r?\n/g, '') // 改行を除去
    .replace(/\s+/g, ' ')  // 連続する空白を1つに
    .trim();               // 前後の空白を除去
}