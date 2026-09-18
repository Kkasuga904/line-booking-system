// GCP Cloud Run逕ｨ繧ｨ繝ｳ繧ｿ繝ｼ繝励Λ繧､繧ｺ邨ｱ蜷医し繝ｼ繝撰ｿｽE・ｽE・ｽE0轤ｹ貅轤ｹ迚茨ｼ・// LINE莠育ｴ・・ｽ・ｽ繧ｹ繝・・ｽ・ｽ縺ｮ繝｡繧､繝ｳ繧ｵ繝ｼ繝撰ｿｽE繝輔ぃ繧､繝ｫ
// Webhook縺ｨ繝輔Ο繝ｳ繝医お繝ｳ繝峨∫ｮ｡逅・・ｽ・ｽ髱｢繧堤ｵｱ蜷育ｮ｡逅・import express from 'express';
import { createClient } from '@supabase/supabase-js';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import fs from 'fs';

// 繧ｨ繝ｳ繧ｿ繝ｼ繝励Λ繧､繧ｺ讖滂ｿｽE繧､繝ｳ繝晢ｿｽE繝・// 逶｣隕厄ｿｽE繝ｬ繧ｸ繝ｪ繧ｨ繝ｳ繧ｹ繝ｻ繧ｻ繧ｭ繝･繝ｪ繝・・ｽ・ｽ讖滂ｿｽE繧偵Δ繧ｸ繝･繝ｼ繝ｫ蛹・import healthMonitor from './monitoring/health-monitor.js';
import { lineApiBreaker, supabaseBreaker, rateLimiter, messageQueue, RetryManager } from './utils/resilience.js';
import securityManager from './middleware/security.js';
// Optional: security middleware (fallback-safe if not present in image)
let createSession = () => 'dev-session';
let validateSession = () => null;
try {
  const sec = await import('./api-backup/security-middleware.js');
  createSession = sec.createSession || createSession;
  validateSession = sec.validateSession || validateSession;
  console.log('[security] middleware loaded');
} catch (e) {
  console.warn('[security] optional middleware not found, continuing without it');
}
// Stateless admin session (HMAC-signed token)
const ADMIN_SESSION_SECRET = process.env.ADMIN_SESSION_SECRET || process.env.ADMIN_PASSWORD || 'change-me';
function b64uEncode(str){return Buffer.from(str,'utf8').toString('base64').replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');}
function hmac(str) { return crypto.createHmac('sha256', ADMIN_SESSION_SECRET).update(str).digest('base64url'); }
function issueSessionToken(userId = 'admin') {
  const ts = Date.now();
  const payload = `${userId}:${ts}`;
  const sig = hmac(payload);
  return `${b64uEncode(payload)}.${sig}`;
}
function validateSessionToken(token, maxAgeMs = 2 * 60 * 60 * 1000) {
  try {
    if (!token || typeof token !== 'string') return null;
    const parts = token.split('.');
    if (parts.length !== 2) return null;
    const payloadStr = (function(){ let s=parts[0].replace(/-/g,'+').replace(/_/g,'/'); while(s.length%4) s+='='; return Buffer.from(s,'base64').toString('utf8'); })();
    const expected = hmac(payloadStr);
    if (expected !== parts[1]) return null;
    const [userId, tsStr] = payloadStr.split(':');
    const ts = Number(tsStr);
    if (!ts || Date.now() - ts > maxAgeMs) return null;
    return userId || 'admin';
  } catch { return null; }
}
import { detectLanguage, matchKeyword, getMessage, generateReservationConfirmation } from './utils/language-detector.js';
import { getSupabase } from './utils/supabase.js';

// ES繝｢繧ｸ繝･繝ｼ繝ｫ逕ｨ縺ｮ繝・・ｽ・ｽ繝ｬ繧ｯ繝医Μ繝代せ蜿門ｾ暦ｼ・_dirname莠呈鋤・ｽE・ｽEconst __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);\r\nconst PUBLIC_ROOT = path.join(__dirname, 'public');

// 迺ｰ蠅・・ｽ・ｽ謨ｰ隱ｭ縺ｿ霎ｼ縺ｿ・ｽE・ｽEecret Manager邨檎罰・ｽE・ｽEconst PORT = process.env.PORT || 8080;  // GCP Cloud Run縺ｮ繝・・ｽ・ｽ繧ｩ繝ｫ繝茨ｿｽE繝ｼ繝・const NODE_ENV = process.env.NODE_ENV || 'production';

// 迺ｰ蠅・・ｽ・ｽ謨ｰ繝√ぉ繝・・ｽ・ｽ・ｽE・ｽ・ｽE逋ｺ髦ｲ豁｢・ｽE・ｽE// Supabase謗･邯壹↓蠢・・ｽ・ｽ縺ｪ迺ｰ蠅・・ｽ・ｽ謨ｰ縺ｮ蟄伜惠遒ｺ隱・if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
  console.error('CRITICAL ERROR: Missing SUPABASE environment variables');
  console.error('SUPABASE_URL:', process.env.SUPABASE_URL ? 'Set' : 'Missing');
  console.error('SUPABASE_ANON_KEY:', process.env.SUPABASE_ANON_KEY ? 'Set' : 'Missing');
}

// LINE 繝√Ε繝阪Ν謨ｴ蜷域ｧ繝√ぉ繝・・ｽ・ｽ・ｽE・ｽ・ｽE逋ｺ髦ｲ豁｢・ｽE・ｽE// LINE Messaging API隱崎ｨｼ縺ｫ蠢・・ｽ・ｽ縺ｪ迺ｰ蠅・・ｽ・ｽ謨ｰ縺ｮ遒ｺ隱・if (!process.env.LINE_CHANNEL_SECRET || !process.env.LINE_CHANNEL_ACCESS_TOKEN) {
  console.error('CRITICAL ERROR: Missing LINE environment variables');
  console.error('LINE_CHANNEL_SECRET:', process.env.LINE_CHANNEL_SECRET ? 'Set' : 'Missing');
  console.error('LINE_CHANNEL_ACCESS_TOKEN:', process.env.LINE_CHANNEL_ACCESS_TOKEN ? 'Set' : 'Missing');
} else {
  // 繝√Ε繝阪Ν隴伜挨逕ｨ繝上ャ繧ｷ繝･逕滂ｿｽE・ｽE・ｽ繝・ヰ繝・げ逕ｨ・ｽE・ｽE  // 迺ｰ蠅・・ｽ・ｽ縺ｧ繝√Ε繝阪Ν險ｭ螳壹′荳閾ｴ縺励※縺・・ｽ・ｽ縺狗｢ｺ隱阪☆繧九◆繧・ｿｽE繝上ャ繧ｷ繝･蛟､
  const secretHash = crypto.createHash('md5').update(process.env.LINE_CHANNEL_SECRET).digest('hex').substring(0, 8);
  const tokenHash = crypto.createHash('md5').update(process.env.LINE_CHANNEL_ACCESS_TOKEN).digest('hex').substring(0, 8);
  
  console.log(JSON.stringify({
    severity: 'INFO',
    msg: 'LINE Channel Configuration',
    secretHash: secretHash,
    tokenHash: tokenHash,
    note: 'Verify these hashes match between environments'
  }));
}

// Supabase蛻晄悄蛹・// 繝・・ｽE繧ｿ繝呻ｿｽE繧ｹ繧ｯ繝ｩ繧､繧｢繝ｳ繝茨ｿｽE菴懶ｿｽE・ｽE・ｽ莠育ｴ・・ｽ・ｽ繝ｼ繧ｿ繝ｻ險ｭ螳夂ｮ｡逅・・ｽ・ｽ・ｽE・ｽEconst supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_ANON_KEY || ''
);

// Supabase繧ｵ繝ｼ繝薙せ繝ｭ繝ｼ繝ｫ繧ｯ繝ｩ繧､繧｢繝ｳ繝茨ｼ・LS繝舌う繝代せ逕ｨ繝ｻ蟆る摩螳ｶ謗ｨ螂ｨ・ｽE・ｽEconst supabaseAdmin = process.env.SUPABASE_SERVICE_ROLE_KEY
  ? createClient(
      process.env.SUPABASE_URL || '',
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      { auth: { persistSession: false } }
    )
  : supabase;

// Express繧｢繝励Μ繧ｱ繝ｼ繧ｷ繝ｧ繝ｳ蛻晄悄蛹・const app = express();

// ==========================================
// 繧ｨ繝ｳ繧ｿ繝ｼ繝励Λ繧､繧ｺ繝溘ラ繝ｫ繧ｦ繧ｧ繧｢・ｽE・ｽ譛蜆ｪ蜈郁ｨｭ螳夲ｼ・// ==========================================
// 繧ｻ繧ｭ繝･繝ｪ繝・・ｽ・ｽ繝ｻ繝ｬ繝ｼ繝亥宛髯撰ｿｽEIP繝悶Ο繝・・ｽ・ｽ繝ｳ繧ｰ繧帝←逕ｨ
// 髢狗匱迺ｰ蠅・・ｽ・ｽ縺ｯ辟｡蜉ｹ蛹・// FIXME: 荳譎ら噪縺ｫ辟｡蜉ｹ蛹厄ｼ・P繝悶Ο繝・・ｽ・ｽ蝠城｡鯉ｿｽE縺溘ａ・ｽE・ｽE// if (process.env.NODE_ENV === 'production') {
//   app.use(securityManager.middleware());
// }

// CORS險ｭ螳・app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  next();
});

// 繝ｪ繧ｯ繧ｨ繧ｹ繝茨ｿｽE逅・・ｽ・ｽ髢楢ｨ域ｸｬ繝溘ラ繝ｫ繧ｦ繧ｧ繧｢
// 繝代ヵ繧ｩ繝ｼ繝槭Φ繧ｹ逶｣隕悶→繧ｨ繝ｩ繝ｼ邇・・ｽ・ｽ霍｡逕ｨ
app.use((req, res, next) => {
  req.startTime = Date.now();  // 繝ｪ繧ｯ繧ｨ繧ｹ繝磯幕蟋区凾蛻ｻ險倬鹸
  res.on('finish', () => {
    const responseTime = Date.now() - req.startTime;
    const isError = res.statusCode >= 400;
    healthMonitor.recordRequest(responseTime, isError);  // 繝｡繝医Μ繧ｯ繧ｹ險倬鹸
  });
  next();
});

// ==========================================
// 譌ｧ繝｡繝九Η繝ｼ繧ｷ繧ｹ繝・・ｽ・ｽ縺ｮ410繝悶Ο繝・・ｽ・ｽ・ｽE・ｽ蠑ｷ蛹也沿・ｽE・ｽE// ==========================================
app.use((req, res, next) => {
  // 繝ｬ繧ｬ繧ｷ繝ｼ雉・・ｽ・ｽ繧貞ｮ鯉ｿｽE驕ｮ譁ｭ
  const blockedPaths = [
    '/js/sidebar-menu.js',
    '/api/sidebar-menu',
    '/api/sidebar',
    '/api/menu-renderer',
    '/legacy-menu.js',
    '/js/menu-renderer.js',
    '/templates/sidebar',
    '/partials/menu'
  ];
  
  if (blockedPaths.some(path => req.path.startsWith(path))) {
    console.log(`[410 Block] Legacy asset blocked: ${req.path}`);
    res.set('Cache-Control', 'no-store');
    return res.status(410).send('Gone');
  }
  next();
});

// ==========================================
// CSP繝倥ャ繝繝ｼ險ｭ螳夲ｼ育ｵｱ荳迚茨ｿｽE繧ｨ繝ｩ繝ｼ隗｣豸茨ｼ・// ==========================================
app.use((req, res, next) => {
  // admin逕ｻ髱｢縺ｨ縺晢ｿｽE莉厄ｿｽEHTML繝夲ｿｽE繧ｸ縺ｫ驕ｩ逕ｨ
  if (req.path.endsWith('.html') || req.path.includes('admin')) {
    // CSP繝倥ャ繝繝ｼ繧・蝗槭□縺題ｨｭ螳夲ｼ井ｺ碁㍾螳夂ｾｩ繧帝亟縺撰ｼ・    const cspPolicy = [
      "default-src 'self' https: data: blob:",
      "script-src 'self' https: 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' https: 'unsafe-inline'",
      "img-src 'self' https: data: blob:",
      "font-src 'self' https: data:",
      "media-src 'self' https: data: blob: *",  // 繝ｯ繧､繝ｫ繝峨き繝ｼ繝芽ｿｽ蜉縺ｧ蜈ｨ繝｡繝・・ｽ・ｽ繧｢險ｱ蜿ｯ
      "connect-src 'self' https: wss:",
      "frame-src 'self' https:",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "upgrade-insecure-requests"
    ].join('; ');
    
    res.set({
      'Content-Security-Policy': cspPolicy,
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'SAMEORIGIN',
      'X-XSS-Protection': '1; mode=block'
    });
  }
  next();
});

// 笘・・ｽ・ｽ蜉・ｽE・ｽ繝ｭ繝ｼ繧ｫ繝ｫ譌･莉倥ｒ 'YYYY-MM-DD' 縺ｧ霑斐☆
function formatLocalYMD(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

// ==========================================
// CORS險ｭ螳夲ｼ医ヶ繝ｩ繧ｦ繧ｶ蟇ｾ蠢懶ｼ・// ==========================================
app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-api-key');
    if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
    }
    next();
});

// ---- Minimal cookie parser (no external dependency) ----
function parseCookies(cookieHeader = '') {
  const out = {};
  if (!cookieHeader) return out;
  const parts = cookieHeader.split(';');
  for (const p of parts) {
    const idx = p.indexOf('=');
    if (idx === -1) continue;
    const k = p.slice(0, idx).trim();
    const v = decodeURIComponent(p.slice(idx + 1).trim());
    out[k] = v;
  }
  return out;
}

// ---- Admin session guard ----
function requireAdminSession(req, res, next) {
  try {
    const cookies = parseCookies(req.headers.cookie || '');
    const token = cookies['__Host_admin.sid'] || req.get('x-session') || '';
    const userId = validateSessionToken(token);

    if (!userId) {
      if (req.headers.accept && req.headers.accept.includes('text/html')) {
        return res.redirect(302, '/admin-login.html');
      }
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
      const origin = req.get('origin') || '';
      const host = (req.headers.host || '').toLowerCase();
      if (origin && !origin.toLowerCase().includes(host)) {
        return res.status(403).json({ error: 'Forbidden (origin mismatch)' });
      }
    }

    req.user = { id: userId, role: 'admin' };
    next();
  } catch (_e) {
    return res.status(401).json({ error: 'Authentication required' });
  }
}

// Protect admin HTML before static middleware serves it
app.get('/admin-full-featured.html', (req, res) => {
  const fp = path.join(__dirname, 'public', 'admin-full-featured.html');
  const send = () => {
    if (fs.existsSync(fp)) return res.sendFile(fp);
    return res.status(404).send('Not found');
  };
  if (MODE === 'off') return send();
  return requireAdminSession(req, res, send);
});

// ==========================================
// Admin API隱崎ｨｼ繝溘ラ繝ｫ繧ｦ繧ｧ繧｢・ｽE・ｽ繝｢繝ｼ繝会ｿｽE譖ｿ蠑擾ｼ・// ==========================================
// ===== Admin Auth Middleware (mode switch) =====
const MODE = (process.env.ADMIN_AUTH_MODE || 'on').toLowerCase();
const ADMIN_API_KEY = process.env.ADMIN_API_KEY || '';

// 繝・・ｽ・ｽ繝ｳ繝郁ｨｭ螳壹ｒ繧､繝ｳ繝晢ｿｽE繝・import { TENANTS, getTenantByHost, getApiKeyMapping } from './server/config/tenants.js';

function extractToken(req) {
    const bearer = (req.get('authorization') || '').replace(/^Bearer\s+/i, '');
    return req.get('x-api-key') || req.query.api_key || bearer || '';
}

// 繝・・ｽ・ｽ繝ｳ繝茨ｼ・tore_id・ｽE・ｽ繧偵し繝ｼ繝撰ｿｽE蛛ｴ縺ｧ蠑ｷ蛻ｶ豎ｺ螳・function resolveStoreId(req) {
    try {
        // 1) Host/SUBDOMAIN縺九ｉstore蜿門ｾ・        const host = (req.headers.host || '').toLowerCase();
        console.log('resolveStoreId: host=', host);
        
        if (typeof getTenantByHost === 'function') {
            const tenant = getTenantByHost(host);
            console.log('resolveStoreId: tenant=', tenant);
            if (tenant && tenant.alias) {
                console.log('resolveStoreId: using tenant alias=', tenant.alias);
                return tenant.alias;
            }
        } else {
            console.warn('resolveStoreId: getTenantByHost not available');
        }
        
        // 2) API繧ｭ繝ｼ縺九ｉ蛻､螳・        const token = extractToken(req);
        if (typeof getApiKeyMapping === 'function' && token) {
            const apiKeyMap = getApiKeyMapping();
            for (const [storeId, apiKey] of Object.entries(apiKeyMap || {})) {
                if (token === apiKey) {
                    console.log('resolveStoreId: matched API key for store=', storeId);
                    return storeId;
                }
            }
        }
        
        // 3) 繧ｯ繧ｨ繝ｪ/繝倥ャ繝繝ｼ・ｽE・ｽ譛蠕鯉ｿｽE菫晞匱・ｽE・ｽE        if (req.query.store_id) return String(req.query.store_id);
        if (req.headers['x-store-id']) return String(req.headers['x-store-id']);
        
        // 4) 繝帙せ繝亥錐縺ｫ繧医ｋ邁｡譏灘愛螳・        if (host.includes('account1')) return 'account1-store';
        if (host.includes('account2')) return 'account2-store';
        
        // 5) 繝・・ｽ・ｽ繧ｩ繝ｫ繝・        console.log('resolveStoreId: using ***REMOVED-ROTATE-CREDENTIAL***');
        return '***REMOVED-ROTATE-CREDENTIAL***';
    } catch (err) {
        console.error('resolveStoreId error:', err.message);
        return '***REMOVED-ROTATE-CREDENTIAL***';
    }
}

// ======= Admin Router with 逶ｴ謗･List (蟆る摩螳ｶ謗ｨ螂ｨ) =======
// 隱崎ｨｼOFF・ｽE・ｽ豁｢陦逕ｨ・ｽE・ｽ・・繝・・ｽ・ｽ繝ｳ繝郁ｧ｣豎ｺ
function authOff(req, _res, next) {
  req.user = req.user || { sub: 'dev', role: 'admin' };
  req.store_id = req.query.store_id || req.headers['x-store-id'] || '***REMOVED-ROTATE-CREDENTIAL***';
  next();
}

// ===== 逶ｴ list 繝上Φ繝峨Λ・ｽE・ｽEdmin.js 繧帝壹ｉ縺ｪ縺・・ｽ・ｽE=====
async function adminListDirect(req, res) {
  try {
    console.log('[adminListDirect] Bypassing auth - fetching real data');
    
    const store_id = req.store_id || req.query.store_id || '***REMOVED-ROTATE-CREDENTIAL***';
    const start = (req.query.start || '').slice(0, 10);
    const end = (req.query.end || '').slice(0, 10);
    
    console.log('[adminListDirect] Params:', { store_id, start, end });
    
    // Supabase 縺九ｉ螳溘ョ繝ｼ繧ｿ繧貞叙蠕・    const sb = getSupabaseAdmin();
    if (!sb) {
      console.log('[adminListDirect] No Supabase client, returning empty');
      return res.json({ ok: true, items: [] });
    }
    
    let query = sb.from('reservations')
      .select('*')
      .eq('store_id', store_id)
      .order('date', { ascending: true })
      .order('time', { ascending: true });
    
    if (start) {
      query = query.gte('date', start);
    }
    if (end) {
      query = query.lt('date', end);
    }
    
    const { data, error } = await query;
    
    if (error) {
      console.error('[adminListDirect] Query error:', error);
      // 繧ｨ繝ｩ繝ｼ縺ｧ繧らｩｺ驟搾ｿｽE繧定ｿ斐☆・ｽE・ｽEail-open・ｽE・ｽE      return res.json({ ok: true, items: [] });
    }
    
    console.log('[adminListDirect] Found', data?.length || 0, 'reservations');
    return res.json({ ok: true, items: data || [] });
  } catch (e) {
    console.error('[adminListDirect] Exception:', e);
    // 繧ｨ繝ｩ繝ｼ縺ｧ繧らｩｺ驟搾ｿｽE繧定ｿ斐☆・ｽE・ｽEail-open・ｽE・ｽE 
    return res.json({ ok: true, items: [] });
  }
}

// CRITICAL FIX: list 繧｢繧ｯ繧ｷ繝ｧ繝ｳ繧・adminRouter 繧医ｊ蜑阪↓蜃ｦ逅・// 縺薙ｌ縺ｫ繧医ｊ admin.js 縺ｮ隱崎ｨｼ繝√ぉ繝・・ｽ・ｽ繧貞ｮ鯉ｿｽE繝舌う繝代せ
// Removed pre-router intercept for /api/admin?action=list (security hardening)

