# 予約削除機能のID取得問題のナレッジ

## 問題の症状
- 予約削除ボタンをクリックしても削除されない
- コンソールに「Deleting reservation: undefined」と表示される
- APIが500エラーを返す（undefined IDのため）

## 根本原因

### 1. FullCalendarイベントのデータ構造の誤解
FullCalendarのイベントオブジェクトは以下の構造：
```javascript
event = {
    id: "123",                    // イベントID（これが予約ID）
    title: "田中様 (2名)",
    start: Date,
    extendedProps: {              // カスタムプロパティ
        originalData: {            // 元の予約データ
            id: "123",
            customer_name: "田中",
            phone: "090-1234-5678"
        }
    }
}
```

### 2. 誤った実装
**間違い：**
```javascript
// extendedPropsを直接予約データとして扱っていた
const props = event.extendedProps;
openDetailModal(props);  // propsにはidが直接存在しない
```

**正解：**
```javascript
// イベントからIDと他のデータを正しく取得
const reservation = {
    id: event.id,  // event.idが正しい予約ID
    ...event.extendedProps?.originalData
};
```

### 3. 関数のスコープ問題
- `deleteReservation`関数がグローバルスコープになかった
- HTML内の`onclick`から呼び出せなかった

## 実装した解決策

### 1. イベントIDの確実な取得（3段階フォールバック）
```javascript
const eventId = 
    event.id ||                                    // 通常のイベントID
    event.extendedProps?.originalData?.id ||       // 元データのID
    event.extendedProps?.id;                       // 拡張プロパティのID
```

### 2. IDバリデーション
```javascript
// 削除前の厳格なチェック
if (!id || id === 'undefined' || id === 'null' || id === '') {
    console.error('Invalid reservation ID:', id);
    showNotification('削除エラー: 予約IDが無効です', 'error');
    return;
}
```

### 3. グローバルスコープへの配置
```javascript
// window オブジェクトに明示的に登録
window.deleteReservation = async function(id) { ... }
window.editReservation = function(id) { ... }
window.showNotification = function(message, type) { ... }
```

### 4. デバッグ情報の追加
```javascript
console.log('Opening detail modal for reservation:', {
    id: reservation.id,
    eventId: event.id,
    extendedPropsId: event.extendedProps?.id,
    originalDataId: event.extendedProps?.originalData?.id
});
```

## なぜこの問題が起きたか

### 1. データ構造の複雑性
- FullCalendarのイベント
- APIレスポンスの予約データ
- 詳細モーダル用のデータ

これら3つのデータ構造が異なり、変換時にIDが失われていた。

### 2. JavaScriptのスコープ問題
```javascript
// モジュール内の関数
function deleteReservation() { }  // HTML onclickから呼べない

// グローバル関数
window.deleteReservation = function() { }  // HTML onclickから呼べる
```

### 3. 型の曖昧さ
JavaScriptは動的型付けのため、`undefined`が文字列"undefined"になることがある：
```javascript
const id = undefined;
const url = `/api/delete?id=${id}`;  // "/api/delete?id=undefined"
```

## 再発防止策

### 1. 必須チェックリスト
- [ ] イベントハンドラーはグローバルスコープに配置
- [ ] IDは複数の場所から取得を試みる（フォールバック）
- [ ] IDの存在と型を削除前に検証
- [ ] デバッグログでIDの流れを追跡

### 2. テスト方法
```javascript
// コンソールで実行して動作確認
// 1. 関数の存在確認
console.log(typeof window.deleteReservation);  // "function"であるべき

// 2. IDの取得確認
calendar.getEvents().forEach(e => {
    console.log({
        eventId: e.id,
        title: e.title,
        hasExtendedProps: !!e.extendedProps
    });
});
```

### 3. エラー時の調査手順
1. コンソールで削除時のIDを確認
2. `undefined`の場合、イベントクリック時のログを確認
3. イベントオブジェクトの構造を`console.log(event)`で確認
4. グローバル関数の登録を確認

## 今回の教訓

1. **データ変換時は元のIDを保持する**
   - 変換や加工の際、必ず元のIDを維持する
   - 複数のIDフィールドがある場合は優先順位を決める

2. **グローバルスコープの明示的な使用**
   - HTML内のイベントハンドラーから呼ぶ関数は`window.`を付ける
   - モジュール化されたコードでは特に注意

3. **防御的プログラミング**
   - IDが取得できない場合の処理を必ず実装
   - エラーメッセージは具体的に（"削除失敗"ではなく"予約IDが無効"）

4. **デバッグ情報の重要性**
   - 問題発生時に原因を特定できるログを仕込む
   - 本番環境でもIDの流れを追跡できるようにする