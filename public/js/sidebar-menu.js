/**
 * SIDEBAR MENU
 * ハンバーガーメニュー - クリック時のみ表示版
 */

document.addEventListener('DOMContentLoaded', () => {
  console.log('[sidebar-menu] 初期化開始');
  
  // 既存のハンバーガーメニューを削除
  const oldMenu = document.querySelector('.hamburger-menu');
  const oldToggle = document.querySelector('.hamburger-menu-toggle');
  const oldOverlay = document.querySelector('.hamburger-menu-overlay');
  
  if (oldMenu) oldMenu.remove();
  if (oldToggle) oldToggle.remove();
  if (oldOverlay) oldOverlay.remove();
  
  // ハンバーガーボタンを作成（常に表示）
  const hamburgerButton = document.createElement('button');
  hamburgerButton.className = 'hamburger-button';
  hamburgerButton.innerHTML = `
    <svg viewBox="0 0 24 24" fill="none">
      <path d="M3 12h18M3 6h18M3 18h18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
    </svg>
  `;
  hamburgerButton.setAttribute('aria-label', 'メニューを開く');
  
  // オーバーレイを作成（初期状態で非表示）
  const overlay = document.createElement('div');
  overlay.className = 'sidebar-overlay';
  overlay.style.display = 'none';
  
  // サイドバーコンテナを作成（初期状態で非表示）
  const sidebarContainer = document.createElement('div');
  sidebarContainer.className = 'sidebar-container';
  sidebarContainer.style.transform = 'translateX(-100%)';
  
  // サイドバーを作成
  const sidebar = document.createElement('div');
  sidebar.className = 'sidebar';
  sidebar.innerHTML = `
    <div class="sidebar-header">
      <div class="sidebar-logo">
        📋 <span>予約管理</span>
      </div>
      <button class="sidebar-close" aria-label="メニューを閉じる">
        <svg viewBox="0 0 24 24" fill="none">
          <path d="M6 18L18 6M6 6l12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
        </svg>
      </button>
    </div>
    
    <div class="sidebar-menu">
      <div class="menu-section">
        <div class="menu-section-title">
          <span>メイン</span>
        </div>
        <a href="/admin-dashboard.html" class="menu-item" data-tooltip="ダッシュボード">
          <span class="menu-item-icon">📊</span>
          <span class="menu-item-text">ダッシュボード</span>
        </a>
        <a href="/admin-list.html" class="menu-item" data-tooltip="予約一覧">
          <span class="menu-item-icon">📋</span>
          <span class="menu-item-text">予約一覧</span>
        </a>
        <a href="/admin-analytics.html" class="menu-item" data-tooltip="統計・分析">
          <span class="menu-item-icon">📈</span>
          <span class="menu-item-text">統計・分析</span>
        </a>
      </div>
      
      <div class="menu-section">
        <div class="menu-section-title">
          <span>管理</span>
        </div>
        <a href="/seats-management.html" class="menu-item" data-tooltip="座席管理">
          <span class="menu-item-icon">🪑</span>
          <span class="menu-item-text">座席管理</span>
        </a>
        <a href="/admin-settings.html" class="menu-item" data-tooltip="店舗設定">
          <span class="menu-item-icon">🏪</span>
          <span class="menu-item-text">店舗設定</span>
        </a>
        <a href="/capacity-control-enhanced.html" class="menu-item" data-tooltip="予約制限">
          <span class="menu-item-icon">🚫</span>
          <span class="menu-item-text">予約制限</span>
        </a>
        <a href="/staff-management.html" class="menu-item" data-tooltip="スタッフ管理">
          <span class="menu-item-icon">👥</span>
          <span class="menu-item-text">スタッフ管理</span>
        </a>
        <a href="/test-capacity-visual.html" class="menu-item" data-tooltip="空席状況">
          <span class="menu-item-icon">🎨</span>
          <span class="menu-item-text">空席状況ビジュアル</span>
        </a>
      </div>
      
      <div class="menu-section">
        <div class="menu-section-title">
          <span>レポート</span>
        </div>
        <a href="/admin-reports.html" class="menu-item" data-tooltip="売上レポート">
          <span class="menu-item-icon">💰</span>
          <span class="menu-item-text">売上レポート</span>
        </a>
        <a href="/customer-analytics.html" class="menu-item" data-tooltip="顧客分析">
          <span class="menu-item-icon">👤</span>
          <span class="menu-item-text">顧客分析</span>
        </a>
        <a href="/export-data.html" class="menu-item" data-tooltip="データエクスポート">
          <span class="menu-item-icon">📊</span>
          <span class="menu-item-text">データエクスポート</span>
        </a>
      </div>
      
      <div class="menu-section">
        <div class="menu-section-title">
          <span>通知</span>
        </div>
        <a href="/notifications.html" class="menu-item" data-tooltip="通知設定">
          <span class="menu-item-icon">🔔</span>
          <span class="menu-item-text">通知設定</span>
        </a>
        <a href="/email-templates.html" class="menu-item" data-tooltip="メールテンプレート">
          <span class="menu-item-icon">📧</span>
          <span class="menu-item-text">メールテンプレート</span>
        </a>
        <a href="/line-messages.html" class="menu-item" data-tooltip="LINE配信">
          <span class="menu-item-icon">💬</span>
          <span class="menu-item-text">LINE配信</span>
        </a>
      </div>
      
      <div class="menu-section">
        <div class="menu-section-title">
          <span>システム</span>
        </div>
        <a href="/admin-backup.html" class="menu-item" data-tooltip="バックアップ">
          <span class="menu-item-icon">💾</span>
          <span class="menu-item-text">バックアップ</span>
        </a>
        <a href="#" class="menu-item" data-tooltip="設定" onclick="event.preventDefault(); if(typeof showSettings !== 'undefined') showSettings(); else alert('設定画面は準備中です');">
          <span class="menu-item-icon">⚙️</span>
          <span class="menu-item-text">設定</span>
        </a>
        <a href="#" class="menu-item" data-tooltip="ヘルプ" onclick="event.preventDefault(); window.open('https://docs.line-booking.com', '_blank');">
          <span class="menu-item-icon">❓</span>
          <span class="menu-item-text">ヘルプ</span>
        </a>
        <a href="#" class="menu-item" data-tooltip="ログアウト" onclick="event.preventDefault(); if(confirm('ログアウトしますか？')) { localStorage.clear(); location.href='/login'; }">
          <span class="menu-item-icon">🚪</span>
          <span class="menu-item-text">ログアウト</span>
        </a>
      </div>
    </div>
  `;
  
  sidebarContainer.appendChild(sidebar);
  
  // 要素をページに追加
  document.body.appendChild(overlay);
  document.body.appendChild(sidebarContainer);
  document.body.appendChild(hamburgerButton);
  
  // 現在のページをハイライト
  const currentPath = window.location.pathname;
  const menuItems = sidebar.querySelectorAll('.menu-item');
  
  menuItems.forEach(item => {
    const href = item.getAttribute('href');
    if (href && href !== '#') {
      if (currentPath === href || 
          (href === '/admin-dashboard.html' && (currentPath === '/' || currentPath === '/admin-full-featured.html'))) {
        item.classList.add('active');
      }
    }
  });
  
  // サイドバーを開く関数
  function openSidebar() {
    sidebarContainer.style.transform = 'translateX(0)';
    overlay.style.display = 'block';
    setTimeout(() => {
      overlay.style.opacity = '1';
    }, 10);
    document.body.style.overflow = 'hidden';
  }
  
  // サイドバーを閉じる関数
  function closeSidebar() {
    sidebarContainer.style.transform = 'translateX(-100%)';
    overlay.style.opacity = '0';
    setTimeout(() => {
      overlay.style.display = 'none';
    }, 300);
    document.body.style.overflow = '';
  }
  
  // ハンバーガーボタンクリック時
  hamburgerButton.addEventListener('click', openSidebar);
  
  // 閉じるボタンクリック時
  const closeButton = sidebar.querySelector('.sidebar-close');
  closeButton.addEventListener('click', closeSidebar);
  
  // オーバーレイクリック時
  overlay.addEventListener('click', closeSidebar);
  
  // ESCキーで閉じる
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && sidebarContainer.style.transform === 'translateX(0)') {
      closeSidebar();
    }
  });
  
  console.log('[sidebar-menu] 初期化完了');
});