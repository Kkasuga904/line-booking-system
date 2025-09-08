// データベースのデータ状況を確認するデバッグスクリプト
// node debug-data.js で実行

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://faenvzzeguvlconvrqgp.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZhZW52enplZ3V2bGNvbnZycWdwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTYxNzQyOTgsImV4cCI6MjA3MTc1MDI5OH0.U_v82IYSDM3waCFfFr4e7MpbTQmZFRPCNaA-2u5R3d8';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function checkData() {
    console.log('=== データベース状況確認 ===\n');
    
    // 1. 予約データの集計
    console.log('【予約データ】');
    const { data: reservations, error: resError } = await supabase
        .from('reservations')
        .select('store_id, id, customer_name, date, time');
    
    if (resError) {
        console.error('予約データ取得エラー:', resError);
    } else {
        // store_idごとに集計
        const storeCount = {};
        reservations.forEach(r => {
            const sid = r.store_id || 'NULL';
            storeCount[sid] = (storeCount[sid] || 0) + 1;
        });
        
        console.log('store_id別件数:');
        Object.entries(storeCount).forEach(([sid, count]) => {
            console.log(`  ${sid}: ${count}件`);
        });
        
        // 各store_idの最初の3件を表示
        Object.keys(storeCount).forEach(sid => {
            console.log(`\n${sid}の予約（最初の3件）:`);
            const storeReservations = reservations.filter(r => (r.store_id || 'NULL') === sid).slice(0, 3);
            storeReservations.forEach(r => {
                console.log(`  - ${r.date} ${r.time} ${r.customer_name}`);
            });
        });
    }
    
    // 2. 容量制限ルールの集計
    console.log('\n【容量制限ルール】');
    const { data: rules, error: rulesError } = await supabase
        .from('capacity_control_rules')
        .select('store_id, date, time_slot, max_groups, max_people');
    
    if (rulesError) {
        console.error('ルール取得エラー:', rulesError);
    } else {
        const ruleCount = {};
        rules.forEach(r => {
            const sid = r.store_id || 'NULL';
            ruleCount[sid] = (ruleCount[sid] || 0) + 1;
        });
        
        console.log('store_id別件数:');
        Object.entries(ruleCount).forEach(([sid, count]) => {
            console.log(`  ${sid}: ${count}件`);
        });
    }
    
    // 3. データ復旧の提案
    console.log('\n=== データ復旧の提案 ===');
    
    if (storeCount['default-store'] > 0 && !storeCount['account1-store']) {
        console.log('⚠️ default-storeにデータがありますが、account1-storeにはありません。');
        console.log('以下のSQLで移行できます:');
        console.log(`
UPDATE reservations 
SET store_id = 'account1-store' 
WHERE store_id = 'default-store';

UPDATE capacity_control_rules 
SET store_id = 'account1-store' 
WHERE store_id = 'default-store';
        `);
    } else if (storeCount['NULL'] > 0) {
        console.log('⚠️ store_idがNULLのデータがあります。');
        console.log('以下のSQLで修正できます:');
        console.log(`
UPDATE reservations 
SET store_id = 'account1-store' 
WHERE store_id IS NULL;

UPDATE capacity_control_rules 
SET store_id = 'account1-store' 
WHERE store_id IS NULL;
        `);
    } else if (storeCount['account1-store'] > 0) {
        console.log('✅ account1-storeにデータが存在します。');
        console.log('カレンダーに表示されない場合は、フロントエンド側の問題の可能性があります。');
    }
}

checkData().catch(console.error);