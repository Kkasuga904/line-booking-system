/**
 * 🛡️ LINE予約システム 問題防止・自動修正スクリプト
 * 
 * このスクリプトは過去に発生した問題を自動的に検出・修正します。
 * 主な機能:
 * - Store ID不整合の修正
 * - データベースカラムの確認
 * - 席データの初期化
 * - APIファイルのハードコーディング検出
 * - 環境変数の検証
 * - 古いデータのクリーンアップ
 * 
 * 使用方法: npm run prevent-issues
 * 推奨実行頻度: 週次、またはデプロイ前
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { promises as fs } from 'fs';
import path from 'path';

// 環境変数読み込み（.env.localファイルから）
dotenv.config({ path: '.env.local' });

// Supabaseクライアント初期化
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

// ターミナル出力用のカラーコード定義
const colors = {
  reset: '\x1b[0m',    // リセット
  red: '\x1b[31m',     // エラー用（赤）
  green: '\x1b[32m',   // 成功用（緑）
  yellow: '\x1b[33m',  // 警告用（黄）
  blue: '\x1b[36m'     // 情報用（青）
};

/**
 * カラー付きログ出力関数
 * @param {string} message - 出力するメッセージ
 * @param {string} type - メッセージタイプ (error/success/warning/info)
 */
function log(message, type = 'info') {
  const colorMap = {
    error: colors.red,
    success: colors.green,
    warning: colors.yellow,
    info: colors.blue
  };
  console.log(`${colorMap[type]}${message}${colors.reset}`);
}

/**
 * 1. Store ID整合性チェック＆自動修正
 * 
 * 問題: 予約や席のstore_idが'account-001'などになっていて、
 *      'default-store'と不一致になることがある
 * 
 * 解決: すべてのデータのstore_idを'default-store'に統一
 * 
 * @returns {Promise<void>}
 */
async function fixStoreIdConsistency() {
  log('\n=== Store ID整合性チェック ===', 'info');
  
  // 環境変数から正しいStore IDを取得（改行文字を除去）
  const targetStoreId = (process.env.STORE_ID || 'default-store').trim();
  log(`目標Store ID: ${targetStoreId}`, 'info');
  
  try {
    // 予約のstore_idチェック
    const { data: wrongStoreReservations, error: r1Error } = await supabase
      .from('reservations')
      .select('id, store_id')
      .neq('store_id', targetStoreId);
    
    if (wrongStoreReservations && wrongStoreReservations.length > 0) {
      log(`⚠️ 異なるstore_idの予約: ${wrongStoreReservations.length}件`, 'warning');
      
      // 修正
      const { error: updateError } = await supabase
        .from('reservations')
        .update({ store_id: targetStoreId })
        .neq('store_id', targetStoreId);
      
      if (!updateError) {
        log(`✅ ${wrongStoreReservations.length}件の予約のstore_idを修正しました`, 'success');
      }
    } else {
      log('✅ すべての予約のstore_idが正しいです', 'success');
    }
    
    // NULLのstore_idチェック
    const { data: nullStoreReservations } = await supabase
      .from('reservations')
      .select('id')
      .is('store_id', null);
    
    if (nullStoreReservations && nullStoreReservations.length > 0) {
      log(`⚠️ store_idがNULLの予約: ${nullStoreReservations.length}件`, 'warning');
      
      const { error: updateNullError } = await supabase
        .from('reservations')
        .update({ store_id: targetStoreId })
        .is('store_id', null);
      
      if (!updateNullError) {
        log(`✅ ${nullStoreReservations.length}件のNULL store_idを修正しました`, 'success');
      }
    }
    
    // 席のstore_idチェック
    const { data: wrongStoreSeats } = await supabase
      .from('seats')
      .select('id, store_id')
      .neq('store_id', targetStoreId);
    
    if (wrongStoreSeats && wrongStoreSeats.length > 0) {
      log(`⚠️ 異なるstore_idの席: ${wrongStoreSeats.length}件`, 'warning');
      
      const { error: updateSeatsError } = await supabase
        .from('seats')
        .update({ store_id: targetStoreId })
        .neq('store_id', targetStoreId);
      
      if (!updateSeatsError) {
        log(`✅ ${wrongStoreSeats.length}件の席のstore_idを修正しました`, 'success');
      }
    } else {
      log('✅ すべての席のstore_idが正しいです', 'success');
    }
    
  } catch (error) {
    log(`❌ Store ID修正エラー: ${error.message}`, 'error');
  }
}

