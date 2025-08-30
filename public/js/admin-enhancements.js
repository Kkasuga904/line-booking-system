/**
 * 管理画面拡張機能
 * - 座席管理
 * - ハンバーガーメニュー修正
 * - 予約編集機能強化
 */

// グローバル変数
let availableSeats = [];
let currentReservation = null;

// ハンバーガーメニュー修正
function initHamburgerMenu() {
    // 既存のtoggleMenu関数を上書き
    window.toggleMenu = function() {
        const menu = document.getElementById('sideMenu');
        const overlay = document.getElementById('overlay');
        const hamburgerIcon = document.querySelector('.hamburger-icon');
        
        if (menu) {
            menu.classList.toggle('active');
        }
        if (overlay) {
            overlay.classList.toggle('active');
        }
        if (hamburgerIcon) {
            hamburgerIcon.classList.toggle('active');
        }
    };
    
    // オーバーレイクリックで閉じる
    const overlay = document.getElementById('overlay');
    if (overlay) {
        overlay.addEventListener('click', () => {
            const menu = document.getElementById('sideMenu');
            const hamburgerIcon = document.querySelector('.hamburger-icon');
            
            menu?.classList.remove('active');
            overlay.classList.remove('active');
            hamburgerIcon?.classList.remove('active');
        });
    }
}

// 座席選択の更新
function updateSeatOptions() {
    const seatSelect = document.getElementById('seatNumber');
    const numberOfPeople = parseInt(document.getElementById('numberOfPeople').value) || 0;
    const date = document.getElementById('reservationDate').value;
    const time = document.getElementById('reservationTime').value;
    const hint = document.getElementById('seatHint');
    
    if (!seatSelect) return;
    
    // 人数に基づいて座席オプションを更新
    const options = seatSelect.querySelectorAll('option');
    options.forEach(option => {
        if (option.value) {
            const capacity = getSeatCapacity(option.value);
            if (capacity > 0 && numberOfPeople > 0) {
                // 人数が座席容量を超える場合は無効化
                option.disabled = numberOfPeople > capacity;
                
                // 適切な座席をハイライト
                if (numberOfPeople <= capacity && capacity <= numberOfPeople + 2) {
                    option.style.background = '#e8f5e9';
                    option.style.fontWeight = 'bold';
                } else {
                    option.style.background = '';
                    option.style.fontWeight = '';
                }
            }
        }
    });
    
    // ヒント更新
    if (numberOfPeople > 0) {
        const recommendedSeats = getRecommendedSeats(numberOfPeople);
        if (recommendedSeats.length > 0) {
            hint.textContent = `推奨: ${recommendedSeats.join(', ')}`;
            hint.style.color = '#4CAF50';
        } else {
            hint.textContent = '適切な座席がありません';
            hint.style.color = '#f44336';
        }
    } else {
        hint.textContent = '人数を入力してください';
        hint.style.color = '#666';
    }
    
    // 空席チェック（日時が入力されている場合）
    if (date && time) {
        checkSeatAvailability(date, time);
    }
}

// 座席容量を取得
function getSeatCapacity(seatId) {
    const capacityMap = {
        'T1': 4, 'T2': 4, 'T3': 2, 'T4': 2,
        'C1': 1, 'C2': 1, 'C3': 1,
        'P1': 6
    };
    return capacityMap[seatId] || 0;
}

// 推奨座席を取得
function getRecommendedSeats(numberOfPeople) {
    const seats = [
        { id: 'T1', capacity: 4, type: 'table' },
        { id: 'T2', capacity: 4, type: 'table' },
        { id: 'T3', capacity: 2, type: 'table' },
        { id: 'T4', capacity: 2, type: 'table' },
        { id: 'C1', capacity: 1, type: 'counter' },
        { id: 'C2', capacity: 1, type: 'counter' },
        { id: 'C3', capacity: 1, type: 'counter' },
        { id: 'P1', capacity: 6, type: 'private' }
    ];
    
    // 人数にぴったりまたは少し余裕のある座席を推奨
    return seats
        .filter(seat => seat.capacity >= numberOfPeople && seat.capacity <= numberOfPeople + 2)
        .map(seat => seat.id);
}

// 座席の空き状況をチェック
async function checkSeatAvailability(date, time) {
    try {
        const STORE_ID = new URLSearchParams(window.location.search).get('store_id') || 'default-store';
        const response = await fetch(
            `https://line-booking-api-116429620992.asia-northeast1.run.app/api/seat-availability?store_id=${STORE_ID}&date=${date}&time=${time}`
        );
        
        if (response.ok) {
            const seats = await response.json();
            updateSeatAvailabilityDisplay(seats);
        }
    } catch (error) {
        console.error('座席状況の取得エラー:', error);
    }
}

