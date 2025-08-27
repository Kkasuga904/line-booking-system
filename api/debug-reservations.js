import { createClient } from '@supabase/supabase-js';

// Supabase初期化
const SUPABASE_URL = 'https://faenvzzeguvlconvrqgp.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZhZW52enplZ3V2bGNvbnZycWdwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTYxNzQyOTgsImV4cCI6MjA3MTc1MDI5OH0.U_v82IYSDM3waCFfFr4e7MpbTQmZFRPCNaA-2u5R3d8';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  if (req.method === 'GET') {
    try {
      // 全store_idの予約数を確認
      const { data: allReservations, error: allError } = await supabase
        .from('reservations')
        .select('store_id', { count: 'exact' });
      
      if (allError) {
        console.error('Error fetching all reservations:', allError);
      }
      
      // store_idごとにグループ化
      const storeGroups = {};
      if (allReservations) {
        allReservations.forEach(r => {
          if (!storeGroups[r.store_id]) {
            storeGroups[r.store_id] = 0;
          }
          storeGroups[r.store_id]++;
        });
      }
      
      // 現在のstore_idの予約
      const currentStoreId = (process.env.STORE_ID || 'account-001').trim();
      const { data: currentStoreReservations, error: currentError, count } = await supabase
        .from('reservations')
        .select('*', { count: 'exact' })
        .eq('store_id', currentStoreId)
        .order('created_at', { ascending: false })
        .limit(10);
      
      // 最新の予約（全store_id）
      const { data: latestReservations, error: latestError } = await supabase
        .from('reservations')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(5);
      
      return res.status(200).json({
        debug: true,
        current_store_id: currentStoreId,
        environment: {
          STORE_ID: process.env.STORE_ID,
          NODE_ENV: process.env.NODE_ENV
        },
        store_distribution: storeGroups,
        current_store_count: count || 0,
        current_store_reservations: currentStoreReservations || [],
        latest_reservations_all_stores: latestReservations || [],
        errors: {
          all: allError?.message,
          current: currentError?.message,
          latest: latestError?.message
        }
      });
      
    } catch (err) {
      console.error('Debug error:', err);
      return res.status(500).json({
        error: err.message,
        stack: err.stack
      });
    }
  }
  
  return res.status(405).json({ error: 'Method Not Allowed' });
}