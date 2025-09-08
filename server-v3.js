/**
 * Server v3 - Clean implementation without global guards
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
  
  // Log Idempotency-Key if present
  if (req.headers['idempotency-key']) {
    console.log(`  Idempotency-Key: ${req.headers['idempotency-key']}`);
  }
  
  next();
});

// Static files
app.use(express.static('public'));

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy',
    version: '3.0.0',
    timestamp: new Date().toISOString(),
    message: 'No global guards - using DB constraints only'
  });
});

// API Routes
const adminV3Router = require('./api/admin-v3');
const eventsRouter = require('./api/events');
const webhookRouter = require('./api/webhook');

app.use('/api/admin', adminV3Router);
app.use('/api/events', eventsRouter);
app.use('/api/webhook', webhookRouter);

// Config endpoint
app.get('/api/config', (req, res) => {
  res.json({
    storeId: process.env.STORE_ID || 'default-store',
    liffId: process.env.LIFF_ID || '',
    apiVersion: 'v3',
    features: {
      idempotencyRequired: true,
      utcNormalization: true,
      globalGuards: false  // Explicitly false
    }
  });
});

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
      : err.message
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`
========================================
Server v3 running on port ${PORT}
========================================
Version: 3.0.0
Features:
  - Idempotency-Key: REQUIRED
  - UTC Normalization: ENABLED
  - Global Guards: REMOVED
  - DB Constraints: ACTIVE
========================================
  `);
});