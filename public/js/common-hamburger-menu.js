/**
 * COMMON HAMBURGER MENU
 * 全画面共通のハンバーガーメニュー
 */

document.addEventListener('DOMContentLoaded', () => {
  console.log('[common-hamburger] 初期化開始');
  
  // メニュー要素を取得または作成
  let menu = document.getElementById('hamburgerMenu') || document.querySelector('.hamburger-menu');

  if (!menu) {
    console.log('[common-hamburger] メニューを作成します');
    
    menu = document.createElement('div');
    menu.id = 'hamburgerMenu';
    menu.className = 'hamburger-menu';
    menu.innerHTML = `
      <div class="hamburger-icon">
        <span></span>
        <span></span>
        <span></span>
      </div>
    `;
    document.body.appendChild(menu);
  }

  // 左上に配置
  Object.assign(menu.style, { 
    display: 'block', 
    visibility: 'visible', 
    opacity: '1',
    position: 'fixed',
    top: '20px',
    left: '20px',
    right: 'auto',
    zIndex: '9999'
  });

  const icon = menu.querySelector('.hamburger-icon');
  if (!icon) {
    console.error('[common-hamburger] .hamburger-icon が見つかりません');
    return;
  }

  // サイドメニューとオーバーレイを取得または作成
  let sideMenu = document.getElementById('sideMenu') || document.querySelector('.side-menu');
  let overlay = document.getElementById('overlay') || document.querySelector('.overlay');

  // 共通メニュー内容
  const commonMenuHTML = `
    <div class="menu-header">
      <h3>メニュー</h3>
    </div>
    <div class="menu-section">
      <div class="menu-title">メイン</div>
      <a href="/admin-full-featured.html" class="menu-item">
        <span class="icon">📊</span> ダッシュボード
      </a>
      <a href="/admin-seat-management.html" class="menu-item">
        <span class="icon">🪑</span> 座席管理
      </a>
      <a href="/test-capacity-visual.html" class="menu-item">
        <span class="icon">🧪</span> 容量テスト
      </a>
      <hr>
      <div class="menu-title">予約管理</div>
      <a href="/admin-full-featured.html?view=calendar" class="menu-item">
        <span class="icon">📅</span> 予約一覧
      </a>
      <a href="/admin-full-featured.html?view=stats" class="menu-item">
        <span class="icon">📈</span> 統計・分析
      </a>
      <hr>
      <div class="menu-title">予約制限設定</div>
      <a href="#" class="menu-item" onclick="event.preventDefault(); if(typeof showCapacityModal !== 'undefined') showCapacityModal(); else alert('この画面では利用できません');">
        <span class="icon">🎯</span> 予約制限設定
      </a>
      <a href="/admin-seat-management.html" class="menu-item">
        <span class="icon">⚙️</span> 席管理・割り当て
      </a>
      <hr>
      <div class="menu-title">顧客向け</div>
      <a href="/liff-booking-enhanced.html" class="menu-item" target="_blank">
        <span class="icon">📱</span> LIFF予約画面
      </a>
    </div>
  `;

  if (!sideMenu) {
    console.log('[common-hamburger] サイドメニューを作成します');
    sideMenu = document.createElement('div');
    sideMenu.id = 'sideMenu';
    sideMenu.className = 'side-menu';
    sideMenu.innerHTML = commonMenuHTML;
    document.body.appendChild(sideMenu);
  } else {
    // 既存のサイドメニューの内容を共通内容に置き換え
    sideMenu.innerHTML = commonMenuHTML;
  }

  if (!overlay) {
    console.log('[common-hamburger] オーバーレイを作成します');
    overlay = document.createElement('div');
    overlay.id = 'overlay';
    overlay.className = 'overlay';
    document.body.appendChild(overlay);
  }

  // 現在のページをハイライト
  const currentPath = window.location.pathname;
  const menuItems = sideMenu.querySelectorAll('.menu-item');
  menuItems.forEach(item => {
    const href = item.getAttribute('href');
    if (href && href !== '#' && currentPath.includes(href.split('?')[0])) {
      item.classList.add('active');
    }
  });

  // トグル関数（×アニメーションなし）
  const toggleMenu = () => {
    const isActive = sideMenu.classList.toggle('active');
    overlay.classList.toggle('active', isActive);
    document.body.classList.toggle('menu-open', isActive);
    
    console.log('[common-hamburger] メニュー状態:', isActive ? '開' : '閉');
  };

  // グローバル関数として公開
  window.toggleMenu = toggleMenu;

  // クリックハンドラー
  const clickHandler = (e) => {
    e.stopPropagation();
    e.preventDefault();
    toggleMenu();
  };

  // イベントリスナー設定
  icon.addEventListener('click', clickHandler, { passive: false });
  
  // 既存のonclick属性を削除
  icon.removeAttribute('onclick');
  menu.removeAttribute('onclick');

  // オーバーレイクリックで閉じる
  overlay.addEventListener('click', () => {
    if (sideMenu.classList.contains('active')) {
      toggleMenu();
    }
  });

  // メニューアイテムのホバー効果
  const applyHoverEffects = () => {
    const items = sideMenu.querySelectorAll('.menu-item');
    items.forEach(item => {
      item.addEventListener('mouseenter', () => {
        if (!item.classList.contains('active')) {
          item.style.background = 'rgba(255, 255, 255, 0.25)';
        }
      });
      item.addEventListener('mouseleave', () => {
        if (!item.classList.contains('active')) {
          item.style.background = 'rgba(255, 255, 255, 0.1)';
        }
      });
    });
  };
  
  applyHoverEffects();

  // ESCキーで閉じる
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && sideMenu.classList.contains('active')) {
      toggleMenu();
    }
  });

  console.log('[common-hamburger] 初期化完了（共通メニュー）');
});