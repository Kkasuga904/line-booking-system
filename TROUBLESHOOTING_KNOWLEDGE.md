# LINE Booking System - Troubleshooting Knowledge Base

## Issue History & Solutions (2025-09-02)

### 1. System-Stabilizer.js Performance Crisis

#### Problem Description
- **Symptom**: "Long script execution detected: 1000ms" messages appearing every second in browser console
- **Impact**: Severe performance degradation, CSS disappearing, calendar not functioning
- **Root Cause**: system-stabilizer.js running performance monitoring with 1-second intervals

#### Code Analysis (system-stabilizer.js:167)
```javascript
// PROBLEM CODE - DO NOT USE
setInterval(() => {
    checkPerformance();
    monitorDOM();
}, 1000); // Running every second causing performance issues
```

#### Failed Solution Attempts
1. **Modified interval timing** - File remained cached
2. **Added DEBUG_MODE checks** - File remained cached  
3. **Commented out script tag** - Browser cache still served old file
4. **Deleted file** - Server still served cached version

#### Successful Solution
```javascript
// server.js - Return 410 Gone for system-stabilizer.js
const blockSystemStabilizer = (req, res, next) => {
    const path = req.path.toLowerCase();
    if (path.includes('system-stabilizer.js')) {
        res.status(410).set({
            'Content-Type': 'text/plain; charset=UTF-8',
            'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
            'Pragma': 'no-cache',
            'Expires': '0',
            'X-Robots-Tag': 'noindex',
            'Surrogate-Control': 'no-store'
        }).send('This resource has been permanently removed for performance reasons.');
        return;
    }
    next();
};
app.use(blockSystemStabilizer);
```

### 2. Google Cloud Run Deployment Failures

#### Problem Description
- **Error**: "gcloud crashed (PermissionError): [Errno 13] Permission denied: 'NTUSER.DAT'"
- **Cause**: Windows system files being included in deployment

#### Solution
Updated `.gcloudignore`:
```
NTUSER.DAT*
ntuser.dat*
System Volume Information/
*.lnk
```

### 3. Browser Cache Persistence

#### Problem Description
- Old JavaScript files served despite updates
- Cache-Control headers being ignored

#### Solution
Aggressive cache prevention headers:
```javascript
res.set({
    'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
    'Pragma': 'no-cache',
    'Expires': '0',
    'Surrogate-Control': 'no-store'
});
```

### 4. Timezone Display Issue

#### Problem Description
- Capacity control times showing 9-hour offset
- Setting: 18:00-21:00 displayed as 9:00-12:00
- Calendar configured for Asia/Tokyo but Date objects in wrong timezone

#### Root Cause
```javascript
// PROBLEM: Creates Date in browser's local timezone
const localDate = new Date(y, m - 1, d, H, Min, 0, 0);
```

#### Solution
```javascript
// FIXED: Return ISO string for FullCalendar to interpret in Asia/Tokyo
function makeLocalDate(dateStr, timeStr) {
    const dateTimeStr = `${dateStr}T${timeStr || '00:00'}:00`;
    return dateTimeStr; // Let FullCalendar handle timezone conversion
}
```

## Prevention Guidelines

### 1. Performance Monitoring
- **NEVER** use setInterval with intervals < 5 seconds for non-critical monitoring
- **ALWAYS** implement debug flags for performance monitoring code
- **CONSIDER** using requestIdleCallback for non-urgent background tasks

### 2. Static File Management
- **ALWAYS** implement versioning in script URLs: `script.js?v=20250902`
- **USE** aggressive cache headers for removed resources
- **IMPLEMENT** 410 Gone status for permanently removed files

### 3. Deployment Best Practices
- **MAINTAIN** comprehensive .gcloudignore file
- **EXCLUDE** all Windows system files from deployment
- **TEST** deployments with curl to verify changes

### 4. Timezone Handling
- **ALWAYS** specify timezone in calendar configurations
- **USE** ISO string format for date/time data exchange
- **LET** libraries handle timezone conversions when configured

### 5. Emergency Response Protocol
1. Check browser console for errors
2. Use curl to verify server responses
3. Clear browser cache and CloudFlare cache if applicable
4. Check deployment logs with gcloud logging
5. Implement middleware-level blocking for problematic resources

## Common Commands

### Check deployment status
```bash
gcloud run services list --region asia-northeast1
```

### View deployment logs
```bash
gcloud logging read "resource.type=cloud_run_revision" --limit=10 --format=json
```

### Force cache clear
```javascript
// Add version parameter to all static resources
const version = Date.now();
document.querySelectorAll('script, link').forEach(el => {
    const src = el.src || el.href;
    if (src) {
        el.src = el.href = src + '?v=' + version;
    }
});
```

