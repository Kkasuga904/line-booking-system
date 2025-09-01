# URLパスとハンバーガーメニュー問題のナレッジ

## 1. URLパス問題

### 問題の症状
- `/public/admin-full-featured.html`でアクセスすると機能が正常に動作しない
- ハンバーガーメニューが表示されない、または古いバージョンが表示される

### 根本原因
Express.jsの静的ファイル配信設定により、`public`ディレクトリがルートとしてマウントされている：
```javascript
app.use(express.static(path.join(__dirname, 'public')));
```

### 正しいアクセス方法
```
✅ 正しい: https://[domain]/admin-full-featured.html
❌ 間違い: https://[domain]/public/admin-full-featured.html
```

### 実装した再発防止策

#### 1. クライアント側の自動リダイレクト
```javascript
// publicディレクトリが含まれている場合は自動でリダイレクト
if (window.location.pathname.includes('/public/')) {
    const correctPath = window.location.pathname.replace('/public/', '/');
    window.location.replace(correctPath + window.location.search);
}
```

#### 2. サーバー側のリダイレクト
```javascript
app.get('/public/*', (req, res) => {
    const correctPath = req.path.replace('/public/', '/');
    res.redirect(301, correctPath);
});
```

## 2. ハンバーガーメニュー消失問題

### 問題の症状
- DOMには存在するが画面に表示されない
- 時間経過とともに消える
- クリックできない

### よくある原因

#### 1. z-index競合
- 他の要素（FullCalendarなど）が上に被さる
- **解決**: z-index: 2147483647（最大値）を使用

#### 2. transformによるスタッキングコンテキスト
- 親要素にtransformがあるとposition:fixedが効かない
- **解決**: documentElement直下にポータル配置

#### 3. 外部CSS競合
- admin-common.css、sidebar-menu.cssが上書き
- **解決**: インラインスタイルで!important使用

#### 4. キャッシュ問題
- 古いファイルがキャッシュされている
- **解決**: Cache-Control: no-storeをHTMLに設定

### 実装した再発防止策

#### 1. HTMLに直接配置（JSに依存しない）
```html
<body>
    <!-- ポータル用固定ノード（JSに頼らない） -->
    <div id="app-portals" style="position:fixed;inset:0;pointer-events:none;z-index:2147483647">
        <button id="portal-hamburger" style="...">≡</button>
    </div>
```

#### 2. 自己修復機能（MutationObserver）
```javascript
// DOMの変更を監視し、メニューが消えたら自動復元
const observer = new MutationObserver(() => {
    ensureHamburgerExists();
});
observer.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true
});
```

#### 3. 定期チェック（フェイルセーフ）
```javascript
// 5秒ごとに存在確認と修復
setInterval(ensureHamburgerExists, 5000);
```

#### 4. Cache-Control設定
```javascript
// HTMLファイルのキャッシュを完全無効化
if (filepath.endsWith('.html')) {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
}
```

## 3. トラブルシューティング手順

### ステップ1: URL確認
1. ブラウザのアドレスバーを確認
2. `/public/`が含まれていないか確認
3. 含まれていれば自動リダイレクトされるはず

### ステップ2: バージョン確認
```javascript
// コンソールで実行
fetch('/__version').then(r => r.json()).then(console.log);
```

### ステップ3: 要素診断
```javascript
// 最前面の要素を確認
document.elementFromPoint(20, 20);

// ハンバーガーの状態確認
const hb = document.getElementById('portal-hamburger');
console.log(getComputedStyle(hb));
```

### ステップ4: キャッシュクリア
1. Ctrl+Shift+R（強制リロード）
2. シークレットウィンドウで開く
3. URLに`?v=時刻`を追加

### ステップ5: オーバーレイ無効化
```javascript
// 被さっている要素を無効化
Array.from(document.querySelectorAll('*')).filter(el => {
    const cs = getComputedStyle(el);
    return el.offsetWidth >= innerWidth*0.9 && 
           el.offsetHeight >= innerHeight*0.9 && 
           parseInt(cs.zIndex||0) >= 1000;
}).forEach(n => n.style.pointerEvents = 'none');
```

## 4. 診断用コンソールコマンド集

```javascript
// 1. 現在のビルドバージョン
console.log('BUILD:', window.__BUILD__);

// 2. サーバーバージョン
fetch('/__version').then(r => r.json()).then(v => console.log('SERVER:', v));

// 3. ハンバーガー存在確認
console.log({
    portal: !!document.getElementById('app-portals'),
    hamburger: !!document.getElementById('portal-hamburger'),
    fcButton: !!document.querySelector('.fc-appMenu-button')
});

// 4. 最前面要素
console.log('Top element:', document.elementFromPoint(20, 20));

// 5. 全診断実行
(() => {
    const diag = {
        url: window.location.pathname,
        build: window.__BUILD__,
        portal: !!document.getElementById('app-portals'),
        hamburger: !!document.getElementById('portal-hamburger'),
        topElement: document.elementFromPoint(20, 20)?.tagName
    };
    console.table(diag);
})();
```

## 5. 今回の教訓

1. **URLパスの理解不足**
   - Express.staticの挙動を正しく理解していなかった
   - `/public/`を含めてアクセスしていたのが原因

2. **診断の重要性**
   - 最初に`elementFromPoint`で確認すべきだった
   - バージョン確認エンドポイントは必須

3. **防御的プログラミング**
   - 自己修復機能は必須
   - 複数の防御層を用意する

4. **キャッシュ対策**
   - 管理画面HTMLは必ず`no-store`
   - ビルド識別子を埋め込む

## 6. チェックリスト

### デプロイ前
- [ ] 正しいURLパス（/public/なし）を使用
- [ ] ビルド識別子を更新
- [ ] Cache-Control設定を確認

### デプロイ後
- [ ] `/__version`でバージョン確認
- [ ] ハンバーガーメニュー表示確認
- [ ] シークレットウィンドウでも確認
- [ ] コンソールにエラーがないか確認

## 7. 関連ファイル

- メインHTML: `/public/admin-full-featured.html`
- サーバー設定: `/server.js`
- ハンバーガー知識: `/KNOWLEDGE_HAMBURGER_MENU.md`
- URL ガイド: `/ADMIN_URL_GUIDE.md`