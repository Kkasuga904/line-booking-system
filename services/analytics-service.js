// 顧客分析サービス
// 予約パターン分析で売上向上施策を提案

class AnalyticsService {
  constructor(supabase) {
    this.supabase = supabase;
  }

  // 包括的な分析レポート生成
  async generateReport(storeId, period = 30) {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - period);

    const report = {
      period: {
        start: startDate.toISOString().split('T')[0],
        end: endDate.toISOString().split('T')[0],
        days: period
      },
      metrics: {},
      insights: [],
      recommendations: []
    };

    // 1. 基本メトリクス
    report.metrics.basic = await this.getBasicMetrics(storeId, startDate, endDate);
    
    // 2. 時間帯分析
    report.metrics.timeAnalysis = await this.getTimeAnalysis(storeId, startDate, endDate);
    
    // 3. 顧客分析
    report.metrics.customerAnalysis = await this.getCustomerAnalysis(storeId, startDate, endDate);
    
    // 4. キャンセル分析
    report.metrics.cancellationAnalysis = await this.getCancellationAnalysis(storeId, startDate, endDate);
    
    // 5. 曜日別分析
    report.metrics.dayOfWeekAnalysis = await this.getDayOfWeekAnalysis(storeId, startDate, endDate);

    // インサイト生成
    report.insights = this.generateInsights(report.metrics);
    
    // レコメンデーション生成
    report.recommendations = this.generateRecommendations(report.metrics);

