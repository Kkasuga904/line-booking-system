/**
 * 予約通知システム
 * LINEからの予約をリアルタイムで通知
 */

class NotificationSystem {
    constructor() {
        this.notifications = [];
        this.unreadCount = 0;
        this.isPolling = false;
        this.pollInterval = null;
        this.lastCheckTime = new Date().toISOString();
        this.notificationSound = new Audio('data:audio/wav;base64,UklGRjIAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQ4AAAD/AP8A/wD/AP8A/wD/AP8A');
    }

    /**
     * 通知システムを初期化
     */
    async init() {
        console.log('🔔 Notification System - Initializing...');
        
        // ブラウザ通知の許可を取得
        if ('Notification' in window && Notification.permission === 'default') {
            await Notification.requestPermission();
        }
        
        // 既存の通知を読み込み
        await this.loadNotifications();
        
        // ポーリング開始
        this.startPolling();
        
        // UI要素を設定
        this.setupUI();
        
        console.log('✅ Notification System - Ready');
    }

    /**
     * UIをセットアップ
     */
    setupUI() {
        // 通知バッジを更新
        this.updateBadge();
        
        // 通知パネルの表示/非表示
        const notificationBtn = document.getElementById('notificationBtn');
        const notificationPanel = document.getElementById('notificationPanel');
        
        if (notificationBtn) {
            notificationBtn.addEventListener('click', () => {
                if (notificationPanel) {
                    notificationPanel.classList.toggle('active');
                    if (notificationPanel.classList.contains('active')) {
                        this.markAllAsRead();
                    }
                }
            });
        }
        
        // サイドバーの通知メニュー
        const sidebarNotification = document.querySelector('.sidebar-menu a[href*="notification"]');
        if (sidebarNotification) {
            const badge = document.createElement('span');
            badge.className = 'notification-badge';
            badge.style.cssText = `
                background: #ff4444;
                color: white;
                border-radius: 10px;
                padding: 2px 6px;
                font-size: 12px;
                margin-left: 10px;
                display: none;
            `;
            badge.id = 'sidebarNotificationBadge';
            sidebarNotification.appendChild(badge);
        }
    }

    /**
     * ポーリングを開始
     */
    startPolling() {
        if (this.isPolling) return;
        
        this.isPolling = true;
        
        // 即座に一度チェック
        this.checkNewReservations();
        
        // 10秒ごとにチェック
        this.pollInterval = setInterval(() => {
            this.checkNewReservations();
        }, 10000);
        
        console.log('🔄 Polling started - checking every 10 seconds');
    }

    /**
     * ポーリングを停止
     */
    stopPolling() {
        if (this.pollInterval) {
            clearInterval(this.pollInterval);
            this.pollInterval = null;
        }
        this.isPolling = false;
        console.log('⏹️ Polling stopped');
    }

    /**
     * 新しい予約をチェック
     */
    async checkNewReservations() {
        try {
            const response = await fetch(`/api/reservations/new?since=${this.lastCheckTime}`);
            if (!response.ok) throw new Error('Failed to fetch new reservations');
            
            const data = await response.json();
            
            if (data.reservations && data.reservations.length > 0) {
                console.log(`📨 Found ${data.reservations.length} new reservation(s)`);
                
                for (const reservation of data.reservations) {
                    // LINEからの予約のみ通知
                    if (reservation.source === 'LINE' || reservation.line_user_id) {
                        this.addNotification({
                            id: reservation.id,
                            type: 'new_reservation',
                            title: '新しい予約が入りました',
                            message: `${reservation.customer_name}様 - ${reservation.date} ${reservation.time} (${reservation.people}名)`,
                            timestamp: reservation.created_at,
                            data: reservation,
                            source: 'LINE'
                        });
                    }
                }
                
                // 最終チェック時刻を更新
                this.lastCheckTime = new Date().toISOString();
            }
        } catch (error) {
            console.error('❌ Error checking new reservations:', error);
        }
    }

    /**
     * 通知を追加
     */
    addNotification(notification) {
        // 重複チェック
        if (this.notifications.find(n => n.id === notification.id)) {
            return;
        }
        
        // 通知を追加
        notification.read = false;
        notification.timestamp = notification.timestamp || new Date().toISOString();
        this.notifications.unshift(notification);
        this.unreadCount++;
        
        // UIを更新
        this.updateBadge();
        this.updateNotificationList();
        
        // 音を鳴らす
        this.playNotificationSound();
        
        // ブラウザ通知を表示
        this.showBrowserNotification(notification);
        
        // ポップアップ通知を表示
        this.showPopupNotification(notification);
        
        // ローカルストレージに保存
        this.saveNotifications();
    }

