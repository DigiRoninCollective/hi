# GitHub Actions - Cross-Platform Desktop Builds

## Overview

This GitHub Actions workflow automates building the PumpLauncher desktop app for macOS, Windows, and Linux.

## How It Works

### Trigger Events

**Option 1: Version Tag (Recommended)**
```bash
# Create a version tag to trigger builds and auto-create releases
git tag v1.0.1
git push origin v1.0.1
```

Builds will run automatically and create a GitHub release with all artifacts.

**Option 2: Manual Trigger**
Go to GitHub → Actions → "Build Desktop App" → "Run workflow"

This builds all platforms without creating a release.

## Build Jobs

### macOS (Parallel Architecture Builds)
```
Runner: macos-latest
Architectures: x64 (Intel) + arm64 (Apple Silicon)
Output: PumpLauncher-1.0.0.dmg (both architectures)
Time: ~10-15 minutes per architecture
```

### Windows
```
Runner: windows-latest
Architecture: x64
Output: PumpLauncher-1.0.0.exe (NSIS installer)
Time: ~10-15 minutes
```

### Linux
```
Runner: ubuntu-latest
Architecture: x64
Output: PumpLauncher-1.0.0.AppImage
Dependencies: libsecret-1-dev (installed automatically)
Time: ~10-15 minutes
```

## What Gets Built

Each job:
1. Checks out code
2. Installs Node.js 20
3. Installs npm dependencies
4. Builds web app (`npm run build`)
5. Builds desktop app for platform

## Artifacts

All built files are:
- **Uploaded to GitHub Actions** (30-day retention)
- **Released to GitHub Releases** (if triggered by version tag)
- **Ready to download and distribute**

### Download Artifacts

After build completes:

1. **From Actions tab**
   - Go to GitHub → Actions → Latest workflow run
   - Download artifact ZIP files

2. **From Releases tab** (if tag-triggered)
   - Go to GitHub → Releases → Latest release
   - Download .dmg, .exe, .AppImage files

## Version Tags

When you want to release a new version:

```bash
# 1. Update version in package.json
# 2. Commit changes
git add package.json
git commit -m "chore: bump version to 1.0.1"

# 3. Create version tag
git tag v1.0.1

# 4. Push to GitHub
git push origin main
git push origin v1.0.1
```

The workflow will:
- Build for all platforms
- Create a GitHub release
- Attach all artifacts
- You can add release notes in GitHub UI

## Monitoring Builds

### View Build Progress

1. Go to GitHub repository
2. Click "Actions" tab
3. Click "Build Desktop App" workflow
4. Click the latest run
5. See real-time progress

### View Build Logs

Click on each job to see:
- Installation progress
- Build output
- Any errors or warnings

## Troubleshooting

### Build Fails

Check the logs:
1. Actions → "Build Desktop App"
2. Click failed workflow run
3. Click failed job
4. Scroll to see error messages

### Common Issues

**Missing dependencies**
```
Error: libsecret-1-dev not found (Linux)
Solution: Already included in workflow
```

**Node version mismatch**
```
Solution: Workflow uses Node 20 (latest LTS)
```

**Artifact not found**
```
Solution: Check if build completed successfully
Builds take 10-15 minutes per platform
```

## Manual Local Builds

If you need to build locally:

```bash
# macOS
npm run desktop:pack -- --mac

# Windows (on Windows machine)
npm run desktop:pack -- --win

# Linux (on Linux machine)
npm run desktop:pack -- --linux
```

## Customization

### Change Node Version

Edit `.github/workflows/build-desktop.yml`:
```yaml
- name: Setup Node.js
  uses: actions/setup-node@v3
  with:
    node-version: '20'  # Change here
```

### Change Retention Period

Edit `.github/workflows/build-desktop.yml`:
```yaml
retention-days: 30  # Change to 7, 14, 90, etc.
```

### Add More Platforms

Add new job section:
```yaml
build-macos-arm64:
  runs-on: macos-latest-xlarge
  steps:
    # Similar to build-macos but with arm64 specific steps
```

## Security

- ✅ GitHub Actions runs in isolated containers
- ✅ No secrets needed for building (only for releases)
- ✅ Artifacts auto-deleted after retention period
- ✅ All builds are reproducible
- ✅ Code reviewed before each tag

## First-Time Setup

1. Make sure you have push access to the repo
2. First tag: `git tag v1.0.0 && git push origin v1.0.0`
3. Go to GitHub → Actions to see workflow run
4. Download artifacts or access release

## Release Workflow

```
Local Development
    ↓
Tag version (git tag v1.0.x)
    ↓
Push to GitHub (git push origin v1.0.x)
    ↓
GitHub Actions triggers automatically
    ↓
Builds all platforms (parallel)
    ↓
Creates GitHub Release
    ↓
Artifacts available for download
    ↓
Users download and install
```

## Time Estimates

Total build time (all platforms):
- **Parallel builds**: ~15 minutes (longest job)
- **Sequential**: ~45 minutes (if one at a time)

Per platform:
- macOS x64: ~10 min
- macOS arm64: ~10 min
- Windows: ~10 min
- Linux: ~10 min

## Tips

1. **Use version tags** for releases
2. **Check Actions tab** for build progress
3. **Download artifacts** from Actions or Releases
4. **Keep releases organized** with version numbers
5. **Document changes** in release notes

## Example: Releasing v1.0.1

```bash
# 1. Update version
sed -i '' 's/"version": "1.0.0"/"version": "1.0.1"/' package.json

# 2. Commit
git add package.json
git commit -m "chore: bump version to 1.0.1"

# 3. Tag
git tag v1.0.1

# 4. Push
git push origin main
git push origin v1.0.1

# 5. Wait for builds (~15 minutes)

# 6. Go to GitHub Releases to download or add release notes
```

## Support

If builds fail:
1. Check the build logs in Actions tab
2. Verify package.json has correct version
3. Ensure all dependencies are listed in package.json
4. Check that code compiles locally (`npm run build`)

For questions, refer to:
- `.github/workflows/build-desktop.yml` - Workflow configuration
- `package.json` - Build scripts and dependencies
- GitHub Actions documentation - Official docs

---

**Status**: Ready to use
**Last Updated**: November 24, 2025
