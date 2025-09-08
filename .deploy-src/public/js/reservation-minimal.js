(function () {
  // 二重初期化ガード
  if (window.__init_reservation_fix) return;
  window.__init_reservation_fix = true;

  // ユーティリティ
  const $ = (id) => document.getElementById(id);
  const isUUID = (v) => typeof v === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);

  // どの要素にも依存しないエコーで "届き方"を確認する関数（F12からも使える）
  window.__echo = async (body = { ping: 1 }) => {
    const r = await fetch('/api/__echo', {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify(body)
    });
    const j = await r.json();
    console.log('[__echo]', j);
    return j;
  };

  // 1) モーダル開ボタン配線（存在しなければスキップ）
  const openBtn = $('openAddReservationBtn') || $('openAddModalBtn');
  if (openBtn) {
    openBtn.type = 'button';
    openBtn.addEventListener('click', (e) => {
      e.preventDefault(); e.stopPropagation();
      const modal = $('addModal');         // ← IDは addModal に統一済みのはず
      if (modal) {
        modal.style.display = 'block';
        modal.classList.add('active');
      }
    }, { passive:false });
  }

  // 2) 予約作成ボタンに"確実に"1本だけハンドラを付与
  const createBtn = $('submitReservationBtn') || $('createReservationBtn') || $('createBtn');
  if (createBtn) {
    createBtn.type = 'button'; // formのsubmitを殺す
    const freshBtn = createBtn.cloneNode(true);
    createBtn.replaceWith(freshBtn); // 既存の古いリスナを全除去

    freshBtn.addEventListener('click', onCreateClick, { passive:false });
  } else {
    console.warn('[fix] create button not found - skipping button handler setup');
  }

  async function onCreateClick(e) {
    e.preventDefault(); e.stopPropagation();

    // 3) 値収集 & 正規化（ここで Console 実行と同じ payload を作る）
    const STORE_ID = window.STORE_ID || new URL(location.href).searchParams.get('store_id') || 'default-store';
    const get = (id) => $(id)?.value?.trim() ?? '';

    let time = get('reservationTime');
    // 時間フォーマットの正規化（念のためガード）
    if (/^\d{1,2}:\d{2}$/.test(time)) {
      time += ':00';  // HH:MM -> HH:MM:SS
    }
    if (time.length > 8) {
      time = time.slice(0, 8);  // 余分な部分を切り捨て
    }

    const seatEl = $('seatNumber');
    const seatValue = seatEl?.value || '';
    // 席コードは常にseat_codeに保存、seat_idはUUID専用でnull
    const seat_id = null;  // UUID専用（今回は使わない）
    const seat_code = seatValue || null;  // 席コード（T1, T2など）

    const peopleStr = (get('numberOfPeople') || '0').replace(/[^\d]/g,'');
    const people = Number.parseInt(peopleStr || '0', 10);

    const payload = {
      store_id: STORE_ID,
      customer_name: get('customerName') || 'Guest',
      phone: get('phoneNumber') || '',
      email: get('email') || '',
      date: get('reservationDate'),
      time,                 // "HH:MM:SS"
      people,               // number
      message: get('notes') || '',
      seat_id,              // UUID以外は null
      seat_code,            // コード（任意）
      status: get('reservationStatus') || 'confirmed',
      source: 'admin-ui'    // サーバで DEFAULT も用意しておく
    };

    console.log('[CREATE_PAYLOAD_UI] Seat info:', {
      seat_id: payload.seat_id,
      seat_code: payload.seat_code,
      full_payload: payload
    });

    // 3.5) 予約制限チェック
    try {
      const capacityCheckUrl = `/api/capacity-availability?date=${payload.date}&store_id=${STORE_ID}`;
      const capacityResponse = await fetch(capacityCheckUrl);
      
      if (capacityResponse.ok) {
        const capacityData = await capacityResponse.json();
        const timeSlot = payload.time.substring(0, 5); // HH:MM形式
        const slotInfo = capacityData.availability?.[timeSlot];
        
        if (slotInfo) {
          console.log('[CAPACITY_CHECK]', timeSlot, slotInfo);
          
          // 満席チェック
          if (slotInfo.status === 'full') {
            const confirmOverride = confirm(
              `⚠️ 警告: ${timeSlot}は満席です。\n` +
              `現在: ${slotInfo.currentGroups}組/${slotInfo.maxGroups}組\n` +
              `それでも予約を作成しますか？`
            );
            if (!confirmOverride) {
              console.log('[CAPACITY_CHECK] User cancelled due to full capacity');
              return;
            }
          }
          // もうすぐ満席チェック（80%以上）
          else if (slotInfo.status === 'limited' || slotInfo.usage >= 80) {
            const confirmOverride = confirm(
              `⚠️ 注意: ${timeSlot}はもうすぐ満席です。\n` +
              `現在: ${slotInfo.currentGroups}組/${slotInfo.maxGroups}組\n` +
              `残り: ${slotInfo.remainingGroups}組\n` +
              `予約を作成しますか？`
            );
            if (!confirmOverride) {
              console.log('[CAPACITY_CHECK] User cancelled due to limited capacity');
              return;
            }
          }
          // 人数制限チェック
          else if (slotInfo.maxPeople && slotInfo.currentPeople + payload.people > slotInfo.maxPeople) {
            const confirmOverride = confirm(
              `⚠️ 警告: ${timeSlot}の人数制限を超えます。\n` +
              `現在: ${slotInfo.currentPeople}名/${slotInfo.maxPeople}名\n` +
              `追加: ${payload.people}名\n` +
              `それでも予約を作成しますか？`
            );
            if (!confirmOverride) {
              console.log('[CAPACITY_CHECK] User cancelled due to people limit');
              return;
            }
          }
        }
      }
    } catch (capacityError) {
      console.error('[CAPACITY_CHECK] Error checking capacity:', capacityError);
      // エラーが発生しても予約作成は続行（制限チェックは補助的機能）
    }

    // 4) 事前バリデーション（ここを通れば 400 にはならない）
    const probs = [];
    if (!payload.date) probs.push('date');
    if (!/^\d{2}:\d{2}:\d{2}$/.test(payload.time)) probs.push('time(HH:MM:SS)');
    if (!Number.isFinite(payload.people) || payload.people <= 0) probs.push('people');
    if (probs.length) {
      alert('入力エラー: ' + probs.join(', '));
      return;
    }

    // 5) サーバに送る（URL API + JSON固定）
    const url = new URL('/api/admin', location.origin);
    url.searchParams.set('action', 'create');

    let res, text;
    try {
      res = await fetch(url.toString(), {
        method: 'POST',
        headers: { 'Content-Type':'application/json' },
        body: JSON.stringify(payload)
      });
      text = await res.text();
    } catch (err) {
      console.error('[FETCH_ERROR]', err);
      alert('通信エラー: ' + err.message);
      return;
    }

    console.log('[CREATE_RESPONSE_UI]', res.status, text);

    // 6) 応答処理（500のとき本文にヒントがあるはず）
    try {
      const json = JSON.parse(text);
      if (!res.ok) {
        alert(`サーバエラー(${res.status}): ` + (json.error || text));
        return;
      }
      alert('予約作成OK: ' + (json.reservation_id ?? ''));
      
      // モーダルを閉じる
      const modal = $('addModal');
      if (modal) {
        modal.classList.remove('active');
        modal.style.display = 'none';
      }
      
      // 一覧を再読み込み
      if (typeof loadReservations === 'function') {
        loadReservations();
      }
    } catch {
      if (!res.ok) alert(`サーバエラー(${res.status}): ` + text);
      else alert('予約作成OK');
    }
  }
})();