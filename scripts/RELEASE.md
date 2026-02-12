# Release Process Guide

This guide explains how to use the automated release script to build and publish updates for the Kloak desktop app.

## Prerequisites

1. **GitHub Token**: Create a personal access token with `repo` permissions
   - Go to GitHub Settings → Developer settings → Personal access tokens → Tokens (classic)
   - Generate a new token with `repo` scope
   - Export it: `export GITHUB_TOKEN=your_token_here` (or set in your environment)

2. **GitHub Repository**: Make sure your `package.json` has the repository field set:
   ```json
   {
     "repository": "https://github.com/username/repo-name"
   }
   ```
   Or set it via environment variable: `export GITHUB_REPO=username/repo-name`

3. **Tauri CLI**: Make sure Tauri CLI is installed:
   ```bash
   npm install -g @tauri-apps/cli
   ```

4. **Signing Keys**: The script will generate these automatically on first run, or you can generate them manually:
   ```bash
   tauri signer generate -w key.pem
   ```

## Quick Start

### Basic Release

```bash
node scripts/release.js 1.0.0
```

This will:
1. ✅ Update version numbers in `package.json`, `tauri.conf.json`, and `Cargo.toml`
2. ✅ Build the app
3. ✅ Generate and sign the update manifest
4. ✅ Create a GitHub release
5. ✅ Upload the executable and manifest

### Options

- `--skip-build`: Skip the build step (useful if you already built)
- `--skip-release`: Skip GitHub release creation (useful for testing)

Examples:
```bash
# Just update versions and build, don't create release
node scripts/release.js 1.0.0 --skip-release

# Update versions and create release, but skip build
node scripts/release.js 1.0.0 --skip-build
```

## Step-by-Step Process

### 1. Update Version Numbers

The script automatically updates:
- `package.json` → `version`
- `src-tauri/tauri.conf.json` → `version`
- `src-tauri/Cargo.toml` → `version` in `[package]` section

### 2. Build the App

Runs `npm run build:tauri` which:
- Builds the frontend (`npm run build`)
- Compiles the Rust backend
- Bundles everything into an installer

The output will be at:
```
src-tauri/target/release/bundle/nsis/Kloak_<version>_x64-setup.exe
```

### 3. Generate Update Manifest

The script:
- Checks for signing keys (`key.pem` and `key.pub`)
- Generates keys if they don't exist
- Signs the executable
- Creates `releases/latest.json` manifest file
- Updates `tauri.conf.json` with the public key and GitHub endpoint

### 4. Create GitHub Release

The script creates a GitHub release with:
- Tag: `v<version>` (e.g., `v1.0.0`)
- Title: `v<version>`
- Uploads: The executable and `latest.json` manifest

## Update Endpoint Configuration

The update endpoint is automatically configured in `tauri.conf.json`:

```json
{
  "updater": {
    "active": true,
    "endpoints": [
      "https://github.com/username/repo/releases/latest/download/latest.json"
    ],
    "dialog": true,
    "pubkey": "your-public-key-here"
  }
}
```

The `latest.json` file must be uploaded to each release for updates to work.

## Using Updates in Your App

### Option 1: Use the Hook

```tsx
import { useAppUpdater } from '@/hooks/useAppUpdater';

function App() {
  const { updateInfo, checkUpdate, installUpdate, isInstalling } = useAppUpdater();

  useEffect(() => {
    // Check for updates on app start
    checkUpdate();
  }, []);

  if (updateInfo.available) {
    return (
      <div>
        <p>Update available: {updateInfo.version}</p>
        <button onClick={installUpdate} disabled={isInstalling}>
          {isInstalling ? 'Installing...' : 'Install Update'}
        </button>
      </div>
    );
  }

  return <YourApp />;
}
```

### Option 2: Manual Check

```tsx
import { check } from '@tauri-apps/plugin-updater';

async function handleUpdateCheck() {
  const update = await check();
  
  if (update?.available) {
    // Show update dialog
    const shouldUpdate = confirm(`Update ${update.version} is available. Install now?`);
    
    if (shouldUpdate) {
      await update.downloadAndInstall();
    }
  }
}
```

## Troubleshooting

### "GITHUB_TOKEN not found"
- Export your token: `export GITHUB_TOKEN=your_token`
- On Windows PowerShell: `$env:GITHUB_TOKEN="your_token"`
- On Windows CMD: `set GITHUB_TOKEN=your_token`

### "GITHUB_REPO not found"
- Add repository to `package.json`:
  ```json
  {
    "repository": "https://github.com/username/repo-name"
  }
  ```
- Or export: `export GITHUB_REPO=username/repo-name`

### Build fails
- Make sure Rust is installed: `rustup --version`
- Make sure all dependencies are installed: `npm ci`
- Check that the frontend builds: `npm run build`

### Signing fails
- Make sure `key.pem` exists in the project root
- Regenerate keys: `tauri signer generate -w key.pem`
- Extract public key: `tauri signer generate -w key.pem -r key.pub`

### Update not detected
- Verify `latest.json` is uploaded to the GitHub release
- Check that the endpoint URL in `tauri.conf.json` matches your repo
- Verify the public key in `tauri.conf.json` matches your `key.pub`
- Make sure the version in the app is lower than the release version

### GitHub release creation fails
- Verify your token has `repo` permissions
- Check that the repository exists and you have write access
- Try using GitHub CLI: `gh auth login` then `gh release create v1.0.0`

## Version Numbering

Use semantic versioning (SemVer):
- **MAJOR**: Breaking changes (1.0.0 → 2.0.0)
- **MINOR**: New features, backwards compatible (1.0.0 → 1.1.0)
- **PATCH**: Bug fixes (1.0.0 → 1.0.1)

Examples:
- `1.0.0` - First stable release
- `1.0.1` - Bug fix
- `1.1.0` - New feature
- `2.0.0` - Major update with breaking changes

## Security Notes

- **Never commit `key.pem`** to version control (it's in `.gitignore`)
- Keep your private key secure - if compromised, generate a new one
- The public key (`key.pub`) is safe to commit and share
- Each release must be signed with the same private key

## Automated Releases with GitHub Actions

You can also automate releases via GitHub Actions. See `.github/workflows/release.yml` (if it exists) for an example workflow that:
- Triggers on tag creation
- Builds the app
- Creates a release
- Uploads artifacts

## Need Help?

If you encounter issues:
1. Check the error message carefully
2. Verify all prerequisites are met
3. Check that versions are consistent across files
4. Ensure GitHub token has correct permissions
5. Verify the repository URL is correct
