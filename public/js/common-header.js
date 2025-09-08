// 共通ヘッダー・サイドバーコンポーネント
function initCommonHeader() {
    // 既存のヘッダーを削除
    const existingHeader = document.querySelector('.header');
    const existingSidebar = document.querySelector('.sidebar');
    if (existingHeader) existingHeader.remove();
    if (existingSidebar) existingSidebar.remove();

    // 共通スタイルを追加
    if (!document.getElementById('common-header-styles')) {
        const styles = document.createElement('style');
        styles.id = 'common-header-styles';
        styles.innerHTML = `
            /* 共通ヘッダースタイル */
            .common-header {
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                height: 60px;
                background: white;
                box-shadow: 0 2px 8px rgba(0,0,0,0.1);
                display: flex;
                align-items: center;
                padding: 0 20px;
                z-index: 999;
            }

            .common-hamburger {
                width: 30px;
                height: 24px;
                cursor: pointer;
                display: none;
                flex-direction: column;
                justify-content: space-between;
                margin-right: 20px;
            }

            .common-hamburger span {
                display: block;
                height: 3px;
                width: 100%;
                background: #333;
                border-radius: 3px;
                transition: 0.3s;
            }

            .common-hamburger.active span:nth-child(1) {
                transform: rotate(45deg) translate(5px, 5px);
            }

            .common-hamburger.active span:nth-child(2) {
                opacity: 0;
            }

            .common-hamburger.active span:nth-child(3) {
                transform: rotate(-45deg) translate(7px, -6px);
            }

            .common-header-content {
                flex: 1;
                display: flex;
                justify-content: space-between;
                align-items: center;
            }

            .common-header h1 {
                font-size: 18px;
                margin: 0;
                color: #333;
            }

            .common-nav-buttons {
                display: flex;
                gap: 10px;
            }

            .common-nav-btn {
                text-decoration: none;
                color: #333;
                padding: 8px 16px;
                border-radius: 8px;
                background: #f5f5f7;
                transition: all 0.3s;
                font-size: 14px;
            }

            .common-nav-btn:hover {
                background: #e0e0e2;
                transform: translateY(-1px);
            }

            /* 共通サイドバースタイル */
            .common-sidebar {
                position: fixed;
                top: 60px;
                left: 0;
                width: 260px;
                height: calc(100% - 60px);
                background: white;
                box-shadow: 2px 0 10px rgba(0,0,0,0.1);
                z-index: 998;
                overflow-y: auto;
                transition: transform 0.3s;
            }

            .common-sidebar-header {
                padding: 20px;
                border-bottom: 1px solid #eee;
            }

            .common-sidebar-header h2 {
                font-size: 16px;
                margin: 0;
                color: #333;
            }

            .common-nav-menu {
                padding: 10px 0;
            }

            .common-nav-item {
                display: block;
                padding: 12px 20px;
                color: #333;
                text-decoration: none;
                transition: background 0.3s;
                font-size: 14px;
            }

            .common-nav-item:hover {
                background: #f5f5f5;
            }

            .common-nav-item.active {
                background: #e8f4fd;
                color: #4a90e2;
                font-weight: 600;
                border-left: 3px solid #4a90e2;
            }

            /* ボディのパディング調整 */
            body.with-common-header {
                padding-top: 60px;
            }

            body.with-sidebar {
                padding-left: 260px;
            }

            /* レスポンシブデザイン */
            @media (max-width: 1024px) {
                .common-hamburger {
                    display: flex;
                }

                .common-sidebar {
                    transform: translateX(-100%);
                }

                .common-sidebar.active {
                    transform: translateX(0);
                }

                body.with-sidebar {
                    padding-left: 0;
                }

                .common-nav-buttons {
                    display: none;
                }
            }

            @media (max-width: 768px) {
                .common-header h1 {
                    font-size: 16px;
                }

                .common-header h1 span {
                    display: none;
                }
            }
        `;
        document.head.appendChild(styles);
    }

    // ヘッダーHTML
    const headerHTML = `
        <div class="common-header">
            <div class="common-hamburger" id="commonHamburger">
                <span></span>
                <span></span>
                <span></span>
            </div>
            <div class="common-header-content">
                <h1>
                    🎯 予約管理システム
                    <span style="font-size: 14px; color: #666; font-weight: normal;">LINE連携対応</span>
                </h1>
                <div class="common-nav-buttons">
                    <a href="/admin-full-featured.html" class="common-nav-btn">📋 管理画面</a>
                    <a href="/capacity-control-enhanced.html" class="common-nav-btn">🎯 予約制御</a>
                    <a href="/dashboard.html" class="common-nav-btn">📊 ダッシュボード</a>
                    <a href="/analytics.html" class="common-nav-btn">📈 分析</a>
                </div>
            </div>
        </div>
    `;

    // サイドバーHTML
    const sidebarHTML = `
        <div class="common-sidebar" id="commonSidebar">
            <div class="common-sidebar-header">
                <h2>📚 メニュー</h2>
            </div>
            <nav class="common-nav-menu">
                <a href="/admin-full-featured.html" class="common-nav-item ${location.pathname.includes('admin') ? 'active' : ''}">
                    📋 予約管理
                </a>
                <a href="/capacity-control-enhanced.html" class="common-nav-item ${location.pathname.includes('capacity') ? 'active' : ''}">
                    🎯 予約制御設定
                </a>
                <a href="/dashboard.html" class="common-nav-item ${location.pathname.includes('dashboard') ? 'active' : ''}">
                    📊 ダッシュボード
                </a>
                <a href="/analytics.html" class="common-nav-item ${location.pathname.includes('analytics') ? 'active' : ''}">
                    📈 分析レポート
                </a>
                <a href="/liff-booking.html" class="common-nav-item ${location.pathname.includes('liff') ? 'active' : ''}">
                    📱 LINE予約画面
                </a>
                <a href="/system-settings.html" class="common-nav-item ${location.pathname.includes('settings') ? 'active' : ''}">
                    ⚙️ システム設定
                </a>
            </nav>
        </div>
    `;

    // DOMに追加
    document.body.insertAdjacentHTML('afterbegin', headerHTML + sidebarHTML);
    document.body.classList.add('with-common-header');

    // PC画面では常にサイドバー表示
    if (window.innerWidth > 1024) {
        document.body.classList.add('with-sidebar');
        document.getElementById('commonSidebar').classList.add('active');
    }

    // ハンバーガーメニューのイベント
    const hamburger = document.getElementById('commonHamburger');
    const sidebar = document.getElementById('commonSidebar');

    hamburger.addEventListener('click', () => {
        hamburger.classList.toggle('active');
        sidebar.classList.toggle('active');
        
        // モバイルでサイドバー表示時は背景をクリック不可に
        if (window.innerWidth <= 1024) {
            if (sidebar.classList.contains('active')) {
                // オーバーレイを追加
                const overlay = document.createElement('div');
                overlay.id = 'sidebarOverlay';
                overlay.style.cssText = `
                    position: fixed;
                    top: 60px;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background: rgba(0,0,0,0.3);
                    z-index: 997;
                `;
                overlay.addEventListener('click', () => {
                    hamburger.classList.remove('active');
                    sidebar.classList.remove('active');
                    overlay.remove();
                });
                document.body.appendChild(overlay);
            } else {
                // オーバーレイを削除
                const overlay = document.getElementById('sidebarOverlay');
                if (overlay) overlay.remove();
            }
        }
    });

    // ウィンドウリサイズ時の処理
    window.addEventListener('resize', () => {
        if (window.innerWidth > 1024) {
            document.body.classList.add('with-sidebar');
            sidebar.classList.add('active');
            hamburger.classList.remove('active');
            const overlay = document.getElementById('sidebarOverlay');
            if (overlay) overlay.remove();
        } else {
            document.body.classList.remove('with-sidebar');
            if (!hamburger.classList.contains('active')) {
                sidebar.classList.remove('active');
            }
        }
    });
}

// 自動初期化
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initCommonHeader);
} else {
    initCommonHeader();
}