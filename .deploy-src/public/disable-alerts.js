/**
 * アラートポップアップ無効化スクリプト
 * 本番環境でのデバッグアラートを防ぐ
 */

(function() {
  // 即座に実行して、ページロード前にalertを無効化
  
  // 元のalert関数を保存
  const originalAlert = window.alert;
  
  // alert関数を完全に上書き
  window.alert = function(message) {
    console.log('[Alert blocked]:', message);
    
    // デバッグ用の「1」アラートは完全に無視
    if (message === '1' || message === 1 || message === '１' || 
        (typeof message === 'string' && message.trim() === '1')) {
      console.warn('[Debug alert "1" blocked and ignored]');
      return;
    }
    
    // 本当に重要なアラートのみ表示
    if (message && typeof message === 'string' && 
        (message.includes('エラー') || 
         message.includes('失敗') || 
         message.includes('Error') ||
         message.includes('Failed') ||
         message.includes('予約'))) {
      // 重要なメッセージはコンソールに記録して、通知として表示
      console.info('[Important message]:', message);
      // originalAlert(message); // コメントアウト：アラートは完全に無効化
      
      // 代わりにコンソールに大きく表示
      console.log('%c' + message, 'background: #ff0000; color: #fff; padding: 10px; font-size: 14px;');
    }
  };
  
  // Object.definePropertyを使って、より強力にalertを無効化
  try {
    Object.defineProperty(window, 'alert', {
      value: window.alert,
      writable: false,
      configurable: false
    });
  } catch (e) {
    console.log('Could not lock alert function:', e);
  }
  
  console.log('Alert blocking script loaded successfully');
})();