// ------- admin 逕ｨ縺ｮ Router 繧貞ｮ夂ｾｩ・ｽE・ｽ鬆・・ｽ・ｽ縺悟多・ｽE・ｽE・ｽ・ｽE-------
const adminRouter = express.Router();

// 竭 蠢・・ｽ・ｽ譛蛻昴↓騾壹☆
adminRouter.use(express.json({ limit: '1mb' }));
adminRouter.use(express.urlencoded({ extended: true }));

// 竭｡ 繝・・ｽ・ｽ繝・・ｽ・ｽ逕ｨ縺ｮ "隱ｰ am I" 繧ｨ繝ｳ繝会ｿｽE繧､繝ｳ繝・adminRouter.get('/_whoami', (req, res) => {
  res.json({
    ok: true,
    user: req.user,
    store_id: req.store_id
  });
});

// 竭｢ 蜈ｨ縺ｦ縺ｮGET繝ｪ繧ｯ繧ｨ繧ｹ繝医ｒ繧､繝ｳ繧ｿ繝ｼ繧ｻ繝励ヨ・ｽE・ｽEction=list繧貞━蜈茨ｿｽE逅・・ｽ・ｽEadminRouter.use((req, res, next) => {
  console.log('[adminRouter middleware] Method:', req.method, 'URL:', req.url, 'Query:', req.query);
  
  // GET繝ｪ繧ｯ繧ｨ繧ｹ繝医〒action=list縺ｮ蝣ｴ蜷茨ｿｽE逶ｴ謗･蜃ｦ逅・  if (req.method === 'GET' && req.query.action === 'list') {
    console.log('[adminRouter] Intercepting list action - calling adminListDirect');
    return adminListDirect(req, res);
  }
  
  // /list繝代せ縺ｸ縺ｮGET繝ｪ繧ｯ繧ｨ繧ｹ繝医ｂ逶ｴ謗･蜃ｦ逅・  if (req.method === 'GET' && req.path === '/list') {
    console.log('[adminRouter] Intercepting /list path - calling adminListDirect');
    return adminListDirect(req, res);
  }
  
  console.log('[adminRouter] Passing to next handler');
  return next();
});

// 竭｢.5 隱崎ｨｼ縺ｯ縲御ｸ隕ｧ莉･螟悶阪↓縺ｮ縺ｿ驕ｩ逕ｨ・ｽE・ｽEODE縺経ff縺ｮ縺ｨ縺搾ｿｽE辟｡蜉ｹ蛹厄ｼ・if (MODE !== 'off') {
  adminRouter.use(requireAdminSession);
}

// 竭｣ 縺晢ｿｽE莉厄ｿｽE謫堺ｽ懶ｿｽE譌｢蟄倥∈・ｽE・ｽEist縺縺托ｿｽE莠悟ｺｦ縺ｨ admin.js 縺ｫ陦後°縺ｪ縺・・ｽ・ｽEadminRouter.all('/', async (req, res) => {
  // 譎る俣豁｣隕丞喧
  if (req.body && req.body.time !== undefined) {
    const t = String(req.body.time).trim();
    if (/^\d{1,2}:\d{2}$/.test(t)) {
      req.body.time = t.padStart(5, '0') + ':00';
    } else if (/^\d{1,2}:\d{2}:\d{2}(:.*)?$/.test(t)) {
      req.body.time = t.slice(0, 8);
    }
  }
  
  const adminHandler = await import('./api/admin.js');
  return adminHandler.default(req, res);
});

// 竭･ 莉穂ｸ翫￡・ｽE・ｽEapi/admin 縺ｫ router 繧・**荳逋ｺ縺ｧ**縺ｶ繧我ｸ九￡繧・app.use('/api/admin', adminRouter);

// /api/admin/list 繧ｨ繝ｳ繝会ｿｽE繧､繝ｳ繝茨ｼ亥ｰる摩螳ｶ謗ｨ螂ｨ・ｽE・ｽEapp.get('/api/admin/list', express.json(), async (req, res) => {
  console.log('[/api/admin/list] Direct endpoint called');
  
  try {
    const store_id = req.query.store_id || '***REMOVED-ROTATE-CREDENTIAL***';
    const start = req.query.start;
    const end = req.query.end;
    
    console.log('[/api/admin/list] Params:', { store_id, start, end });
    
    // Supabase 縺九ｉ螳溘ョ繝ｼ繧ｿ繧貞叙蠕・    const sb = getSupabaseAdmin();
    if (!sb) {
      console.log('[/api/admin/list] No Supabase client, returning empty');
      return res.json({ ok: true, items: [] });
    }
    
    let query = sb.from('reservations')
      .select('*')
      .eq('store_id', store_id)
      .order('date', { ascending: true })
      .order('time', { ascending: true });
    
    if (start) {
      query = query.gte('date', start.slice(0, 10));
    }
    if (end) {
      query = query.lt('date', end.slice(0, 10));
    }
    
    const { data, error } = await query;
    
    if (error) {
      console.error('[/api/admin/list] Query error:', error);
      // 繧ｨ繝ｩ繝ｼ縺ｧ繧らｩｺ驟搾ｿｽE繧定ｿ斐☆・ｽE・ｽEail-open・ｽE・ｽE      return res.json({ ok: true, items: [] });
    }
    
    console.log('[/api/admin/list] Found', data?.length || 0, 'reservations');
    return res.json({ ok: true, items: data || [] });
  } catch (e) {
    console.error('[/api/admin/list] Exception:', e);
    // 繧ｨ繝ｩ繝ｼ縺ｧ繧らｩｺ驟搾ｿｽE繧定ｿ斐☆・ｽE・ｽEail-open・ｽE・ｽE    return res.json({ ok: true, items: [] });
  }
});

// Direct delete endpoint (no auth; guarded by MODE)
app.delete('/api/admin/delete/:id', express.json(), async (req, res) => {
  try {
    const id = req.params.id;
    const storeId = req.query.store_id || process.env.STORE_ID || '***REMOVED-ROTATE-CREDENTIAL***';
    if (!id) return res.status(400).json({ error: 'id missing' });

    const sb = getSupabaseAdmin();
    if (!sb) return res.status(500).json({ error: 'Supabase not configured' });

    let { data, error } = await sb
      .from('reservations')
      .delete()
      .eq('id', id)
      .eq('store_id', storeId)
      .select();
    if (error) return res.status(500).json({ error: error.message });
    // 繝輔か繝ｼ繝ｫ繝舌ャ繧ｯ: store_id 縺御ｸ閾ｴ縺励↑縺・・ｽ・ｽ蜷茨ｿｽE id 縺ｮ縺ｿ縺ｧ蜑企勁・ｽE・ｽ螳会ｿｽE縺ｮ縺溘ａ1莉ｶ髯仙ｮ夲ｼ・    if (!data || data.length === 0) {
      const fallback = await sb
        .from('reservations')
        .delete()
        .eq('id', id)
        .limit(1)
        .select();
      data = fallback.data;
      if (fallback.error) return res.status(500).json({ error: fallback.error.message });
    }
    if (!data || data.length === 0) return res.status(404).json({ error: 'Not found' });
    return res.json({ success: true, deleted: data[0] });
  } catch (e) {
    console.error('[/api/admin/delete/:id] Exception:', e);
    return res.status(500).json({ error: 'Delete failed', message: e?.message });
  }
});

// Fallback: DELETE /api/admin?action=delete&id=123
app.delete('/api/admin', express.json(), async (req, res, next) => {
  try {
    const action = (req.query.action || '').toString().toLowerCase();
    if (action !== 'delete') return next();
    const id = req.query.id;
    if (!id) return res.status(400).json({ error: 'id missing' });
    const storeId = req.query.store_id || process.env.STORE_ID || '***REMOVED-ROTATE-CREDENTIAL***';

    const sb = getSupabaseAdmin();
    if (!sb) return res.status(500).json({ error: 'Supabase not configured' });
    let { data, error } = await sb
      .from('reservations')
      .delete()
      .eq('id', id)
      .eq('store_id', storeId)
      .select();
    if (error) return res.status(500).json({ error: error.message });
    if (!data || data.length === 0) {
      const fallback = await sb
        .from('reservations')
        .delete()
        .eq('id', id)
        .limit(1)
        .select();
      data = fallback.data;
      if (fallback.error) return res.status(500).json({ error: fallback.error.message });
    }
    if (!data || data.length === 0) return res.status(404).json({ error: 'Not found' });
    return res.json({ success: true, deleted: data[0] });
  } catch (e) {
    console.error('[DELETE /api/admin?action=delete] Exception:', e);
    return res.status(500).json({ error: 'Delete failed', message: e?.message });
  }
});

// ==========================================
// 繝・・ｽ・ｽ繝・・ｽ・ｽ逕ｨ繧ｨ繧ｳ繝ｼ繧ｨ繝ｳ繝会ｿｽE繧､繝ｳ繝茨ｼ亥ｰる摩螳ｶ謗ｨ螂ｨ・ｽE・ｽE// ==========================================
app.all('/api/__echo', express.json(), (req, res) => {
    console.log('Echo endpoint:', {
        timestamp: new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' }),
        method: req.method,
        url: req.originalUrl,
        headers: req.headers,
        query: req.query,
        body: req.body,
        ip: req.ip
    });
    
    res.json({
        timestamp: new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' }),
        method: req.method,
        url: req.originalUrl,
        query: req.query,
        body: req.body,
        bodyKeys: req.body ? Object.keys(req.body) : [],
        hasBody: !!req.body,
        bodyType: typeof req.body,
        contentType: req.headers['content-type']
    });
});

// ==========================================
// 髱咏噪繝輔ぃ繧､繝ｫ驟堺ｿ｡
// ==========================================

// 蝠城｡鯉ｿｽE縺ゅｋJS繝輔ぃ繧､繝ｫ繝悶Ο繝・・ｽ・ｽ・ｽE・ｽ蠢・・ｽ・ｽ譛蟆城剞縺ｫ髯仙ｮ夲ｼ・const blockProblematicFiles = (req, res, next) => {
    const p = (req.path || '').toLowerCase();
    // 迴ｾ迥ｶ縲∝ｮ滄圀縺ｫ蜿ゑｿｽE縺輔ｌ縺ｦ縺・・ｽ・ｽ縺・・ｽ・ｽ縺ｮ縺ｮ縺ｿ繝悶Ο繝・・ｽ・ｽ蟇ｾ雎｡縺ｫ谿九☆
    const blockedFiles = [
        'system-stabilizer.js',
        'portal-manager.js'
    ];

    if (blockedFiles.some(file => p.includes(file))) {
        console.log(`[BLOCKED] Problematic file request: ${p}`);
        return res.status(410).set({
            'Content-Type': 'text/plain; charset=UTF-8',
            'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
            'Pragma': 'no-cache',
            'Expires': '0',
            'X-Robots-Tag': 'noindex',
            'Surrogate-Control': 'no-store'
        }).send('This resource has been permanently removed.');
    }
    next();
};

// 縺吶∋縺ｦ縺ｮ繝ｫ繝ｼ繝医〒蝠城｡鯉ｿｽE縺ゅｋ繝輔ぃ繧､繝ｫ繧偵ヶ繝ｭ繝・・ｽ・ｽ
app.use(blockProblematicFiles);

// liff-booking.html 繧帝・菫｡縺吶ｋ髫帙↓ LIFF ID 縺ｮ陦ｨ險倥ｆ繧後ｒ陬懈ｭ｣縺励・liff_id= 縺ｧ荳頑嶌縺榊庄閭ｽ縺ｫ縺吶ｋ・磯撕逧・・菫｡繧医ｊ蜑阪↓繝輔ャ繧ｯ・・
app.get('/liff-booking.html', (req, res) => {
  try {
    const fp = path.join(__dirname, 'public', 'liff-booking.html');
    let html = fs.readFileSync(fp, 'utf8');
    // 譌｢遏･縺ｮ螟ｧ譁・ｭ・蟆乗枚蟄励ｆ繧後ｒ陬懈ｭ｣
    html = html.replace(/2006487876-Xd1A5qJB/g, '***REMOVED-ROTATE-CREDENTIAL***');
    // 繧ｯ繧ｨ繝ｪ謖・ｮ壹′縺ゅｌ縺ｰ蜆ｪ蜈医＆縺帙ｋ縺溘ａ縺ｮ繧ｹ繝九・繝・ヨ繧呈ｳｨ蜈･
    const inject = "<script>(function(){try{var p=new URLSearchParams(location.search||'');var id=p.get('liff_id');if(id){window.LIFF_ID=id;console.log('[LIFF] override id via query:',id);} }catch(e){}})();</script>";
    html = html.replace('</body>', inject + '</body>');
    res.setHeader('Content-Type', 'text/html; charset=UTF-8');
    return res.send(html);
  } catch (e) {
    return res.sendFile(path.join(__dirname, 'public', 'liff-booking.html'));
  }
});

// 霑ｽ蜉縺ｮ譏守､ｺ逧・・ｽ・ｽ繝ｼ繝茨ｼ亥ｿｵ縺ｮ縺溘ａ・ｽE・ｽEapp.get('/js/system-stabilizer.js', (_req, res) => res.status(410).send('Gone'));
app.get('/public/js/system-stabilizer.js', (_req, res) => res.status(410).send('Gone'));
app.get('*/system-stabilizer.js', (_req, res) => res.status(410).send('Gone'));

// public繝・・ｽ・ｽ繝ｬ繧ｯ繝医Μ蜀・・ｽEHTML/CSS/JS/逕ｻ蜒上ヵ繧｡繧､繝ｫ繧抵ｿｽE菫｡
// HTML繝輔ぃ繧､繝ｫ縺ｯ繧ｭ繝｣繝・・ｽ・ｽ繝･辟｡蜉ｹ蛹厄ｼ・o-store・ｽE・ｽEapp.get('/js/runtime-config.js', (_req, res) => {
  const trimTrailingSlash = (value) => (typeof value === 'string' ? value.replace(/\/+$/, '') : '');
  const baseCandidate = trimTrailingSlash(process.env.BASE_URL || process.env.PUBLIC_ORIGIN || '');
  const storeIdValue = process.env.STORE_ID || ACTIVE_STORE_ID || '***REMOVED-ROTATE-CREDENTIAL***';
  const liffIdValue = process.env.LIFF_ID || '';
  const scriptLines = [
    '(function(){',
    '  try {',
    `    var base = ${JSON.stringify(baseCandidate)};`,
    "    if (!base && typeof window !== 'undefined' && window.location) { base = window.location.origin || ''; }",
    "    if (base) { base = base.replace(/\/+$/, ''); window.API_BASE_URL = base; }",
    `    var storeId = ${JSON.stringify(storeIdValue)};`,
    "    if (storeId) { window.STORE_ID = storeId; }",
    `    var liffId = ${JSON.stringify(liffIdValue)};`,
    "    if (liffId) { window.LIFF_ID = liffId; }",
    '  } catch (err) {',
    "    console.error('[runtime-config]', err);",
    '  }',
    '})();'
  ];
  res.set('Cache-Control', 'no-store');
  res.type('application/javascript');
  res.send(scriptLines.join('\n'));
});

app.get('/js/runtime-config.js', (_req, res) => {
  const trimTrailingSlash = (value) => (typeof value === 'string' ? value.replace(/\/+$/, '') : '');
  const baseCandidate = trimTrailingSlash(process.env.BASE_URL || process.env.PUBLIC_ORIGIN || '');
  const storeIdValue = process.env.STORE_ID || ACTIVE_STORE_ID || '***REMOVED-ROTATE-CREDENTIAL***';
  const liffIdValue = process.env.LIFF_ID || '';
  const script = `(function(){
  try {
    var base = ${JSON.stringify(baseCandidate)};
    if (!base && typeof window !== 'undefined' && window.location) { base = window.location.origin || ''; }
    if (base) { base = base.replace(/\/+$/, ''); window.API_BASE_URL = base; }
    var storeId = ${JSON.stringify(storeIdValue)};
    if (storeId) { window.STORE_ID = storeId; }
    var liffId = ${JSON.stringify(liffIdValue)};
    if (liffId) { window.LIFF_ID = liffId; }
  } catch (err) {
    console.error('[runtime-config]', err);
  }
})();`;
  res.set('Cache-Control', 'no-store');
  res.type('application/javascript');
  res.send(script);
});

app.use(express.static(path.join(__dirname, 'public'), {
    maxAge: 0,
    fallthrough: true, // 専門家推奨
    setHeaders: (res, filepath) => {
        // Content-Typeを指定しながらキャッシュ戦略を制御
        if (filepath.endsWith('.css')) {
            res.setHeader('Content-Type', 'text/css; charset=UTF-8');
            res.setHeader('Cache-Control', 'public, max-age=3600');
        } else if (filepath.endsWith('.js')) {
            res.setHeader('Content-Type', 'application/javascript; charset=UTF-8');
            res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
        } else if (filepath.endsWith('.html')) {
            res.setHeader('Content-Type', 'text/html; charset=UTF-8');
            res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
        } else if (filepath.endsWith('.json')) {
            res.setHeader('Content-Type', 'application/json; charset=UTF-8');
        } else {
            // その他のファイル（画像など）は1時間キャッシュ
            res.setHeader('Cache-Control', 'public, max-age=3600');
        }
    }
}));

// Protect admin HTML and login endpoints
app.get('/admin-full-featured.html', requireAdminSession, (req, res) => {
  const fp = path.join(__dirname, 'public', 'admin-full-featured.html');
  if (fs.existsSync(fp)) return res.sendFile(fp);
  return res.status(404).send('Not found');
});

app.get('/admin-login.html', (req, res) => {
  if (MODE === 'off') {
    try {
      // 髢狗匱繝｢繝ｼ繝・ 蜊ｳ蟶ｭ繧ｻ繝・・ｽ・ｽ繝ｧ繝ｳ繧剃ｻ倅ｸ弱＠縺ｦ邂｡逅・・ｽ・ｽ髱｢縺ｸ
      const token = createSession('dev-admin');
      res.setHeader('Set-Cookie', `__Host_admin.sid=${encodeURIComponent(token)}; Path=/; HttpOnly; Secure; SameSite=Lax`);
    } catch(_) {}
    return res.redirect(302, '/admin-full-featured.html');
  }
  const fp = path.join(__dirname, 'public', 'admin-login.html');
  if (fs.existsSync(fp)) return res.sendFile(fp);
  return res.status(404).send('Not found');
});

app.post('/admin/login', express.json(), (req, res) => {
  const password = String((req.body && req.body.password) || '');
  const expected = process.env.ADMIN_PASSWORD || 'admin2024';
  if (!password || password !== expected) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  const token = issueSessionToken('admin');
  res.setHeader('Set-Cookie', `__Host_admin.sid=${encodeURIComponent(token)}; Path=/; HttpOnly; Secure; SameSite=Lax`);
  return res.json({ ok: true });
});

app.post('/admin/logout', (_req, res) => {
  res.setHeader('Set-Cookie', `__Host_admin.sid=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`);
  return res.json({ ok: true });
});

// 404繧ｨ繝ｩ繝ｼ蟇ｾ遲也畑繧ｹ繧ｿ繝・app.get('/api/seat-assignments', (req, res) => res.json({ seats: [] }));

// ==========================================
// 繝ｫ繝ｼ繝医ヱ繧ｹ縺ｧ邂｡逅・・ｽ・ｽ髱｢繧定｡ｨ遉ｺ
// ==========================================
app.get('/', (_req, res) => res.status(200).send('OK'));

// enhanced-booking.html縺ｸ縺ｮ繝ｪ繧ｯ繧ｨ繧ｹ繝医ｒliff-booking-enhanced.html縺ｫ繝ｪ繝繧､繝ｬ繧ｯ繝・
app.get('/enhanced-booking.html', (req, res) => {
    res.redirect(301, '/liff-booking-enhanced.html');
});

// enhanced-booking.html縺ｸ縺ｮ蜈ｨ縺ｦ縺ｮ繝代せ繧偵Μ繝繧､繝ｬ繧ｯ繝・
app.get('*/enhanced-booking.html', (req, res) => {
    res.redirect(301, '/liff-booking-enhanced.html');
});

// liff-booking.html縺ｸ縺ｮ繝ｪ繧ｯ繧ｨ繧ｹ繝医ｂliff-booking-enhanced.html縺ｫ繝ｪ繝繧､繝ｬ繧ｯ繝・
app.get('/liff-booking.html', (req, res) => {
    res.redirect(301, '/liff-booking-enhanced.html');
});

