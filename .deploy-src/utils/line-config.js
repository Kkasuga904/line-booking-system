/**
 * LINE設定管理（店舗別対応）
 * 店舗ごとのLINE Channel Secret/Access Tokenを管理
 * 
 * @レビュー観点
 * - 店舗別のLINE認証情報が正しく取得されるか
 * - 環境変数名の命名規則が統一されているか
 * - デフォルト値へのフォールバックが適切か
 */

const { getStoreId } = require('./store-config');
const { log } = require('./logger');

/**
 * 店舗別のLINE Channel Secretを取得
 * 
 * @param {string} storeId - 店舗ID（オプション）
 * @returns {string} Channel Secret
 */
function getLineChannelSecret(storeId = null) {
  const id = getStoreId(storeId);
  
  // 店舗別の環境変数名を生成（例: LINE_CHANNEL_SECRET_STORE_A）
  const storeSpecificKey = `LINE_CHANNEL_SECRET_${id.toUpperCase().replace('-', '_')}`;
  
  // 優先順位:
  // 1. 店舗別の環境変数
  // 2. デフォルトの環境変数
  // 3. ハードコードされた値（開発環境用）
  const secret = process.env[storeSpecificKey] || 
                 process.env.LINE_CHANNEL_SECRET ||
                 process.env.LINE_CHANNEL_SECRET_DEFAULT;
  
  if (!secret) {
    log(null, 'warn', `LINE Channel Secret not found for store: ${id}`, {
      store_id: id,
      tried_keys: [storeSpecificKey, 'LINE_CHANNEL_SECRET']
    });
  }
  
  return secret;
}

/**
 * 店舗別のLINE Access Tokenを取得
 * 
 * @param {string} storeId - 店舗ID（オプション）
 * @returns {string} Access Token
 */
function getLineAccessToken(storeId = null) {
  const id = getStoreId(storeId);
  
  // 店舗別の環境変数名を生成（例: LINE_CHANNEL_ACCESS_TOKEN_STORE_A）
  const storeSpecificKey = `LINE_CHANNEL_ACCESS_TOKEN_${id.toUpperCase().replace('-', '_')}`;
  
  const token = process.env[storeSpecificKey] || 
                process.env.LINE_CHANNEL_ACCESS_TOKEN ||
                process.env.LINE_ACCESS_TOKEN_DEFAULT;
  
  if (!token) {
    log(null, 'warn', `LINE Access Token not found for store: ${id}`, {
      store_id: id,
      tried_keys: [storeSpecificKey, 'LINE_CHANNEL_ACCESS_TOKEN']
    });
  }
  
  return token;
}

/**
 * 店舗別のLIFF IDを取得
 * 
 * @param {string} storeId - 店舗ID（オプション）
 * @returns {string} LIFF ID
 */
function getLiffId(storeId = null) {
  const id = getStoreId(storeId);
  
  // 店舗別の環境変数名を生成（例: LIFF_ID_STORE_A）
  const storeSpecificKey = `LIFF_ID_${id.toUpperCase().replace('-', '_')}`;
  
  const liffId = process.env[storeSpecificKey] || 
                 process.env.LIFF_ID ||
                 '2006487876-xd1A5qJB'; // デフォルト値
  
  return liffId;
}

/**
 * LINE Bot SDKのClientを作成（店舗別）
 * 
 * @param {string} storeId - 店舗ID（オプション）
 * @returns {Object} LINE Bot Client
 */
function createLineBotClient(storeId = null) {
  const { Client } = require('@line/bot-sdk');
  
  const id = getStoreId(storeId);
  const channelSecret = getLineChannelSecret(id);
  const channelAccessToken = getLineAccessToken(id);
  
  if (!channelSecret || !channelAccessToken) {
    throw new Error(`LINE configuration missing for store: ${id}`);
  }
  
  const client = new Client({
    channelSecret,
    channelAccessToken
  });
  
  log(null, 'info', 'LINE Bot Client created', {
    store_id: id,
    has_secret: !!channelSecret,
    has_token: !!channelAccessToken
  });
  
  return client;
}

/**
 * Webhook署名を検証（店舗別）
 * 
 * @param {string} body - リクエストボディ
 * @param {string} signature - X-Line-Signature
 * @param {string} storeId - 店舗ID（オプション）
 * @returns {boolean} 検証結果
 */
function validateWebhookSignature(body, signature, storeId = null) {
  const crypto = require('crypto');
  const channelSecret = getLineChannelSecret(storeId);
  
  if (!channelSecret) {
    log(null, 'error', 'Cannot validate webhook: missing channel secret', {
      store_id: getStoreId(storeId)
    });
    return false;
  }
  
  const hash = crypto
    .createHmac('SHA256', channelSecret)
    .update(body)
    .digest('base64');
  
  return hash === signature;
}

/**
 * LINE設定のヘルスチェック
 * 
 * @param {string} storeId - 店舗ID（オプション）
 * @returns {Object} ヘルスチェック結果
 */
function checkLineConfig(storeId = null) {
  const id = getStoreId(storeId);
  
  const result = {
    store_id: id,
    channel_secret: !!getLineChannelSecret(id),
    access_token: !!getLineAccessToken(id),
    liff_id: !!getLiffId(id),
    status: 'unknown'
  };
  
  // すべての設定が揃っているか確認
  if (result.channel_secret && result.access_token && result.liff_id) {
    result.status = 'ok';
  } else if (result.channel_secret || result.access_token || result.liff_id) {
    result.status = 'partial';
  } else {
    result.status = 'missing';
  }
  
  return result;
}

/**
 * Express ミドルウェア：LINE設定を req オブジェクトに追加
 */
function lineConfigMiddleware(req, res, next) {
  try {
    const storeId = req.storeId || getStoreId();
    
    req.lineConfig = {
      channelSecret: getLineChannelSecret(storeId),
      accessToken: getLineAccessToken(storeId),
      liffId: getLiffId(storeId),
      storeId: storeId
    };
    
    // 設定の妥当性チェック
    const check = checkLineConfig(storeId);
    if (check.status === 'missing') {
      log(req, 'warn', 'LINE config missing for request', check);
    }
    
    next();
  } catch (error) {
    log(req, 'error', 'Failed to load LINE config', {
      error: error.message
    });
    next(); // エラーでも続行（個別のAPIで対処）
  }
}

module.exports = {
  getLineChannelSecret,
  getLineAccessToken,
  getLiffId,
  createLineBotClient,
  validateWebhookSignature,
  checkLineConfig,
  lineConfigMiddleware
};