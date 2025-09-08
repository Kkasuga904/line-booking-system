/**
 * 構造化ログユーティリティ
 * 監視・分析のために store_id を必須とする統一ログ出力
 * 
 * @レビュー観点
 * - すべてのAPIログに store_id が含まれているか
 * - 構造化されたJSON形式で出力されているか
 * - パフォーマンス計測（ms）が含まれているか
 */

const { getStoreId } = require('./store-config');

/**
 * 構造化ログを出力
 * 
 * @param {Object} req - Expressのリクエストオブジェクト（オプション）
 * @param {string} level - ログレベル (info, warn, error, debug)
 * @param {string} msg - ログメッセージ
 * @param {Object} extra - 追加のログデータ
 */
function log(req, level, msg, extra = {}) {
  // store_id の取得（必須）
  let store_id = 'unknown';
  
  if (req) {
    // リクエストオブジェクトから取得
    store_id = req.storeId || 
               req.query?.store_id || 
               req.body?.store_id || 
               req.params?.store_id ||
               getStoreId();
  } else {
    // リクエストオブジェクトがない場合
    store_id = getStoreId();
  }
  
  // 構造化ログオブジェクト
  const logObj = {
    ts: new Date().toISOString(),
    level,
    store_id,
    msg,
    ...extra
  };
  
  // リクエスト情報の追加
  if (req) {
    logObj.path = req.path || req.url;
    logObj.method = req.method;
    logObj.ip = req.ip || req.connection?.remoteAddress;
    
    // レスポンスタイムの計測
    if (req._startTime) {
      logObj.ms = Date.now() - req._startTime;
    }
  }
  
  // 環境に応じた出力
  if (process.env.NODE_ENV === 'production') {
    // 本番環境：構造化JSON
    console[level]?.(JSON.stringify(logObj)) || console.log(JSON.stringify(logObj));
  } else {
    // 開発環境：読みやすい形式
    const prefix = `[${logObj.ts}] [${level.toUpperCase()}] [${store_id}]`;
    console[level]?.(prefix, msg, extra) || console.log(prefix, msg, extra);
  }
  
  return logObj;
}

/**
 * リクエスト開始時のロギングミドルウェア
 */
function requestLogger(req, res, next) {
  // タイムスタンプを記録
  req._startTime = Date.now();
  
  // store_id を req オブジェクトにセット
  req.storeId = getStoreId(
    req.query?.store_id || 
    req.body?.store_id || 
    req.params?.store_id
  );
  
  // リクエスト受信ログ
  log(req, 'info', 'Request received', {
    userAgent: req.headers['user-agent'],
    referer: req.headers['referer']
  });
  
  // レスポンス送信時のログ
  const originalSend = res.send;
  res.send = function(data) {
    res.send = originalSend;
    
    // ステータスコードに応じたログレベル
    const level = res.statusCode >= 500 ? 'error' :
                  res.statusCode >= 400 ? 'warn' : 'info';
    
    log(req, level, 'Response sent', {
      status: res.statusCode,
      size: data ? data.length : 0
    });
    
    return res.send(data);
  };
  
  next();
}

/**
 * エラーロギング用のヘルパー
 */
function logError(req, error, extra = {}) {
  return log(req, 'error', error.message || 'Unknown error', {
    error: {
      name: error.name,
      message: error.message,
      stack: error.stack
    },
    ...extra
  });
}

/**
 * パフォーマンスログ用のヘルパー
 */
function logPerformance(req, operation, duration, extra = {}) {
  return log(req, 'info', `Performance: ${operation}`, {
    operation,
    duration_ms: duration,
    ...extra
  });
}

/**
 * 予約操作ログ用のヘルパー
 */
function logReservation(req, action, reservationData, extra = {}) {
  return log(req, 'info', `Reservation ${action}`, {
    action,
    reservation_id: reservationData.id || reservationData.reservation_id,
    customer: reservationData.customer_name,
    date: reservationData.date,
    time: reservationData.time,
    people: reservationData.people || reservationData.numberOfPeople,
    ...extra
  });
}

/**
 * 容量制限ログ用のヘルパー
 */
function logCapacity(req, action, capacityData, extra = {}) {
  return log(req, 'info', `Capacity ${action}`, {
    action,
    date: capacityData.date,
    time: capacityData.time,
    current: capacityData.current,
    max: capacityData.max,
    blocked: capacityData.blocked,
    ...extra
  });
}

module.exports = {
  log,
  requestLogger,
  logError,
  logPerformance,
  logReservation,
  logCapacity
};