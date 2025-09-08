#!/usr/bin/env node

/**
 * Health Check & Prevention Script for LINE Booking System
 * Run this before deployments to prevent common issues
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CHECKS = {
    passed: [],
    warnings: [],
    errors: []
};

// Check 1: Ensure no performance-intensive monitoring scripts
function checkPerformanceScripts() {
    const jsDir = path.join(__dirname, 'public', 'js');
    if (!fs.existsSync(jsDir)) return;
    
    const files = fs.readdirSync(jsDir);
    files.forEach(file => {
        if (!file.endsWith('.js')) return;
        
        const filePath = path.join(jsDir, file);
        const content = fs.readFileSync(filePath, 'utf8');
        
        // Check for dangerous setInterval patterns
        const dangerousPatterns = [
            /setInterval\([^,]+,\s*\d{1,3}\)/g,  // Intervals < 1000ms
            /setInterval\([^,]+,\s*1000\)/g,      // 1-second intervals
        ];
        
        dangerousPatterns.forEach(pattern => {
            if (pattern.test(content)) {
                CHECKS.errors.push(`DANGEROUS: ${file} contains short interval (< 5s) - can cause performance issues`);
            }
        });
        
        // Check for system-stabilizer references
        if (file.includes('system-stabilizer') || content.includes('system-stabilizer')) {
            CHECKS.errors.push(`BLOCKED FILE: ${file} is system-stabilizer related - should be removed`);
        }
    });
}

// Check 2: Verify .gcloudignore has required entries
function checkGcloudIgnore() {
    const ignorePath = path.join(__dirname, '.gcloudignore');
    if (!fs.existsSync(ignorePath)) {
        CHECKS.errors.push('MISSING: .gcloudignore file not found');
        return;
    }
    
    const content = fs.readFileSync(ignorePath, 'utf8');
    const requiredEntries = [
        'NTUSER.DAT*',
        'ntuser.dat*',
        'System Volume Information/',
        '*.lnk',
        'node_modules/',
        '.env',
        '.env.*'
    ];
    
    requiredEntries.forEach(entry => {
        if (!content.includes(entry)) {
            CHECKS.warnings.push(`MISSING in .gcloudignore: ${entry}`);
        }
    });
    
    CHECKS.passed.push('.gcloudignore properly configured');
}

// Check 3: Verify server.js has system-stabilizer blocking
function checkServerBlocking() {
    const serverPath = path.join(__dirname, 'server.js');
    if (!fs.existsSync(serverPath)) {
        CHECKS.errors.push('MISSING: server.js not found');
        return;
    }
    
    const content = fs.readFileSync(serverPath, 'utf8');
    
    if (!content.includes('blockSystemStabilizer') && !content.includes('system-stabilizer')) {
        CHECKS.warnings.push('server.js may not be blocking system-stabilizer.js requests');
    } else {
        CHECKS.passed.push('server.js has system-stabilizer blocking');
    }
    
    // Check for proper cache headers
    if (!content.includes('no-store') || !content.includes('no-cache')) {
        CHECKS.warnings.push('server.js may not have aggressive cache prevention headers');
    }
}

// Check 4: Verify timezone handling in admin interface
function checkTimezoneHandling() {
    const adminPath = path.join(__dirname, 'public', 'admin-full-featured.html');
    if (!fs.existsSync(adminPath)) {
        CHECKS.warnings.push('admin-full-featured.html not found');
        return;
    }
    
    const content = fs.readFileSync(adminPath, 'utf8');
    
    // Check for proper timezone configuration
    if (!content.includes("timeZone: 'Asia/Tokyo'")) {
        CHECKS.errors.push('Calendar not configured for Asia/Tokyo timezone');
    } else {
        CHECKS.passed.push('Calendar properly configured for Asia/Tokyo');
    }
    
    // Check makeLocalDate function
    if (content.includes('new Date(y, m - 1, d, H, Min, 0, 0)')) {
        CHECKS.errors.push('Old makeLocalDate function detected - will cause timezone issues');
    }
}

// Check 5: Look for problematic files that shouldn't exist
function checkProblematicFiles() {
    const problematicFiles = [
        'public/js/system-stabilizer.js',
        'public/js/performance-monitor.js',
        'public/js/sidebar-menu.js',  // 競合するサイドバー実装
        'public/css/hamburger-left-fix.css',  // 競合するCSS
        'public/css/sidemenu-style.css',  // 競合するCSS
        'NTUSER.DAT',
        'ntuser.dat',
        'desktop.ini'
    ];
    
    problematicFiles.forEach(file => {
        const filePath = path.join(__dirname, file);
        if (fs.existsSync(filePath)) {
            CHECKS.errors.push(`PROBLEMATIC FILE EXISTS: ${file} - should be removed`);
        }
    });
}

// Check 6: サイドバー実装の競合チェック（完全版）
function checkSidebarConflicts() {
    const adminPath = path.join(__dirname, 'public', 'admin-full-featured.html');
    if (!fs.existsSync(adminPath)) {
        CHECKS.warnings.push('admin-full-featured.html not found');
        return;
    }
    
    const content = fs.readFileSync(adminPath, 'utf8');
    
    // 競合する要素をチェック
    const conflicts = [];
    
    // === サイドバー表示問題の根本チェック ===
    
    // 1. 複数のサイドバー実装の競合
    if (content.includes('class="sidebar"') && content.includes('class="c-sidebar"')) {
        conflicts.push('Both .sidebar and .c-sidebar classes found - will cause display conflicts');
    }
    
    // 2. 危険なCSS position制御
    if (content.includes('left: -300px !important') || content.includes('left:-300px!important')) {
        conflicts.push('Using left with !important - sidebar may be stuck off-screen');
    }
    
    // 3. display:none問題
    if (content.includes('.sidebar') && content.includes('display: none') && !content.includes('display: block')) {
        conflicts.push('Sidebar using display:none without proper show logic');
    }
    
    // 4. transformベースの実装確認
    if (content.includes('.c-sidebar') && !content.includes('transform: translateX')) {
        conflicts.push('c-sidebar not using transform for positioning - may not animate properly');
    }
    
    // 5. z-index階層問題
    const sidebarZIndex = content.match(/\.c-sidebar[^}]*z-index:\s*(\d+)/);
    const overlayZIndex = content.match(/\.c-overlay[^}]*z-index:\s*(\d+)/);
    if (sidebarZIndex && overlayZIndex) {
        const sidebarZ = parseInt(sidebarZIndex[1]);
        const overlayZ = parseInt(overlayZIndex[1]);
        if (sidebarZ <= overlayZ) {
            conflicts.push(`Sidebar z-index (${sidebarZ}) <= overlay (${overlayZ}) - will be hidden behind`);
        }
    }
    
    // 6. sidebar-menu.jsが読み込まれているか
    if (content.includes('sidebar-menu.js') && !content.includes('<!-- sidebar-menu.js')) {
        conflicts.push('sidebar-menu.js is being loaded - will DELETE existing sidebar DOM');
    }
    
    // 7. 競合するCSSファイルが読み込まれているか
    const problematicCSS = ['hamburger-left-fix.css', 'sidemenu-style.css', 'sidebar-styles.css'];
    problematicCSS.forEach(css => {
        if (content.includes(css) && !content.includes(`<!-- ${css}`)) {
            conflicts.push(`${css} is being loaded - will override sidebar styles`);
        }
    });
    
    // 8. オーバーレイのpointer-eventsチェック
    if (content.includes('.c-overlay.is-visible') && !content.includes('pointer-events: auto')) {
        conflicts.push('Overlay missing pointer-events: auto when visible - clicks won\'t work');
    }
    
    // 9. weakenOverlays関数の除外条件
    if (content.includes('weakenOverlays')) {
        if (!content.includes(':not(.c-overlay)')) {
            conflicts.push('weakenOverlays will disable c-overlay - must add :not(.c-overlay) exclusion');
        }
        if (!content.includes('el.id === \'c-overlay\'')) {
            conflicts.push('weakenOverlays missing ID check for c-overlay');
        }
    }
    
    // 10. UnifiedSidebarクラスの存在と初期化
    if (!content.includes('class UnifiedSidebar')) {
        conflicts.push('UnifiedSidebar class not found - sidebar implementation missing');
    }
    if (!content.includes('window.unifiedSidebar = new UnifiedSidebar()')) {
        conflicts.push('UnifiedSidebar not instantiated globally');
    }
    if (!content.includes('window.unifiedSidebar.init()')) {
        conflicts.push('UnifiedSidebar.init() not called - sidebar won\'t be initialized');
    }
    
    // 11. 必須DOM要素の存在確認
    if (!content.includes('id="c-sidebar"')) {
        conflicts.push('No element with id="c-sidebar" - sidebar DOM missing');
    }
    if (!content.includes('id="c-overlay"')) {
        conflicts.push('No element with id="c-overlay" - overlay DOM missing');
    }
    
    // 12. イベントリスナーの確認
    if (!content.includes("overlay.addEventListener('click'")) {
        conflicts.push('Overlay click listener not found - won\'t close on outside click');
    }
    
    // 13. !importantの過剰使用警告
    const importantCount = (content.match(/!important/g) || []).length;
    if (importantCount > 60) {
        CHECKS.warnings.push(`Excessive !important usage (${importantCount} times) - CSS specificity issues likely`);
    }
    
    // 結果出力
    if (conflicts.length > 0) {
        conflicts.forEach(c => CHECKS.errors.push(`SIDEBAR: ${c}`));
    } else {
        CHECKS.passed.push('Sidebar implementation looks correct');
    }
}

// Check 7: Verify environment configuration
function checkEnvConfig() {
    const envPath = path.join(__dirname, '.env.yaml');
    if (!fs.existsSync(envPath)) {
        CHECKS.errors.push('MISSING: .env.yaml not found');
        return;
    }
    
    const content = fs.readFileSync(envPath, 'utf8');
    const requiredVars = [
        'SUPABASE_URL',
        'SUPABASE_ANON_KEY',
        'LINE_CHANNEL_ACCESS_TOKEN',
        'LINE_CHANNEL_SECRET',
        'LIFF_ID',
        'STORE_ID'
    ];
    
    requiredVars.forEach(varName => {
        if (!content.includes(varName)) {
            CHECKS.errors.push(`MISSING ENV VAR: ${varName}`);
        }
    });
    
    if (CHECKS.errors.filter(e => e.includes('ENV VAR')).length === 0) {
        CHECKS.passed.push('All required environment variables present');
    }
}

// Run all checks
console.log('🔍 Running health checks for LINE Booking System...\n');

checkPerformanceScripts();
checkGcloudIgnore();
checkServerBlocking();
checkTimezoneHandling();
checkProblematicFiles();
checkSidebarConflicts();
checkEnvConfig();

// Display results
console.log('✅ PASSED CHECKS:');
if (CHECKS.passed.length === 0) {
    console.log('  None');
} else {
    CHECKS.passed.forEach(msg => console.log(`  ✓ ${msg}`));
}

console.log('\n⚠️  WARNINGS:');
if (CHECKS.warnings.length === 0) {
    console.log('  None');
} else {
    CHECKS.warnings.forEach(msg => console.log(`  ⚠ ${msg}`));
}

console.log('\n❌ ERRORS:');
if (CHECKS.errors.length === 0) {
    console.log('  None');
} else {
    CHECKS.errors.forEach(msg => console.log(`  ✗ ${msg}`));
}

// Exit code based on errors
const exitCode = CHECKS.errors.length > 0 ? 1 : 0;
console.log('\n' + '='.repeat(50));
if (exitCode === 0) {
    console.log('✅ All critical checks passed! Safe to deploy.');
} else {
    console.log(`❌ ${CHECKS.errors.length} critical error(s) found. Fix before deploying!`);
}
console.log('='.repeat(50));

process.exit(exitCode);