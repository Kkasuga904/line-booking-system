// Store Configuration
// 店舗設定の管理

(function() {
    'use strict';
    
    // 既存の STORE_CONFIG に合流
    const C = (window.STORE_CONFIG = window.STORE_CONFIG || {});
    
    // 必須: APIベースとstoreId（必要なら本番値で書き換え）
    C.apiBase   = C.apiBase   || '/api';
    C.adminPath = C.adminPath || '/admin';
    C.storeId   = C.storeId   || 'default-store';
    
    // 認証（フロントには置かない - サーバ側で管理）
    C.apiKey      = C.apiKey      || '';  // サーバ側で管理
    C.adminToken  = C.adminToken  || '';  // サーバ側で管理
    
    // ここが Missing だった：容量制御のキー生成
    // 例: 'capacity_control_rules:<storeId>'
    C.getCapacityRulesKey = C.getCapacityRulesKey || function(storeId) {
        const id = storeId || C.storeId || 'default-store';
        return `capacity_control_rules:${id}`;
    };
    
    // 任意：予約テーブルのキー生成を使う箇所があれば
    C.getReservationsKey = C.getReservationsKey || function(storeId, date) {
        const id = storeId || C.storeId || 'default-store';
        return date ? `reservations:${id}:${date}` : `reservations:${id}`;
    };
    
    window.StoreConfig = {
        // デフォルト店舗ID
        defaultStoreId: 'default-store',
        
        // 店舗IDを取得
        getStoreId: function() {
            // LocalStorageから取得を試みる
            const stored = localStorage.getItem('currentStoreId');
            if (stored) {
                return stored;
            }
            
            // URLパラメータから取得を試みる
            const urlParams = new URLSearchParams(window.location.search);
            const storeId = urlParams.get('store_id');
            if (storeId) {
                localStorage.setItem('currentStoreId', storeId);
                return storeId;
            }
            
            // デフォルト値を返す
            return this.defaultStoreId;
        },
        
        // 店舗IDを設定
        setStoreId: function(storeId) {
            localStorage.setItem('currentStoreId', storeId);
        },
        
        // 店舗設定をクリア
        clearStoreId: function() {
            localStorage.removeItem('currentStoreId');
        },
        
        // 容量制御のキー生成（追加）
        getCapacityRulesKey: C.getCapacityRulesKey,
        
        // 予約テーブルのキー生成（追加）
        getReservationsKey: C.getReservationsKey
    };
    
    // フロントから使いやすいようにエクスポート
    window.StoreConfig = Object.assign(window.StoreConfig, C);
})();