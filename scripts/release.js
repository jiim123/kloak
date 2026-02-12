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

import { readFileSync, writeFileSync, existsSync, mkdirSync, unlinkSync } from 'fs';
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

function info(message) {
  log(`ℹ️  ${message}`, 'blue');
}

function success(message) {
  log(`✅ ${message}`, 'green');
}

function warn(message) {
  log(`⚠️  ${message}`, 'yellow');
}

function error(message) {
  log(`❌ ${message}`, 'red');
}

// Parse command line arguments
const args = process.argv.slice(2);
const versionArg = args.find(arg => /^\d+\.\d+\.\d+/.test(arg));
const newVersion = versionArg || '1.0.1';
const skipBuild = args.includes('--skip-build');
const skipRelease = args.includes('--skip-release');

if (!versionArg) {
  warn(`No version specified, using ${newVersion}`);
  warn('Usage: npm run release <version>');
  warn('Example: npm run release 1.0.0');
}

// Check for GitHub token
const githubToken = process.env.GITHUB_TOKEN;
if (!githubToken && !skipRelease) {
  error('GITHUB_TOKEN environment variable is required.');
  error('Set it with: $env:GITHUB_TOKEN="your_token" (PowerShell) or export GITHUB_TOKEN="your_token" (bash)');
  process.exit(1);
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

// Step 1.5: Setup updater configuration (before build so it's in the bundle)
async function setupUpdaterConfig() {
  info('Step 1.5: Setting up updater configuration...');
  
  const privateKeyPath = join(rootDir, 'key.pem');
  const publicKeyPath = join(rootDir, 'key.pub');
  const autoPublicKeyPath = `${privateKeyPath}.pub`;
  
  // Check if keys exist, generate if needed
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
      return;
    }
  }
  
  // Read public key
  let publicKey = '';
  if (existsSync(autoPublicKeyPath)) {
    publicKey = readFileSync(autoPublicKeyPath, 'utf8').trim();
  } else if (existsSync(publicKeyPath)) {
    publicKey = readFileSync(publicKeyPath, 'utf8').trim();
  }
  
  if (!publicKey) {
    warn('Public key not found. Updater will not work without a public key.');
    return;
  }
  
  // Update tauri.conf.json with updater config
  const tauriConfPath = join(rootDir, 'src-tauri', 'tauri.conf.json');
  const tauriConf = JSON.parse(readFileSync(tauriConfPath, 'utf8'));
  
  // In Tauri 2.x, updater config goes under plugins.updater
  if (!tauriConf.plugins) {
    tauriConf.plugins = {};
  }
  if (!tauriConf.plugins.updater) {
    tauriConf.plugins.updater = {};
  }
  
  // Set public key
  tauriConf.plugins.updater.pubkey = publicKey;
  
  // Set endpoint if repo is known
  if (githubRepo) {
    tauriConf.plugins.updater.endpoints = [
      `https://github.com/${githubRepo}/releases/latest/download/latest.json`
    ];
  }
  
  // Disable dialog (we handle updates via UI button)
  tauriConf.plugins.updater.dialog = false;
  
  writeFileSync(tauriConfPath, JSON.stringify(tauriConf, null, 2) + '\n');
  success('Updated tauri.conf.json with updater configuration');
}

