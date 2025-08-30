import { createClient } from '@supabase/supabase-js';

// Supabaseクライアントの遅延初期化
let supabase = null;

function getSupabaseClient() {
    if (!supabase) {
        supabase = createClient(
            process.env.SUPABASE_URL,
            process.env.SUPABASE_ANON_KEY
        );
    }
    return supabase;
}

/**
 * 顧客情報取得API
 */
export async function getCustomerInfo(req, res) {
    try {
        const { line_user_id } = req.query;
        
        if (!line_user_id) {
            return res.status(400).json({
                error: 'line_user_id is required'
            });
        }
        
        // 顧客情報を取得
        const { data, error } = await getSupabaseClient().rpc('get_customer_info', {
            _line_user_id: line_user_id
        });
        
        if (error) {
            console.error('Customer info error:', error);
            return res.status(500).json({
                error: 'Failed to fetch customer info'
            });
        }
        
        return res.json(data);
        
    } catch (error) {
        console.error('Customer API error:', error);
        return res.status(500).json({
            error: 'Internal server error'
        });
    }
}

/**
 * 顧客情報付き予約作成API
 */
export async function createReservationWithCustomer(req, res) {
    try {
        const {
            store_id,
            date,
            time,
            people,
            user_id,
            customer_name,
            customer_phone,
            customer_email,
            message,
            seat_number
        } = req.body;
        
        // 必須フィールドチェック
        if (!store_id || !date || !time || !people || !user_id || !customer_name || !customer_phone) {
            return res.status(400).json({
                success: false,
                message: '必須項目が不足しています'
            });
        }
        
        // 電話番号フォーマットチェック
        if (!/^[0-9\-\+]+$/.test(customer_phone)) {
            return res.status(400).json({
                success: false,
                message: '電話番号の形式が正しくありません'
            });
        }
        
        // 予約作成（顧客情報含む）
        const { data, error } = await getSupabaseClient().rpc('create_reservation_with_customer', {
            _store_id: store_id,
            _date: date,
            _time: time,
            _party_size: parseInt(people),
            _user_id: user_id,
            _customer_name: customer_name,
            _customer_phone: customer_phone,
            _customer_email: customer_email || null,
            _seat_number: seat_number || null
        });
        
        if (error) {
            console.error('Reservation creation error:', error);
            return res.status(500).json({
                success: false,
                message: error.message || '予約の作成に失敗しました'
            });
        }
        
        // メッセージがある場合は別途保存
        if (message && data.reservation_id) {
            await getSupabaseClient()
                .from('reservations')
                .update({ message: message })
                .eq('id', data.reservation_id);
        }
        
        return res.json(data);
        
    } catch (error) {
        console.error('Reservation API error:', error);
        return res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
}

/**
 * 座席割り当てAPI
 */
export async function assignSeat(req, res) {
    try {
        const { reservation_id, seat_number, assigned_by } = req.body;
        
        if (!reservation_id || !seat_number) {
            return res.status(400).json({
                success: false,
                message: '予約IDと座席番号が必要です'
            });
        }
        
        const { data, error } = await getSupabaseClient().rpc('assign_seat', {
            _reservation_id: reservation_id,
            _seat_number: seat_number,
            _assigned_by: assigned_by || 'system'
        });
        
        if (error) {
            console.error('Seat assignment error:', error);
            return res.status(500).json({
                success: false,
                message: error.message || '座席の割り当てに失敗しました'
            });
        }
        
        return res.json(data);
        
    } catch (error) {
        console.error('Seat assignment API error:', error);
        return res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
}

/**
 * 座席割り当て解除API
 */
export async function unassignSeat(req, res) {
    try {
        const { reservation_id } = req.body;
        
        if (!reservation_id) {
            return res.status(400).json({
                success: false,
                message: '予約IDが必要です'
            });
        }
        
        // 座席割り当てを解除
        const { error } = await getSupabaseClient()
            .from('reservations')
            .update({
                seat_number: null,
                seat_assigned_at: null,
                seat_assigned_by: null
            })
            .eq('id', reservation_id);
        
        if (error) {
            console.error('Seat unassignment error:', error);
            return res.status(500).json({
                success: false,
                message: '座席の解除に失敗しました'
            });
        }
        
        // 履歴を更新
        await getSupabaseClient()
            .from('seat_assignments')
            .update({
                unassigned_at: new Date().toISOString(),
                unassigned_by: 'admin'
            })
            .eq('reservation_id', reservation_id)
            .is('unassigned_at', null);
        
        return res.json({
            success: true,
            message: '座席の割り当てを解除しました'
        });
        
    } catch (error) {
        console.error('Seat unassignment API error:', error);
        return res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
}

/**
 * 座席状況取得API
 */
export async function getSeatAvailability(req, res) {
    try {
        const { store_id, date, time } = req.query;
        
        if (!store_id || !date || !time) {
            return res.status(400).json({
                error: 'store_id, date, and time are required'
            });
        }
        
        const { data, error } = await getSupabaseClient().rpc('get_seat_availability', {
            _store_id: store_id,
            _date: date,
            _time: time
        });
        
        if (error) {
            console.error('Seat availability error:', error);
            return res.status(500).json({
                error: 'Failed to fetch seat availability'
            });
        }
        
        return res.json(data);
        
    } catch (error) {
        console.error('Seat availability API error:', error);
        return res.status(500).json({
            error: 'Internal server error'
        });
    }
}

/**
 * 予約一覧取得API（座席情報含む）
 */
export async function getReservationsWithSeats(req, res) {
    try {
        const { store_id, date } = req.query;
        
        if (!store_id || !date) {
            return res.status(400).json({
                error: 'store_id and date are required'
            });
        }
        
        // 予約一覧を取得
        const { data: reservations, error } = await getSupabaseClient()
            .from('reservations')
            .select(`
                *,
                customers (
                    name,
                    phone,
                    email,
                    visit_count
                )
            `)
            .eq('store_id', store_id)
            .eq('date', date)
            .in('status', ['confirmed', 'pending'])
            .order('time', { ascending: true });
        
        if (error) {
            console.error('Reservations fetch error:', error);
            return res.status(500).json({
                error: 'Failed to fetch reservations'
            });
        }
        
        // 座席情報を結合
        const enrichedReservations = reservations.map(r => ({
            ...r,
            customer_name: r.customer_name || r.customers?.name || 'ゲスト',
            customer_phone: r.customer_phone || r.customers?.phone || '',
            is_repeat_customer: r.customers?.visit_count > 1
        }));
        
        return res.json({
            success: true,
            reservations: enrichedReservations
        });
        
    } catch (error) {
        console.error('Reservations API error:', error);
        return res.status(500).json({
            error: 'Internal server error'
        });
    }
}