## Critical Files to Monitor
- `/server.js` - Main application server
- `/public/admin-full-featured.html` - Admin interface
- `/public/js/` - All JavaScript files (especially monitoring scripts)
- `/.gcloudignore` - Deployment exclusions
- `/.env.yaml` - Environment configuration

## Lessons Learned
1. **Browser caching is aggressive** - Always implement server-side blocking for removed resources
2. **Performance monitoring can cause performance issues** - Ironic but true
3. **Timezone bugs are subtle** - Always test with actual timezone differences
4. **Deployment can include unexpected files** - Maintain strict .gcloudignore
5. **User feedback is critical** - "まだ駄目なんだが" means keep investigating

## Contact for Issues
- Check console logs first
- Use curl for server verification
- Document exact error messages
- Include screenshots when possible

## 5. サイドバー完全表示不具合の総括（2025-09-02）

### 問題の変遷
1. 初期：サイドバーが全く表示されない
2. 中期：画面が暗くなるだけでサイドバーが見えない
3. 後期：サイドバーは表示されるが外側クリックで閉じない

### 根本原因の全体像

#### 1. 複数のサイドバー実装の競合
```javascript
// 問題：3つの異なる実装が混在
1. HTMLに直接書かれた.sidebar
2. sidebar-menu.jsが動的生成するサイドバー
3. 外部CSSファイルのスタイル定義
```

#### 2. CSS位置制御の問題
```css
/* 問題1: leftプロパティ + !important */
.sidebar {
    left: -300px !important;  /* JSで変更不可 */
    transition: left 0.3s;
}

/* 問題2: display操作との競合 */
.sidebar {
    display: none;  /* 初期状態で非表示 */
}
.sidebar.show {
    display: block;
    left: 0;  /* transitionが効かない */
}
```

#### 3. z-index階層の混乱
```css
/* 問題：z-indexの競合 */
.hamburger-button { z-index: 9999; }
.overlay { z-index: 10000; }
.sidebar { z-index: 999; }  /* オーバーレイより後ろ */
```

#### 4. weakenOverlays関数の副作用
```javascript
// すべてのオーバーレイを無効化
el.style.pointerEvents = 'none';
// → サイドバーのオーバーレイも機能しなくなる
```

### 完全解決策の実装

#### 1. 統一実装（UnifiedSidebar）
```javascript
class UnifiedSidebar {
    constructor() {
        this.sidebar = null;
        this.overlay = null;
        this.isOpen = false;
        this.initialized = false;
    }
}
```

#### 2. transform基準の位置制御
```css
.c-sidebar {
    position: fixed !important;
    transform: translateX(-100%);  /* leftではなくtransform */
    transition: transform 0.3s;
    z-index: 999999 !important;    /* 最上位 */
}

.c-sidebar.is-open {
    transform: translateX(0) !important;
}
```

#### 3. 適切なz-index階層
```css
.c-hamburger { z-index: 999997; }  /* ハンバーガー */
.c-overlay { z-index: 999998; }    /* オーバーレイ */
.c-sidebar { z-index: 999999; }    /* サイドバー最上位 */
```

#### 4. pointer-events制御
```css
.c-overlay {
    pointer-events: none;  /* 非表示時 */
}
.c-overlay.is-visible {
    pointer-events: auto !important;  /* 表示時 */
}
```

### 段階的デバッグ手順

```javascript
// Step 1: 要素の存在確認
const sidebar = document.getElementById('c-sidebar');
const overlay = document.getElementById('c-overlay');
console.log('Elements exist:', {sidebar, overlay});

// Step 2: スタイル確認
console.log('Sidebar transform:', getComputedStyle(sidebar).transform);
console.log('Sidebar z-index:', getComputedStyle(sidebar).zIndex);
console.log('Overlay pointer-events:', getComputedStyle(overlay).pointerEvents);

// Step 3: クラス操作テスト
sidebar.classList.add('is-open');
overlay.classList.add('is-visible');

// Step 4: 手動でサイドバーを開く
window.unifiedSidebar.open();

// Step 5: イベントリスナー確認
overlay.click();  // コンソールログが出るか確認
```

### 再発防止のベストプラクティス

#### 1. 命名規則
- 独自の名前空間を使用（c-prefix）
- グローバルな名前（sidebar, menu, overlay）を避ける

#### 2. CSS設計
- transformベースのアニメーション
- !importantは最小限かつ理由を明記
- z-indexは999000番台で統一管理

#### 3. JavaScript実装
- 単一のクラスで管理（UnifiedSidebar）
- 初期化の冪等性を保証
- デバッグログを残す

