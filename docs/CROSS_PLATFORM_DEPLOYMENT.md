# Cross-Platform Deployment Strategy

## Current Situation
- ✅ macOS: Building native .dmg (in progress)
- ⚠️ Windows: Needs MSVC build tools (not on this Mac)
- ⚠️ Linux: Needs proper environment setup

## Solution: Remote Build Servers

### Option 1: GitHub Actions (Recommended) ✅
**Best for:** Free, automatic, multi-platform

```yaml
# .github/workflows/build-desktop.yml
name: Build Desktop App

on:
  push:
    tags:
      - 'v*'

jobs:
  build:
    strategy:
      matrix:
        os: [macos-latest, windows-latest, ubuntu-latest]
    runs-on: ${{ matrix.os }}

    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: 20

      - name: Install dependencies
        run: npm install

      - name: Build web
        run: npm run build:web

      - name: Build desktop
        run: npm run desktop:pack

      - name: Upload artifacts
        uses: actions/upload-artifact@v3
        with:
          name: release-${{ matrix.os }}
          path: dist/
```

**Pros:**
- Free tier available
- Multi-platform support
- Automatic on tag push
- No local setup needed

**Cons:**
- Limited free minutes (2000/month)
- Slower than local builds

### Option 2: Electron-Builder with Docker
**Best for:** Full control, reproducible builds

```bash
# Build in Docker
docker run --rm -v $(pwd):/app \
  -w /app \
  electronuserland/builder:wine \
  npm run desktop:pack
```

**Pros:**
- Works locally or in CI/CD
- Reproducible across platforms
- No cross-compilation needed

**Cons:**
- Requires Docker
- Larger initial setup

### Option 3: Cloud Build Services
**Options:**
- **CircleCI** - Native Electron support
- **Cirrus CI** - Free Windows/Linux builds
- **Appveyor** - Windows-specific

---

## Multi-Platform Token Keypair Loading Feature

### User Story
> As a Windows/Linux user, I want to load my token keypair from a JSON file instead of using .env

### Implementation

#### 1. Keypair JSON Format
```json
{
  "version": "1.0.0",
  "type": "solana-keypair",
  "publicKey": "FF1MahKk4eMNw713TM21edYDJ3enbrkSzYd2muHxmL6o",
  "secretKey": "3p2L5k9...base58-encoded",
  "name": "My Trading Wallet",
  "createdAt": "2025-11-25T03:00:00Z",
  "network": "mainnet-beta"
}
```

#### 2. File Picker UI Component
```typescript
// src/components/KeypairLoader.tsx
import { useState } from 'react'
import { FileUp, Lock, Unlock, Trash2 } from 'lucide-react'

export function KeypairLoader() {
  const [keypair, setKeypair] = useState(null)
  const [showKey, setShowKey] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setLoading(true)
    try {
      const text = await file.text()
      const data = JSON.parse(text)

      // Validate format
      if (!data.publicKey || !data.secretKey) {
        throw new Error('Invalid keypair file format')
      }

      setKeypair(data)

      // Send to Electron main process for secure storage
      await window.electron?.wallet.save(data.secretKey)

    } catch (error) {
      alert('Invalid keypair file: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  const handleClear = async () => {
    await window.electron?.wallet.clear()
    setKeypair(null)
  }

  return (
    <div className="bg-dark-800 border border-dark-600 rounded-lg p-6 space-y-4">
      <h3 className="text-lg font-semibold flex items-center gap-2">
        <FileUp className="w-5 h-5" />
        Load Keypair
      </h3>

      {!keypair ? (
        <div className="border-2 border-dashed border-dark-500 rounded-lg p-8 text-center cursor-pointer hover:border-accent-green transition">
          <input
            type="file"
            accept=".json"
            onChange={handleFileSelect}
            className="hidden"
            id="keypair-input"
          />
          <label htmlFor="keypair-input" className="cursor-pointer">
            <div className="text-sm text-gray-400">
              Click to select keypair.json file
            </div>
          </label>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between bg-dark-700 rounded p-3">
            <div>
              <p className="text-sm text-gray-400">Public Key</p>
              <p className="font-mono text-sm">{keypair.publicKey.slice(0, 20)}...</p>
            </div>
            <button
              onClick={() => setShowKey(!showKey)}
              className="p-2 hover:bg-dark-600 rounded"
            >
              {showKey ? <Unlock className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
            </button>
          </div>

          {showKey && (
            <div className="bg-dark-700 rounded p-3 text-xs font-mono overflow-auto max-h-24">
              {keypair.secretKey}
            </div>
          )}

          <div className="text-xs text-gray-400">
            Loaded: {new Date(keypair.createdAt).toLocaleDateString()}
          </div>

          <button
            onClick={handleClear}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-red-600/20 hover:bg-red-600/30 text-red-400 rounded"
          >
            <Trash2 className="w-4 h-4" />
            Clear Keypair
          </button>
        </div>
      )}
    </div>
  )
}
```

