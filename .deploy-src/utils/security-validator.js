/**
 * セキュリティバリデーションユーティリティ
 * XSS攻撃やその他のセキュリティ脅威を防ぐための検証機能
 */

/**
 * URLのセキュリティ検証
 * javascript:, data:, vbscript: などの危険なスキームをブロック
 * @param {string} url - 検証するURL
 * @returns {boolean} 安全な場合true
 */
export function isValidUrl(url) {
  if (!url || typeof url !== 'string') return false;
  
  // 危険なURIスキームのパターン
  const dangerousSchemes = [
    'javascript:',
    'data:',
    'vbscript:',
    'file:',
    'about:',
    'blob:',
    'chrome:',
    'chrome-extension:'
  ];
  
  const lowerUrl = url.toLowerCase().trim();
  
  // 危険なスキームをチェック
  for (const scheme of dangerousSchemes) {
    if (lowerUrl.startsWith(scheme)) {
      console.warn(`Blocked dangerous URL scheme: ${scheme} in URL: ${url}`);
      return false;
    }
  }
  
  // HTTPSまたはHTTP、相対URLのみ許可
  if (lowerUrl.startsWith('https://') || 
      lowerUrl.startsWith('http://') ||
      lowerUrl.startsWith('/') ||
      !lowerUrl.includes(':')) {
    return true;
  }
  
  // LINE特有のスキームは許可
  if (lowerUrl.startsWith('line://') || lowerUrl.startsWith('https://liff.line.me/')) {
    return true;
  }
  
  return false;
}

/**
 * HTMLエンティティのエスケープ
 * @param {string} text - エスケープするテキスト
 * @returns {string} エスケープ済みテキスト
 */
export function escapeHtml(text) {
  if (!text) return '';
  
  const escapeMap = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#x27;',
    '/': '&#x2F;'
  };
  
  return String(text).replace(/[&<>"'\/]/g, char => escapeMap[char]);
}

/**
 * ユーザー入力のサニタイズ
 * @param {string} input - ユーザー入力
 * @returns {string} サニタイズ済み入力
 */
export function sanitizeUserInput(input) {
  if (!input) return '';
  
  // 制御文字を削除
  let sanitized = String(input).replace(/[\x00-\x1F\x7F]/g, '');
  
  // HTMLタグのような文字列を無害化
  sanitized = sanitized.replace(/<script[^>]*>.*?<\/script>/gi, '');
  sanitized = sanitized.replace(/<iframe[^>]*>.*?<\/iframe>/gi, '');
  sanitized = sanitized.replace(/on\w+\s*=\s*["'][^"']*["']/gi, '');
  
  // 連続したスペースを単一スペースに
  sanitized = sanitized.replace(/\s+/g, ' ').trim();
  
  return sanitized;
}

/**
 * LINEメッセージ用のテキストサニタイズ
 * @param {string} text - メッセージテキスト
 * @returns {string} サニタイズ済みテキスト
 */
export function sanitizeLineMessage(text) {
  if (!text) return '';
  
  // LINEメッセージで問題となる文字を処理
  let sanitized = String(text)
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '') // 制御文字削除
    .substring(0, 2000); // LINE API制限（2000文字）
  
  return sanitized;
}

/**
 * 環境変数の検証とサニタイズ
 * @param {string} value - 環境変数の値
 * @returns {string} サニタイズ済み値
 */
export function sanitizeEnvValue(value) {
  if (!value) return '';
  
  return String(value)
    .trim()
    .replace(/\r?\n/g, '') // 改行削除
    .replace(/\s+/g, ' '); // 連続スペースを単一に
}

/**
 * ファイルパスの検証
 * パストラバーサル攻撃を防ぐ
 * @param {string} path - ファイルパス
 * @returns {boolean} 安全な場合true
 */
export function isValidPath(path) {
  if (!path) return false;
  
  // 危険なパターン
  const dangerousPatterns = [
    /\.\./,     // 親ディレクトリ参照
    /^~/,       // ホームディレクトリ
    /^\/etc/,   // システムファイル
    /^\/usr/,   // システムファイル
    /^\/var/,   // システムファイル
    /\x00/      // Nullバイト
  ];
  
  for (const pattern of dangerousPatterns) {
    if (pattern.test(path)) {
      console.warn(`Blocked dangerous path pattern: ${path}`);
      return false;
    }
  }
  
  return true;
}

/**
 * JSONペイロードの検証
 * @param {object} payload - 検証するオブジェクト
 * @param {number} maxDepth - 最大ネスト深度
 * @returns {boolean} 安全な場合true
 */
export function isValidJsonPayload(payload, maxDepth = 10) {
  function checkDepth(obj, currentDepth = 0) {
    if (currentDepth > maxDepth) {
      console.warn('JSON payload exceeds maximum depth');
      return false;
    }
    
    if (obj && typeof obj === 'object') {
      for (const key in obj) {
        if (obj.hasOwnProperty(key)) {
          if (!checkDepth(obj[key], currentDepth + 1)) {
            return false;
          }
        }
      }
    }
    
    return true;
  }
  
  return checkDepth(payload);
}

// デフォルトエクスポート
export default {
  isValidUrl,
  escapeHtml,
  sanitizeUserInput,
  sanitizeLineMessage,
  sanitizeEnvValue,
  isValidPath,
  isValidJsonPayload
};