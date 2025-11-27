# Electron Features Plan for Token Deployment App

## Current State
- ✅ Basic Electron wrapper (main.js, preload.js)
- ✅ Dark theme
- ✅ Dev tools enabled
- ✅ Hot reload working
- ✅ External link handling

## Proposed Features

### Tier 1: High-Value (implement first)

#### 1. **Local Wallet Storage**
```
Problem: Private key stored in .env, not secure for desktop
Solution: Secure keychain/credential storage
- macOS: Use Keychain
- Windows: Use Credential Manager
- Linux: Use Secret Service

Benefits:
- Private keys never in plaintext
- Hardware wallet support later
- Better security than .env
```

#### 2. **Native Notifications**
```
Use: electron-notifier / native notifications
Trigger on:
- Token successfully created
- Buy/sell completed
- System warnings (low balance)
- Deployment blocked (risk detected)

Example:
Token MOON created! 🚀
View on pump.fun: [Open]
```

#### 3. **Tray Icon & Quick Actions**
```
Features:
- Click to show/hide window
- Quick menu: Create Token, Check Balance, View Dashboard
- Status indicator (online/offline, balance)
- Right-click options

Example Menu:
├─ Show Window
├─ Create Token
├─ Check Balance
├─ View Dashboard
└─ Quit
```

#### 4. **Native Context Menus**
```
- Copy wallet address (with visual feedback)
- Copy transaction signatures
- Export token data as CSV/JSON
- Screenshot with timestamp
```

#### 5. **Offline-First Architecture**
```
Current: Depends on backend at http://localhost:3000
Better: Local fallback when server unavailable

Implementation:
- Cache token data locally (SQLite via electron-store)
- Queue transactions when offline
- Sync when connection restored
- Show offline indicator

Benefits:
- Works without backend running
- Faster load times
- Better UX
```

### Tier 2: Medium-Value (enhance experience)

#### 6. **System Tray Integration**
- Monitor wallet balance in background
- Alert on low balance
- Quick create-token shortcut
- Always-running service option

#### 7. **Global Keyboard Shortcuts**
```
Ctrl+Shift+D (Cmd+Shift+D on macOS)
  → Toggle dashboard
Ctrl+Shift+C (Cmd+Shift+C on macOS)
  → Quick create token dialog
Ctrl+Shift+B (Cmd+Shift+B on macOS)
  → Check balance
```

#### 8. **Window State Persistence**
```
Remember:
- Window size & position
- Tab/page user was on
- Scroll position
- Form data (unsaved token drafts)
```

#### 9. **Auto-Update System**
```
Using: electron-updater
- Check for updates on startup
- Background updates
- Changelog display
- Rollback on failure
```

#### 10. **Native File Export**
```
Export to:
- CSV (token history, transactions)
- JSON (raw data)
- PDF (deployment reports)
- Desktop file save dialog (native)
```

### Tier 3: Advanced (nice-to-have)

#### 11. **System Integration**
- **macOS**: TouchBar buttons for create/check balance
- **Windows**: Windows Toast notifications
- **Linux**: DBus integration

#### 12. **Voice Commands**
```
Using: electron-voice or Web Speech API
Commands:
- "Create token"
- "Check balance"
- "Show transactions"
```

#### 13. **Hardware Wallet Support**
```
Ledger/Trezor integration for signing
- More secure than app-stored keys
- Hardware key confirms transactions
- Air-gapped option
```

#### 14. **Multi-Monitor Support**
```
- Remember which monitor last used
- Open windows on same screen
- Fullscreen on specified monitor
```

#### 15. **Performance Analytics**
```
Track within the app:
- API response times
- Token creation success rate
- Transaction confirmation time
- Error frequency
- Show graphs in dashboard
```

---

## Implementation Priority

### Phase 1: Security & Core (Week 1)
1. ✅ Keychain/credential storage
2. ✅ Offline-first architecture
3. ✅ Local caching (SQLite)

### Phase 2: UX & Productivity (Week 2)
4. ✅ Native notifications
5. ✅ Tray icon & quick actions
6. ✅ Global keyboard shortcuts
7. ✅ Window state persistence

### Phase 3: Distribution (Week 3)
8. ✅ Auto-update system
9. ✅ Native file export
10. ✅ Context menus

### Phase 4: Polish (Ongoing)
11. ✅ System integration (TouchBar, Toast, etc.)
12. ✅ Voice commands
13. ✅ Hardware wallet support

---

## Technical Stack

### Dependencies to Add
```json
{
  "electron-store": "^8.5.0",           // Secure local storage
  "better-sqlite3": "^9.0.0",           // Local database
  "keytar": "^7.9.0",                   // Credential storage
  "electron-updater": "^6.1.0",         // Auto-updates
  "pdfkit": "^0.13.0",                  // PDF generation
  "papaparse": "^5.4.1",                // CSV export
  "express-offline": "^1.0.0",          // Offline mode
  "web-crypto-subtle": "^1.0.0"         // Local crypto
}
```

### File Structure
```
desktop/
├── main.js                  (current)
├── preload.js              (current)
├── ipc-handlers.ts         (NEW: IPC handlers)
├── storage/
│   ├── keychain.ts         (Credential storage)
│   ├── local-db.ts         (SQLite)
│   └── cache.ts            (electron-store)
├── features/
│   ├── notifications.ts    (Native notifications)
│   ├── tray.ts             (Tray icon)
│   ├── shortcuts.ts        (Global shortcuts)
│   ├── offline.ts          (Offline fallback)
│   ├── updates.ts          (Auto-updates)
│   └── export.ts           (File export)
├── utils/
│   └── types.ts            (Shared types)
└── assets/
    ├── icon.png
    └── tray-icon.png
```

---

