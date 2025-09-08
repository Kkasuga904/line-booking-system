/**
 * ハンバーガーメニュー修正スクリプト
 */

document.addEventListener('DOMContentLoaded', function() {
    // ハンバーガーメニューの要素を確実に取得
    const hamburgerMenu = document.getElementById('hamburgerMenu');
    const hamburgerIcon = document.querySelector('.hamburger-icon');
    const sideMenu = document.getElementById('sideMenu');
    const overlay = document.getElementById('overlay');
    
    // ハンバーガーメニューが存在しない場合は作成
    if (!hamburgerMenu && document.querySelector('.header')) {
        const header = document.querySelector('.header');
        const newHamburger = document.createElement('div');
        newHamburger.className = 'hamburger-menu';
        newHamburger.id = 'hamburgerMenu';
        newHamburger.innerHTML = `
            <div class="hamburger-icon" onclick="toggleMenu()">
                <span></span>
                <span></span>
                <span></span>
            </div>
        `;
        header.insertBefore(newHamburger, header.firstChild);
    }
    
    // オーバーレイが存在しない場合は作成
    if (!overlay) {
        const newOverlay = document.createElement('div');
        newOverlay.className = 'overlay';
        newOverlay.id = 'overlay';
        newOverlay.onclick = function() {
            toggleMenu();
        };
        document.body.appendChild(newOverlay);
    }
    
    // グローバル関数として定義
    window.toggleMenu = function() {
        const menu = document.getElementById('sideMenu');
        const overlay = document.getElementById('overlay');
        const icon = document.querySelector('.hamburger-icon');
        
        if (menu) {
            menu.classList.toggle('active');
        }
        if (overlay) {
            overlay.classList.toggle('active');
        }
        if (icon) {
            icon.classList.toggle('active');
        }
    };
    
    // ハンバーガーアイコンのクリックイベント
    if (hamburgerIcon) {
        hamburgerIcon.addEventListener('click', function(e) {
            e.stopPropagation();
            toggleMenu();
        });
    }
    
    // メニュー項目のクリックでメニューを閉じる
    const menuItems = document.querySelectorAll('.menu-item');
    menuItems.forEach(item => {
        item.addEventListener('click', function() {
            const menu = document.getElementById('sideMenu');
            const overlay = document.getElementById('overlay');
            const icon = document.querySelector('.hamburger-icon');
            
            if (menu) menu.classList.remove('active');
            if (overlay) overlay.classList.remove('active');
            if (icon) icon.classList.remove('active');
        });
    });
    
    // ESCキーでメニューを閉じる
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            const menu = document.getElementById('sideMenu');
            const overlay = document.getElementById('overlay');
            const icon = document.querySelector('.hamburger-icon');
            
            if (menu && menu.classList.contains('active')) {
                menu.classList.remove('active');
                overlay.classList.remove('active');
                icon.classList.remove('active');
            }
        }
    });
    
    console.log('Hamburger menu fix loaded');
});