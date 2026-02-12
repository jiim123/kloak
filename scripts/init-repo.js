#!/usr/bin/env node

/**
 * Initialize the releases repository with a minimal README
 * This allows creating releases without publishing the full source code
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');

const githubToken = process.env.GITHUB_TOKEN;
const githubRepo = process.env.GITHUB_REPO;

if (!githubToken) {
  console.error('❌ GITHUB_TOKEN environment variable is required');
  process.exit(1);
}

// Get repo from package.json if not in env
let repo = githubRepo;
if (!repo) {
  try {
    const packageJson = JSON.parse(readFileSync(join(rootDir, 'package.json'), 'utf8'));
    if (packageJson.repository && typeof packageJson.repository === 'string') {
      repo = packageJson.repository.replace(/^https:\/\/github.com\//, '').replace(/\.git$/, '');
    } else if (packageJson.repository && packageJson.repository.url) {
      repo = packageJson.repository.url.replace(/^https:\/\/github.com\//, '').replace(/\.git$/, '');
    }
  } catch (e) {
    console.error('❌ Could not determine repository');
    process.exit(1);
  }
}

console.log(`Initializing repository: ${repo}\n`);

// Create a simple README
const readmeContent = `# Kloak Desktop App Releases

This repository contains release artifacts for the Kloak desktop application.

## Downloads

Visit the [Releases](https://github.com/${repo}/releases) page to download the latest version.

## Auto-Updates

The Kloak desktop app automatically checks for updates. When a new version is available, you'll be notified and can install it directly from within the app.

## Manual Installation

1. Go to the [Releases](https://github.com/${repo}/releases) page
2. Download the latest installer for your platform
3. Run the installer

## Support

For issues, feature requests, or questions, please visit the main Kloak repository.
`;

const readmePath = join(rootDir, 'README.md');

// Check if we're in a git repo
const isGitRepo = existsSync(join(rootDir, '.git'));

if (!isGitRepo) {
  console.log('⚠️  Not a git repository. Creating README.md file...');
  writeFileSync(readmePath, readmeContent);
  console.log('✅ README.md created');
  console.log('\nNext steps:');
  console.log('  1. Initialize git: git init');
  console.log('  2. Add remote: git remote add origin https://github.com/' + repo + '.git');
  console.log('  3. Add and commit: git add README.md && git commit -m "Initial commit"');
  console.log('  4. Push: git push -u origin main');
  console.log('\nOr run this script from the releases repository directory.');
  process.exit(0);
}

// Check if README exists
if (existsSync(readmePath)) {
  console.log('ℹ️  README.md already exists');
} else {
  writeFileSync(readmePath, readmeContent);
  console.log('✅ Created README.md');
}

// Check git status
try {
  const status = execSync('git status --porcelain', { cwd: rootDir, encoding: 'utf8' });
  
  if (status.trim()) {
    console.log('\n📝 Uncommitted changes detected:');
    console.log(status);
    console.log('\nTo commit and push:');
    console.log('  git add README.md');
    console.log('  git commit -m "Add README"');
    console.log('  git push origin main');
  } else {
    // Check if we need to push
    try {
      execSync('git log origin/main..HEAD', { cwd: rootDir, stdio: 'ignore' });
      console.log('\n✅ Local commits ready to push');
      console.log('  Run: git push origin main');
    } catch (e) {
      // Check if repo has any commits
      try {
        const commitCount = execSync('git rev-list --count HEAD', { cwd: rootDir, encoding: 'utf8' }).trim();
        if (commitCount === '0') {
          console.log('\n⚠️  Repository has no commits');
          console.log('  Run: git add README.md && git commit -m "Initial commit" && git push -u origin main');
        } else {
          console.log('\n✅ Repository is initialized and ready for releases!');
        }
      } catch (err) {
        console.log('\n✅ Repository appears to be ready');
      }
    }
  }
} catch (error) {
  console.log('\n⚠️  Could not check git status');
  console.log('  Make sure you have git installed and the repository is initialized');
}