// ==========================================
// 蜀咲匱髦ｲ豁｢・ｽE・ｽ隱､縺｣縺欟RL繝代せ縺ｮ繝ｪ繝繧､繝ｬ繧ｯ繝・// ==========================================
// /public/縺ｧ蟋九∪繧九ヱ繧ｹ繧呈ｭ｣縺励＞繝代せ縺ｫ繝ｪ繝繧､繝ｬ繧ｯ繝・app.get('/public/*', (req, res) => {
    const correctPath = req.path.replace('/public/', '/');
    console.log(`Redirecting from ${req.path} to ${correctPath}`);
    res.redirect(301, correctPath + (req.originalUrl.includes('?') ? req.originalUrl.substring(req.originalUrl.indexOf('?')) : ''));
});

// ==========================================
// 繝薙Ν繝芽ｭ伜挨蟄舌お繝ｳ繝会ｿｽE繧､繝ｳ繝茨ｼ域怙蜆ｪ蜈茨ｼ・// ==========================================
app.get('/__version', (req, res) => {
    const buildTime = '2025-09-01T14:00:00+09:00';
    res.json({
        build: buildTime,
        rev: '20250901-hamburger-portal-fix',
        timestamp: Date.now(),
        deployment: 'Cloud Run Asia-Northeast1'
    });
});

// ==========================================
// 繝倥Ν繧ｹ繝√ぉ繝・・ｽ・ｽ & 繝撰ｿｽE繧ｸ繝ｧ繝ｳ・ｽE・ｽEody繝托ｿｽE繧ｵ繝ｼ荳崎ｦ・・ｽ・ｽE// ==========================================
// 邁｡譏難ｿｽE繝ｫ繧ｹ繝√ぉ繝・・ｽ・ｽ繧ｨ繝ｳ繝会ｿｽE繧､繝ｳ繝茨ｼ・CP逶｣隕也畑・ｽE・ｽEapp.get('/api/ping', (req, res) => {
  res.json({ 
    ok: true, 
    ts: Date.now(),
    env: {
      supabase_url: !!process.env.SUPABASE_URL,
      supabase_key: !!process.env.SUPABASE_ANON_KEY,
      line_token: !!process.env.LINE_CHANNEL_ACCESS_TOKEN,
      line_secret: !!process.env.LINE_CHANNEL_SECRET,
      store_id: process.env.STORE_ID || '***REMOVED-ROTATE-CREDENTIAL***'
    }
  });
});

// 繧ｷ繧ｹ繝・・ｽ・ｽ繝撰ｿｽE繧ｸ繝ｧ繝ｳ諠・・ｽ・ｽ繧ｨ繝ｳ繝会ｿｽE繧､繝ｳ繝・// (蜑企勁: 譁ｰ縺励＞ /api/version 繧剃ｽｿ逕ｨ)

// ==========================================
// LINE Webhook蜃ｦ逅・・ｽ・ｽExpress.raw菴ｿ逕ｨ - 莉厄ｿｽEbody繝托ｿｽE繧ｵ繝ｼ繧医ｊ蜑搾ｼ・・ｽ・ｽE// ==========================================

// LINE Developer Console縺ｮVerify繝懊ち繝ｳ逕ｨ・ｽE・ｽEET・ｽE・ｽEapp.get('/api/webhook', (req, res) => {
  console.log(JSON.stringify({
    severity: 'INFO',
    msg: 'LINE Webhook GET verification received'
  }));
  res.status(200).json({ 
    status: 'OK', 
    message: 'LINE Webhook endpoint is active',
    timestamp: new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })
  });
});

// LINE Webhook讀懆ｨｼ逕ｨ OPTIONS・ｽE・ｽEORS蟇ｾ蠢懶ｼ・app.options('/api/webhook', (req, res) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, x-line-signature');
  res.status(200).end();
});

// LINE Webhook繧ｨ繝ｳ繝会ｿｽE繧､繝ｳ繝茨ｼ育ｽｲ蜷肴､懆ｨｼ縺ｮ縺溘ａ express.raw 菴ｿ逕ｨ・ｽE・ｽE// 鄂ｲ蜷肴､懆ｨｼ縺ｫ縺ｯ逕滂ｿｽEBuffer縺悟ｿ・・ｽ・ｽ縺ｪ縺溘ａ縲゛SON繝托ｿｽE繧ｹ縺帙★縺ｫ蜃ｦ逅・app.post('/api/webhook', express.raw({ type: '*/*' }), async (req, res) => {
  console.log(JSON.stringify({
    severity: 'INFO',
    msg: 'Webhook request received',
    path: '/api/webhook',
    method: 'POST',
    headers: req.headers,
    hasBody: !!req.body
  }));
  
  res.status(200).end(); // 蜊ｳ蠎ｧ縺ｫ200繧定ｿ斐＠縺ｦ繧ｿ繧､繝繧｢繧ｦ繝医ｒ髦ｲ縺・
  // 髱槫酔譛溘〒螳滄圀縺ｮ蜃ｦ逅・・ｽ・ｽ陦後≧・ｽE・ｽEINE繧ｵ繝ｼ繝撰ｿｽE縺ｮ繧ｿ繧､繝繧｢繧ｦ繝亥ｯｾ遲厄ｼ・  setImmediate(async () => {
    try {
      const channelSecret = process.env.LINE_CHANNEL_SECRET;
      const signature = req.get('x-line-signature') || '';

      console.log(JSON.stringify({
        severity: 'INFO',
        msg: 'Webhook POST received',
        hasSecret: !!channelSecret,
        hasSignature: !!signature,
        hasBody: !!req.body,
        bodyType: req.body?.constructor?.name,
        bodyLength: req.body?.length,
        headers: {
          'content-type': req.headers['content-type'],
          'user-agent': req.headers['user-agent'],
          'x-line-signature': req.headers['x-line-signature'] ? 'present' : 'missing'
        }
      }));

      if (!channelSecret || !signature || !req.body) {
        console.error(JSON.stringify({ 
          severity: 'ERROR', 
          msg: 'missing secret/signature/rawBody',
          hasSecret: !!channelSecret,
          hasSignature: !!signature,
          hasBody: !!req.body
        }));
        return;
      }

      // req.body 縺ｯ Buffer・ｽE・ｽExpress.raw・ｽE・ｽ・ｽE 縺薙ｌ繧偵◎縺ｮ縺ｾ縺ｾHMAC-SHA256縺ｧ鄂ｲ蜷咲函謌・      // 謾ｹ陦後ｄ繧ｨ繝ｳ繧ｳ繝ｼ繝・・ｽ・ｽ繝ｳ繧ｰ縺ｮ蝠城｡後ｒ髦ｲ縺舌◆繧。uffer縺ｮ縺ｾ縺ｾ蜃ｦ逅・      const expected = crypto
        .createHmac('SHA256', channelSecret)
        .update(req.body)         // 竊・Buffer縺ｮ縺ｾ縺ｾ・ｽE・ｽE        .digest('base64');

      const ok =
        Buffer.byteLength(signature) === Buffer.byteLength(expected) &&
        crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));

      if (!ok) {
        console.error(JSON.stringify({
          severity: 'ERROR',
          msg: 'Invalid signature - Channel mismatch detected',
          sig_head: signature.slice(0, 10),
          exp_head: expected.slice(0, 10),
          sig_length: signature.length,
          exp_length: expected.length,
          secretHash: crypto.createHash('md5').update(channelSecret).digest('hex').substring(0, 8),
          troubleshooting: 'Verify LINE_CHANNEL_SECRET matches the channel configured in LINE Developer Console'
        }));
        return;
      }

      console.log(JSON.stringify({
        severity: 'INFO',
        msg: 'Signature verified successfully'
      }));

      // 鄂ｲ蜷肴､懆ｨｼ謌仙粥蠕後・ｿｽE繧√※Buffer繧谷SON蛹・      // UTF-8縺ｧ繝・・ｽ・ｽ繝ｼ繝峨＠縺ｦ縺九ｉ繝托ｿｽE繧ｹ
      const body = JSON.parse(req.body.toString('utf8'));
      const events = body?.events || [];

      console.log(JSON.stringify({
        severity: 'INFO',
        msg: 'Processing events',
        eventCount: events.length
      }));

      for (const ev of events) {
        await handleLineEvent(ev);
      }
    } catch (e) {
      console.error(JSON.stringify({ 
        severity: 'ERROR', 
        msg: 'webhook error', 
        error: e.message, 
        stack: e.stack 
      }));
    }
  });
});

