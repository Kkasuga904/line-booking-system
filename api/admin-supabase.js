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
  
  // GET: 予約一覧取得
  if (req.method === 'GET') {
    try {
      // store_idを取得（環境変数またはデフォルト）
      const storeId = (process.env.STORE_ID || 'account-001').trim();
      console.log('Fetching reservations for store_id:', storeId);
      
      // 予約データを取得（席情報も含む）
      const { data: reservations, error, count } = await supabase
        .from('reservations')
        .select(`
          *,
          seats (
            id,
            name,
            seat_type,
            capacity
          )
        `, { count: 'exact' })
        .eq('store_id', storeId)
        .order('created_at', { ascending: false })
        .limit(100);
      
      // 席情報を予約データに統合
      const data = reservations ? reservations.map(r => ({
        ...r,
        seat_name: r.seats?.name || null,
        seat_type: r.seats?.seat_type || null,
        seat_capacity: r.seats?.capacity || null
      })) : [];
      
      if (error) {
        console.error('Supabase error:', error);
        return res.status(200).json({
          status: 'error',
          error: error.message,
          store_id: storeId,
          total: 0,
          reservations: []
        });
      }
      
      console.log(`Found ${data?.length || 0} reservations for store ${storeId}`);
      
      return res.status(200).json({
        status: 'success',
        store_id: storeId,
        total: count || 0,
        reservations: data || []
      });
      
    } catch (err) {
      console.error('Server error:', err);
      return res.status(500).json({
        status: 'error',
        error: err.message,
        store_id: (process.env.STORE_ID || 'account-001').trim(),
        total: 0,
        reservations: []
      });
    }
  }
  
  return res.status(405).json({ error: 'Method Not Allowed' });
}