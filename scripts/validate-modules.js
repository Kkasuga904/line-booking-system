#!/usr/bin/env node

/**
 * ES Module Validator
 * Checks all JavaScript files for CommonJS syntax that will fail in ES module context
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const projectRoot = path.join(__dirname, '..');
const errors = [];

// Patterns that indicate CommonJS usage
const commonJSPatterns = [
  {
    pattern: /\brequire\s*\(/g,
    message: 'Uses require() - use import instead',
    fix: 'Replace require() with import statement'
  },
  {
    pattern: /\bmodule\.exports\s*=/g,
    message: 'Uses module.exports - use export default instead',
    fix: 'Replace module.exports with export default'
  },
  {
    pattern: /\bexports\.\w+\s*=/g,
    message: 'Uses exports.name - use export { name } instead',
    fix: 'Replace exports.name with named export'
  },
  {
    pattern: /\b__dirname\b/g,
    message: 'Uses __dirname - use import.meta.url instead',
    fix: 'Use path.dirname(fileURLToPath(import.meta.url))'
  },
  {
    pattern: /\b__filename\b/g,
    message: 'Uses __filename - use import.meta.url instead',
    fix: 'Use fileURLToPath(import.meta.url)'
  }
];

// Directories to check
const checkDirs = ['api', 'utils', 'scripts'];

function checkFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const relativePath = path.relative(projectRoot, filePath);
  
  // Skip files that are explicitly CommonJS (.cjs)
  if (filePath.endsWith('.cjs')) {
    return;
  }
  
  const fileErrors = [];
  
  commonJSPatterns.forEach(({ pattern, message, fix }) => {
    const matches = content.match(pattern);
    if (matches) {
      matches.forEach(match => {
        // Find line number
        const lines = content.substring(0, content.indexOf(match)).split('\n');
        const lineNumber = lines.length;
        
        fileErrors.push({
          file: relativePath,
          line: lineNumber,
          issue: message,
          found: match.trim(),
          fix: fix
        });
      });
    }
  });
  
  if (fileErrors.length > 0) {
    errors.push(...fileErrors);
  }
}

function scanDirectory(dirPath) {
  if (!fs.existsSync(dirPath)) {
    return;
  }
  
  const files = fs.readdirSync(dirPath);
  
  files.forEach(file => {
    const fullPath = path.join(dirPath, file);
    const stat = fs.statSync(fullPath);
    
    if (stat.isDirectory() && !file.startsWith('.') && file !== 'node_modules') {
      scanDirectory(fullPath);
    } else if (stat.isFile() && file.endsWith('.js')) {
      checkFile(fullPath);
    }
  });
}

// Main execution
console.log('🔍 Validating ES Module compliance...\n');

checkDirs.forEach(dir => {
  const dirPath = path.join(projectRoot, dir);
  scanDirectory(dirPath);
});

if (errors.length === 0) {
  console.log('✅ All JavaScript files are ES Module compliant!\n');
  process.exit(0);
} else {
  console.error(`❌ Found ${errors.length} CommonJS usage(s) that will fail in ES module context:\n`);
  
  errors.forEach((error, index) => {
    console.error(`${index + 1}. ${error.file}:${error.line}`);
    console.error(`   Issue: ${error.issue}`);
    console.error(`   Found: "${error.found}"`);
    console.error(`   Fix: ${error.fix}\n`);
  });
  
  console.error('📝 Fix these issues before deploying to Vercel!');
  console.error('   Vercel treats .js files as ES modules when package.json has "type": "module"\n');
  
  process.exit(1);
}