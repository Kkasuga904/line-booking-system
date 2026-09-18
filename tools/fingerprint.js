const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const SOURCE_FILE = path.resolve('public/js/liff-booking-page.js');
const PUBLIC_JS_DIR = path.resolve('public/js');
const DEPLOY_JS_DIR = path.resolve('.deploy-src/public/js');
const NAME_FILE = path.resolve('public/.liff-js-name');
const DEPLOY_NAME_FILE = path.resolve('.deploy-src/public/.liff-js-name');

if (!fs.existsSync(SOURCE_FILE)) {
  console.error('[fingerprint] missing source file', SOURCE_FILE);
  process.exit(1);
}

function removeFileIfExists(filePath) {
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
}

function writeNameFile(target, value) {
  const dir = path.dirname(target);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(target, `${value}\n`);
}

let previousName = '';
if (fs.existsSync(NAME_FILE)) {
  previousName = fs.readFileSync(NAME_FILE, 'utf8').trim();
}

if (previousName) {
  removeFileIfExists(path.join(PUBLIC_JS_DIR, previousName));
  if (fs.existsSync(DEPLOY_JS_DIR)) {
    removeFileIfExists(path.join(DEPLOY_JS_DIR, previousName));
  }
}

const buffer = fs.readFileSync(SOURCE_FILE);
const hash = crypto.createHash('sha1').update(buffer).digest('hex').slice(0, 8);
const hashedName = `liff-booking-page.${hash}.js`;
const publicHashedPath = path.join(PUBLIC_JS_DIR, hashedName);

fs.writeFileSync(publicHashedPath, buffer);
writeNameFile(NAME_FILE, hashedName);
console.log('[fingerprint] created', hashedName);

if (fs.existsSync(DEPLOY_JS_DIR)) {
  const deployHashedPath = path.join(DEPLOY_JS_DIR, hashedName);
  fs.copyFileSync(publicHashedPath, deployHashedPath);
  writeNameFile(DEPLOY_NAME_FILE, hashedName);
  console.log('[fingerprint] copied to deploy-src', hashedName);
}
