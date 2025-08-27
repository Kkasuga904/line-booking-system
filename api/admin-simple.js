// Admin Simple API for Account 1
// Store: account-001
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://faenvzzeguvlconvrqgp.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZhZW52enpzZ3V2bGNvbnZycWdwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTcyMzg4MDA2MywiZXhwIjoyMDM5NDU2MDYzfQ.m05TmqZGCM4m9IWBGEGg5JOj8qG0nERN7kNKdKGvTSA';
const supabase = createClient(supabaseUrl, supabaseKey);

const STORE_ID = 'account-001';

export default async function handler(req, res) {
  console.log('Admin Simple API called for Store:', STORE_ID);
  
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    // GET: 予約一覧取得
    if (req.method === 'GET') {
      const { data, error } = await supabase
        .from('reservations')
        .select('*')
        .eq('store_id', STORE_ID)
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) {
        console.error('Supabase error:', error);
        return res.status(500).json({ 
          status: 'error', 
          error: error.message 
        });
      }

      return res.status(200).json({
        status: 'success',
        store_id: STORE_ID,
        total: data?.length || 0,
        reservations: data || []
      });
    }

    // POST: 新規予約作成
    if (req.method === 'POST') {
      const reservation = {
        ...req.body,
        store_id: STORE_ID,
        status: req.body.status || 'pending',
        created_at: new Date().toISOString()
      };

      const { data, error } = await supabase
        .from('reservations')
        .insert([reservation])
        .select()
        .single();

      if (error) {
        console.error('Insert error:', error);
        return res.status(500).json({ 
          status: 'error', 
          error: error.message 
        });
      }

      return res.status(200).json({
        status: 'success',
        reservation: data
      });
    }

    // PUT: 予約更新
    if (req.method === 'PUT') {
      const { id, ...updateData } = req.body;

      if (!id) {
        return res.status(400).json({ 
          status: 'error', 
          error: 'ID is required' 
        });
      }

      const { data, error } = await supabase
        .from('reservations')
        .update({
          ...updateData,
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .eq('store_id', STORE_ID)
        .select()
        .single();

      if (error) {
        console.error('Update error:', error);
        return res.status(500).json({ 
          status: 'error', 
          error: error.message 
        });
      }

      return res.status(200).json({
        status: 'success',
        reservation: data
      });
    }

    // DELETE: 予約削除
    if (req.method === 'DELETE') {
      const { id } = req.query;

      if (!id) {
        return res.status(400).json({ 
          status: 'error', 
          error: 'ID is required' 
        });
      }

      const { error } = await supabase
        .from('reservations')
        .delete()
        .eq('id', id)
        .eq('store_id', STORE_ID);

      if (error) {
        console.error('Delete error:', error);
        return res.status(500).json({ 
          status: 'error', 
          error: error.message 
        });
      }

      return res.status(200).json({
        status: 'success',
        message: 'Reservation deleted successfully'
      });
    }

    return res.status(405).json({ 
      status: 'error', 
      error: 'Method not allowed' 
    });

  } catch (error) {
    console.error('API Error:', error);
    return res.status(500).json({ 
      status: 'error', 
      error: error.message 
    });
  }
}