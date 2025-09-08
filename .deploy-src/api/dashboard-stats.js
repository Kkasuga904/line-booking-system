/**
 * ダッシュボード統計API
 * 店舗ごとの予約データを集計して返す
 */

const { createClient } = require('@supabase/supabase-js');

// Supabase初期化
const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY
);

/**
 * 店舗の統計データを取得
 * @param {string} storeId - 店舗ID
 * @param {string} period - 期間 (today, week, month, year)
 */
async function getStoreStats(storeId, period = 'week') {
    const now = new Date();
    let startDate, endDate;
    let previousStartDate, previousEndDate;
    
    // 期間の計算
    switch (period) {
        case 'today':
            startDate = new Date(now.setHours(0, 0, 0, 0));
            endDate = new Date(now.setHours(23, 59, 59, 999));
            previousStartDate = new Date(startDate);
            previousStartDate.setDate(previousStartDate.getDate() - 1);
            previousEndDate = new Date(previousStartDate);
            previousEndDate.setHours(23, 59, 59, 999);
            break;
        case 'week':
            const weekDay = now.getDay() || 7;
            startDate = new Date(now);
            startDate.setDate(now.getDate() - weekDay + 1);
            startDate.setHours(0, 0, 0, 0);
            endDate = new Date(startDate);
            endDate.setDate(endDate.getDate() + 6);
            endDate.setHours(23, 59, 59, 999);
            previousStartDate = new Date(startDate);
            previousStartDate.setDate(previousStartDate.getDate() - 7);
            previousEndDate = new Date(previousStartDate);
            previousEndDate.setDate(previousEndDate.getDate() + 6);
            previousEndDate.setHours(23, 59, 59, 999);
            break;
        case 'month':
            startDate = new Date(now.getFullYear(), now.getMonth(), 1);
            endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
            previousStartDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
            previousEndDate = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
            break;
        case 'year':
            startDate = new Date(now.getFullYear(), 0, 1);
            endDate = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);
            previousStartDate = new Date(now.getFullYear() - 1, 0, 1);
            previousEndDate = new Date(now.getFullYear() - 1, 11, 31, 23, 59, 59, 999);
            break;
        default:
            startDate = new Date(now.setHours(0, 0, 0, 0));
            endDate = new Date(now.setHours(23, 59, 59, 999));
    }

    try {
        // 現在期間の予約データ取得
        const { data: currentBookings, error: currentError } = await supabase
            .from('reservations')
            .select('*')
            .eq('store_id', storeId)
            .gte('booking_date', startDate.toISOString())
            .lte('booking_date', endDate.toISOString());

        if (currentError) throw currentError;

        // 前期間の予約データ取得
        const { data: previousBookings, error: previousError } = await supabase
            .from('reservations')
            .select('*')
            .eq('store_id', storeId)
            .gte('booking_date', previousStartDate.toISOString())
            .lte('booking_date', previousEndDate.toISOString());

        if (previousError) throw previousError;

        // 統計計算
        const stats = calculateStats(currentBookings || [], previousBookings || []);
        
        // 時系列データの取得
        const chartData = await getChartData(storeId, startDate, endDate, period);
        
        return {
            success: true,
            period,
            startDate: startDate.toISOString(),
            endDate: endDate.toISOString(),
            stats,
            charts: chartData
        };
    } catch (error) {
        console.error('Error fetching store stats:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

/**
 * 統計を計算
 */
function calculateStats(currentBookings, previousBookings) {
    // 総予約数
    const totalBookings = currentBookings.length;
    const previousTotalBookings = previousBookings.length;
    const bookingChange = previousTotalBookings > 0 
        ? ((totalBookings - previousTotalBookings) / previousTotalBookings * 100).toFixed(1)
        : 0;

    // 売上高（予約の人数 × 平均単価で仮計算）
    const avgPrice = 3500; // 平均単価（実際はDBから取得）
    const totalRevenue = currentBookings.reduce((sum, b) => sum + (b.people_count || 0) * avgPrice, 0);
    const previousRevenue = previousBookings.reduce((sum, b) => sum + (b.people_count || 0) * avgPrice, 0);
    const revenueChange = previousRevenue > 0
        ? ((totalRevenue - previousRevenue) / previousRevenue * 100).toFixed(1)
        : 0;

    // 平均客単価
    const avgOrderValue = totalBookings > 0 ? Math.round(totalRevenue / totalBookings) : 0;
    const previousAvgOrderValue = previousTotalBookings > 0 
        ? Math.round(previousRevenue / previousTotalBookings) 
        : 0;
    const avgOrderChange = previousAvgOrderValue > 0
        ? ((avgOrderValue - previousAvgOrderValue) / previousAvgOrderValue * 100).toFixed(1)
        : 0;

    // キャンセル率
    const cancelledBookings = currentBookings.filter(b => b.status === 'cancelled').length;
    const cancelRate = totalBookings > 0 
        ? (cancelledBookings / totalBookings * 100).toFixed(1)
        : 0;
    const previousCancelled = previousBookings.filter(b => b.status === 'cancelled').length;
    const previousCancelRate = previousTotalBookings > 0
        ? (previousCancelled / previousTotalBookings * 100).toFixed(1)
        : 0;
    const cancelRateChange = (previousCancelRate - cancelRate).toFixed(1); // 減少が改善

    return {
        totalBookings: {
            value: totalBookings,
            change: parseFloat(bookingChange),
            changeType: bookingChange >= 0 ? 'positive' : 'negative'
        },
        totalRevenue: {
            value: totalRevenue,
            formatted: `¥${totalRevenue.toLocaleString()}`,
            change: parseFloat(revenueChange),
            changeType: revenueChange >= 0 ? 'positive' : 'negative'
        },
        avgOrderValue: {
            value: avgOrderValue,
            formatted: `¥${avgOrderValue.toLocaleString()}`,
            change: parseFloat(avgOrderChange),
            changeType: avgOrderChange >= 0 ? 'positive' : 'negative'
        },
        cancelRate: {
            value: parseFloat(cancelRate),
            change: parseFloat(cancelRateChange),
            changeType: cancelRateChange >= 0 ? 'positive' : 'negative' // 減少が良い
        }
    };
}

/**
 * チャート用データを取得
 */
async function getChartData(storeId, startDate, endDate, period) {
    try {
        // 日別予約数
        const { data: bookings, error } = await supabase
            .from('reservations')
            .select('booking_date, booking_time, people_count, status')
            .eq('store_id', storeId)
            .gte('booking_date', startDate.toISOString())
            .lte('booking_date', endDate.toISOString())
            .order('booking_date');

        if (error) throw error;

        // 日別集計
        const dailyData = {};
        const hourlyData = {};
        
        (bookings || []).forEach(booking => {
            // 日付ごとの集計
            const date = booking.booking_date.split('T')[0];
            if (!dailyData[date]) {
                dailyData[date] = 0;
            }
            if (booking.status !== 'cancelled') {
                dailyData[date]++;
            }

            // 時間帯ごとの集計
            if (booking.booking_time && booking.status !== 'cancelled') {
                const hour = booking.booking_time.split(':')[0];
                if (!hourlyData[hour]) {
                    hourlyData[hour] = 0;
                }
                hourlyData[hour]++;
            }
        });

        // チャート用にフォーマット
        let labels = [];
        let data = [];

        if (period === 'week') {
            const days = ['月', '火', '水', '木', '金', '土', '日'];
            for (let i = 0; i < 7; i++) {
                const date = new Date(startDate);
                date.setDate(date.getDate() + i);
                const dateStr = date.toISOString().split('T')[0];
                labels.push(days[i]);
                data.push(dailyData[dateStr] || 0);
            }
        } else {
            // その他の期間は日付をラベルにする
            Object.keys(dailyData).sort().forEach(date => {
                labels.push(date.substring(5)); // MM-DD形式
                data.push(dailyData[date]);
            });
        }

        // 時間帯別データ
        const hourlyLabels = [];
        const hourlyValues = [];
        for (let hour = 10; hour <= 21; hour++) {
            const h = hour.toString().padStart(2, '0');
            hourlyLabels.push(`${h}:00`);
            hourlyValues.push(hourlyData[h] || 0);
        }

        return {
            daily: {
                labels,
                data
            },
            hourly: {
                labels: hourlyLabels,
                data: hourlyValues
            }
        };
    } catch (error) {
        console.error('Error fetching chart data:', error);
        return {
            daily: { labels: [], data: [] },
            hourly: { labels: [], data: [] }
        };
    }
}

module.exports = { getStoreStats };