/**
 * 2. データベースカラム確認＆追加
 * 
 * 問題: is_lockedカラムが存在しない場合がある
 * 
 * 解決: カラムの存在を確認し、必要に応じてSQL実行を促す
 *      NULLのis_lockedをfalseに修正
 * 
 * @returns {Promise<void>}
 */
async function ensureRequiredColumns() {
  log('\n=== データベースカラム確認 ===', 'info');
  
  try {
    // is_lockedカラムの存在確認（seats table）
    const { data: testSeat, error: seatError } = await supabase
      .from('seats')
      .select('id, is_locked')
      .limit(1);
    
    if (seatError && seatError.message.includes('column')) {
      log('⚠️ is_lockedカラムが存在しません', 'warning');
      log('以下のSQLを実行してください:', 'info');
      log('ALTER TABLE seats ADD COLUMN IF NOT EXISTS is_locked BOOLEAN DEFAULT FALSE;', 'info');
    } else {
      log('✅ is_lockedカラムが存在します', 'success');
      
      // is_lockedがNULLの席を修正
      const { error: updateLockedError } = await supabase
        .from('seats')
        .update({ is_locked: false })
        .is('is_locked', null);
      
      if (!updateLockedError) {
        log('✅ is_locked NULLの席を修正しました', 'success');
      }
    }
    
  } catch (error) {
    log(`⚠️ カラム確認エラー: ${error.message}`, 'warning');
  }
}

/**
 * 3. 席データの初期化確認
 * 
 * 問題: 席データが登録されていない、または少ない
 * 
 * 解決: 席が0件の場合、8席を自動的に初期化
 *      カウンター席、テーブル席、個室などバリエーション豊富に作成
 * 
 * @returns {Promise<void>}
 */
async function ensureSeatsExist() {
  log('\n=== 席データ確認 ===', 'info');
  
  const targetStoreId = (process.env.STORE_ID || 'default-store').trim();
  
  try {
    const { data: seats, error } = await supabase
      .from('seats')
      .select('*')
      .eq('store_id', targetStoreId);
    
    if (!seats || seats.length === 0) {
      log('⚠️ 席データが存在しません。初期化します...', 'warning');
      
      const defaultSeats = [
        { name: 'カウンター席A', seat_type: 'counter', capacity: 1 },
        { name: 'カウンター席B', seat_type: 'counter', capacity: 1 },
        { name: 'テーブル席1', seat_type: 'table', capacity: 4 },
        { name: 'テーブル席2', seat_type: 'table', capacity: 4 },
        { name: 'テーブル席3', seat_type: 'table', capacity: 2 },
        { name: '個室1', seat_type: 'room', capacity: 6 },
        { name: '個室2', seat_type: 'room', capacity: 8 },
        { name: 'カップル席', seat_type: 'table', capacity: 2 }
      ];
      
      const seatsToInsert = defaultSeats.map((seat, index) => ({
        ...seat,
        store_id: targetStoreId,
        is_active: true,
        is_locked: false,
        display_order: index + 1,
        description: `${seat.name}（最大${seat.capacity}名）`
      }));
      
      const { error: insertError } = await supabase
        .from('seats')
        .insert(seatsToInsert);
      
      if (!insertError) {
        log(`✅ ${defaultSeats.length}件の席を初期化しました`, 'success');
      } else {
        log(`❌ 席の初期化エラー: ${insertError.message}`, 'error');
      }
    } else {
      log(`✅ ${seats.length}件の席が存在します`, 'success');
      
      // 非アクティブな席の確認
      const inactiveSeats = seats.filter(s => !s.is_active);
      if (inactiveSeats.length > 0) {
        log(`⚠️ 非アクティブな席: ${inactiveSeats.length}件`, 'warning');
      }
      
      // ロックされた席の確認
      const lockedSeats = seats.filter(s => s.is_locked);
      if (lockedSeats.length > 0) {
        log(`🔒 ロックされた席: ${lockedSeats.length}件`, 'info');
      }
    }
  } catch (error) {
    log(`❌ 席データ確認エラー: ${error.message}`, 'error');
  }
}

