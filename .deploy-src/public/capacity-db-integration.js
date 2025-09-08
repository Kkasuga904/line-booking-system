// 予約制限ルールのデータベース統合
// LocalStorageからデータベースへの移行

(function() {
    'use strict';
    
    // データベースから予約制限ルールを読み込み
    window.loadCapacityRulesFromDB = async function() {
        const storeId = new URLSearchParams(window.location.search).get('store_id') || 'default-store';
        
        try {
            const response = await fetch(`/api/capacity-rules?store_id=${storeId}`);
            if (!response.ok) {
                throw new Error('Failed to load capacity rules');
            }
            
            const data = await response.json();
            window.capacityRules = data.rules || [];
            if (window.APP_DEBUG) console.log('Loaded capacity rules from DB:', window.capacityRules);
            return data.rules;
        } catch (error) {
            console.error('Error loading capacity rules:', error);
            window.capacityRules = [];
            return [];
        }
    };
    
    // 予約制限ルールをデータベースに保存
    window.saveCapacityRuleToDB = async function(rule) {
        try {
            const response = await fetch('/api/capacity-rules', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(rule)
            });
            
            if (!response.ok) {
                throw new Error('Failed to save capacity rule');
            }
            
            const result = await response.json();
            console.log('Capacity rule saved:', result.rule);
            return result.rule;
        } catch (error) {
            console.error('Error saving capacity rule:', error);
            throw error;
        }
    };
    
    // 予約制限ルールを更新
    window.updateCapacityRuleInDB = async function(ruleId, updates) {
        try {
            const response = await fetch(`/api/capacity-rules/${ruleId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(updates)
            });
            
            if (!response.ok) {
                throw new Error('Failed to update capacity rule');
            }
            
            const result = await response.json();
            console.log('Capacity rule updated:', result.rule);
            return result.rule;
        } catch (error) {
            console.error('Error updating capacity rule:', error);
            throw error;
        }
    };
    
    // 予約制限ルールを削除
    window.deleteCapacityRuleFromDB = async function(ruleId) {
        try {
            const response = await fetch(`/api/capacity-rules/${ruleId}`, {
                method: 'DELETE'
            });
            
            if (!response.ok) {
                throw new Error('Failed to delete capacity rule');
            }
            
            console.log('Capacity rule deleted:', ruleId);
            return true;
        } catch (error) {
            console.error('Error deleting capacity rule:', error);
            throw error;
        }
    };
    
    // 簡易的なルール作成（テスト用）
    window.createTestCapacityRule = async function(date, startTime, endTime, maxGroups) {
        const rule = {
            store_id: 'default-store',
            name: `テストルール ${date}`,
            dateMode: 'single',
            date: date,
            startTime: startTime,
            endTime: endTime,
            controlType: 'groups',
            maxGroups: maxGroups
        };
        
        try {
            const savedRule = await saveCapacityRuleToDB(rule);
            console.log('Test rule created:', savedRule);
            
            // 通知を表示
            if (typeof showNotification === 'function') {
                showNotification('予約制限を作成しました', 'success');
            }
            
            // リストを更新
            if (typeof displayCapacityControlsList === 'function') {
                await loadCapacityRulesFromDB();
                displayCapacityControlsList();
            }
            
            return savedRule;
        } catch (error) {
            console.error('Failed to create test rule:', error);
            if (typeof showNotification === 'function') {
                showNotification('予約制限の作成に失敗しました', 'error');
            }
            throw error;
        }
    };
    
    // ページロード時に自動読み込み
    document.addEventListener('DOMContentLoaded', async () => {
        console.log('=== 予約制限データベース統合 初期化 ===');
        await loadCapacityRulesFromDB();
    });
    
})();