import fs from 'fs';
import path from 'path';

export interface LaunchPreferences {
  initialBuySol: number;
  slippage: number;
  priorityFee: number;
  autoDeploy: boolean;
  mayhemMode: boolean;
}

const DEFAULT_PREFS: LaunchPreferences = {
  initialBuySol: 0.1,
  slippage: 10,
  priorityFee: 0.0005,
  autoDeploy: false,
  mayhemMode: false,
};

const PREFS_PATH = path.join(process.cwd(), 'user-preferences.json');

function loadStore(): Record<string, LaunchPreferences> {
  try {
    if (!fs.existsSync(PREFS_PATH)) return {};
    const raw = fs.readFileSync(PREFS_PATH, 'utf-8');
    return JSON.parse(raw);
  } catch (err) {
    console.error('Failed to read preferences store:', err);
    return {};
  }
}

function saveStore(store: Record<string, LaunchPreferences>) {
  try {
    fs.writeFileSync(PREFS_PATH, JSON.stringify(store, null, 2));
  } catch (err) {
    console.error('Failed to write preferences store:', err);
  }
}

export function getLaunchPreferences(userId: string): LaunchPreferences {
  const store = loadStore();
  return store[userId] || DEFAULT_PREFS;
}

export function setLaunchPreferences(userId: string, prefs: Partial<LaunchPreferences>): LaunchPreferences {
  const store = loadStore();
  const current = store[userId] || DEFAULT_PREFS;
  const merged: LaunchPreferences = {
    initialBuySol: prefs.initialBuySol ?? current.initialBuySol,
    slippage: prefs.slippage ?? current.slippage,
    priorityFee: prefs.priorityFee ?? current.priorityFee,
    autoDeploy: prefs.autoDeploy ?? current.autoDeploy,
    mayhemMode: prefs.mayhemMode ?? current.mayhemMode,
  };
  store[userId] = merged;
  saveStore(store);
  return merged;
}
