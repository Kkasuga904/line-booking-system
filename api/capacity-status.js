import { createClient } from '@supabase/supabase-js';

// Supabase クライアントの遅延初期化
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

// 容量状態を取得するAPI
export async function getCapacityStatus(req, res) {
  try {
    const { store_id, date } = req.query;

    if (!store_id || !date) {
      return res.status(400).json({ 
        error: 'store_idとdateは必須です' 
      });
    }

    // 容量状態を取得（新しいRPC関数を使用）
    const { data: capacityStatus, error } = await getSupabaseClient().rpc('get_capacity_status', {
      _store_id: store_id,
      _date: date,
      _start_time: '18:00',  // 営業開始時間
      _end_time: '21:00'      // 営業終了時間
    });

    if (error) {
      console.error('Capacity status error:', error);
      // フォールバック：基本的な予約状況を返す
      return getBasicCapacityStatus(store_id, date, res);
    }

    // UIで使いやすい形式に変換
    const formattedStatus = capacityStatus.map(slot => {
      // timeフィールド名の修正（slot_timeまたはtime）
      const timeValue = slot.slot_time || slot.time;
      return {
        time: timeValue,
        status: slot.status,  // 'available', 'limited', 'full'
        currentGroups: slot.current_groups,
        currentPeople: slot.current_people,
        maxGroups: slot.max_groups,
        maxPeople: slot.max_people,
        maxPerGroup: slot.max_per_group,
        remainingCapacity: slot.remaining_capacity,
        displayClass: getDisplayClass(slot),
        message: getStatusMessage(slot),
        selectable: slot.status !== 'full'
      };
    });

    return res.json({
      success: true,
      date: date,
      slots: formattedStatus
    });

  } catch (error) {
    console.error('Capacity status error:', error);
    res.status(500).json({ 
      error: 'システムエラー',
      message: 'しばらくしてからお試しください'
    });
  }
}

// 基本的な容量状態を取得（フォールバック）
async function getBasicCapacityStatus(store_id, date, res) {
  try {
    // 現在の予約を取得
    const { data: reservations, error } = await getSupabaseClient()
      .from('reservations')
      .select('time, people')
      .eq('store_id', store_id)
      .eq('date', date)
      .in('status', ['confirmed', 'pending']);

    if (error) throw error;

    // 容量ルールを取得
    const { data: rules } = await getSupabaseClient()
      .from('capacity_control_rules')
      .select('*')
      .eq('store_id', store_id)
      .eq('is_active', true)
      .or(`date_mode.eq.single,date.eq.${date}`)
      .single();

    // 時間枠ごとの状態を計算
    const timeSlots = [
      '18:00', '18:30', '19:00', '19:30', '20:00', '20:30', '21:00'
    ];

    const slots = timeSlots.map(time => {
      const slotReservations = reservations.filter(r => r.time === time || r.time === `${time}:00`);
      const groups = slotReservations.length;
      const people = slotReservations.reduce((sum, r) => sum + r.people, 0);
      
      const maxGroups = rules?.max_groups || 10;
      const maxPeople = rules?.max_people || 30;
      
      let status = 'available';
      if (groups >= maxGroups || people >= maxPeople) {
        status = 'full';
      } else if (groups >= maxGroups * 0.8 || people >= maxPeople * 0.8) {
        status = 'limited';
      }

      return {
        time: time,
        status: status,
        currentGroups: groups,
        currentPeople: people,
        maxGroups: maxGroups,
        maxPeople: maxPeople,
        remainingCapacity: Math.max(0, Math.min(maxGroups - groups, maxPeople - people)),
        displayClass: getDisplayClass({ status }),
        message: getStatusMessage({ status, current_groups: groups, max_groups: maxGroups }),
        selectable: status !== 'full'
      };
    });

    return res.json({
      success: true,
      date: date,
      slots: slots
    });

  } catch (error) {
    console.error('Basic capacity status error:', error);
    return res.status(500).json({ 
      error: 'システムエラー' 
    });
  }
}

// 表示用のCSSクラスを決定
function getDisplayClass(slot) {
  switch(slot.status) {
    case 'full':
      return 'slot-full';      // グレー（選択不可）
    case 'limited':
      return 'slot-limited';    // 黄色（残りわずか）
    case 'available':
      return 'slot-available';  // 緑（予約可能）
    default:
      return 'slot-available';
  }
}

// ステータスメッセージを生成
function getStatusMessage(slot) {
  if (slot.status === 'full') {
    return '満席';
  } else if (slot.status === 'limited') {
    if (slot.max_groups && slot.current_groups >= slot.max_groups - 1) {
      return `残り${slot.max_groups - slot.current_groups}組`;
    } else if (slot.max_people && slot.current_people >= slot.max_people * 0.8) {
      return `残り${slot.max_people - slot.current_people}名`;
    }
    return '残りわずか';
  }
  return '予約可能';
}