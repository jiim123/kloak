#!/usr/bin/env node

/**
 * Quick script to test GitHub token permissions
 */

const githubToken = process.env.GITHUB_TOKEN;
const githubRepo = process.env.GITHUB_REPO || 'kloakapp/kloak-clients';

if (!githubToken) {
  console.error('❌ GITHUB_TOKEN environment variable is not set');
  console.log('\nTo set it:');
  console.log('  PowerShell: $env:GITHUB_TOKEN="your_token"');
  console.log('  CMD: set GITHUB_TOKEN=your_token');
  process.exit(1);
}

console.log('✅ GITHUB_TOKEN is set');
console.log(`   Token starts with: ${githubToken.substring(0, 10)}...`);
console.log(`   Token length: ${githubToken.length} characters`);
console.log(`   Repository: ${githubRepo}\n`);

// Test token by checking repo access
const authHeader = githubToken.startsWith('ghp_') || githubToken.startsWith('github_pat_') 
  ? `Bearer ${githubToken}` 
  : `token ${githubToken}`;

console.log('Testing token permissions...\n');

fetch(`https://api.github.com/repos/${githubRepo}`, {
  headers: {
    'Authorization': authHeader,
    'Accept': 'application/vnd.github.v3+json',
  }
})
  .then(async (response) => {
    if (response.ok) {
      const repo = await response.json();
      console.log('✅ Token has access to repository!');
      console.log(`   Repository: ${repo.full_name}`);
      console.log(`   Private: ${repo.private}`);
      console.log(`   Permissions: ${JSON.stringify(repo.permissions, null, 2)}\n`);
      
      // Test releases endpoint
      console.log('Testing releases endpoint...');
      const releasesResponse = await fetch(`https://api.github.com/repos/${githubRepo}/releases`, {
        headers: {
          'Authorization': authHeader,
          'Accept': 'application/vnd.github.v3+json',
        }
      });
      
      if (releasesResponse.ok) {
        console.log('✅ Token can access releases endpoint!\n');
        console.log('🎉 Your token is configured correctly!');
      } else {
        const errorText = await releasesResponse.text();
        console.log(`❌ Cannot access releases: ${errorText}\n`);
        console.log('⚠️  Token may need "repo" scope or "Contents: Write" permission');
      }
    } else {
      const errorText = await response.text();
      console.log(`❌ Token does not have access: ${errorText}\n`);
      
      if (response.status === 403) {
        console.log('⚠️  403 Forbidden - Check token permissions:');
        console.log('   1. Go to https://github.com/settings/tokens');
        console.log('   2. Make sure token has "repo" scope (classic)');
        console.log('   3. Or "Contents: Write" + "Metadata: Read" (fine-grained)');
        console.log('   4. If repo is private, ensure token has access to it');
      } else if (response.status === 404) {
        console.log('⚠️  404 Not Found - Repository might not exist or token has no access');
      }
    }
  })
  .catch((error) => {
    console.error('❌ Error testing token:', error.message);
  });