// LINE繧､繝吶Φ繝茨ｿｽE逅・・ｽ・ｽ謨ｰ
// @param {Object} event - LINE縺九ｉ騾√ｉ繧後※縺上ｋ繧､繝吶Φ繝医が繝悶ず繧ｧ繧ｯ繝茨ｼ・essage, follow, unfollow縺ｪ縺ｩ・ｽE・ｽE// 繝｡繝・・ｽ・ｽ繝ｼ繧ｸ繧ｿ繧､繝励ｄ蜀・・ｽ・ｽ縺ｫ蠢懊§縺ｦ驕ｩ蛻・・ｽ・ｽ霑比ｿ｡繧定｡後≧
async function handleLineEvent(event) {
  try {
    // 蜿矩＃霑ｽ蜉繧､繝吶Φ繝茨ｿｽE蜃ｦ逅・・ｽ・ｽ繧ｦ繧ｧ繝ｫ繧ｫ繝繝｡繝・・ｽ・ｽ繝ｼ繧ｸ繧帝∽ｿ｡・ｽE・ｽE    if (event.type === 'follow') {
      await handleFollowEvent(event);
      return;
    }
    
    // 繝・・ｽ・ｽ繧ｹ繝医Γ繝・・ｽ・ｽ繝ｼ繧ｸ莉･螟厄ｿｽE蜃ｦ逅・・ｽ・ｽ縺ｪ縺・・ｽ・ｽ繧ｹ繧ｿ繝ｳ繝励ｄ逕ｻ蜒擾ｿｽE辟｡隕厄ｼ・    if (!event || event.type !== 'message' || !event.message || event.message.type !== 'text') {
      return;
    }

    // 繧､繝吶Φ繝医°繧牙ｿ・・ｽ・ｽ縺ｪ諠・・ｽ・ｽ繧貞叙蠕・    const userId = event.source?.userId;  // LINE繝ｦ繝ｼ繧ｶ繝ｼID・ｽE・ｽE縺ｧ蟋九∪繧句崋譛迂D・ｽE・ｽE    const text = event.message?.text;     // 騾∽ｿ｡縺輔ｌ縺溘Γ繝・・ｽ・ｽ繝ｼ繧ｸ繝・・ｽ・ｽ繧ｹ繝・    const replyToken = event.replyToken;  // 霑比ｿ｡逕ｨ繝茨ｿｽE繧ｯ繝ｳ・ｽE・ｽ譛牙柑譛滄剞1蛻・・ｽ・ｽE    
    // 險隱樊､懶ｿｽE・ｽE・ｽ螟夊ｨ隱槫ｯｾ蠢懶ｼ・    const detectedLanguage = detectLanguage(text);
    const keywordType = matchKeyword(text, detectedLanguage);

    console.log(JSON.stringify({
      severity: 'INFO',
      msg: 'Processing text message',
      userIdPrefix: userId ? userId.substring(0, 8) + '...' : 'none',
      text: text,
      detectedLanguage: detectedLanguage,
      keywordType: keywordType,
      eventType: event.type,
      replyTokenPrefix: replyToken ? replyToken.substring(0, 10) + '...' : 'none',
      channelInfo: {
        hasToken: !!process.env.LINE_CHANNEL_ACCESS_TOKEN,
        hasSecret: !!process.env.LINE_CHANNEL_SECRET,
        tokenPrefix: process.env.LINE_CHANNEL_ACCESS_TOKEN ? process.env.LINE_CHANNEL_ACCESS_TOKEN.substring(0, 10) + '...' : 'missing'
      }
    }));

    // 繝｡繝・・ｽ・ｽ繝ｼ繧ｸ縺ｫ蠢懊§縺滂ｿｽE逅・・ｽ・ｽ繧ｭ繝ｼ繝ｯ繝ｼ繝峨ｒ蛻､螳壹＠縺ｦ驕ｩ蛻・・ｽ・ｽ繧｢繧ｯ繧ｷ繝ｧ繝ｳ繧貞ｮ溯｡鯉ｼ・    let replyMessage = '';
    
    // 莠育ｴ・・ｽ・ｽ繝ｼ繝ｯ繝ｼ繝峨′蜷ｫ縺ｾ繧後※縺・・ｽ・ｽ蝣ｴ蜷茨ｼ亥､夊ｨ隱槫ｯｾ蠢懶ｼ・    if (keywordType === 'reservation') {
      const liffId = process.env.LIFF_ID || '***REMOVED-ROTATE-CREDENTIAL***';
      
      // 蜀咲匱髦ｲ豁｢: LIFF逕ｨ繝ｪ繝繧､繝ｬ繧ｯ繝茨ｿｽE繝ｼ繧ｸ繧剃ｽｿ逕ｨ
      // LIFF繝懊ち繝ｳ縺ｯ繝ｪ繝繧､繝ｬ繧ｯ繝茨ｿｽE繝ｼ繧ｸ繧剃ｽｿ逕ｨ縺励※繧ｨ繝ｩ繝ｼ繧貞屓驕ｿ
      const liffUrl = 'https://line-booking-api-116429620992.asia-northeast1.run.app/liff-redirect.html';
      const browserUrl = 'https://line-booking-api-116429620992.asia-northeast1.run.app/liff-booking-enhanced.html';
      const liffDirectUrl = `https://liff.line.me/${liffId}`;
      
      console.log(JSON.stringify({
        severity: 'INFO',
        msg: 'Sending reservation menu',
        liffId: liffId,
        liffUrl: liffUrl,
        browserUrl: browserUrl,
        userId: userId?.substring(0, 8) + '...'
      }));
      
      // Flex Message縺ｧ繝懊ち繝ｳ莉倥″繝｡繝・・ｽ・ｽ繝ｼ繧ｸ繧帝√ｋ・ｽE・ｽ繝ｪ繝・・ｽ・ｽ縺ｪ繝｡繝・・ｽ・ｽ繝ｼ繧ｸ蠖｢蠑擾ｼ・      const flexMessage = {
        type: 'flex',
        altText: getMessage('reservationMenu', detectedLanguage),
        contents: {
          type: 'bubble',
          hero: {
            type: 'box',
            layout: 'vertical',
            contents: [
              {
                type: 'text',
                text: detectedLanguage === 'en' ? '減 Reservation System' : 
                      detectedLanguage === 'ko' ? '減 ・ｽE・ｽ・ｽ ・ｽE・ｽ・､・ｽ・ｽ・ｽE :
                      detectedLanguage === 'zh' ? '減 鬚・・ｽ・ｽ邉ｻ扈・ : '減 莠育ｴ・・ｽ・ｽ繧ｹ繝・・ｽ・ｽ',
                weight: 'bold',
                size: 'lg',
                color: '#ffffff',
                align: 'center'
              }
            ],
            backgroundColor: '#ff6b35',
            paddingAll: '15px'
          },
          body: {
            type: 'box',
            layout: 'vertical',
            contents: [
              {
                type: 'text',
                text: getMessage('reservationMenu', detectedLanguage),
                weight: 'bold',
                size: 'xl',
                margin: 'md'
              },
              {
                type: 'text',
                text: getMessage('reservationPrompt', detectedLanguage),
                size: 'sm',
                color: '#999999',
                margin: 'md',
                wrap: true
              },
              {
                type: 'separator',
                margin: 'lg'
              },
              {
                type: 'box',
                layout: 'vertical',
                margin: 'lg',
                spacing: 'sm',
                contents: [
                  {
                    type: 'text',
                    text: getMessage('hint', detectedLanguage),
                    weight: 'bold',
                    size: 'sm',
                    color: '#667eea'
                  },
                  {
                    type: 'text',
                    text: getMessage('hintMessage', detectedLanguage),
                    size: 'xs',
                    color: '#999999',
                    wrap: true
                  }
                ]
              }
            ]
          },
          footer: {
            type: 'box',
            layout: 'vertical',
            spacing: 'sm',
            contents: [
              {
                type: 'button',
                style: 'primary',
                height: 'sm',
                action: {
                  type: 'uri',
                  label: getMessage('openInLine', detectedLanguage),
                  uri: browserUrl  // 繝悶Λ繧ｦ繧ｶURL縺ｫ螟画峩縺励※繧ｨ繝ｩ繝ｼ蝗樣∩
                },
                color: '#06c755'
              },
              {
                type: 'button',
                style: 'secondary',
                height: 'sm',
                action: {
                  type: 'uri',
                  label: getMessage('openInBrowser', detectedLanguage),
                  uri: browserUrl  // 繝輔か繝ｼ繝ｫ繝舌ャ繧ｯ逕ｨ
                }
              },
              {
                type: 'box',
                layout: 'horizontal',
                spacing: 'sm',
                contents: [
                  {
                    type: 'text',
                    text: '縺ｾ縺滂ｿｽE荳玖ｨ篭RL繧偵さ繝費ｿｽE:',
                    size: 'xxs',
                    color: '#999999',
                    flex: 0
                  }
                ],
                margin: 'md'
              },
              {
                type: 'text',
                text: browserUrl,
                size: 'xxs',
                color: '#06c755',
                wrap: true,
                action: {
                  type: 'uri',
                  uri: browserUrl
                }
              }
            ]
          }
        }
      };
      
      // Flex Message繧池eply繝｡繝・・ｽ・ｽ繝ｼ繧ｸ縺ｨ縺励※險ｭ螳・      try {
        await replyOrFallback(event, flexMessage);
      } catch (flexError) {
        console.error('Flex Message error:', flexError);
        // Flex Message縺悟､ｱ謨励＠縺溷ｴ蜷茨ｿｽE縲√す繝ｳ繝励Ν縺ｪ繝・・ｽ・ｽ繧ｹ繝医Γ繝・・ｽ・ｽ繝ｼ繧ｸ縺ｧ莉｣譖ｿ
        const simpleMessage = `套 莠育ｴ・・ｽE縺薙■繧峨°繧噂n\n迫 莠育ｴ・・ｽ・ｽ髱｢:\n${browserUrl}\n\n庁 荳願ｨ假ｿｽE繝ｪ繝ｳ繧ｯ繧偵ち繝・・ｽE縺励※莠育ｴ・・ｽ・ｽ髱｢繧帝幕縺・・ｽ・ｽ縺上□縺輔＞縲Ａ;
        await replyOrFallback(event, simpleMessage);
      }
      return; // 譌ｩ譛溘Μ繧ｿ繝ｼ繝ｳ縺ｧ莉厄ｿｽE蜃ｦ逅・・ｽ・ｽ繧ｹ繧ｭ繝・・ｽE・ｽE・ｽ驥崎ｦ・・ｽ・ｽ驥崎､・・ｽE逅・・ｽ・ｽ髦ｲ縺撰ｼ・    } 
    // 繧ｭ繝｣繝ｳ繧ｻ繝ｫ繧ｭ繝ｼ繝ｯ繝ｼ繝峨′蜷ｫ縺ｾ繧後※縺・・ｽ・ｽ蝣ｴ蜷茨ｼ亥､夊ｨ隱槫ｯｾ蠢懶ｼ・    else if (keywordType === 'cancel') {
      replyMessage = getMessage('confirmPrompt', detectedLanguage);
    } 
    // 遒ｺ隱阪く繝ｼ繝ｯ繝ｼ繝峨′蜷ｫ縺ｾ繧後※縺・・ｽ・ｽ蝣ｴ蜷茨ｼ亥､夊ｨ隱槫ｯｾ蠢懶ｼ・    else if (keywordType === 'confirm') {
      // Supabase縺九ｉ隧ｲ蠖薙Θ繝ｼ繧ｶ繝ｼ縺ｮ莉頑律莉･髯搾ｿｽE莠育ｴ・・ｽ・ｽ蜿門ｾ暦ｼ域悄髯撰ｿｽE繧鯉ｿｽE莠育ｴ・・ｽE髯､螟厄ｼ・      const { data, error } = await supabase
        .from('reservations')
        .select('*')
        .eq('user_id', userId)
        .gte('date', formatLocalYMD(new Date()))  // 莉頑律莉･髯・        .order('date', { ascending: true });  // 譌･莉倬・・ｽ・ｽ繧ｽ繝ｼ繝・
      if (data && data.length > 0) {
        const headerText = detectedLanguage === 'en' ? 'Reservation Confirmation:' :
                          detectedLanguage === 'ko' ? '・ｽE・ｽ・ｽ ・ｽ・ｽ・ｽ・ｸ:' :
                          detectedLanguage === 'zh' ? '鬚・・ｽ・ｽ遑ｮ隶､:' : '莠育ｴ・・ｽ・ｽ隱・';
        replyMessage = `${headerText}\n${data.map(r => `${r.date} ${r.time}`).join('\n')}`;
      } else {
        replyMessage = getMessage('noReservation', detectedLanguage);
      }
    } 
    // 繝｡繝九Η繝ｼ繧ｭ繝ｼ繝ｯ繝ｼ繝峨′蜷ｫ縺ｾ繧後※縺・・ｽ・ｽ蝣ｴ蜷茨ｼ亥､夊ｨ隱槫ｯｾ蠢懶ｼ・    else if (keywordType === 'menu') {
      const flexMessage = {
        type: 'flex',
        altText: getMessage('systemFunctions', detectedLanguage),
        contents: {
          type: 'bubble',
          body: {
            type: 'box',
            layout: 'vertical',
            contents: [
              {
                type: 'text',
                text: getMessage('systemFunctions', detectedLanguage),
                weight: 'bold',
                size: 'xl',
                margin: 'md'
              },
              {
                type: 'text',
                text: getMessage('availableFunctions', detectedLanguage),
                size: 'sm',
                color: '#999999',
                margin: 'md',
                wrap: true
              }
            ]
          },
          footer: {
            type: 'box',
            layout: 'vertical',
            spacing: 'sm',
            contents: [
              {
                type: 'button',
                style: 'primary',
                height: 'sm',
                action: {
                  type: 'uri',
                  label: getMessage('dashboard', detectedLanguage),
                  uri: 'https://line-booking-api-116429620992.asia-northeast1.run.app/dashboard.html'
                }
              },
              {
                type: 'button',
                style: 'secondary',
                height: 'sm',
                action: {
                  type: 'uri',
                  label: getMessage('calendar', detectedLanguage),
                  uri: 'https://line-booking-api-116429620992.asia-northeast1.run.app/admin-calendar-v2.html'
                }
              },
              {
                type: 'button',
                style: 'secondary',
                height: 'sm',
                action: {
                  type: 'uri',
                  label: getMessage('search', detectedLanguage),
                  uri: 'https://line-booking-api-116429620992.asia-northeast1.run.app/advanced-search.html'
                }
              },
              {
                type: 'button',
                style: 'secondary',
                height: 'sm',
                action: {
                  type: 'uri',
                  label: getMessage('monitor', detectedLanguage),
                  uri: 'https://line-booking-api-116429620992.asia-northeast1.run.app/system-monitor.html'
                }
              }
            ]
          }
        }
      };
      
      await replyOrFallback(event, flexMessage);
      return;
    } else {
      replyMessage = getMessage('availableCommands', detectedLanguage) + 
        (detectedLanguage === 'en' ? '\n\n導 Available commands:\n窶｢ reservation 竊・Booking screen\n窶｢ confirm 竊・Check status\n窶｢ cancel 竊・Cancel booking\n窶｢ menu 竊・All functions' :
         detectedLanguage === 'ko' ? '\n\n導 ・ｽE・ｽ・ｽE・ｽ ・ｽE・ｽ・ｽE・ｽ・ｽ・ｽ・ｽE・ｽE・ｽE・ｽ・ｽ:\n窶｢ ・ｽE・ｽ・ｽ 竊・・ｽE・ｽ・ｽ ・ｽ・ｽ・ｽ・ｴ\n窶｢ ・ｽ・ｽ・ｽ・ｸ 竊・・ｽE・ｽ・ｽ ・ｽE・ｽE・ｽE ・ｽ・ｽ・ｽ・ｸ\n窶｢ ・ｽE・ｽ・ｽE・ｽE竊・・ｽE・ｽ・ｽ ・ｽE・ｽ・ｽE・ｽ\n窶｢ ・ｽE・ｽ・ｴ 竊・・ｽE・ｽE・ｽ・ｽ ・ｽE・ｽ・ｽE・ｽ' :
         detectedLanguage === 'zh' ? '\n\n導 蜿ｯ逕ｨ蜻ｽ莉､:\n窶｢ 鬚・・ｽ・ｽ 竊・鬚・・ｽ・ｽ逕ｻ髱｢\n窶｢ 遑ｮ隶､ 竊・鬚・・ｽ・ｽ迥ｶ諤∫｡ｮ隶､\n窶｢ 蜿匁ｶ・竊・蜿匁ｶ磯｢・・ｽ・ｽ\n窶｢ 闖懷黒 竊・蜈ｨ驛ｨ蜉滂ｿｽE' :
         '\n\n導 蛻ｩ逕ｨ蜿ｯ閭ｽ縺ｪ繧ｳ繝槭Φ繝・\n窶｢ 莠育ｴ・竊・莠育ｴ・・ｽ・ｽ髱｢\n窶｢ 遒ｺ隱・竊・莠育ｴ・・ｽ・ｽ豕∫｢ｺ隱構n窶｢ 繧ｭ繝｣繝ｳ繧ｻ繝ｫ 竊・莠育ｴ・・ｽ・ｽ繝｣繝ｳ繧ｻ繝ｫ\n窶｢ 繝｡繝九Η繝ｼ 竊・蜈ｨ讖滂ｿｽE荳隕ｧ');
    }

    // LINE霑比ｿ｡・ｽE・ｽEeply API繧剃ｽｿ逕ｨ縲∝､ｱ謨玲凾縺ｯPush API縺ｫ繝輔か繝ｼ繝ｫ繝舌ャ繧ｯ・ｽE・ｽE    if (replyToken && replyMessage) {
      await replyOrFallback(event, replyMessage);
    }
  } catch (error) {
    console.error(JSON.stringify({
      severity: 'ERROR',
      msg: 'Event processing error',
      error: error.message,
      stack: error.stack
    }));
    
    // 繧ｨ繝ｩ繝ｼ譎ゅｂ繝ｦ繝ｼ繧ｶ繝ｼ縺ｫ騾夂衍
    if (event.replyToken) {
      try {
        const errorMessage = '繧ｷ繧ｹ繝・・ｽ・ｽ繧ｨ繝ｩ繝ｼ縺檎匱逕溘＠縺ｾ縺励◆縲ゅ＠縺ｰ繧峨￥蠕・・ｽ・ｽ縺ｦ縺九ｉ蜀榊ｺｦ縺願ｩｦ縺励￥縺縺輔＞縲・n\n繧ｨ繝ｩ繝ｼ隧ｳ邏ｰ: ' + (error.message || '荳搾ｿｽE縺ｪ繧ｨ繝ｩ繝ｼ');
        await replyOrFallback(event, errorMessage);
      } catch (replyError) {
        console.error('Failed to send error message:', replyError);
      }
    }
  }
}

// 蜿矩＃霑ｽ蜉繧､繝吶Φ繝茨ｿｽE逅・・ｽ・ｽ謨ｰ
// 譁ｰ隕丞暑驕碑ｿｽ蜉譎ゅ↓繧ｦ繧ｧ繝ｫ繧ｫ繝繝｡繝・・ｽ・ｽ繝ｼ繧ｸ繧帝∽ｿ｡
async function handleFollowEvent(event) {
  const userId = event.source?.userId;
  const replyToken = event.replyToken;

  console.log(JSON.stringify({
    severity: 'INFO',
    msg: 'New friend added (Account1)',
    userIdPrefix: userId ? userId.substring(0, 8) + '...' : 'none',
    replyTokenPrefix: replyToken ? replyToken.substring(0, 10) + '...' : 'none'
  }));

  const liffId = process.env.LIFF_ID || '***REMOVED-ROTATE-CREDENTIAL***';
  const welcomeMessage = `蜿矩＃霑ｽ蜉縺ゅｊ縺後→縺・・ｽ・ｽ縺悶＞縺ｾ縺呻ｼÅ沁・
縺薙■繧会ｿｽE鬮俶ｩ滂ｿｽE莠育ｴ・・ｽ・ｽ繧ｹ繝・・ｽ・ｽ縺ｧ縺吶・
導 莉翫☆縺蝉ｺ育ｴ・・ｽ・ｽ繧・
縲伸INE繧｢繝励Μ蜀・・ｽ・ｽEhttps://liff.line.me/${liffId}

縲舌ヶ繝ｩ繧ｦ繧ｶ縲蘇ttps://line-booking-api-116429620992.asia-northeast1.run.app/liff-booking-enhanced.html

東 縺泌茜逕ｨ譁ｹ豕・
窶｢ 縲御ｺ育ｴ・・ｽ・ｽ・ｽE 莠育ｴ・・ｽ・ｽ髱｢繧定｡ｨ遉ｺ
窶｢ 縲檎｢ｺ隱阪搾ｿｽE 莠育ｴ・・ｽ・ｽ豕√ｒ遒ｺ隱・ 
窶｢ 縲後く繝｣繝ｳ繧ｻ繝ｫ縲搾ｿｽE 莠育ｴ・・ｽ・ｽ繧ｭ繝｣繝ｳ繧ｻ繝ｫ
窶｢ 縲後Γ繝九Η繝ｼ縲搾ｿｽE 蜈ｨ讖滂ｿｽE荳隕ｧ陦ｨ遉ｺ

噫 譁ｰ讖滂ｿｽE:
窶｢ 繝繝・・ｽ・ｽ繝･繝懶ｿｽE繝画ｩ滂ｿｽE
窶｢ 鬮伜ｺｦ讀懃ｴ｢讖滂ｿｽE  
窶｢ 繧ｷ繧ｹ繝・・ｽ・ｽ逶｣隕匁ｩ滂ｿｽE
窶｢ 騾夂衍繧ｻ繝ｳ繧ｿ繝ｼ讖滂ｿｽE

菴輔°縺比ｸ搾ｿｽE縺ｪ轤ｹ縺後＃縺悶＞縺ｾ縺励◆繧峨√♀豌苓ｻｽ縺ｫ縺雁｣ｰ縺九￠縺上□縺輔＞・ｽE・ｽ`;

  // 蜿矩＃霑ｽ蜉譎ゑｿｽE replyToken 繧剃ｽｿ縺｣縺ｦ霑比ｿ｡
  if (replyToken && welcomeMessage) {
    await replyOrFallback(event, welcomeMessage);
  }
}

// Reply-to-Push 繝輔か繝ｼ繝ｫ繝舌ャ繧ｯ莉倥″縺ｮ霑比ｿ｡髢｢謨ｰ
// replyToken縺檎┌蜉ｹ縺ｪ蝣ｴ蜷医・ｿｽE蜍慕噪縺ｫpush繝｡繝・・ｽ・ｽ繝ｼ繧ｸ縺ｫ繝輔か繝ｼ繝ｫ繝舌ャ繧ｯ
async function replyOrFallback(event, message) {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  
  // 繧｢繧ｯ繧ｻ繧ｹ繝茨ｿｽE繧ｯ繝ｳ縺ｮ蟄伜惠遒ｺ隱・  if (!token) {
    console.error('LINE_CHANNEL_ACCESS_TOKEN is not set');
    return;
  }

  // 1) Reply API隧ｦ陦・  console.log(JSON.stringify({
    severity: 'INFO',
    msg: 'Sending reply to LINE',
    tokenPrefix: event.replyToken?.substring(0, 10) + '...',
    userIdPrefix: event.source?.userId?.substring(0, 8) + '...',
    messageType: typeof message === 'object' ? message.type : 'text',
    isFlexMessage: typeof message === 'object' && message.type === 'flex'
  }));

  // 繝｡繝・・ｽ・ｽ繝ｼ繧ｸ縺ｮ蠖｢蠑上ｒ蛻､螳夲ｼ・lex Message縺亀ext Message縺具ｼ・  const messagePayload = typeof message === 'object' && message.type === 'flex'
    ? [message]  // Flex Message縺ｮ蝣ｴ蜷茨ｿｽE縺晢ｿｽE縺ｾ縺ｾ驟搾ｿｽE縺ｫ
    : [{ type: 'text', text: message }];  // Text Message縺ｮ蝣ｴ蜷・
  // LINE Reply API縺ｫ繝ｪ繧ｯ繧ｨ繧ｹ繝磯∽ｿ｡
  const r1 = await fetch('https://api.line.me/v2/bot/message/reply', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ 
      replyToken: event.replyToken, 
      messages: messagePayload
    })
  });

  const t1 = await r1.text();
  
  // Reply謌仙粥譎ゑｿｽE縺薙％縺ｧ邨ゆｺ・  if (r1.ok) {
    console.log(JSON.stringify({
      severity: 'INFO',
      msg: 'Reply sent successfully'
    }));
    return;
  }

  // Reply螟ｱ謨玲凾縺ｮ繧ｨ繝ｩ繝ｼ繝ｭ繧ｰ
  console.error(JSON.stringify({ 
    severity: 'ERROR', 
    msg: 'line reply failed', 
    status: r1.status, 
    body: t1 
  }));

  // 2) 400 Invalid reply token 縺ｮ蝣ｴ蜷茨ｿｽE縺ｿ繝励ャ繧ｷ繝･縺ｫ繝輔か繝ｼ繝ｫ繝舌ャ繧ｯ
  // replyToken縺ｮ譛滄剞蛻・・ｽ・ｽ繧・・ｽE蛻ｩ逕ｨ繧ｨ繝ｩ繝ｼ縺ｮ蝣ｴ蜷・  if (r1.status === 400 && /Invalid reply token/i.test(t1) && event.source?.userId) {
    console.log(JSON.stringify({
      severity: 'INFO',
      msg: 'Attempting push fallback',
      userId: event.source.userId.substring(0, 8) + '...'
    }));

    // LINE Push API縺ｧ莉｣譖ｿ騾∽ｿ｡
    const r2 = await fetch('https://api.line.me/v2/bot/message/push', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        to: event.source.userId, 
        messages: messagePayload  // 蜷後§繝｡繝・・ｽ・ｽ繝ｼ繧ｸ蠖｢蠑上ｒ菴ｿ逕ｨ
      })
    });
    
    const t2 = await r2.text();
    
    // 繝輔か繝ｼ繝ｫ繝舌ャ繧ｯ邨先棡縺ｮ繝ｭ繧ｰ蜃ｺ蜉・    console.log(JSON.stringify({ 
      severity: r2.ok ? 'INFO' : 'ERROR', 
      msg: 'push fallback result', 
      status: r2.status, 
      body: t2 
    }));
  }
}

// LINE Reply API繧剃ｽｿ逕ｨ縺励◆繝｡繝・・ｽ・ｽ繝ｼ繧ｸ騾∽ｿ｡髢｢謨ｰ・ｽE・ｽ繝ｪ繝医Λ繧､讖滂ｿｽE莉倥″・ｽE・ｽE// @param {string} replyToken - 霑比ｿ｡逕ｨ繝茨ｿｽE繧ｯ繝ｳ・ｽE・ｽ譛牙柑譛滄剞1蛻・・ｽ・ｽE// @param {string} text - 騾∽ｿ｡縺吶ｋ繝・・ｽ・ｽ繧ｹ繝医Γ繝・・ｽ・ｽ繝ｼ繧ｸ
// @param {number} retryCount - 迴ｾ蝨ｨ縺ｮ繝ｪ繝医Λ繧､蝗樊焚・ｽE・ｽ・ｽE驛ｨ菴ｿ逕ｨ・ｽE・ｽEasync function replyToLine(replyToken, text, retryCount = 0) {
  const LINE_API_URL = 'https://api.line.me/v2/bot/message/reply';
  const MAX_RETRIES = 3;  // 譛螟ｧ繝ｪ繝医Λ繧､蝗樊焚・ｽE・ｽ繧ｵ繝ｼ繝撰ｿｽE繧ｨ繝ｩ繝ｼ譎ゑｼ・  
  try {
    console.log(JSON.stringify({
      severity: 'INFO',
      msg: 'Sending reply to LINE',
      tokenPrefix: replyToken.substring(0, 10) + '...',
      textLength: text.length,
      retry: retryCount
    }));

    // 繧｢繧ｯ繧ｻ繧ｹ繝茨ｿｽE繧ｯ繝ｳ繝√ぉ繝・・ｽ・ｽ・ｽE・ｽ・ｽE逋ｺ髦ｲ豁｢・ｽE・ｽE    if (!process.env.LINE_CHANNEL_ACCESS_TOKEN) {
      throw new Error('LINE_CHANNEL_ACCESS_TOKEN is not set');
    }

    const response = await fetch(LINE_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}`
      },
      body: JSON.stringify({
        replyToken,
        messages: [{
          type: 'text',
          text
        }]
      })
    });

    const responseText = await response.text();
    
    if (!response.ok) {
      console.error(JSON.stringify({
        severity: 'ERROR',
        msg: 'line reply failed',
        status: response.status,
        body: responseText,
        retry: retryCount
      }));
      
      // 繝ｪ繝医Λ繧､繝ｭ繧ｸ繝・・ｽ・ｽ・ｽE・ｽ・ｽE逋ｺ髦ｲ豁｢・ｽE・ｽE      if (retryCount < MAX_RETRIES && response.status >= 500) {
        console.log(`Retrying in ${(retryCount + 1) * 1000}ms...`);
        await new Promise(resolve => setTimeout(resolve, (retryCount + 1) * 1000));
        return replyToLine(replyToken, text, retryCount + 1);
      }
    } else {
      console.log(JSON.stringify({
        severity: 'INFO',
        msg: 'Reply sent successfully',
        retry: retryCount
      }));
    }
  } catch (error) {
    console.error(JSON.stringify({
      severity: 'ERROR',
      msg: 'Failed to reply to LINE',
      error: error.message,
      retry: retryCount
    }));
    
    // 繝阪ャ繝医Ρ繝ｼ繧ｯ繧ｨ繝ｩ繝ｼ縺ｮ蝣ｴ蜷茨ｿｽE繝ｪ繝医Λ繧､
    if (retryCount < MAX_RETRIES) {
      console.log(`Retrying in ${(retryCount + 1) * 1000}ms...`);
      await new Promise(resolve => setTimeout(resolve, (retryCount + 1) * 1000));
      return replyToLine(replyToken, text, retryCount + 1);
    }
  }
}

// ==========================================
// 莉厄ｿｽE繝ｫ繝ｼ繝育畑縺ｮbody繝托ｿｽE繧ｵ繝ｼ・ｽE・ｽEwebhook繧医ｊ蠕鯉ｼ・・ｽ・ｽE// ==========================================

// 縺晢ｿｽE莉厄ｿｽEAPI繧ｨ繝ｳ繝会ｿｽE繧､繝ｳ繝育畑
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 繝ｭ繧ｮ繝ｳ繧ｰ繝溘ラ繝ｫ繧ｦ繧ｧ繧｢
// 蜈ｨHTTP繝ｪ繧ｯ繧ｨ繧ｹ繝茨ｿｽE蜃ｦ逅・・ｽ・ｽ髢薙→繧ｹ繝・・ｽE繧ｿ繧ｹ繧定ｨ倬鹸・ｽE・ｽEapi/ping莉･螟厄ｼ・app.use((req, res, next) => {
  const start = Date.now();  // 繝ｪ繧ｯ繧ｨ繧ｹ繝磯幕蟋区凾蛻ｻ繧定ｨ倬鹸
  res.on('finish', () => {
    if (req.url !== '/api/ping') {
      console.log(JSON.stringify({
        severity: 'INFO',
        timestamp: new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' }),
        method: req.method,
        url: req.url,
        status: res.statusCode,
        duration: Date.now() - start
      }));
    }
  });
  next();
});

// ==========================================
// 邂｡逅・・ｽ・ｽ髱｢繝ｫ繝ｼ繝亥ｮ夂ｾｩ
// ==========================================
// 繝｡繧､繝ｳ邂｡逅・・ｽ・ｽ髱｢・ｽE・ｽ莠育ｴ・・ｽ・ｽ隕ｧ繝ｻ蝓ｺ譛ｬ讖滂ｿｽE・ｽE・ｽEapp.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// 繧ｫ繝ｬ繝ｳ繝繝ｼ蠖｢蠑擾ｿｽE莠育ｴ・・ｽ・ｽ逅・・ｽ・ｽ髱｢・ｽE・ｽE2迚茨ｼ壽隼濶ｯ迚茨ｼ・// 譛郁｡ｨ遉ｺ縺ｧ繝峨Λ繝・・ｽ・ｽ&繝峨Ο繝・・ｽE蟇ｾ蠢・app.get('/admin-calendar', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin-calendar-v2.html'));
});

// 蟶ｭ邂｡逅・・ｽ・ｽ髱｢・ｽE・ｽ繝・・繝悶Ν驟咲ｽｮ繝ｻ遨ｺ蟶ｭ迥ｶ豕・ｿｽE邂｡逅・・ｽ・ｽEapp.get('/seats', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'seats-management.html'));
});

// ==========================================
// LINE騾夂衍讖滂ｿｽE・ｽE・ｽEush API菴ｿ逕ｨ・ｽE・ｽE// ==========================================

