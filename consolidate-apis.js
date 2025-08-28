// Consolidate API files to reduce count below 12 for Vercel Hobby plan

import fs from 'fs';
import path from 'path';

const apiDir = './api';
const apiBackupDir = './api-backup';

// Create backup directory if it doesn't exist
if (!fs.existsSync(apiBackupDir)) {
  fs.mkdirSync(apiBackupDir);
}

// Files to keep (core functionality)
const keepFiles = [
  'admin.js',
  'calendar-reservation.js', 
  'calendar-slots.js',
  'check-seat-availability.js',
  'reservation-manage.js',
  'seats-manage.js',
  'version.js',
  'webhook-simple.js'
];

// Files to remove (can be consolidated or are optional)
const removeFiles = [
  'analytics.js',           // Can be part of admin
  'health-check.js',        // Optional monitoring  
  'security-middleware.js', // Can be inline in other files
  'webhook-async.js',       // Use webhook-simple instead
  'webhook-health.js',      // Optional monitoring
  'webhook-monitor.js'      // Optional monitoring
];

console.log('=== API Consolidation ===\n');
console.log(`Current API count: ${fs.readdirSync(apiDir).filter(f => f.endsWith('.js')).length}`);
console.log('Target: 12 or fewer\n');

// Move files to backup
removeFiles.forEach(file => {
  const sourcePath = path.join(apiDir, file);
  const destPath = path.join(apiBackupDir, file);
  
  if (fs.existsSync(sourcePath)) {
    fs.renameSync(sourcePath, destPath);
    console.log(`Moved ${file} to backup`);
  }
});

const finalCount = fs.readdirSync(apiDir).filter(f => f.endsWith('.js')).length;
console.log(`\n✅ Final API count: ${finalCount}`);

if (finalCount <= 12) {
  console.log('Ready for Vercel deployment!');
} else {
  console.log('⚠️ Still too many APIs. Remove more files.');
}