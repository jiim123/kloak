#!/usr/bin/env node

/**
 * Check if repository is ready for releases
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');

const githubToken = process.env.GITHUB_TOKEN;
const githubRepo = process.env.GITHUB_REPO;

if (!githubToken) {
  console.error('❌ GITHUB_TOKEN not set');
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

const authHeader = githubToken.startsWith('ghp_') || githubToken.startsWith('github_pat_') 
  ? `Bearer ${githubToken}` 
  : `token ${githubToken}`;

console.log(`Checking repository: ${repo}\n`);

try {
  // Check if repo exists and has commits
  const repoResponse = await fetch(`https://api.github.com/repos/${repo}`, {
    headers: {
      'Authorization': authHeader,
      'Accept': 'application/vnd.github.v3+json',
    }
  });

  if (!repoResponse.ok) {
    const errorText = await repoResponse.text();
    console.error(`❌ Cannot access repository: ${errorText}`);
    process.exit(1);
  }

  const repoData = await repoResponse.json();
  console.log(`✅ Repository exists: ${repoData.full_name}`);
  console.log(`   Private: ${repoData.private}`);
  console.log(`   Default branch: ${repoData.default_branch}\n`);

  // Check if repo has commits
  const commitsResponse = await fetch(`https://api.github.com/repos/${repo}/commits?per_page=1`, {
    headers: {
      'Authorization': authHeader,
      'Accept': 'application/vnd.github.v3+json',
    }
  });

  if (commitsResponse.ok) {
    const commits = await commitsResponse.json();
    if (commits.length > 0) {
      console.log('✅ Repository has commits');
      console.log(`   Latest commit: ${commits[0].sha.substring(0, 7)} - ${commits[0].commit.message.split('\n')[0]}\n`);
      console.log('✅ Repository is ready for releases!\n');
    } else {
      console.log('❌ Repository is empty (no commits)');
      console.log('\n⚠️  GitHub requires at least one commit before creating releases.');
      console.log('\nTo fix this:');
      console.log('  1. Make an initial commit:');
      console.log('     git add .');
      console.log('     git commit -m "Initial commit"');
      console.log('     git push origin main');
      console.log('  2. Then run the release script again\n');
      process.exit(1);
    }
  } else {
    console.log('⚠️  Could not check commits, but repository exists');
  }

  // Check existing releases
  const releasesResponse = await fetch(`https://api.github.com/repos/${repo}/releases?per_page=1`, {
    headers: {
      'Authorization': authHeader,
      'Accept': 'application/vnd.github.v3+json',
    }
  });

  if (releasesResponse.ok) {
    const releases = await releasesResponse.json();
    if (releases.length > 0) {
      console.log(`ℹ️  Found ${releases.length} existing release(s)`);
      console.log(`   Latest: ${releases[0].tag_name}\n`);
    } else {
      console.log('ℹ️  No existing releases (this will be the first one)\n');
    }
  }

} catch (error) {
  console.error('❌ Error checking repository:', error.message);
  process.exit(1);
}
