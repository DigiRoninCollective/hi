declare global {
  interface Window {
    pumpLauncher?: {
      version?: string
      openExternal?: (url: string) => void | Promise<void>
    }
    solana?: {
      isPhantom?: boolean
      connect?: (opts?: { onlyIfTrusted?: boolean }) => Promise<{ publicKey?: { toString: () => string } }>
      disconnect?: () => Promise<void>
    }
    backpack?: {
      solana?: {
        connect?: () => Promise<{ publicKey?: { toString: () => string } }>
        disconnect?: () => Promise<void>
      }
    }
    jupiter?: unknown
  }
}

export {}
