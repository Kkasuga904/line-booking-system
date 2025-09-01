// レスポンシブナビゲーション管理

export function initNav() {
    const btn = document.getElementById('hamburgerBtn');
    const side = document.getElementById('sideNav');
    const overlay = document.getElementById('pageOverlay');
    const closeBtn = document.querySelector('.sidenav-close');
    
    // 要素が見つからない場合は初期化を中止
    if (!side) {
        console.warn('sideNav element not found, skipping nav initialization');
        return;
    }
    
    // メディアクエリ
    const mqDesktop = window.matchMedia('(min-width: 1280px)');
    
    // フォーカストラップ用
    let lastFocus = null;
    let trapHandler = null;
    
    // ナビを開く
    function open() {
        side.classList.add('open');
        overlay.classList.add('active');
        overlay.hidden = false;
        btn?.setAttribute('aria-expanded', 'true');
        document.body.style.overflow = 'hidden'; // スクロール防止
        trapFocus(side);
    }
    
    // ナビを閉じる
    function close() {
        side.classList.remove('open');
        overlay.classList.remove('active');
        setTimeout(() => {
            overlay.hidden = true;
        }, 200);
        btn?.setAttribute('aria-expanded', 'false');
        document.body.style.overflow = ''; // スクロール復活
        releaseFocus();
    }
    
    // トグル
    function toggle() {
        if (side.classList.contains('open')) {
            close();
        } else {
            open();
        }
    }
    
    // フォーカストラップ
    function trapFocus(container) {
        lastFocus = document.activeElement;
        
        const focusables = container.querySelectorAll(
            'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        );
        
        if (focusables.length === 0) return;
        
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        
        // 最初の要素にフォーカス
        setTimeout(() => first?.focus(), 50);
        
        trapHandler = function(e) {
            if (e.key !== 'Tab') return;
            
            if (e.shiftKey && document.activeElement === first) {
                e.preventDefault();
                last?.focus();
            } else if (!e.shiftKey && document.activeElement === last) {
                e.preventDefault();
                first?.focus();
            }
        };
        
        document.addEventListener('keydown', trapHandler);
    }
    
    // フォーカストラップ解除
    function releaseFocus() {
        if (trapHandler) {
            document.removeEventListener('keydown', trapHandler);
            trapHandler = null;
        }
        lastFocus?.focus?.();
    }
    
    // デスクトップ/モバイル切り替え
    function syncLayout(e) {
        if (e.matches) {
            // デスクトップモード
            document.body.classList.add('has-sidenav');
            close(); // ドロワーは閉じる
        } else {
            // モバイル/タブレットモード
            document.body.classList.remove('has-sidenav');
        }
    }
    
    // 現在のページをアクティブ表示
    function setActiveNav() {
        const currentPath = window.location.pathname;
        const navLinks = document.querySelectorAll('#sideNav a');
        
        navLinks.forEach(link => {
            const href = link.getAttribute('href');
            if (href && currentPath.includes(href.replace('.html', ''))) {
                link.classList.add('active');
            } else {
                link.classList.remove('active');
            }
        });
    }
    
    // イベントリスナー設定
    btn?.addEventListener('click', toggle);
    overlay?.addEventListener('click', close);
    closeBtn?.addEventListener('click', close);
    
    // ESCキーで閉じる
    document.addEventListener('keydown', e => {
        if (e.key === 'Escape' && side?.classList.contains('open')) {
            close();
        }
    });
    
    // スワイプで閉じる（モバイル用）
    let touchStartX = 0;
    let touchEndX = 0;
    
    side?.addEventListener('touchstart', e => {
        touchStartX = e.touches[0].clientX;
    }, { passive: true });
    
    side?.addEventListener('touchend', e => {
        touchEndX = e.changedTouches[0].clientX;
        const swipeDistance = touchStartX - touchEndX;
        
        // 左スワイプで閉じる
        if (swipeDistance > 50 && side.classList.contains('open')) {
            close();
        }
    }, { passive: true });
    
    // メディアクエリ監視
    mqDesktop.addEventListener('change', syncLayout);
    syncLayout(mqDesktop);
    
    // アクティブページ設定
    setActiveNav();
    
    // ナビ内リンククリック時（モバイル）
    document.querySelectorAll('#sideNav a').forEach(link => {
        link.addEventListener('click', () => {
            if (!mqDesktop.matches) {
                setTimeout(close, 100);
            }
        });
    });
}

// DOM読み込み完了時に初期化
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initNav);
} else {
    initNav();
}

// デフォルトエクスポート
export default { initNav };