#### 4. 競合回避
- 既存実装を削除してから新実装
- 外部CSSファイルは無効化
- グローバル関数には除外条件を明記

### 失敗から学んだ教訓

1. **表示されない≠存在しない**
   - 要素は存在するが画面外にある場合がある
   - z-indexで隠れている場合がある
   - pointer-eventsで無効化されている場合がある

2. **CSSの優先順位は複雑**
   - !importantは最終手段
   - インラインスタイルが最強
   - 詳細度の計算を理解する

3. **段階的な問題解決**
   - まず表示させる
   - 次に動作させる
   - 最後に最適化する

4. **副作用の影響範囲**
   - weakenOverlaysのような広範囲関数は危険
   - 除外条件は複数の方法で指定
   - 意図しない要素への影響を常に考慮

## 6. 重複予約検出メカニズムの完全リファクタリング（2025-09-02）

### 問題の症状
- 予約作成時に409 duplicate_create_windowエラーが頻発
- 同じ予約を複数回送信していないのにエラーになる
- Cloud Run環境でglobal.__create_guardが予期しない動作

### 根本原因
```javascript
// 問題のコード（api/admin.js:131-142）
if (!global.__create_guard) global.__create_guard = new Map();
const now = Date.now();
const prev = global.__create_guard.get(key);
if (prev && now - prev < 2000) {
  return res.status(409).json({ error: 'duplicate_create_window' });
}
```

#### 問題点の詳細
1. **サーバーレス環境での不適切なグローバル状態**
   - Cloud Runはコンテナインスタンスが動的にスケール
   - global変数は各インスタンス間で共有されない
   - コールドスタート時に状態がリセットされる

2. **メモリベースの重複検出の限界**
   - インスタンス間で同期されない
   - スケールアウト時に一貫性が保てない
   - 誤検出（false positive）が発生

### 解決策：データベースレベルのUNIQUE制約

#### 1. データベーススキーマ変更
```sql
-- migrations/001_add_unique_constraint.sql
ALTER TABLE reservations 
ADD CONSTRAINT unique_reservation_slot 
UNIQUE (store_id, date, time, seat_id)
WHERE status != 'cancelled';

ALTER TABLE reservations 
ADD COLUMN idempotency_key VARCHAR(255);

ALTER TABLE reservations 
ADD CONSTRAINT unique_idempotency_key 
UNIQUE (idempotency_key);
```

#### 2. アプリケーションコード変更
```javascript
// 旧: メモリベースの重複検出（削除）
// global.__create_guard による検出を完全削除

// 新: データベース制約による検出
const { data, error } = await supabase
  .from('reservations')
  .insert([reservationData])
  .select();

if (error && error.code === '23505') { // PostgreSQL unique violation
  if (error.message?.includes('unique_reservation_slot')) {
    return res.status(409).json({ 
      error: 'slot_taken',
      message: 'この時間帯の席は既に予約されています'
    });
  } else if (error.message?.includes('unique_idempotency_key')) {
    // 冪等性キーの重複（既存レコードを返す）
    const existing = await fetchExistingReservation(idempotencyKey);
    return res.status(200).json({
      success: true,
      reservation: existing,
      duplicate: true
    });
  }
}
```

### エラータイプの区別
1. **slot_taken**: 実際の時間枠の競合
   - 別のユーザーが同じ席・時間を予約済み
   - HTTPステータス: 409
   - ユーザーアクション: 別の時間または席を選択

2. **duplicate_request**: 同一リクエストの再送
   - Idempotency-Keyが一致
   - HTTPステータス: 200（成功として扱う）
   - ユーザーアクション: 不要（既に処理済み）

### テスト方法
```bash
# Test 1: 正常な予約作成
curl -X POST "https://api.example.com/api/admin?action=create" \
  -H "Content-Type: application/json" \
  -d '{"store_id":"store1","date":"2025-09-03","time":"18:00:00","customer_name":"田中","people":2,"seat_code":"T1"}'

# Test 2: 重複スロット（409 slot_taken期待）
curl -X POST "https://api.example.com/api/admin?action=create" \
  -H "Content-Type: application/json" \
  -d '{"store_id":"store1","date":"2025-09-03","time":"18:00:00","customer_name":"佐藤","people":3,"seat_code":"T1"}'

# Test 3: Idempotency-Key使用（200 duplicate:true期待）
curl -X POST "https://api.example.com/api/admin?action=create" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: unique-key-123" \
  -d '{"store_id":"store1","date":"2025-09-03","time":"19:00:00","customer_name":"山田","people":4,"seat_code":"T2"}'
```

