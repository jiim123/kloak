#!/usr/bin/env node

/**
 * Local dev script that temporarily removes updater config to avoid schema validation errors
 * The updater config is restored after the dev server starts
 */

import { readFileSync, writeFileSync } from 'fs';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');

const tauriConfPath = join(rootDir, 'src-tauri', 'tauri.conf.json');

// Read current config
const tauriConf = JSON.parse(readFileSync(tauriConfPath, 'utf8'));
const updaterConfig = tauriConf.updater;

// Remove updater config completely for dev to avoid schema validation errors
// The plugin won't be initialized (we'll handle this in Rust)
delete tauriConf.updater;
writeFileSync(tauriConfPath, JSON.stringify(tauriConf, null, 2) + '\n');

console.log('🚀 Starting dev server (updater config temporarily removed for schema validation)...\n');

// Spawn the dev process - config is already removed so schema validation should pass
// Since config is removed and updater is optional feature, plugin won't be initialized
const devProcess = spawn('npm', ['run', 'tauri', 'dev'], {
  cwd: rootDir,
  stdio: 'inherit',
  shell: true
});

// Handle process exit
devProcess.on('exit', (code) => {
  // Always restore updater config
  if (updaterConfig) {
    tauriConf.updater = updaterConfig;
    writeFileSync(tauriConfPath, JSON.stringify(tauriConf, null, 2) + '\n');
    console.log('\n✅ Updater config restored');
  }
  process.exit(code || 0);
});

// Handle Ctrl+C
process.on('SIGINT', () => {
  devProcess.kill('SIGINT');
  // Restore config before exiting
  if (updaterConfig) {
    tauriConf.updater = updaterConfig;
    writeFileSync(tauriConfPath, JSON.stringify(tauriConf, null, 2) + '\n');
  }
  process.exit(0);
});