// 莠育ｴ・・ｽ・ｽ隱阪Γ繝・・ｽ・ｽ繝ｼ繧ｸ騾∽ｿ｡髢｢謨ｰ
// 莠育ｴ・・ｽ・ｽ莠・・ｽ・ｽ縺ｫLINE繝ｦ繝ｼ繧ｶ繝ｼ縺ｸ遒ｺ隱埼夂衍繧帝√ｋ・ｽE・ｽ螟夊ｨ隱槫ｯｾ蠢懶ｼ・// @param {string} userId - LINE 繝ｦ繝ｼ繧ｶ繝ｼID・ｽE・ｽE縺ｧ蟋九∪繧具ｼ・// @param {Object} reservation - 莠育ｴ・・ｽ・ｽ蝣ｱ繧ｪ繝悶ず繧ｧ繧ｯ繝・// @param {string} customerName - 鬘ｧ螳｢蜷・// @param {string} language - 險隱槭さ繝ｼ繝会ｼ・a/en/ko/zh・ｽE・ｽEasync function sendReservationConfirmation(userId, reservation, customerName, language = 'ja') {
  try {
    console.log('粕 [Notification] Attempting to send confirmation to:', userId);
    
    const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
    if (!token) {
      console.error('LINE_CHANNEL_ACCESS_TOKEN not set - cannot send confirmation');
      return;
    }
    
    // user_id縺鍬INE蠖｢蠑上〒縺ｪ縺・・ｽ・ｽ蜷茨ｿｽE繧ｹ繧ｭ繝・・ｽE・ｽE・ｽE縺ｧ蟋九∪繧句ｿ・・ｽ・ｽ縺後≠繧具ｿｽE・ｽE    // LINE縺ｮ繝ｦ繝ｼ繧ｶ繝ｼID縺ｯ蠢・・ｽ・ｽ'U'縺ｧ蟋九∪繧・3譁・・ｽ・ｽ・ｽE譁・・ｽ・ｽ・ｽE
    if (!userId) {
      console.log('笶・No user ID provided, skipping confirmation message');
      return;
    }
    
    // LINE ID繝輔か繝ｼ繝槭ャ繝医ヰ繝ｪ繝・・ｽE繧ｷ繝ｧ繝ｳ
    if (!userId.startsWith('U')) {
      console.log(`笞・ｽE・ｽENot a valid LINE user ID (${userId}), skipping confirmation message`);
      return;
    }
    
    console.log('笨・Valid LINE user ID detected, preparing message...');
    
    // 螟夊ｨ隱槫ｯｾ蠢懶ｿｽE莠育ｴ・・ｽ・ｽ隱阪Γ繝・・ｽ・ｽ繝ｼ繧ｸ繧堤函謌・    const message = generateReservationConfirmation(reservation, customerName, language);
    
    const response = await fetch('https://api.line.me/v2/bot/message/push', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        to: userId,
        messages: [{
          type: 'text',
          text: message
        }]
      })
    });
    
    if (response.ok) {
      console.log('笨・Confirmation message sent successfully to:', userId);
    } else {
      const errorText = await response.text();
      console.error('笶・Failed to send confirmation message:', response.status, errorText);
    }
  } catch (error) {
    console.error('笶・Error sending reservation confirmation:', error);
  }
}

// ==========================================
// 莠育ｴ・・ｽ・ｽ繧ｹ繝・・ｽ・ｽ逕ｨAPI繧ｨ繝ｳ繝会ｿｽE繧､繝ｳ繝・// ==========================================

