// 予約表示問題の再発防止スクリプト
// このスクリプトを定期的に実行して問題を早期発見・自動修正

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';

// 環境変数読み込み
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

// 色付きログ出力
const log = {
  info: (msg) => console.log(`\x1b[36m[INFO]\x1b[0m ${msg}`),
  success: (msg) => console.log(`\x1b[32m[SUCCESS]\x1b[0m ${msg}`),
  warning: (msg) => console.log(`\x1b[33m[WARNING]\x1b[0m ${msg}`),
  error: (msg) => console.log(`\x1b[31m[ERROR]\x1b[0m ${msg}`)
};

async function preventIssues() {
  console.log('\n========================================');
  console.log('   予約システム問題防止チェック        ');
  console.log('========================================\n');
  
  const issues = [];
  const fixes = [];
  
  // 1. 環境変数チェック
  log.info('環境変数をチェック中...');
  const requiredEnvVars = [
    'SUPABASE_URL',
    'SUPABASE_ANON_KEY', 
    'LINE_CHANNEL_ACCESS_TOKEN',
    'LINE_CHANNEL_SECRET',
    'LIFF_ID',
    'STORE_ID'
  ];
  
  const missingEnvVars = requiredEnvVars.filter(key => !process.env[key]);
  if (missingEnvVars.length > 0) {
    issues.push(`環境変数が不足: ${missingEnvVars.join(', ')}`);
    log.warning('環境変数が不足しています');
  } else {
    log.success('環境変数: OK');
  }
  
  // 2. STORE_IDの一貫性チェック
  log.info('Store IDの一貫性をチェック中...');
  const expectedStoreId = process.env.STORE_ID || '***REMOVED-ROTATE-CREDENTIAL***';
  
  if (process.env.STORE_ID !== '***REMOVED-ROTATE-CREDENTIAL***') {
    log.warning(`STORE_IDが標準値と異なる: ${process.env.STORE_ID}`);
    fixes.push('STORE_IDを***REMOVED-ROTATE-CREDENTIAL***に統一することを推奨');
  }
  
  // 3. データベース内のstore_id確認
  log.info('データベースのstore_id分布を確認中...');
  
  try {
    // 全予約のstore_id分布を取得
    const { data: allReservations, error } = await supabase
      .from('reservations')
      .select('store_id');
    
    if (error) throw error;
    
    const storeIdCount = {};
    allReservations.forEach(r => {
      const id = r.store_id || 'null';
      storeIdCount[id] = (storeIdCount[id] || 0) + 1;
    });
    
    const uniqueStoreIds = Object.keys(storeIdCount);
    
    if (uniqueStoreIds.length === 0) {
      log.info('予約データなし');
    } else if (uniqueStoreIds.length === 1 && uniqueStoreIds[0] === expectedStoreId) {
      log.success(`Store ID統一: OK (${storeIdCount[expectedStoreId]}件すべて${expectedStoreId})`);
    } else {
      log.warning('Store IDが不統一です:');
      Object.entries(storeIdCount).forEach(([id, count]) => {
        console.log(`  - ${id}: ${count}件`);
      });
      issues.push('Store IDの不統一');
      
      // 自動修正の提案
      if (uniqueStoreIds.length > 1 || uniqueStoreIds[0] !== expectedStoreId) {
        log.info('自動修正を実行しています...');
        
        const { error: updateError } = await supabase
          .from('reservations')
          .update({ store_id: expectedStoreId })
          .neq('store_id', expectedStoreId);
        
        if (updateError) {
          log.error('自動修正失敗: ' + updateError.message);
          fixes.push('手動でデータベースのstore_idを統一してください');
        } else {
          log.success(`すべての予約をstore_id: ${expectedStoreId}に統一しました`);
          fixes.push('Store IDを自動統一しました');
        }
      }
    }
    
    // 4. Vercel環境変数の同期チェック
    log.info('Vercel環境変数の同期をチェック中...');
    
    // .env.localとVercelの環境変数が同期されているかチェック
    if (!fs.existsSync('.env.local')) {
      issues.push('.env.localファイルが存在しません');
      log.error('.env.localファイルが見つかりません');
    } else {
      log.success('.env.localファイル: OK');
      
      // Vercelに設定すべき環境変数のリマインダー
      console.log('\n📋 Vercel環境変数の確認コマンド:');
      console.log('  vercel env ls production\n');
      console.log('⚠️  以下の値が.env.localと一致することを確認:');
      requiredEnvVars.forEach(key => {
        const value = process.env[key];
        if (value) {
          const displayValue = key.includes('TOKEN') || key.includes('SECRET') || key.includes('KEY')
            ? value.substring(0, 10) + '...' 
            : value;
          console.log(`  ${key}: ${displayValue}`);
        }
      });
    }
    
    // 5. 最新の予約データ確認
    log.info('最新の予約データを確認中...');
    
    const { data: latestReservation } = await supabase
      .from('reservations')
      .select('*')
      .eq('store_id', expectedStoreId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();
    
    if (latestReservation) {
      log.success('最新予約あり:');
      console.log(`  日時: ${latestReservation.date} ${latestReservation.time}`);
      console.log(`  顧客: ${latestReservation.customer_name}`);
      console.log(`  作成: ${new Date(latestReservation.created_at).toLocaleString('ja-JP')}`);
    } else {
      log.info('予約データがありません');
    }
    
  } catch (error) {
    log.error('データベース接続エラー: ' + error.message);
    issues.push('データベース接続エラー');
    fixes.push('Supabase認証情報を確認してください');
  }
  
  // 結果サマリー
  console.log('\n========================================');
  console.log('   診断結果サマリー                    ');
  console.log('========================================\n');
  
  if (issues.length === 0) {
    log.success('🎉 問題は検出されませんでした！');
  } else {
    log.warning(`⚠️  ${issues.length}件の問題が検出されました:`);
    issues.forEach((issue, i) => {
      console.log(`  ${i + 1}. ${issue}`);
    });
  }
  
  if (fixes.length > 0) {
    console.log('\n📝 実行した修正 / 推奨アクション:');
    fixes.forEach((fix, i) => {
      console.log(`  ${i + 1}. ${fix}`);
    });
  }
  
  // 次のステップ
  console.log('\n📋 次のステップ:');
  console.log('1. Vercel環境変数が最新であることを確認');
  console.log('   vercel env ls production');
  console.log('2. 必要に応じて再デプロイ');
  console.log('   vercel --prod --force');
  console.log('3. 管理画面で予約が表示されることを確認');
  console.log('   https://line-booking-system-seven.vercel.app/admin');
  
  return issues.length === 0;
}

// 実行
preventIssues().then(success => {
  if (success) {
    process.exit(0);
  } else {
    process.exit(1);
  }
});