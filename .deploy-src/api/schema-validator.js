/**
 * スキーマバリデーター
 * Supabaseテーブルとコードの整合性を保つ
 */

// 予約テーブルの基本フィールド定義
export const RESERVATION_SCHEMA = {
  required: [
    'store_id',
    'customer_name',
    'date',
    'time',
    'people'
  ],
  optional: [
    'store_name',
    'user_id',
    'message',
    'phone',
    'email',
    'status',
    'seat_id',
    'created_at',
    'updated_at'
  ],
  deprecated: [
    'duration',
    'is_date_range',
    'start_date',
    'end_date',
    'start_time',
    'end_time'
  ]
};

/**
 * データから非推奨フィールドを削除
 * @param {Object} data - チェックするデータ
 * @returns {Object} クリーンなデータ
 */
export function removeDeprecatedFields(data) {
  const cleaned = { ...data };
  
  for (const field of RESERVATION_SCHEMA.deprecated) {
    if (cleaned.hasOwnProperty(field)) {
      console.warn(`Removing deprecated field: ${field}`);
      delete cleaned[field];
    }
  }
  
  return cleaned;
}

/**
 * 必須フィールドの検証
 * @param {Object} data - チェックするデータ
 * @returns {Object} 検証結果
 */
export function validateRequiredFields(data) {
  const missing = [];
  
  for (const field of RESERVATION_SCHEMA.required) {
    if (!data.hasOwnProperty(field) || data[field] === null || data[field] === undefined) {
      missing.push(field);
    }
  }
  
  return {
    valid: missing.length === 0,
    missing
  };
}

/**
 * データを安全な形式に変換
 * @param {Object} data - 変換するデータ
 * @returns {Object} 安全なデータ
 */
export function sanitizeReservationData(data) {
  // 非推奨フィールドを削除
  let sanitized = removeDeprecatedFields(data);
  
  // 必須フィールドのデフォルト値を設定
  const defaults = {
    store_id: process.env.STORE_ID || 'default-store',
    people: 1,
    status: 'confirmed',
    user_id: 'admin-manual'
  };
  
  for (const [field, defaultValue] of Object.entries(defaults)) {
    if (!sanitized[field]) {
      sanitized[field] = defaultValue;
    }
  }
  
  // 時刻フォーマットの正規化（HH:MM → HH:MM:SS）
  if (sanitized.time && !sanitized.time.includes(':00', 5)) {
    sanitized.time = sanitized.time + ':00';
  }
  
  // 人数を数値に変換
  if (sanitized.people) {
    sanitized.people = parseInt(sanitized.people) || 1;
  }
  
  return sanitized;
}

/**
 * バッチ検証（複数データの一括チェック）
 * @param {Array} dataArray - チェックするデータの配列
 * @returns {Object} 検証結果サマリー
 */
export function batchValidate(dataArray) {
  const results = {
    total: dataArray.length,
    valid: 0,
    invalid: 0,
    warnings: [],
    errors: []
  };
  
  dataArray.forEach((data, index) => {
    const validation = validateRequiredFields(data);
    
    if (validation.valid) {
      results.valid++;
    } else {
      results.invalid++;
      results.errors.push({
        index,
        missing: validation.missing
      });
    }
    
    // 非推奨フィールドの警告
    for (const field of RESERVATION_SCHEMA.deprecated) {
      if (data.hasOwnProperty(field)) {
        results.warnings.push({
          index,
          field,
          message: `Deprecated field found: ${field}`
        });
      }
    }
  });
  
  return results;
}

/**
 * スキーマのドキュメント生成
 * @returns {string} Markdownフォーマットのドキュメント
 */
export function generateSchemaDoc() {
  let doc = '# Reservation Table Schema\n\n';
  
  doc += '## Required Fields\n';
  RESERVATION_SCHEMA.required.forEach(field => {
    doc += `- \`${field}\`\n`;
  });
  
  doc += '\n## Optional Fields\n';
  RESERVATION_SCHEMA.optional.forEach(field => {
    doc += `- \`${field}\`\n`;
  });
  
  doc += '\n## Deprecated Fields (Do not use)\n';
  RESERVATION_SCHEMA.deprecated.forEach(field => {
    doc += `- ~~\`${field}\`~~\n`;
  });
  
  return doc;
}

export default {
  RESERVATION_SCHEMA,
  removeDeprecatedFields,
  validateRequiredFields,
  sanitizeReservationData,
  batchValidate,
  generateSchemaDoc
};