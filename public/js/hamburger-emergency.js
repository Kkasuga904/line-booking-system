/**
 * HAMBURGER EMERGENCY FIX
 * 最終手段のハンバーガーメニュー修正
 */

document.addEventListener('DOMContentLoaded', () => {
  console.log('[hamburger-emergency] 初期化開始');
  
  // メニュー要素を取得（どちらのID/クラスでも可）
  let menu = document.getElementById('hamburgerMenu') || document.querySelector('.hamburger-menu');

  // メニューが存在しない場合は作成
  if (!menu) {
    console.warn('[hamburger-emergency] メニューが見つからないので作成します');
    
    const header = document.querySelector('.header');
    if (!header) {
      console.error('[hamburger-emergency] .header が見つかりません');
      return;
    }
    
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
    header.insertBefore(menu, header.firstChild);
  }

  // 念のため強制表示（CSSで勝てないケースの保険）
  Object.assign(menu.style, { 
    display: 'block', 
    visibility: 'visible', 
    opacity: '1',
    position: 'fixed',
    top: '12px',
    right: '12px',
    zIndex: '9999'
  });

  const icon = menu.querySelector('.hamburger-icon');
  if (!icon) {
    console.error('[hamburger-emergency] .hamburger-icon が見つかりません');
    return;
  }

  // サイドメニューとオーバーレイを取得
  let sideMenu = document.getElementById('sideMenu') || document.querySelector('.side-menu');
  let overlay = document.getElementById('overlay') || document.querySelector('.overlay');

  // サイドメニューが存在しない場合は作成
  if (!sideMenu) {
    console.warn('[hamburger-emergency] サイドメニューを作成します');
    sideMenu = document.createElement('div');
    sideMenu.id = 'sideMenu';
    sideMenu.className = 'side-menu';
    sideMenu.innerHTML = `
      <div class="menu-section">
        <div class="menu-title">メニュー</div>
        <a href="/admin-full-featured.html" class="menu-item">📊 ダッシュボード</a>
        <a href="/admin-seat-management.html" class="menu-item">🪑 座席管理</a>
        <a href="/test-capacity-visual.html" class="menu-item">🧪 容量テスト</a>
      </div>
    `;
    document.body.appendChild(sideMenu);
  }

  // オーバーレイが存在しない場合は作成
  if (!overlay) {
    console.warn('[hamburger-emergency] オーバーレイを作成します');
    overlay = document.createElement('div');
    overlay.id = 'overlay';
    overlay.className = 'overlay';
    document.body.appendChild(overlay);
  }

  // トグル関数
  const toggleMenu = () => {
    const isActive = sideMenu.classList.toggle('active');
    overlay.classList.toggle('active', isActive);
    icon.classList.toggle('active', isActive);
    document.body.classList.toggle('menu-open', isActive);
    
    console.log('[hamburger-emergency] メニュー状態:', isActive ? '開' : '閉');
  };

  // 既存の toggleMenu があれば上書き
  window.toggleMenu = toggleMenu;

  // クリックハンドラー
  const clickHandler = (e) => {
    e.stopPropagation();
    e.preventDefault();
    toggleMenu();
  };

  // イベントリスナー設定
  icon.addEventListener('click', clickHandler, { passive: false });
  
  // HTMLのonclick属性を削除して新しいハンドラーに置き換え
  icon.removeAttribute('onclick');
  menu.removeAttribute('onclick');

  // オーバーレイクリックで閉じる
  overlay.addEventListener('click', () => {
    if (sideMenu.classList.contains('active')) {
      toggleMenu();
    }
  });

  // 外側クリックで閉じる
  document.addEventListener('click', (e) => {
    if (!sideMenu.classList.contains('active')) return;
    if (!sideMenu.contains(e.target) && !icon.contains(e.target) && !menu.contains(e.target)) {
      toggleMenu();
    }
  });

  // ESCキーで閉じる
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && sideMenu.classList.contains('active')) {
      toggleMenu();
    }
  });

  console.log('[hamburger-emergency] 初期化完了');
  
  // デバッグ情報
  console.log('[hamburger-emergency] 要素の状態:', {
    menu: menu ? '✅' : '❌',
    icon: icon ? '✅' : '❌',
    sideMenu: sideMenu ? '✅' : '❌',
    overlay: overlay ? '✅' : '❌',
    menuPosition: menu ? menu.getBoundingClientRect() : null,
    menuStyles: menu ? {
      display: getComputedStyle(menu).display,
      visibility: getComputedStyle(menu).visibility,
      position: getComputedStyle(menu).position,
      zIndex: getComputedStyle(menu).zIndex
    } : null
  });
});