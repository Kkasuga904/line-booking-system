(() => {
  const statusEl = document.getElementById('status');
  const liffIdEl = document.getElementById('liff-id');
  const liffUrlEl = document.getElementById('liff-url');
  const liffLink = document.getElementById('open-liff');
  const entryLink = document.getElementById('open-entry');
  const qrLiff = document.getElementById('qr-liff');
  const qrEntry = document.getElementById('qr-entry');

  const ENTRY_URL = 'https://line-booking-api-116429620992.asia-northeast1.run.app/liff-booking.html';

  function setStatus(message) {
    if (statusEl) statusEl.textContent = message;
  }

  async function init() {
    try {
      setStatus('設定を取得しています…');
      const response = await fetch('/api/config', { headers: { Accept: 'application/json' }, cache: 'no-store' });
      if (!response.ok) throw new Error('config ' + response.status);
      const config = await response.json();
      const liffId = config && config.liffId;
      if (!liffId) {
        setStatus('LIFF ID が /api/config に見つかりません。環境変数 LIFF_ID を確認してください。');
        return;
      }

      const liffUrl = 'https://liff.line.me/' + encodeURIComponent(liffId);
      setStatus('現在の SoT (LIFF ID)');
      if (liffIdEl) liffIdEl.textContent = liffId;
      if (liffUrlEl) liffUrlEl.textContent = liffUrl;
      if (liffLink) liffLink.href = liffUrl;
      if (entryLink) entryLink.href = ENTRY_URL;

      if (qrLiff) qrLiff.src = 'https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=' + encodeURIComponent(liffUrl);
      if (qrEntry) qrEntry.src = 'https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=' + encodeURIComponent(ENTRY_URL);
    } catch (error) {
      console.error('[liff-check] init error', error);
      setStatus('初期化エラー: ' + error);
    }
  }

  document.addEventListener('DOMContentLoaded', init);
})();
