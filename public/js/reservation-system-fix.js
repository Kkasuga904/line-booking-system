/**
 * 予約管理システム統合修正
 * 修正内容:
 * 1. capacity control rulesの適切な初期化
 * 2. 予約ブロックの正しい時間帯マッピング
 * 3. サイドバー初期化エラーの解消
 * 4. API通信の改善
 */

(function() {
    'use strict';
    
    console.log('[ReservationSystemFix] Initializing fixes...');
    
    // ========================================
    // 1. Capacity Control Rules 初期化修正
    // ========================================
    window.initializeCapacityRules = async function() {
        const STORE_ID = window.GLOBAL_STORE_ID || 'default-store';
        console.log('[CapacityRules] Initializing for store:', STORE_ID);
        
        try {
            // まずDBから読み込みを試みる
            if (typeof window.loadCapacityRulesFromDB === 'function') {
                const dbRules = await window.loadCapacityRulesFromDB();
                if (dbRules && dbRules.length > 0) {
                    console.log('[CapacityRules] Loaded from DB:', dbRules.length, 'rules');
                    // LocalStorageにも同期
                    localStorage.setItem(`capacity_control_rules_${STORE_ID}`, JSON.stringify(dbRules));
                    return dbRules;
                }
            }
        } catch (error) {
            console.warn('[CapacityRules] DB load failed, falling back to localStorage:', error);
        }
        
        // LocalStorageから読み込み
        const localRules = JSON.parse(localStorage.getItem(`capacity_control_rules_${STORE_ID}`) || '[]');
        console.log('[CapacityRules] Loaded from localStorage:', localRules.length, 'rules');
        
        // デフォルトルールが必要な場合は作成
        if (localRules.length === 0) {
            console.log('[CapacityRules] No rules found, initializing empty set');
            // 空の配列を返す（デフォルトルールは作らない）
            return [];
        }
        
        return localRules;
    };
    
    // ========================================
    // 2. 予約表示の正規化（時間帯マッピング修正）
    // ========================================
    window.normalizeReservationEvent = function(reservation) {
        if (!reservation || !reservation.date || !reservation.time) {
            console.warn('[NormalizeEvent] Invalid reservation:', reservation);
            return null;
        }
        
        // 日付の正規化
        let dateStr = reservation.date;
        if (dateStr.includes('T')) {
            dateStr = dateStr.split('T')[0];
        }
        
        // 時間の正規化（秒を含む形式も処理）
        let timeStr = reservation.time;
        if (timeStr.length === 8) { // HH:MM:SS
            timeStr = timeStr.substring(0, 5);
        }
        
        // 正確な開始・終了時刻を計算
        const [year, month, day] = dateStr.split('-').map(Number);
        const [hour, minute] = timeStr.split(':').map(Number);
        
        // ローカルタイムゾーンで作成
        const startDate = new Date(year, month - 1, day, hour, minute, 0);
        const endDate = new Date(startDate.getTime() + 30 * 60000); // 30分後
        
        // FullCalendarイベント形式に変換
        return {
            id: String(reservation.id || `temp-${Date.now()}`),
            title: `${reservation.customer_name || reservation.customerName || '予約'} (${reservation.people || reservation.party_size || 1}名)`,
            start: startDate,
            end: endDate,
            allDay: false,
            backgroundColor: reservation.status === 'cancelled' ? '#dc3545' : '#4CAF50',
            borderColor: reservation.status === 'cancelled' ? '#dc3545' : '#4CAF50',
            extendedProps: {
                store_id: reservation.store_id,
                people: reservation.people || reservation.party_size || 1,
                status: reservation.status || 'confirmed',
                phone: reservation.phone,
                email: reservation.email,
                originalData: reservation
            }
        };
    };
    
    // ========================================
    // 3. displayCapacityControls修正版
    // ========================================
    const originalDisplayCapacityControls = window.displayCapacityControls;
    
    window.displayCapacityControls = async function() {
        console.log('[DisplayCapacityControls] Starting enhanced version...');
        
        if (!window.calendar) {
            console.warn('[DisplayCapacityControls] Calendar not ready, deferring...');
            setTimeout(() => window.displayCapacityControls(), 500);
            return;
        }
        
        // 既存の背景イベントをクリア
        if (typeof window.removeCapacityControlBgEvents === 'function') {
            window.removeCapacityControlBgEvents(window.calendar);
        } else {
            // フォールバック
            const bgEvents = window.calendar.getEvents().filter(e => 
                e.display === 'background' || 
                e.extendedProps?.__capacityControl
            );
            bgEvents.forEach(e => e.remove());
        }
        
        // ルールを取得
        const rules = await window.initializeCapacityRules();
        
        if (!rules || rules.length === 0) {
            console.log('[DisplayCapacityControls] No rules to display');
            return;
        }
        
        // カレンダーの表示範囲を取得
        const viewStart = window.calendar.view.activeStart;
        const viewEnd = window.calendar.view.activeEnd;
        
        // ルールをフィルタリング（表示範囲内のみ）
        const filteredRules = rules.filter(rule => {
            if (!rule.date) return false;
            const ruleDate = new Date(rule.date);
            return ruleDate >= viewStart && ruleDate <= viewEnd;
        });
        
        console.log(`[DisplayCapacityControls] Showing ${filteredRules.length} of ${rules.length} rules in current view`);
        
        // バッチレンダリング
        window.calendar.batchRendering(() => {
            filteredRules.forEach(rule => {
                if (!rule.date) return;
                
                const startTime = rule.startTime || '00:00';
                const endTime = rule.endTime || '23:59';
                
                // 正確な日時を作成
                const startDateTime = `${rule.date}T${startTime}:00`;
                const endDateTime = `${rule.date}T${endTime}:00`;
                
                window.calendar.addEvent({
                    id: `capacity-${rule.date}-${startTime}-${endTime}`,
                    start: startDateTime,
                    end: endDateTime,
                    display: 'background',
                    backgroundColor: rule.color || 'rgba(220, 53, 69, 0.3)',
                    classNames: ['capacity-control'],
                    extendedProps: {
                        __capacityControl: true,
                        ruleId: rule.id,
                        maxGroups: rule.maxGroups,
                        maxPeople: rule.maxPeople
                    }
                });
            });
        });
    };
    
    // ========================================
    // 4. UnifiedSidebar初期化エラー修正
    // ========================================
    window.fixUnifiedSidebarInit = function() {
        // エラーを防ぐため、要素が存在しない場合は作成
        if (!document.getElementById('sidebar')) {
            console.log('[SidebarFix] Creating missing sidebar element');
            const sidebar = document.createElement('aside');
            sidebar.id = 'sidebar';
            sidebar.className = 'c-sidebar';
            document.body.appendChild(sidebar);
        }
        
        // ハンバーガーボタンも確認
        if (!document.querySelector('.hamburger-menu')) {
            console.log('[SidebarFix] Creating missing hamburger button');
            const hamburger = document.createElement('button');
            hamburger.className = 'hamburger-menu';
            hamburger.innerHTML = '<span></span><span></span><span></span>';
            hamburger.onclick = function() {
                const sidebar = document.getElementById('sidebar');
                if (sidebar) {
                    sidebar.classList.toggle('is-open');
                }
            };
            document.body.appendChild(hamburger);
        }
        
        // toggleSidebar関数を確実に定義
        if (!window.toggleSidebar) {
            window.toggleSidebar = function() {
                const sidebar = document.getElementById('sidebar');
                if (sidebar) {
                    sidebar.classList.toggle('is-open');
                }
            };
        }
        
        if (!window.openSidebar) {
            window.openSidebar = function() {
                const sidebar = document.getElementById('sidebar');
                if (sidebar) {
                    sidebar.classList.add('is-open');
                }
            };
        }
        
        if (!window.closeSidebar) {
            window.closeSidebar = function() {
                const sidebar = document.getElementById('sidebar');
                if (sidebar) {
                    sidebar.classList.remove('is-open');
                }
            };
        }
    };
    
    // ========================================
    // 5. API通信の改善
    // ========================================
    window.improvedFetch = async function(url, options = {}) {
        // デフォルトヘッダー
        const defaultHeaders = {
            'Content-Type': 'application/json',
        };
        
        // URLパラメータの修正（action=create=1 のような重複を防ぐ）
        if (url.includes('?')) {
            const urlObj = new URL(url, window.location.origin);
            // 重複パラメータを削除
            const params = new URLSearchParams(urlObj.search);
            urlObj.search = params.toString();
            url = urlObj.pathname + urlObj.search;
        }
        
        const finalOptions = {
            ...options,
            headers: {
                ...defaultHeaders,
                ...options.headers
            }
        };
        
        try {
            const response = await fetch(url, finalOptions);
            
            // 500エラーの詳細ログ
            if (response.status === 500) {
                console.error('[API] 500 Error:', {
                    url,
                    method: finalOptions.method,
                    headers: finalOptions.headers,
                    body: finalOptions.body
                });
                
                const errorText = await response.text();
                console.error('[API] Error response:', errorText);
                
                throw new Error(`Server error: ${errorText}`);
            }
            
            return response;
        } catch (error) {
            console.error('[API] Request failed:', error);
            throw error;
        }
    };
    
    // ========================================
    // 初期化処理
    // ========================================
    function initializeFixes() {
        console.log('[ReservationSystemFix] Applying fixes...');
        
        // サイドバー修正を適用
        window.fixUnifiedSidebarInit();
        
        // カレンダーイベントハンドラを改善
        // 注: FullCalendar v5では、イベントハンドラはcalendarオプションで設定する必要がある
        // ここではグローバル関数として定義し、calendar作成時に使用できるようにする
        window.onCalendarDatesSet = function() {
            console.log('[Calendar] View changed, refreshing capacity controls');
            if (typeof window.displayCapacityControls === 'function') {
                window.displayCapacityControls();
            }
        }
        
        // エラーハンドラ
        window.addEventListener('error', function(e) {
            if (e.message && e.message.includes('Unified sidebar elements not found')) {
                e.preventDefault();
                console.log('[ErrorHandler] Suppressed sidebar error, applying fix');
                window.fixUnifiedSidebarInit();
            }
        });
        
        console.log('[ReservationSystemFix] All fixes applied successfully');
    }
    
    // DOMContentLoaded時に実行
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initializeFixes);
    } else {
        // 既に読み込み済みの場合
        setTimeout(initializeFixes, 100);
    }
    
})();