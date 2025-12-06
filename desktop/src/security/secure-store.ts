import crypto from 'crypto'
import fs from 'fs/promises'
import os from 'os'
import path from 'path'
import { app } from 'electron'

const SERVICE_NAME = 'PumpLauncher'
const ACCOUNT_NAME = 'solana-wallet'
const FALLBACK_FILE = 'wallet.enc'
const SECRET_FILE = 'encryption.key'
const SALT = 'pump-launcher-local-secret'

async function ensureKeysDirectory() {
  const base = app.getPath('userData')
  const directory = path.join(base, '.keys')
  await fs.mkdir(directory, { recursive: true, mode: 0o700 })
  return { directory, filePath: path.join(directory, FALLBACK_FILE) }
}

async function getKeytar() {
  try {
    const keytar = await import('keytar').then(mod => mod.default)
    return keytar
  } catch (error) {
    console.warn('Keytar unavailable; falling back to local encrypted storage.', error)
    return null
  }
}

function deriveKeyFromSecret(secret: Buffer) {
  return crypto.hkdfSync('sha256', secret, Buffer.from(SALT), Buffer.from('pump-launcher-key'), 32)
}

function legacyDeriveKey() {
  const secretSeed = process.env.PUMPLAUNCHER_SECRET || `${os.userInfo().username}-${os.hostname()}`
  return crypto.scryptSync(secretSeed, SALT, 32)
}

async function loadOrCreateSecret() {
  const envSecret = process.env.PUMPLAUNCHER_SECRET
  if (envSecret) {
    return deriveKeyFromSecret(Buffer.from(envSecret))
  }

  const { directory } = await ensureKeysDirectory()
  const secretPath = path.join(directory, SECRET_FILE)

  try {
    const existing = await fs.readFile(secretPath)
    return deriveKeyFromSecret(existing.length ? existing : Buffer.from(SALT))
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code
    if (code && code !== 'ENOENT') {
      throw error
    }
  }

  const generated = crypto.randomBytes(32)
  await fs.writeFile(secretPath, generated, { mode: 0o600 })
  return deriveKeyFromSecret(generated)
}

function encrypt(privateKey: string, key: Buffer) {
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv)
  const encrypted = Buffer.concat([cipher.update(privateKey, 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag()

  return JSON.stringify({
    iv: iv.toString('base64'),
    tag: authTag.toString('base64'),
    data: encrypted.toString('base64'),
  })
}

function decryptWithKey(payload: string, key: Buffer): string | null {
  try {
    const { iv, tag, data } = JSON.parse(payload) as { iv: string; tag: string; data: string }
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'base64'))
    decipher.setAuthTag(Buffer.from(tag, 'base64'))
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(data, 'base64')),
      decipher.final(),
    ])
    return decrypted.toString('utf8')
  } catch (error) {
    console.error('Failed to decrypt stored keypair', error)
    return null
  }
}

async function reencryptWithNewKey(payload: string, newKey: Buffer, filePath: string) {
  const legacyKey = legacyDeriveKey()
  const legacyDecrypted = decryptWithKey(payload, legacyKey)
  if (!legacyDecrypted) return null

  const rotated = encrypt(legacyDecrypted, newKey)
  await fs.writeFile(filePath, rotated, { mode: 0o600 })
  return legacyDecrypted
}

export async function savePrivateKey(privateKey: string) {
  const keytar = await getKeytar()

  if (keytar) {
    await keytar.setPassword(SERVICE_NAME, ACCOUNT_NAME, privateKey)
    return { success: true as const, method: 'keychain' as const }
  }

  const { filePath } = await ensureKeysDirectory()
  const key = await loadOrCreateSecret()
  const encrypted = encrypt(privateKey, key)
  await fs.writeFile(filePath, encrypted, { mode: 0o600 })
  return { success: true as const, method: 'encrypted-file' as const }
}

export async function loadPrivateKey() {
  const keytar = await getKeytar()
  if (keytar) {
    const key = await keytar.getPassword(SERVICE_NAME, ACCOUNT_NAME)
    if (key) {
      return { success: true as const, privateKey: key, method: 'keychain' as const }
    }
  }

  const { filePath } = await ensureKeysDirectory()
  const key = await loadOrCreateSecret()

  try {
    const encrypted = await fs.readFile(filePath, 'utf8')
    const decrypted = decryptWithKey(encrypted, key)
    if (decrypted) {
      return { success: true as const, privateKey: decrypted, method: 'encrypted-file' as const }
    }

    const rotated = await reencryptWithNewKey(encrypted, key, filePath)
    if (rotated) {
      return { success: true as const, privateKey: rotated, method: 'encrypted-file' as const }
    }

    return { success: false as const, privateKey: null, method: null, error: 'Decryption failed' }
  } catch (error) {
    return { success: false as const, privateKey: null, method: null, error: (error as Error).message }
  }
}

export async function privateKeyExists() {
  const keytar = await getKeytar()
  if (keytar) {
    const key = await keytar.getPassword(SERVICE_NAME, ACCOUNT_NAME)
    if (key) return { exists: true }
  }

  const { filePath } = await ensureKeysDirectory()
  try {
    await fs.access(filePath)
    return { exists: true }
  } catch {
    return { exists: false }
  }
}

export async function clearPrivateKey() {
  const keytar = await getKeytar()
  if (keytar) {
    await keytar.deletePassword(SERVICE_NAME, ACCOUNT_NAME)
    return { success: true }
  }

  const { filePath } = await ensureKeysDirectory()
  try {
    await fs.unlink(filePath)
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code
    if (code !== 'ENOENT') {
      console.error('Failed to delete fallback key file', error)
      return { success: false, error: (error as Error).message }
    }
  }
  return { success: true }
}

export async function getKeysDirectory() {
  const { directory } = await ensureKeysDirectory()
  return directory
}
