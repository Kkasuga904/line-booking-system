import { createClient } from '@supabase/supabase-js';

// Supabase初期化
const SUPABASE_URL = 'https://faenvzzeguvlconvrqgp.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZhZW52enplZ3V2bGNvbnZycWdwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTYxNzQyOTgsImV4cCI6MjA3MTc1MDI5OH0.U_v82IYSDM3waCFfFr4e7MpbTQmZFRPCNaA-2u5R3d8';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// カレンダーからの予約を保存するAPI
export default async function handler(req, res) {
    // CORS設定
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    // OPTIONS（プリフライト）リクエスト対応
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    
    // POSTのみ受け付け
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }
    
    try {
        const {
            store_id,
            user_id,
            customer_name,
            date,
            time,
            people,
            message,
            status
        } = req.body;
        
        // 必須パラメータチェック
        if (!date || !time) {
            return res.status(400).json({ 
                error: '日付と時間は必須です' 
            });
        }
        
        // データベースに保存
        const { data: reservation, error } = await supabase
            .from('reservations')
            .insert([{
                store_id: (store_id || process.env.STORE_ID || 'default').trim(),
                user_id: user_id || 'liff-user',
                customer_name: customer_name || 'ゲスト',
                message: message || `カレンダー予約: ${date} ${time}`,
                people: people || 2,
                date: date,
                time: time,
                status: status || 'pending',
                created_at: new Date().toISOString()
            }])
            .select()
            .single();
        
        if (error) {
            console.error('Database error:', error);
            return res.status(500).json({ 
                error: '予約の保存に失敗しました',
                details: error.message 
            });
        }
        
        // 成功レスポンス
        return res.status(200).json({
            success: true,
            reservation: reservation,
            message: '予約が正常に保存されました'
        });
        
    } catch (error) {
        console.error('Server error:', error);
        return res.status(500).json({ 
            error: 'サーバーエラーが発生しました',
            details: error.message
        });
    }
}