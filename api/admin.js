import { createClient } from '@supabase/supabase-js';

// Supabase初期化
const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_ANON_KEY || ''
);

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  // GET: 予約一覧取得
  if (req.method === 'GET') {
    const { store_id = 'restaurant-001', status, date } = req.query;
    
    // store_idから改行文字を削除
    const cleanStoreId = store_id.trim();
    
    // 改行文字を含むstore_idも取得するようにOR条件を追加
    let query = supabase
      .from('reservations')
      .select('*')
      .or(`store_id.eq.${cleanStoreId},store_id.eq.${cleanStoreId}\n`)
      .order('date', { ascending: true })
      .order('time', { ascending: true });
    
    if (status) {
      query = query.eq('status', status);
    }
    
    if (date) {
      query = query.eq('date', date);
    }
    
    const { data, error } = await query;
    
    if (error) {
      return res.status(500).json({ error: error.message });
    }
    
    return res.status(200).json(data || []);
  }
  
  // PUT: 予約ステータス更新
  if (req.method === 'PUT') {
    const { id, status } = req.body;
    
    if (!id || !status) {
      return res.status(400).json({ error: 'ID and status are required' });
    }
    
    const { data, error } = await supabase
      .from('reservations')
      .update({ 
        status, 
        updated_at: new Date().toISOString() 
      })
      .eq('id', id)
      .select()
      .single();
    
    if (error) {
      return res.status(500).json({ error: error.message });
    }
    
    return res.status(200).json(data);
  }
  
  return res.status(405).send('Method Not Allowed');
}