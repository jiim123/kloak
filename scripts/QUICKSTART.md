# Quick Start: Auto-Update Setup

## 1. Install Dependencies

```bash
npm install
```

This will install `@tauri-apps/plugin-updater` which is needed for updates.

## 2. Set Up GitHub Token

Create a GitHub personal access token:
1. Go to https://github.com/settings/tokens
2. Click "Generate new token (classic)"
3. Give it `repo` permissions
4. Copy the token

**Windows PowerShell:**
```powershell
$env:GITHUB_TOKEN="your_token_here"
```

**Windows CMD:**
```cmd
set GITHUB_TOKEN=your_token_here
```

**Linux/Mac:**
```bash
export GITHUB_TOKEN=your_token_here
```

## 3. Configure Repository

Add your repository to `package.json`:

```json
{
  "repository": "https://github.com/yourusername/yourrepo"
}
```

Or set it as an environment variable:
```bash
export GITHUB_REPO=yourusername/yourrepo
```

## 4. Make Your First Release

```bash
npm run release 1.0.0
```

The script will:
- ✅ Update all version numbers
- ✅ Build your app
- ✅ Generate signing keys (first time only)
- ✅ Sign the executable
- ✅ Create GitHub release
- ✅ Upload files

## 5. Add Update Check to Your App

In your main app component:

```tsx
import { useAppUpdater } from '@/hooks/useAppUpdater';
import { useEffect } from 'react';

function App() {
  const { updateInfo, checkUpdate, installUpdate } = useAppUpdater();

  useEffect(() => {
    // Check for updates on startup
    checkUpdate();
  }, []);

  // Show update notification if available
  if (updateInfo.available) {
    return (
      <div className="update-banner">
        <p>Update {updateInfo.version} is available!</p>
        <button onClick={installUpdate}>Install Now</button>
      </div>
    );
  }

  return <YourNormalApp />;
}
```

## That's It! 🎉

Your app will now automatically check for updates from GitHub releases.

## Next Release

Just run:
```bash
npm run release 1.0.1
```

The script handles everything automatically!

## Complete Release Workflow

For detailed step-by-step instructions, see [RELEASE_WORKFLOW.md](../RELEASE_WORKFLOW.md) in the project root.

## Troubleshooting

**"GITHUB_TOKEN not found"**
- Make sure you exported the token (see step 2)

**"GITHUB_REPO not found"**
- Add repository to package.json or set GITHUB_REPO env var

**Build fails**
- Make sure Rust is installed: `rustup --version`
- Run `npm ci` to install dependencies

**Update not working**
- Make sure `latest.json` is in the GitHub release
- Check that the endpoint URL in `tauri.conf.json` is correct
- Verify the public key matches your `key.pub` file