#### 3. Electron IPC Handler
```typescript
// desktop/ipc-handlers.ts
import { ipcMain } from 'electron'
import keytar from 'keytar'
import path from 'path'
import fs from 'fs/promises'

const SERVICE = 'PumpLauncher'

ipcMain.handle('wallet:save', async (_event, secretKey) => {
  try {
    await keytar.setPassword(SERVICE, 'solana-key', secretKey)
    return { success: true }
  } catch (error) {
    return { success: false, error: error.message }
  }
})

ipcMain.handle('wallet:load', async () => {
  try {
    const key = await keytar.getPassword(SERVICE, 'solana-key')
    return { success: true, secretKey: key }
  } catch (error) {
    return { success: false, error: error.message }
  }
})

ipcMain.handle('wallet:exists', async () => {
  try {
    const key = await keytar.getPassword(SERVICE, 'solana-key')
    return { exists: !!key }
  } catch {
    return { exists: false }
  }
})

ipcMain.handle('wallet:clear', async () => {
  try {
    await keytar.deletePassword(SERVICE, 'solana-key')
    return { success: true }
  } catch (error) {
    return { success: false, error: error.message }
  }
})

ipcMain.handle('file:open-json', async () => {
  const { dialog } = require('electron')
  const result = await dialog.showOpenDialog({
    properties: ['openFile'],
    filters: [{ name: 'JSON Files', extensions: ['json'] }]
  })

  if (!result.canceled) {
    const content = await fs.readFile(result.filePaths[0], 'utf-8')
    return JSON.parse(content)
  }

  return null
})
```

#### 4. Preload Script Update
```typescript
// desktop/preload.js
const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electron', {
  wallet: {
    save: (key) => ipcRenderer.invoke('wallet:save', key),
    load: () => ipcRenderer.invoke('wallet:load'),
    exists: () => ipcRenderer.invoke('wallet:exists'),
    clear: () => ipcRenderer.invoke('wallet:clear'),
  },
  file: {
    openJson: () => ipcRenderer.invoke('file:open-json'),
  }
})
```

---

## Deployment Steps

### Step 1: Generate Keypair JSON
```bash
# User exports their keypair
# CLI tool to create keypair.json
npx ts-node src/export-keypair.ts \
  --privateKey "..." \
  --output keypair.json
```

### Step 2: Load in App
1. Open Electron app
2. Click "Load Keypair"
3. Select keypair.json file
4. Keypair stored in system keychain (secure)

### Step 3: Use in Deployments
- Token creation uses loaded keypair
- No .env file needed on Windows/Linux
- Keychain provides OS-level security

---

## Build Distribution

### macOS (.dmg)
```bash
npm run desktop:pack -- --mac

# Output:
# dist/PumpLauncher-1.0.0.dmg        (Full installer)
# dist/PumpLauncher-1.0.0-arm64.dmg  (Apple Silicon)
```

### Windows (.exe)
```bash
npm run desktop:pack -- --win

# Output:
# dist/PumpLauncher-Setup-1.0.0.exe  (NSIS installer)
```

### Linux (.AppImage)
```bash
npm run desktop:pack -- --linux

# Output:
# dist/pump-launcher-1.0.0.AppImage  (Portable)
```

### All Platforms
```bash
npm run desktop:pack -- -mwl

# Creates all three installers
```

---

## File Structure for Cross-Platform

```
desktop/
├── main.js                      # Electron main process
├── preload.js                   # Secure context bridge
├── ipc-handlers.ts         [NEW] # IPC handlers for keypair
├── build-configs/
│   ├── macos.js            [NEW] # macOS-specific config
│   ├── windows.js          [NEW] # Windows-specific config
│   └── linux.js            [NEW] # Linux-specific config
└── assets/
    ├── icon-mac.icns       [NEW] # macOS icon
    ├── icon-windows.ico    [NEW] # Windows icon
    └── icon-linux.png      [NEW] # Linux icon

web/src/
├── components/
│   └── KeypairLoader.tsx   [NEW] # Keypair loading UI
├── pages/
│   └── SettingsPage.tsx    [UPDATED] # Add keypair settings
└── utils/
    └── electron.ts         [UPDATED] # Electron bridge
```

---

## Environment Variables Handling

### Old (macOS only)
```bash
# .env
SOLANA_PRIVATE_KEY="base58-key"
```

### New (All Platforms)
```bash
# .env (optional fallback)
SOLANA_PRIVATE_KEY="base58-key"  # Falls back if no keychain

# OR

# UI-based keypair loading
# Load keypair.json → Save to system keychain
# Use keychain for all operations
```

---

## Security Considerations

### Keychain Storage
- ✅ **macOS:** Keychain API
- ✅ **Windows:** Credential Manager
- ✅ **Linux:** Secret Service / Pass

### File-based Keypair
- ⚠️ Store in user's home directory
- ⚠️ Permissions: 600 (owner only)
- ⚠️ Encrypted at rest (optional)

### Electron Context Isolation
- ✅ Node integration disabled
- ✅ Preload script for IPC
- ✅ No direct filesystem access
- ✅ Sandboxed renderer process

---

## Testing Checklist

- [ ] macOS build runs (Intel & Apple Silicon)
- [ ] Windows build runs on Windows 10+
- [ ] Linux AppImage runs on Ubuntu 18.04+
- [ ] Keypair loading works on all platforms
- [ ] Private key stored securely in keychain
- [ ] Token deployment uses loaded keypair
- [ ] Fallback to .env if no keypair loaded
- [ ] File permissions correct (600)
- [ ] UI works on different screen sizes

---

## Next Phase

### Electron Features (from previous plan)
1. ✅ Keypair loading (this doc)
2. Native notifications
3. Tray icon
4. Global shortcuts
5. Offline caching
6. Auto-updates

---

**Status:** Ready for implementation 🚀
**Platforms:** macOS, Windows, Linux
**Security:** System-level keychain storage
**Timeline:** 1-2 days for full implementation
