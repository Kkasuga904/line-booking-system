/**
 * 認証API - JWT トークンの発行
 * POST /api/auth/login
 * POST /api/auth/refresh
 */

import { createClient } from '@supabase/supabase-js';
import { getEnv } from '../utils/env-helper.js';

// Supabase初期化
const SUPABASE_URL = getEnv('SUPABASE_URL');
const SUPABASE_ANON_KEY = getEnv('SUPABASE_ANON_KEY');

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('ERROR: Supabase credentials not set');
  throw new Error('Supabase configuration required');
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export default async function handler(req, res) {
  // CORS設定
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  const url = new URL(req.url, `http://${req.headers.host}`);
  const action = url.pathname.split('/').pop();
  
  try {
    switch (action) {
      case 'login':
        return await handleLogin(req, res);
      
      case 'refresh':
        return await handleRefresh(req, res);
        
      case 'logout':
        return await handleLogout(req, res);
        
      default:
        return res.status(404).json({ error: 'Unknown auth action' });
    }
  } catch (error) {
    console.error('Auth error:', error);
    return res.status(500).json({ 
      error: 'Authentication failed',
      details: error.message 
    });
  }
}

async function handleLogin(req, res) {
  const { email, password } = req.body;
  
  if (!email || !password) {
    return res.status(400).json({ 
      error: 'Email and password required' 
    });
  }
  
  // Supabaseでログイン
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password
  });
  
  if (error) {
    console.error('Login failed:', error);
    return res.status(401).json({ 
      error: 'Invalid credentials',
      details: error.message 
    });
  }
  
  // トークンと基本情報を返す
  return res.status(200).json({
    success: true,
    token: data.session.access_token,
    refresh_token: data.session.refresh_token,
    expires_in: data.session.expires_in,
    user: {
      id: data.user.id,
      email: data.user.email,
      role: data.user.role || 'user'
    }
  });
}

async function handleRefresh(req, res) {
  const { refresh_token } = req.body;
  
  if (!refresh_token) {
    return res.status(400).json({ 
      error: 'Refresh token required' 
    });
  }
  
  // トークンをリフレッシュ
  const { data, error } = await supabase.auth.refreshSession({
    refresh_token
  });
  
  if (error) {
    console.error('Token refresh failed:', error);
    return res.status(401).json({ 
      error: 'Invalid refresh token',
      details: error.message 
    });
  }
  
  return res.status(200).json({
    success: true,
    token: data.session.access_token,
    refresh_token: data.session.refresh_token,
    expires_in: data.session.expires_in
  });
}

async function handleLogout(req, res) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ 
      error: 'No token provided' 
    });
  }
  
  const token = authHeader.substring(7);
  
  // Supabaseでログアウト
  const { error } = await supabase.auth.signOut();
  
  if (error) {
    console.error('Logout failed:', error);
    return res.status(500).json({ 
      error: 'Logout failed',
      details: error.message 
    });
  }
  
  return res.status(200).json({
    success: true,
    message: 'Logged out successfully'
  });
}