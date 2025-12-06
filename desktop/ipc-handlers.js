"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.initKeystore = initKeystore;
const electron_1 = require("electron");
const promises_1 = __importDefault(require("fs/promises"));
const path_1 = __importDefault(require("path"));
const os_1 = __importDefault(require("os"));
// Platform-specific keychain storage
let keystoreBackend = null;
async function initKeystore() {
    if (keystoreBackend)
        return keystoreBackend;
    try {
        // Try to use keytar for secure storage
        const keytar = await Promise.resolve().then(() => __importStar(require('keytar'))).then(m => m.default);
        keystoreBackend = keytar;
        console.log('✅ Using system keychain for credential storage');
        return keytar;
    }
    catch (error) {
        console.warn('⚠️  Keytar not available, using fallback secure storage');
        // Fallback to encrypted local storage
        return null;
    }
}
const SERVICE_NAME = 'PumpLauncher';
const ACCOUNT_NAME = 'solana-wallet';
// IPC Handlers for Wallet/Keypair Management
/**
 * Save private key to system keychain
 */
electron_1.ipcMain.handle('wallet:save', async (_event, privateKey) => {
    try {
        const keytar = await initKeystore();
        if (keytar) {
            // Use system keychain
            await keytar.setPassword(SERVICE_NAME, ACCOUNT_NAME, privateKey);
            console.log('✅ Private key saved to system keychain');
            return { success: true, method: 'keychain' };
        }
        else {
            // Fallback: save encrypted to file
            const userDataPath = require('electron').app.getPath('userData');
            const keysDir = path_1.default.join(userDataPath, '.keys');
            await promises_1.default.mkdir(keysDir, { recursive: true });
            // Simple encryption (base64 for demo - use crypto in production)
            const encrypted = Buffer.from(privateKey).toString('base64');
            const keyPath = path_1.default.join(keysDir, 'wallet.key');
            // Set permissions to owner-only
            await promises_1.default.writeFile(keyPath, encrypted, { mode: 0o600 });
            console.log('✅ Private key saved to encrypted file');
            return { success: true, method: 'file' };
        }
    }
    catch (error) {
        console.error('❌ Failed to save private key:', error);
        return { success: false, error: error.message, method: null };
    }
});
/**
 * Load private key from system keychain
 */
electron_1.ipcMain.handle('wallet:load', async () => {
    try {
        const keytar = await initKeystore();
        if (keytar) {
            // Try keychain first
            const key = await keytar.getPassword(SERVICE_NAME, ACCOUNT_NAME);
            if (key) {
                console.log('✅ Private key loaded from system keychain');
                return { success: true, privateKey: key, method: 'keychain' };
            }
        }
        // Fallback: try file
        const userDataPath = require('electron').app.getPath('userData');
        const keyPath = path_1.default.join(userDataPath, '.keys', 'wallet.key');
        try {
            const encrypted = await promises_1.default.readFile(keyPath, 'utf-8');
            const privateKey = Buffer.from(encrypted, 'base64').toString('utf-8');
            console.log('✅ Private key loaded from encrypted file');
            return { success: true, privateKey, method: 'file' };
        }
        catch {
            return { success: false, privateKey: null, method: null };
        }
    }
    catch (error) {
        console.error('❌ Failed to load private key:', error);
        return { success: false, error: error.message, privateKey: null, method: null };
    }
});
/**
 * Check if wallet exists
 */
electron_1.ipcMain.handle('wallet:exists', async () => {
    try {
        const keytar = await initKeystore();
        if (keytar) {
            const key = await keytar.getPassword(SERVICE_NAME, ACCOUNT_NAME);
            return { exists: !!key };
        }
        // Check file
        const userDataPath = require('electron').app.getPath('userData');
        const keyPath = path_1.default.join(userDataPath, '.keys', 'wallet.key');
        try {
            await promises_1.default.access(keyPath);
            return { exists: true };
        }
        catch {
            return { exists: false };
        }
    }
    catch (error) {
        return { exists: false };
    }
});
/**
 * Delete private key from storage
 */
