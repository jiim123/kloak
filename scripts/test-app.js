#!/usr/bin/env node

/**
 * Test script to run the built app and capture errors
 */

import { execSync } from 'child_process';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { glob } from 'glob';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');

console.log('Looking for built executable...\n');

// Find the exe file
const exePattern = join(rootDir, 'src-tauri', 'target', 'release', 'bundle', 'nsis', '*.exe');
const files = glob.sync(exePattern);

if (files.length === 0) {
  console.error('❌ No executable found. Build the app first with: npm run build:local');
  process.exit(1);
}

const exePath = files[0];
console.log(`Found: ${exePath}\n`);
console.log('Running app... (check for errors in the console)\n');

try {
  // Run the exe
  execSync(`"${exePath}"`, {
    cwd: rootDir,
    stdio: 'inherit'
  });
} catch (error) {
  console.error('\n❌ App exited with error:', error.message);
}
