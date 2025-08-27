// 管理画面API（メモリベース - webhook-memoryと連携）
import { getReservations } from './webhook-memory.js';

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
    const reservations = getReservations();
    
    return res.status(200).json({
      status: 'success',
      store_id: 'restaurant-001',
      total: reservations.length,
      reservations: reservations
    });
  }
  
  return res.status(405).json({ error: 'Method Not Allowed' });
}