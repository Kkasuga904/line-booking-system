// 容量テンプレート管理API
const express = require('express');
const router = express.Router();
const { createClient } = require('@supabase/supabase-js');

// Supabaseクライアント初期化
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

// テンプレート一覧取得
router.get('/templates', async (req, res) => {
  try {
    const { store_id } = req.query;
    
    if (!store_id) {
      return res.status(400).json({ error: '店舗IDが必要です' });
    }

    const { data, error } = await supabase
      .from('capacity_templates')
      .select('*')
      .eq('store_id', store_id)
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json(data || []);
  } catch (error) {
    console.error('テンプレート取得エラー:', error);
    res.status(500).json({ error: error.message });
  }
});

// テンプレート作成
router.post('/templates', async (req, res) => {
  try {
    const { 
      store_id, 
      template_name, 
      description, 
      capacity_type, 
      time_capacities, 
      default_capacity 
    } = req.body;

    if (!store_id || !template_name || !capacity_type || !time_capacities) {
      return res.status(400).json({ error: '必須項目が不足しています' });
    }

    const { data, error } = await supabase
      .from('capacity_templates')
      .insert([{
        store_id,
        template_name,
        description,
        capacity_type,
        time_capacities,
        default_capacity: default_capacity || 0
      }])
      .select()
      .single();

    if (error) throw error;
    res.json(data);
  } catch (error) {
    console.error('テンプレート作成エラー:', error);
    res.status(500).json({ error: error.message });
  }
});

// テンプレート更新
router.put('/templates/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const { data, error } = await supabase
      .from('capacity_templates')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    res.json(data);
  } catch (error) {
    console.error('テンプレート更新エラー:', error);
    res.status(500).json({ error: error.message });
  }
});

// テンプレート削除（論理削除）
router.delete('/templates/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const { error } = await supabase
      .from('capacity_templates')
      .update({ 
        is_active: false,
        updated_at: new Date().toISOString()
      })
      .eq('id', id);

    if (error) throw error;
    res.json({ message: 'テンプレートを削除しました' });
  } catch (error) {
    console.error('テンプレート削除エラー:', error);
    res.status(500).json({ error: error.message });
  }
});

// テンプレートを期間に適用
router.post('/templates/apply', async (req, res) => {
  try {
    const { 
      store_id, 
      template_id, 
      start_date, 
      end_date, 
      days_of_week,
      priority 
    } = req.body;

    if (!store_id || !template_id || !start_date || !end_date) {
      return res.status(400).json({ error: '必須項目が不足しています' });
    }

    // 容量ルール作成
    const { data: rule, error: ruleError } = await supabase
      .from('capacity_rules')
      .insert([{
        store_id,
        template_id,
        start_date,
        end_date,
        days_of_week,
        priority: priority || 0
      }])
      .select()
      .single();

    if (ruleError) throw ruleError;

    // テンプレート情報取得
    const { data: template, error: templateError } = await supabase
      .from('capacity_templates')
      .select('*')
      .eq('id', template_id)
      .single();

    if (templateError) throw templateError;

    // 指定期間の時間枠を生成・更新
    await applyTemplateToTimeSlots(
      store_id,
      template,
      start_date,
      end_date,
      days_of_week,
      rule.id
    );

    res.json({ 
      message: 'テンプレートを適用しました',
      rule_id: rule.id
    });
  } catch (error) {
    console.error('テンプレート適用エラー:', error);
    res.status(500).json({ error: error.message });
  }
});

// 日次例外設定
router.post('/exceptions', async (req, res) => {
  try {
    const {
      store_id,
      exception_date,
      exception_time,
      capacity_type,
      capacity,
      reason
    } = req.body;

    if (!store_id || !exception_date || !capacity_type || capacity === undefined) {
      return res.status(400).json({ error: '必須項目が不足しています' });
    }

    // 例外設定を作成
    const { data: exception, error: exceptionError } = await supabase
      .from('capacity_exceptions')
      .upsert([{
        store_id,
        exception_date,
        exception_time,
        capacity_type,
        capacity,
        reason
      }], {
        onConflict: 'store_id,exception_date,exception_time'
      })
      .select()
      .single();

    if (exceptionError) throw exceptionError;

    // 該当日の時間枠を更新
    await applyExceptionToTimeSlots(
      store_id,
      exception_date,
      exception_time,
      capacity_type,
      capacity,
      exception.id
    );

    res.json({
      message: '例外設定を作成しました',
      exception_id: exception.id
    });
  } catch (error) {
    console.error('例外設定エラー:', error);
    res.status(500).json({ error: error.message });
  }
});