// 座席の利用可能状況を表示
function updateSeatAvailabilityDisplay(seats) {
    const seatSelect = document.getElementById('seatNumber');
    if (!seatSelect || !Array.isArray(seats)) return;
    
    const options = seatSelect.querySelectorAll('option');
    options.forEach(option => {
        if (option.value) {
            const seatInfo = seats.find(s => s.seat_number === option.value);
            if (seatInfo) {
                if (!seatInfo.is_available) {
                    // 使用中の座席
                    option.disabled = true;
                    option.textContent = `${option.value} - 使用中 (${seatInfo.reserved_by})`;
                    option.style.color = '#999';
                } else {
                    // 空席
                    option.style.color = '#4CAF50';
                    if (!option.textContent.includes('空席')) {
                        const originalText = option.textContent.split(' - ')[0];
                        const seatType = option.textContent.split(' - ')[1];
                        option.textContent = `${originalText} - ${seatType} [空席]`;
                    }
                }
            }
        }
    });
}

// 予約編集時に座席情報を読み込み
function loadReservationForEdit(reservation) {
    currentReservation = reservation;
    
    // 基本情報を設定
    document.getElementById('customerName').value = reservation.customer_name || reservation.name || '';
    document.getElementById('reservationDate').value = reservation.date || '';
    document.getElementById('reservationTime').value = reservation.time || '';
    document.getElementById('numberOfPeople').value = reservation.people || '';
    document.getElementById('phoneNumber').value = reservation.customer_phone || reservation.phone || '';
    document.getElementById('notes').value = reservation.message || '';
    
    // ステータス設定
    const statusSelect = document.getElementById('reservationStatus');
    if (statusSelect) {
        statusSelect.value = reservation.status || 'confirmed';
    }
    
    // 座席設定
    const seatSelect = document.getElementById('seatNumber');
    if (seatSelect) {
        seatSelect.value = reservation.seat_number || '';
    }
    
    // 座席オプションを更新
    updateSeatOptions();
}

// 予約保存時に座席情報も含める
function enhanceReservationSave() {
    const originalForm = document.getElementById('reservationForm');
    if (!originalForm) return;
    
    // 既存のイベントリスナーを保持しつつ、拡張
    const originalSubmit = originalForm.onsubmit;
    
    originalForm.addEventListener('submit', async function(e) {
        // 座席とステータス情報を追加
        const seatNumber = document.getElementById('seatNumber')?.value;
        const status = document.getElementById('reservationStatus')?.value;
        
        // フォームデータに追加（実際の送信は既存の処理に任せる）
        if (seatNumber) {
            // 座席番号を一時的に保存
            this.dataset.seatNumber = seatNumber;
        }
        if (status) {
            this.dataset.status = status;
        }
    }, true); // captureフェーズで実行
}

// 座席割り当てAPI呼び出し
async function assignSeatToReservation(reservationId, seatNumber) {
    if (!reservationId || !seatNumber) return;
    
    try {
        const response = await fetch('https://line-booking-api-116429620992.asia-northeast1.run.app/api/assign-seat', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                reservation_id: reservationId,
                seat_number: seatNumber,
                assigned_by: 'admin'
            })
        });
        
        const result = await response.json();
        
        if (result.success) {
            console.log('座席割り当て成功:', result.message);
        } else {
            console.error('座席割り当て失敗:', result.message);
        }
    } catch (error) {
        console.error('座席割り当てエラー:', error);
    }
}

// 初期化
document.addEventListener('DOMContentLoaded', function() {
    // ハンバーガーメニュー修正
    initHamburgerMenu();
    
    // 座席管理機能を追加
    const numberOfPeople = document.getElementById('numberOfPeople');
    if (numberOfPeople) {
        numberOfPeople.addEventListener('input', updateSeatOptions);
    }
    
    const reservationDate = document.getElementById('reservationDate');
    if (reservationDate) {
        reservationDate.addEventListener('change', updateSeatOptions);
    }
    
    const reservationTime = document.getElementById('reservationTime');
    if (reservationTime) {
        reservationTime.addEventListener('change', updateSeatOptions);
    }
    
    // フォーム送信の拡張
    enhanceReservationSave();
    
    // 編集機能の拡張（既存のeditReservation関数を上書き）
    if (window.editReservation) {
        const originalEdit = window.editReservation;
        window.editReservation = function(reservation) {
            originalEdit(reservation);
            loadReservationForEdit(reservation);
        };
    }
});

// グローバル関数として公開
window.updateSeatOptions = updateSeatOptions;
window.assignSeatToReservation = assignSeatToReservation;