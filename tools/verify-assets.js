const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const primary = path.resolve('public/js/liff-booking-page.js');
const secondary = path.resolve('.deploy-src/public/js/liff-booking-page.js');

function sha1(file) {
  return crypto.createHash('sha1').update(fs.readFileSync(file)).digest('hex');
}

if (!fs.existsSync(primary)) {
  console.error('[verify-assets] missing', primary);
  process.exit(1);
}

if (fs.existsSync(secondary)) {
  const primarySha = sha1(primary);
  const secondarySha = sha1(secondary);
  if (primarySha !== secondarySha) {
    console.error('[verify-assets] SHA mismatch between public and .deploy-src copies', {
      [primary]: primarySha,
      [secondary]: secondarySha,
    });
    process.exit(1);
  }
  console.log('[verify-assets] OK', primarySha);
} else {
  console.log('[verify-assets] secondary copy missing, treating public/ as single source');
}