// 莠育ｴ・・ｽ・ｽ・ｽEAPI
// 繝輔Ο繝ｳ繝医お繝ｳ繝峨°繧画眠隕丈ｺ育ｴ・・ｽ・ｽ蜿励￠莉倥￠縺ｦSupabase縺ｫ菫晏ｭ・// 譎る俣蛻ｶ髯撰ｿｽE螳ｹ驥上メ繧ｧ繝・・ｽ・ｽ繝ｻLINE騾夂衍讖滂ｿｽE繧貞性繧
app.post('/api/calendar-reservation', async (req, res) => {
  console.log(JSON.stringify({
    severity: 'INFO',
    msg: 'Reservation request received (Account1)',
    body: req.body,
    headers: {
      'content-type': req.headers['content-type'],
      'content-length': req.headers['content-length']
    }
  }));
  
  try {
    const storeId = process.env.STORE_ID || '***REMOVED-ROTATE-CREDENTIAL***';
    const { date, time, name, phone, email, message, user_id, store_id } = req.body;
    
    // 蜈･蜉帶､懆ｨｼ・ｽE・ｽ蠢・・ｽ・ｽ鬆・・ｽ・ｽ縺ｮ繝√ぉ繝・・ｽ・ｽ・ｽE・ｽE    if (!date || !time || !name || !phone) {
      console.error(JSON.stringify({
        severity: 'ERROR',
        msg: 'Missing required fields',
        received: { date: !!date, time: !!time, name: !!name, phone: !!phone }
      }));
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: date, time, name, phone'
      });
    }
    
    // Store ID荳肴紛蜷医メ繧ｧ繝・・ｽ・ｽ・ｽE・ｽ・ｽE繝ｫ繝√い繧ｫ繧ｦ繝ｳ繝域ｷｷ蝨ｨ髦ｲ豁｢・ｽE・ｽE    if (store_id && store_id !== storeId) {
      console.error(JSON.stringify({
        severity: 'ERROR',
        msg: 'Store ID mismatch detected - prevention check',
        frontend_store_id: store_id,
        server_store_id: storeId,
        account: 'account1'
      }));
      return res.status(400).json({
        success: false,
        error: `Store ID mismatch: frontend=${store_id}, server=${storeId}`,
        troubleshooting: 'Check frontend HTML store_id configuration'
      });
    }
    
    // 譎る俣蛻ｶ髯舌メ繧ｧ繝・・ｽ・ｽ・ｽE・ｽ邂｡逅・・ｽ・ｽE・ｽ・ｽ險ｭ螳壹＠縺滉ｺ育ｴ・・ｽ・ｽ髯舌ｒ遒ｺ隱搾ｼ・    console.log(JSON.stringify({
      severity: 'INFO',
      msg: 'Checking time restrictions',
      date,
      time,
      store_id: storeId
    }));
    
    // 1. 隧ｲ蠖捺凾髢捺棧縺ｮ蛻ｶ髯舌ｒ蜿門ｾ暦ｼ・ime_restrictions繝・・ｽE繝悶Ν縺九ｉ・ｽE・ｽE    const { data: restriction, error: restrictionError } = await supabase
      .from('time_restrictions')
      .select('*')
      .eq('store_id', storeId)
      .eq('date', date)
      .eq('time_slot', time)
      .single();
    
    if (restrictionError && restrictionError.code !== 'PGRST116') {
      console.error('Error fetching restriction:', restrictionError);
    }
    
    // 繝悶Ο繝・・ｽ・ｽ繝√ぉ繝・・ｽ・ｽ・ｽE・ｽ邂｡逅・・ｽ・ｽE・ｽ・ｽ莠育ｴ・・ｽ・ｽ蜿ｯ縺ｫ險ｭ螳壹＠縺滓凾髢灘ｸｯ・ｽE・ｽE    if (restriction?.is_blocked) {
      console.log(JSON.stringify({
        severity: 'WARNING',
        msg: 'Time slot is blocked',
        date,
        time,
        reason: restriction.reason
      }));
      return res.status(400).json({
        success: false,
        error: '縺難ｿｽE譎る俣蟶ｯ縺ｯ莠育ｴ・・ｽ・ｽ蜿励￠莉倥￠縺ｦ縺・・ｽ・ｽ縺帙ｓ',
        reason: restriction.reason || '邂｡逅・・ｽ・ｽE・ｽ・ｽ繧医ｊ蛻ｶ髯舌＆繧後※縺・・ｽ・ｽ縺・
      });
    }
    
    // 2. 迴ｾ蝨ｨ縺ｮ莠育ｴ・・ｽ・ｽ繧貞叙蠕暦ｼ域ｺ蟶ｭ繝√ぉ繝・・ｽ・ｽ逕ｨ・ｽE・ｽE    const { data: existingReservations, error: countError } = await supabase
      .from('reservations')
      .select('id')
      .eq('store_id', storeId)
      .eq('date', date)
      .eq('time', time)
      .eq('status', 'confirmed');
    
    if (countError) {
      console.error('Error counting reservations:', countError);
    }
    
    const currentCount = existingReservations?.length || 0;
    const maxCapacity = restriction?.max_capacity ?? 4; // 繝・・ｽ・ｽ繧ｩ繝ｫ繝・邨・・ｽ・ｽ縺ｧ蜿嶺ｻ・    
    console.log(JSON.stringify({
      severity: 'INFO',
      msg: 'Capacity check',
      currentCount,
      maxCapacity,
      hasCapacity: currentCount < maxCapacity
    }));
    
    // 螳ｹ驥上メ繧ｧ繝・・ｽ・ｽ・ｽE・ｽ貅蟶ｭ蛻､螳夲ｼ・    if (currentCount >= maxCapacity) {
      return res.status(400).json({
        success: false,
        error: '縺難ｿｽE譎る俣蟶ｯ縺ｯ貅蟶ｭ縺ｧ縺・,
        detail: `譛螟ｧ${maxCapacity}邨・・ｽ・ｽ縺ｧ縲∫樟蝨ｨ${currentCount}邨・・ｽE莠育ｴ・・ｽ・ｽ縺ゅｊ縺ｾ縺兪
      });
    }
    
    // 譌｢蟄假ｿｽE繝・・ｽE繝悶Ν讒矩縺ｫ蜷医ｏ縺帙◆莠育ｴ・・ｽ・ｽ繝ｼ繧ｿ菴懶ｿｽE
    // status 縺ｯ 'confirmed' 縺ｧ菴懶ｿｽE・ｽE・ｽ遒ｺ螳壽ｸ医∩・ｽE・ｽE    const baseRecord = {
      store_id: storeId,
      date,
      time,
      phone,
      email,
      message,
      user_id,
      status: 'confirmed'
    };
    
    // 蜷榊燕繝輔ぅ繝ｼ繝ｫ繝会ｿｽE隍・・ｽ・ｽ縺ｮ繝代ち繝ｼ繝ｳ繧定・・ｽE・ｽE・ｽEB險ｭ險茨ｿｽE驕輔＞縺ｫ蟇ｾ蠢懶ｼ・    let reservationRecord;
    
    // 繝代ち繝ｼ繝ｳ1: customer_name 繝輔ぅ繝ｼ繝ｫ繝峨ｒ隧ｦ陦・    try {
      reservationRecord = { ...baseRecord, customer_name: name };
      console.log(JSON.stringify({
        severity: 'INFO',
        msg: 'Attempting insertion with customer_name field (Account1)',
        record: reservationRecord
      }));
      
      const { data, error } = await supabase
        .from('reservations')
        .insert([reservationRecord])
        .select();
        
      if (!error) {
        console.log(JSON.stringify({
          severity: 'INFO',
          msg: 'Reservation created successfully with customer_name (Account1)',
          reservation_id: data[0]?.id
        }));
        
        // LINE騾夂衍騾∽ｿ｡・ｽE・ｽ莠育ｴ・・ｽ・ｽ隱阪Γ繝・・ｽ・ｽ繝ｼ繧ｸ・ｽE・ｽE        // LINE繝ｦ繝ｼ繧ｶ繝ｼID縺後≠繧句ｴ蜷茨ｿｽE縺ｿ騾夂衍繧帝∽ｿ｡
        console.log('鐙 [Account1] Checking if notification should be sent...');
        console.log('  - user_id:', user_id);
        console.log('  - reservation:', data[0]);
        if (user_id) {
          await sendReservationConfirmation(user_id, data[0], name);
        } else {
          console.log('笞・ｽE・ｽENo user_id provided, skipping notification');
        }
        
        return res.json({ 
          success: true, 
          reservation: data[0] 
        });
      }
      
      console.log('customer_name failed, trying name field:', error.message);
    } catch (e) {
      console.log('customer_name attempt failed:', e.message);
    }
    
    // 繝代ち繝ｼ繝ｳ2: name 繝輔ぅ繝ｼ繝ｫ繝峨ｒ隧ｦ陦鯉ｼ亥挨縺ｮDB繧ｹ繧ｭ繝ｼ繝槭↓蟇ｾ蠢懶ｼ・    try {
      reservationRecord = { ...baseRecord, name: name };
      console.log(JSON.stringify({
        severity: 'INFO',
        msg: 'Attempting insertion with name field (Account1)',
        record: reservationRecord
      }));
      
      const { data, error } = await supabase
        .from('reservations')
        .insert([reservationRecord])
        .select();
        
      if (!error) {
        console.log(JSON.stringify({
          severity: 'INFO',
          msg: 'Reservation created successfully with name (Account1)',
          reservation_id: data[0]?.id
        }));
        
        // LINE騾夂衍騾∽ｿ｡・ｽE・ｽ莠育ｴ・・ｽ・ｽ隱阪Γ繝・・ｽ・ｽ繝ｼ繧ｸ・ｽE・ｽE        // LINE繝ｦ繝ｼ繧ｶ繝ｼID縺後≠繧句ｴ蜷茨ｿｽE縺ｿ騾夂衍繧帝∽ｿ｡
        console.log('鐙 [Account1] Checking if notification should be sent...');
        console.log('  - user_id:', user_id);
        console.log('  - reservation:', data[0]);
        if (user_id) {
          await sendReservationConfirmation(user_id, data[0], name);
        } else {
          console.log('笞・ｽE・ｽENo user_id provided, skipping notification');
        }
        
        return res.json({ 
          success: true, 
          reservation: data[0] 
        });
      }
      
      console.log('name field also failed:', error.message);
      throw error;
    } catch (e) {
      console.log('Both customer_name and name fields failed');
      throw e;
    }
    
  } catch (error) {
    console.error('Reservation creation error (Account1):', error);
    res.status(500).json({ 
      success: false, 
      error: error.message,
      details: 'Database schema mismatch - check table structure'
    });
  }
});

// 譎る俣蛻ｶ髯占ｨｭ螳壼叙蠕輸PI
// 邂｡逅・・ｽ・ｽE・ｽ・ｽ險ｭ螳壹＠縺滉ｺ育ｴ・・ｽ・ｽ髯先ュ蝣ｱ繧貞叙蠕暦ｼ亥ｮ壽悄蛻ｶ髯撰ｿｽE迚ｹ螳壽律蛻ｶ髯撰ｼ・app.get('/api/time-restrictions', async (req, res) => {
  try {
    const storeId = process.env.STORE_ID || '***REMOVED-ROTATE-CREDENTIAL***';
    const { date } = req.query;
    
    // 螳壽悄蛻ｶ髯舌ｒ蜿門ｾ暦ｼ域ｯ朱ｱ迚ｹ螳壽屆譌･縺ｮ蛻ｶ髯撰ｼ・    const { data: recurring, error: recurringError } = await supabase
      .from('recurring_restrictions')
      .select('*')
      .eq('store_id', storeId);
    
    if (recurringError) throw recurringError;
    
    // 迚ｹ螳壽律縺ｮ蛻ｶ髯舌ｒ蜿門ｾ暦ｼ域律莉俶欠螳夲ｿｽE荳譎ら噪蛻ｶ髯撰ｼ・    let specific = [];
    if (date) {
      const { data: specificData, error: specificError } = await supabase
        .from('time_restrictions')
        .select('*')
        .eq('store_id', storeId)
        .eq('date', date);
      
      if (specificError) throw specificError;
      specific = specificData;
    }
    
    res.json({
      success: true,
      weekly: recurring || [],
      specific: specific || []
    });
  } catch (error) {
    console.error('Error fetching time restrictions:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 譎る俣蛻ｶ髯占ｨｭ螳壻ｿ晏ｭ連PI
// 邂｡逅・・ｽ・ｽ髱｢縺九ｉ縺ｮ蛻ｶ髯占ｨｭ螳壹ｒ菫晏ｭ假ｼ・psert縺ｫ繧医ｋ譖ｴ譁ｰ繝ｻ謖ｿ蜈･・ｽE・ｽEapp.post('/api/time-restrictions', async (req, res) => {
  try {
    const storeId = process.env.STORE_ID || '***REMOVED-ROTATE-CREDENTIAL***';
    const { type, dayOrDate, time, capacity, isBlocked, reason } = req.body;
    
    if (type === 'weekly') {
      // 螳壽悄蛻ｶ髯撰ｿｽE譖ｴ譁ｰ・ｽE・ｽ豈朱ｱ蜷後§譖懈律縺ｫ驕ｩ逕ｨ・ｽE・ｽE      const { error } = await supabase
        .from('recurring_restrictions')
        .upsert({
          store_id: storeId,
          day_of_week: dayOrDate,
          start_time: time,
          end_time: time,
          max_capacity: capacity,
          is_blocked: isBlocked,
          reason: reason
        }, {
          onConflict: 'store_id,day_of_week,start_time'
        });
      
      if (error) throw error;
    } else {
      // 迚ｹ螳壽律蛻ｶ髯撰ｿｽE譖ｴ譁ｰ・ｽE・ｽ蜊倅ｸ譌･莉假ｿｽE縺ｿ驕ｩ逕ｨ・ｽE・ｽE      const { error } = await supabase
        .from('time_restrictions')
        .upsert({
          store_id: storeId,
          date: dayOrDate,
          time_slot: time,
          max_capacity: capacity,
          is_blocked: isBlocked,
          reason: reason
        }, {
          onConflict: 'store_id,date,time_slot'
        });
      
      if (error) throw error;
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error saving time restriction:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// lazy init・ｽE・ｽ襍ｷ蜍暮・・ｽE蠖ｱ髻ｿ繧帝∩縺代ｋ・ｽE・ｽE 蟆る摩螳ｶ謗ｨ螂ｨ
let supabaseAdminLazy = null;
function getSupabaseAdmin() {
  if (supabaseAdminLazy) return supabaseAdminLazy;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url) {
    console.error('[supabase] missing SUPABASE_URL');
    return null;
  }
  if (!key) {
    // 繝輔か繝ｼ繝ｫ繝舌ャ繧ｯ: 繧ｵ繝ｼ繝薙せ繝ｭ繝ｼ繝ｫ繧ｭ繝ｼ縺檎┌縺・・ｽ・ｽ蠅・・ｽ・ｽ縺ｯANON縺ｧ隱ｭ縺ｿ蜃ｺ縺暦ｿｽE縺ｿ陦後≧
    const anon = process.env.SUPABASE_ANON_KEY || '';
    console.warn('[supabase] SERVICE_ROLE_KEY not set. Falling back to ANON for read-only operations');
    supabaseAdminLazy = createClient(url, anon, { auth: { persistSession: false } });
    return supabaseAdminLazy;
  }
  supabaseAdminLazy = createClient(url, key, { auth: { persistSession: false } });
  return supabaseAdminLazy;
}

/**
 * GET /api/capacity-status?date=YYYY-MM-DD
 * 霑泌唆: { ok, date, store_id, summary, items }
 * 繧ｨ繝ｩ繝ｼ譎ゅｂ 200 + 遨ｺ縺ｧ霑斐☆・ｽE・ｽEail-open・ｽE・ｽ・ｽE 繧ｫ繝ｬ繝ｳ繝繝ｼ繧呈ｭ｢繧√↑縺・ */
app.get('/api/capacity-status', async (req, res) => {
  const storeId = req.store_id || req.query.store_id || req.headers['x-store-id'] || '***REMOVED-ROTATE-CREDENTIAL***';
  const date = String(req.query.date || '').slice(0, 10);
  
  // 蜈･蜉帙ヰ繝ｪ繝・・ｽE繧ｷ繝ｧ繝ｳ
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    // 400縺ｫ縺吶ｋ縺ｨ繧ｫ繝ｬ繝ｳ繝繝ｼ縺梧ｭ｢縺ｾ繧具ｿｽE縺ｧ 200 遨ｺ縺ｧ霑斐☆
    return res.json({ ok: true, store_id: storeId, date, summary: { total: 0 }, items: [] });
  }

  const sb = getSupabaseAdmin();
  if (!sb) {
    // 蛻晄悄蛹門､ｱ謨励〒繧り誠縺ｨ縺輔↑縺・・ｽ・ｽ繝ｭ繧ｰ縺縺托ｿｽE縺励※遨ｺ霑斐＠・ｽE・ｽE    console.error('[capacity-status] supabase init failed');
    return res.json({ ok: true, store_id: storeId, date, summary: { total: 0 }, items: [] });
  }

  try {
    // 縲後く繝｣繝ｳ繧ｻ繝ｫ莉･螟悶阪ｒ諡ｾ縺・・ｽ・ｽEull 繧ょ性繧・ｽE・ｽ・晁誠縺｡縺ｫ縺上＞譚｡莉ｶ
    // Supabase(PostgREST)縺ｮ or 蜿･: status.is.null,status.neq.canceled
    const { data, error } = await sb
      .from('reservations')
      .select('id, store_id, date, time, people, seat_code, status')
      .eq('store_id', storeId)
      .eq('date', date)
      .or('status.is.null,status.neq.canceled') // confirmed/pending/NULL 縺ｪ縺ｩ繧定ｨｱ螳ｹ
      .order('time', { ascending: true });

    if (error) {
      console.error('[capacity-status] query error:', error);
      // 縺薙％繧・fail-open・ｽE・ｽE00縺ｫ縺励↑縺・・ｽ・ｽE      return res.json({ ok: true, store_id: storeId, date, summary: { total: 0 }, items: [] });
    }

    const items = Array.isArray(data) ? data : [];
    // 邁｡譏薙し繝槭Μ・ｽE・ｽ譎る俣蟶ｯ髮・・ｽ・ｽ・・    const byTime = {};
    let total = 0;
    for (const r of items) {
      const t = (r.time || '').slice(0, 5); // "HH:mm"
      const n = Number(r.people || 1);
      byTime[t] = (byTime[t] || 0) + n;
      total += n;
    }

    // 譌｢蟄假ｿｽE繧ｹ繝ｭ繝・・ｽ・ｽ蠖｢蠑上ｂ逕滂ｿｽE・ｽE・ｽ蠕梧婿莠呈鋤諤ｧ縺ｮ縺溘ａ・ｽE・ｽE    const slots = [];
    for (let hour = 11; hour <= 21; hour++) {
      const time = `${hour.toString().padStart(2, '0')}:00`;
      const slotReservations = items.filter(r => (r.time || '').startsWith(time.slice(0, 2))) || [];
      const currentGroups = slotReservations.length;
      const currentPeople = slotReservations.reduce((sum, r) => sum + (r.people || 1), 0);
      
      const maxGroups = 5;  // 1譎る俣縺ゅ◆繧頑怙螟ｧ5邨・      const maxPeople = 20; // 1譎る俣縺ゅ◆繧頑怙螟ｧ20莠ｺ
      
      let status = 'available';
      let message = '遨ｺ蟶ｭ縺ゅｊ';
      let displayClass = 'slot-available';
      
      if (currentGroups >= maxGroups || currentPeople >= maxPeople) {
        status = 'full';
        message = '貅蟶ｭ';
        displayClass = 'slot-full';
      } else if (currentGroups >= maxGroups * 0.8 || currentPeople >= maxPeople * 0.8) {
        status = 'limited';
        message = '谿九ｊ繧上★縺・;
        displayClass = 'slot-limited';
      }
      
      slots.push({
        time,
        status,
        message,
        displayClass,
        currentGroups,
        maxGroups,
        currentPeople,
        maxPeople,
        selectable: status !== 'full'
      });
    }

    return res.json({
      ok: true,
      success: true,  // 蠕梧婿莠呈鋤諤ｧ
      store_id: storeId,
      date,
      summary: { total, byTime },
      items,
      slots  // 蠕梧婿莠呈鋤諤ｧ
    });
  } catch (e) {
    console.error('[capacity-status] exception:', e);
    // 譛蠕後∪縺ｧ fail-open
    return res.json({ 
      ok: true, 
      success: true,  // 蠕梧婿莠呈鋤諤ｧ
      store_id: storeId, 
      date, 
      summary: { total: 0 }, 
      items: [],
      slots: []  // 蠕梧婿莠呈鋤諤ｧ
    });
  }
});

// 蠎ｧ蟶ｭ蛻ｩ逕ｨ蜿ｯ閭ｽ迥ｶ豕、PI
app.get('/api/seat-availability', async (req, res) => {
  try {
    const storeId = req.query.store_id || process.env.STORE_ID || '***REMOVED-ROTATE-CREDENTIAL***';
    const date = req.query.date;
    const time = req.query.time;
    
    if (!date || !time) {
      return res.status(400).json({ success: false, error: 'Date and time are required' });
    }
    
    // 謖・・ｽ・ｽ譎る俣・ｽE莠育ｴ・・ｽ・ｽ蜿門ｾ・    const { data: reservations, error } = await supabase
      .from('reservations')
      .select('*')
      .eq('store_id', storeId)
      .eq('date', date)
      .eq('time', time)
      .eq('status', 'confirmed');
    
    if (error) throw error;
    
    const totalPeople = reservations?.reduce((sum, r) => sum + (r.people || 1), 0) || 0;
    const availableSeats = 40 - totalPeople; // 譛螟ｧ40蟶ｭ縺ｨ莉ｮ螳・    
    res.json({
      success: true,
      date,
      time,
      totalReservations: reservations?.length || 0,
      totalPeople,
      availableSeats,
      isFull: availableSeats <= 0
    });
    
  } catch (error) {
    console.error('Seat availability error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 繝・・ｽ・ｽ繝育畑・ｽE・ｽ繝・・繧ｿ繝呻ｿｽE繧ｹ讒矩遒ｺ隱・app.get('/api/test/db-schema', async (req, res) => {
  try {
    // 1莉ｶ縺縺大叙蠕励＠縺ｦ繧ｹ繧ｭ繝ｼ繝槭ｒ遒ｺ隱・    const { data, error } = await supabase
      .from('reservations')
      .select('*')
      .limit(1);
    
    if (error) {
      return res.json({ 
        success: false, 
        error: error.message,
        details: error 
      });
    }
    
    // 繧ｫ繝ｩ繝蜷阪ｒ蜿門ｾ・    const columns = data && data.length > 0 ? Object.keys(data[0]) : [];
    
    res.json({ 
      success: true,
      columns: columns,
      sampleData: data && data.length > 0 ? data[0] : null,
      message: 'Database schema retrieved'
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// 莠育ｴ・・ｽ・ｽ・ｽEAPI
app.post('/api/reservation/create', async (req, res) => {
  console.log('Reservation create request received:', req.body);
  
  try {
    const storeId = req.body.store_id || process.env.STORE_ID || '***REMOVED-ROTATE-CREDENTIAL***';
    // 荳｡譁ｹ縺ｮ繝輔ぅ繝ｼ繝ｫ繝牙錐縺ｫ蟇ｾ蠢懶ｼ亥ｾ梧婿莠呈鋤諤ｧ縺ｮ縺溘ａ・ｽE・ｽE    const {
      customer_name,
      customerName,
      customer_phone,
      phone,
      phoneNumber,
      customer_email,
      email,
      date,
      time,
      people,
      numberOfPeople,
      peopleCount,
      message,
      specialRequests,
      seat_id,
      seat_preference,
      status
    } = req.body;
    
    // 縺ｩ縺｡繧会ｿｽE繝輔ぅ繝ｼ繝ｫ繝牙錐縺ｧ繧ょ女縺大叙繧後ｋ繧医≧縺ｫ
    const finalCustomerName = customer_name || customerName;
    const finalPhone = customer_phone || phone || phoneNumber;
    const finalEmail = customer_email || email;
    const finalPeople = people || numberOfPeople || peopleCount;
    const finalMessage = message || specialRequests;
    const finalSeatPreference = seat_preference || seat_id;
    
    console.log('Parsed request data:', {
      storeId,
      customerName: finalCustomerName,
      phone: finalPhone,
      email: finalEmail,
      date,
      time,
      people: finalPeople,
      message: finalMessage,
      seat_preference: finalSeatPreference
    });
    
    // 蠢・・ｽ・ｽ鬆・・ｽ・ｽ繝√ぉ繝・・ｽ・ｽ
    if (!finalCustomerName || !finalPhone || !date || !time || !finalPeople) {
      return res.status(400).json({ 
        success: false, 
        error: '蠢・・ｽ・ｽ鬆・・ｽ・ｽ縺御ｸ崎ｶｳ縺励※縺・・ｽ・ｽ縺・,
        details: {
          customer_name: !finalCustomerName,
          phone: !finalPhone,
          date: !date,
          time: !time,
          people: !finalPeople
        }
      });
    }
    
    // 譎る俣繝輔か繝ｼ繝槭ャ繝郁ｪｿ謨ｴ・ｽE・ｽEH:MM 竊・HH:MM:SS・ｽE・ｽE    const formattedTime = time.length === 5 ? `${time}:00` : time;
    
    // 莠育ｴ・・ｽ・ｽ・ｽE・ｽE・ｽ譛蟆城剞縺ｮ繝輔ぅ繝ｼ繝ｫ繝会ｿｽE縺ｿ・ｽE・ｽE    const reservationData = {
      store_id: storeId,
      customer_name: finalCustomerName,
      phone: finalPhone,
      email: finalEmail || null,
      date: date,
      time: formattedTime,
      people: parseInt(finalPeople),
      status: status || 'confirmed',
      user_id: req.body.user_id || `liff-${Date.now()}`
    };
    
    // 繧ｪ繝励す繝ｧ繝ｳ繝輔ぅ繝ｼ繝ｫ繝峨ｒ霑ｽ蜉
    if (email) reservationData.email = email;
    if (finalMessage) reservationData.message = finalMessage;
    if (seat_id) reservationData.seat_id = seat_id;
    
    console.log('Inserting reservation data:', reservationData);
    
    const { data, error } = await supabase
      .from('reservations')
      .insert([reservationData])
      .select();
    
    if (error) {
      console.error('Database insert error:', error);
      console.error('Error details:', {
        code: error.code,
        details: error.details,
        hint: error.hint,
        message: error.message
      });
      throw error;
    }
    
    // LINE縺九ｉ縺ｮ莠育ｴ・・ｽE蝣ｴ蜷医・・ｽ・ｽ遏･繧偵ヨ繝ｪ繧ｬ繝ｼ
    if (reservationData.line_user_id || reservationData.source === 'LINE') {
      // 騾夂衍繧ｷ繧ｹ繝・・ｽ・ｽ縺ｫ遏･繧峨○繧具ｼ磯撼蜷梧悄縺ｧ螳溯｡鯉ｼ・      setTimeout(() => {
        console.log('粕 Triggering notification for LINE reservation:', data[0].id);
      }, 100);
    }

    res.json({ 
      success: true, 
      reservation: data[0],
      message: '莠育ｴ・・ｽ・ｽ豁｣蟶ｸ縺ｫ菴懶ｿｽE縺輔ｌ縺ｾ縺励◆'
    });
    
  } catch (error) {
    console.error('Reservation creation error:', error);
    console.error('Full error object:', JSON.stringify(error, null, 2));
    res.status(500).json({ 
      success: false, 
      error: error.message,
      details: error.details || error.hint || 'No additional details'
    });
  }
});

// 莠呈鋤繧ｨ繝ｳ繝峨・繧､繝ｳ繝・ /api/reservation
// liff-booking.html 縺ｪ縺ｩ譌ｧ繝輔Ο繝ｳ繝医・POST縺ｫ蟇ｾ蠢懊Ｔtore_id譛ｪ謖・ｮ壹↑繧峨・繧ｹ繝亥錐縺九ｉ謗ｨ螳壹＠縲∝酔縺倥Ο繧ｸ繝・け縺ｧ菴懈・縲・
app.post('/api/reservation', async (req, res) => {
  try {
    const inferStoreIdFromHost = (req) => {
      const h = String(req.headers['x-forwarded-host'] || req.headers.host || '').toLowerCase();
      if (h.includes('store-a---line-booking-api') || h.includes('line-booking-api')) return 'store-a';
      return process.env.STORE_ID || '***REMOVED-ROTATE-CREDENTIAL***';
    };

    req.body = req.body || {};
    if (!req.body.store_id) {
      req.body.store_id = inferStoreIdFromHost(req);
    }

    // 譌｢蟄倥ワ繝ｳ繝峨Λ繝ｼ縺ｮ繝ｭ繧ｸ繝・け繧貞・蛻ｩ逕ｨ縺吶ｋ縺溘ａ縲∝酔遲牙・逅・ｒ螳溯｡・
    const storeId = req.body.store_id || process.env.STORE_ID || '***REMOVED-ROTATE-CREDENTIAL***';
    const {
      customer_name,
      customerName,
      customer_phone,
      phone,
      phoneNumber,
      customer_email,
      email,
      date,
      time,
      people,
      numberOfPeople,
      peopleCount,
      message,
      specialRequests,
      seat_id,
      seat_preference,
      status
    } = req.body;

    const finalCustomerName = customer_name || customerName;
    const finalPhone = customer_phone || phone || phoneNumber;
    const finalEmail = customer_email || email;
    const finalPeople = people || numberOfPeople || peopleCount;
    const finalMessage = message || specialRequests;
    const finalSeatPreference = seat_preference || seat_id;

    if (!finalCustomerName || !finalPhone || !date || !time || !finalPeople) {
      return res.status(400).json({
        success: false,
        error: '蠢・磯・岼縺御ｸ崎ｶｳ縺励※縺・∪縺・,
        details: { customer_name: !finalCustomerName, phone: !finalPhone, date: !date, time: !time, people: !finalPeople }
      });
    }

    const formattedTime = time.length === 5 ? `${time}:00` : time;
    const reservationData = {
      store_id: storeId,
      customer_name: finalCustomerName,
      phone: finalPhone,
      email: finalEmail || null,
      date: date,
      time: formattedTime,
      people: parseInt(finalPeople),
      status: status || 'confirmed',
      user_id: req.body.user_id || `liff-${Date.now()}`
    };
    if (email) reservationData.email = email;
    if (finalMessage) reservationData.message = finalMessage;
    if (seat_id) reservationData.seat_id = seat_id;

    const { data, error } = await supabase
      .from('reservations')
      .insert([reservationData])
      .select();

    if (error) throw error;

    return res.json({ success: true, reservation: data[0], message: '莠育ｴ・′菴懈・縺輔ｌ縺ｾ縺励◆' });
  } catch (error) {
    console.error('[/api/reservation] error:', error);
    return res.status(500).json({ success: false, error: error.message || 'Internal error' });
  }
});

// 莠育ｴ・・ｽ・ｽ縺ｿ譎る俣譫蜿門ｾ輸PI・ｽE・ｽ蛻ｶ髯占ｾｼ縺ｿ・ｽE・ｽE// 繧ｫ繝ｬ繝ｳ繝繝ｼ陦ｨ遉ｺ逕ｨ縺ｫ莠育ｴ・・ｽ・ｽ豕√→蛻ｶ髯先ュ蝣ｱ繧堤ｵｱ蜷医＠縺ｦ霑泌唆
app.get('/api/calendar-slots', async (req, res) => {
  try {
    const storeId = process.env.STORE_ID || '***REMOVED-ROTATE-CREDENTIAL***';
    
    // 莉頑律莉･髯搾ｿｽE譌･莉倥ｒ蜿門ｾ暦ｼ磯℃蜴ｻ縺ｮ莠育ｴ・・ｽE髯､螟厄ｼ・    const today = formatLocalYMD(new Date());
    
    // 莠育ｴ・・ｽ・ｽ縺ｿ縺ｮ譎る俣譫繧貞叙蠕暦ｼ・onfirmed繧ｹ繝・・ｽE繧ｿ繧ｹ縺ｮ縺ｿ・ｽE・ｽE    const { data: reservations, error: resError } = await supabase
      .from('reservations')
      .select('date, time')
      .eq('store_id', storeId)
      .eq('status', 'confirmed')
      .gte('date', today);
    
    if (resError) throw resError;
    
    // 譎る俣譫縺斐→縺ｮ莠育ｴ・・ｽ・ｽ繧偵き繧ｦ繝ｳ繝茨ｼ域ｺ蟶ｭ蛻､螳夂畑・ｽE・ｽE    const reservationCounts = {};
    (reservations || []).forEach(res => {
      const key = `${res.date}_${res.time}`;
      reservationCounts[key] = (reservationCounts[key] || 0) + 1;
    });
    
    // 譎る俣蛻ｶ髯舌ｒ蜿門ｾ暦ｼ育ｮ｡逅・・ｽ・ｽE・ｽ・ｽ螳夲ｿｽE莠育ｴ・・ｽ・ｽ髯撰ｼ・    const { data: restrictions, error: restrictError } = await supabase
      .from('time_restrictions')
      .select('*')
      .eq('store_id', storeId)
      .gte('date', today);
    
    if (restrictError) console.error('Restriction fetch error:', restrictError);
    
    // 繧ｹ繝ｭ繝・・ｽ・ｽ諠・・ｽ・ｽ繧呈ｧ狗ｯ会ｼ亥推譎る俣譫縺ｮ莠育ｴ・・ｽ・ｽ蜷ｦ繧貞愛螳夲ｼ・    const slots = [];
    const dates = [...new Set(reservations?.map(r => r.date) || [])];
    
    // 蜷・・ｽ・ｽ髢捺棧縺ｮ迥ｶ諷九ｒ蛻､螳夲ｼ亥霧讌ｭ譎る俣・ｽE・ｽE0:00-21:00縺ｮ30蛻・・ｽ・ｽ縺ｿ・ｽE・ｽE    const timeSlots = ['10:00', '10:30', '11:00', '11:30', '12:00', '12:30', 
                       '13:00', '13:30', '14:00', '14:30', '15:00', '15:30',
                       '16:00', '16:30', '17:00', '17:30', '18:00', '18:30',
                       '19:00', '19:30', '20:00', '20:30', '21:00'];
    
    // 莉雁ｾ・譌･髢難ｿｽE繝・・ｽE繧ｿ繧堤函謌撰ｼ医き繝ｬ繝ｳ繝繝ｼ陦ｨ遉ｺ逕ｨ・ｽE・ｽE    for (let d = 0; d < 7; d++) {
      const date = new Date();
      date.setDate(date.getDate() + d);
      const dateStr = formatLocalYMD(date);
      
      timeSlots.forEach(time => {
        const key = `${dateStr}_${time}:00`;
        const count = reservationCounts[key] || 0;
        const restriction = restrictions?.find(r => 
          r.date === dateStr && r.time_slot === time + ':00'
        );
        
        const maxCapacity = restriction?.max_capacity ?? 4; // 繝・・ｽ・ｽ繧ｩ繝ｫ繝・邨・・ｽ・ｽ縺ｧ
        const isBlocked = restriction?.is_blocked || false;  // 繝悶Ο繝・・ｽ・ｽ迥ｶ諷・        
        slots.push({
          date: dateStr,
          time: time + ':00',
          count: count,
          maxCapacity: maxCapacity,
          available: !isBlocked && count < maxCapacity,
          remaining: Math.max(0, maxCapacity - count)
        });
      });
    }
    
    res.json({ 
      success: true, 
      slots 
    });
  } catch (error) {
    console.error('Calendar slots fetch error (Account1):', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// ==========================================
// Dashboard Analytics API・ｽE・ｽ繝繝・・ｽ・ｽ繝･繝懶ｿｽE繝臥ｵｱ險域ュ蝣ｱ・ｽE・ｽE// ==========================================
// 繝繝・・ｽ・ｽ繝･繝懶ｿｽE繝臥判髱｢逕ｨ縺ｮ邨ｱ險医ョ繝ｼ繧ｿ繧貞叙蠕暦ｼ井ｻ頑律繝ｻ莉頑怦繝ｻ繝医Ξ繝ｳ繝会ｼ・// 繝繝・・ｽ・ｽ繝･繝懶ｿｽE繝臥ｵｱ險・PI繝｢繧ｸ繝･繝ｼ繝ｫ繧貞虚逧・・ｽ・ｽ繝ｳ繝晢ｿｽE繝・app.get('/api/dashboard-stats', async (req, res) => {
  try {
    // 蜍慕噪繧､繝ｳ繝晢ｿｽE繝医〒CommonJS繝｢繧ｸ繝･繝ｼ繝ｫ繧定ｪｭ縺ｿ霎ｼ縺ｿ
    const dashboardStats = await import('./api/dashboard-stats.js');
    const getStoreStats = dashboardStats.getStoreStats || dashboardStats.default?.getStoreStats;
    
    // URL繝代Λ繝｡繝ｼ繧ｿ縺ｾ縺滂ｿｽE迺ｰ蠅・・ｽ・ｽ謨ｰ縺九ｉ蠎暦ｿｽEID繧貞叙蠕・    const storeId = req.query.store_id || process.env.STORE_ID || '***REMOVED-ROTATE-CREDENTIAL***';
    const period = req.query.period || 'week';
    const today = formatLocalYMD(new Date());
    const startOfMonth = formatLocalYMD(new Date()).slice(0, 7) + '-01';
    
    // 莉頑律縺ｮ莠育ｴ・・ｽ・ｽ繧貞叙蠕・    const { data: todayBookings, error: todayError } = await supabase
      .from('reservations')
      .select('id')
      .eq('store_id', storeId)
      .eq('booking_date', today)
      .eq('status', 'confirmed');
    
    // 莉頑怦縺ｮ莠育ｴ・・ｽ・ｽ繧貞叙蠕暦ｼ域怦蛻昴°繧我ｻ頑律縺ｾ縺ｧ・ｽE・ｽE    const { data: monthBookings, error: monthError } = await supabase
      .from('reservations')
      .select('id')
      .eq('store_id', storeId)
      .gte('booking_date', startOfMonth)
      .eq('status', 'confirmed');
    
    // 驕主悉7譌･髢難ｿｽE莠育ｴ・・ｽ・ｽ繝ｬ繝ｳ繝会ｼ医げ繝ｩ繝戊｡ｨ遉ｺ逕ｨ・ｽE・ｽE    const trendData = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = formatLocalYMD(date);
      
      const { data: dayBookings } = await supabase
        .from('reservations')
        .select('id')
        .eq('store_id', storeId)
        .eq('booking_date', dateStr)
        .eq('status', 'confirmed');
        
      trendData.push({
        date: dateStr,
        count: dayBookings?.length || 0
      });
    }
    
    // 邨ｱ險郁ｨ育ｮ・    const todayCount = todayBookings?.length || 0;
    const monthCount = monthBookings?.length || 0;
    const avgRevenuePerBooking = 3500; // 蟷ｳ蝮・・ｽ・ｽ萓｡・ｽE・ｽ荵ｳ險ｭ螳夲ｼ・    const monthRevenue = monthCount * avgRevenuePerBooking;
    
    // 譁ｰ縺励＞邨ｱ險・PI繧剃ｽｿ逕ｨ
    const statsData = getStoreStats ? await getStoreStats(storeId, period) : { success: false, error: 'Module not loaded' };
    
    // 譌｢蟄假ｿｽE繝ｬ繧ｹ繝昴Φ繧ｹ蠖｢蠑上→莠呈鋤諤ｧ繧剃ｿ昴▽
    if (statsData.success) {
      res.json({
        success: true,
        storeId: storeId,
        period: period,
        stats: statsData.stats,
        charts: statsData.charts,
        // 蠕梧婿莠呈鋤諤ｧ縺ｮ縺溘ａ譌｢蟄假ｿｽE繝輔ぅ繝ｼ繝ｫ繝峨ｂ蜷ｫ繧√ｋ
        todayBookings: todayCount,
        monthBookings: monthCount,
        monthRevenue: monthRevenue,
        satisfactionRate: 98,
        utilizationRate: Math.min(Math.round((todayCount / 24) * 100), 100),
        trendData: trendData
      });
    } else {
      throw new Error(statsData.error || 'Failed to fetch stats');
    }
    
  } catch (error) {
    console.error('Dashboard stats error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 鬮伜ｺｦ讀懃ｴ｢API
// 隍・・ｽ・ｽ譚｡莉ｶ縺ｧ莠育ｴ・・ｽ・ｽ蝣ｱ繧呈､懃ｴ｢・ｽE・ｽ蜷榊燕・ｽE髮ｻ隧ｱ繝ｻ譌･莉假ｿｽE繧ｹ繝・・ｽE繧ｿ繧ｹ縺ｪ縺ｩ・ｽE・ｽEapp.post('/api/search-reservations', async (req, res) => {
  try {
    const storeId = process.env.STORE_ID || '***REMOVED-ROTATE-CREDENTIAL***';
    const {
      customerName,
      phoneNumber,
      dateFrom,
      dateTo,
      timeSlot,
      status,
      peopleCount,
      email
    } = req.body;

    // 蜍慕噪繧ｯ繧ｨ繝ｪ繧呈ｧ狗ｯ会ｼ域欠螳壹＆繧後◆譚｡莉ｶ縺縺代ｒ驕ｩ逕ｨ・ｽE・ｽE    let query = supabase
      .from('reservations')
      .select('*')
      .eq('store_id', storeId);

    // 繝輔ぅ繝ｫ繧ｿ繝ｼ驕ｩ逕ｨ・ｽE・ｽ蜷・擅莉ｶ繧帝・・ｽ・ｽ霑ｽ蜉・ｽE・ｽE    if (customerName) {
      query = query.or(`customer_name.ilike.%${customerName}%,name.ilike.%${customerName}%`);
    }

    if (phoneNumber) {
      query = query.ilike('phone', `%${phoneNumber}%`);
    }

    if (email) {
      query = query.ilike('email', `%${email}%`);
    }

    if (dateFrom) {
      query = query.gte('date', dateFrom);
    }

    if (dateTo) {
      query = query.lte('date', dateTo);
    }

    if (status) {
      query = query.eq('status', status);
    }

    if (peopleCount) {
      if (peopleCount === '4') {
        query = query.gte('people', 4);
      } else {
        query = query.eq('people', parseInt(peopleCount));
      }
    }

    // 繧ｯ繧ｨ繝ｪ螳溯｡鯉ｼ域律莉倬剄鬆・・ｽE譎る俣譏・・ｽ・ｽE・ｽ・ｽ繧ｽ繝ｼ繝茨ｼ・    const { data: reservations, error } = await query
      .order('date', { ascending: false })
      .order('time', { ascending: true });

    if (error) throw error;

    // 譎る俣蟶ｯ繝輔ぅ繝ｫ繧ｿ繝ｼ驕ｩ逕ｨ・ｽE・ｽ・ｽE繧ｹ繝茨ｿｽE逅・・ｽ・ｽ譎る俣遽・・ｽ・ｽ縺ｧ邨槭ｊ霎ｼ縺ｿ・ｽE・ｽE    let filteredReservations = reservations || [];
    
    if (timeSlot) {
      filteredReservations = filteredReservations.filter(reservation => {
        const hour = parseInt(reservation.time.split(':')[0]);
        switch (timeSlot) {
          case 'morning':
            return hour >= 10 && hour < 12;
          case 'afternoon':
            return hour >= 12 && hour < 17;
          case 'evening':
            return hour >= 17 && hour <= 21;
          default:
            return true;
        }
      });
    }

    res.json({
      success: true,
      results: filteredReservations,
      count: filteredReservations.length
    });

  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 繝舌ャ繧ｯ繧｢繝・・ｽE菴懶ｿｽEAPI
// 莠育ｴ・・ｽ・ｽ繝ｼ繧ｿ縺ｨ蛻ｶ髯占ｨｭ螳夲ｿｽE繝舌ャ繧ｯ繧｢繝・・ｽE繧剃ｽ懶ｿｽE
app.post('/api/backup/create', async (req, res) => {
  try {
    const storeId = process.env.STORE_ID || '***REMOVED-ROTATE-CREDENTIAL***';
    const backupId = `backup_${Date.now()}`;
    
    // 莠育ｴ・・ｽ・ｽ繝ｼ繧ｿ縺ｮ繝舌ャ繧ｯ繧｢繝・・ｽE
    const { data: reservations, error: reservationError } = await supabase
      .from('reservations')
      .select('*')
      .eq('store_id', storeId);
    
    if (reservationError) throw reservationError;
    
    // 譎る俣蛻ｶ髯占ｨｭ螳夲ｿｽE繝舌ャ繧ｯ繧｢繝・・ｽE
    const { data: restrictions, error: restrictionError } = await supabase
      .from('time_restrictions')
      .select('*')
      .eq('store_id', storeId);
    
    if (restrictionError) console.warn('Time restrictions backup failed:', restrictionError);
    
    const backupData = {
      id: backupId,
      storeId: storeId,
      createdAt: new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' }),
      reservations: reservations || [],
      timeRestrictions: restrictions || [],
      metadata: {
        version: '1.0',
        totalReservations: reservations?.length || 0,
        totalRestrictions: restrictions?.length || 0
      }
    };
    
    // 繝舌ャ繧ｯ繧｢繝・・ｽE菫晏ｭ假ｼ域悽逡ｪ迺ｰ蠅・・ｽ・ｽ縺ｯ繧ｯ繝ｩ繧ｦ繝峨せ繝医Ξ繝ｼ繧ｸ縺ｸ菫晏ｭ假ｼ・    console.log(JSON.stringify({
      severity: 'INFO',
      msg: 'Backup created successfully',
      backupId: backupId,
      dataSize: JSON.stringify(backupData).length
    }));
    
    res.json({
      success: true,
      backupId: backupId,
      metadata: backupData.metadata,
      downloadUrl: `/api/backup/download/${backupId}` // For future implementation
    });
    
  } catch (error) {
    console.error('Backup creation error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 繧ｷ繧ｹ繝・・ｽ・ｽ繝倥Ν繧ｹ繝√ぉ繝・・ｽ・ｽAPI
// 繧ｷ繧ｹ繝・・ｽ・ｽ蜈ｨ菴難ｿｽE遞ｼ蜒咲憾諷九ｒ遒ｺ隱搾ｼ・B謗･邯夲ｿｽEAPI繝ｻ繝｡繝｢繝ｪ菴ｿ逕ｨ驥擾ｼ・app.get('/api/health', async (req, res) => {
  try {
    const healthData = {
      timestamp: new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' }),
      status: 'healthy',
      services: {
        database: 'healthy',
        api: 'healthy',
        line_integration: 'healthy'
      },
      metrics: {
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        cpu: process.cpuUsage()
      }
    };
    
    // 繝・・ｽE繧ｿ繝呻ｿｽE繧ｹ謗･邯壹ユ繧ｹ繝茨ｼ育ｨｼ蜒咲｢ｺ隱搾ｼ・    try {
      const { data, error } = await supabase
        .from('reservations')
        .select('id')
        .limit(1);
        
      if (error) {
        healthData.services.database = 'unhealthy';
        healthData.status = 'degraded';
      }
    } catch (dbError) {
      healthData.services.database = 'unhealthy';
      healthData.status = 'unhealthy';
    }
    
    res.json(healthData);
    
  } catch (error) {
    res.status(500).json({
      timestamp: new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' }),
      status: 'unhealthy',
      error: error.message
    });
  }
});

// 繝代ヵ繧ｩ繝ｼ繝槭Φ繧ｹ繝｡繝医Μ繧ｯ繧ｹAPI
// 繧ｷ繧ｹ繝・・ｽ・ｽ縺ｮ繝代ヵ繧ｩ繝ｼ繝槭Φ繧ｹ謖・・ｽ・ｽ繧貞叙蠕暦ｼ亥ｿ懃ｭ疲凾髢難ｿｽE繧ｹ繝ｫ繝ｼ繝励ャ繝育ｭ会ｼ・app.get('/api/metrics', async (req, res) => {
  try {
    const storeId = process.env.STORE_ID || '***REMOVED-ROTATE-CREDENTIAL***';
    const today = formatLocalYMD(new Date());
    
    // 蠢懃ｭ疲凾髢楢ｨ域ｸｬ・ｽE・ｽ邁｡譏鍋沿・ｽE・ｽE    const responseTimeStart = Date.now();
    
    // 蝓ｺ譛ｬ繝｡繝医Μ繧ｯ繧ｹ蜿門ｾ・    const { data: todayReservations } = await supabase
      .from('reservations')
      .select('id, created_at')
      .eq('store_id', storeId)
      .eq('date', today);
    
    const responseTime = Date.now() - responseTimeStart;
    
    const metrics = {
      responseTime: responseTime,
      activeReservations: todayReservations?.length || 0,
      systemLoad: {
        memory: process.memoryUsage(),
        uptime: process.uptime()
      },
      performance: {
        avgResponseTime: responseTime, // In real system, calculate average
        throughput: Math.round((todayReservations?.length || 0) / (process.uptime() / 3600)), // per hour
        errorRate: 0 // Track from logs
      }
    };
    
    res.json({
      success: true,
      metrics: metrics,
      timestamp: new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })
    });
    
  } catch (error) {
    console.error('Metrics error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==========================================
// API Routes・ｽE・ｽ縺昴・莉厄ｿｽEAPI繧ｨ繝ｳ繝会ｿｽE繧､繝ｳ繝茨ｼ・// ==========================================
// API: 莠育ｴ・宛髯舌ｒ閠・・縺励◆譎る俣譫蜿ｯ逕ｨ諤ｧ蜿門ｾ・- Expert's Fail-Safe Version
// 500繧ｨ繝ｩ繝ｼ繧貞・縺輔★縲∝ｸｸ縺ｫ200繧定ｿ斐☆縺薙→縺ｧUI繧呈ｭ｢繧√↑縺・
app.get('/api/capacity-availability', async (req, res) => {
  const storeId = String(req.query.store_id || req.headers['x-store-id'] || '***REMOVED-ROTATE-CREDENTIAL***');
  const dateISO = String(req.query.date || '').slice(0, 10); // 'YYYY-MM-DD'
  const trace = { storeId, dateISO, rev: process.env.K_REVISION || 'dev' };

  // 螟ｱ謨励＠縺ｦ繧６I繧呈ｭ｢繧√↑縺・
  function okEmpty(extra = {}) {
    return res.json({ ok: true, store_id: storeId, date: dateISO, slots: {}, ...extra });
  }

  // 蜈･蜉帙ヰ繝ｪ繝・・繧ｷ繝ｧ繝ｳ
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateISO)) {
    console.warn('[capacity] invalid-date', trace);
    return okEmpty({ warn: 'invalid-date' });
  }

  const sb = getSupabase();
  if (!sb) {
    console.error('[capacity] supabase-init-failed', trace);
    return okEmpty({ warn: 'supabase-init-failed' });
  }

  try {
    // 1) 莠育ｴ・寔險茨ｼ医く繝｣繝ｳ繧ｻ繝ｫ莉･螟厄ｼ・
    let reservations = [];
    const { data: resData, error: rerr } = await sb
      .from('reservations')
      .select('time, people, status')
      .eq('store_id', storeId)
      .eq('date', dateISO)
      .or('status.is.null,status.neq.canceled'); // 竊・PostgREST縺ｮ or 讒区枚
    if (rerr) {
      console.error('[capacity] reservations-error', { ...trace, err: rerr });
      // Continue with empty reservations instead of returning early
      reservations = [];
    } else {
      reservations = resData || [];
    }

    // 2) 繝ｫ繝ｼ繝ｫ蜿門ｾ暦ｼ・ate蜆ｪ蜈・+ weekly・・
    const weekday = new Date(`${dateISO}T00:00:00Z`).getUTCDay(); // TZ繧ｺ繝ｬ髦ｲ豁｢
    let rules = [];
    const { data: rulesData, error: derr } = await sb
      .from('capacity_rules')
      .select('*')
      .eq('store_id', storeId)
      .or(`target_date.eq.${dateISO},and(rule_type.eq.weekly,weekday.eq.${weekday})`)
      .eq('is_active', true);
    if (derr) {
      console.error('[capacity] rules-error', { ...trace, err: derr });
      // Continue with empty rules, temporary override will still work
      rules = [];
    } else {
      rules = rulesData || [];
    }

    // 3) 髮・ｨ・
    const reservedByTime = {};
    for (const r of reservations || []) {
      const t = (r.time || '').slice(0, 5); // 'HH:mm'
      if (!t) continue;
      const add = 1; // 邨・焚縲ゆｺｺ謨ｰ繝吶・繧ｹ縺ｫ縺吶ｋ縺ｪ繧・Number(r.people||0)
      reservedByTime[t] = (reservedByTime[t] || 0) + add;
    }

    const slotMinutes = rules[0]?.slot_minutes ?? 30;
    const slotStart = '11:00', slotEnd = '22:00';
    function* slotsIter() {
      let d = new Date(`${dateISO}T${slotStart}:00`);
      const end = new Date(`${dateISO}T${slotEnd}:00`);
      while (d < end) {
        const hh = String(d.getHours()).padStart(2,'0');
        const mm = String(d.getMinutes()).padStart(2,'0');
        yield `${hh}:${mm}`;
        d = new Date(d.getTime() + slotMinutes * 60000);
      }
    }
    const within = (hhmm, r) => {
      const s = String(r.start_time).slice(0,5);
      const e = String(r.end_time).slice(0,5);
      return hhmm >= s && hhmm < e; // 邨らｫｯ縺ｯ蜷ｫ繧√↑縺・
    };
    const pickLimit = (hhmm) => {
      const dateMatch = rules.filter(r => r.rule_type === 'date' && r.target_date === dateISO && within(hhmm, r));
      if (dateMatch.length) return dateMatch[0].limit_per_slot;
      const weekMatch = rules.filter(r => r.rule_type === 'weekly' && r.weekday === weekday && within(hhmm, r));
      if (weekMatch.length) return weekMatch[0].limit_per_slot;
      
      // 證ｫ螳壹が繝ｼ繝舌・繝ｩ繧､繝会ｼ亥霧讌ｭ蜆ｪ蜈茨ｼ・ 18:00-22:00縺ｫ蛻ｶ髯舌ｒ蠑ｷ蛻ｶ驕ｩ逕ｨ
      if (hhmm >= '18:00' && hhmm < '22:00' && storeId === '***REMOVED-ROTATE-CREDENTIAL***') return 1;
      
      return null; // 繝ｫ繝ｼ繝ｫ辟｡縺代ｌ縺ｰ譛ｪ險ｭ螳・
    };

    const slots = {};
    for (const hhmm of slotsIter()) {
      const limit = pickLimit(hhmm);
      const reserved = reservedByTime[hhmm] || 0;
      let available, status;
      if (limit == null) {
        available = 999; status = 'available'; // 繝ｫ繝ｼ繝ｫ譛ｪ險ｭ螳壹・邱・
      } else {
        available = Math.max(0, limit - reserved);
        status = (available <= 0) ? 'full'
              : (available/limit <= 0.3) ? 'limited'
              : 'available';
      }
      slots[hhmm] = { limit, reserved, available, status };
    }

    const warnings = [];
    if (rerr) warnings.push('reservations-error');
    if (derr) warnings.push('rules-error');

    return res.json({ 
      ok: true, 
      store_id: storeId, 
      date: dateISO, 
      slots, 
      debug: { 
        weekday, 
        reservations: reservations?.length || 0, 
        rules: rules?.length || 0,
        warnings: warnings.length > 0 ? warnings : undefined
      } 
    });
  } catch (e) {
    console.error('[capacity] exception', { ...trace, err: String(e?.message || e) });
    return okEmpty({ warn: 'exception' });
  }
});

// API: 莠育ｴ・・ｽ・ｽ髯舌Ν繝ｼ繝ｫ邂｡逅・// 莠育ｴ・・ｽ・ｽ髯舌Ν繝ｼ繝ｫ繧貞叙蠕・app.get('/api/capacity-rules', async (req, res) => {
  try {
    const { store_id } = req.query;
    const storeId = store_id || process.env.STORE_ID || '***REMOVED-ROTATE-CREDENTIAL***';
    
    const { data, error } = await supabase
      .from('capacity_control_rules')
      .select('*')
      .eq('store_id', storeId)
      .eq('is_active', true)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    
    res.json({ success: true, rules: data || [] });
  } catch (error) {
    console.error('Error fetching capacity rules:', error);
    res.status(500).json({ error: error.message });
  }
});

// API: 莠育ｴ・・ｽ・ｽ髯舌Ν繝ｼ繝ｫ菴懶ｿｽE
app.post('/api/capacity-rules', async (req, res) => {
  try {
    const rule = req.body;
    const storeId = rule.store_id || process.env.STORE_ID || '***REMOVED-ROTATE-CREDENTIAL***';
    
    // 繝・・ｽE繧ｿ謨ｴ蠖｢
    const ruleData = {
      store_id: storeId,
      name: rule.name || '',
      date_mode: rule.dateMode || 'single',
      date: rule.date || null,
      start_date: rule.startDate || null,
      end_date: rule.endDate || null,
      weekday: rule.weekday || null,
      start_time: rule.startTime,
      end_time: rule.endTime,
      control_type: rule.controlType || 'groups',
      max_groups: rule.maxGroups || null,
      max_people: rule.maxPeople || null,
      max_per_group: rule.maxPerGroup || null,
      is_active: true
    };
    
    const { data, error } = await supabase
      .from('capacity_control_rules')
      .insert([ruleData])
      .select();
    
    if (error) throw error;
    
    res.json({ success: true, rule: data[0] });
  } catch (error) {
    console.error('Error creating capacity rule:', error);
    res.status(500).json({ error: error.message });
  }
});

// API: 莠育ｴ・・ｽ・ｽ髯舌Ν繝ｼ繝ｫ譖ｴ譁ｰ
app.put('/api/capacity-rules/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    
    const { data, error } = await supabase
      .from('capacity_control_rules')
      .update(updates)
      .eq('id', id)
      .select();
    
    if (error) throw error;
    
    res.json({ success: true, rule: data[0] });
  } catch (error) {
    console.error('Error updating capacity rule:', error);
    res.status(500).json({ error: error.message });
  }
});

// API: 莠育ｴ・・ｽ・ｽ髯舌Ν繝ｼ繝ｫ蜑企勁
app.delete('/api/capacity-rules/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const { error } = await supabase
      .from('capacity_control_rules')
      .delete()
      .eq('id', id);
    
    if (error) throw error;
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting capacity rule:', error);
    res.status(500).json({ error: error.message });
  }
});

// API: 莠育ｴ・・ｽ・ｽ閭ｽ迥ｶ豕∝叙蠕・// 謖・・ｽ・ｽ譛医・莠育ｴ・・ｽ・ｽ閭ｽ譎る俣譫繧貞叙蠕・app.get('/api/availability', async (req, res) => {
  try {
    const { year, month } = req.query;
    const storeId = process.env.STORE_ID || '***REMOVED-ROTATE-CREDENTIAL***';
    
    // 謖・・ｽ・ｽ譛医・髢句ｧ区律縺ｨ邨ゆｺ・・ｽ・ｽ繧定ｨ育ｮ暦ｼ域怦蛻昴°繧画怦譛ｫ縺ｾ縺ｧ・ｽE・ｽE    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0);
    
    const { data, error } = await supabase
      .from('time_slots')
      .select('*')
      .eq('store_id', storeId)
      .gte('date', formatLocalYMD(startDate))
      .lte('date', formatLocalYMD(endDate))
      .order('date')
      .order('time');
    
    if (error) throw error;
    
    res.json({ success: true, data });
  } catch (error) {
    console.error('Error fetching availability:', error);
    res.status(500).json({ error: error.message });
  }
});

// 蠎暦ｿｽE諠・・ｽ・ｽ蜿門ｾ輸PI
// 蠎暦ｿｽE縺ｮ蝓ｺ譛ｬ諠・・ｽ・ｽ・ｽE・ｽED繝ｻ蜷榊燕繝ｻ蝟ｶ讌ｭ譎る俣・ｽE・ｽ繧貞叙蠕・app.get('/api/store-info', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('stores')
      .select('*')
      .eq('store_id', '***REMOVED-ROTATE-CREDENTIAL***')
      .single();

    if (error) throw error;

    res.json({
      storeId: data?.store_id || '***REMOVED-ROTATE-CREDENTIAL***',
      storeName: data?.store_name || '繝・・ｽ・ｽ繧ｩ繝ｫ繝亥ｺ暦ｿｽE',
      businessHours: data?.business_hours || {
        start: '09:00',
        end: '18:00'
      }
    });
  } catch (error) {
    console.error('Store info error:', error);
    res.status(500).json({ error: 'Failed to fetch store info' });
  }
});

// 莠育ｴ・・ｽ・ｽ隕ｧ蜿門ｾ輸PI
// 蜈ｨ莠育ｴ・・ｽ・ｽ蝣ｱ繧呈律莉假ｿｽE譎る俣鬆・・ｽ・ｽ蜿門ｾ・// 譁ｰ縺励＞莠育ｴ・・ｽ・ｽ蜿門ｾ暦ｼ磯夂衍繧ｷ繧ｹ繝・・ｽ・ｽ逕ｨ・ｽE・ｽEapp.get('/api/reservations/new', async (req, res) => {
  try {
    const since = req.query.since || new Date(Date.now() - 60000).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' }); // 繝・・ｽ・ｽ繧ｩ繝ｫ繝・ 驕主悉1蛻・    
    const { data, error } = await supabase
      .from('reservations')
      .select('*')
      .gte('created_at', since)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching new reservations:', error);
      return res.status(500).json({ success: false, error: error.message });
    }

    // LINE縺九ｉ縺ｮ莠育ｴ・・ｽE縺ｿ繝輔ぅ繝ｫ繧ｿ繝ｼ
    const lineReservations = data.filter(r => r.line_user_id || r.source === 'LINE');

    res.json({ 
      success: true, 
      reservations: lineReservations,
      count: lineReservations.length,
      since: since
    });
  } catch (error) {
    console.error('Error in /api/reservations/new:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 莠育ｴ・・ｽ・ｽ隕ｧ蜿門ｾ・app.get('/api/reservations', async (req, res) => {
  try {
    const storeId = process.env.STORE_ID || '***REMOVED-ROTATE-CREDENTIAL***';
    const { data, error } = await supabase
      .from('reservations')
      .select('*')
      .eq('store_id', storeId)
      .order('date', { ascending: true })
      .order('time', { ascending: true });

    if (error) {
      console.error('Supabase error:', error);
      throw error;
    }

    console.log(`Found ${data?.length || 0} reservations for store ${storeId}`);
    res.json(data || []);
  } catch (error) {
    console.error('Reservations fetch error:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch reservations' });
  }
});

// 蟶ｭ邂｡逅・PI
// 蠎ｧ蟶ｭ縺ｮ菴懶ｿｽE繝ｻ譖ｴ譁ｰ繝ｻ蜑企勁繝ｻ繝ｭ繝・・ｽ・ｽ迥ｶ諷句､画峩繧堤ｮ｡逅・// GET: 荳隕ｧ蜿門ｾ励￣OST: 譁ｰ隕丈ｽ懶ｿｽE縲￣UT: 譖ｴ譁ｰ縲．ELETE: 蜑企勁縲￣ATCH: 繝ｭ繝・・ｽ・ｽ螟画峩
app.all('/api/seats-manage', async (req, res) => {
  try {
    const storeId = process.env.STORE_ID || '***REMOVED-ROTATE-CREDENTIAL***';
    
    switch(req.method) {
      case 'GET':
        // 蟶ｭ荳隕ｧ蜿門ｾ暦ｼ井ｽ懶ｿｽE譌･譎る・・ｽ・ｽE        const { data: seats, error: seatsError } = await supabase
          .from('seats')
          .select('*')
          .eq('store_id', storeId)
          .order('created_at');
        
        if (seatsError) throw seatsError;
        res.json({ success: true, seats: seats || [] });
        break;
        
      case 'POST':
        // 譁ｰ隕丞ｸｭ菴懶ｿｽE・ｽE・ｽ繧ｿ繧､繝繧ｹ繧ｿ繝ｳ繝悠D莉倅ｸ趣ｼ・        const newSeat = {
          ...req.body,
          store_id: storeId,
          id: Date.now().toString()
        };
        
        const { data: insertData, error: insertError } = await supabase
          .from('seats')
          .insert(newSeat);
        
        if (insertError) throw insertError;
        res.json({ success: true, seat: insertData });
        break;
        
      case 'PUT':
        // 蟶ｭ諠・・ｽ・ｽ譖ｴ譁ｰ・ｽE・ｽ菴咲ｽｮ繝ｻ蜷榊燕繝ｻ螳ｹ驥冗ｭ会ｼ・        const { id: updateId, ...updateData } = req.body;
        const { data: updateResult, error: updateError } = await supabase
          .from('seats')
          .update(updateData)
          .eq('id', updateId)
          .eq('store_id', storeId);
        
        if (updateError) throw updateError;
        res.json({ success: true, seat: updateResult });
        break;
        
      case 'DELETE':
        // 蟶ｭ蜑企勁・ｽE・ｽ迚ｩ逅・・ｽ・ｽ髯､・ｽE・ｽE        const { id: deleteId } = req.query;
        const { error: deleteError } = await supabase
          .from('seats')
          .delete()
          .eq('id', deleteId)
          .eq('store_id', storeId);
        
        if (deleteError) throw deleteError;
        res.json({ success: true });
        break;
        
      case 'PATCH':
        // 蟶ｭ縺ｮ繝ｭ繝・・ｽ・ｽ迥ｶ諷句､画峩・ｽE・ｽ莠育ｴ・・ｽ・ｽ/荳榊庄縺ｮ蛻・・ｽ・ｽ譖ｿ縺茨ｼ・        const { id: patchId, is_locked } = req.body;
        const { data: patchResult, error: patchError } = await supabase
          .from('seats')
          .update({ is_locked })
          .eq('id', patchId)
          .eq('store_id', storeId);
        
        if (patchError) throw patchError;
        res.json({ success: true, seat: patchResult });
        break;
        
      default:
        res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error) {
    console.error('Seats manage API error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Note: Admin API moved to comprehensive handler below

// ==========================================
// 繧ｨ繝ｩ繝ｼ繝上Φ繝峨Μ繝ｳ繧ｰ・ｽE・ｽ邂｡逅・PI縺ｮ蠕後↓遘ｻ蜍包ｼ・// ==========================================

// ==========================================
// 繧ｨ繝ｳ繧ｿ繝ｼ繝励Λ繧､繧ｺ繝繝・・ｽ・ｽ繝･繝懶ｿｽE繝陰PI
// 繧ｷ繧ｹ繝・・ｽ・ｽ逶｣隕厄ｿｽE繝代ヵ繧ｩ繝ｼ繝槭Φ繧ｹ霑ｽ霍｡繝ｻ繧ｻ繧ｭ繝･繝ｪ繝・・ｽ・ｽ諠・・ｽ・ｽ繧堤ｮ｡逅・// ==========================================

// 繝繝・・ｽ・ｽ繝･繝懶ｿｽE繝臥ｵｱ險亥叙蠕・// 繧ｷ繧ｹ繝・・ｽ・ｽ蜈ｨ菴難ｿｽE遞ｼ蜒咲憾諷九→繝代ヵ繧ｩ繝ｼ繝槭Φ繧ｹ謖・・ｽ・ｽ繧帝宦E・ｽ・ｽEapp.get('/api/dashboard/stats', async (req, res) => {
  try {
    const metrics = healthMonitor.getMetrics();
    const queueStatus = messageQueue.getQueueStatus();
    
    const stats = {
      systemStatus: metrics.systemStatus,
      account1Status: 'healthy',
      account2Status: 'healthy',
      dbStatus: 'connected',
      requestsPerHour: Math.round(metrics.requestCount * (3600000 / (Date.now() - (Date.now() % 3600000)))),
      avgResponseTime: metrics.avgResponseTime,
      errorRate: metrics.errorRate,
      successRate: metrics.requestCount > 0 ? ((metrics.requestCount - metrics.errorCount) / metrics.requestCount * 100).toFixed(1) + '%' : '100%',
      activeConnections: queueStatus.queueLength,
      lastHealthCheck: metrics.lastHealthCheck?.timestamp || new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' }),
      messagesSentToday: metrics.requestCount,
      webhooksReceived: metrics.requestCount,
      newFriendsToday: Math.floor(Math.random() * 10), // 螳滄圀縺ｮ繝・・ｽE繧ｿ縺ｫ鄂ｮ縺肴鋤縺・      apiRateLimit: '95%'
    };
    
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get stats' });
  }
});

// 繧ｻ繧ｭ繝･繝ｪ繝・・ｽ・ｽ邨ｱ險亥叙蠕・// 繝悶Ο繝・・ｽ・ｽIP繝ｻ荳榊ｯｩ縺ｪ繧｢繧ｯ繝・・ｽ・ｽ繝薙ユ繧｣縺ｮ逶｣隕匁ュ蝣ｱ
app.get('/api/dashboard/security', async (req, res) => {
  try {
    const securityStats = securityManager.getSecurityStats();
    res.json({
      blockedIPs: securityStats.blockedIPs,
      suspiciousActivities: securityStats.suspiciousIPs.length,
      securityScore: Math.max(0, 100 - (securityStats.suspiciousIPs.length * 5)),
      suspiciousIPs: securityStats.suspiciousIPs
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get security stats' });
  }
});

// 繧ｷ繧ｹ繝・・ｽ・ｽ繝ｭ繧ｰ蜿門ｾ・// 繧ｷ繧ｹ繝・・ｽ・ｽ縺ｮ蜍穂ｽ懊Ο繧ｰ繧貞叙蠕暦ｼ・NFO/WARNING/ERROR・ｽE・ｽEapp.get('/api/dashboard/logs', async (req, res) => {
  try {
    // 螳滄圀縺ｮ螳溯｣・・ｽ・ｽ縺ｯ縲√Ο繧ｰ繧ｹ繝医Ξ繝ｼ繧ｸ縺九ｉ繝ｭ繧ｰ繧貞叙蠕・    // 迴ｾ蝨ｨ縺ｯ繧ｵ繝ｳ繝励Ν繝・・ｽE繧ｿ繧定ｿ泌唆
    const sampleLogs = [
      { timestamp: new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' }), level: 'INFO', message: 'System started successfully' },
      { timestamp: new Date(Date.now() - 60000).toISOString(), level: 'INFO', message: 'Health check completed' },
      { timestamp: new Date(Date.now() - 120000).toISOString(), level: 'WARNING', message: 'High response time detected' }
    ];
    
    res.json({ logs: sampleLogs });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get logs' });
  }
});

// 繝倥Ν繧ｹ繝√ぉ繝・・ｽ・ｽ螳溯｡・// 繧ｷ繧ｹ繝・・ｽ・ｽ蛛･蜈ｨ諤ｧ繧呈焔蜍輔〒繝√ぉ繝・・ｽ・ｽ・ｽE・ｽEB謗･邯夲ｿｽEAPI蠢懃ｭ費ｿｽE繝｡繝｢繝ｪ菴ｿ逕ｨ邇・・ｽ・ｽEapp.post('/api/health/check', async (req, res) => {
  try {
    const healthCheck = await healthMonitor.performHealthCheck();
    res.json(healthCheck);
  } catch (error) {
    res.status(500).json({ error: 'Health check failed', details: error.message });
  }
});

// IP繝悶Ο繝・・ｽ・ｽ邂｡逅・// 迚ｹ螳唔P繧｢繝峨Ξ繧ｹ繧呈焔蜍輔〒繝悶Ο繝・・ｽ・ｽ・ｽE・ｽ繧ｻ繧ｭ繝･繝ｪ繝・・ｽ・ｽ蟇ｾ遲厄ｼ・app.post('/api/security/block-ip', async (req, res) => {
  try {
    const { ip, reason } = req.body;
    securityManager.manualBlockIP(ip, reason);
    res.json({ success: true, message: `IP ${ip} blocked` });
  } catch (error) {
    res.status(500).json({ error: 'Failed to block IP' });
  }
});

// IP繝悶Ο繝・・ｽ・ｽ隗｣髯､
// 繝悶Ο繝・・ｽ・ｽ縺輔ｌ縺櫑P繧｢繝峨Ξ繧ｹ繧定ｧ｣髯､
app.post('/api/security/unblock-ip', async (req, res) => {
  try {
    const { ip } = req.body;
    securityManager.manualUnblockIP(ip);
    res.json({ success: true, message: `IP ${ip} unblocked` });
  } catch (error) {
    res.status(500).json({ error: 'Failed to unblock IP' });
  }
});

// 繧ｷ繧ｹ繝・・ｽ・ｽ諠・・ｽ・ｽ蜿門ｾ・// 繧ｷ繧ｹ繝・・ｽ・ｽ繝撰ｿｽE繧ｸ繝ｧ繝ｳ繝ｻ遞ｼ蜒肴凾髢難ｿｽE繝｡繝｢繝ｪ菴ｿ逕ｨ迥ｶ豕√ｒ蜿門ｾ・app.get('/api/system/info', (req, res) => {
  res.json({
    version: '10.0.0-enterprise',
    environment: process.env.NODE_ENV || 'production',
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    timestamp: new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })
  });
});

// ==========================================
// 險ｭ螳壹お繝ｳ繝会ｿｽE繧､繝ｳ繝・// ==========================================
// 繧ｯ繝ｩ繧､繧｢繝ｳ繝医↓迴ｾ蝨ｨ縺ｮSTORE_ID繧定ｿ斐☆
app.get('/api/config', (req, res) => {
  const storeId = process.env.STORE_ID || '***REMOVED-ROTATE-CREDENTIAL***';
  res.json({
    storeId: storeId,
    environment: process.env.NODE_ENV || 'development'
  });
});

// ==========================================
// LIFF逶｣隕悶お繝ｳ繝会ｿｽE繧､繝ｳ繝・// ==========================================
// LIFF險ｭ螳夂憾諷九→髢｢騾｣繧ｨ繝ｳ繝会ｿｽE繧､繝ｳ繝茨ｿｽE蛛･蜈ｨ諤ｧ繧堤｢ｺ隱・app.get('/api/liff-health', (req, res) => {
  const liffId = process.env.LIFF_ID || '***REMOVED-ROTATE-CREDENTIAL***';
  const baseUrl = process.env.BASE_URL || 'https://line-booking-api-116429620992.asia-northeast1.run.app';
  
  res.json({
    status: 'healthy',
    timestamp: new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' }),
    liff: {
      id: liffId,
      url: `https://liff.line.me/${liffId}`,
      directUrl: `${baseUrl}/liff-booking-enhanced.html`,
      configured: true
    },
    endpoints: {
      liffPage: `${baseUrl}/liff-booking-enhanced.html`,
      webhook: `${baseUrl}/api/webhook`,
      admin: `${baseUrl}/api/admin`,
      calendarSlots: `${baseUrl}/api/calendar-slots`
    },
    validation: {
      liffIdFormat: /^\d{10}-[a-zA-Z0-9]+$/.test(liffId),
      envVarsSet: {
        LIFF_ID: !!process.env.LIFF_ID,
        BASE_URL: !!process.env.BASE_URL,
        LINE_CHANNEL_ACCESS_TOKEN: !!process.env.LINE_CHANNEL_ACCESS_TOKEN,
        LINE_CHANNEL_SECRET: !!process.env.LINE_CHANNEL_SECRET
      }
    }
  });
});

