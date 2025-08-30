# 時間入力のAM/PM問題と解決方法

## 問題の概要

### 発生した問題
- HTML5の`<input type="time">`要素が、ブラウザのロケール設定によってAM/PM形式で表示される
- 日本の飲食店向けシステムなのに、英語圏の12時間表記になってしまう
- `lang="ja"`属性を設定しても、ブラウザのネイティブタイムピッカーはOSのロケール設定を優先する

### 根本原因
1. **ブラウザの仕様**: Chrome/EdgeなどのブラウザはOSのロケール設定（Windows: en-US）を使用
2. **HTML仕様の限界**: `lang`属性はタイムピッカーの表示形式に影響しない
3. **ユーザー環境依存**: 各ユーザーのOS設定に依存してしまう

## 実装した解決策

### 1. テキスト入力 + パターン検証 (force-24h-time.js)
```javascript
// time inputをtext inputに置き換え
<input type="text" 
       pattern="([01]?[0-9]|2[0-3]):[0-5][0-9]" 
       placeholder="18:00">
```

**メリット**:
- 確実に24時間形式を強制できる
- AM/PM入力を自動変換
- 軽量で高速

**デメリット**:
- ユーザーが手入力する必要がある
- モバイルでの入力がやや面倒

### 2. セレクトボックス方式 (time-select-dropdown.js) 【推奨】
```javascript
// プルダウンメニューで時間選択
<select id="startTime">
    <option value="18:00">18:00</option>
    <option value="18:30">18:30</option>
    <!-- ... -->
</select>
```

**メリット**:
- ユーザーエラーが発生しない
- モバイルでも使いやすい
- 営業時間に特化した選択肢を提供可能

**デメリット**:
- 細かい時間指定ができない（30分単位など）

## 再発防止策

### 1. 開発ガイドライン

#### ❌ 使用してはいけない実装
```html
<!-- NG: ブラウザ依存でAM/PM表示になる可能性 -->
<input type="time" lang="ja">

<!-- NG: stepを指定してもAM/PM問題は解決しない -->
<input type="time" step="60">
```

#### ✅ 推奨する実装
```html
<!-- OK: セレクトボックス方式 -->
<select id="timeSelect" class="form-input">
    <option value="18:00">18:00</option>
</select>

<!-- OK: テキスト入力 + パターン検証 -->
<input type="text" 
       pattern="([01]?[0-9]|2[0-3]):[0-5][0-9]"
       placeholder="HH:MM">
```

### 2. 自動変換スクリプトの適用

すべてのページに以下のスクリプトを読み込む：

```html
<!-- 方法1: セレクトボックス変換（推奨） -->
<script src="/time-select-dropdown.js"></script>

<!-- 方法2: テキスト入力強制 -->
<script src="/force-24h-time.js"></script>
```

### 3. テスト項目

新しい時間入力フィールドを追加する際は、以下を確認：

1. **表示形式テスト**
   - [ ] 24時間形式で表示されるか
   - [ ] AM/PMが表示されていないか
   - [ ] プレースホルダーが適切か

2. **入力テスト**
   - [ ] 24時間形式で入力できるか
   - [ ] 不正な値をバリデーションできるか
   - [ ] 保存後も24時間形式を維持するか

3. **環境テスト**
   - [ ] Windows (en-US)環境で動作確認
   - [ ] Mac環境で動作確認
   - [ ] モバイル（iOS/Android）で動作確認

## トラブルシューティング

### Q: 既存のtime inputがAM/PM表示になっている
A: 以下のスクリプトをコンソールで実行
```javascript
// 即座に変換
window.timeSelect.convertAll();
// または
window.force24h.convertAll();
```

### Q: 動的に追加されたフォームで問題が発生
A: DOM監視が有効になっているか確認
```javascript
// 監視状態を確認
console.log('TimeSelect loaded:', typeof window.timeSelect !== 'undefined');
console.log('Force24h loaded:', typeof window.force24h !== 'undefined');
```

### Q: 特定の時間範囲だけ選択可能にしたい
A: generateBusinessHours関数をカスタマイズ
```javascript
// 営業時間のみ選択可能
const options = window.timeSelect.generateBusinessHours();
```

## 実装履歴

| 日付 | 対応内容 | ファイル |
|------|---------|----------|
| 2024-12-30 | AM/PM問題発見・初期対応 | admin-full-featured.html |
| 2024-12-30 | テキスト入力方式実装 | force-24h-time.js |
| 2024-12-30 | セレクトボックス方式実装 | time-select-dropdown.js |
| 2024-12-30 | ナレッジ文書作成 | KNOWLEDGE_TIME_INPUT.md |

## 関連ファイル

- `/public/force-24h-time.js` - テキスト入力強制スクリプト
- `/public/time-select-dropdown.js` - セレクトボックス変換スクリプト
- `/public/admin-full-featured.html` - メイン管理画面
- `/public/capacity-control-enhanced.html` - 予約制御設定画面

## 参考資料

- [MDN: input type="time"](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/input/time)
- [HTML Standard: Time state](https://html.spec.whatwg.org/multipage/input.html#time-state-(type=time))
- [Chrome Issue: Time input locale](https://bugs.chromium.org/p/chromium/issues/detail?id=1041379)