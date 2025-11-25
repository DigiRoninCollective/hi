const hasDesktopBridge = () =>
  typeof window !== 'undefined' &&
  typeof window.pumpLauncher?.openExternal === 'function'

export const openExternal = (url: string) => {
  if (!url) return

  if (hasDesktopBridge()) {
    try {
      window.pumpLauncher?.openExternal?.(url)
      return
    } catch {
      // Fallback to browser open below
    }
  }

  if (typeof window !== 'undefined') {
    window.open(url, '_blank', 'noopener,noreferrer')
  }
}
