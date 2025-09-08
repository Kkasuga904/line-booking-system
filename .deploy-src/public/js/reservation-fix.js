(function() {
  // 二重初期化ガード（専門家推奨）
  if (window.__init_reservation) {
    console.warn('[guard] reservation already initialized, skipping...');
    return;
  }
  window.__init_reservation = true;
  console.log('[reservation-fix.js] Initializing...');

// 予約作成の修正版ハンドラ
async function onCreateClick(e) {
  e.preventDefault();
  e.stopPropagation();

  // ① 値の収集と正規化（型を固定）
  const get = id => {
    const elem = document.getElementById(id);
    console.log(`Getting ${id}:`, elem, elem?.value);
    return elem?.value || '';
  };
  const STORE_ID = window.STORE_ID || 'default-store';

  let time = get('reservationTime').trim();
  // 時間フォーマットを正規化 (HH:MM or HH:MM:SS を HH:MM:SS に統一)
  if (time.match(/^\d{2}:\d{2}$/)) {
    time += ':00';  // HH:MM -> HH:MM:SS
  } else if (time.match(/^\d{2}:\d{2}:\d{2}$/)) {
    // HH:MM:SS はそのまま
  } else {
    // 不正な形式の場合は先頭8文字を取る
    time = time.slice(0, 8);
  }

  const peopleStr = (get('numberOfPeople') || '0').toString().replace(/[^\d]/g,'');
  const people = Number.parseInt(peopleStr || '0', 10);

  const payload = {
    store_id: STORE_ID,
    customer_name: get('customerName') || 'Guest',
    phone: get('phoneNumber') || '',
    email: get('email') || '',
    date: get('reservationDate'),
    time,                  // "HH:MM:SS"
    people,                // number
    message: get('notes') || '',
    seat_id: get('seatNumber') || null,
    status: get('reservationStatus') || 'confirmed'
    // user_idとsourceは送信しない（サーバー側で設定）
  };

  // ② 直前の可視化ログ
  console.log('[CREATE_PAYLOAD]', payload);

  // ③ バリデーション
  const problems = [];
  if (!payload.date) problems.push('date is empty');
  if (!payload.time || !/^\d{2}:\d{2}:\d{2}$/.test(payload.time)) problems.push('time is invalid: ' + payload.time);
  if (!Number.isFinite(payload.people) || payload.people <= 0) problems.push('people is invalid: ' + payload.people);
  if (!payload.customer_name) problems.push('customer_name is empty');
  
  if (problems.length) {
    console.warn('Validation failed:', problems);
    console.warn('Payload:', payload);
    
    // フォームに値を手動で設定してテスト
    if (!payload.date) {
      const today = new Date();
      today.setDate(today.getDate() + 1);
      payload.date = today.toISOString().split('T')[0];
      console.log('Using default date:', payload.date);
    }
    if (!payload.time) {
      payload.time = '18:00:00';
      console.log('Using default time:', payload.time);
    }
    if (!payload.people || payload.people <= 0) {
      payload.people = 2;
      console.log('Using default people:', payload.people);
    }
    if (!payload.customer_name) {
      payload.customer_name = 'テストユーザー';
      console.log('Using default name:', payload.customer_name);
    }
  }

  // ④ URL API で安全に作成
  const url = new URL('/api/admin', location.origin);
  url.searchParams.set('action', 'create');

  // ⑤ 送信と応答の丸見えログ
  let res, text;
  try {
    res = await fetch(url.toString(), {
      method: 'POST',
      headers: { 'Content-Type':'application/json' },
      body: JSON.stringify(payload)
    });
    text = await res.text();
  } catch (err) {
    console.error('[CREATE_FETCH_ERROR]', err);
    alert('通信エラー: ' + err.message);
    return;
  }

  console.log('[CREATE_RESPONSE]', res.status, text);
  
  try {
    const json = JSON.parse(text);
    if (!res.ok) {
      console.error('[CREATE_ERROR_DETAILS]', json);
      alert(`サーバエラー(${res.status}): ` + (json.error || json.message || text));
      return;
    }
    
    // 成功
    console.log('[CREATE_SUCCESS]', json);
    alert('予約を作成しました');
    
    // モーダルを閉じる
    const modal = document.getElementById('addModal');
    if (modal) modal.classList.remove('active');
    
    // フォームをリセット
    document.getElementById('reservationForm')?.reset();
    
    // 一覧を再読み込み
    if (typeof loadReservations === 'function') {
      loadReservations();
    }
  } catch {
    if (!res.ok) {
      alert(`サーバエラー(${res.status}): ` + text);
    } else {
      alert('予約作成OK');
    }
  }
}

// モーダル制御関数をグローバルに公開
window.openAddModal = function() {
  const modal = document.getElementById('addModal');
  if (modal) {
    modal.classList.add('active');
    // フォームをリセット
    const form = document.getElementById('reservationForm');
    if (form) {
      form.reset();
      delete form.dataset.mode;
      delete form.dataset.reservationId;
      
      // 日付のデフォルト値を今日に設定
      const dateInput = document.getElementById('reservationDate');
      if (dateInput && !dateInput.value) {
        const today = new Date();
        today.setDate(today.getDate() + 1); // 明日
        dateInput.value = today.toISOString().split('T')[0];
      }
    }
  }
};

window.closeModal = function() {
  const modal = document.getElementById('addModal');
  if (modal) {
    modal.classList.remove('active');
  }
};

// 時間スロットの可用性を更新する関数
window.updateTimeSlotAvailability = function(selectedDate) {
  console.log('Updating time slots for date:', selectedDate);
  // 必要に応じて時間スロットの有効/無効を切り替える処理を追加
};

// 予約編集用の関数
window.editReservation = function(id) {
  console.log('Edit reservation:', id);
  const modal = document.getElementById('addModal');
  const form = document.getElementById('reservationForm');
  
  if (modal && form) {
    // 予約データを取得（実際のデータ取得処理が必要）
    form.dataset.mode = 'edit';
    form.dataset.reservationId = id;
    modal.classList.add('active');
    
    // ここで既存の予約データをフォームに設定する処理を追加
  }
};

// 予約削除用の関数
window.deleteReservation = async function(id) {
  if (!confirm('この予約を削除しますか？')) {
    return;
  }
  
  try {
    const url = new URL('/api/admin', location.origin);
    url.searchParams.set('action', 'delete');
    url.searchParams.set('id', id);
    
    const response = await fetch(url.toString(), {
      method: 'DELETE'
    });
    
    const result = await response.json();
    
    if (result.success || result.ok) {
      alert('予約を削除しました');
      if (typeof loadReservations === 'function') {
        loadReservations();
      }
    } else {
      alert('削除に失敗しました: ' + (result.error || 'エラー'));
    }
  } catch (error) {
    console.error('Delete error:', error);
    alert('削除に失敗しました: ' + error.message);
  }
};

// 通知表示用の関数
window.showNotification = function(message, type = 'info') {
  console.log(`[${type}] ${message}`);
  // 実際の通知UIの実装が必要な場合はここに追加
};

// 既存のイベントリスナーを削除して再設定
document.addEventListener('DOMContentLoaded', function() {
  const btn = document.getElementById('submitReservationBtn');
  if (btn) {
    // 既存のリスナーを削除
    const newBtn = btn.cloneNode(true);
    btn.parentNode.replaceChild(newBtn, btn);
    
    // 新しいリスナーを設定
    newBtn.addEventListener('click', onCreateClick, { passive: false });
  }
  
  // フォームの送信を完全に無効化
  const form = document.getElementById('reservationForm');
  if (form) {
    form.onsubmit = function() { return false; };
    form.setAttribute('action', '#');
  }
  
  // 予約追加ボタンにイベントを設定
  const addBtn = document.querySelector('.add-btn');
  if (addBtn) {
    addBtn.onclick = function() {
      window.openAddModal();
    };
  }
});

})(); // IIFE終了