## Code Example: Keychain Integration

```typescript
// desktop/storage/keychain.ts
import keytar from 'keytar';
import { ipcMain } from 'electron';

const SERVICE_NAME = 'PumpLauncher';
const ACCOUNT_NAME = 'solana-wallet';

export async function savePrivateKey(privateKey: string) {
  await keytar.setPassword(SERVICE_NAME, ACCOUNT_NAME, privateKey);
}

export async function getPrivateKey() {
  return await keytar.getPassword(SERVICE_NAME, ACCOUNT_NAME);
}

export async function deletePrivateKey() {
  await keytar.deletePassword(SERVICE_NAME, ACCOUNT_NAME);
}

// IPC handlers
ipcMain.handle('wallet:save', async (_event, privateKey) => {
  await savePrivateKey(privateKey);
  return { success: true };
});

ipcMain.handle('wallet:load', async () => {
  const key = await getPrivateKey();
  return { privateKey: key || null };
});

ipcMain.handle('wallet:exists', async () => {
  const key = await getPrivateKey();
  return { exists: !!key };
});
```

## Code Example: Offline Storage

```typescript
// desktop/storage/local-db.ts
import Database from 'better-sqlite3';
import path from 'path';
import { app } from 'electron';

const dbPath = path.join(app.getPath('userData'), 'pump-launcher.db');
const db = new Database(dbPath);

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS tokens (
    id TEXT PRIMARY KEY,
    ticker TEXT,
    mint TEXT,
    signature TEXT,
    createdAt TEXT,
    status TEXT
  );

  CREATE TABLE IF NOT EXISTS transactions (
    id TEXT PRIMARY KEY,
    tokenId TEXT,
    type TEXT,
    amount REAL,
    signature TEXT,
    status TEXT,
    createdAt TEXT
  );

  CREATE TABLE IF NOT EXISTS cache (
    key TEXT PRIMARY KEY,
    value TEXT,
    expiresAt TEXT
  );
`);

export const TokenDB = {
  add: (token) => {
    const stmt = db.prepare(
      'INSERT INTO tokens VALUES (?, ?, ?, ?, ?, ?)'
    );
    stmt.run(token.id, token.ticker, token.mint, token.signature, token.createdAt, token.status);
  },

  getAll: () => {
    return db.prepare('SELECT * FROM tokens ORDER BY createdAt DESC').all();
  },

  getByMint: (mint) => {
    return db.prepare('SELECT * FROM tokens WHERE mint = ?').get(mint);
  }
};

// IPC handlers
ipcMain.handle('db:get-tokens', () => {
  return TokenDB.getAll();
});

ipcMain.handle('db:add-token', (_event, token) => {
  TokenDB.add(token);
  return { success: true };
});
```

## Code Example: Notifications

```typescript
// desktop/features/notifications.ts
import { Notification } from 'electron';

export function notifyTokenCreated(ticker, mint) {
  new Notification({
    title: `Token Created! 🚀`,
    body: `${ticker} is now live!`,
    icon: path.join(__dirname, '../assets/success.png'),
  }).show();
}

export function notifyWarning(title, message) {
  new Notification({
    title,
    body: message,
    icon: path.join(__dirname, '../assets/warning.png'),
    urgency: 'critical',
  }).show();
}

export function notifySuccess(title, message) {
  new Notification({
    title,
    body: message,
    icon: path.join(__dirname, '../assets/success.png'),
  }).show();
}
```

---

## User Benefits

### Before (Web-only)
- ❌ Need to keep browser tab open
- ❌ Private key in .env file
- ❌ No notifications if browser minimized
- ❌ Can't access when server down
- ❌ No system integration

### After (Full Electron)
- ✅ Runs as native app
- ✅ Private key in system keychain
- ✅ Native notifications everywhere
- ✅ Works offline with caching
- ✅ Tray icon quick access
- ✅ Global keyboard shortcuts
- ✅ Auto-update new versions
- ✅ Persistent window state
- ✅ Native file export (CSV, PDF, JSON)
- ✅ TouchBar/Windows Toast integration

---

## Build Configuration

```bash
# macOS
npm run desktop:pack -- --mac

# Windows
npm run desktop:pack -- --win

# Linux
npm run desktop:pack -- --linux

# All platforms
npm run desktop:pack -- -mwl
```

Output:
```
dist/
├── PumpLauncher-1.0.0.dmg         (macOS)
├── PumpLauncher-Setup-1.0.0.exe   (Windows)
└── pump-launcher-1.0.0.AppImage   (Linux)
```

---

## Next Steps

### Immediate (This Session)
1. [ ] Plan which features to implement
2. [ ] Setup Tier 1 infrastructure
3. [ ] Add IPC handlers
4. [ ] Build for Windows/Linux

### Short-term (This Week)
5. [ ] Implement keychain storage
6. [ ] Add offline caching
7. [ ] Setup notifications
8. [ ] Add tray icon

### Medium-term (Next Week)
9. [ ] Global keyboard shortcuts
10. [ ] Window state persistence
11. [ ] Auto-update system
12. [ ] File export (CSV, PDF, JSON)

---

## Questions to Consider

1. **Keychain vs .env**: Should we force keychain usage or keep .env as fallback?
2. **Offline Mode**: How much data should we cache? (all tokens? just user's tokens?)
3. **Auto-Update**: Should updates be automatic or user-approved?
4. **Hardware Wallets**: Should we plan for Ledger/Trezor support?
5. **Multi-Language**: Should the app support multiple languages?

---

**Status**: Ready to implement 🚀
**Complexity**: Medium (Tier 1) to Advanced (Tier 3)
**Timeline**: 2-3 weeks for full implementation
**Estimated Users Impact**: 🔥 High - makes desktop app much more useful
