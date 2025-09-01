# ハンバーガーメニューが表示されない問題のナレッジ

## 問題の症状
- DOMには存在するが画面に表示されない
- 表示されてもクリックできない

## 根本原因の診断方法

### 1. 最初に実行すべき診断コード
```javascript
// 画面左上の最前面要素を特定
const el = document.elementFromPoint(20, 20);
console.log('最前面の要素:', el);

// ハンバーガーメニューの状態確認
const hb = document.querySelector('.hamburger-icon');
const cs = getComputedStyle(hb);
console.log({
  display: cs.display,
  visibility: cs.visibility, 
  zIndex: cs.zIndex,
  position: cs.position
});
```

## よくある原因と解決策

### 1. 外部CSSファイルの競合
**原因**: admin-common.css、sidebar-menu.cssなどが上書き
**解決**: 
- 外部CSSを無効化またはコメントアウト
- インラインスタイルで!importantを使用

### 2. z-indexの競合
**原因**: 他の要素（FullCalendarなど）が上に被さる
**解決**:
```css
.hamburger-icon {
  z-index: 100001 !important;
}
.fc, .fc-view-harness {
  z-index: 1;
}
```

### 3. transformによるスタッキングコンテキスト
**原因**: 親要素にtransformがあるとposition:fixedが効かない
**解決**:
```javascript
// ハンバーガーをbody直下に移動
const hb = document.querySelector('.hamburger-icon');
if (hb.parentElement !== document.body) {
  document.body.appendChild(hb);
}
```

### 4. 全画面オーバーレイ
**原因**: 透明な全画面要素がクリックを遮る
**解決**:
```css
.fullscreen-overlay {
  pointer-events: none;
}
.fullscreen-overlay .modal {
  pointer-events: auto;
}
```

### 5. キャッシュ問題
**原因**: 古いファイルがキャッシュされている
**解決**:
- Ctrl+Shift+R（強制リロード）
- Service Worker削除
- DevToolsでDisable cache

## 再発防止の実装

### 必須のCSS設定
```css
.hamburger-icon {
  position: fixed !important;
  z-index: 100001 !important;
  display: flex !important;
  visibility: visible !important;
  pointer-events: auto !important;
}

/* 親要素のtransformを無効化 */
.main-content, .header {
  transform: none !important;
}
```

### 初期化時の自動修正
```javascript
document.addEventListener('DOMContentLoaded', () => {
  const hb = document.querySelector('.hamburger-icon');
  if (hb) {
    // body直下に移動（transform回避）
    if (hb.parentElement !== document.body) {
      document.body.appendChild(hb);
    }
    // クリックイベント設定
    hb.addEventListener('click', () => toggleSidebar());
    // 可視性を保証
    hb.style.visibility = 'visible';
  }
});
```

### デバッグモード
問題が発生した場合、一時的にデバッグモードを有効化：
```javascript
const debugMode = true; // 問題解決後はfalseに
```

## チェックリスト
- [ ] 外部CSSファイルを無効化したか
- [ ] z-indexを100001以上に設定したか  
- [ ] !importantを付けたか
- [ ] body直下に配置したか
- [ ] pointer-eventsがautoか
- [ ] transformを持つ親要素がないか
- [ ] キャッシュをクリアしたか

## 時間がかかった理由
1. 要素の存在確認だけで満足し、実際に何が上に被さっているかを調べなかった
2. CSSの競合を最初から疑わなかった
3. transformによるスタッキングコンテキストの罠を見落とした
4. キャッシュ問題の可能性を後回しにした

**教訓**: 「要素はあるが見えない」場合は、必ず`elementFromPoint`で何が最前面にあるかを最初に確認する