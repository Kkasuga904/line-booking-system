/**
 * COMMON HAMBURGER MENU
 * 全画面共通のハンバーガーメニュー
 */

document.addEventListener('DOMContentLoaded', () => {
  console.log('[common-hamburger] 初期化開始');
  
  // ハンバーガーメニューボタンを作成
  const toggleButton = document.createElement('div');
  toggleButton.className = 'hamburger-menu-toggle';
  toggleButton.innerHTML = `
    <span></span>
    <span></span>
    <span></span>
  `;
  document.body.appendChild(toggleButton);

  // ハンバーガーメニューコンテナを作成
  const menuContainer = document.createElement('div');
  menuContainer.className = 'hamburger-menu';
  menuContainer.innerHTML = `
    <div class="menu-header">
      <h3>メニュー</h3>
      <button class="close-menu">×</button>
    </div>
    <div class="menu-section">
      <a href="/admin-full-featured.html">📊 ダッシュボード</a>
      <a href="/admin-seat-management.html">🪑 座席管理</a>
      <a href="/test-capacity-visual.html">🧪 容量テスト</a>
    </div>
    <div class="menu-section">
      <h4>予約管理</h4>
      <a href="/admin-full-featured.html?view=calendar">📅 予約カレンダー</a>
      <a href="/admin-full-featured.html?view=list">📋 予約一覧</a>
      <a href="/admin-full-featured.html?view=stats">📈 統計・分析</a>
    </div>
    <div class="menu-section">
      <h4>設定</h4>
      <a href="#" onclick="event.preventDefault(); if(typeof showCapacityModal !== 'undefined') showCapacityModal(); else alert('この画面では利用できません');">🎯 予約制限設定</a>
      <a href="/admin-seat-management.html">⚙️ 席管理設定</a>
    </div>
    <div class="menu-section">
      <h4>顧客向け</h4>
      <a href="/liff-booking-enhanced.html" target="_blank">📱 LIFF予約画面</a>
    </div>
  `;
  document.body.appendChild(menuContainer);

  // オーバーレイを作成
  const overlay = document.createElement('div');
  overlay.className = 'hamburger-menu-overlay';
  document.body.appendChild(overlay);

  // 現在のページをハイライト
  const currentPath = window.location.pathname;
  const menuLinks = menuContainer.querySelectorAll('a');
  menuLinks.forEach(link => {
    const href = link.getAttribute('href');
    if (href && href !== '#') {
      const linkPath = href.split('?')[0];
      if (currentPath === linkPath || (linkPath === '/' && currentPath === '/index.html')) {
        link.classList.add('active');
      }
    }
  });

  // メニューの開閉機能
  const toggleMenu = () => {
    const isActive = menuContainer.classList.contains('active');
    
    if (isActive) {
      // 閉じる
      menuContainer.classList.remove('active');
      overlay.classList.remove('active');
      toggleButton.classList.remove('active');
    } else {
      // 開く
      menuContainer.classList.add('active');
      overlay.classList.add('active');
      toggleButton.classList.add('active');
    }
    
    console.log('[common-hamburger] メニュー状態:', !isActive ? '開' : '閉');
  };

  // イベントリスナー設定
  toggleButton.addEventListener('click', toggleMenu);
  
  // 閉じるボタン
  const closeButton = menuContainer.querySelector('.close-menu');
  if (closeButton) {
    closeButton.addEventListener('click', toggleMenu);
  }

  // オーバーレイクリックで閉じる
  overlay.addEventListener('click', toggleMenu);

  // ESCキーで閉じる
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && menuContainer.classList.contains('active')) {
      toggleMenu();
    }
  });

  // 常に表示する（デスクトップでも表示）
  toggleButton.style.display = 'flex';

  console.log('[common-hamburger] 初期化完了');
});