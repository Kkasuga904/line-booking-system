(async function () {
  'use strict';

  const statusNode = document.querySelector('main p');
  const render = (message) => {
    if (statusNode) statusNode.textContent = message;
  };

  try {
    render('設定を取得しています…');
    const response = await fetch('/api/config', {
      headers: { Accept: 'application/json' }
    });
    if (!response.ok) throw new Error('設定の取得に失敗しました');

    const config = await response.json();
    const liffId = config && config.liffId;
    if (!liffId) {
      render('LIFF ID が未設定です。管理者にお問い合わせください。');
      return;
    }

    render('LINE を初期化しています…');
    await liff.init({ liffId });

    if (!liff.isLoggedIn()) {
      render('LINE にログインしています…');
      liff.login({ redirectUri: window.location.href });
      return;
    }

    const sourceParams = new URLSearchParams(window.location.search);
    const forwardParams = new URLSearchParams();
    ['date', 'time'].forEach((key) => {
      const value = sourceParams.get(key);
      if (value) forwardParams.set(key, value);
    });

    const query = forwardParams.toString();
    const rawBase = (config && config.baseUrl) ? config.baseUrl : window.location.origin;
    const base = rawBase.replace(/\/+$/, '');
    const path = '/liff-booking-enhanced.html';
    const queryString = query ? ('?' + query) : '';
    const destination = base + path + queryString;
    render('予約ページへ移動しています…');
    window.location.replace(destination);
  } catch (error) {
    console.error('[liff]', error);
    render(`初期化エラー: ${String(error)}`);
  }
})();
