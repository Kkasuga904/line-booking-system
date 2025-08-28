// Smoke Test Script for LINE Booking System (Node.js version)
// Usage: node smoke-test.js [DEPLOYMENT_URL]

const https = require('https');
const http = require('http');

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m'
};

// Get deployment URL from argument or use default
const DEPLOY_URL = process.argv[2] || 'https://line-booking-system-seven.vercel.app';

console.log(`🔍 Starting smoke test for: ${DEPLOY_URL}`);
console.log('================================\n');

let testsPassed = 0;
let testsFailed = 0;

// Parse URL for protocol selection
const url = new URL(DEPLOY_URL);
const client = url.protocol === 'https:' ? https : http;

// Test function for GET requests
function testEndpoint(path, expectedStatus, description) {
  return new Promise((resolve) => {
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: path,
      method: 'GET',
      headers: {
        'User-Agent': 'Smoke-Test/1.0'
      }
    };

    const req = client.request(options, (res) => {
      if (res.statusCode === expectedStatus) {
        console.log(`✓ ${colors.green}PASS${colors.reset} ${description} (Status: ${res.statusCode})`);
        testsPassed++;
      } else {
        console.log(`✗ ${colors.red}FAIL${colors.reset} ${description} (Expected: ${expectedStatus}, Got: ${res.statusCode})`);
        testsFailed++;
      }
      resolve();
    });

    req.on('error', (error) => {
      console.log(`✗ ${colors.red}FAIL${colors.reset} ${description} (Error: ${error.message})`);
      testsFailed++;
      resolve();
    });

    req.end();
  });
}

// Test function for POST requests
function testPostEndpoint(path, data, expectedStatus, description) {
  return new Promise((resolve) => {
    const postData = JSON.stringify(data);
    
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: path,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
        'User-Agent': 'Smoke-Test/1.0'
      }
    };

    const req = client.request(options, (res) => {
      if (res.statusCode === expectedStatus) {
        console.log(`✓ ${colors.green}PASS${colors.reset} ${description} (Status: ${res.statusCode})`);
        testsPassed++;
      } else {
        console.log(`✗ ${colors.red}FAIL${colors.reset} ${description} (Expected: ${expectedStatus}, Got: ${res.statusCode})`);
        testsFailed++;
      }
      resolve();
    });

    req.on('error', (error) => {
      console.log(`✗ ${colors.red}FAIL${colors.reset} ${description} (Error: ${error.message})`);
      testsFailed++;
      resolve();
    });

    req.write(postData);
    req.end();
  });
}

// Test response time
function testResponseTime(path, maxTime, description) {
  return new Promise((resolve) => {
    const startTime = Date.now();
    
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: path,
      method: 'GET',
      headers: {
        'User-Agent': 'Smoke-Test/1.0'
      }
    };

    const req = client.request(options, (res) => {
      const responseTime = Date.now() - startTime;
      
      if (responseTime < maxTime) {
        console.log(`✓ ${colors.green}PASS${colors.reset} ${description} (Response time: ${responseTime}ms)`);
        testsPassed++;
      } else {
        console.log(`⚠ ${colors.yellow}SLOW${colors.reset} ${description} (Response time: ${responseTime}ms, Max: ${maxTime}ms)`);
        testsFailed++;
      }
      resolve();
    });

    req.on('error', (error) => {
      console.log(`✗ ${colors.red}FAIL${colors.reset} ${description} (Error: ${error.message})`);
      testsFailed++;
      resolve();
    });

    req.end();
  });
}

// Run all tests
async function runTests() {
  // 1. Health Check Tests
  console.log(`${colors.yellow}1. Health Check Tests${colors.reset}`);
  await testEndpoint('/api/ping', 200, 'Ping endpoint');
  await testEndpoint('/api/health', 200, 'Health endpoint');
  await testEndpoint('/api/webhook-health', 200, 'Webhook health');
  
  // 2. Public Page Tests
  console.log(`\n${colors.yellow}2. Public Page Tests${colors.reset}`);
  await testEndpoint('/', 200, 'Homepage');
  await testEndpoint('/admin', 200, 'Admin page');
  await testEndpoint('/admin-calendar', 200, 'Calendar page');
  await testEndpoint('/liff', 200, 'LIFF page');
  
  // 3. API Endpoint Tests
  console.log(`\n${colors.yellow}3. API Endpoint Tests${colors.reset}`);
  await testEndpoint('/api/admin', 200, 'Admin API');
  await testEndpoint('/api/calendar-reservation', 405, 'Calendar API (GET should fail)');
  
  // 4. Webhook Tests
  console.log(`\n${colors.yellow}4. Webhook Tests${colors.reset}`);
  
  // Test webhook with empty events
  await testPostEndpoint('/webhook', { events: [] }, 200, 'Webhook with empty events');
  
  // Test webhook with follow event
  const followEvent = {
    events: [{
      type: 'follow',
      replyToken: 'test_token',
      source: { userId: 'test_user' }
    }]
  };
  await testPostEndpoint('/webhook', followEvent, 200, 'Webhook with follow event');
  
  // Test webhook with message event
  const messageEvent = {
    events: [{
      type: 'message',
      replyToken: 'test_token',
      source: { userId: 'test_user' },
      message: { text: '予約' }
    }]
  };
  await testPostEndpoint('/webhook', messageEvent, 200, 'Webhook with message event');
  
  // 5. Error Handling Tests
  console.log(`\n${colors.yellow}5. Error Handling Tests${colors.reset}`);
  await testEndpoint('/api/nonexistent', 404, '404 Error handling');
  await testEndpoint('/api/webhook', 405, 'Method not allowed');
  
  // 6. Performance Tests
  console.log(`\n${colors.yellow}6. Performance Tests${colors.reset}`);
  await testResponseTime('/api/ping', 1000, 'API response time');
  await testResponseTime('/', 2000, 'Homepage load time');
  
  // Summary
  console.log('\n================================');
  console.log('📊 Test Results Summary');
  console.log('================================');
  console.log(`Tests Passed: ${colors.green}${testsPassed}${colors.reset}`);
  console.log(`Tests Failed: ${colors.red}${testsFailed}${colors.reset}`);
  
  if (testsFailed === 0) {
    console.log(`\n${colors.green}✅ All smoke tests passed!${colors.reset}`);
    process.exit(0);
  } else {
    console.log(`\n${colors.red}❌ Some tests failed. Please review the failures above.${colors.reset}`);
    process.exit(1);
  }
}

// Run the tests
runTests().catch(error => {
  console.error(`\n${colors.red}Fatal error during testing:${colors.reset}`, error);
  process.exit(1);
});