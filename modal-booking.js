// 既存のモーダルに統合するための予約管理JavaScript
// このファイルを既存のHTMLに読み込んで使用

const BookingAPI = {
    // APIベースURL（必要に応じて変更）
    API_BASE: 'https://line-booking-api-dxp5vd3wbq-an.a.run.app',
    
    // 予約一覧取得
    async loadReservations() {
        try {
            const response = await fetch(`${this.API_BASE}/api/admin/list`);
            const result = await response.json();
            return result;
        } catch (error) {
            console.error('Error loading reservations:', error);
            throw error;
        }
    },
    
    // 予約作成
    async createReservation(formData) {
        try {
            const response = await fetch(`${this.API_BASE}/api/reservation/create`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(formData)
            });
            const result = await response.json();
            return result;
        } catch (error) {
            console.error('Error creating reservation:', error);
            throw error;
        }
    },
    
    // 予約削除
    async deleteReservation(id) {
        try {
            const response = await fetch(`${this.API_BASE}/api/admin/delete/${id}`, {
                method: 'DELETE'
            });
            const result = await response.json();
            return result;
        } catch (error) {
            console.error('Error deleting reservation:', error);
            throw error;
        }
    }
};

// モーダル用のHTML生成関数
function createBookingModal() {
    const modalHTML = `
        <div id="bookingModal" class="modal" style="display:none;">
            <div class="modal-content">
                <span class="close" onclick="closeBookingModal()">&times;</span>
                <h2>新規予約作成</h2>
                <form id="modalBookingForm">
                    <div class="form-group">
                        <label>日付 *</label>
                        <input type="date" id="modal_date" required>
                    </div>
                    
                    <div class="form-group">
                        <label>時間 *</label>
                        <select id="modal_time" required>
                            <option value="">選択してください</option>
                            ${generateTimeOptions()}
                        </select>
                    </div>
                    
                    <div class="form-group">
                        <label>お客様名 *</label>
                        <input type="text" id="modal_customer_name" required placeholder="山田 太郎">
                    </div>
                    
                    <div class="form-group">
                        <label>電話番号</label>
                        <input type="tel" id="modal_phone" placeholder="080-1234-5678">
                    </div>
                    
                    <div class="form-group">
                        <label>人数 *</label>
                        <select id="modal_people" required>
                            <option value="">選択してください</option>
                            <option value="1">1名</option>
                            <option value="2">2名</option>
                            <option value="3">3名</option>
                            <option value="4">4名</option>
                            <option value="5">5名</option>
                            <option value="6">6名</option>
                            <option value="7">7名</option>
                            <option value="8">8名</option>
                            <option value="9">9名</option>
                            <option value="10">10名以上</option>
                        </select>
                    </div>
                    
                    <div class="form-group">
                        <label>備考</label>
                        <textarea id="modal_notes" rows="3" placeholder="アレルギー、ご要望など"></textarea>
                    </div>
                    
                    <button type="submit">予約を作成</button>
                </form>
            </div>
        </div>
    `;
    
    // モーダル用のCSS
    const modalCSS = `
        <style>
            .modal {
                position: fixed;
                z-index: 1000;
                left: 0;
                top: 0;
                width: 100%;
                height: 100%;
                overflow: auto;
                background-color: rgba(0,0,0,0.4);
            }
            
            .modal-content {
                background-color: #fefefe;
                margin: 5% auto;
                padding: 30px;
                border: 1px solid #888;
                width: 90%;
                max-width: 500px;
                border-radius: 12px;
                box-shadow: 0 4px 20px rgba(0,0,0,0.15);
            }
            
            .close {
                color: #aaa;
                float: right;
                font-size: 28px;
                font-weight: bold;
                cursor: pointer;
                line-height: 20px;
            }
            
            .close:hover,
            .close:focus {
                color: #000;
            }
            
            .form-group {
                margin-bottom: 15px;
            }
            
            .form-group label {
                display: block;
                margin-bottom: 5px;
                font-weight: 500;
                color: #555;
                font-size: 14px;
            }
            
            .form-group input,
            .form-group select,
            .form-group textarea {
                width: 100%;
                padding: 10px;
                border: 1px solid #ddd;
                border-radius: 8px;
                font-size: 14px;
                box-sizing: border-box;
            }
            
            .form-group input:focus,
            .form-group select:focus,
            .form-group textarea:focus {
                outline: none;
                border-color: #667eea;
                box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
            }
            
            #modalBookingForm button {
                width: 100%;
                padding: 12px;
                background: #667eea;
                color: white;
                border: none;
                border-radius: 8px;
                font-size: 16px;
                font-weight: 500;
                cursor: pointer;
                transition: all 0.3s ease;
            }
            
            #modalBookingForm button:hover {
                background: #5a67d8;
                transform: translateY(-1px);
            }
            
            .booking-message {
                padding: 12px;
                border-radius: 8px;
                margin-bottom: 20px;
                display: none;
            }
            
            .booking-message.success {
                background: #d4edda;
                color: #155724;
                border: 1px solid #c3e6cb;
            }
            
            .booking-message.error {
                background: #f8d7da;
                color: #721c24;
                border: 1px solid #f5c6cb;
            }
        </style>
    `;
    
    // DOMに追加
    document.head.insertAdjacentHTML('beforeend', modalCSS);
    document.body.insertAdjacentHTML('beforeend', modalHTML);
}

