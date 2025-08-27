import { createClient } from '@supabase/supabase-js';

// Supabase初期化
const SUPABASE_URL = 'https://faenvzzeguvlconvrqgp.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZhZW52enplZ3V2bGNvbnZycWdwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTYxNzQyOTgsImV4cCI6MjA3MTc1MDI5OH0.U_v82IYSDM3waCFfFr4e7MpbTQmZFRPCNaA-2u5R3d8';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  if (req.method === 'GET') {
    // 問題のあるstore_idを表示
    try {
      const { data: problematic, error } = await supabase
        .from('reservations')
        .select('id, store_id')
        .or('store_id.like.%\n,store_id.like.%\r');
      
      return res.status(200).json({
        message: 'Problematic store_ids found',
        count: problematic?.length || 0,
        data: problematic || [],
        instruction: 'POST to this endpoint to fix them'
      });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }
  
  if (req.method === 'POST') {
    // store_idを修正
    try {
      // まず問題のあるレコードを取得
      const { data: problematic, error: fetchError } = await supabase
        .from('reservations')
        .select('id, store_id');
      
      if (fetchError) {
        throw fetchError;
      }
      
      let fixed = 0;
      const errors = [];
      
      // 各レコードを修正
      for (const record of problematic) {
        const trimmedStoreId = record.store_id.trim();
        
        if (trimmedStoreId !== record.store_id) {
          const { error: updateError } = await supabase
            .from('reservations')
            .update({ store_id: trimmedStoreId })
            .eq('id', record.id);
          
          if (updateError) {
            errors.push({ id: record.id, error: updateError.message });
          } else {
            fixed++;
          }
        }
      }
      
      // 修正後の統計を取得
      const { data: stats } = await supabase
        .from('reservations')
        .select('store_id');
      
      const distribution = {};
      stats?.forEach(r => {
        distribution[r.store_id] = (distribution[r.store_id] || 0) + 1;
      });
      
      return res.status(200).json({
        message: 'Database fix completed',
        fixed: fixed,
        errors: errors,
        new_distribution: distribution
      });
      
    } catch (err) {
      return res.status(500).json({ 
        error: err.message,
        stack: err.stack 
      });
    }
  }
  
  return res.status(405).json({ error: 'Method Not Allowed' });
}