        let userProfile = null;
        let userId = null;
        let selectedDate = null;
        let selectedTime = null;
        let lastSelectedSlot = null;
        let capacityData = {};
        let customerData = null;
        let debugMode = false;
        
        const SLOT_CONTAINER_SEL = '#timeSlots';
        const SLOT_PRIMARY_SELECTOR = '[data-slot="time"]';
        const SLOT_FALLBACK_SELECTOR = '.time-slot';
        let selectedKey = null;
        let selectedTimeStr = null;
        const $doc = document;
        function resolveStoreId(baseId) {
            const host = (window.location && window.location.host || '').toLowerCase();
            if (host.includes('booking-account1')) return 'account1-store';
            if (host.includes('booking-account2')) return 'account2-store';
            if (typeof baseId === 'string' && baseId.trim()) return baseId;
            if (host.includes('line-booking-system') || host.includes('line-booking-api')) return 'store-a';
            return baseId || '***REMOVED-ROTATE-CREDENTIAL***';
        }


        function allSlots() {
            return $doc.querySelectorAll(SLOT_PRIMARY_SELECTOR + ', ' + SLOT_FALLBACK_SELECTOR);
        }

        function getSlotElement(target) {
            if (!target) {
                return null;
            }
            const primary = target.closest(SLOT_PRIMARY_SELECTOR);
            return primary || target.closest(SLOT_FALLBACK_SELECTOR);
        }

        function clearAllActive() {
            $doc.querySelectorAll('.slot--active').forEach(btn => {
                if (!btn.matches(SLOT_PRIMARY_SELECTOR) && !btn.matches(SLOT_FALLBACK_SELECTOR)) {
                    return;
                }
                btn.classList.remove('slot--active', 'selected');
                btn.setAttribute('aria-pressed', 'false');
                btn.setAttribute('aria-selected', 'false');
                if (btn.dataset.baseStyle) {
                    btn.setAttribute('style', btn.dataset.baseStyle);
                } else {
                    btn.style.removeProperty('border');
                    btn.style.removeProperty('box-shadow');
                    btn.style.removeProperty('transform');
                }
            });
        }

        function deriveSelectionKey(dateValue, timeValue) {
            if (dateValue && timeValue) {
                return `${dateValue}T${timeValue}`;
            }
            return timeValue || null;
        }

        function selectSlot(btn, opts = {}) {
            if (!btn || btn.matches('[aria-disabled="true"],[disabled]')) {
                return null;
            }

            const { time: timeOption, date: dateOption, silent = false } = opts;
            const timeValue = timeOption || btn.dataset.time || btn.getAttribute('data-time') || '';
            const dateHint = dateOption
                || btn.dataset.date
                || document.getElementById('selectedDate')?.value
                || selectedDate
                || window.currentDateStr
                || '';

            clearAllActive();

            if (btn.dataset.baseStyle) {
                btn.setAttribute('style', btn.dataset.baseStyle);
            } else {
                btn.style.removeProperty('border');
                btn.style.removeProperty('box-shadow');
                btn.style.removeProperty('transform');
            }

            btn.classList.add('slot--active');
            btn.classList.add('selected');
            btn.setAttribute('aria-pressed', 'true');
            btn.setAttribute('aria-selected', 'true');

            btn.style.setProperty('border', '3px solid #ffd54f', 'important');
            btn.style.setProperty('box-shadow', '0 6px 16px rgba(255, 213, 79, 0.45)', 'important');
            btn.style.setProperty('transform', 'scale(1.03)');

            const key = deriveSelectionKey(dateHint, timeValue);
            selectedKey = key;
            selectedTimeStr = timeValue;
            selectedTime = timeValue;
            if (dateHint) {
                window.currentDateStr = dateHint;
            }

            if (!silent) {
                window.lastSelectedSlot = { time: timeValue, date: dateHint, key };
                if (typeof window.onTimeSelected === 'function') {
                    try {
                        window.onTimeSelected({ time: timeValue, date: dateHint, key });
                    } catch (error) {
                        try {
                            window.onTimeSelected(timeValue);
                        } catch (fallbackError) {
                            console.warn('[slot] onTimeSelected failed', error, fallbackError);
                        }
                    }
                }
            }

            return { time: timeValue, date: dateHint, key };
        }

        function restoreSelection() {
            if (!selectedKey) {
                clearAllActive();
                return;
            }

            const hasDate = selectedKey.includes('T');
            const [keyDate, keyTime] = hasDate ? selectedKey.split('T') : ['', selectedKey];
            const candidate = Array.from(allSlots()).find(btn => {
                const slotTime = btn.dataset.time || btn.getAttribute('data-time') || '';
                const slotDate = btn.dataset.date || btn.getAttribute('data-date') || window.currentDateStr || selectedDate || '';
                if (hasDate && slotDate && keyDate) {
                    return slotTime === keyTime && slotDate === keyDate;
                }
                return slotTime === keyTime;
            });

            if (candidate) {
                selectSlot(candidate, { date: keyDate || window.currentDateStr || selectedDate || '', time: keyTime, silent: true });
            } else {
                clearAllActive();
            }
        }
        function enforceSingleActive() {
            const slots = Array.from(allSlots());
            if (!slots.length) {
                return;
            }

            const activeMatch = btn => btn.classList.contains('slot--active') || btn.classList.contains('selected');
            const getSlotTime = btn => btn.dataset.time || btn.getAttribute('data-time') || '';
            const getSlotDate = btn => btn.dataset.date || btn.getAttribute('data-date') || window.currentDateStr || selectedDate || '';

            let candidate = null;

            if (selectedKey) {
                const hasDate = selectedKey.includes('T');
                const parts = hasDate ? selectedKey.split('T') : ['', selectedKey];
                const keyDate = parts[0];
                const keyTime = parts[1];
                candidate = slots.find(btn => {
                    const slotTime = getSlotTime(btn);
                    const slotDate = getSlotDate(btn);
                    if (hasDate && keyDate) {
                        return slotTime === keyTime && slotDate === keyDate;
                    }
                    return slotTime === keyTime;
                });
            }

            if (!candidate && window.lastSelectedSlot) {
                const last = window.lastSelectedSlot;
                candidate = slots.find(btn => {
                    const slotTime = getSlotTime(btn);
                    const slotDate = getSlotDate(btn);
                    if (last.date) {
                        return slotTime === (last.time || '') && slotDate === last.date;
                    }
                    return slotTime === (last.time || '');
                });
            }

            if (!candidate) {
                candidate = slots.find(activeMatch);
            }

            if (!candidate) {
                candidate = slots.find(btn => !btn.matches('[aria-disabled="true"],[disabled]'));
            }

            if (candidate) {
                const time = getSlotTime(candidate);
                const date = getSlotDate(candidate);
                selectSlot(candidate, { time, date, silent: true });
                return;
            }

            clearAllActive();
            selectedKey = null;
            selectedTimeStr = null;
            selectedTime = null;
        }




        function handleSlotClick(event) {
            const button = getSlotElement(event.target);
            if (!button) {
                return;
            }
            const timeValue = button.dataset.time || button.getAttribute('data-time') || '';
            selectTime(timeValue, button);
            enforceSingleActive();
        }

        function handleSlotKeydown(event) {
            if (event.key !== 'Enter' && event.key !== ' ') {
                return;
            }
            const button = getSlotElement(event.target);
            if (!button) {
                return;
            }
            event.preventDefault();
            const timeValue = button.dataset.time || button.getAttribute('data-time') || '';
            selectTime(timeValue, button);
            enforceSingleActive();
        }

        function bindSlotDelegation() {
            const container = $doc.querySelector(SLOT_CONTAINER_SEL);
            if (!container) {
                return;
            }

            if (!container.dataset.slotDelegated) {
                container.addEventListener('click', handleSlotClick);
                container.addEventListener('keydown', handleSlotKeydown);
                container.dataset.slotDelegated = 'true';
            }

            if (window.__slotObserver__) {
                window.__slotObserver__.disconnect();
            }

            const observer = new MutationObserver(() => {
                enforceSingleActive();
                restoreSelection();
            });

            observer.observe(container, { childList: true, subtree: true });
            window.__slotObserver__ = observer;
        }

        function toggleDebug() {
            debugMode = !debugMode;
            const panel = document.getElementById('debug-panel');
            panel.style.display = debugMode ? 'block' : 'none';
            if (debugMode) {
                debugLog('デバッグモードON');
            }
        }
        
        function debugLog(message, data = null) {
            const output = document.getElementById('debug-output');
            if (!output) return;
            
            const timestamp = new Date().toLocaleTimeString('ja-JP');
            let logMessage = `[${timestamp}] ${message}`;
            if (data) {
                logMessage += '\n' + JSON.stringify(data, null, 2);
            }
            output.innerHTML = logMessage + '\n' + output.innerHTML;
            
            // コンソールにも出力
            console.log(`[DEBUG] ${message}`, data || '');
        }
        
        async function testCapacityForDate() {
            debugLog('9月7日の容量チェック中...');
            try {
                const response = await fetch(`/api/capacity-availability?store_id=***REMOVED-ROTATE-CREDENTIAL***&date=2025-09-07`);
                const data = await response.json();
                debugLog('9/7 容量データ:', data);
                
                if (data.slots) {
                    const restrictedSlots = ['18:00', '18:30', '19:00', '19:30', '20:00', '20:30'];
                    const restrictions = {};
                    restrictedSlots.forEach(time => {
                        if (data.slots[time]) {
                            restrictions[time] = {
                                limit: data.slots[time].limit,
                                status: data.slots[time].status
                            };
                        }
                    });
                    debugLog('18:00-21:00 制限:', restrictions);
                }
            } catch (error) {
                debugLog('エラー:', {error: error.message});
            }
        }
        
        async function checkCurrentRules() {
            debugLog('現在適用中のルールを確認...');
            const selectedDateValue = document.getElementById('selectedDate')?.value;
            if (!selectedDateValue) {
                debugLog('日付が選択されていません');
                return;
            }
            
            try {
                const response = await fetch(`/api/capacity-availability?store_id=***REMOVED-ROTATE-CREDENTIAL***&date=${selectedDateValue}`);
                const data = await response.json();
                debugLog(`${selectedDateValue} のルール:`, data);

                restoreSelection();

                enforceSingleActive();

                // DOMの現在の状態を確認
                const timeSlots = document.querySelectorAll('.time-slot');
                debugLog(`現在の時間枠数: ${timeSlots.length}`);
                
                // 各スロットのクラスを確認
                const slotInfo = [];
                timeSlots.forEach(slot => {
                    const time = slot.getAttribute('data-time');
                    const classes = slot.className;
                    const hasLimited = slot.classList.contains('is-limited');
                    slotInfo.push(`${time}: ${classes} (limited=${hasLimited})`);
                });
                debugLog('スロット情報:', slotInfo);
            } catch (error) {
                debugLog('エラー:', {error: error.message});
            }
        }
        
        function forceApplyColors() {
            debugLog('色を強制適用中...');
            const timeSlots = document.querySelectorAll('.time-slot');
            let appliedCount = 0;
            
            debugLog(`見つかった時間枠: ${timeSlots.length}個`);
            
            timeSlots.forEach(slot => {
                const time = slot.getAttribute('data-time');
                debugLog(`スロット: ${time}`);
                
                if (['18:00', '18:30', '19:00', '19:30', '20:00', '20:30'].includes(time)) {
                    // 既存のクラスを削除
                    slot.classList.remove('is-available', 'is-full');
                    slot.classList.add('is-limited');
                    
                    // インラインスタイルを強制適用
                    slot.setAttribute('style', 'background: linear-gradient(135deg, #ffb74d 0%, #ff9800 100%) !important; border: 2px solid #ff9800 !important;');
                    
                    const statusText = slot.querySelector('.status-text');
                    if (statusText) {
                        statusText.textContent = '残り1組';
                        statusText.style.color = '#ff6f00';
                    }
                    
                    debugLog(`✅ ${time} に色を適用`);
                    appliedCount++;
                }
            });
            
            debugLog(`結果: ${appliedCount}個のスロットに色を適用`);
            
            // DOMの状態を確認
            setTimeout(() => {
                const limitedSlots = document.querySelectorAll('.is-limited');
                debugLog(`is-limitedクラスを持つ要素: ${limitedSlots.length}個`);
                limitedSlots.forEach(slot => {
                    const time = slot.getAttribute('data-time');
                    const style = slot.getAttribute('style');
                    debugLog(`${time}: style="${style}"`);
                });
            }, 100);
        }
        
        // 初期化
        window.onload = function() {
            initializeLiff();
            // ★ ページロード時の自動色適用は不要（日付選択時にloadTimeSlotsで適用される）
            // setTimeout(() => {
            //     console.log('[capacity] Initial load - fetching capacity data');
            //     refreshCapacityColors();
            // }, 500);
        };
        
        async function initializeLiff() {
            const LIFF_ID = window.LIFF_ID || '2007999490-oqz3PXdk';
            let liffReady = false;
            
            try {
                // LIFF初期化を試みる（失敗してもページは動作する）
                if (typeof liff !== 'undefined') {
                    try {
                        await liff.init({ liffId: LIFF_ID });
                        liffReady = true;
                        
                        if (!liff.isLoggedIn()) {
                            console.log('[LIFF] Not logged in - continue as guest');
                            // ログインを強制せず、ゲストとして続行
                        } else {
                            // LINEプロフィール情報を取得
                            userProfile = await liff.getProfile();
                            userId = userProfile.userId;
                            
                            // ユーザー情報を表示
                            document.getElementById('userInfo').style.display = 'flex';
                            document.getElementById('userName').textContent = userProfile.displayName;
                            
                            // プロフィール画像があれば表示
                            if (userProfile.pictureUrl) {
                                document.getElementById('userAvatar').innerHTML = 
                                    `<img src="${userProfile.pictureUrl}" style="width: 100%; height: 100%; border-radius: 50%; object-fit: cover;">`;
                            }
                            
                            // 既存顧客情報を取得
                            await loadCustomerInfo();
                        }
                    } catch (liffError) {
                        console.warn('[LIFF] init failed; continue as guest', liffError);
                        // エラーを表示するが、ページは続行
                        document.getElementById('userInfo').innerHTML = 
                            '<div style="color: #ff9800;">LINEログインは利用できませんが、予約は可能です</div>';
                    }
                } else {
                    console.log('LIFF SDKが利用できません（ゲストモード）');
                    document.getElementById('userInfo').innerHTML = 
                        '<div style="color: #2196F3;">ゲストとして予約</div>';
                }
                
                // LIFF成功/失敗に関わらず、カレンダーを初期化
                initializeCalendar();
                
                // ★ デフォルトのSTORE_IDを設定
                window.STORE_ID = '***REMOVED-ROTATE-CREDENTIAL***';
                
                restoreSelection();
                enforceSingleActive();

                // DOM構築後の確実な容量色分け実行
                // setupCapacityObserver(); // 不要 - loadTimeSlotsで色が適用される
                
                // ★ LIFF初期化完了後の容量色取得は不要（日付選択時に適用）
                // console.log('[capacity] LIFF initialized - fetching capacity data');
                // refreshCapacityColors();
                
                // 日付変更監視
                // setupDateChangeListener(); // 不要 - loadTimeSlotsで色が適用される
                
                // フォームを表示
                document.getElementById('loading').style.display = 'none';
                document.getElementById('bookingForm').style.display = 'block';
                
            } catch (error) {
                console.error('初期化エラー:', error);
                // それでもカレンダーを表示
                initializeCalendar();
                document.getElementById('loading').style.display = 'none';
                document.getElementById('bookingForm').style.display = 'block';
            }
        }
        
        // ========== 専門家推奨Fix Pack開始 ==========
        
        // 1) 深いDOMを横断してtime-slotを拾う（iframe/shadow対応）
        async function deepFindAll(selector, root=document){
            const results=[]; 
            const visit=(node)=>{
                try{ results.push(...node.querySelectorAll(selector)); }catch(_){}
                const all=node.querySelectorAll('*');
                for(const el of all){ 
                    if(el.shadowRoot){ 
                        try{ results.push(...el.shadowRoot.querySelectorAll(selector)); }catch(_){}
                    }
                }
            };
            visit(root);
            for(const f of root.querySelectorAll('iframe')){
                try{
                    const doc=f.contentDocument || f.contentWindow?.document;
                    if(doc) results.push(...await deepFindAll(selector, doc));
                }catch(_){}
            }
            return results;
        }
        
        const toHHmm = s => {
            const t=String(s||'').trim().replace(/[：]/g,':'); 
            const m=t.match(/(\d{1,2}):(\d{2})/);
            return m?`${m[1].padStart(2,'0')}:${m[2]}`:null;
        };
        
        async function buildIndexDeep(){
            const idx=new Map();
            const nodes = await deepFindAll('.time-slot, [data-time], [data-time-value]');
            for(const n of nodes){
                const dt = n.getAttribute?.('data-time') || n.getAttribute?.('data-time-value');
                const txt = (n.textContent||'').replace(/[：]/g,':');
                const times = new Set();
                if(dt){ 
                    const k=toHHmm(dt); 
                    if(k) times.add(k); 
                }
                (txt.match(/\d{1,2}:\d{2}/g)||[]).forEach(x=>{ 
                    const k=toHHmm(x); 
                    if(k) times.add(k); 
                });
                for(const k of times){ 
                    if(!idx.has(k)) idx.set(k,n); 
                }
                if(!dt && times.size){ 
                    try{ n.setAttribute('data-time', [...times][0]); }catch(_){ } 
                }
            }
            console.log('[capacity] indexed times:', [...idx.keys()]);
            return idx;
        }
        
        // 2) API（availability + rules）をマージ → ステータス確定
        async function fetchAvailabilityAndRules(){
            const date = document.getElementById('selectedDate')?.value || new Date().toISOString().slice(0,10);
            const storeId = window.STORE_ID || '***REMOVED-ROTATE-CREDENTIAL***';
            
            console.log('\n=== DBデータ取得状況 ===');
            console.log(`📅 日付: ${date}`);
            
            // capacity-availabilityのみ使用（rulesはサーバー側で既にマージ済み）
            const aRes = await fetch(`/api/capacity-availability?store_id=${encodeURIComponent(storeId)}&date=${date}`);
            const avail = await aRes.json();
            
            // DBからデータが取得できたか確認
            if (avail.debug) {
                if (avail.debug.rules > 0) {
                    console.log(`✅ DBから${avail.debug.rules}件のルールを取得しました`);
                } else {
                    console.log('⚠️ DBにルールがありません');
                }
                console.log(`📆 予約数: ${avail.debug.reservations || 0}件`);
            }
            
            // 18:00-21:00の制限を確認
            const restrictedTimes = ['18:00', '18:30', '19:00', '19:30', '20:00', '20:30'];
            let dbRulesFound = false;
            
            for (const time of restrictedTimes) {
                if (avail.slots && avail.slots[time] && avail.slots[time].limit !== null) {
                    const slot = avail.slots[time];
                    console.log(`[DBルール] ${time}: limit=${slot.limit}, status=${slot.status}`);
                    dbRulesFound = true;
                }
            }
            
            if (dbRulesFound) {
                console.log('✅ DBから容量制限ルールが適用されています');
            } else {
                console.log('❌ DBに18:00-21:00の制限ルールがありません（デフォルト制限のみ）');
            }
            console.log('===================\n');
            
            return { avail, rules: {} };
        }
        
        function normalizeSlots(json){
            const out={}; 
            const src=json?.slots||{};
            for(const [k,v] of Object.entries(src)){
                const t=toHHmm(k); 
                if(!t) continue;
                const limit = v?.limit ?? null;
                const reserved = v?.reserved ?? 0;
                const status = v?.status ?? (limit!=null && reserved>=limit ? 'full' : limit!=null && reserved>0 ? 'limited' : 'available');
                out[t]={limit,reserved,status,...v};
            }
            return out;
        }
        
        // 3) ペインタ（クラス付け）＋再描画対策
        function setSlotClass(node, status){
            node.classList.remove('is-available','is-limited','is-full',
                                 'capacity-available','capacity-limited','capacity-full',
                                 'limited','full','available');
            if(status==='full'){ 
                node.classList.add('is-full','capacity-full','disabled'); 
            }
            else if(status==='limited'){ 
                node.classList.add('is-limited','capacity-limited','limited'); 
            }
            else { 
                node.classList.add('is-available','capacity-available','available'); 
            }
            node.setAttribute('data-capacity-label', status);
        }
        
        async function paintCapacityDeep(map){
            const idx = window.__TIME_NODE_INDEX__ || await buildIndexDeep();
            const missing=[];
            for(const [t,info] of Object.entries(map||{})){
                const node=idx.get(t); 
                if(!node){ 
                    missing.push(t); 
                    continue; 
                }
                const status = info?.status ?? (info?.limit!=null && info?.reserved>=info?.limit ? 'full'
                              : info?.limit!=null && info?.reserved>0 ? 'limited' : 'available');
                setSlotClass(node, status);
                
                // 表示テキストも更新
                if(status === 'full' && !node.innerHTML.includes('満席')) {
                    const timeText = t;
                    node.innerHTML = `<div style="font-weight: 600;">${timeText}</div><div style="font-size: 11px; margin-top: 4px;">✕ 満席</div>`;
                } else if(status === 'limited' && !node.innerHTML.includes('残り')) {
                    const timeText = t;
                    const remainingText = info?.limit === 1 ? '残り1組' : '残りわずか';
                    node.innerHTML = `<div style="font-weight: 600;">${timeText}</div><div style="font-size: 11px; margin-top: 4px;">⚠ ${remainingText}</div>`;
                }
            }
            if(missing.length) console.warn('[capacity] DOMに無い時刻:', missing.join(', '));
        }
        
        // DOM再描画でクラスが消されても再適用
        function attachCapacityObserver(){
            if(window.__capacityObsDeep) return;
            window.__capacityObsDeep = new MutationObserver(async () => {
                // 短いデバウンス
                clearTimeout(window.__capacityObsTimer);
                window.__capacityObsTimer = setTimeout(async () => {
                    window.__TIME_NODE_INDEX__ = await buildIndexDeep();
                    await paintCapacityDeep(window.__mergedSlots__||{});
                }, 100);
            });
            const attach=(root)=>window.__capacityObsDeep.observe(root,{childList:true,subtree:true});
            attach(document);
            document.querySelectorAll('iframe').forEach(f=>{ 
                try{
                    const doc=f.contentDocument||f.contentWindow?.document; 
                    if(doc) attach(doc);
                }catch(_){ }
            });
        }
        
        // 5) まとめて実行する関数
        async function applyCapacityColors(){
            try {
                // 1) データ取得 & マージ
                const { avail, rules } = await fetchAvailabilityAndRules();
                const slots = normalizeSlots(avail);
                window.__mergedSlots__ = slots;
                
                // 2) インデックス作成 & 塗り
                window.__TIME_NODE_INDEX__ = await buildIndexDeep();
                await paintCapacityDeep(slots);
                
                // 3) 再描画監視
                attachCapacityObserver();
                console.log('[capacity] applied - slots:', Object.keys(slots).length);
            } catch(e) {
                console.error('[capacity] applyCapacityColors failed:', e);
            }
        }
        
        // ========== 専門家推奨Fix Pack終了 ==========
        
        // 堅牢な容量色分けシステム（既存のコード）
        function hhmm(s){ return String(s||'').slice(0,5); }
        
        function normalizeSlots(raw){
            // 新しいAPI形式 { ok, store_id, date, slots: { "18:00": { limit, reserved, available, status }, ... } }
            const slots = raw?.slots || {};
            const out = {};
            
            for (const [timeKey, slotData] of Object.entries(slots)) {
                const t = hhmm(timeKey);
                if (slotData && typeof slotData === 'object') {
                    out[t] = { 
                        limit: slotData.limit,
                        reserved: slotData.reserved || 0,
                        available: slotData.available || 0,
                        status: slotData.status || 'available',
                        selectable: slotData.selectable !== false
                    };
                }
            }
            return out;
        }
        
        // ★直近スロットを保持（専門家推奨）
        let __latestCapacitySlots = null;

        // 変更の揺れを吸収する 1回限りディレイ（専門家推奨）
        function debounce(fn, ms=80){
            let t; 
            return (...a)=>{ 
                clearTimeout(t); 
                t=setTimeout(()=>fn(...a), ms); 
            };
        }

        // ★ Observer は「DOMが落ち着いたら塗る」＋「キャッシュがあれば即塗る」（専門家推奨）
        function setupCapacityObserver() {
            let observerActive = false;
            
            const apply = debounce(() => {
                if (observerActive) return; // ★ 再入防止
                observerActive = true;
                
                const count = document.querySelectorAll('[data-slot="time"], .time-slot, [data-time]').length;
                if (!count) {
                    observerActive = false;
                    return;
                }
                
                // ★ ログは1回だけ出力
                if (!setupCapacityObserver._logged) {
                    console.log('[capacity] applying (detected nodes=', count, ')');
                    setupCapacityObserver._logged = true;
                }
                
                // ★ APIをもう一度叩かず、直近の結果で塗る
                if (__latestCapacitySlots) {
                    paintCapacityFiltered(__latestCapacitySlots, true); // skipRetry=trueで無限ループ防止
                } else {
                    refreshCapacityColors();
                }
                
                setTimeout(() => { observerActive = false; }, 500); // 500ms後にフラグをリセット
            }, 120);

            // ★ 初回実行を遅延させて確実にDOMが準備できてから実行
            setTimeout(() => {
                apply(); // 初回
            }, 100);
            
            // ★ Observerは最初の5秒間だけ有効
            const mo = new MutationObserver(apply);
            mo.observe(document.body, { childList:true, subtree:true });
            
            setTimeout(() => {
                mo.disconnect();
                console.log('[capacity] MutationObserver disconnected after 5 seconds');
            }, 5000);
        }

        // 専門家推奨の日付変更監視
        function setupDateChangeListener() {
            // 2) 日付を変えたとき、カレンダーから選んだときにも必ず再実行
            document.addEventListener('change', e => {
                if (e.target.matches('[name="date"], .date-picker, .fc-daygrid-day')) {
                    const d = (e.target.value || new Date()).toString();
                    const dateISO = new Date(d).toISOString().slice(0,10);
                    refreshCapacityColors(dateISO);
                }
            });
            
            // カレンダーの日付クリックも監視
            document.addEventListener('click', e => {
                if (e.target.matches('.day, .fc-daygrid-day, [data-date]')) {
                    refreshCapacityColors();
                }
            });
        }

        // 堅牢なスロット検出（専門家推奨版・改良版）
        function findSlotNode(hhmm) {
            // 1) 属性検索（最優先）
            let el = document.querySelector(`[data-slot="time"][data-time="${hhmm}"]`)
                  || document.querySelector(`[data-time="${hhmm}:00"]`);
            if (el) return el;

            // 2) data-time 正規化一致（"19:00:00" 等）
            for (const n of document.querySelectorAll('[data-time]')) {
                const t = String(n.getAttribute('data-time')||'').slice(0,5);
                if (t === hhmm) return n;
            }

            // 3) テキスト先頭一致（最後の砦）
            const pool = document.querySelectorAll('[data-slot="time"], .time-slot, .slot, .btn-time, button, li, div');
            for (const n of pool) {
                const txt = (n.textContent||'').replace(/\s/g,'');
                if (txt.startsWith(hhmm)) return n;
            }
            return null;
        }

        function applySlotColor(node, mode) {
            if (!node) return;
            node.classList.remove('is-full','is-limited','is-available');
            // CSSに勝つため "インライン !important" を併用（専門家推奨）
            if (mode === 'full') {
                node.classList.add('is-full');
                node.style.setProperty('background', '#dc3545', 'important');
                node.style.setProperty('color', '#fff', 'important');
            } else if (mode === 'limited') {
                node.classList.add('is-limited');
                node.style.setProperty('background', '#ffc107', 'important');
                node.style.setProperty('color', '#000', 'important');
            } else {
                node.classList.add('is-available');
                node.style.setProperty('background', '#28a745', 'important');
                node.style.setProperty('color', '#fff', 'important');
            }
        }
        
        // ★塗り処理を分離＆キャッシュ（専門家推奨）
        function paintCapacity(slots) {
            __latestCapacitySlots = slots; // ★キャッシュ更新
            
            // ★ フィルタリングバージョンを呼び出し
            paintCapacityFiltered(slots);
        }
        
        // ★ フィルタリング版（コンソールで実行されていたコード）
        function paintCapacityFiltered(map, skipRetry = false) {
            const idx = window.__TIME_NODE_INDEX__ || buildIndex();
            const missing = [];
            for (const [time, info] of Object.entries(map||{})) {
                const t1 = HH(time), t2 = H_(time);
                const node = (t1 && idx.get(t1)) || (t2 && idx.get(t2)) || null;
                if (!node) { missing.push(HH(time)||time); continue; }
                
                // ★ 既存のクラスを完全にクリア
                node.classList.remove('capacity-available','capacity-limited','capacity-full', 'available', 'limited', 'full', 'is-available', 'is-limited', 'is-full', 'disabled', 'moderate', 'is-moderate');
                
                const v = info||{};
                const status = v.status ?? ((v.limit!=null && v.reserved>=v.limit) ? 'full' 
                              : (v.limit!=null && v.reserved>0) ? 'limited' : 'available');
                
                // ★ 既存のインラインスタイルを完全にクリアしてから再設定
                const timeText = time.slice(0,5); // HH:mm形式に正規化
                
                if (status === 'full') {
                    node.className = 'time-slot capacity-full is-full disabled';
                    // スタイルを完全にリセット
                    node.setAttribute('style', '');
                    node.style.cssText = 'padding: 12px !important; background: linear-gradient(135deg, #ff6b6b 0%, #ff5252 100%) !important; border-radius: 10px !important; text-align: center !important; color: white !important; pointer-events: none !important; cursor: not-allowed !important; opacity: 0.9 !important; border: 2px solid #ff3333 !important; box-shadow: 0 2px 5px rgba(255, 82, 82, 0.3) !important;';
                    // テキストも更新
                    node.innerHTML = `<div style="font-weight: 600; color: white;">${timeText}</div><div style="font-size: 11px; margin-top: 4px; color: #ffe0e0; font-weight: bold;">✕ 満席</div>`;
                    node.onclick = null; // クリックイベントを無効化
                } else if (status === 'limited') {
                    node.className = 'time-slot capacity-limited is-limited limited';
                    node.setAttribute('style', '');
                    node.style.cssText = 'padding: 12px !important; background: linear-gradient(135deg, #ffb74d 0%, #ff9800 100%) !important; border-radius: 10px !important; text-align: center !important; color: white !important; cursor: pointer !important; border: 2px solid #ff6f00 !important; box-shadow: 0 2px 5px rgba(255, 152, 0, 0.3) !important;';
                    const remainingText = (v.limit === 1) ? '残り1組' : '残りわずか';
                    node.innerHTML = `<div style="font-weight: 600; color: white;">${timeText}</div><div style="font-size: 11px; margin-top: 4px; color: #fff3e0; font-weight: bold;">⚠ ${remainingText}</div>`;
                    // onclickイベントは維持（選択可能）
                } else {
                    node.className = 'time-slot capacity-available is-available available';
                    node.setAttribute('style', '');
                    node.style.cssText = 'padding: 12px !important; background: linear-gradient(135deg, #81c784 0%, #4caf50 100%) !important; border-radius: 10px !important; text-align: center !important; color: white !important; cursor: pointer !important; transition: all 0.3s !important; border: 2px solid #2e7d32 !important; box-shadow: 0 2px 5px rgba(76, 175, 80, 0.3) !important;';
                    node.innerHTML = `<div style="font-weight: 600; color: white;">${timeText}</div><div style="font-size: 11px; margin-top: 4px; color: #e8f5e9;">◯ 空席あり</div>`;
                    // onclickイベントは維持（選択可能）
                }
                
                node.setAttribute('data-capacity-label', status);
                node.setAttribute('data-time', HH(time)); // 補正を書き戻し
            }
            
            // ★ エラーメッセージは初回のみ表示
            if (missing.length && !paintCapacityFiltered._warned) {
                console.warn('[capacity] APIにあるがDOMになかった時刻(フィルタ後):', missing.join(', '));
                paintCapacityFiltered._warned = true;
            }
            
            // ★ 300ms後に1回だけ再塗り（skipRetryで無限ループを防ぐ）
            if (!skipRetry) {
                clearTimeout(paintCapacityFiltered._t);
                paintCapacityFiltered._t = setTimeout(() => {
                    if (__latestCapacitySlots) paintCapacityFiltered(__latestCapacitySlots, true);
                }, 300);
            }
        }
        
        // ★ ヘルパー関数
        function HH(t) { const m = String(t).match(/(\d{1,2}):(\d{2})/); return m ? `${m[1].padStart(2,'0')}:${m[2]}` : null; }
        function H_(t) { const m = String(t).match(/(\d{1,2}):(\d{2})/); return m ? `${parseInt(m[1])}:${m[2]}` : null; }
        
        function buildIndex() {
            const idx = new Map();
            // data-time属性を優先的にインデックス化
            document.querySelectorAll('[data-time]').forEach(n => {
                const t = n.getAttribute('data-time');
                if (t) {
                    // 両方の形式でインデックスに登録
                    idx.set(HH(t), n);  // "09:00" 形式
                    idx.set(H_(t), n);  // "9:00" 形式
                    // 元の形式でも登録
                    idx.set(t, n);
                }
            });
            // テキストからも探す（バックアップ）
            document.querySelectorAll('.time-slot, button').forEach(n => {
                const txt = n.textContent || '';
                const m = txt.match(/(\d{1,2}):(\d{2})/);
                if (m) {
                    const hh = HH(`${m[1]}:${m[2]}`);
                    const h_ = H_(`${m[1]}:${m[2]}`);
                    if (!idx.has(hh)) idx.set(hh, n);
                    if (!idx.has(h_)) idx.set(h_, n);
                }
            });
            window.__TIME_NODE_INDEX__ = idx;
            return idx;
        }

        // ★ refreshCapacityColors は取得だけ → 受け取ったら paintCapacity を呼ぶ（専門家推奨）
        async function refreshCapacityColors(dateISO){
            try {
                const date = dateISO || new Date().toISOString().slice(0,10);
                const storeId = window.STORE_ID || '***REMOVED-ROTATE-CREDENTIAL***';
                console.log('[capacity] Fetching capacity for date:', date, 'store:', storeId);
                const url  = `/api/capacity-availability?store_id=${encodeURIComponent(storeId)}&date=${encodeURIComponent(date)}`;
                const data = await fetch(url).then(r=>r.json());
                const slots = normalizeSlots(data);
                console.log('[capacity] normalized=', slots);
                paintCapacity(slots);                    // ★ ここで塗る
                
                // ★ 取得直後に即座に適用（DOMが準備できている場合）
                const timeNodes = document.querySelectorAll('[data-slot="time"], .time-slot, [data-time]');
                if (timeNodes.length > 0) {
                    console.log('[capacity] Found', timeNodes.length, 'time nodes, applying colors immediately');
                    paintCapacityFiltered(slots, true);
                }
            } catch(e) {
                console.warn('[capacity] fetch/apply failed', e);
            }
        }
        
        // 既存顧客情報を読み込み
        async function loadCustomerInfo() {
            try {
                // 現在のURLからベースURLを動的に取得
                const currentUrl = window.location.href;
                let baseUrl = window.API_BASE_URL || 'https://line-booking-api-116429620992.asia-northeast1.run.app';

                if (!window.API_BASE_URL) {
                    if (currentUrl.includes('booking-account1')) {
                        baseUrl = 'https://booking-account1-116429620992.asia-northeast1.run.app';
                    } else if (currentUrl.includes('booking-account2')) {
                        baseUrl = 'https://booking-account2-116429620992.asia-northeast1.run.app';
                    }
                }

                const response = await fetch(`${baseUrl}/api/customer-info?line_user_id=${encodeURIComponent(userId || '')}`);
                
                if (response.ok) {
                    const data = await response.json();
                    
                    if (data.found) {
                        customerData = data.customer;
                        
                        // フォームに自動入力
                        document.getElementById('customerName').value = customerData.name;
                        document.getElementById('phone').value = customerData.phone;
                        if (customerData.email) {
                            document.getElementById('email').value = customerData.email;
                        }
                        
                        // リピーター表示
                        document.getElementById('returningCustomer').classList.add('show');
                        
                        // 訪問回数表示
                        if (customerData.visit_count > 1) {
                            document.getElementById('returningCustomer').innerHTML = 
                                `✨ おかえりなさい！${customerData.visit_count}回目のご利用ありがとうございます`;
                        }
                    }
                }
            } catch (error) {
                console.error('顧客情報取得エラー:', error);
            }
        }
        
        // カレンダー初期化
        function initializeCalendar() {
            const calendar = document.getElementById('calendar');
            if (!calendar) { return; }
            calendar.innerHTML = ''; // reset to avoid duplicate months
            const today = new Date();
            const currentMonth = today.getMonth();
            const currentYear = today.getFullYear();
            
            // 曜日ヘッダー
            const weekdays = ['日', '月', '火', '水', '木', '金', '土'];
            weekdays.forEach(day => {
                const weekdayEl = document.createElement('div');
                weekdayEl.className = 'weekday';
                weekdayEl.textContent = day;
                calendar.appendChild(weekdayEl);
            });
            
            // 月の最初の日と最後の日を取得
            const firstDay = new Date(currentYear, currentMonth, 1).getDay();
            const lastDate = new Date(currentYear, currentMonth + 1, 0).getDate();
            
            // 空白を追加
            for (let i = 0; i < firstDay; i++) {
                const emptyEl = document.createElement('div');
                calendar.appendChild(emptyEl);
            }
            
            // 日付を追加
            for (let day = 1; day <= lastDate; day++) {
                const dayEl = document.createElement('div');
                dayEl.className = 'day';
                dayEl.textContent = day;
                
                const date = new Date(currentYear, currentMonth, day);
                const dateStr = formatDate(date);
                
                // 今日の日付をハイライト
                if (day === today.getDate()) {
                    dayEl.classList.add('today');
                }
                
                // 過去の日付は無効化（当日は予約可能）
                const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
                const currentDateObj = new Date(currentYear, currentMonth, day);
                if (currentDateObj < todayStart) {
                    dayEl.classList.add('disabled');
                } else {
                    dayEl.onclick = () => selectDate(dateStr, dayEl);
                }
                
                calendar.appendChild(dayEl);
            }
        }
        
        // 日付選択
        async function selectDate(date, element) {
            // 選択状態をリセット
            document.querySelectorAll('.day').forEach(el => {
                el.classList.remove('selected');
            });
            
            element.classList.add('selected');
            selectedDate = date;
            document.getElementById('selectedDate').value = date;
            selectedKey = null;
            clearAllActive();
            if (date) {
                window.currentDateStr = date;
            }
            
            // 時間枠を取得して表示
            await loadTimeSlots(date);
        }
        
        // 時間枠を読み込み
        async function loadTimeSlots(date) {
            if (date) {
                window.currentDateStr = date;
            }
            const timeSlotsContainer = document.getElementById('timeSlots');
            timeSlotsContainer.innerHTML = '<div style="grid-column: 1/-1;">読み込み中...</div>';
            
            try {
                // 現在のURLからベースURLを動的に取得
                const currentUrl = window.location.href;
                let baseUrl = window.API_BASE_URL || 'https://line-booking-api-116429620992.asia-northeast1.run.app';

                if (!window.API_BASE_URL) {
                    if (currentUrl.includes('booking-account1')) {
                        baseUrl = 'https://booking-account1-116429620992.asia-northeast1.run.app';
                    } else if (currentUrl.includes('booking-account2')) {
                        baseUrl = 'https://booking-account2-116429620992.asia-northeast1.run.app';
                    }
                }

                // サーバーから正しいstore_idを取得
                const configResponse = await fetch(`${baseUrl}/api/config`);
                const config = await configResponse.json();
                const storeId = resolveStoreId(config.storeId);
                
                // ★ window.STORE_IDを設定してrefreshCapacityColorsが使えるように
                window.STORE_ID = storeId;
                
                // LIFFページはLocalStorageにアクセスできないので、
                // サーバー側でハードコードされたルールを使用する
                // または、APIで動的に設定する
                
                // 新しいAPIを使って予約状況を取得
                const response = await fetch(
                    `${baseUrl}/api/capacity-availability?date=${date}&store_id=${storeId}&t=${Date.now()}`,
                    { cache: 'no-cache' }
                );
                const data = await response.json();
                
                if (!data.ok) {
                    throw new Error(data.warn || data.error || 'Failed to fetch availability');
                }
                
                // デバッグ用: APIレスポンスをコンソールに出力
                console.log('Capacity API Response:', data);
                console.log('18:00 slot:', data.slots ? data.slots['18:00'] : 'No slots data');
                console.log('19:00 slot:', data.slots ? data.slots['19:00'] : 'No slots data');
                
                // 時間枠を表示
                const defaultTimes = [
                    '11:00', '11:30', '12:00', '12:30', '13:00', '13:30',
                    '14:00', '14:30', '15:00', '15:30', '16:00', '16:30',
                    '17:00', '17:30', '18:00', '18:30', '19:00', '19:30',
                    '20:00', '20:30', '21:00', '21:30'
                ];
                const times = data.slots ? Object.keys(data.slots).sort((a, b) => a.localeCompare(b)) : defaultTimes;
                timeSlotsContainer.innerHTML = '';
                
                times.forEach(time => {
                    const slot = data.slots ? data.slots[time] : {
                        status: 'available',
                        selectable: true,
                        message: '空席あり',
                        limit: null,
                        reserved: 0,
                        available: 999
                    };
                    if (!slot) {
                        console.warn(`No slot data for ${time}, using default`);
                        return;
                    }
                    
                    // デバッグ: 制限がある時間のスロット情報を詳細に出力
                    if (slot.limit !== null || slot.status === 'limited' || slot.status === 'full') {
                        console.log(`[DEBUG] ${time} slot:`, {
                            status: slot.status,
                            limit: slot.limit,
                            reserved: slot.reserved,
                            available: slot.available
                        });
                    }
                    
                    const timeSlot = document.createElement('div');
                    timeSlot.setAttribute('data-time', time); // data-time属性を追加
                    timeSlot.setAttribute('data-slot', 'time'); // data-slot
                    timeSlot.setAttribute('data-date', date);
                    timeSlot.classList.add('time-slot');
                    timeSlot.setAttribute('role', 'button');
                    timeSlot.setAttribute('tabindex', '0');
                    timeSlot.setAttribute('aria-pressed', 'false');
                    timeSlot.setAttribute('aria-selected', 'false'); // 基本クラスを確実に追加
                    
                    // 制限を考慮したステータス判定
                    let displayStatus = slot.status;
                    
                    // limit=1の場合は特別な表示
                    if (slot.limit === 1) {
                        if (slot.available === 0) {
                            displayStatus = 'full';
                        } else {
                            displayStatus = 'limited'; // limit=1で空きがある場合は「残りわずか」
                        }
                    }
                    
                    // 状態に応じてクラスとスタイルを設定
                    if (displayStatus === 'full' || slot.available === 0) {
                        // 満席 - 赤色表示で選択不可
                        timeSlot.className = 'time-slot disabled is-full';
                        timeSlot.style.cssText = 'padding: 12px !important; background: linear-gradient(135deg, #ff6b6b 0%, #ff5252 100%) !important; border-radius: 10px !important; text-align: center !important; color: white !important; pointer-events: none !important; cursor: not-allowed !important; opacity: 0.9 !important; border: 2px solid #ff3333 !important; box-shadow: 0 2px 5px rgba(255, 82, 82, 0.3) !important;';
                        timeSlot.dataset.baseStyle = timeSlot.style.cssText;
                        timeSlot.innerHTML = `<div style="font-weight: 600; color: white;">${time}</div><div style="font-size: 11px; margin-top: 4px; color: #ffe0e0; font-weight: bold;">✕ 満席</div>`;
                        // クリックイベントは設定しない（選択不可）
                    } else if (displayStatus === 'limited') {
                        // もうすぐ満席 - オレンジ色表示
                        timeSlot.className = 'time-slot limited is-limited';
                        timeSlot.style.cssText = 'padding: 12px !important; background: linear-gradient(135deg, #ffb74d 0%, #ff9800 100%) !important; border-radius: 10px !important; text-align: center !important; color: white !important; cursor: pointer !important; border: 2px solid #ff6f00 !important; box-shadow: 0 2px 5px rgba(255, 152, 0, 0.3) !important;';
                        timeSlot.dataset.baseStyle = timeSlot.style.cssText;
                        const remainingText = slot.message || (slot.limit === 1 ? '残り1組' : '残りわずか');
                        timeSlot.innerHTML = `<div style="font-weight: 600; color: white;">${time}</div><div style="font-size: 11px; margin-top: 4px; color: #fff3e0; font-weight: bold;">⚠ ${remainingText}</div>`;
                        if (slot.selectable !== false) {
                            timeSlot.dataset.clickable = 'true';
                        } else {
                            timeSlot.classList.add('disabled');
                            timeSlot.setAttribute('aria-disabled', 'true');
                            timeSlot.removeAttribute('tabindex');
                        }
                    } else if (displayStatus === 'moderate') {
                        // 中程度 - 黄色表示
                        timeSlot.className = 'time-slot moderate is-moderate';
                        timeSlot.style.cssText = 'padding: 12px !important; background: linear-gradient(135deg, #ffd54f 0%, #ffb300 100%) !important; border-radius: 10px !important; text-align: center !important; color: #333 !important; cursor: pointer !important; border: 2px solid #ffa000 !important; box-shadow: 0 2px 5px rgba(255, 179, 0, 0.3) !important;';
                        timeSlot.dataset.baseStyle = timeSlot.style.cssText;
                        const moderateText = slot.message || '空席あり';
                        timeSlot.innerHTML = `<div style="font-weight: 600; color: #333;">${time}</div><div style="font-size: 11px; margin-top: 4px; color: #795548;">${moderateText}</div>`;
                        if (slot.selectable !== false) {
                            timeSlot.dataset.clickable = 'true';
                        } else {
                            timeSlot.classList.add('disabled');
                            timeSlot.setAttribute('aria-disabled', 'true');
                            timeSlot.removeAttribute('tabindex');
                        }
                    } else {
                        // 空席あり - 緑色表示
                        timeSlot.className = 'time-slot available is-available';
                        timeSlot.style.cssText = 'padding: 12px !important; background: linear-gradient(135deg, #81c784 0%, #4caf50 100%) !important; border-radius: 10px !important; text-align: center !important; color: white !important; cursor: pointer !important; transition: all 0.3s !important; border: 2px solid #2e7d32 !important; box-shadow: 0 2px 5px rgba(76, 175, 80, 0.3) !important;';
                        timeSlot.dataset.baseStyle = timeSlot.style.cssText;
                        const availableText = slot.message || '◯ 空席あり';
                        timeSlot.innerHTML = `<div style="font-weight: 600; color: white;">${time}</div><div style="font-size: 11px; margin-top: 4px; color: #e8f5e9;">${availableText}</div>`;
                        if (slot.selectable !== false) {
                            timeSlot.dataset.clickable = 'true';
                        } else {
                            timeSlot.classList.add('disabled');
                            timeSlot.setAttribute('aria-disabled', 'true');
                            timeSlot.removeAttribute('tabindex');
                        }
                    }
                    
                    timeSlotsContainer.appendChild(timeSlot);
                });
                
                restoreSelection();
                enforceSingleActive();

                // DOM構築完了後に専門家推奨の容量色分けを適用
                console.log(`[capacity] loadTimeSlots finished, applying expert capacity colors`);
                
                // 専門家推奨Fix Packを実行
                setTimeout(async () => {
                    await applyCapacityColors();
                    console.log('[capacity] Expert fix pack applied after loadTimeSlots');
                }, 100);
                
                // 念のため500ms後にも再適用
                setTimeout(async () => {
                    const slots = document.querySelectorAll('.time-slot');
                    console.log(`[capacity] 500ms check: found ${slots.length} .time-slot elements`);
                    if (slots.length > 0) {
                        await applyCapacityColors();
                    }
                }, 500);
                
            } catch (error) {
                console.error('時間枠取得エラー:', error);
                timeSlotsContainer.innerHTML = '<div style="grid-column: 1/-1; color: red;">エラーが発生しました</div>';
            }
        }
        
        // 時間選択
                function selectTime(time, element) {
            if (!element) {
                return;
            }

            if (
                element.classList.contains('disabled') ||
                element.matches('[aria-disabled="true"]') ||
                element.style.cssText.includes('ff6b6b')
            ) {
                const warningDiv = document.createElement('div');
                warningDiv.style.cssText = `
                    position: fixed;
                    top: 50%;
                    left: 50%;
                    transform: translate(-50%, -50%);
                    background: white;
                    padding: 20px;
                    border-radius: 10px;
                    box-shadow: 0 4px 20px rgba(0,0,0,0.3);
                    z-index: 10000;
                    max-width: 320px;
                    text-align: center;
                    border: 2px solid #ff5252;
                `;
                warningDiv.innerHTML = `
                    <div style="color: #ff5252; font-size: 20px; font-weight: 700; margin-bottom: 10px;">⚠️ 予約できません</div>
                    <div style="color: #333; margin-bottom: 15px; font-size: 16px; line-height: 1.6;">
                        申し訳ありません。<br>
                        <strong>${time}</strong> は満席のため<br>
                        ご予約いただけません。
                    </div>
                    <button onclick="this.parentElement.remove()" style="
                        background: #667eea;
                        color: white;
                        border: none;
                        padding: 10px 30px;
                        border-radius: 5px;
                        font-size: 16px;
                        cursor: pointer;
                    ">閉じる</button>
                `;
                document.body.appendChild(warningDiv);

                setTimeout(() => {
                    if (warningDiv.parentElement) {
                        warningDiv.remove();
                    }
                }, 3000);
                return;
            }

            const dateValue =
                document.getElementById('selectedDate')?.value ||
                selectedDate ||
                element.dataset.date ||
                window.currentDateStr ||
                '';

            const selection = selectSlot(element, { time, date: dateValue });
            if (!selection) {
                return;
            }

            selectedTime = selection.time;
            selectedTimeStr = selection.time;
            if (selection.date) {
                selectedDate = selection.date;
                window.currentDateStr = selection.date;
            }

            const hiddenField = document.getElementById('selectedTime');
            if (hiddenField) {
                hiddenField.value = selection.time;
            }

            const timeDisplay = document.querySelector('.section-title:nth-of-type(2)');
            if (timeDisplay) {
                timeDisplay.innerHTML = `<span class="section-number">2</span>時間を選択 <span style="color: #667eea; font-weight: bold;">（${selection.time} 選択中）</span>`;
            }

            enforceSingleActive();
        }

        function validateForm() {
            let isValid = true;
            
            // 名前チェック
            const name = document.getElementById('customerName').value.trim();
            if (!name) {
                document.getElementById('nameError').classList.add('show');
                document.getElementById('customerName').classList.add('error');
                isValid = false;
            } else {
                document.getElementById('nameError').classList.remove('show');
                document.getElementById('customerName').classList.remove('error');
            }
            
            // 電話番号チェック
            const phone = document.getElementById('phone').value.trim();
            if (!phone || !/^[0-9\-\+]+$/.test(phone)) {
                document.getElementById('phoneError').classList.add('show');
                document.getElementById('phone').classList.add('error');
                isValid = false;
            } else {
                document.getElementById('phoneError').classList.remove('show');
                document.getElementById('phone').classList.remove('error');
            }
            
            // 人数チェック
            const people = document.getElementById('people').value;
            if (!people) {
                document.getElementById('peopleError').classList.add('show');
                document.getElementById('people').classList.add('error');
                isValid = false;
            } else {
                document.getElementById('peopleError').classList.remove('show');
                document.getElementById('people').classList.remove('error');
            }
            
            // 日付と時間チェック
            if (!selectedDate || !selectedTime) {
                alert('日付と時間を選択してください');
                isValid = false;
            }
            
            return isValid;
        }
        
        // 予約送信
        async function submitReservation() {
            if (!validateForm()) {
                return;
            }
            
            const submitBtn = document.getElementById('submitBtn');
            submitBtn.disabled = true;
            submitBtn.textContent = '送信中...';
            
            // 予約前に容量を再チェック
            try {
                const currentUrl = window.location.href;
                let baseUrl = window.API_BASE_URL || 'https://line-booking-api-116429620992.asia-northeast1.run.app';

                if (!window.API_BASE_URL) {
                    if (currentUrl.includes('booking-account1')) {
                        baseUrl = 'https://booking-account1-116429620992.asia-northeast1.run.app';
                    } else if (currentUrl.includes('booking-account2')) {
                        baseUrl = 'https://booking-account2-116429620992.asia-northeast1.run.app';
                    }
                }

                const configResponse = await fetch(`${baseUrl}/api/config`);
                const config = await configResponse.json();
                const storeId = resolveStoreId(config.storeId);
                
                // 容量チェック
                const capacityResponse = await fetch(
                    `${baseUrl}/api/capacity-availability?date=${selectedDate}&store_id=${storeId}&t=${Date.now()}`,
                    { cache: 'no-cache' }
                );
                const capacityData = await capacityResponse.json();
                
                if (capacityData.success && capacityData.availability[selectedTime]) {
                    const slot = capacityData.availability[selectedTime];
                    if (slot.status === 'full') {
                        // 満席の場合はエラー表示
                        const errorDiv = document.createElement('div');
                        errorDiv.style.cssText = `
                            position: fixed;
                            top: 50%;
                            left: 50%;
                            transform: translate(-50%, -50%);
                            background: white;
                            padding: 25px;
                            border-radius: 10px;
                            box-shadow: 0 4px 20px rgba(0,0,0,0.3);
                            z-index: 10000;
                            max-width: 350px;
                            text-align: center;
                            border: 3px solid #ff5252;
                        `;
                        errorDiv.innerHTML = `
                            <div style="color: #ff5252; font-size: 24px; margin-bottom: 15px;">⚠️ 予約できません</div>
                            <div style="color: #333; margin-bottom: 20px; font-size: 16px; line-height: 1.5;">
                                申し訳ございません。<br>
                                <strong>${selectedTime}</strong> は満席となりました。<br>
                                他の時間帯をお選びください。
                            </div>
                            <button onclick="this.parentElement.remove(); location.reload();" style="
                                background: #667eea;
                                color: white;
                                border: none;
                                padding: 12px 40px;
                                border-radius: 5px;
                                font-size: 16px;
                                cursor: pointer;
                            ">時間を選び直す</button>
                        `;
                        document.body.appendChild(errorDiv);
                        
                        submitBtn.disabled = false;
                        submitBtn.textContent = '予約を確定する';
                        return;
                    }
                }
            } catch (error) {
                console.error('容量チェックエラー:', error);
                // エラーがあっても続行（サーバー側でもチェックするため）
            }
            
            try {
                // 必須要素の存在確認
                const customerNameEl = document.getElementById('customerName');
                const phoneEl = document.getElementById('phone');
                const emailEl = document.getElementById('email');
                const peopleEl = document.getElementById('people');
                const messageEl = document.getElementById('message');
                
                if (!customerNameEl || !phoneEl || !peopleEl) {
                    throw new Error('必須フォーム要素が見つかりません');
                }
                
                // 現在のURLからベースURLを動的に取得
                const currentUrl = window.location.href;
                let baseUrl = window.API_BASE_URL || 'https://line-booking-api-116429620992.asia-northeast1.run.app';

                if (!window.API_BASE_URL) {
                    if (currentUrl.includes('booking-account1')) {
                        baseUrl = 'https://booking-account1-116429620992.asia-northeast1.run.app';
                    } else if (currentUrl.includes('booking-account2')) {
                        baseUrl = 'https://booking-account2-116429620992.asia-northeast1.run.app';
                    }
                }

                // サーバーから正しいstore_idを取得
                const configResponse = await fetch(`${baseUrl}/api/config`);
                const config = await configResponse.json();
                
                const reservationData = {
                    store_id: resolveStoreId(config.storeId),
                    user_id: userId || null,
                    customer_name: customerNameEl.value.trim(),
                    customer_phone: phoneEl.value.trim(),
                    customer_email: emailEl ? emailEl.value.trim() : null,
                    date: selectedDate,
                    time: selectedTime,
                    people: parseInt(peopleEl.value),
                    numberOfPeople: parseInt(peopleEl.value), // サーバー側の両方のフィールド名に対応
                    seat_preference: null, // 座席選択フィールドは存在しない
                    message: messageEl ? messageEl.value.trim() : '',
                    source: 'liff'
                };
                
                // APIに送信
                const response = await fetch(`${baseUrl}/api/reservation/create`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(reservationData)
                });
                
                const result = await response.json();
                
                if (response.ok && result.success) {
                    // 成功画面を表示
                    document.getElementById('bookingForm').style.display = 'none';
                    document.getElementById('successMessage').style.display = 'block';
                    document.getElementById('confirmationDetails').innerHTML = `
                        📅 ${selectedDate}<br>
                        ⏰ ${selectedTime}<br>
                        👤 ${reservationData.customer_name}様<br>
                        👥 ${reservationData.people}名様<br><br>
                        予約番号: ${result.reservation_id.slice(0, 8).toUpperCase()}
                    `;
                    
                    // 顧客情報保存表示
                    if (!customerData) {
                        document.getElementById('infoSaved').classList.add('show');
                    }
                    
                    // 座席情報を取得して表示
                    let seatInfo = '未割り当て';
                    try {
                        const seatResponse = await fetch(`/api/seat-assignments?reservation_id=${result.reservation_id}`);
                        if (seatResponse.ok) {
                            const seatData = await seatResponse.json();
                            if (seatData && seatData.seat) {
                                seatInfo = `${seatData.seat.name}`;
                                document.getElementById('seatDetails').innerHTML = `🪑 座席: ${seatInfo}`;
                            } else {
                                document.getElementById('seatDetails').innerHTML = `🪑 座席: 到着時にご案内いたします`;
                            }
                        }
                    } catch (error) {
                        console.error('座席情報取得エラー:', error);
                        document.getElementById('seatDetails').innerHTML = `🪑 座席: 到着時にご案内いたします`;
                    }
                    
                    // LINEトークにメッセージ送信
                    if (liff.isInClient()) {
                        liff.sendMessages([{
                            type: 'text',
                            text: `✅ 予約完了\n\n📅 ${selectedDate}\n⏰ ${selectedTime}\n👥 ${reservationData.people}名\n🪑 座席: ${seatInfo}\n\n予約番号: ${result.reservation_id.slice(0, 8).toUpperCase()}\n\n確認のご連絡をお待ちください。`
                        }]);
                    }
                    
                    // 3秒後にLIFFを閉じる
                    setTimeout(() => {
                        liff.closeWindow();
                    }, 3000);
                    
                } else {
                    throw new Error(result.message || '予約の作成に失敗しました');
                }
                
            } catch (error) {
                console.error('予約エラー:', error);
                
                // エラーメッセージを表示
                let errorMessage = 'エラーが発生しました';
                if (error.message) {
                    errorMessage = error.message;
                } else if (typeof error === 'string') {
                    errorMessage = error;
                }
                
                // エラー表示用のメッセージボックスを作成
                const errorDiv = document.createElement('div');
                errorDiv.style.cssText = `
                    position: fixed;
                    top: 50%;
                    left: 50%;
                    transform: translate(-50%, -50%);
                    background: white;
                    padding: 20px;
                    border-radius: 10px;
                    box-shadow: 0 4px 20px rgba(0,0,0,0.3);
                    z-index: 10000;
                    max-width: 300px;
                    text-align: center;
                `;
                errorDiv.innerHTML = `
                    <div style="color: #e74c3c; font-size: 18px; font-weight: bold; margin-bottom: 10px;">
                        ⚠️ 予約エラー
                    </div>
                    <div style="color: #333; margin-bottom: 15px;">
                        ${errorMessage}
                    </div>
                    <button onclick="this.parentElement.remove()" style="
                        background: #667eea;
                        color: white;
                        border: none;
                        padding: 10px 20px;
                        border-radius: 5px;
                        font-size: 16px;
                        cursor: pointer;
                    ">閉じる</button>
                `;
                document.body.appendChild(errorDiv);
                
                // 5秒後に自動で消す
                setTimeout(() => {
                    if (errorDiv.parentElement) {
                        errorDiv.remove();
                    }
                }, 5000);
                
                submitBtn.disabled = false;
                submitBtn.textContent = '予約を確定する';
            }
        }
        
        // 日付フォーマット
        function formatDate(date) {
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
        }
        
        // フォーム入力時のエラー解除
        document.addEventListener('DOMContentLoaded', () => {
            bindSlotDelegation();
            enforceSingleActive();
            restoreSelection();
            // 専門家推奨：DOMContentLoadedでも容量オブザーバーを起動
            // setupCapacityObserver(); // 不要 - loadTimeSlotsで色が適用される
            
            // ★ DOMContentLoadedでの容量色取得も不要
            // setTimeout(() => {
            //     console.log('[capacity] DOMContentLoaded - fetching capacity data');
            //     const dateInput = document.getElementById('date');
            //     if (dateInput && dateInput.value) {
            //         refreshCapacityColors(dateInput.value);
            //     } else {
            //         refreshCapacityColors();
            //     }
            // }, 300);
            
            // 予約ボタンのイベントリスナー
            document.getElementById('submitBtn').addEventListener('click', function(e) {
                e.preventDefault();
                submitReservation();
            });
            
            document.getElementById('customerName').addEventListener('input', function() {
                if (this.value.trim()) {
                    document.getElementById('nameError').classList.remove('show');
                    this.classList.remove('error');
                }
            });
            
            document.getElementById('phone').addEventListener('input', function() {
                if (this.value.trim() && /^[0-9\-\+]+$/.test(this.value)) {
                    document.getElementById('phoneError').classList.remove('show');
                    this.classList.remove('error');
                }
            });
            
            document.getElementById('people').addEventListener('change', function() {
                if (this.value) {
                    document.getElementById('peopleError').classList.remove('show');
                    this.classList.remove('error');
                }
            });
        });
    








































































