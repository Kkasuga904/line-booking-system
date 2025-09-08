// Store configuration based on hostname
(function() {
    'use strict';
    
    // URLから正しいstore_idを判定
    function getStoreIdFromHost() {
        const hostname = window.location.hostname;
        const pathname = window.location.pathname;
        
        // booking-account1 -> account1-store
        if (hostname.includes('booking-account1')) {
            return 'account1-store';
        }
        
        // booking-account2 -> account2-store
        if (hostname.includes('booking-account2')) {
            return 'account2-store';
        }
        
        // Cloud Run host: tag付き or デフォルトドメイン
        // store-a --- line-booking-api なら store-a を返す
        if (hostname.includes('store-a---line-booking-api')) {
            return 'store-a';
        }
        // デフォルトの line-booking-api ホストは store-a を既定にする
        if (hostname.includes('line-booking-api')) {
            return 'store-a';
        }
        
        // localhost開発環境
        if (hostname === 'localhost' || hostname === '127.0.0.1') {
            // URLパラメータから取得
            const params = new URLSearchParams(window.location.search);
            const storeId = params.get('store_id');
            if (storeId) return storeId;
            
            // デフォルト
            return 'account1-store';
        }
        
        // デフォルト
        return 'default-store';
    }
    
    // グローバル設定オブジェクト
    window.STORE_CONFIG = window.STORE_CONFIG || {};
    window.STORE_CONFIG.storeId = getStoreIdFromHost();
    window.STORE_CONFIG.apiBase = '/api';
    // 管理APIキー（あればローカルストレージから）
    if (!window.STORE_CONFIG.adminToken) {
        try { window.STORE_CONFIG.adminToken = localStorage.getItem('ADMIN_API_KEY') || ''; } catch (_) {}
    }
    
    // StoreConfigオブジェクト（後方互換性）
    window.StoreConfig = window.StoreConfig || {};
    window.StoreConfig.getStoreId = function() {
        return window.STORE_CONFIG.storeId;
    };
    
    window.StoreConfig.getCapacityRulesKey = function(storeId) {
        const id = storeId || window.STORE_CONFIG.storeId;
        return `capacity_control_rules:${id}`;
    };
    
    // デバッグ出力
    console.log('Store Configuration:', {
        hostname: window.location.hostname,
        storeId: window.STORE_CONFIG.storeId,
        apiBase: window.STORE_CONFIG.apiBase,
        hasAdminToken: !!window.STORE_CONFIG.adminToken
    });
})();
