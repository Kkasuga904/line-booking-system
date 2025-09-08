const { createClient } = require('@supabase/supabase-js');

// 環境変数から認証情報を取得（anonキーを使用）
const SUPABASE_URL = '***REMOVED-ROTATE-CREDENTIAL***';
const SUPABASE_ANON_KEY = '***REMOVED-ROTATE-CREDENTIAL***';

async function cleanupStoreDuplicates() {
    console.log('=== Cleaning Up Store Duplicates ===\n');
    
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    
    // すべての容量制限ルールを取得
    console.log('1. Fetching all capacity rules:');
    const { data: allData, error: fetchError } = await supabase
        .from('capacity_control_rules')
        .select('*')
        .order('date', { ascending: true });
    
    if (fetchError) {
        console.log('   ❌ Error:', fetchError.message);
        return;
    }
    
    console.log(`   ✅ Found ${allData.length} rules total`);
    console.log('\n2. Rules by store_id:');
    
    const defaultStoreRules = allData.filter(r => r.store_id === '***REMOVED-ROTATE-CREDENTIAL***');
    const storeARules = allData.filter(r => r.store_id === 'store-a');
    
    console.log(`   - ***REMOVED-ROTATE-CREDENTIAL***: ${defaultStoreRules.length} rules`);
    console.log(`   - store-a: ${storeARules.length} rules`);
    
    // store-a のルールを削除
    if (storeARules.length > 0) {
        console.log('\n3. Deleting store-a rules:');
        const { error: deleteError } = await supabase
            .from('capacity_control_rules')
            .delete()
            .eq('store_id', 'store-a');
        
        if (deleteError) {
            console.log('   ❌ Delete error:', deleteError.message);
        } else {
            console.log(`   ✅ Deleted ${storeARules.length} store-a rules`);
        }
    }
    
    // 残ったルールを確認
    console.log('\n4. Verifying remaining rules:');
    const { data: remainingData, error: remainingError } = await supabase
        .from('capacity_control_rules')
        .select('*')
        .order('date', { ascending: true });
    
    if (remainingError) {
        console.log('   ❌ Error:', remainingError.message);
    } else {
        console.log(`   ✅ ${remainingData.length} rules remaining (should be ***REMOVED-ROTATE-CREDENTIAL*** only)`);
        remainingData.forEach((rule, idx) => {
            console.log(`      ${idx + 1}. ${rule.date} ${rule.start_time} - ${rule.end_time} (${rule.store_id})`);
        });
    }
    
    console.log('\n=== Cleanup Complete ===');
}

cleanupStoreDuplicates().catch(console.error);