// 時間オプション生成
function generateTimeOptions() {
    const times = [];
    for (let hour = 9; hour <= 20; hour++) {
        for (let min = 0; min < 60; min += 30) {
            if (hour === 20 && min > 0) break;
            const time = `${hour.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}`;
            times.push(`<option value="${time}">${time}</option>`);
        }
    }
    return times.join('');
}

// モーダルを開く
function openBookingModal() {
    const modal = document.getElementById('bookingModal');
    if (!modal) {
        createBookingModal();
        initializeModalForm();
    }
    document.getElementById('bookingModal').style.display = 'block';
    setDefaultDate();
}

// モーダルを閉じる
function closeBookingModal() {
    document.getElementById('bookingModal').style.display = 'none';
}

// デフォルト日付設定
function setDefaultDate() {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    const dateInput = document.getElementById('modal_date');
    if (dateInput) {
        dateInput.value = `${year}-${month}-${day}`;
    }
}

// メッセージ表示
function showBookingMessage(text, isSuccess = true) {
    let messageEl = document.querySelector('.booking-message');
    if (!messageEl) {
        messageEl = document.createElement('div');
        messageEl.className = 'booking-message';
        const modalContent = document.querySelector('.modal-content');
        modalContent.insertBefore(messageEl, modalContent.firstChild.nextSibling);
    }
    
    messageEl.textContent = text;
    messageEl.className = `booking-message ${isSuccess ? 'success' : 'error'}`;
    messageEl.style.display = 'block';
    
    setTimeout(() => {
        messageEl.style.display = 'none';
    }, 5000);
}

// フォーム初期化
function initializeModalForm() {
    const form = document.getElementById('modalBookingForm');
    if (!form) return;
    
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const formData = {
            date: document.getElementById('modal_date').value,
            time: document.getElementById('modal_time').value,
            customer_name: document.getElementById('modal_customer_name').value,
            phone: document.getElementById('modal_phone').value,
            people: parseInt(document.getElementById('modal_people').value),
            notes: document.getElementById('modal_notes').value,
            status: 'confirmed'
        };
        
        try {
            const result = await BookingAPI.createReservation(formData);
            
            if (result.success) {
                showBookingMessage('予約を作成しました');
                form.reset();
                setDefaultDate();
                
                // 予約一覧を更新（もし表示している場合）
                if (typeof updateReservationList === 'function') {
                    updateReservationList();
                }
                
                // 3秒後にモーダルを閉じる
                setTimeout(() => {
                    closeBookingModal();
                }, 3000);
            } else {
                showBookingMessage('予約の作成に失敗しました', false);
            }
        } catch (error) {
            showBookingMessage('エラーが発生しました', false);
        }
    });
}

// 予約一覧表示用の関数（必要に応じて使用）
async function displayReservations(containerId) {
    try {
        const result = await BookingAPI.loadReservations();
        const container = document.getElementById(containerId);
        
        if (!container) return;
        
        if (result.ok && result.items && result.items.length > 0) {
            let html = '<table class="reservation-table">';
            html += '<thead><tr>';
            html += '<th>日付</th><th>時間</th><th>お客様名</th><th>人数</th><th>電話番号</th><th>ステータス</th><th>操作</th>';
            html += '</tr></thead><tbody>';
            
            result.items.forEach(item => {
                html += '<tr>';
                html += `<td>${item.date || ''}</td>`;
                html += `<td>${item.time || ''}</td>`;
                html += `<td>${item.customer_name || ''}</td>`;
                html += `<td>${item.people || 0}名</td>`;
                html += `<td>${item.phone || ''}</td>`;
                html += `<td><span class="status-${item.status}">${item.status || 'pending'}</span></td>`;
                html += `<td><button onclick="deleteAndRefresh('${item.id}')">削除</button></td>`;
                html += '</tr>';
            });
            
            html += '</tbody></table>';
            container.innerHTML = html;
        } else {
            container.innerHTML = '<p>予約データがありません</p>';
        }
    } catch (error) {
        console.error('Error displaying reservations:', error);
    }
}

// 削除して更新
async function deleteAndRefresh(id) {
    if (!confirm('この予約を削除してよろしいですか？')) return;
    
    try {
        await BookingAPI.deleteReservation(id);
        
        // 一覧を更新
        if (typeof updateReservationList === 'function') {
            updateReservationList();
        }
    } catch (error) {
        console.error('Error deleting reservation:', error);
    }
}

// 外部から呼び出せるようにグローバルに公開
window.BookingAPI = BookingAPI;
window.openBookingModal = openBookingModal;
window.closeBookingModal = closeBookingModal;
window.displayReservations = displayReservations;
window.deleteAndRefresh = deleteAndRefresh;