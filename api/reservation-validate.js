// 人数ベースの予約検証API
const express = require('express');
const router = express.Router();
const { createClient } = require('@supabase/supabase-js');

// Supabaseクライアント初期化
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

// 予約可能性チェック（人数ベース）
router.post('/validate', async (req, res) => {
  try {
    const { 
      store_id, 
      date, 
      time, 
      party_size,  // 予約人数
      is_group     // グループ予約かどうか
    } = req.body;

    if (!store_id || !date || !time || !party_size) {
      return res.status(400).json({ 
        error: '必須項目が不足しています',
        required: ['store_id', 'date', 'time', 'party_size']
      });
    }

    // 時間枠の容量情報を取得
    const { data: slot, error: slotError } = await supabase
      .from('time_slots_extended')
      .select('*')
      .eq('store_id', store_id)
      .eq('date', date)
      .eq('time', time)
      .single();

    if (slotError) {
      // 時間枠が存在しない場合は作成
      const newSlot = await createTimeSlot(store_id, date, time);
      if (!newSlot) {
        return res.status(500).json({ error: '時間枠の作成に失敗しました' });
      }
      return validateCapacity(newSlot, party_size, is_group, res);
    }

    return validateCapacity(slot, party_size, is_group, res);
  } catch (error) {
    console.error('予約検証エラー:', error);
    res.status(500).json({ error: error.message });
  }
});

// 予約作成（人数ベース）
router.post('/create', async (req, res) => {
  try {
    const {
      store_id,
      user_id,
      user_name,
      date,
      time,
      party_size,
      is_group,
      seats  // 互換性のため残す
    } = req.body;

    if (!store_id || !user_id || !date || !time) {
      return res.status(400).json({ error: '必須項目が不足しています' });
    }

    const actualPartySize = party_size || seats || 1;

    // 容量チェック
    const { data: slot, error: slotError } = await supabase
      .from('time_slots_extended')
      .select('*')
      .eq('store_id', store_id)
      .eq('date', date)
      .eq('time', time)
      .single();

    if (!slot) {
      return res.status(400).json({ error: '指定の時間枠が見つかりません' });
    }

    // 容量検証
    const validation = checkCapacity(slot, actualPartySize, is_group);
    if (!validation.available) {
      return res.status(400).json({ 
        error: validation.message,
        details: validation.details
      });
    }

    // トランザクション処理
    const { data: reservation, error: reservationError } = await supabase
      .from('reservations')
      .insert([{
        store_id,
        user_id,
        user_name,
        date,
        time,
        party_size: actualPartySize,
        is_group: is_group || false,
        seats: actualPartySize,  // 互換性のため
        status: 'confirmed'
      }])
      .select()
      .single();

    if (reservationError) throw reservationError;

    // 時間枠の予約済み人数を更新
    const updates = {
      people_reserved: slot.people_reserved + actualPartySize,
      updated_at: new Date().toISOString()
    };

    if (is_group) {
      updates.groups_reserved = slot.groups_reserved + 1;
    }

    const { error: updateError } = await supabase
      .from('time_slots_extended')
      .update(updates)
      .eq('store_id', store_id)
      .eq('date', date)
      .eq('time', time);

    if (updateError) {
      // ロールバック
      await supabase
        .from('reservations')
        .delete()
        .eq('id', reservation.id);
      
      throw updateError;
    }

    res.json({
      success: true,
      reservation_id: reservation.id,
      message: `${actualPartySize}名様の予約を承りました`,
      details: {
        date,
        time,
        party_size: actualPartySize,
        is_group
      }
    });
  } catch (error) {
    console.error('予約作成エラー:', error);
    res.status(500).json({ error: error.message });
  }
});

// 予約キャンセル（人数ベース）
router.post('/cancel', async (req, res) => {
  try {
    const { reservation_id, user_id } = req.body;

    if (!reservation_id || !user_id) {
      return res.status(400).json({ error: '予約IDとユーザーIDが必要です' });
    }

    // 予約情報取得
    const { data: reservation, error: fetchError } = await supabase
      .from('reservations')
      .select('*')
      .eq('id', reservation_id)
      .eq('user_id', user_id)
      .single();

    if (fetchError || !reservation) {
      return res.status(404).json({ error: '予約が見つかりません' });
    }

    if (reservation.status === 'cancelled') {
      return res.status(400).json({ error: 'すでにキャンセルされています' });
    }

    // 予約をキャンセル
    const { error: cancelError } = await supabase
      .from('reservations')
      .update({ 
        status: 'cancelled',
        updated_at: new Date().toISOString()
      })
      .eq('id', reservation_id);

    if (cancelError) throw cancelError;

    // 時間枠の予約済み人数を減らす
    const { data: slot } = await supabase
      .from('time_slots_extended')
      .select('*')
      .eq('store_id', reservation.store_id)
      .eq('date', reservation.date)
      .eq('time', reservation.time)
      .single();

    if (slot) {
      const updates = {
        people_reserved: Math.max(0, slot.people_reserved - (reservation.party_size || 1)),
        updated_at: new Date().toISOString()
      };

      if (reservation.is_group) {
        updates.groups_reserved = Math.max(0, slot.groups_reserved - 1);
      }

      await supabase
        .from('time_slots_extended')
        .update(updates)
        .eq('store_id', reservation.store_id)
        .eq('date', reservation.date)
        .eq('time', reservation.time);
    }

    res.json({
      success: true,
      message: '予約をキャンセルしました'
    });
  } catch (error) {
    console.error('予約キャンセルエラー:', error);
    res.status(500).json({ error: error.message });
  }
});

// ヘルパー関数：容量チェック
function checkCapacity(slot, party_size, is_group) {
  const peopleAvailable = slot.people_capacity - slot.people_reserved;
  const groupsAvailable = slot.groups_capacity - slot.groups_reserved;

  // 人数チェック
  if (party_size > peopleAvailable) {
    return {
      available: false,
      message: '予約可能人数を超えています',
      details: {
        requested: party_size,
        available: peopleAvailable,
        capacity: slot.people_capacity
      }
    };
  }

  // グループ数チェック
  if (is_group && groupsAvailable <= 0) {
    return {
      available: false,
      message: '予約可能な組数を超えています',
      details: {
        groups_available: groupsAvailable,
        groups_capacity: slot.groups_capacity
      }
    };
  }

  return {
    available: true,
    message: '予約可能です',
    details: {
      people_available: peopleAvailable,
      groups_available: groupsAvailable
    }
  };
}

// ヘルパー関数：容量検証レスポンス
function validateCapacity(slot, party_size, is_group, res) {
  const validation = checkCapacity(slot, party_size, is_group);
  
  if (validation.available) {
    return res.json({
      available: true,
      message: validation.message,
      capacity_info: validation.details
    });
  } else {
    return res.status(400).json({
      available: false,
      error: validation.message,
      capacity_info: validation.details
    });
  }
}

// ヘルパー関数：時間枠作成
async function createTimeSlot(store_id, date, time) {
  try {
    // デフォルト容量を取得または設定
    const defaultCapacity = {
      people: 20,
      groups: 5,
      seats: 20
    };

    const { data, error } = await supabase
      .from('time_slots_extended')
      .insert([{
        store_id,
        date,
        time,
        people_capacity: defaultCapacity.people,
        people_reserved: 0,
        groups_capacity: defaultCapacity.groups,
        groups_reserved: 0,
        seats_capacity: defaultCapacity.seats,
        seats_reserved: 0
      }])
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('時間枠作成エラー:', error);
    return null;
  }
}

module.exports = router;