// Step 2: Build the app
async function buildApp() {
  if (skipBuild) {
    warn('Skipping build (--skip-build flag)');
    return;
  }
  
  info('Step 2: Building the app...');
  
  // Build frontend first
  execSync('npm run build', { 
    cwd: rootDir, 
    stdio: 'inherit'
  });
  
  const tauriConfPath = join(rootDir, 'src-tauri', 'tauri.conf.json');
  const tauriConf = JSON.parse(readFileSync(tauriConfPath, 'utf8'));
  // In Tauri 2.x, updater config is under plugins.updater
  const updaterConfig = tauriConf.plugins?.updater || tauriConf.updater;
  const hadSchema = !!tauriConf.$schema;
  
  if (!updaterConfig) {
    error('CRITICAL: No updater config found!');
    error('Updater is REQUIRED for releases. The build will fail.');
    error('Expected config at: plugins.updater or updater (root level)');
    throw new Error('Updater config is required but missing');
  }
  
  // In Tauri 2.x, updater config must be under plugins.updater (not root level)
  // Now that config is in the correct location, we can build normally
  
  info('Building with updater config (located at plugins.updater)...');
  
  // Remove $schema to reduce validation strictness (optional)
  if (hadSchema) {
    delete tauriConf.$schema;
    writeFileSync(tauriConfPath, JSON.stringify(tauriConf, null, 2) + '\n');
  }
  
  try {
    // Build frontend
    info('Building frontend...');
    execSync('npm run build', { 
      cwd: rootDir, 
      stdio: 'inherit'
    });
    
    // Build with updater - updater is now always compiled (not optional)
    info('Building Tauri app with updater support...');
    
    // Set signing key for build (Tauri will create .sig file if key is set)
    const privateKeyPath = join(rootDir, 'key.pem');
    const buildEnv = { ...process.env, CI: 'true' };
    
    if (existsSync(privateKeyPath)) {
      // Read private key and set as environment variable for Tauri build
      const privateKey = readFileSync(privateKeyPath, 'utf8');
      buildEnv.TAURI_SIGNING_PRIVATE_KEY = privateKey;
      info('Signing key found - Tauri will create .sig file during build');
    } else {
      warn('No key.pem found. Build will proceed without signing.');
      warn('Update installation will fail without a valid signature.');
    }
    
    execSync('npm run build:tauri', { 
      cwd: rootDir, 
      stdio: 'inherit',
      env: buildEnv
    });
    
    success('✅ Build completed successfully with updater support!');
  } catch (err) {
    // Restore schema on error
    if (hadSchema) {
      const finalConf = JSON.parse(readFileSync(tauriConfPath, 'utf8'));
      if (!finalConf.$schema) {
        finalConf.$schema = 'https://schema.tauri.app/config/2';
        writeFileSync(tauriConfPath, JSON.stringify(finalConf, null, 2) + '\n');
      }
    }
    error(`Build failed: ${err.message}`);
    throw err;
  } finally {
    // Always restore schema
    if (hadSchema) {
      const finalConf = JSON.parse(readFileSync(tauriConfPath, 'utf8'));
      if (!finalConf.$schema) {
        finalConf.$schema = 'https://schema.tauri.app/config/2';
        writeFileSync(tauriConfPath, JSON.stringify(finalConf, null, 2) + '\n');
      }
    }
  }
  
  // Verify updater config is present
  const finalConf = JSON.parse(readFileSync(tauriConfPath, 'utf8'));
  if (!finalConf.plugins?.updater && !finalConf.updater) {
    error('CRITICAL: Updater config was lost!');
    throw new Error('Updater config missing after build');
  }
  
  success('✅ Updater config verified');
  success('✅ Updater feature enabled - updates will work!');
  
  // Verify bundle config files have updater config
  if (updaterConfig) {
    const bundleConfigPaths = [
      join(rootDir, 'src-tauri', 'target', 'release', 'bundle', 'tauri.conf.json'),
      join(rootDir, 'src-tauri', 'target', 'release', 'bundle', 'nsis', 'tauri.conf.json'),
      join(rootDir, 'src-tauri', 'target', 'release', 'bundle', 'msi', 'tauri.conf.json'),
    ];
    
    for (const bundleConfigPath of bundleConfigPaths) {
      if (existsSync(bundleConfigPath)) {
        try {
          const bundleConfig = JSON.parse(readFileSync(bundleConfigPath, 'utf8'));
          // Ensure plugins section exists
          if (!bundleConfig.plugins) {
            bundleConfig.plugins = {};
          }
          bundleConfig.plugins.updater = updaterConfig;
          writeFileSync(bundleConfigPath, JSON.stringify(bundleConfig, null, 2) + '\n');
          success(`Verified updater config in bundle at ${bundleConfigPath}`);
        } catch (err) {
          // Ignore - not all bundle types have config files
        }
      }
    }
  }
}

// Step 3: Generate update manifest and sign
async function generateUpdateManifest() {
  info('Step 3: Generating update manifest...');
  
  // Note: Updater config is now set up in setupUpdaterConfig() before build
  // This function just generates the manifest file
}

