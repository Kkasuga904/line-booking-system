import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { createClient } from '@supabase/supabase-js';

// テスト用Supabaseクライアント
const supabase = createClient(
  process.env.SUPABASE_URL || 'https://faenvzzeguvlconvrqgp.supabase.co',
  process.env.SUPABASE_ANON_KEY || 'test-key'
);

describe('容量制限機能テスト', () => {
  const testStoreId = 'test-store';
  const testDate = new Date().toISOString().split('T')[0];
  const testTime = '18:00';
  
  beforeEach(async () => {
    // テストデータのクリーンアップ
    await supabase
      .from('reservations')
      .delete()
      .eq('store_id', testStoreId)
      .eq('date', testDate);
      
    // テスト用容量ルール設定
    await supabase
      .from('capacity_control_rules')
      .upsert({
        store_id: testStoreId,
        max_groups: 2,
        max_people: 4,
        max_per_group: 2,
        is_active: true,
        date_mode: 'all'
      });
  });
  
  afterEach(async () => {
    // テストデータのクリーンアップ
    await supabase
      .from('reservations')
      .delete()
      .eq('store_id', testStoreId);
  });

  describe('予約作成時の容量チェック', () => {
    it('容量内の予約は成功する', async () => {
      const { data, error } = await supabase.rpc('check_and_create_reservation', {
        _store_id: testStoreId,
        _date: testDate,
        _time: testTime,
        _party_size: 2,
        _user_id: 'test-user-1'
      });
      
      expect(error).toBeNull();
      expect(data).toHaveProperty('success', true);
      expect(data).toHaveProperty('reservation_id');
    });
    
    it('最大組数を超える予約は拒否される', async () => {
      // 2組まで予約
      await supabase.rpc('check_and_create_reservation', {
        _store_id: testStoreId,
        _date: testDate,
        _time: testTime,
        _party_size: 2,
        _user_id: 'test-user-1'
      });
      
      await supabase.rpc('check_and_create_reservation', {
        _store_id: testStoreId,
        _date: testDate,
        _time: testTime,
        _party_size: 2,
        _user_id: 'test-user-2'
      });
      
      // 3組目は拒否されるべき
      const { data, error } = await supabase.rpc('check_and_create_reservation', {
        _store_id: testStoreId,
        _date: testDate,
        _time: testTime,
        _party_size: 1,
        _user_id: 'test-user-3'
      });
      
      expect(data).toHaveProperty('success', false);
      expect(data).toHaveProperty('message');
      expect(data.message).toContain('満席');
    });
    
    it('最大人数を超える予約は拒否される', async () => {
      // 5人の予約（最大4人）
      const { data, error } = await supabase.rpc('check_and_create_reservation', {
        _store_id: testStoreId,
        _date: testDate,
        _time: testTime,
        _party_size: 5,
        _user_id: 'test-user-1'
      });
      
      expect(data).toHaveProperty('success', false);
      expect(data).toHaveProperty('message');
    });
  });

  describe('容量状態取得API', () => {
    it('正しい容量状態を返す', async () => {
      // 1組予約を作成
      await supabase.rpc('check_and_create_reservation', {
        _store_id: testStoreId,
        _date: testDate,
        _time: testTime,
        _party_size: 2,
        _user_id: 'test-user-1'
      });
      
      // 容量状態を取得
      const { data, error } = await supabase.rpc('get_capacity_status', {
        _store_id: testStoreId,
        _date: testDate
      });
      
      expect(error).toBeNull();
      expect(Array.isArray(data)).toBe(true);
      
      const slot = data.find(s => s.time === testTime);
      expect(slot).toBeDefined();
      expect(slot.current_groups).toBe(1);
      expect(slot.current_people).toBe(2);
      expect(slot.status).toBe('limited'); // 50%使用
    });
    
    it('満席状態を正しく判定する', async () => {
      // 最大まで予約
      await supabase.rpc('check_and_create_reservation', {
        _store_id: testStoreId,
        _date: testDate,
        _time: testTime,
        _party_size: 2,
        _user_id: 'test-user-1'
      });
      
      await supabase.rpc('check_and_create_reservation', {
        _store_id: testStoreId,
        _date: testDate,
        _time: testTime,
        _party_size: 2,
        _user_id: 'test-user-2'
      });
      
      const { data } = await supabase.rpc('get_capacity_status', {
        _store_id: testStoreId,
        _date: testDate
      });
      
      const slot = data.find(s => s.time === testTime);
      expect(slot.status).toBe('full');
      expect(slot.remaining_capacity).toBe(0);
    });
  });

  describe('同時実行制御', () => {
    it('アドバイザリーロックが機能する', async () => {
      // 並行して同じ時間枠に予約を試みる
      const promises = [];
      for (let i = 0; i < 5; i++) {
        promises.push(
          supabase.rpc('check_and_create_reservation', {
            _store_id: testStoreId,
            _date: testDate,
            _time: testTime,
            _party_size: 1,
            _user_id: `test-user-${i}`
          })
        );
      }
      
      const results = await Promise.all(promises);
      
      // 成功した予約をカウント
      const successful = results.filter(r => r.data?.success === true).length;
      
      // 最大2組なので、2つまでしか成功しないはず
      expect(successful).toBeLessThanOrEqual(2);
      
      // 実際の予約数を確認
      const { count } = await supabase
        .from('reservations')
        .select('*', { count: 'exact', head: true })
        .eq('store_id', testStoreId)
        .eq('date', testDate)
        .eq('time', testTime);
      
      expect(count).toBeLessThanOrEqual(2);
    });
  });
});

describe('エラーハンドリング', () => {
  it('不正なパラメータを拒否する', async () => {
    const { data, error } = await supabase.rpc('check_and_create_reservation', {
      _store_id: null,
      _date: 'invalid-date',
      _time: '25:00',
      _party_size: -1,
      _user_id: ''
    });
    
    expect(error).toBeDefined();
  });
  
  it('過去の日付を拒否する', async () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    
    const { data } = await supabase.rpc('check_and_create_reservation', {
      _store_id: 'test-store',
      _date: yesterday.toISOString().split('T')[0],
      _time: '18:00',
      _party_size: 2,
      _user_id: 'test-user'
    });
    
    expect(data).toHaveProperty('success', false);
  });
});