// 容量状況取得（人数ベース）
router.get('/capacity/status', async (req, res) => {
  try {
    const { store_id, date, time } = req.query;

    if (!store_id || !date) {
      return res.status(400).json({ error: '店舗IDと日付が必要です' });
    }

    let query = supabase
      .from('time_slots_extended')
      .select('*')
      .eq('store_id', store_id)
      .eq('date', date);

    if (time) {
      query = query.eq('time', time);
    }

    const { data, error } = await query;

    if (error) throw error;

    // 各時間枠の空き状況を計算
    const capacityStatus = (data || []).map(slot => ({
      time: slot.time,
      people: {
        capacity: slot.people_capacity,
        reserved: slot.people_reserved,
        available: slot.people_capacity - slot.people_reserved
      },
      groups: {
        capacity: slot.groups_capacity,
        reserved: slot.groups_reserved,
        available: slot.groups_capacity - slot.groups_reserved
      },
      seats: {
        capacity: slot.seats_capacity,
        reserved: slot.seats_reserved,
        available: slot.seats_capacity - slot.seats_reserved
      }
    }));

    res.json(capacityStatus);
  } catch (error) {
    console.error('容量状況取得エラー:', error);
    res.status(500).json({ error: error.message });
  }
});

// ヘルパー関数：テンプレートを時間枠に適用
async function applyTemplateToTimeSlots(store_id, template, start_date, end_date, days_of_week, rule_id) {
  const startDate = new Date(start_date);
  const endDate = new Date(end_date);
  
  for (let date = new Date(startDate); date <= endDate; date.setDate(date.getDate() + 1)) {
    const dayOfWeek = date.getDay();
    
    // 曜日指定がある場合はチェック
    if (days_of_week && !days_of_week.includes(dayOfWeek)) {
      continue;
    }

    const dateStr = date.toISOString().split('T')[0];
    const time_capacities = template.time_capacities;

    // 各時間枠を更新
    for (const [time, capacity] of Object.entries(time_capacities)) {
      const capacityField = `${template.capacity_type}_capacity`;
      
      await supabase
        .from('time_slots_extended')
        .upsert([{
          store_id,
          date: dateStr,
          time,
          [capacityField]: capacity,
          applied_rule_id: rule_id,
          updated_at: new Date().toISOString()
        }], {
          onConflict: 'store_id,date,time'
        });
    }
  }
}

// ヘルパー関数：例外を時間枠に適用
async function applyExceptionToTimeSlots(store_id, exception_date, exception_time, capacity_type, capacity, exception_id) {
  const capacityField = `${capacity_type}_capacity`;
  
  if (exception_time) {
    // 特定時間のみ更新
    await supabase
      .from('time_slots_extended')
      .upsert([{
        store_id,
        date: exception_date,
        time: exception_time,
        [capacityField]: capacity,
        applied_exception_id: exception_id,
        updated_at: new Date().toISOString()
      }], {
        onConflict: 'store_id,date,time'
      });
  } else {
    // 終日更新
    const { data: slots } = await supabase
      .from('time_slots_extended')
      .select('time')
      .eq('store_id', store_id)
      .eq('date', exception_date);

    for (const slot of (slots || [])) {
      await supabase
        .from('time_slots_extended')
        .update({
          [capacityField]: capacity,
          applied_exception_id: exception_id,
          updated_at: new Date().toISOString()
        })
        .eq('store_id', store_id)
        .eq('date', exception_date)
        .eq('time', slot.time);
    }
  }
}

module.exports = router;