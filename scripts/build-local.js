#!/usr/bin/env node

/**
 * Local build script that temporarily removes updater config to avoid schema validation errors
 * The updater config is restored after the build
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');

const tauriConfPath = join(rootDir, 'src-tauri', 'tauri.conf.json');

// Read current config
const tauriConf = JSON.parse(readFileSync(tauriConfPath, 'utf8'));
const updaterConfig = tauriConf.updater;

// Remove updater config completely for local builds to avoid schema validation errors
// The plugin won't be initialized (we'll handle this in Rust)
delete tauriConf.updater;
writeFileSync(tauriConfPath, JSON.stringify(tauriConf, null, 2) + '\n');

console.log('🔨 Building app (updater config temporarily removed for schema validation)...\n');

try {
  // Build frontend first
  execSync('npm run build', {
    cwd: rootDir,
    stdio: 'inherit'
  });
  
  // Build Tauri without updater feature to avoid schema validation errors
  // This builds a working app without update functionality for local testing
  // Since config is removed and updater is optional, it won't be compiled
  execSync('npm run tauri build', {
    cwd: rootDir,
    stdio: 'inherit'
  });
  
  console.log('\n✅ Build completed successfully!');
} catch (error) {
  console.error('\n❌ Build failed:', error.message);
  process.exit(1);
} finally {
  // Always restore updater config
  if (updaterConfig) {
    tauriConf.updater = updaterConfig;
    writeFileSync(tauriConfPath, JSON.stringify(tauriConf, null, 2) + '\n');
    console.log('✅ Updater config restored');
  }
}
