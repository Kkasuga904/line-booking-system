const { createClient } = require('@supabase/supabase-js');

// 環境変数から認証情報を取得
const SUPABASE_URL = '***REMOVED-ROTATE-CREDENTIAL***';
const SUPABASE_SERVICE_KEY = '***REMOVED-ROTATE-CREDENTIAL***';

async function cleanupDuplicateRules() {
    console.log('=== Cleaning Up Duplicate Capacity Rules ===\n');
    
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    
    // すべての容量制限ルールを取得
    console.log('1. Fetching all capacity rules:');
    const { data, error } = await supabase
        .from('capacity_control_rules')
        .select('*')
        .order('date', { ascending: true });
    
    if (error) {
        console.log('   ❌ Error:', error.message);
        return;
    }
    
    console.log(`   ✅ Found ${data.length} rules total\n`);
    
    // store-a のルールを削除（***REMOVED-ROTATE-CREDENTIAL*** のみ残す）
    console.log('2. Removing store-a duplicates:');
    const storeAIds = data
        .filter(rule => rule.store_id === 'store-a')
        .map(rule => rule.id);
    
    if (storeAIds.length > 0) {
        const { error: deleteError } = await supabase
            .from('capacity_control_rules')
            .delete()
            .in('id', storeAIds);
        
        if (deleteError) {
            console.log('   ❌ Delete error:', deleteError.message);
        } else {
            console.log(`   ✅ Deleted ${storeAIds.length} store-a rules`);
        }
    } else {
        console.log('   ℹ️ No store-a rules to delete');
    }
    
    // 残ったルールを確認
    console.log('\n3. Remaining rules:');
    const { data: remainingData } = await supabase
        .from('capacity_control_rules')
        .select('*')
        .order('date', { ascending: true });
    
    remainingData.forEach((rule, index) => {
        console.log(`   Rule ${index + 1}:`, {
            date: rule.date,
            time: `${rule.start_time} - ${rule.end_time}`,
            store_id: rule.store_id,
            max_groups: rule.max_groups
        });
    });
    
    console.log('\n=== Cleanup Complete ===');
}

cleanupDuplicateRules().catch(console.error);