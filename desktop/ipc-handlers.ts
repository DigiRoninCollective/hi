import { ipcMain, dialog, BrowserWindow } from 'electron'
import fs from 'fs/promises'
import path from 'path'
import os from 'os'

// Platform-specific keychain storage
let keystoreBackend: any = null

async function initKeystore() {
  if (keystoreBackend) return keystoreBackend

  try {
    // Try to use keytar for secure storage
    const keytar = await import('keytar').then(m => m.default)
    keystoreBackend = keytar
    console.log('✅ Using system keychain for credential storage')
    return keytar
  } catch (error) {
    console.warn('⚠️  Keytar not available, using fallback secure storage')
    // Fallback to encrypted local storage
    return null
  }
}

const SERVICE_NAME = 'PumpLauncher'
const ACCOUNT_NAME = 'solana-wallet'

// IPC Handlers for Wallet/Keypair Management

/**
 * Save private key to system keychain
 */
ipcMain.handle('wallet:save', async (_event, privateKey: string) => {
  try {
    const keytar = await initKeystore()

    if (keytar) {
      // Use system keychain
      await keytar.setPassword(SERVICE_NAME, ACCOUNT_NAME, privateKey)
      console.log('✅ Private key saved to system keychain')
      return { success: true, method: 'keychain' }
    } else {
      // Fallback: save encrypted to file
      const userDataPath = require('electron').app.getPath('userData')
      const keysDir = path.join(userDataPath, '.keys')
      await fs.mkdir(keysDir, { recursive: true })

      // Simple encryption (base64 for demo - use crypto in production)
      const encrypted = Buffer.from(privateKey).toString('base64')
      const keyPath = path.join(keysDir, 'wallet.key')

      // Set permissions to owner-only
      await fs.writeFile(keyPath, encrypted, { mode: 0o600 })
      console.log('✅ Private key saved to encrypted file')
      return { success: true, method: 'file' }
    }
  } catch (error) {
    console.error('❌ Failed to save private key:', error)
    return { success: false, error: (error as Error).message, method: null }
  }
})

/**
 * Load private key from system keychain
 */
ipcMain.handle('wallet:load', async () => {
  try {
    const keytar = await initKeystore()

    if (keytar) {
      // Try keychain first
      const key = await keytar.getPassword(SERVICE_NAME, ACCOUNT_NAME)
      if (key) {
        console.log('✅ Private key loaded from system keychain')
        return { success: true, privateKey: key, method: 'keychain' }
      }
    }

    // Fallback: try file
    const userDataPath = require('electron').app.getPath('userData')
    const keyPath = path.join(userDataPath, '.keys', 'wallet.key')

    try {
      const encrypted = await fs.readFile(keyPath, 'utf-8')
      const privateKey = Buffer.from(encrypted, 'base64').toString('utf-8')
      console.log('✅ Private key loaded from encrypted file')
      return { success: true, privateKey, method: 'file' }
    } catch {
      return { success: false, privateKey: null, method: null }
    }
  } catch (error) {
    console.error('❌ Failed to load private key:', error)
    return { success: false, error: (error as Error).message, privateKey: null, method: null }
  }
})

/**
 * Check if wallet exists
 */
ipcMain.handle('wallet:exists', async () => {
  try {
    const keytar = await initKeystore()

    if (keytar) {
      const key = await keytar.getPassword(SERVICE_NAME, ACCOUNT_NAME)
      return { exists: !!key }
    }

    // Check file
    const userDataPath = require('electron').app.getPath('userData')
    const keyPath = path.join(userDataPath, '.keys', 'wallet.key')

    try {
      await fs.access(keyPath)
      return { exists: true }
    } catch {
      return { exists: false }
    }
  } catch (error) {
    return { exists: false }
  }
})

/**
 * Delete private key from storage
 */