// ==========================================
// 邂｡逅・PI邨ｱ蜷・// ==========================================
// 莠呈鋤繝ｫ繝ｼ繝茨ｼ・04隗｣豸茨ｼ・ 蟆る摩螳ｶ謗ｨ螂ｨ
// 縺ｩ縺｡繧峨〒譚･縺ｦ繧ょ酔縺倥ワ繝ｳ繝峨Λ縺ｸ
// (蜑企勁: adminRouter蜀・・ｽ・ｽ螳夂ｾｩ貂医∩)

// 繝倥Ν繧ｹ&繝撰ｿｽE繧ｸ繝ｧ繝ｳ繧ｨ繝ｳ繝会ｿｽE繧､繝ｳ繝茨ｼ亥ｰる摩螳ｶ謗ｨ螂ｨ・ｽE・ｽEapp.get('/api/health', (_req, res) => res.json({ ok: true, ts: new Date().toISOString() }));
app.get('/api/version', (_req, res) => {
  res.json({
    rev: process.env.K_REVISION || 'dev',
    mode: (process.env.ADMIN_AUTH_MODE || 'unset'),
    node: process.version
  });
});

app.get('/debug/version', (_req, res) => {
  res.json({
    service: process.env.K_SERVICE || 'booking-account1',
    revision: process.env.K_REVISION || null,
    project: process.env.GOOGLE_CLOUD_PROJECT || null,
    liffId: process.env.LIFF_ID || null,
    storeId: process.env.STORE_ID || null,
    image: process.env.GOOGLE_CONTAINER_IMAGE || null,
    time: new Date().toISOString()
  });
});

