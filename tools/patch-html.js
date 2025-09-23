const fs = require('fs');
const path = require('path');

const NAME_FILE = path.resolve('public/.liff-js-name');
if (!fs.existsSync(NAME_FILE)) {
  console.error('[patch-html] fingerprint name file missing', NAME_FILE);
  process.exit(1);
}

const hashedName = fs.readFileSync(NAME_FILE, 'utf8').trim();
if (!hashedName) {
  console.error('[patch-html] fingerprint name file empty');
  process.exit(1);
}

const TARGET_HTML = [
  'public/liff-booking.html',
  'public/liff-booking-enhanced.html',
  '.deploy-src/public/liff-booking.html',
  '.deploy-src/public/liff-booking-enhanced.html',
];

const scriptRegex = /\/js\/liff-booking-page(?:\.[a-z0-9]+)?\.js/g;
const replacement = `/js/${hashedName}`;

for (const file of TARGET_HTML) {
  const absolute = path.resolve(file);
  if (!fs.existsSync(absolute)) {
    continue;
  }
  const original = fs.readFileSync(absolute, 'utf8');
  const updated = original.replace(scriptRegex, replacement);
  if (original !== updated) {
    fs.writeFileSync(absolute, updated);
    console.log('[patch-html] updated', file, '->', hashedName);
  } else {
    console.log('[patch-html] no change for', file);
  }
}
