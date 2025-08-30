/**
 * 予約制御ルールチェックAPI
 * 指定された日時・人数で予約可能かチェック
 */

export default async function handler(req, res) {
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
    const { date, time, people, store_id } = req.body;
    const storeId = store_id || process.env.STORE_ID || 'default-store';
    
    if (!date || !time) {
      return res.status(400).json({ 
        error: '日付と時間は必須です' 
      });
    }
    
    // LocalStorageから保存されたルールを取得（実際はDBから取得）
    const rules = await getCapacityRules(storeId, date, time);
    
    // 該当するルールをチェック
    let canBook = true;
    let reason = '';
    let availableCapacity = null;
    
    for (const rule of rules) {
      if (isRuleApplicable(rule, date, time)) {
        // 既存予約数を取得（実際はDBから）
        const currentBookings = await getCurrentBookings(storeId, date, time);
        
        // 組数制限チェック
        if (rule.maxGroups) {
          const currentGroups = currentBookings.length;
          if (currentGroups >= rule.maxGroups) {
            canBook = false;
            reason = `この時間帯は満席です（最大${rule.maxGroups}組）`;
            break;
          }
          availableCapacity = {
            maxGroups: rule.maxGroups,
            currentGroups: currentGroups,
            remainingGroups: rule.maxGroups - currentGroups
          };
        }
        
        // 人数制限チェック
        if (rule.maxPeople) {
          const currentPeople = currentBookings.reduce((sum, b) => sum + (b.people || 1), 0);
          const totalAfterBooking = currentPeople + (people || 1);
          
          if (totalAfterBooking > rule.maxPeople) {
            canBook = false;
            reason = `この時間帯は人数制限を超えています（最大${rule.maxPeople}人）`;
            break;
          }
          
          if (availableCapacity) {
            availableCapacity.maxPeople = rule.maxPeople;
            availableCapacity.currentPeople = currentPeople;
            availableCapacity.remainingPeople = rule.maxPeople - currentPeople;
          }
        }
        
        // 1組あたりの人数制限チェック
        if (rule.maxPerGroup && people > rule.maxPerGroup) {
          canBook = false;
          reason = `1組の最大人数は${rule.maxPerGroup}人までです`;
          break;
        }
      }
    }
    
    return res.status(200).json({
      success: true,
      canBook,
      reason,
      availableCapacity,
      appliedRules: rules.length,
      message: canBook ? '予約可能です' : reason
    });
    
  } catch (error) {
    console.error('Check capacity error:', error);
    return res.status(500).json({
      error: 'サーバーエラーが発生しました',
      details: error.message
    });
  }
}

// ルールが適用可能かチェック
function isRuleApplicable(rule, date, time) {
  // 日付チェック
  if (rule.dateMode === 'single' && rule.date !== date) {
    return false;
  }
  
  if (rule.dateMode === 'range') {
    if (date < rule.startDate || date > rule.endDate) {
      return false;
    }
  }
  
  if (rule.dateMode === 'weekly') {
    const dayOfWeek = new Date(date).getDay();
    if (dayOfWeek !== rule.weekday) {
      return false;
    }
  }
  
  // 時間チェック
  if (time < rule.startTime || time > rule.endTime) {
    return false;
  }
  
  return true;
}

// 予約制御ルールを取得（ダミー実装）
async function getCapacityRules(storeId, date, time) {
  // 実際はSupabaseから取得
  // ここではダミーデータを返す
  return [
    {
      id: 1,
      dateMode: 'single',
      date: date,
      startTime: '18:00',
      endTime: '21:00',
      maxGroups: 10,
      maxPeople: 40,
      maxPerGroup: 8,
      controlType: 'both'
    }
  ];
}

// 現在の予約を取得（ダミー実装）
async function getCurrentBookings(storeId, date, time) {
  // 実際はSupabaseから取得
  // ここではダミーデータを返す
  return [
    { id: 1, people: 4 },
    { id: 2, people: 2 },
    { id: 3, people: 3 }
  ];
}