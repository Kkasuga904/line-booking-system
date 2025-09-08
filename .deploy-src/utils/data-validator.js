/**
 * データ検証・整合性チェックユーティリティ
 * カレンダー表示問題の再発防止
 */

/**
 * 予約データの形式を検証・正規化
 * @param {Object} reservation - 生の予約データ
 * @returns {Object} 正規化された予約データ
 */
export function normalizeReservation(reservation) {
  // 必須フィールドの存在チェック
  if (!reservation || !reservation.date || !reservation.time) {
    console.error('Invalid reservation data:', reservation);
    return null;
  }

  // 時刻フォーマットの正規化
  let normalizedTime = reservation.time;
  
  // HH:MM形式をHH:MM:SS形式に変換
  if (normalizedTime && normalizedTime.match(/^\d{2}:\d{2}$/)) {
    normalizedTime = `${normalizedTime}:00`;
  }
  
  // 不正な形式（HH:MM:SS:SS）を修正
  if (normalizedTime && normalizedTime.match(/^\d{2}:\d{2}:\d{2}:\d{2}$/)) {
    normalizedTime = normalizedTime.substring(0, 8);
  }

  return {
    id: reservation.id,
    // フィールド名の統一（DB名 → フロントエンド名）
    customerName: reservation.customer_name || reservation.customerName,
    date: reservation.date,
    time: normalizedTime,
    numberOfPeople: reservation.people || reservation.numberOfPeople || 1,
    status: reservation.status || 'pending',
    message: reservation.message || '',
    phone: reservation.phone || null,
    email: reservation.email || null,
    seatId: reservation.seat_id || reservation.seatId || null,
    createdAt: reservation.created_at || reservation.createdAt,
    updatedAt: reservation.updated_at || reservation.updatedAt
  };
}

/**
 * FullCalendarイベントの形式を検証
 * @param {Object} event - カレンダーイベント
 * @returns {Object|null} 検証済みイベントまたはnull
 */
export function validateCalendarEvent(event) {
  if (!event || !event.start) {
    console.error('Invalid calendar event:', event);
    return null;
  }

  // ISO8601形式の検証
  const iso8601Regex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/;
  
  if (!event.start.match(iso8601Regex)) {
    console.warn('Invalid start time format:', event.start);
    
    // 修正を試みる
    if (event.start.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/)) {
      event.start = `${event.start}:00`;
    } else if (event.start.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}:\d{2}$/)) {
      event.start = event.start.substring(0, 19);
    }
  }

  return event;
}

/**
 * APIレスポンスの整合性チェック
 * @param {Object} response - APIレスポンス
 * @returns {Object} 正規化されたレスポンス
 */
export function normalizeApiResponse(response) {
  // 成功フラグの確認
  const isSuccess = response.success || response.ok || false;
  
  // データフィールドの正規化
  let data = response.data || response.rows || response.reservations || [];
  
  // 配列でない場合は配列に変換
  if (!Array.isArray(data)) {
    data = [];
  }
  
  // 各予約データを正規化
  const normalizedData = data.map(normalizeReservation).filter(r => r !== null);
  
  return {
    success: isSuccess,
    ok: isSuccess,
    data: normalizedData,
    rows: normalizedData,  // 互換性のため
    count: normalizedData.length
  };
}

/**
 * デバッグ用：データ整合性レポート生成
 * @param {Array} reservations - 予約データ配列
 * @returns {Object} 整合性レポート
 */
export function generateDataIntegrityReport(reservations) {
  const report = {
    totalRecords: reservations.length,
    validRecords: 0,
    invalidRecords: 0,
    issues: [],
    fieldStats: {}
  };

  reservations.forEach((reservation, index) => {
    const issues = [];
    
    // 必須フィールドチェック
    if (!reservation.date) issues.push('Missing date');
    if (!reservation.time) issues.push('Missing time');
    if (!reservation.customerName && !reservation.customer_name) issues.push('Missing customer name');
    
    // 時刻フォーマットチェック
    if (reservation.time && !reservation.time.match(/^\d{2}:\d{2}(:\d{2})?$/)) {
      issues.push(`Invalid time format: ${reservation.time}`);
    }
    
    // 日付フォーマットチェック
    if (reservation.date && !reservation.date.match(/^\d{4}-\d{2}-\d{2}$/)) {
      issues.push(`Invalid date format: ${reservation.date}`);
    }
    
    if (issues.length > 0) {
      report.invalidRecords++;
      report.issues.push({ index, reservation, issues });
    } else {
      report.validRecords++;
    }
  });

  return report;
}

/**
 * 環境別設定の検証
 * @returns {Object} 環境設定の状態
 */
export function validateEnvironmentConfig() {
  const config = {
    isDevelopment: process.env.NODE_ENV !== 'production',
    securityEnabled: false,
    rateLimitEnabled: false,
    debugMode: false
  };

  // 開発環境での推奨設定
  if (config.isDevelopment) {
    config.debugMode = true;
    config.securityEnabled = false;
    config.rateLimitEnabled = false;
  }

  return config;
}

// デフォルトエクスポート
export default {
  normalizeReservation,
  validateCalendarEvent,
  normalizeApiResponse,
  generateDataIntegrityReport,
  validateEnvironmentConfig
};