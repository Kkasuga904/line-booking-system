/**
 * 📊 ビジネス分析・レポートAPI
 * 
 * 店舗オーナー向けの詳細な分析データを提供
 * 売上向上に直結する実用的なインサイトを生成
 */

import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  // CORS設定
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  const { type = 'summary', period = '7days', store_id } = req.query;
  
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY
  );
  
  const storeId = store_id || process.env.STORE_ID || '***REMOVED-ROTATE-CREDENTIAL***';
  
  try {
    // 期間の計算
    const now = new Date();
    let startDate = new Date();
    
    switch(period) {
      case '7days':
        startDate.setDate(now.getDate() - 7);
        break;
      case '30days':
        startDate.setDate(now.getDate() - 30);
        break;
      case 'month':
        startDate.setMonth(now.getMonth() - 1);
        break;
      default:
        startDate.setDate(now.getDate() - 7);
    }
    
    // 基本的な予約データ取得
    const { data: reservations } = await supabase
      .from('reservations')
      .select('*')
      .eq('store_id', storeId)
      .gte('created_at', startDate.toISOString());
    
    const analytics = {
      period: {
        from: startDate.toISOString(),
        to: now.toISOString()
      },
      summary: {},
      trends: {},
      insights: []
    };
    
    if (type === 'summary' || type === 'full') {
      // 予約サマリー
      const totalReservations = reservations?.length || 0;
      const confirmedReservations = reservations?.filter(r => r.status === 'confirmed').length || 0;
      const canceledReservations = reservations?.filter(r => r.status === 'canceled').length || 0;
      const completedReservations = reservations?.filter(r => r.status === 'completed').length || 0;
      
      analytics.summary = {
        total: totalReservations,
        confirmed: confirmedReservations,
        canceled: canceledReservations,
        completed: completedReservations,
        cancellation_rate: totalReservations > 0 
          ? Math.round((canceledReservations / totalReservations) * 100) 
          : 0,
        completion_rate: confirmedReservations > 0
          ? Math.round((completedReservations / confirmedReservations) * 100)
          : 0
      };
      
      // 人数統計
      const totalPeople = reservations?.reduce((sum, r) => sum + (r.people || 0), 0) || 0;
      analytics.summary.total_customers = totalPeople;
      analytics.summary.avg_party_size = totalReservations > 0
        ? Math.round(totalPeople / totalReservations * 10) / 10
        : 0;
    }
    
    if (type === 'trends' || type === 'full') {
      // 曜日別傾向
      const dayOfWeek = ['日', '月', '火', '水', '木', '金', '土'];
      const dayStats = {};
      
      reservations?.forEach(r => {
        const date = new Date(r.date);
        const day = dayOfWeek[date.getDay()];
        if (!dayStats[day]) {
          dayStats[day] = { count: 0, people: 0 };
        }
        dayStats[day].count++;
        dayStats[day].people += r.people || 0;
      });
      
      analytics.trends.by_day_of_week = dayStats;
      
      // 時間帯別傾向
      const timeStats = {};
      reservations?.forEach(r => {
        const hour = parseInt(r.time?.split(':')[0] || '0');
        const timeSlot = `${hour}:00`;
        if (!timeStats[timeSlot]) {
          timeStats[timeSlot] = { count: 0, people: 0 };
        }
        timeStats[timeSlot].count++;
        timeStats[timeSlot].people += r.people || 0;
      });
      
      analytics.trends.by_time = timeStats;
      
      // 日別推移
      const dailyStats = {};
      reservations?.forEach(r => {
        const date = r.date.split('T')[0];
        if (!dailyStats[date]) {
          dailyStats[date] = { count: 0, people: 0, canceled: 0 };
        }
        dailyStats[date].count++;
        dailyStats[date].people += r.people || 0;
        if (r.status === 'canceled') {
          dailyStats[date].canceled++;
        }
      });
      
      analytics.trends.daily = dailyStats;
    }
    
    if (type === 'insights' || type === 'full') {
      // ビジネスインサイト生成
      const insights = [];
      
      // キャンセル率が高い場合の警告
      if (analytics.summary?.cancellation_rate > 20) {
        insights.push({
          type: 'warning',
          title: 'キャンセル率が高い',
          message: `キャンセル率が${analytics.summary.cancellation_rate}%と高めです。予約確認の連絡を強化することをお勧めします。`,
          priority: 'high'
        });
      }
      
      // 人気の曜日
      if (analytics.trends?.by_day_of_week) {
        const sortedDays = Object.entries(analytics.trends.by_day_of_week)
          .sort((a, b) => b[1].count - a[1].count);
        
        if (sortedDays.length > 0) {
          insights.push({
            type: 'info',
            title: '予約が多い曜日',
            message: `${sortedDays[0][0]}曜日が最も予約が多く、${sortedDays[0][1].count}件の予約があります。`,
            priority: 'medium'
          });
        }
      }
      
      // ピークタイム
      if (analytics.trends?.by_time) {
        const sortedTimes = Object.entries(analytics.trends.by_time)
          .sort((a, b) => b[1].count - a[1].count);
        
        if (sortedTimes.length > 0) {
          insights.push({
            type: 'info',
            title: 'ピークタイム',
            message: `${sortedTimes[0][0]}が最も予約が多い時間帯です。スタッフ配置の参考にしてください。`,
            priority: 'medium'
          });
        }
      }
      
      // 平均パーティーサイズによる提案
      if (analytics.summary?.avg_party_size > 3) {
        insights.push({
          type: 'suggestion',
          title: 'グループ予約が多い',
          message: `平均${analytics.summary.avg_party_size}名での予約が多いです。グループ向けのコースメニューを検討してはいかがでしょうか。`,
          priority: 'low'
        });
      }
      
      analytics.insights = insights;
    }
    
    // 売上予測（仮想計算）
    if (type === 'revenue' || type === 'full') {
      const avgSpendPerPerson = 3000; // 仮の客単価
      const totalReservations = analytics.summary?.total_reservations || 0;
      const estimatedRevenue = (analytics.summary?.total_customers || 0) * avgSpendPerPerson;
      
      analytics.revenue = {
        estimated_total: estimatedRevenue,
        avg_per_reservation: totalReservations > 0 
          ? Math.round(estimatedRevenue / totalReservations)
          : 0,
        currency: 'JPY',
        note: '客単価3,000円で計算した推定値'
      };
    }
    
    return res.status(200).json({
      success: true,
      store_id: storeId,
      generated_at: now.toISOString(),
      analytics
    });
    
  } catch (error) {
    console.error('Analytics error:', error);
    return res.status(500).json({ 
      error: 'Analytics generation failed',
      message: error.message 
    });
  }
}