/**
 * Server v2 with UTC normalization and proper routing
 */

const express = require('express');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 8080;

// Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Attach supabase to request
app.use((req, res, next) => {
  req.supabase = supabase;
  next();
});

// CORS headers
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Idempotency-Key');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// Request logging
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${req.method} ${req.path}`);
  
  if (process.env.LOG_LEVEL === 'debug') {
    if (req.body && Object.keys(req.body).length > 0) {
      console.log('Body:', JSON.stringify(req.body, null, 2));
    }
    if (req.headers['idempotency-key']) {
      console.log('Idempotency-Key:', req.headers['idempotency-key']);
    }
  }
  
  next();
});

// Static files
app.use(express.static('public'));

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy',
    version: '2.0.0',
    timestamp: new Date().toISOString()
  });
});

// Config endpoint
app.get('/api/config', (req, res) => {
  res.json({
    storeId: process.env.STORE_ID || 'default-store',
    liffId: process.env.LIFF_ID || '',
    apiVersion: 'v2',
    features: {
      idempotency: process.env.FEATURE_IDEMPOTENCY !== 'false',
      utcNormalization: true
    }
  });
});

// Mount v2 API routes
const reservationsV2 = require('./api/reservations-v2');
app.use('/api/v2', reservationsV2);

// Legacy v1 API routes (for backward compatibility)
const adminRoutes = require('./api/admin');
app.use('/api/admin', adminRoutes);

// Webhook routes
const webhookRoutes = require('./api/webhook');
app.use('/api/webhook', webhookRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'not_found',
    message: 'The requested resource was not found',
    path: req.path
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Error:', err);
  
  res.status(err.status || 500).json({
    error: 'internal_error',
    message: process.env.NODE_ENV === 'production' 
      ? 'An error occurred' 
      : err.message,
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack })
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server v2 running on port ${PORT}`);
  console.log('Features:', {
    idempotency: process.env.FEATURE_IDEMPOTENCY !== 'false',
    logLevel: process.env.LOG_LEVEL || 'info',
    environment: process.env.NODE_ENV || 'development'
  });
});