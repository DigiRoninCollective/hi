import { ipcMain, dialog, BrowserWindow } from 'electron'
import fs from 'fs/promises'
import path from 'path'
import os from 'os'
import {
  clearPrivateKey,
  getKeysDirectory,
  loadPrivateKey,
  privateKeyExists,
  savePrivateKey,
} from './security/secure-store'

let registered = false

function requireWindow() {
  const mainWindow = BrowserWindow.getFocusedWindow()
  if (!mainWindow) {
    throw new Error('No active window available')
  }
  return mainWindow
}

export function registerIpcHandlers() {
  if (registered) return
  registered = true

  ipcMain.handle('wallet:save', async (_event, privateKey: string) => {
    try {
      const result = await savePrivateKey(privateKey)
      return { ...result }
    } catch (error) {
      console.error('❌ Failed to save private key:', error)
      return { success: false, error: (error as Error).message, method: null }
    }
  })

  ipcMain.handle('wallet:load', async () => {
    try {
      const result = await loadPrivateKey()
      if (!result.success) return result
      console.log(`✅ Private key loaded from ${result.method}`)
      return result
    } catch (error) {
      console.error('❌ Failed to load private key:', error)
      return { success: false, error: (error as Error).message, privateKey: null, method: null }
    }
  })

  ipcMain.handle('wallet:exists', async () => {
    try {
      return await privateKeyExists()
    } catch (error) {
      console.error('❌ Failed to check wallet existence:', error)
      return { exists: false }
    }
  })

  ipcMain.handle('wallet:clear', async () => {
    try {
      return await clearPrivateKey()
    } catch (error) {
      console.error('❌ Failed to clear private key:', error)
      return { success: false, error: (error as Error).message }
    }
  })

  ipcMain.handle('file:open-keypair', async () => {
    try {
      const mainWindow = requireWindow()

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

  ipcMain.handle('file:save-keypair', async (_event, keypair) => {
    try {
      const mainWindow = requireWindow()

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

  ipcMain.handle('file:get-keys-directory', async () => {
    try {
      const keysDir = await getKeysDirectory()
      return { success: true, path: keysDir }
    } catch (error) {
      console.error('❌ Failed to get keys directory:', error)
      return { success: false, error: (error as Error).message }
    }
  })

  ipcMain.handle('system:get-info', async () => {
    return {
      platform: process.platform,
      arch: process.arch,
      nodeVersion: process.version,
      electronVersion: process.versions.electron,
      osVersion: os.release(),
    }
  })

  ipcMain.handle('log:info', async (_event, message: string) => {
    console.log(`[App] ${message}`)
    return { success: true }
  })

  ipcMain.handle('log:error', async (_event, message: string) => {
    console.error(`[App Error] ${message}`)
    return { success: true }
  })
}
