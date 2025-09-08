/**
 * 予約制限（キャパシティ）監視システム
 * 予約制限の色表示が正しく動作しているか監視し、問題を検出・修正
 */

(function() {
    'use strict';
    
    console.log('🔍 Capacity Monitor - Initializing...');
    
    // 監視設定
    const MONITOR_CONFIG = {
        checkInterval: 5000, // 5秒ごとにチェック
        apiTimeout: 10000,   // APIタイムアウト10秒
        retryCount: 3,       // リトライ回数
        debugMode: true      // デバッグモード
    };
    
    // キャパシティ状態の定義
    const CAPACITY_STATUS = {
        FULL: {
            status: 'full',
            color: '#e0e0e0',
            textColor: '#999',
            message: '満席',
            selectable: false
        },
        LIMITED: {
            status: 'limited',
            color: '#ffd54f',
            textColor: '#333',
            message: 'もうすぐ満席',
            selectable: true
        },
        AVAILABLE: {
            status: 'available',
            color: '#4caf50',
            textColor: '#fff',
            message: '空席あり',
            selectable: true
        }
    };
    
    class CapacityMonitor {
        constructor() {
            this.lastCheckTime = null;
            this.errorCount = 0;
            this.isMonitoring = false;
        }
        
        /**
         * APIからキャパシティデータを取得
         */
        async fetchCapacityData(date, storeId = '***REMOVED-ROTATE-CREDENTIAL***') {
            const url = `/api/capacity-availability?date=${date}&store_id=${storeId}&t=${Date.now()}`;
            
            try {
                const response = await fetch(url, {
                    method: 'GET',
                    headers: {
                        'Cache-Control': 'no-cache',
                        'Pragma': 'no-cache'
                    },
                    cache: 'no-cache'
                });
                
                if (!response.ok) {
                    throw new Error(`API returned ${response.status}`);
                }
                
                const data = await response.json();
                
                if (!data.success) {
                    throw new Error(data.error || 'Failed to fetch capacity data');
                }
                
                return data;
            } catch (error) {
                console.error('❌ [CapacityMonitor] API Error:', error);
                this.errorCount++;
                
                if (this.errorCount >= MONITOR_CONFIG.retryCount) {
                    this.showErrorBanner('キャパシティデータの取得に失敗しました');
                }
                
                throw error;
            }
        }
        
        /**
         * 時間枠の色が正しいか検証
         */
        validateTimeSlotColor(timeSlot, capacityData) {
            if (!timeSlot || !capacityData) return false;
            
            const time = timeSlot.dataset.time || timeSlot.textContent.match(/\d{1,2}:\d{2}/)?.[0];
            if (!time) return false;
            
            const slotData = capacityData.availability?.[time];
            if (!slotData) return false;
            
            const expectedStatus = this.determineStatus(slotData);
            const currentBgColor = window.getComputedStyle(timeSlot).backgroundColor;
            
            // 色をRGB形式に変換して比較
            const expectedColor = this.hexToRgb(expectedStatus.color);
            const isCorrect = this.colorsMatch(currentBgColor, expectedColor);
            
            if (!isCorrect && MONITOR_CONFIG.debugMode) {
                console.warn(`⚠️ [CapacityMonitor] Color mismatch for ${time}:`, {
                    expected: expectedStatus,
                    current: currentBgColor,
                    data: slotData
                });
            }
            
            return isCorrect;
        }
        
        /**
         * ステータスに基づいて期待される表示を決定
         */
        determineStatus(slotData) {
            if (slotData.status === 'full') {
                return CAPACITY_STATUS.FULL;
            } else if (slotData.status === 'limited') {
                return CAPACITY_STATUS.LIMITED;
            } else {
                return CAPACITY_STATUS.AVAILABLE;
            }
        }
        
        /**
         * 時間枠の表示を修正
         */
        fixTimeSlotDisplay(timeSlot, slotData) {
            const status = this.determineStatus(slotData);
            const time = timeSlot.dataset.time || timeSlot.textContent.match(/\d{1,2}:\d{2}/)?.[0];
            
            // スタイルを強制的に適用
            timeSlot.style.cssText = `
                background-color: ${status.color} !important;
                color: ${status.textColor} !important;
                padding: 12px !important;
                border-radius: 10px !important;
                text-align: center !important;
                cursor: ${status.selectable ? 'pointer' : 'not-allowed'} !important;
                pointer-events: ${status.selectable ? 'auto' : 'none'} !important;
                opacity: ${status.status === 'full' ? '0.7' : '1'} !important;
                border: 2px solid ${this.darkenColor(status.color)} !important;
            `;
            
            // HTMLコンテンツを更新
            timeSlot.innerHTML = `
                <div style="font-weight: 600; color: ${status.textColor};">${time}</div>
                <div style="font-size: 10px; margin-top: 4px; color: ${status.textColor}; font-weight: bold;">
                    ${slotData.message || status.message}
                </div>
            `;
            
            console.log(`✅ [CapacityMonitor] Fixed display for ${time}`);
        }
        
        /**
         * 全時間枠をチェックして修正
         */
        async checkAndFixAllSlots(date) {
            try {
                const capacityData = await this.fetchCapacityData(date);
                const timeSlots = document.querySelectorAll('.time-slot');
                let fixedCount = 0;
                
                timeSlots.forEach(slot => {
                    const time = slot.dataset.time || slot.textContent.match(/\d{1,2}:\d{2}/)?.[0];
                    if (!time) return;
                    
                    const slotData = capacityData.availability?.[time];
                    if (!slotData) return;
                    
                    if (!this.validateTimeSlotColor(slot, capacityData)) {
                        this.fixTimeSlotDisplay(slot, slotData);
                        fixedCount++;
                    }
                });
                
                if (fixedCount > 0) {
                    console.log(`🔧 [CapacityMonitor] Fixed ${fixedCount} time slots`);
                }
                
                this.errorCount = 0; // リセット
                return true;
            } catch (error) {
                console.error('❌ [CapacityMonitor] Check failed:', error);
                return false;
            }
        }
        
        /**
         * エラーバナーを表示
         */
        showErrorBanner(message) {
            const existingBanner = document.getElementById('capacity-error-banner');
            if (existingBanner) {
                existingBanner.remove();
            }
            
            const banner = document.createElement('div');
            banner.id = 'capacity-error-banner';
            banner.style.cssText = `
                position: fixed;
                top: 60px;
                left: 0;
                right: 0;
                background: linear-gradient(135deg, #ff6b6b 0%, #ff5252 100%);
                color: white;
                padding: 10px;
                text-align: center;
                z-index: 9999;
                font-size: 14px;
                box-shadow: 0 2px 10px rgba(0,0,0,0.2);
            `;
            
            banner.innerHTML = `
                <span>⚠️ ${message}</span>
                <button onclick="this.parentElement.remove()" style="
                    margin-left: 20px;
                    background: rgba(255,255,255,0.2);
                    border: 1px solid rgba(255,255,255,0.3);
                    color: white;
                    padding: 2px 8px;
                    border-radius: 4px;
                    cursor: pointer;
                ">✕</button>
            `;
            
            document.body.appendChild(banner);
            
            setTimeout(() => {
                if (banner.parentElement) {
                    banner.remove();
                }
            }, 10000);
        }
        
        /**
         * 色をHEXからRGBに変換
         */
        hexToRgb(hex) {
            const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
            return result ? `rgb(${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)})` : null;
        }
        
        /**
         * 色を暗くする
         */
        darkenColor(hex) {
            const color = hex.replace('#', '');
            const num = parseInt(color, 16);
            const amt = -40;
            const r = (num >> 16) + amt;
            const g = (num >> 8 & 0x00FF) + amt;
            const b = (num & 0x0000FF) + amt;
            return '#' + (0x1000000 + (r < 255 ? r < 1 ? 0 : r : 255) * 0x10000 +
                (g < 255 ? g < 1 ? 0 : g : 255) * 0x100 +
                (b < 255 ? b < 1 ? 0 : b : 255)).toString(16).slice(1);
        }
        
        /**
         * RGB色が一致するか確認（許容誤差あり）
         */
        colorsMatch(color1, color2, tolerance = 10) {
            const rgb1 = color1.match(/\d+/g)?.map(Number) || [];
            const rgb2 = color2.match(/\d+/g)?.map(Number) || [];
            
            if (rgb1.length !== 3 || rgb2.length !== 3) return false;
            
            return rgb1.every((val, i) => Math.abs(val - rgb2[i]) <= tolerance);
        }
        
        /**
         * 監視を開始
         */
        startMonitoring(date) {
            if (this.isMonitoring) return;
            
            this.isMonitoring = true;
            console.log('🚀 [CapacityMonitor] Monitoring started');
            
            // 初回チェック
            this.checkAndFixAllSlots(date);
            
            // 定期チェック
            this.monitorInterval = setInterval(() => {
                const currentDate = document.getElementById('selectedDate')?.value || 
                                  document.querySelector('[data-selected-date]')?.dataset.selectedDate ||
                                  new Date().toISOString().split('T')[0];
                this.checkAndFixAllSlots(currentDate);
            }, MONITOR_CONFIG.checkInterval);
        }
        
        /**
         * 監視を停止
         */
        stopMonitoring() {
            if (this.monitorInterval) {
                clearInterval(this.monitorInterval);
                this.monitorInterval = null;
            }
            this.isMonitoring = false;
            console.log('⏹️ [CapacityMonitor] Monitoring stopped');
        }
    }
    
    // グローバルインスタンスを作成
    window.CapacityMonitor = new CapacityMonitor();
    
    // ページロード後に自動開始
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            const currentDate = new Date().toISOString().split('T')[0];
            window.CapacityMonitor.startMonitoring(currentDate);
        });
    } else {
        const currentDate = new Date().toISOString().split('T')[0];
        window.CapacityMonitor.startMonitoring(currentDate);
    }
    
    console.log('✅ Capacity Monitor - Ready');
    console.log('💡 使い方: window.CapacityMonitor でアクセス可能');
    
})();