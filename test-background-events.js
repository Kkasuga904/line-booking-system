// カレンダー背景イベント表示テストスクリプト
// ブラウザのコンソールで実行してください

// テスト1: 予約制限ルールを作成してLocalStorageに保存
function createTestCapacityRule() {
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    
    const testRule = {
        date: todayStr,
        startTime: '18:00',
        endTime: '21:00',
        maxGroups: 5,
        maxPeople: 20,
        enabled: true
    };
    
    const STORE_ID = new URLSearchParams(window.location.search).get('store_id') || 'default-store';
    localStorage.setItem(`capacity_control_rules_${STORE_ID}`, JSON.stringify([testRule]));
    
    console.log('テストルールを作成しました:', testRule);
    console.log('displayCapacityControls()を呼び出します...');
    
    // 関数を呼び出して背景イベントを表示
    if (typeof displayCapacityControls === 'function') {
        displayCapacityControls();
    } else {
        console.error('displayCapacityControls関数が見つかりません');
    }
}

// テスト2: 現在の背景イベントを確認
function checkBackgroundEvents() {
    if (!window.calendar) {
        console.error('カレンダーが初期化されていません');
        return;
    }
    
    const allEvents = window.calendar.getEvents();
    const bgEvents = allEvents.filter(e => e.display === 'background');
    const capacityEvents = allEvents.filter(e => e.extendedProps && e.extendedProps.__capacityControl);
    
    console.log('全イベント数:', allEvents.length);
    console.log('背景イベント数:', bgEvents.length);
    console.log('予約制限イベント数:', capacityEvents.length);
    
    if (bgEvents.length > 0) {
        console.log('背景イベント詳細:');
        bgEvents.forEach(e => {
            console.log({
                id: e.id,
                start: e.start,
                end: e.end,
                backgroundColor: e.backgroundColor,
                display: e.display
            });
        });
    }
    
    // DOM要素も確認
    const bgElements = document.querySelectorAll('.fc-bg-event');
    const capacityElements = document.querySelectorAll('.capacity-control');
    console.log('DOM内の背景要素数:', bgElements.length);
    console.log('DOM内の予約制限要素数:', capacityElements.length);
    
    if (bgElements.length > 0) {
        console.log('背景要素のスタイル:');
        bgElements.forEach(el => {
            const styles = window.getComputedStyle(el);
            console.log({
                backgroundColor: styles.backgroundColor,
                opacity: styles.opacity,
                zIndex: styles.zIndex,
                display: styles.display,
                visibility: styles.visibility
            });
        });
    }
}

// テスト3: 背景イベントを強制的に表示
function forceShowBackgroundEvent() {
    if (!window.calendar) {
        console.error('カレンダーが初期化されていません');
        return;
    }
    
    const today = new Date();
    const start = new Date(today);
    start.setHours(14, 0, 0, 0);
    const end = new Date(today);
    end.setHours(16, 0, 0, 0);
    
    const testEvent = {
        id: 'test-bg-' + Date.now(),
        start: start,
        end: end,
        display: 'background',
        backgroundColor: 'rgba(255, 0, 0, 0.5)',
        allDay: false
    };
    
    console.log('テスト背景イベントを追加:', testEvent);
    window.calendar.addEvent(testEvent);
    
    // 追加後の確認
    setTimeout(() => {
        const addedEvent = window.calendar.getEventById(testEvent.id);
        if (addedEvent) {
            console.log('イベントが追加されました:', addedEvent);
            
            // DOM要素を確認
            const elements = document.querySelectorAll(`[data-event-id="${testEvent.id}"]`);
            console.log('DOM要素数:', elements.length);
            
            if (elements.length > 0) {
                elements.forEach(el => {
                    console.log('要素のスタイル:', {
                        backgroundColor: el.style.backgroundColor,
                        opacity: el.style.opacity,
                        zIndex: el.style.zIndex
                    });
                });
            }
        } else {
            console.error('イベントの追加に失敗しました');
        }
    }, 100);
}

// テスト実行
console.log('=== カレンダー背景イベントテスト ===');
console.log('利用可能な関数:');
console.log('- createTestCapacityRule() : テスト用の予約制限ルールを作成');
console.log('- checkBackgroundEvents() : 現在の背景イベントを確認');
console.log('- forceShowBackgroundEvent() : 背景イベントを強制的に追加');
console.log('');
console.log('まず createTestCapacityRule() を実行してください');