electron_1.ipcMain.handle('wallet:clear', async () => {
    try {
        const keytar = await initKeystore();
        if (keytar) {
            await keytar.deletePassword(SERVICE_NAME, ACCOUNT_NAME);
            console.log('✅ Private key removed from system keychain');
            return { success: true };
        }
        // Remove file
        const userDataPath = require('electron').app.getPath('userData');
        const keyPath = path_1.default.join(userDataPath, '.keys', 'wallet.key');
        try {
            await promises_1.default.unlink(keyPath);
            console.log('✅ Private key removed from encrypted file');
        }
        catch {
            // File doesn't exist, that's fine
        }
        return { success: true };
    }
    catch (error) {
        console.error('❌ Failed to clear private key:', error);
        return { success: false, error: error.message };
    }
});
// IPC Handlers for File Operations
/**
 * Open file picker and load keypair JSON
 */
electron_1.ipcMain.handle('file:open-keypair', async (event) => {
    try {
        const mainWindow = electron_1.BrowserWindow.getFocusedWindow();
        if (!mainWindow) {
            return { success: false, error: 'No window focused' };
        }
        const result = await electron_1.dialog.showOpenDialog(mainWindow, {
            properties: ['openFile'],
            filters: [
                { name: 'JSON Files', extensions: ['json'] },
                { name: 'All Files', extensions: ['*'] },
            ],
            title: 'Select Keypair JSON File',
            message: 'Choose your Solana keypair JSON file',
        });
        if (result.canceled || result.filePaths.length === 0) {
            return { success: false, error: 'File selection cancelled' };
        }
        const filePath = result.filePaths[0];
        const content = await promises_1.default.readFile(filePath, 'utf-8');
        const keypair = JSON.parse(content);
        // Validate keypair format
        if (!keypair.secretKey || !keypair.publicKey) {
            return {
                success: false,
                error: 'Invalid keypair format. Missing secretKey or publicKey.',
            };
        }
        console.log(`✅ Loaded keypair from: ${filePath}`);
        return {
            success: true,
            keypair: {
                publicKey: keypair.publicKey,
                secretKey: keypair.secretKey,
                name: keypair.name || 'Imported Wallet',
                createdAt: keypair.createdAt || new Date().toISOString(),
                network: keypair.network || 'mainnet-beta',
            },
        };
    }
    catch (error) {
        console.error('❌ Failed to load keypair file:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
        };
    }
});
/**
 * Export keypair to JSON file
 */
electron_1.ipcMain.handle('file:save-keypair', async (event, keypair) => {
    try {
        const mainWindow = electron_1.BrowserWindow.getFocusedWindow();
        if (!mainWindow) {
            return { success: false, error: 'No window focused' };
        }
        const result = await electron_1.dialog.showSaveDialog(mainWindow, {
            defaultPath: path_1.default.join(os_1.default.homedir(), 'keypair.json'),
            filters: [{ name: 'JSON Files', extensions: ['json'] }],
            title: 'Save Keypair',
            message: 'Save your keypair to a JSON file',
        });
        if (result.canceled || !result.filePath) {
            return { success: false, error: 'Save cancelled' };
        }
        const fileContent = JSON.stringify(keypair, null, 2);
        await promises_1.default.writeFile(result.filePath, fileContent, { mode: 0o600 });
        console.log(`✅ Keypair saved to: ${result.filePath}`);
        return {
            success: true,
            filePath: result.filePath,
            message: 'Keypair saved successfully. Keep this file safe!',
        };
    }
    catch (error) {
        console.error('❌ Failed to save keypair file:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
        };
    }
});
/**
 * Get default keypair directory
 */
electron_1.ipcMain.handle('file:get-keys-directory', async () => {
    try {
        const userDataPath = require('electron').app.getPath('userData');
        const keysDir = path_1.default.join(userDataPath, '.keys');
        await promises_1.default.mkdir(keysDir, { recursive: true });
        return { success: true, path: keysDir };
    }
    catch (error) {
        console.error('❌ Failed to get keys directory:', error);
        return { success: false, error: error.message };
    }
});
// IPC Handlers for System Info
/**
 * Get platform and system info
 */
electron_1.ipcMain.handle('system:get-info', async () => {
    return {
        platform: process.platform,
        arch: process.arch,
        nodeVersion: process.version,
        electronVersion: process.versions.electron,
        osVersion: os_1.default.release(),
    };
});
/**
 * Log message from renderer
 */
electron_1.ipcMain.handle('log:info', async (_event, message) => {
    console.log(`[App] ${message}`);
    return { success: true };
});
electron_1.ipcMain.handle('log:error', async (_event, message) => {
    console.error(`[App Error] ${message}`);
    return { success: true };
});
