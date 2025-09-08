import { createClient } from '@supabase/supabase-js';

// Supabase初期化
const SUPABASE_URL = 'https://faenvzzeguvlconvrqgp.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZhZW52enplZ3V2bGNvbnZycWdwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTYxNzQyOTgsImV4cCI6MjA3MTc1MDI5OH0.U_v82IYSDM3waCFfFr4e7MpbTQmZFRPCNaA-2u5R3d8';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// 予約済み時間枠を取得するAPI
export default async function handler(req, res) {
    // CORS設定
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }
    
    try {
        // クエリパラメータから店舗IDと日付範囲を取得
        const { store_id, start_date, end_date } = req.query;
        
        // デフォルト値設定
        const storeId = store_id || process.env.STORE_ID || 'default';
        const startDate = start_date || new Date().toISOString().split('T')[0];
        const endDate = end_date || new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]; // 60日後まで
        
        // 予約データを取得
        const { data: reservations, error } = await supabase
            .from('reservations')
            .select('date, time')
            .eq('store_id', storeId.trim())
            .gte('date', startDate)
            .lte('date', endDate)
            .neq('status', 'cancelled'); // キャンセルされた予約は除外
        
        if (error) {
            console.error('Database error:', error);
            return res.status(500).json({ 
                error: '予約情報の取得に失敗しました' 
            });
        }
        
        // ロックされた席を取得
        const { data: lockedSeats, error: seatsError } = await supabase
            .from('seats')
            .select('id, name, is_locked')
            .eq('store_id', storeId.trim())
            .eq('is_locked', true)
            .eq('is_active', true);
        
        if (seatsError) {
            console.error('Seats error:', seatsError);
            // エラーがあっても続行
        }
        
        // 日付ごとに時間をグループ化
        const bookedSlots = {};
        reservations.forEach(reservation => {
            if (!bookedSlots[reservation.date]) {
                bookedSlots[reservation.date] = [];
            }
            // 時間を HH:MM 形式に変換
            const time = reservation.time.substring(0, 5);
            if (!bookedSlots[reservation.date].includes(time)) {
                bookedSlots[reservation.date].push(time);
            }
        });
        
        // 各日付の予約済み時間をソート
        Object.keys(bookedSlots).forEach(date => {
            bookedSlots[date].sort();
        });
        
        return res.status(200).json({
            success: true,
            store_id: storeId,
            period: {
                start: startDate,
                end: endDate
            },
            booked: bookedSlots,
            locked_seats: lockedSeats || [],
            total_reservations: reservations.length
        });
        
    } catch (error) {
        console.error('Server error:', error);
        return res.status(500).json({ 
            error: 'サーバーエラーが発生しました' 
        });
    }
}