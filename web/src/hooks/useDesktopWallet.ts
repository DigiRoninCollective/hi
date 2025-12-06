import { useCallback, useEffect, useState } from 'react'

interface DesktopWalletConnection {
  publicKey: string
  name: 'Phantom' | 'Solflare' | 'Keypair'
  connected: boolean
}

/**
 * Hook for handling wallet connections in desktop app
 *
 * For Desktop Electron App:
 * 1. First tries to use loaded keypair from system keychain
 * 2. Falls back to allowing manual keypair file import
 * 3. Shows user-friendly connection status
 *
 * For Web App:
 * Uses standard browser wallet adapters (Phantom, Solflare extensions)
 */
export function useDesktopWallet() {
  const [connection, setConnection] = useState<DesktopWalletConnection | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isDesktop = useCallback(() => {
    return typeof (window as any).electron !== 'undefined'
  }, [])

  // Check for existing keypair in keychain
  const checkSavedKeypair = useCallback(async () => {
    if (!isDesktop()) return

    setIsLoading(true)
    setError(null)

    try {
      const result = await (window as any).electron?.wallet.exists()

      if (result?.exists) {
        setConnection({
          publicKey: result.publicKey || 'unknown',
          name: 'Keypair',
          connected: true,
        })
      }
    } catch (err) {
      console.error('Failed to check saved keypair:', err)
    } finally {
      setIsLoading(false)
    }
  }, [isDesktop])

  // Load keypair from file
  const loadKeypairFile = useCallback(async () => {
    if (!isDesktop()) {
      setError('This function is only available in the desktop app')
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const result = await (window as any).electron?.file.openKeypair()

      if (!result?.success) {
        throw new Error(result?.error || 'Failed to load keypair')
      }

      const keypair = result.keypair

      // Save to keychain
      await (window as any).electron?.wallet.save(
        keypair.secretKey
      )

      setConnection({
        publicKey: keypair.publicKey,
        name: 'Keypair',
        connected: true,
      })

      setError(null)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      setError(message)
      setConnection(null)
    } finally {
      setIsLoading(false)
    }
  }, [isDesktop])

  // Clear connection
  const disconnect = useCallback(async () => {
    if (isDesktop()) {
      try {
        await (window as any).electron?.wallet.clear()
      } catch (err) {
        console.error('Failed to clear wallet:', err)
      }
    }

    setConnection(null)
    setError(null)
  }, [isDesktop])

  // Check on mount
  useEffect(() => {
    if (isDesktop()) {
      checkSavedKeypair()
    }
  }, [isDesktop, checkSavedKeypair])

  return {
    connection,
    isLoading,
    error,
    isDesktop: isDesktop(),
    loadKeypairFile,
    disconnect,
    checkSavedKeypair,
  }
}
