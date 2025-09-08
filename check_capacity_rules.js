const { createClient } = require('@supabase/supabase-js');

// 環境変数から認証情報を取得
const SUPABASE_URL = 'https://faenvzzeguvlconvrqgp.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZhZW52enplZ3V2bGNvbnZycWdwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTYxNzQyOTgsImV4cCI6MjA3MTc1MDI5OH0.U_v82IYSDM3waCFfFr4e7MpbTQmZFRPCNaA-2u5R3d8';

async function checkCapacityRules() {
    console.log('=== Checking Capacity Rules in Database ===\n');
    
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    
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
    
    // 各ルールの詳細を表示
    console.log('2. Rule details:');
    data.forEach((rule, index) => {
        console.log(`\n   Rule ${index + 1}:`);
        console.log(`   - Date: ${rule.date}`);
        console.log(`   - Time: ${rule.start_time} - ${rule.end_time}`);
        console.log(`   - Store ID: ${rule.store_id}`);
        console.log(`   - Control Type: ${rule.control_type}`);
        console.log(`   - Max Groups: ${rule.max_groups}`);
        console.log(`   - Max People: ${rule.max_people}`);
        console.log(`   - Max Per Group: ${rule.max_per_group}`);
    });
    
    // 特定の日付のルールを確認
    console.log('\n3. Rules for specific dates:');
    const dates = ['2025-09-09', '2025-09-12'];
    
    for (const date of dates) {
        const { data: dateRules, error: dateError } = await supabase
            .from('capacity_control_rules')
            .select('*')
            .eq('date', date);
        
        if (dateError) {
            console.log(`   ❌ Error for ${date}:`, dateError.message);
        } else {
            console.log(`\n   ${date}: ${dateRules.length} rule(s)`);
            dateRules.forEach(rule => {
                console.log(`     - ${rule.start_time} - ${rule.end_time}: Max ${rule.max_groups} groups`);
            });
        }
    }
    
    // store_idごとのルール数を確認
    console.log('\n4. Rules by store_id:');
    const storeIds = ['default-store', 'store-a'];
    
    for (const storeId of storeIds) {
        const { data: storeRules, error: storeError } = await supabase
            .from('capacity_control_rules')
            .select('*')
            .eq('store_id', storeId);
        
        if (storeError) {
            console.log(`   ❌ Error for ${storeId}:`, storeError.message);
        } else {
            console.log(`   ${storeId}: ${storeRules.length} rule(s)`);
        }
    }
    
    console.log('\n=== Check Complete ===');
}

checkCapacityRules().catch(console.error);