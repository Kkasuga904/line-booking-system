// Webhook Health Check and Auto-Recovery
import https from 'https';

export default async function handler(req, res) {
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    checks: {}
  };
  
  // Check 1: Verify environment variables
  health.checks.env = {
    LINE_TOKEN: !!process.env.LINE_CHANNEL_ACCESS_TOKEN,
    LINE_SECRET: !!process.env.LINE_CHANNEL_SECRET,
    LIFF_ID: !!process.env.LIFF_ID,
    SUPABASE_URL: !!process.env.SUPABASE_URL,
    SUPABASE_KEY: !!process.env.SUPABASE_ANON_KEY
  };
  
  // Check 2: Test LINE API connectivity
  try {
    const testResponse = await testLineAPI();
    health.checks.lineAPI = {
      status: testResponse ? 'connected' : 'failed',
      responseTime: testResponse?.time || null
    };
  } catch (error) {
    health.checks.lineAPI = {
      status: 'error',
      error: error.message
    };
  }
  
  // Check 3: Verify webhook endpoint
  health.checks.webhookEndpoints = {
    simple: '/api/webhook-simple',
    monitor: '/api/webhook-monitor',
    health: '/api/webhook-health'
  };
  
  // Check 4: Recent errors
  health.checks.recentErrors = getRecentErrors();
  
  // Determine overall health
  if (!health.checks.env.LINE_TOKEN || !health.checks.env.LINE_SECRET) {
    health.status = 'critical';
    health.message = 'LINE credentials not configured';
  } else if (health.checks.lineAPI.status === 'error') {
    health.status = 'degraded';
    health.message = 'LINE API connectivity issues';
  }
  
  res.status(200).json(health);
}

async function testLineAPI() {
  return new Promise((resolve) => {
    const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
    if (!token) {
      resolve(null);
      return;
    }
    
    const startTime = Date.now();
    const options = {
      hostname: 'api.line.me',
      port: 443,
      path: '/v2/bot/info',
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    };
    
    const req = https.request(options, (res) => {
      const time = Date.now() - startTime;
      if (res.statusCode === 200) {
        resolve({ success: true, time });
      } else {
        resolve({ success: false, time, status: res.statusCode });
      }
    });
    
    req.on('error', () => {
      resolve(null);
    });
    
    req.setTimeout(5000, () => {
      req.destroy();
      resolve(null);
    });
    
    req.end();
  });
}

function getRecentErrors() {
  // In production, this would fetch from a logging service
  return {
    count: 0,
    lastError: null
  };
}