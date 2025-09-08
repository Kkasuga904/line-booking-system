// capacity-background-manager.js --- 明示起動・安全版
;(function () {
  function getCal(calArg) { return calArg || window.calendar || null; }

  function inView(cal, dateStr) {
    if (!cal || !cal.view) return false;
    const v = cal.view;
    const d = new Date(`${dateStr}T00:00:00`);
    return d >= v.activeStart && d < v.activeEnd;
  }

  function purgeCapacityBackgrounds(calArg) {
    const cal = getCal(calArg);
    if (!cal || typeof cal.getEvents !== 'function') return 0;
    const doomed = cal.getEvents()
      .filter(e => e.display === 'background' && !e.extendedProps?.__capacityControl);
    doomed.forEach(e => e.remove());
    return doomed.length;
  }

  function addCapacityBackgrounds(calArg, rules = [], storeIdArg) {
    const cal = getCal(calArg);
    if (!cal || typeof cal.addEvent !== 'function') return 0;
    const storeId = storeIdArg || window.GLOBAL_STORE_ID || 'default-store';

    let added = 0;
    cal.batchRendering(() => {
      rules.filter(r => r?.date && inView(cal, r.date)).forEach(r => {
        const s = r.startTime || '00:00';
        const e = r.endTime || '23:59';
        const id = `capacity-${r.date}-${s}-${e}-${storeId}`;
        if (cal.getEventById(id)) return; // 重複防止

        cal.addEvent({
          id,
          start: `${r.date}T${s}:00`,
          end:   `${r.date}T${e}:00`,
          display: 'background',
          backgroundColor: r.color || 'rgba(220,53,69,.3)',
          classNames: ['capacity-control'],
          extendedProps: { __capacityControl: true }
        });
        added += 1;
      });
    });
    return added;
  }

  async function loadRules(storeId) {
    try {
      if (typeof window.loadCapacityRulesFromDB === 'function') {
        const r = await window.loadCapacityRulesFromDB(storeId);
        if (Array.isArray(r) && r.length) return r;
      }
    } catch {}
    try {
      const raw = localStorage.getItem(`capacity_control_rules_${storeId}`) || '[]';
      const r = JSON.parse(raw);
      if (Array.isArray(r)) return r;
    } catch {}
    return [];
  }

  async function refreshCapacityBackgrounds(calArg) {
    const cal = getCal(calArg);
    if (!cal || typeof cal.getEvents !== 'function') return;
    const storeId = window.GLOBAL_STORE_ID || 'default-store';
    const rules = await loadRules(storeId);
    purgeCapacityBackgrounds(cal);
    addCapacityBackgrounds(cal, rules, storeId);
  }

  // ===== ここがポイント：自動起動しない。関数を window に公開だけする =====
  window.purgeCapacityBackgrounds    = purgeCapacityBackgrounds;
  window.addCapacityBackgrounds      = addCapacityBackgrounds;
  
  // refreshCapacityBackgroundsをdebounceでラップ（500msに増加）
  const originalRefresh = refreshCapacityBackgrounds;
  let debounceTimer;
  window.refreshCapacityBackgrounds = function(calArg) {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      originalRefresh(calArg);
    }, 500);  // 150ms → 500msに増加して頻度を下げる
  };

  // Calendar フックを外部から 1 回だけ張る関数を提供
  window.installCapacityBackgroundHooks = function (cal) {
    if (!cal || typeof cal.getEvents !== 'function') {
      if (window.APP_DEBUG) console.warn('[capacity-bg] Calendar not provided or invalid');
      return false;
    }

    if (window.__bgHooksInstalled__) {
      if (window.APP_DEBUG) console.log('[capacity-bg] Hooks already installed');
      return true;
    }

    // 初回反映
    refreshCapacityBackgrounds(cal);

    // FullCalendar v5では on() メソッドは存在しないので、代わりにグローバル関数を定義
    // admin-full-featured.htmlのcalendarオプションから呼び出される
    window.onCapacityDatesSet = function() {
      refreshCapacityBackgrounds(cal);
    };
    
    window.onCapacityEventsSet = function() {
      purgeCapacityBackgrounds(cal);
    };

    window.__bgHooksInstalled__ = true;
    if (window.APP_DEBUG) console.log('[capacity-bg] Hooks installed successfully');
    return true;
  };
  
  if (window.APP_DEBUG) {
    console.log('[capacity-bg] Manager loaded. Functions available:');
    console.log('  - window.refreshCapacityBackgrounds(calendar)');
    console.log('  - window.purgeCapacityBackgrounds(calendar)');
    console.log('  - window.addCapacityBackgrounds(rules)');
    console.log('  - window.installCapacityBackgroundHooks(calendar)');
  }
})();