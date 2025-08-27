/**
 * 席管理API
 * GET: 席一覧取得
 * POST: 席追加
 * PUT: 席更新
 * DELETE: 席削除
 */

import { createClient } from '@supabase/supabase-js';
import { getEnv } from '../utils/env-helper.js';

const SUPABASE_URL = 'https://faenvzzeguvlconvrqgp.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZhZW52enplZ3V2bGNvbnZycWdwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTYxNzQyOTgsImV4cCI6MjA3MTc1MDI5OH0.U_v82IYSDM3waCFfFr4e7MpbTQmZFRPCNaA-2u5R3d8';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export default async function handler(req, res) {
  // CORS設定
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  const storeId = getEnv('STORE_ID', 'default-store');
  
  try {
    // GET: 席一覧取得
    if (req.method === 'GET') {
      const { data, error } = await supabase
        .from('seats')
        .select('*')
        .eq('store_id', storeId)
        .eq('is_active', true)
        .order('display_order');
      
      if (error) throw error;
      
      return res.status(200).json({
        success: true,
        seats: data || []
      });
    }
    
    // POST: 席追加
    if (req.method === 'POST') {
      const { name, seat_type, capacity, description } = req.body;
      
      if (!name) {
        return res.status(400).json({ 
          error: '席名は必須です' 
        });
      }
      
      const { data, error } = await supabase
        .from('seats')
        .insert([{
          store_id: storeId,
          name,
          seat_type: seat_type || 'table',
          capacity: capacity || 2,
          description: description || null,
          display_order: 999
        }])
        .select();
      
      if (error) throw error;
      
      return res.status(200).json({
        success: true,
        seat: data[0]
      });
    }
    
    // PUT: 席更新
    if (req.method === 'PUT') {
      const { id, name, seat_type, capacity, description, is_active } = req.body;
      
      if (!id) {
        return res.status(400).json({ 
          error: '席IDは必須です' 
        });
      }
      
      const updateData = {};
      if (name !== undefined) updateData.name = name;
      if (seat_type !== undefined) updateData.seat_type = seat_type;
      if (capacity !== undefined) updateData.capacity = capacity;
      if (description !== undefined) updateData.description = description;
      if (is_active !== undefined) updateData.is_active = is_active;
      
      const { data, error } = await supabase
        .from('seats')
        .update(updateData)
        .eq('id', id)
        .eq('store_id', storeId)
        .select();
      
      if (error) throw error;
      
      return res.status(200).json({
        success: true,
        seat: data[0]
      });
    }
    
    // PATCH: 席のロック状態更新
    if (req.method === 'PATCH') {
      const { id, is_locked } = req.body;
      
      if (!id) {
        return res.status(400).json({ 
          error: '席IDは必須です' 
        });
      }
      
      if (is_locked === undefined) {
        return res.status(400).json({ 
          error: 'ロック状態の指定が必要です' 
        });
      }
      
      const { data, error } = await supabase
        .from('seats')
        .update({ is_locked })
        .eq('id', id)
        .eq('store_id', storeId)
        .select();
      
      if (error) throw error;
      
      console.log(`Seat ${id} lock status updated to: ${is_locked}`);
      
      return res.status(200).json({
        success: true,
        seat: data[0],
        message: is_locked ? '席を予約停止にしました' : '予約停止を解除しました'
      });
    }
    
    // DELETE: 席削除（論理削除）
    if (req.method === 'DELETE') {
      const { id } = req.query;
      
      if (!id) {
        return res.status(400).json({ 
          error: '席IDは必須です' 
        });
      }
      
      const { data, error } = await supabase
        .from('seats')
        .update({ is_active: false })
        .eq('id', id)
        .eq('store_id', storeId)
        .select();
      
      if (error) throw error;
      
      return res.status(200).json({
        success: true,
        message: '席を削除しました'
      });
    }
    
    return res.status(405).json({ error: 'Method not allowed' });
    
  } catch (error) {
    console.error('Seats API error:', error);
    return res.status(500).json({
      error: 'サーバーエラーが発生しました',
      details: error.message
    });
  }
}