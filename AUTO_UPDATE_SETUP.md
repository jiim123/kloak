# Auto-Update System Setup Complete! 🎉

I've set up a complete auto-update system for your Tauri desktop app. Here's what was created:

## What's Been Set Up

### 1. **Backend Configuration**
- ✅ Added `tauri-plugin-updater` to `Cargo.toml` (will be added automatically by release script)
- ✅ Added `tauri-plugin-updater` to `package.json` dependencies
- ✅ Configured updater in `src-tauri/tauri.conf.json` (with placeholders that will be auto-filled)
- ✅ Added updater plugin initialization in `src-tauri/src/lib.rs`

### 2. **Release Automation Script**
- ✅ `scripts/release.js` - Complete automation script that:
  - Updates version numbers across all files
  - Builds the app
  - Generates signing keys (if needed)
  - Signs the executable
  - Creates GitHub release
  - Uploads files

### 3. **Frontend Integration**
- ✅ `src/hooks/useAppUpdater.ts` - React hook for checking/installing updates
- ✅ `src/components/UpdateNotification.tsx` - Example UI component

### 4. **Documentation**
- ✅ `scripts/RELEASE.md` - Complete release guide
- ✅ `scripts/QUICKSTART.md` - Quick start guide
- ✅ Updated `.gitignore` to exclude signing keys

### 5. **Package Scripts**
- ✅ Added `npm run release` command

## Quick Start

### Step 1: Install Dependencies
```bash
npm install
```

### Step 2: Set GitHub Token
**Windows PowerShell:**
```powershell
$env:GITHUB_TOKEN="your_github_token_here"
```

**Linux/Mac:**
```bash
export GITHUB_TOKEN=your_github_token_here
```

Get a token from: https://github.com/settings/tokens (needs `repo` scope)

### Step 3: Configure Repository
Add to `package.json`:
```json
{
  "repository": "https://github.com/yourusername/yourrepo"
}
```

### Step 4: Make Your First Release
```bash
npm run release 1.0.0
```

That's it! The script handles everything:
- Updates versions
- Builds the app
- Generates keys (first time)
- Signs the app
- Creates GitHub release
- Uploads files

## Using Updates in Your App

Add the update notification component to your app:

```tsx
import { UpdateNotification } from '@/components/UpdateNotification';

function App() {
  return (
    <>
      <YourApp />
      <UpdateNotification />
    </>
  );
}
```

Or use the hook directly:

```tsx
import { useAppUpdater } from '@/hooks/useAppUpdater';

function MyComponent() {
  const { updateInfo, checkUpdate, installUpdate } = useAppUpdater();
  
  useEffect(() => {
    checkUpdate();
  }, []);
  
  // ... your UI
}
```

## How It Works

1. **Release Process:**
   - Run `npm run release 1.0.0`
   - Script updates all version numbers
   - Builds the app
   - Signs the executable
   - Creates `latest.json` manifest
   - Creates GitHub release
   - Uploads exe and manifest

2. **Update Check:**
   - App checks `https://github.com/yourrepo/releases/latest/download/latest.json`
   - Compares version with current app version
   - Shows update dialog if newer version available
   - Downloads and installs update when user confirms

3. **Security:**
   - All releases are cryptographically signed
   - Public key is embedded in app config
   - Private key stays on your machine (never committed)

## Important Notes

1. **Signing Keys:**
   - Generated automatically on first release
   - Stored in `key.pem` (private) and `key.pub` (public)
   - **NEVER commit `key.pem`** (already in `.gitignore`)
   - Keep `key.pem` secure - if lost, you'll need to generate new keys

2. **Version Numbers:**
   - Use semantic versioning: `1.0.0`, `1.0.1`, `1.1.0`, etc.
   - Script automatically updates:
     - `package.json`
     - `tauri.conf.json`
     - `Cargo.toml`

3. **GitHub Releases:**
   - Each release must include `latest.json` file
   - The script uploads it automatically
   - Endpoint URL is auto-configured in `tauri.conf.json`

## Next Steps

1. **First Release:**
   ```bash
   npm run release 1.0.0
   ```

2. **Test Updates:**
   - Install version 1.0.0
   - Create a new release: `npm run release 1.0.1`
   - Open the app - it should detect the update

3. **Customize UI:**
   - Edit `src/components/UpdateNotification.tsx` to match your design
   - Or build your own using `useAppUpdater` hook

## Troubleshooting

**"GITHUB_TOKEN not found"**
- Export your token (see Step 2 above)

**"GITHUB_REPO not found"**
- Add repository to `package.json` or set `GITHUB_REPO` env var

**Build fails**
- Make sure Rust is installed: `rustup --version`
- Run `npm ci` to install dependencies

**Update not detected**
- Verify `latest.json` is in the GitHub release
- Check endpoint URL in `tauri.conf.json`
- Make sure app version is lower than release version

## Files Created/Modified

- ✅ `scripts/release.js` - Main release script
- ✅ `scripts/RELEASE.md` - Detailed documentation
- ✅ `scripts/QUICKSTART.md` - Quick start guide
- ✅ `src/hooks/useAppUpdater.ts` - React hook
- ✅ `src/components/UpdateNotification.tsx` - UI component
- ✅ `package.json` - Added release script and updater plugin
- ✅ `src-tauri/Cargo.toml` - Will be updated by release script
- ✅ `src-tauri/tauri.conf.json` - Updater configuration
- ✅ `src-tauri/src/lib.rs` - Plugin initialization
- ✅ `.gitignore` - Excludes signing keys

## Need Help?

See `scripts/RELEASE.md` for detailed documentation and troubleshooting.

Happy releasing! 🚀