    return report;
  }

  // 基本メトリクス
  async getBasicMetrics(storeId, startDate, endDate) {
    const { data: reservations } = await this.supabase
      .from('reservations')
      .select('*')
      .eq('store_id', storeId)
      .gte('date', startDate.toISOString().split('T')[0])
      .lte('date', endDate.toISOString().split('T')[0]);

    const confirmed = reservations?.filter(r => r.status === 'confirmed') || [];
    const cancelled = reservations?.filter(r => r.status === 'cancelled') || [];

    return {
      totalReservations: reservations?.length || 0,
      confirmedReservations: confirmed.length,
      cancelledReservations: cancelled.length,
      cancellationRate: reservations?.length > 0 ? 
        ((cancelled.length / reservations.length) * 100).toFixed(2) + '%' : '0%',
      avgPeoplePerReservation: confirmed.length > 0 ?
        (confirmed.reduce((sum, r) => sum + (r.people || 1), 0) / confirmed.length).toFixed(1) : 0,
      estimatedRevenue: confirmed.reduce((sum, r) => sum + ((r.people || 1) * 3500), 0)
    };
  }

  // 時間帯分析
  async getTimeAnalysis(storeId, startDate, endDate) {
    const { data: reservations } = await this.supabase
      .from('reservations')
      .select('time')
      .eq('store_id', storeId)
      .eq('status', 'confirmed')
      .gte('date', startDate.toISOString().split('T')[0])
      .lte('date', endDate.toISOString().split('T')[0]);

    const timeSlots = {};
    const peakHours = {
      lunch: 0,    // 11:00-14:00
      afternoon: 0, // 14:00-17:00
      dinner: 0,   // 17:00-21:00
      late: 0      // 21:00-
    };

    reservations?.forEach(r => {
      const hour = parseInt(r.time.split(':')[0]);
      timeSlots[r.time] = (timeSlots[r.time] || 0) + 1;
      
      if (hour >= 11 && hour < 14) peakHours.lunch++;
      else if (hour >= 14 && hour < 17) peakHours.afternoon++;
      else if (hour >= 17 && hour < 21) peakHours.dinner++;
      else peakHours.late++;
    });

    // 最も人気の時間帯
    const popularTimes = Object.entries(timeSlots)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([time, count]) => ({ time, count }));

    return {
      popularTimes,
      peakHours,
      utilizationRate: this.calculateUtilization(timeSlots)
    };
  }

  // 顧客分析
  async getCustomerAnalysis(storeId, startDate, endDate) {
    const { data: reservations } = await this.supabase
      .from('reservations')
      .select('user_id, customer_name, name, phone')
      .eq('store_id', storeId)
      .eq('status', 'confirmed')
      .gte('date', startDate.toISOString().split('T')[0])
      .lte('date', endDate.toISOString().split('T')[0]);

    // リピーター分析
    const customerMap = {};
    reservations?.forEach(r => {
      const key = r.user_id || r.phone;
      if (key) {
        customerMap[key] = (customerMap[key] || 0) + 1;
      }
    });

    const repeatCustomers = Object.values(customerMap).filter(count => count > 1).length;
    const totalCustomers = Object.keys(customerMap).length;

    // 言語分析（国際化対応の効果測定）
    const languages = { ja: 0, en: 0, ko: 0, zh: 0 };
    reservations?.forEach(r => {
      const name = r.customer_name || r.name || '';
      if (/[A-Za-z]{3,}/.test(name) && !/[ぁ-ん]/.test(name)) languages.en++;
      else if (/[가-힣]/.test(name)) languages.ko++;
      else if (/[\u4e00-\u9fff]/.test(name) && !/[ぁ-ん]/.test(name)) languages.zh++;
      else languages.ja++;
    });

    return {
      totalCustomers,
      repeatCustomers,
      repeatRate: totalCustomers > 0 ? 
        ((repeatCustomers / totalCustomers) * 100).toFixed(2) + '%' : '0%',
      newCustomers: totalCustomers - repeatCustomers,
      languageDistribution: languages,
      topCustomers: Object.entries(customerMap)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([id, count]) => ({ id: id.substring(0, 8) + '...', visits: count }))
    };
  }

  // キャンセル分析
  async getCancellationAnalysis(storeId, startDate, endDate) {
    const { data: cancellations } = await this.supabase
      .from('reservations')
      .select('*')
      .eq('store_id', storeId)
      .eq('status', 'cancelled')
      .gte('date', startDate.toISOString().split('T')[0])
      .lte('date', endDate.toISOString().split('T')[0]);

    // キャンセルタイミング分析
    const timingAnalysis = {
      sameDay: 0,
      dayBefore: 0,
      twoDaysBefore: 0,
      earlier: 0
    };

    cancellations?.forEach(c => {
      if (!c.cancelled_at) return;
      
      const cancelDate = new Date(c.cancelled_at);
      const reservationDate = new Date(c.date);
      const daysDiff = Math.floor((reservationDate - cancelDate) / (1000 * 60 * 60 * 24));
      
      if (daysDiff === 0) timingAnalysis.sameDay++;
      else if (daysDiff === 1) timingAnalysis.dayBefore++;
      else if (daysDiff === 2) timingAnalysis.twoDaysBefore++;
      else timingAnalysis.earlier++;
    });

    return {
      totalCancellations: cancellations?.length || 0,
      timingAnalysis,
      estimatedLoss: (cancellations?.length || 0) * 3500
    };
  }

  // 曜日別分析
  async getDayOfWeekAnalysis(storeId, startDate, endDate) {
    const { data: reservations } = await this.supabase
      .from('reservations')
      .select('date, people')
      .eq('store_id', storeId)
      .eq('status', 'confirmed')
      .gte('date', startDate.toISOString().split('T')[0])
      .lte('date', endDate.toISOString().split('T')[0]);

    const dayNames = ['日', '月', '火', '水', '木', '金', '土'];
    const dayStats = {};
    
    dayNames.forEach(day => {
      dayStats[day] = { count: 0, people: 0 };
    });

    reservations?.forEach(r => {
      const day = new Date(r.date).getDay();
      const dayName = dayNames[day];
      dayStats[dayName].count++;
      dayStats[dayName].people += (r.people || 1);
    });

    return dayStats;
  }

  // 稼働率計算
  calculateUtilization(timeSlots) {
    const totalSlots = 23 * 30; // 23スロット × 30日
    const usedSlots = Object.values(timeSlots).reduce((sum, count) => sum + count, 0);
    return ((usedSlots / totalSlots) * 100).toFixed(2) + '%';
  }

  // インサイト生成
  generateInsights(metrics) {
    const insights = [];

    // キャンセル率が高い
    const cancelRate = parseFloat(metrics.basic.cancellationRate);
    if (cancelRate > 20) {
      insights.push({
        type: 'warning',
        message: `キャンセル率が${cancelRate}%と高めです。リマインダー機能の活用を推奨します。`
      });
    }

    // ピークタイムの偏り
    const { dinner, lunch } = metrics.timeAnalysis.peakHours;
    if (dinner > lunch * 2) {
      insights.push({
        type: 'opportunity',
        message: 'ディナータイムに予約が集中しています。ランチタイム割引で集客可能性があります。'
      });
    }

    // リピート率
    const repeatRate = parseFloat(metrics.customerAnalysis.repeatRate);
    if (repeatRate < 30) {
      insights.push({
        type: 'improvement',
        message: `リピート率が${repeatRate}%です。常連客優遇プログラムの導入を検討してください。`
      });
    }

    // 多言語利用
    const { en, ko, zh } = metrics.customerAnalysis.languageDistribution;
    if (en + ko + zh > 10) {
      insights.push({
        type: 'success',
        message: '外国人客の利用が確認されています。多言語対応が効果を発揮しています。'
      });
    }

    return insights;
  }

  // レコメンデーション生成
  generateRecommendations(metrics) {
    const recommendations = [];

    // 稼働率向上
    const utilization = parseFloat(metrics.timeAnalysis.utilizationRate);
    if (utilization < 50) {
      recommendations.push({
        priority: 'high',
        action: '空き時間帯の特別プラン',
        detail: '14:00-17:00のアフタヌーンティープランなど、閑散時間帯の商品開発'
      });
    }

    // キャンセル対策
    if (metrics.cancellationAnalysis.timingAnalysis.sameDay > 5) {
      recommendations.push({
        priority: 'high',
        action: '当日キャンセル対策',
        detail: 'デポジット制度または前日確認連絡の自動化'
      });
    }

    // リピーター施策
    if (metrics.customerAnalysis.repeatCustomers > 0) {
      recommendations.push({
        priority: 'medium',
        action: 'リピーター優遇',
        detail: `${metrics.customerAnalysis.repeatCustomers}名のリピーターに特別クーポン配信`
      });
    }

    // 曜日別施策
    const weakestDay = Object.entries(metrics.dayOfWeekAnalysis)
      .sort((a, b) => a[1].count - b[1].count)[0];
    
    if (weakestDay[1].count < 5) {
      recommendations.push({
        priority: 'medium',
        action: `${weakestDay[0]}曜日の集客強化`,
        detail: `${weakestDay[0]}曜日限定の特別メニューや割引を検討`
      });
    }

    return recommendations;
  }
}

export default AnalyticsService;