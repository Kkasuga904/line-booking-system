/**
 * 認証なし管理API - 開発/テスト用
 * 本番環境では使用しないでください
 */

import { createClient } from '@supabase/supabase-js';
import { getEnv } from '../utils/env-helper.js';
import { getStoreId } from '../utils/store-config.js';

// Supabase初期化 - 環境変数から取得
const SUPABASE_URL = getEnv('SUPABASE_URL', 'https://faenvzzeguvlconvrqgp.supabase.co');
const SUPABASE_ANON_KEY = getEnv('SUPABASE_ANON_KEY');
const SUPABASE_SERVICE_ROLE_KEY = getEnv('SUPABASE_SERVICE_ROLE_KEY');

if (!SUPABASE_ANON_KEY) {
  console.error('ERROR: SUPABASE_ANON_KEY is not set in environment variables');
  throw new Error('SUPABASE_ANON_KEY is required');
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// サービスロールクライアント（RLSバイパス用）
const supabaseAdmin = SUPABASE_SERVICE_ROLE_KEY 
  ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { 
      auth: { persistSession: false } 
    })
  : supabase;

export default async function handler(req, res) {
  // CORS設定
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  // URLパラメータからactionを取得
  const url = new URL(req.url, `http://${req.headers.host}`);
  const action = url.searchParams.get('action');
  
  console.log('Admin NoAuth API Request:', {
    method: req.method,
    action: action
  });
  
  // GETリクエストでactionがない場合はヘルスチェック
  if (!action && req.method === 'GET') {
    return res.status(200).json({ 
      status: 'healthy',
      endpoint: 'admin-noauth',
      warning: 'This endpoint has no authentication. Use only for development.'
    });
  }
  
  const storeId = getStoreId(req);
  
  try {
    switch (action) {
      case 'list':
      case 'supabase':
        // 予約一覧取得
        const { data: list, error: listError } = await supabaseAdmin
          .from('reservations')
          .select('*')
          .eq('store_id', storeId)
          .order('date', { ascending: false })
          .order('time', { ascending: false });
        
        if (listError) throw listError;
        
        return res.status(200).json({
          ok: true,
          data: list || [],
          count: list?.length || 0
        });
      
      case 'create':
        // 新規予約作成
        if (req.method !== 'POST') {
          return res.status(405).json({ error: 'Method not allowed' });
        }
        
        const newReservation = {
          store_id: storeId,
          customer_name: req.body.customerName || req.body.customer_name,
          date: req.body.date,
          time: req.body.time,
          people: req.body.numberOfPeople || req.body.people || 1,
          phone: req.body.phone || req.body.phoneNumber,
          status: req.body.status || 'confirmed',
          notes: req.body.notes || '',
          created_at: new Date().toISOString()
        };
        
        const { data: created, error: createError } = await supabaseAdmin
          .from('reservations')
          .insert([newReservation])
          .select()
          .single();
        
        if (createError) throw createError;
        
        return res.status(201).json({
          ok: true,
          data: created,
          message: '予約を作成しました'
        });
      
      case 'delete':
        // 予約削除
        if (req.method !== 'DELETE') {
          return res.status(405).json({ error: 'Method not allowed' });
        }
        
        const deleteId = url.searchParams.get('id');
        if (!deleteId) {
          return res.status(400).json({ error: 'ID is required' });
        }
        
        const { error: deleteError } = await supabaseAdmin
          .from('reservations')
          .delete()
          .eq('id', deleteId)
          .eq('store_id', storeId);
        
        if (deleteError) throw deleteError;
        
        return res.status(200).json({
          ok: true,
          message: '予約を削除しました'
        });
      
      default:
        return res.status(400).json({ 
          error: 'Invalid action',
          validActions: ['list', 'create', 'delete', 'supabase']
        });
    }
  } catch (error) {
    console.error('Admin NoAuth API Error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
}