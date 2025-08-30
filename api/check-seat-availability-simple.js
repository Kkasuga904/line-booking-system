/**
 * 席の空き状況チェックAPI（シンプル版）
 * POST /api/check-seat-availability
 * Supabase依存なしで動作するフォールバック版
 */

export default async function handler(req, res) {
  // レスポンスが既に送信されている場合は処理しない
  if (res.headersSent) {
    console.warn('Headers already sent for check-seat-availability-simple');
    return;
  }
  
  // CORS設定
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  try {
    const { date, time, people } = req.body;
    
    if (!date || !time) {
      return res.status(400).json({ 
        error: '日付と時間は必須です' 
      });
    }
    
    const requiredPeople = people || 2;
    
    // ダミーデータ: 常に利用可能な席を返す
    const availableSeats = [
      {
        id: 1,
        name: 'テーブル1',
        capacity: 4,
        display_order: 1,
        is_active: true
      },
      {
        id: 2,
        name: 'テーブル2',
        capacity: 2,
        display_order: 2,
        is_active: true
      },
      {
        id: 3,
        name: 'テーブル3',
        capacity: 6,
        display_order: 3,
        is_active: true
      }
    ].filter(seat => seat.capacity >= requiredPeople);
    
    // 最適な席を推奨（人数に最も近い席）
    let recommendedSeat = null;
    if (availableSeats.length > 0) {
      recommendedSeat = availableSeats.reduce((best, seat) => {
        const bestDiff = Math.abs(best.capacity - requiredPeople);
        const seatDiff = Math.abs(seat.capacity - requiredPeople);
        return seatDiff < bestDiff ? seat : best;
      }, availableSeats[0]);
    }
    
    return res.status(200).json({
      success: true,
      available: availableSeats.length > 0,
      availableSeats: availableSeats,
      recommendedSeat,
      occupiedSeats: 0,
      message: 'Using fallback seat availability (database not connected)'
    });
    
  } catch (error) {
    console.error('Check availability error:', error);
    return res.status(500).json({
      error: 'サーバーエラーが発生しました',
      details: error.message
    });
  }
}