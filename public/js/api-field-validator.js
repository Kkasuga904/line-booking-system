/**
 * API フィールドバリデーター
 * フロントエンドとバックエンドのフィールド名の不一致を防ぐ
 */

(function() {
    'use strict';
    
    console.log('🛡️ API Field Validator - Initializing...');
    
    // APIフィールドマッピング定義
    const FIELD_MAPPINGS = {
        // 予約作成API (/api/reservation/create)
        reservation: {
            required: {
                'customer_name': ['customerName', 'customer_name', 'name'],
                'customer_phone': ['phoneNumber', 'customer_phone', 'phone', 'tel'],
                'date': ['date', 'reservationDate'],
                'time': ['time', 'reservationTime'],
                'people': ['numberOfPeople', 'people', 'peopleCount', 'guests']
            },
            optional: {
                'customer_email': ['email', 'customer_email', 'mail'],
                'message': ['message', 'specialRequests', 'note', 'comment'],
                'seat_preference': ['seat_id', 'seat_preference', 'seatPreference'],
                'store_id': ['store_id', 'storeId'],
                'user_id': ['user_id', 'userId', 'lineUserId']
            }
        }
    };
    
    class APIFieldValidator {
        constructor() {
            this.errors = [];
            this.warnings = [];
            this.isMonitoring = false;
            this.interceptedRequests = [];
        }
        
        /**
         * フィールドマッピングを正規化
         */
        normalizeFields(data, mapping) {
            const normalized = {};
            const missingRequired = [];
            
            // 必須フィールドの処理
            for (const [targetField, sourceFields] of Object.entries(mapping.required || {})) {
                let found = false;
                for (const sourceField of sourceFields) {
                    if (data[sourceField] !== undefined && data[sourceField] !== null) {
                        normalized[targetField] = data[sourceField];
                        found = true;
                        break;
                    }
                }
                if (!found) {
                    missingRequired.push(targetField);
                }
            }
            
            // オプションフィールドの処理
            for (const [targetField, sourceFields] of Object.entries(mapping.optional || {})) {
                for (const sourceField of sourceFields) {
                    if (data[sourceField] !== undefined && data[sourceField] !== null) {
                        normalized[targetField] = data[sourceField];
                        break;
                    }
                }
            }
            
            // その他のフィールドをそのまま追加
            for (const [key, value] of Object.entries(data)) {
                if (!normalized[key]) {
                    normalized[key] = value;
                }
            }
            
            return {
                normalized,
                missingRequired,
                isValid: missingRequired.length === 0
            };
        }
        
        /**
         * フォームデータをバリデート
         */
        validateFormData(formId) {
            const form = document.getElementById(formId);
            if (!form) {
                console.error(`Form with ID "${formId}" not found`);
                return null;
            }
            
            const formData = {};
            const inputs = form.querySelectorAll('input, textarea, select');
            
            inputs.forEach(input => {
                const name = input.name || input.id;
                if (name) {
                    if (input.type === 'checkbox') {
                        formData[name] = input.checked;
                    } else if (input.type === 'radio') {
                        if (input.checked) {
                            formData[name] = input.value;
                        }
                    } else {
                        formData[name] = input.value;
                    }
                }
            });
            
            console.log('📝 Form data collected:', formData);
            return formData;
        }
        
        /**
         * Fetch APIをインターセプト
         */
        interceptFetchAPI() {
            const originalFetch = window.fetch;
            const validator = this;
            
            window.fetch = async function(url, options = {}) {
                // POSTリクエストの場合のみ検証
                if (options.method === 'POST' && options.body) {
                    try {
                        const body = JSON.parse(options.body);
                        console.log('🔍 Intercepted API request:', {
                            url,
                            body
                        });
                        
                        // 予約作成APIの場合
                        if (url.includes('/api/reservation/create')) {
                            const result = validator.normalizeFields(body, FIELD_MAPPINGS.reservation);
                            
                            if (!result.isValid) {
                                console.error('❌ Missing required fields:', result.missingRequired);
                                validator.showErrorBanner(
                                    `必須フィールドが不足: ${result.missingRequired.join(', ')}`
                                );
                            }
                            
                            // 正規化されたデータで置き換え
                            options.body = JSON.stringify(result.normalized);
                            console.log('✅ Normalized request body:', result.normalized);
                        }
                        
                        validator.interceptedRequests.push({
                            timestamp: new Date(),
                            url,
                            originalBody: body,
                            normalizedBody: result?.normalized || body
                        });
                        
                    } catch (e) {
                        console.log('Parse error or non-JSON body:', e);
                    }
                }
                
                // 元のfetchを呼び出し
                return originalFetch.call(this, url, options).then(response => {
                    // エラーレスポンスの詳細をログ
                    if (!response.ok) {
                        response.clone().json().then(errorData => {
                            console.error('❌ API Error Response:', {
                                status: response.status,
                                url,
                                error: errorData
                            });
                            
                            if (response.status === 400 && errorData.details) {
                                validator.showDetailedError(errorData.details);
                            }
                        }).catch(() => {
                            console.error('Failed to parse error response');
                        });
                    }
                    
                    return response;
                });
            };
            
            console.log('✅ Fetch API interceptor installed');
        }
        
        /**
         * 詳細なエラーを表示
         */
        showDetailedError(details) {
            const missingFields = [];
            for (const [field, isMissing] of Object.entries(details)) {
                if (isMissing) {
                    missingFields.push(field);
                }
            }
            
            if (missingFields.length > 0) {
                this.showErrorBanner(
                    `必須項目が不足しています: ${missingFields.join(', ')}`,
                    'error',
                    10000
                );
            }
        }
        
        /**
         * エラーバナーを表示
         */
        showErrorBanner(message, type = 'error', duration = 5000) {
            const existingBanner = document.getElementById('field-validator-banner');
            if (existingBanner) {
                existingBanner.remove();
            }
            
            const banner = document.createElement('div');
            banner.id = 'field-validator-banner';
            
            const bgColor = type === 'error' ? '#ff6b6b' : '#ffd43b';
            const icon = type === 'error' ? '❌' : '⚠️';
            
            banner.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                background: ${bgColor};
                color: white;
                padding: 12px;
                text-align: center;
                z-index: 99999;
                font-size: 14px;
                font-weight: bold;
                box-shadow: 0 2px 10px rgba(0,0,0,0.3);
                animation: slideDown 0.3s ease-out;
            `;
            
            banner.innerHTML = `
                <span>${icon} ${message}</span>
                <button onclick="this.parentElement.remove()" style="
                    margin-left: 20px;
                    background: rgba(255,255,255,0.3);
                    border: none;
                    color: white;
                    padding: 4px 8px;
                    border-radius: 4px;
                    cursor: pointer;
                    font-weight: bold;
                ">✕</button>
            `;
            
            // アニメーション用のスタイル追加
            const style = document.createElement('style');
            style.textContent = `
                @keyframes slideDown {
                    from { transform: translateY(-100%); }
                    to { transform: translateY(0); }
                }
            `;
            document.head.appendChild(style);
            
            document.body.appendChild(banner);
            
            if (duration > 0) {
                setTimeout(() => {
                    if (banner.parentElement) {
                        banner.remove();
                    }
                }, duration);
            }
        }
        
        /**
         * フィールドマッピングをテスト
         */
        testFieldMapping(sampleData) {
            console.log('🧪 Testing field mapping with sample data:', sampleData);
            const result = this.normalizeFields(sampleData, FIELD_MAPPINGS.reservation);
            
            console.log('📊 Test Results:');
            console.log('  ✅ Normalized:', result.normalized);
            console.log('  ❌ Missing Required:', result.missingRequired);
            console.log('  Valid:', result.isValid ? '✅' : '❌');
            
            return result;
        }
        
        /**
         * デバッグ情報を表示
         */
        showDebugInfo() {
            console.log('🔍 API Field Validator Debug Info:');
            console.log('  Intercepted Requests:', this.interceptedRequests);
            console.log('  Errors:', this.errors);
            console.log('  Warnings:', this.warnings);
            console.log('  Field Mappings:', FIELD_MAPPINGS);
        }
        
        /**
         * 監視を開始
         */
        startMonitoring() {
            if (this.isMonitoring) return;
            
            this.isMonitoring = true;
            this.interceptFetchAPI();
            
            console.log('🚀 API Field Validator monitoring started');
            console.log('💡 使い方:');
            console.log('  - window.APIValidator.testFieldMapping({...}) でテスト');
            console.log('  - window.APIValidator.showDebugInfo() でデバッグ情報表示');
        }
        
        /**
         * フィールド要素の存在チェック
         */
        checkRequiredElements() {
            const requiredIds = [
                'customerName',
                'phone',
                'email',
                'people',
                'selectedDate',
                'selectedTime',
                'message'
            ];
            
            const missing = [];
            requiredIds.forEach(id => {
                if (!document.getElementById(id)) {
                    missing.push(id);
                }
            });
            
            if (missing.length > 0) {
                console.warn('⚠️ Missing form elements:', missing);
                this.warnings.push({
                    type: 'missing_elements',
                    elements: missing,
                    timestamp: new Date()
                });
            }
            
            return missing.length === 0;
        }
    }
    
    // グローバルインスタンスを作成
    window.APIValidator = new APIFieldValidator();
    
    // ページロード後に自動開始
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            window.APIValidator.startMonitoring();
            window.APIValidator.checkRequiredElements();
        });
    } else {
        window.APIValidator.startMonitoring();
        window.APIValidator.checkRequiredElements();
    }
    
    console.log('✅ API Field Validator - Ready');
    
})();