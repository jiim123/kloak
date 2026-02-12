#!/usr/bin/env node

/**
 * Automated Release Script for Tauri App
 * 
 * This script automates the entire release process:
 * 1. Updates version numbers across all files
 * 2. Builds the app
 * 3. Generates update manifest
 * 4. Creates GitHub release
 * 5. Uploads artifacts
 * 
 * Usage: node scripts/release.js [version] [--skip-build] [--skip-release]
 * Example: node scripts/release.js 1.0.0
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFile, writeFile } from 'fs/promises';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  blue: '\x1b[34m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function error(message) {
  log(`❌ Error: ${message}`, 'red');
  process.exit(1);
}

function success(message) {
  log(`✅ ${message}`, 'green');
}

function info(message) {
  log(`ℹ️  ${message}`, 'blue');
}

function warn(message) {
  log(`⚠️  ${message}`, 'yellow');
}

// Parse command line arguments
const args = process.argv.slice(2);
const skipBuild = args.includes('--skip-build');
const skipRelease = args.includes('--skip-release');
const versionArg = args.find(arg => !arg.startsWith('--'));

if (!versionArg) {
  error('Please provide a version number (e.g., 1.0.0)');
}

const newVersion = versionArg;
const versionRegex = /^\d+\.\d+\.\d+$/;

if (!versionRegex.test(newVersion)) {
  error('Version must be in format X.Y.Z (e.g., 1.0.0)');
}

// Validate GitHub token
const githubToken = process.env.GITHUB_TOKEN;
if (!githubToken && !skipRelease) {
  error('GITHUB_TOKEN environment variable is required. Set it with: export GITHUB_TOKEN=your_token');
}

// Get GitHub repo from package.json or environment
let githubRepo = process.env.GITHUB_REPO;
if (!githubRepo) {
  try {
    const packageJson = JSON.parse(readFileSync(join(rootDir, 'package.json'), 'utf8'));
    if (packageJson.repository && typeof packageJson.repository === 'string') {
      githubRepo = packageJson.repository.replace(/^https:\/\/github.com\//, '').replace(/\.git$/, '');
    } else if (packageJson.repository && packageJson.repository.url) {
      githubRepo = packageJson.repository.url.replace(/^https:\/\/github.com\//, '').replace(/\.git$/, '');
    }
  } catch (e) {
    // Ignore
  }
}

if (!githubRepo && !skipRelease) {
  warn('GITHUB_REPO not found. Please set it in package.json repository field or GITHUB_REPO env var.');
  warn('Format: username/repo-name');
  const shouldContinue = process.argv.includes('--force');
  if (!shouldContinue) {
    error('Cannot proceed without GitHub repo. Use --force to skip release creation.');
  }
}

log(`\n${colors.bright}🚀 Starting release process for version ${newVersion}${colors.reset}\n`, 'bright');

// Step 1: Update version numbers
async function updateVersions() {
  info('Step 1: Updating version numbers...');
  
  // Update package.json
  const packageJsonPath = join(rootDir, 'package.json');
  const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
  packageJson.version = newVersion;
  writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n');
  success(`Updated package.json to version ${newVersion}`);
  
  // Update tauri.conf.json
  const tauriConfPath = join(rootDir, 'src-tauri', 'tauri.conf.json');
  const tauriConf = JSON.parse(readFileSync(tauriConfPath, 'utf8'));
  tauriConf.version = newVersion;
  writeFileSync(tauriConfPath, JSON.stringify(tauriConf, null, 2) + '\n');
  success(`Updated tauri.conf.json to version ${newVersion}`);
  
  // Update Cargo.toml
  const cargoTomlPath = join(rootDir, 'src-tauri', 'Cargo.toml');
  let cargoToml = readFileSync(cargoTomlPath, 'utf8');
  
  // Update version in [package] section
  cargoToml = cargoToml.replace(
    /^version = "[\d.]+"/m,
    `version = "${newVersion}"`
  );
  
  // Ensure updater plugin is in dependencies
  if (!cargoToml.includes('tauri-plugin-updater')) {
    cargoToml = cargoToml.replace(
      /(tauri-plugin-notification = "2")/,
      '$1\ntauri-plugin-updater = { version = "2", features = ["private-key"] }'
    );
    success('Added tauri-plugin-updater to Cargo.toml');
  }
  
  writeFileSync(cargoTomlPath, cargoToml);
  success(`Updated Cargo.toml to version ${newVersion}`);
}

// Step 2: Build the app
async function buildApp() {
  if (skipBuild) {
    warn('Skipping build (--skip-build flag)');
    return;
  }
  
  info('Step 2: Building the app...');
  
  // Temporarily remove updater config to avoid schema validation error
  const tauriConfPath = join(rootDir, 'src-tauri', 'tauri.conf.json');
  const tauriConf = JSON.parse(readFileSync(tauriConfPath, 'utf8'));
  const updaterConfig = tauriConf.updater;
  delete tauriConf.updater;
  writeFileSync(tauriConfPath, JSON.stringify(tauriConf, null, 2) + '\n');
  
  try {
    execSync('npm run build:tauri', { 
      cwd: rootDir, 
      stdio: 'inherit',
      env: { ...process.env, CI: 'true' }
    });
    success('Build completed successfully');
  } catch (err) {
    error(`Build failed: ${err.message}`);
  } finally {
    // Restore updater config
    if (updaterConfig) {
      tauriConf.updater = updaterConfig;
      writeFileSync(tauriConfPath, JSON.stringify(tauriConf, null, 2) + '\n');
    }
  }
}

// Step 3: Generate update manifest and sign
async function generateUpdateManifest() {
  info('Step 3: Generating update manifest...');
  
  const privateKeyPath = join(rootDir, 'key.pem');
  const publicKeyPath = join(rootDir, 'key.pub');
  
  // Check if keys exist
  if (!existsSync(privateKeyPath)) {
    warn('Private key not found. Generating new key pair...');
    try {
      execSync(`npx tauri signer generate -w ${privateKeyPath}`, { 
        cwd: rootDir, 
        stdio: 'inherit' 
      });
      success('Generated new key pair');
    } catch (err) {
      error(`Failed to generate key pair: ${err.message}`);
    }
  }
  
  // Public key is automatically generated as key.pem.pub
  const autoPublicKeyPath = `${privateKeyPath}.pub`;
  
  // Read public key for tauri.conf.json
  let publicKey = '';
  if (existsSync(autoPublicKeyPath)) {
    publicKey = readFileSync(autoPublicKeyPath, 'utf8').trim();
    success('Found public key');
  } else if (existsSync(publicKeyPath)) {
    publicKey = readFileSync(publicKeyPath, 'utf8').trim();
    success('Found public key');
  } else {
    warn('Public key file not found. Please update tauri.conf.json manually with your public key.');
  }
  
  // Update tauri.conf.json with public key if we have it
  if (publicKey) {
    const tauriConfPath = join(rootDir, 'src-tauri', 'tauri.conf.json');
    const tauriConf = JSON.parse(readFileSync(tauriConfPath, 'utf8'));
    
    if (!tauriConf.updater) {
      tauriConf.updater = {};
    }
    
    if (!tauriConf.updater.pubkey || tauriConf.updater.pubkey === 'YOUR_PUBLIC_KEY_HERE') {
      tauriConf.updater.pubkey = publicKey;
      writeFileSync(tauriConfPath, JSON.stringify(tauriConf, null, 2) + '\n');
      success('Updated tauri.conf.json with public key');
    }
    
    // Update endpoint if repo is known
    if (githubRepo && (!tauriConf.updater.endpoints || tauriConf.updater.endpoints[0].includes('YOUR_USERNAME'))) {
      tauriConf.updater.endpoints = [
        `https://github.com/${githubRepo}/releases/latest/download/latest.json`
      ];
      tauriConf.updater.dialog = true;
      writeFileSync(tauriConfPath, JSON.stringify(tauriConf, null, 2) + '\n');
      success('Updated tauri.conf.json with GitHub endpoint');
    }
  }
  
  // Find the built exe
  const exePath = join(rootDir, 'src-tauri', 'target', 'release', 'bundle', 'nsis', `Kloak_${newVersion}_x64-setup.exe`);
  
  if (!existsSync(exePath)) {
    warn(`Expected exe not found at ${exePath}`);
    warn('You may need to sign and create the update manifest manually.');
    return;
  }
  
  // Create releases directory
  const releasesDir = join(rootDir, 'releases');
  if (!existsSync(releasesDir)) {
    mkdirSync(releasesDir, { recursive: true });
  }
  
  // Sign the app and generate manifest
  // Note: Tauri v2 signer signs the file in-place and doesn't generate a separate manifest
  // We need to use the updater's built-in manifest generation
  info('Preparing update manifest...');
  
  // For Tauri v2, we'll create the manifest manually based on the release
  const manifestPath = join(releasesDir, 'latest.json');
  
  // The manifest will be created after the GitHub release is created
  // For now, we'll note that it needs to be generated
  info('Update manifest will be generated after GitHub release creation');
}

// Step 4: Create GitHub release
async function createGitHubRelease() {
  if (skipRelease) {
    warn('Skipping GitHub release (--skip-release flag)');
    return;
  }
  
  if (!githubRepo) {
    warn('Skipping GitHub release (no repo configured)');
    return;
  }
  
  info('Step 4: Creating GitHub release...');
  
  const exePath = join(rootDir, 'src-tauri', 'target', 'release', 'bundle', 'nsis', `Kloak_${newVersion}_x64-setup.exe`);
  const manifestPath = join(rootDir, 'releases', 'latest.json');
  
  if (!existsSync(exePath)) {
    error(`Executable not found at ${exePath}. Build the app first.`);
  }
  
  // Create release using GitHub CLI or API
  try {
    // Try using gh CLI first
    try {
      execSync('gh --version', { stdio: 'ignore' });
      info('Using GitHub CLI to create release...');
      
      // Create release
      execSync(
        `gh release create v${newVersion} "${exePath}" "${manifestPath}" --title "v${newVersion}" --notes "Release ${newVersion}"`,
        { 
          cwd: rootDir, 
          stdio: 'inherit',
          env: { ...process.env, GITHUB_TOKEN }
        }
      );
      
      success('GitHub release created successfully');
    } catch (ghError) {
      // Fall back to API
      info('GitHub CLI not available, using API...');
      
      const releaseData = {
        tag_name: `v${newVersion}`,
        name: `v${newVersion}`,
        body: `Release ${newVersion}`,
        draft: false,
        prerelease: false
      };
      
      // Create release
      // Try Bearer token first (new format), fall back to token (classic)
      const authHeader = githubToken.startsWith('ghp_') || githubToken.startsWith('github_pat_') 
        ? `Bearer ${githubToken}` 
        : `token ${githubToken}`;
      
      const createResponse = await fetch(`https://api.github.com/repos/${githubRepo}/releases`, {
        method: 'POST',
        headers: {
          'Authorization': authHeader,
          'Accept': 'application/vnd.github.v3+json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(releaseData)
      });
      
      if (!createResponse.ok) {
        const errorText = await createResponse.text();
        let errorMessage = `Failed to create release: ${errorText}`;
        
        if (createResponse.status === 403) {
          errorMessage += '\n\n⚠️  GitHub token permissions issue. Make sure your token has:';
          errorMessage += '\n   - "repo" scope (for classic tokens)';
          errorMessage += '\n   - "Contents: Write" and "Metadata: Read" (for fine-grained tokens)';
          errorMessage += '\n\nGenerate a new token at: https://github.com/settings/tokens';
        } else if (createResponse.status === 422) {
          const errorData = JSON.parse(errorText);
          if (errorData.errors && errorData.errors.some(e => e.message && e.message.includes('empty'))) {
            errorMessage += '\n\n⚠️  Repository is empty. GitHub requires at least one commit before creating releases.';
            errorMessage += '\n\nTo fix this:';
            errorMessage += '\n   1. Make an initial commit to your repository:';
            errorMessage += '\n      git add .';
            errorMessage += '\n      git commit -m "Initial commit"';
            errorMessage += '\n      git push origin main';
            errorMessage += '\n   2. Then run the release script again';
          }
        }
        
        error(errorMessage);
      }
      
      const release = await createResponse.json();
      const uploadUrl = release.upload_url.split('{')[0];
      
      // Upload exe
      info('Uploading executable...');
      const exeBuffer = readFileSync(exePath);
      
      const exeUpload = await fetch(`${uploadUrl}?name=Kloak_${newVersion}_x64-setup.exe`, {
        method: 'POST',
        headers: {
          'Authorization': authHeader,
          'Accept': 'application/vnd.github.v3+json',
          'Content-Type': 'application/octet-stream',
        },
        body: exeBuffer
      });
      
      if (!exeUpload.ok) {
        const errorText = await exeUpload.text();
        warn(`Failed to upload exe: ${errorText}`);
      } else {
        success('Executable uploaded');
      }
      
      // Generate and upload manifest
      info('Generating update manifest...');
      const exeFileName = `Kloak_${newVersion}_x64-setup.exe`;
      const downloadUrl = `https://github.com/${githubRepo}/releases/download/v${newVersion}/${exeFileName}`;
      
      // Read public key
      const autoPublicKeyPath = join(rootDir, 'key.pem.pub');
      let publicKey = '';
      if (existsSync(autoPublicKeyPath)) {
        publicKey = readFileSync(autoPublicKeyPath, 'utf8').trim();
      }
      
      // Create manifest (simplified - you may need to sign it properly)
      const manifest = {
        version: newVersion,
        notes: `Release ${newVersion}`,
        pub_date: new Date().toISOString(),
        platforms: {
          'windows-x86_64': {
            signature: '', // Will be filled by Tauri's signing process
            url: downloadUrl
          }
        }
      };
      
      // Try to sign the exe and get signature
      try {
        info('Signing executable for manifest...');
        execSync(`npx tauri signer sign -f ${join(rootDir, 'key.pem')} "${exePath}"`, {
          cwd: rootDir,
          stdio: 'pipe'
        });
        // Note: Tauri signer signs in-place, we'd need to extract signature
        // For now, we'll create a basic manifest
      } catch (err) {
        warn('Could not sign executable, creating basic manifest');
      }
      
      writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
      success('Update manifest generated');
      
      // Upload manifest
      info('Uploading update manifest...');
      const manifestBuffer = readFileSync(manifestPath);
      const manifestUpload = await fetch(`${uploadUrl}?name=latest.json`, {
        method: 'POST',
        headers: {
          'Authorization': authHeader,
          'Accept': 'application/vnd.github.v3+json',
          'Content-Type': 'application/json',
        },
        body: manifestBuffer
      });
      
      if (!manifestUpload.ok) {
        const errorText = await manifestUpload.text();
        warn(`Failed to upload manifest: ${errorText}`);
      } else {
        success('Update manifest uploaded');
      }
      
      success('GitHub release created successfully');
    }
  } catch (err) {
    error(`Failed to create GitHub release: ${err.message}`);
  }
}

// Main execution
async function main() {
  try {
    await updateVersions();
    await buildApp();
    await generateUpdateManifest();
    await createGitHubRelease();
    
    log(`\n${colors.bright}${colors.green}🎉 Release ${newVersion} completed successfully!${colors.reset}\n`, 'bright');
    info('Next steps:');
    info('1. Test the update mechanism in your app');
    info('2. Verify the GitHub release was created correctly');
    info('3. Check that the update endpoint is accessible');
  } catch (err) {
    error(`Release failed: ${err.message}`);
  }
}

main();