### メリット
1. **一貫性**: すべてのインスタンスで同じ動作
2. **スケーラビリティ**: インスタンス数に関係なく正常動作
3. **信頼性**: データベースのACID特性を活用
4. **冪等性**: Idempotency-Keyによる安全な再試行

### デプロイ手順
1. データベースマイグレーション実行
2. api/admin.jsの更新
3. テストスクリプト実行
4. 本番環境へデプロイ

### 教訓
1. **サーバーレス環境でグローバル状態を使わない**
2. **重複検出はデータベース制約に任せる**
3. **冪等性を考慮したAPI設計**
4. **エラータイプを明確に区別**

## 7. サイドバー外側クリック機能不具合（2025-09-02）

### 問題の症状
- サイドバーの外側（オーバーレイ）をクリックしてもサイドバーが閉じない
- オーバーレイは表示されるがクリックイベントが発火しない
- ESCキーでは閉じるが、外側クリックだけが動作しない

### 根本原因

#### 1. weakenOverlays関数による意図しない無効化
```javascript
// 問題のコード
(function weakenOverlays(){
    const candidates = document.querySelectorAll(
        '.overlay:not(#pageOverlay), .modal-backdrop, ' +
        '[class*="overlay"]:not(#pageOverlay), [id*="modal"]'
    );
    // c-overlayも対象になってしまい、pointer-events: noneが設定される
})();
```

#### 2. CSSのpointer-events設定ミス
```css
/* 問題：常にpointer-events: noneのまま */
.c-overlay {
    opacity: 0;
    visibility: hidden;
    /* pointer-eventsの動的切り替えがない */
}

.c-overlay.is-visible {
    opacity: 1;
    visibility: visible;
    /* pointer-events: autoが設定されていない */
}
```

#### 3. セレクタの除外条件不足
- weakenOverlays関数で`.c-overlay`クラスを除外していない
- ID`#c-overlay`も除外条件に含まれていない

### 解決策

#### 1. CSSでpointer-eventsを適切に制御
```css
.c-overlay {
    pointer-events: none; /* 非表示時はクリック不可 */
}

.c-overlay.is-visible {
    pointer-events: auto !important; /* 表示時はクリック可能 */
}
```

#### 2. weakenOverlays関数に除外条件追加
```javascript
const candidates = document.querySelectorAll(
    '.overlay:not(#pageOverlay):not(.c-overlay), ' +
    '[class*="overlay"]:not(#pageOverlay):not(.c-overlay), ' +
    '[id*="modal"]:not(#c-overlay)'
);

// 追加のチェック
if (el.className.includes('c-overlay')) continue;
if (el.id === 'c-overlay') continue;
```

#### 3. イベントリスナーの確認
```javascript
// オーバーレイクリックで閉じる
this.overlay.addEventListener('click', (e) => {
    console.log('Overlay clicked - closing sidebar');
    e.stopPropagation();
    this.close();
});

// サイドバー自体のクリックは伝播を止める
this.sidebar.addEventListener('click', (e) => {
    e.stopPropagation();
});
```

### デバッグ方法
```javascript
// 1. オーバーレイの状態確認
const overlay = document.getElementById('c-overlay');
console.log('Overlay pointer-events:', getComputedStyle(overlay).pointerEvents);
console.log('Overlay visibility:', getComputedStyle(overlay).visibility);

// 2. イベントリスナー確認
overlay.click(); // 手動でクリックイベント発火

// 3. weakenOverlays実行後の確認
setTimeout(() => {
    console.log('After weakenOverlays:', getComputedStyle(overlay).pointerEvents);
}, 2000);
```

### 再発防止策

#### 1. health-check.jsに検証追加
- オーバーレイのpointer-events設定確認
- weakenOverlays関数の除外条件確認
- UnifiedSidebarクラスの存在確認
- イベントリスナーの設定確認

#### 2. 実装ルール
- **グローバルな関数は慎重に**: weakenOverlaysのような全体に影響する関数は除外条件を明確に
- **pointer-eventsは明示的に**: 表示/非表示でpointer-eventsを切り替える
- **デバッグログを活用**: クリックイベントにconsole.logを入れて動作確認
- **CSSの詳細度に注意**: !importantが必要な場合は理由を明確に

### 教訓
1. **副作用の影響範囲を考慮**: weakenOverlaysのような広範囲に影響する関数は要注意
2. **pointer-eventsの管理**: 動的に表示/非表示する要素は明示的に制御
3. **除外条件は具体的に**: セレクタの除外条件は複数の方法で指定
4. **動作確認の重要性**: 外側クリックのような基本機能は必ずテスト