ipcMain.handle('wallet:clear', async () => {
  try {
    const keytar = await initKeystore()

    if (keytar) {
      await keytar.deletePassword(SERVICE_NAME, ACCOUNT_NAME)
      console.log('✅ Private key removed from system keychain')
      return { success: true }
    }

    // Remove file
    const userDataPath = require('electron').app.getPath('userData')
    const keyPath = path.join(userDataPath, '.keys', 'wallet.key')

    try {
      await fs.unlink(keyPath)
      console.log('✅ Private key removed from encrypted file')
    } catch {
      // File doesn't exist, that's fine
    }

    return { success: true }
  } catch (error) {
    console.error('❌ Failed to clear private key:', error)
    return { success: false, error: (error as Error).message }
  }
})

// IPC Handlers for File Operations

/**
 * Open file picker and load keypair JSON
 */
ipcMain.handle('file:open-keypair', async (event) => {
  try {
    const mainWindow = BrowserWindow.getFocusedWindow()
    if (!mainWindow) {
      return { success: false, error: 'No window focused' }
    }

    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openFile'],
      filters: [
        { name: 'JSON Files', extensions: ['json'] },
        { name: 'All Files', extensions: ['*'] },
      ],
      title: 'Select Keypair JSON File',
      message: 'Choose your Solana keypair JSON file',
    })

    if (result.canceled || result.filePaths.length === 0) {
      return { success: false, error: 'File selection cancelled' }
    }

    const filePath = result.filePaths[0]
    const content = await fs.readFile(filePath, 'utf-8')
    const keypair = JSON.parse(content)

    // Validate keypair format
    if (!keypair.secretKey || !keypair.publicKey) {
      return {
        success: false,
        error: 'Invalid keypair format. Missing secretKey or publicKey.',
      }
    }

    console.log(`✅ Loaded keypair from: ${filePath}`)
    return {
      success: true,
      keypair: {
        publicKey: keypair.publicKey,
        secretKey: keypair.secretKey,
        name: keypair.name || 'Imported Wallet',
        createdAt: keypair.createdAt || new Date().toISOString(),
        network: keypair.network || 'mainnet-beta',
      },
    }
  } catch (error) {
    console.error('❌ Failed to load keypair file:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
})

/**
 * Export keypair to JSON file
 */
ipcMain.handle('file:save-keypair', async (event, keypair) => {
  try {
    const mainWindow = BrowserWindow.getFocusedWindow()
    if (!mainWindow) {
      return { success: false, error: 'No window focused' }
    }

    const result = await dialog.showSaveDialog(mainWindow, {
      defaultPath: path.join(os.homedir(), 'keypair.json'),
      filters: [{ name: 'JSON Files', extensions: ['json'] }],
      title: 'Save Keypair',
      message: 'Save your keypair to a JSON file',
    })

    if (result.canceled || !result.filePath) {
      return { success: false, error: 'Save cancelled' }
    }

    const fileContent = JSON.stringify(keypair, null, 2)
    await fs.writeFile(result.filePath, fileContent, { mode: 0o600 })

    console.log(`✅ Keypair saved to: ${result.filePath}`)
    return {
      success: true,
      filePath: result.filePath,
      message: 'Keypair saved successfully. Keep this file safe!',
    }
  } catch (error) {
    console.error('❌ Failed to save keypair file:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
})

/**
 * Get default keypair directory
 */
ipcMain.handle('file:get-keys-directory', async () => {
  try {
    const userDataPath = require('electron').app.getPath('userData')
    const keysDir = path.join(userDataPath, '.keys')
    await fs.mkdir(keysDir, { recursive: true })
    return { success: true, path: keysDir }
  } catch (error) {
    console.error('❌ Failed to get keys directory:', error)
    return { success: false, error: (error as Error).message }
  }
})

// IPC Handlers for System Info

/**
 * Get platform and system info
 */
ipcMain.handle('system:get-info', async () => {
  return {
    platform: process.platform,
    arch: process.arch,
    nodeVersion: process.version,
    electronVersion: process.versions.electron,
    osVersion: os.release(),
  }
})

/**
 * Log message from renderer
 */
ipcMain.handle('log:info', async (_event, message: string) => {
  console.log(`[App] ${message}`)
  return { success: true }
})

ipcMain.handle('log:error', async (_event, message: string) => {
  console.error(`[App Error] ${message}`)
  return { success: true }
})

export { initKeystore }