/**
 * 4. APIファイルのstore_idハードコーディングチェック
 * 
 * 問題: APIファイル内でstore_idが'account-001'などにハードコードされている
 * 
 * 解決: 各APIファイルをスキャンし、ハードコーディングを検出して警告
 *      process.env.STORE_IDを使用していない場合も警告
 * 
 * @returns {Promise<void>}
 */
async function checkApiHardcoding() {
  log('\n=== APIハードコーディングチェック ===', 'info');
  
  const apiDir = path.join(process.cwd(), 'api');
  const files = await fs.readdir(apiDir);
  const jsFiles = files.filter(f => f.endsWith('.js'));
  
  for (const file of jsFiles) {
    const filePath = path.join(apiDir, file);
    const content = await fs.readFile(filePath, 'utf8');
    
    // ハードコードされたstore_idを検索
    const hardcodedPatterns = [
      /store_id:\s*['"]account-001['"]/g,
      /store_id:\s*['"]account-002['"]/g,
      /['"]store_id['"]\s*:\s*['"](?!default-store)[^'"]+['"]/g
    ];
    
    let hasIssue = false;
    hardcodedPatterns.forEach(pattern => {
      const matches = content.match(pattern);
      if (matches) {
        hasIssue = true;
        log(`⚠️ ${file}: ハードコードされたstore_id発見: ${matches[0]}`, 'warning');
      }
    });
    
    // 環境変数を使用しているか確認
    if (!content.includes('process.env.STORE_ID')) {
      log(`⚠️ ${file}: process.env.STORE_IDを使用していません`, 'warning');
    } else if (!hasIssue) {
      log(`✅ ${file}: 正しく環境変数を使用しています`, 'success');
    }
  }
}

/**
 * 5. 環境変数の確認
 * 
 * 問題: 必要な環境変数が設定されていない、または値に改行が含まれる
 * 
 * 解決: 必須環境変数の存在確認と値の検証
 *      改行文字が含まれていないかチェック
 * 
 * @returns {Promise<boolean>} すべての環境変数が設定されているか
 */
async function checkEnvironmentVariables() {
  log('\n=== 環境変数チェック ===', 'info');
  
  const requiredVars = [
    'LINE_CHANNEL_ACCESS_TOKEN',
    'LINE_CHANNEL_SECRET',
    'LIFF_ID',
    'STORE_ID',
    'SUPABASE_URL',
    'SUPABASE_ANON_KEY'
  ];
  
  let allPresent = true;
  
  for (const varName of requiredVars) {
    const value = process.env[varName];
    if (!value || value.trim() === '') {
      log(`❌ ${varName}: 未設定または空`, 'error');
      allPresent = false;
    } else {
      // 値の一部を表示（セキュリティ考慮）
      const displayValue = value.length > 10 
        ? value.substring(0, 10) + '...' 
        : value;
      log(`✅ ${varName}: ${displayValue}`, 'success');
      
      // 改行文字のチェック
      if (value !== value.trim()) {
        log(`⚠️ ${varName}: 前後に空白/改行があります`, 'warning');
      }
    }
  }
  
  // STORE_IDの値チェック
  if (process.env.STORE_ID && process.env.STORE_ID !== 'default-store') {
    log(`⚠️ STORE_IDが'default-store'ではありません: ${process.env.STORE_ID}`, 'warning');
  }
  
  return allPresent;
}

/**
 * 6. 古いpendingデータのクリーンアップ
 * 
 * 問題: 確定されないまま放置されたpending予約がデータベースに蓄積
 * 
 * 解決: 3日以上前のpending予約を自動削除
 *      データベースの容量とパフォーマンスを最適化
 * 
 * @returns {Promise<void>}
 */
async function cleanupOldPendingReservations() {
  log('\n=== 古いPending予約のクリーンアップ ===', 'info');
  
  try {
    const threeDaysAgo = new Date();
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
    
    // 古いpending予約を検索
    const { data: oldPending, error: selectError } = await supabase
      .from('reservations')
      .select('id, created_at, customer_name')
      .eq('status', 'pending')
      .lt('created_at', threeDaysAgo.toISOString());
    
    if (oldPending && oldPending.length > 0) {
      log(`⚠️ 3日以上前のpending予約: ${oldPending.length}件`, 'warning');
      
      // 削除
      const { error: deleteError } = await supabase
        .from('reservations')
        .delete()
        .eq('status', 'pending')
        .lt('created_at', threeDaysAgo.toISOString());
      
      if (!deleteError) {
        log(`✅ ${oldPending.length}件の古いpending予約を削除しました`, 'success');
      }
    } else {
      log('✅ 古いpending予約はありません', 'success');
    }
  } catch (error) {
    log(`❌ クリーンアップエラー: ${error.message}`, 'error');
  }
}

/**
 * 7. データ統計レポート
 * 
 * 目的: システムの現在の状態を可視化
 * 
 * 内容:
 * - 予約のステータス分布
 * - 本日の確定予約数
 * - 利用可能な席数
 * - ロック中の席数
 * 
 * @returns {Promise<void>}
 */
async function generateDataReport() {
  log('\n=== データ統計レポート ===', 'info');
  
  const targetStoreId = (process.env.STORE_ID || 'default-store').trim();
  
  try {
    // 予約統計
    const { data: reservations, error: r1 } = await supabase
      .from('reservations')
      .select('status')
      .eq('store_id', targetStoreId);
    
    if (reservations) {
      const statusCount = {};
      reservations.forEach(r => {
        statusCount[r.status] = (statusCount[r.status] || 0) + 1;
      });
      
      log('予約ステータス分布:', 'info');
      Object.entries(statusCount).forEach(([status, count]) => {
        log(`  ${status}: ${count}件`, 'info');
      });
    }
    
    // 今日の予約
    const today = new Date().toISOString().split('T')[0];
    const { data: todayReservations } = await supabase
      .from('reservations')
      .select('*')
      .eq('store_id', targetStoreId)
      .eq('date', today)
      .eq('status', 'confirmed');
    
    if (todayReservations) {
      log(`本日の確定予約: ${todayReservations.length}件`, 'info');
    }
    
    // 席統計
    const { data: seats } = await supabase
      .from('seats')
      .select('*')
      .eq('store_id', targetStoreId);
    
    if (seats) {
      const activeSeats = seats.filter(s => s.is_active && !s.is_locked);
      const lockedSeats = seats.filter(s => s.is_locked);
      log(`利用可能な席: ${activeSeats.length}/${seats.length}席`, 'info');
      if (lockedSeats.length > 0) {
        log(`ロック中の席: ${lockedSeats.length}席`, 'warning');
      }
    }
    
  } catch (error) {
    log(`❌ レポート生成エラー: ${error.message}`, 'error');
  }
}

/**
 * メイン実行関数
 * 
 * すべてのチェック・修正処理を順番に実行します。
 * エラーが発生しても可能な限り処理を継続します。
 * 
 * 実行順序:
 * 1. 環境変数チェック（必須）
 * 2. Store ID整合性修正
 * 3. カラム確認
 * 4. 席データ確認
 * 5. APIハードコーディングチェック
 * 6. 古いデータクリーンアップ
 * 7. レポート生成
 */
async function preventIssues() {
  console.log(colors.blue + '\n' + '='.repeat(50));
  console.log('   LINE予約システム 予防保守スクリプト');
  console.log('='.repeat(50) + colors.reset);
  console.log(`実行時刻: ${new Date().toLocaleString('ja-JP')}\n`);
  
  try {
    // 1. 環境変数チェック
    const envOk = await checkEnvironmentVariables();
    if (!envOk) {
      log('\n⚠️ 環境変数を設定してください', 'error');
      return;
    }
    
    // 2. Store ID整合性修正
    await fixStoreIdConsistency();
    
    // 3. カラム確認
    await ensureRequiredColumns();
    
    // 4. 席データ確認
    await ensureSeatsExist();
    
    // 5. APIハードコーディングチェック
    await checkApiHardcoding();
    
    // 6. 古いデータクリーンアップ
    await cleanupOldPendingReservations();
    
    // 7. レポート生成
    await generateDataReport();
    
    log('\n' + '='.repeat(50), 'info');
    log('✅ 予防保守スクリプト完了', 'success');
    log('='.repeat(50) + '\n', 'info');
    
  } catch (error) {
    log(`\n❌ 致命的エラー: ${error.message}`, 'error');
    console.error(error);
  }
}

// 実行
preventIssues();