// Step 4: Create GitHub release
async function createGitHubRelease() {
  if (skipRelease) {
    warn('Skipping release creation (--skip-release flag)');
    return;
  }
  
  if (!githubRepo) {
    warn('No GitHub repo configured. Skipping release creation.');
    return;
  }
  
  info('Step 4: Creating GitHub release...');
  
  const exePath = join(rootDir, 'src-tauri', 'target', 'release', 'bundle', 'nsis', `Kloak_${newVersion}_x64-setup.exe`);
  
  if (!existsSync(exePath)) {
    warn(`Expected exe not found at ${exePath}`);
    warn('You may need to sign and create the update manifest manually.');
    return;
  }
  
  const authHeader = githubToken.startsWith('Bearer ') 
    ? githubToken 
    : `Bearer ${githubToken}`;
  
  // Check if release already exists
  try {
    const checkResponse = await fetch(`https://api.github.com/repos/${githubRepo}/releases/tags/v${newVersion}`, {
      headers: {
        'Authorization': authHeader,
        'Accept': 'application/vnd.github.v3+json',
      },
    });
    
    if (checkResponse.ok) {
      warn(`Release v${newVersion} already exists. Skipping creation.`);
      return;
    }
  } catch (err) {
    // Ignore - release doesn't exist, we'll create it
  }
  
  // Create release
  try {
    const createResponse = await fetch(`https://api.github.com/repos/${githubRepo}/releases`, {
      method: 'POST',
      headers: {
        'Authorization': authHeader,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        tag_name: `v${newVersion}`,
        name: `v${newVersion}`,
        body: `Release ${newVersion}`,
        draft: false,
        prerelease: false,
      }),
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
    
    // Check for .sig file (Tauri creates this during build if TAURI_SIGNING_PRIVATE_KEY is set)
    const sigPath = `${exePath}.sig`;
    let signature = '';
    
    if (existsSync(sigPath)) {
      info('Found .sig file, extracting signature...');
      try {
        // Read the .sig file - it contains the minisign signature
        const sigContent = readFileSync(sigPath, 'utf8');
        // The signature is the content of the .sig file (base64 encoded minisign signature)
        signature = sigContent.trim();
        success('Signature extracted from .sig file');
      } catch (err) {
        warn(`Failed to read .sig file: ${err.message}`);
      }
    } else {
      // Try to sign the exe if .sig doesn't exist
      const privateKeyPath = join(rootDir, 'key.pem');
      if (existsSync(privateKeyPath)) {
        try {
          info('Signing executable...');
          execSync(`npx tauri signer sign -f "${privateKeyPath}" "${exePath}"`, {
            cwd: rootDir,
            stdio: 'pipe'
          });
          
          // Check again for .sig file after signing
          if (existsSync(sigPath)) {
            signature = readFileSync(sigPath, 'utf8').trim();
            success('Signature extracted after signing');
          } else {
            warn('No .sig file created after signing. Signature will be empty.');
          }
        } catch (err) {
          warn(`Could not sign executable: ${err.message}`);
          warn('Update installation will fail without a valid signature.');
        }
      } else {
        warn('No key.pem found. Cannot sign executable.');
        warn('Update installation will fail without a valid signature.');
      }
    }
    
    // Create manifest with signature
    const manifest = {
      version: newVersion,
      notes: `Release ${newVersion}`,
      pub_date: new Date().toISOString(),
      platforms: {
        'windows-x86_64': {
          signature: signature,
          url: downloadUrl
        }
      }
    };
    
    // Upload .sig file if it exists
    if (existsSync(sigPath)) {
      info('Uploading signature file...');
      const sigBuffer = readFileSync(sigPath);
      const sigFileName = `${exeFileName}.sig`;
      const sigUpload = await fetch(`${uploadUrl}?name=${sigFileName}`, {
        method: 'POST',
        headers: {
          'Authorization': authHeader,
          'Accept': 'application/vnd.github.v3+json',
          'Content-Type': 'application/octet-stream',
        },
        body: sigBuffer
      });
      
      if (!sigUpload.ok) {
        const errorText = await sigUpload.text();
        warn(`Failed to upload .sig file: ${errorText}`);
      } else {
        success('Signature file (.sig) uploaded');
      }
    } else {
      warn('No .sig file to upload. Update installation may fail.');
    }
    
    // Write manifest to releases directory
    const releasesDir = join(rootDir, 'releases');
    if (!existsSync(releasesDir)) {
      mkdirSync(releasesDir, { recursive: true });
    }
    
    const manifestPath = join(releasesDir, 'latest.json');
    writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
    success(`Update manifest written to ${manifestPath}`);
    
    // Upload manifest
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
    
    success(`Release v${newVersion} created successfully!`);
    info(`Download URL: https://github.com/${githubRepo}/releases/download/v${newVersion}/${exeFileName}`);
    
  } catch (err) {
    error(`Failed to create release: ${err.message}`);
    throw err;
  }
}

// Main execution
async function main() {
  try {
    await updateVersions();
    await setupUpdaterConfig();
    await buildApp();
    await generateUpdateManifest();
    await createGitHubRelease();
    
    log(`\n${colors.bright}${colors.green}🎉 Release ${newVersion} completed successfully!${colors.reset}\n`, 'bright');
    info('Next steps:');
    info('  1. Test the release build');
    info('  2. Verify the update manifest is correct');
    info('  3. Distribute the release to users');
  } catch (err) {
    error(`Release failed: ${err.message}`);
    process.exit(1);
  }
}

main();