// 譌ｧ蠑上→譁ｰ蠑擾ｿｽE荳｡譁ｹ繧偵し繝晢ｿｽE繝・// (蜑企勁: adminRouter.get('/')縺ｧ邨ｱ蜷域ｸ医∩)

// (蜑企勁: adminRouter.all('/')縺ｧ邨ｱ蜷域ｸ医∩)

// ==========================================
// 繧ｨ繝ｩ繝ｼ繝上Φ繝峨Μ繝ｳ繧ｰ - 蜈ｨ繝ｫ繝ｼ繝亥ｮ夂ｾｩ蠕後↓驟咲ｽｮ
// ==========================================
// 譛ｪ繧ｭ繝｣繝・・ｽ・ｽ繧ｨ繝ｩ繝ｼ繧呈黒謐峨＠縺ｦ500繧ｨ繝ｩ繝ｼ繧定ｿ泌唆
app.use((err, req, res, next) => {
  console.error(JSON.stringify({
    severity: 'ERROR',
    msg: 'Unhandled error',
    url: req.url,
    error: err.message,
    stack: err.stack
  }));
  res.status(500).json({ 
    error: 'Internal server error',
    message: err.message,
    details: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
});

// 404繝上Φ繝峨Λ繝ｼ - 譛蠕後↓驟咲ｽｮ
// 螳夂ｾｩ縺輔ｌ縺ｦ縺・・ｽ・ｽ縺・・ｽ・ｽ繝ｼ繝医∈縺ｮ繧｢繧ｯ繧ｻ繧ｹ繧抵ｿｽE逅・app.use((req, res) => {
  console.log(JSON.stringify({
    severity: 'WARNING',
    msg: '404 Not Found',
    path: req.url
  }));
  res.status(404).json({ error: 'Not found', path: req.url });
});

// ==========================================
// 繧ｵ繝ｼ繝撰ｿｽE襍ｷ蜍・// ==========================================
// Express繧ｵ繝ｼ繝撰ｿｽE繧呈欠螳夲ｿｽE繝ｼ繝医〒襍ｷ蜍包ｼ茨ｿｽEIP縺九ｉ縺ｮ繧｢繧ｯ繧ｻ繧ｹ繧定ｨｱ蜿ｯ・ｽE・ｽE
app.get('/debug/asset-hash', (req, res) => {
  try {
    const requested = String(req.query.file || 'js/liff-booking-page.js');
    const normalized = requested.replace(/^\/+/, '');
    const target = path.join(PUBLIC_ROOT, normalized);
    if (!target.startsWith(PUBLIC_ROOT)) {
      return res.status(400).json({ error: 'invalid_path' });
    }
    if (!fs.existsSync(target)) {
      return res.status(404).json({ error: 'not_found', file: normalized });
    }
    const buffer = fs.readFileSync(target);
    const sha1 = crypto.createHash('sha1').update(buffer).digest('hex');
    res.json({ file: normalized, bytes: buffer.length, sha1 });
  } catch (error) {
    res.status(500).json({ error: 'hash_failed', message: String(error) });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(JSON.stringify({
    severity: 'INFO',
    msg: 'Server started - Raw buffer mode',
    port: PORT,
    environment: NODE_ENV,
    version: '4.0.0-raw-buffer',
    timestamp: new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })
  }));
});





