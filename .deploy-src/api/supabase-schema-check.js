/**
 * Supabaseテーブルスキーマチェック
 * テーブル構造を検証して、存在しないカラムへのアクセスを防ぐ
 */

import { createClient } from '@supabase/supabase-js';

// Supabase初期化
const SUPABASE_URL = 'https://faenvzzeguvlconvrqgp.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZhZW52enplZ3V2bGNvbnZycWdwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTYxNzQyOTgsImV4cCI6MjA3MTc1MDI5OH0.U_v82IYSDM3waCFfFr4e7MpbTQmZFRPCNaA-2u5R3d8';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// キャッシュ用（起動時に一度だけチェック）
let schemaCache = null;
let lastCheckTime = null;
const CACHE_DURATION = 60 * 60 * 1000; // 1時間

/**
 * テーブルの実際のカラムを取得
 * @param {string} tableName - テーブル名
 * @returns {Promise<string[]>} カラム名の配列
 */
export async function getTableColumns(tableName) {
  try {
    // キャッシュチェック
    const now = Date.now();
    if (schemaCache && lastCheckTime && (now - lastCheckTime) < CACHE_DURATION) {
      return schemaCache[tableName] || [];
    }
    
    // Supabaseから1件だけデータを取得してカラムを確認
    const { data, error } = await supabase
      .from(tableName)
      .select('*')
      .limit(1);
    
    if (error) {
      console.error(`Failed to get schema for ${tableName}:`, error);
      return [];
    }
    
    // カラム名を抽出
    const columns = data && data.length > 0 ? Object.keys(data[0]) : [];
    
    // キャッシュ更新
    if (!schemaCache) schemaCache = {};
    schemaCache[tableName] = columns;
    lastCheckTime = now;
    
    console.log(`Table ${tableName} columns:`, columns);
    return columns;
  } catch (error) {
    console.error(`Schema check error for ${tableName}:`, error);
    return [];
  }
}

/**
 * 予約データから存在しないカラムを除外
 * @param {Object} data - 予約データ
 * @returns {Promise<Object>} フィルタリング済みデータ
 */
export async function filterReservationData(data) {
  const columns = await getTableColumns('reservations');
  
  if (columns.length === 0) {
    // スキーマ取得失敗時は基本フィールドのみ
    console.warn('Could not get schema, using basic fields only');
    return filterToBasicFields(data);
  }
  
  // 存在するカラムのみを含むオブジェクトを作成
  const filtered = {};
  for (const [key, value] of Object.entries(data)) {
    if (columns.includes(key)) {
      filtered[key] = value;
    } else {
      console.warn(`Removing non-existent column: ${key}`);
    }
  }
  
  return filtered;
}

/**
 * 基本フィールドのみにフィルタリング（フォールバック用）
 * @param {Object} data - 予約データ
 * @returns {Object} 基本フィールドのみのデータ
 */
export function filterToBasicFields(data) {
  const basicFields = [
    'store_id',
    'store_name',
    'user_id',
    'customer_name',
    'date',
    'time',
    'people',
    'message',
    'phone',
    'email',
    'status',
    'created_at',
    'updated_at',
    'seat_id'
  ];
  
  const filtered = {};
  for (const field of basicFields) {
    if (data.hasOwnProperty(field)) {
      filtered[field] = data[field];
    }
  }
  
  return filtered;
}

/**
 * スキーマの不一致を検出
 * @param {Object} data - チェックするデータ
 * @param {string} tableName - テーブル名
 * @returns {Promise<Object>} 検証結果
 */
export async function validateSchema(data, tableName = 'reservations') {
  const columns = await getTableColumns(tableName);
  const dataKeys = Object.keys(data);
  
  const missingInTable = dataKeys.filter(key => !columns.includes(key));
  const missingInData = columns.filter(col => 
    !dataKeys.includes(col) && 
    !['id', 'created_at', 'updated_at'].includes(col) // 自動生成フィールドは除外
  );
  
  return {
    valid: missingInTable.length === 0,
    missingInTable,
    missingInData,
    tableColumns: columns,
    dataKeys
  };
}

/**
 * 初期化時のスキーマチェック
 */
export async function initSchemaCheck() {
  console.log('Initializing schema check...');
  
  const tables = ['reservations', 'seats', 'settings'];
  const results = {};
  
  for (const table of tables) {
    const columns = await getTableColumns(table);
    results[table] = {
      exists: columns.length > 0,
      columns
    };
  }
  
  console.log('Schema check results:', results);
  return results;
}

/**
 * エラーハンドリング付きインサート
 * @param {Object} data - インサートするデータ
 * @returns {Promise<Object>} インサート結果
 */
export async function safeInsert(data) {
  // スキーマ検証
  const validation = await validateSchema(data);
  
  if (!validation.valid) {
    console.warn('Schema validation failed:', validation);
    // 存在しないカラムを除外
    data = await filterReservationData(data);
  }
  
  try {
    const { data: result, error } = await supabase
      .from('reservations')
      .insert([data])
      .select();
    
    if (error) {
      // カラムエラーの場合は基本フィールドでリトライ
      if (error.message.includes('column')) {
        console.warn('Column error detected, retrying with basic fields');
        const basicData = filterToBasicFields(data);
        
        const { data: retryResult, error: retryError } = await supabase
          .from('reservations')
          .insert([basicData])
          .select();
        
        if (retryError) {
          throw retryError;
        }
        
        return { success: true, data: retryResult[0], filtered: true };
      }
      
      throw error;
    }
    
    return { success: true, data: result[0], filtered: false };
  } catch (error) {
    console.error('Safe insert failed:', error);
    return { 
      success: false, 
      error: error.message,
      code: error.code,
      hint: error.hint
    };
  }
}

export default {
  getTableColumns,
  filterReservationData,
  filterToBasicFields,
  validateSchema,
  initSchemaCheck,
  safeInsert
};