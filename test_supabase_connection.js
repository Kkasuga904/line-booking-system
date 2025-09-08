const { createClient } = require('@supabase/supabase-js');

// 環境変数から認証情報を取得
const SUPABASE_URL = '***REMOVED-ROTATE-CREDENTIAL***';
const SUPABASE_ANON_KEY = '***REMOVED-ROTATE-CREDENTIAL***';
const SUPABASE_SERVICE_KEY = '***REMOVED-ROTATE-CREDENTIAL***';

async function testConnection() {
    console.log('Testing Supabase connection...\n');
    
    // Anonキーでテスト
    console.log('1. Testing with ANON key:');
    const supabaseAnon = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    const { data: anonData, error: anonError } = await supabaseAnon
        .from('capacity_control_rules')
        .select('*')
        .limit(1);
    
    if (anonError) {
        console.log('   ❌ ANON key error:', anonError.message);
    } else {
        console.log('   ✅ ANON key works!');
    }
    
    // Service Roleキーでテスト
    console.log('\n2. Testing with SERVICE ROLE key:');
    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const { data: adminData, error: adminError } = await supabaseAdmin
        .from('capacity_control_rules')
        .select('*')
        .limit(1);
    
    if (adminError) {
        console.log('   ❌ SERVICE ROLE key error:', adminError.message);
        console.log('   Error details:', JSON.stringify(adminError));
    } else {
        console.log('   ✅ SERVICE ROLE key works!');
        console.log('   Found', adminData?.length || 0, 'records');
    }
    
    // テストデータの挿入を試みる
    console.log('\n3. Testing INSERT with SERVICE ROLE key:');
    const testRule = {
        date: '2025-09-08',
        start_time: '12:00:00',
        end_time: '13:00:00',
        max_groups: 2
    };
    
    const { data: insertData, error: insertError } = await supabaseAdmin
        .from('capacity_control_rules')
        .insert([testRule]);
    
    if (insertError) {
        console.log('   ❌ INSERT error:', insertError.message);
        console.log('   Error code:', insertError.code);
        console.log('   Error hint:', insertError.hint);
    } else {
        console.log('   ✅ INSERT successful!');
        
        // 削除
        await supabaseAdmin
            .from('capacity_control_rules')
            .delete()
            .eq('date', '2025-09-08');
    }
    
    console.log('\nTest complete!');
}

testConnection().catch(console.error);