    /**
     * ブラウザ通知を表示
     */
    showBrowserNotification(notification) {
        if ('Notification' in window && Notification.permission === 'granted') {
            const browserNotif = new Notification(notification.title, {
                body: notification.message,
                icon: '/images/line-icon.png',
                badge: '/images/badge.png',
                tag: notification.id,
                requireInteraction: true
            });
            
            browserNotif.onclick = () => {
                window.focus();
                // 予約詳細を開く
                if (notification.data) {
                    this.openReservationDetail(notification.data);
                }
                browserNotif.close();
            };
        }
    }

    /**
     * ポップアップ通知を表示
     */
    showPopupNotification(notification) {
        // 既存のポップアップを削除
        const existing = document.getElementById('notification-popup');
        if (existing) {
            existing.remove();
        }
        
        const popup = document.createElement('div');
        popup.id = 'notification-popup';
        popup.className = 'notification-popup';
        popup.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            max-width: 400px;
            background: white;
            border-radius: 10px;
            box-shadow: 0 4px 20px rgba(0,0,0,0.2);
            padding: 20px;
            z-index: 10000;
            animation: slideIn 0.3s ease-out;
        `;
        
        // LINEアイコン
        const icon = notification.source === 'LINE' ? '💬' : '🔔';
        
        popup.innerHTML = `
            <div style="display: flex; align-items: center; margin-bottom: 10px;">
                <span style="font-size: 24px; margin-right: 10px;">${icon}</span>
                <h4 style="margin: 0; color: #333;">${notification.title}</h4>
                <button onclick="this.parentElement.parentElement.remove()" style="
                    margin-left: auto;
                    background: none;
                    border: none;
                    font-size: 20px;
                    cursor: pointer;
                    color: #999;
                ">×</button>
            </div>
            <p style="color: #666; margin: 0 0 10px 0;">${notification.message}</p>
            <div style="display: flex; gap: 10px;">
                <button onclick="window.notificationSystem.openReservationDetail('${notification.id}')" style="
                    background: #667eea;
                    color: white;
                    border: none;
                    padding: 8px 16px;
                    border-radius: 5px;
                    cursor: pointer;
                    font-size: 14px;
                ">詳細を見る</button>
                <button onclick="this.parentElement.parentElement.remove()" style="
                    background: #f0f0f0;
                    color: #666;
                    border: none;
                    padding: 8px 16px;
                    border-radius: 5px;
                    cursor: pointer;
                    font-size: 14px;
                ">閉じる</button>
            </div>
        `;
        
        // アニメーション用のスタイル
        const style = document.createElement('style');
        style.textContent = `
            @keyframes slideIn {
                from {
                    transform: translateX(400px);
                    opacity: 0;
                }
                to {
                    transform: translateX(0);
                    opacity: 1;
                }
            }
        `;
        document.head.appendChild(style);
        
        document.body.appendChild(popup);
        
        // 10秒後に自動で消す
        setTimeout(() => {
            if (popup.parentElement) {
                popup.style.animation = 'slideOut 0.3s ease-out';
                setTimeout(() => popup.remove(), 300);
            }
        }, 10000);
    }

    /**
     * 予約詳細を開く
     */
    openReservationDetail(reservationData) {
        // 予約IDが文字列の場合はパース
        if (typeof reservationData === 'string') {
            const notification = this.notifications.find(n => n.id === reservationData);
            if (notification && notification.data) {
                reservationData = notification.data;
            } else {
                console.error('Reservation data not found');
                return;
            }
        }
        
        // 編集モーダルを開く
        if (window.openReservationEditModal) {
            window.openReservationEditModal(reservationData);
        } else {
            console.log('Opening reservation detail:', reservationData);
            // フォールバック：予約詳細ページに遷移
            window.location.href = `/admin-full-featured.html#reservation=${reservationData.id}`;
        }
    }

    /**
     * 通知音を鳴らす
     */
    playNotificationSound() {
        try {
            // より良い通知音
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);
            
            oscillator.frequency.value = 800;
            oscillator.type = 'sine';
            
            gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
            
            oscillator.start(audioContext.currentTime);
            oscillator.stop(audioContext.currentTime + 0.5);
        } catch (error) {
            console.log('Could not play notification sound:', error);
        }
    }

    /**
     * バッジを更新
     */
    updateBadge() {
        // ヘッダーのバッジ
        const headerBadge = document.getElementById('notificationBadge');
        if (headerBadge) {
            headerBadge.textContent = this.unreadCount;
            headerBadge.style.display = this.unreadCount > 0 ? 'inline-block' : 'none';
        }
        
        // サイドバーのバッジ
        const sidebarBadge = document.getElementById('sidebarNotificationBadge');
        if (sidebarBadge) {
            sidebarBadge.textContent = this.unreadCount;
            sidebarBadge.style.display = this.unreadCount > 0 ? 'inline-block' : 'none';
        }
        
        // ブラウザタイトルを更新
        if (this.unreadCount > 0) {
            document.title = `(${this.unreadCount}) 予約管理システム`;
        } else {
            document.title = '予約管理システム';
        }
    }

    /**
     * 通知リストを更新
     */
    updateNotificationList() {
        const notificationList = document.getElementById('notificationList');
        if (!notificationList) return;
        
        if (this.notifications.length === 0) {
            notificationList.innerHTML = '<p style="text-align: center; color: #999;">通知はありません</p>';
            return;
        }
        
        notificationList.innerHTML = this.notifications.map(notif => {
            const timeAgo = this.getTimeAgo(notif.timestamp);
            const icon = notif.source === 'LINE' ? '💬' : '🔔';
            const unreadStyle = notif.read ? '' : 'background: #f0f7ff;';
            
            return `
                <div class="notification-item" style="
                    padding: 15px;
                    border-bottom: 1px solid #eee;
                    cursor: pointer;
                    transition: background 0.3s;
                    ${unreadStyle}
                " onclick="window.notificationSystem.openReservationDetail('${notif.id}')">
                    <div style="display: flex; align-items: center; margin-bottom: 5px;">
                        <span style="font-size: 20px; margin-right: 10px;">${icon}</span>
                        <strong>${notif.title}</strong>
                        <span style="margin-left: auto; color: #999; font-size: 12px;">${timeAgo}</span>
                    </div>
                    <p style="margin: 0; color: #666; font-size: 14px;">${notif.message}</p>
                </div>
            `;
        }).join('');
    }

    /**
     * 経過時間を取得
     */
    getTimeAgo(timestamp) {
        const now = new Date();
        const time = new Date(timestamp);
        const diff = Math.floor((now - time) / 1000); // 秒単位
        
        if (diff < 60) return 'たった今';
        if (diff < 3600) return `${Math.floor(diff / 60)}分前`;
        if (diff < 86400) return `${Math.floor(diff / 3600)}時間前`;
        return `${Math.floor(diff / 86400)}日前`;
    }

    /**
     * すべて既読にする
     */
    markAllAsRead() {
        this.notifications.forEach(notif => notif.read = true);
        this.unreadCount = 0;
        this.updateBadge();
        this.saveNotifications();
    }

    /**
     * 通知を保存
     */
    saveNotifications() {
        try {
            // 最新100件のみ保存
            const toSave = this.notifications.slice(0, 100);
            localStorage.setItem('reservation_notifications', JSON.stringify(toSave));
        } catch (error) {
            console.error('Failed to save notifications:', error);
        }
    }

    /**
     * 通知を読み込み
     */
    async loadNotifications() {
        try {
            const saved = localStorage.getItem('reservation_notifications');
            if (saved) {
                this.notifications = JSON.parse(saved);
                this.unreadCount = this.notifications.filter(n => !n.read).length;
                this.updateBadge();
                this.updateNotificationList();
            }
        } catch (error) {
            console.error('Failed to load notifications:', error);
        }
    }

    /**
     * テスト通知を送信（デバッグ用）
     */
    testNotification() {
        this.addNotification({
            id: 'test-' + Date.now(),
            type: 'new_reservation',
            title: 'テスト: 新しい予約が入りました',
            message: 'テスト太郎様 - 2025/09/02 18:00 (2名)',
            timestamp: new Date().toISOString(),
            source: 'LINE',
            data: {
                id: 'test-' + Date.now(),
                customer_name: 'テスト太郎',
                date: '2025-09-02',
                time: '18:00',
                people: 2,
                line_user_id: 'test123'
            }
        });
    }
}

// グローバルインスタンスを作成
window.notificationSystem = new NotificationSystem();

// ページロード後に初期化
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.notificationSystem.init();
    });
} else {
    window.notificationSystem.init();
}

console.log('📱 Notification System loaded - use window.notificationSystem.testNotification() to test');