import { useWallet } from '@solana/wallet-adapter-react'
import { useWalletModal } from '@solana/wallet-adapter-react-ui'
import { useDesktopWallet } from '../hooks/useDesktopWallet'
import { Wallet, Plus, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react'

/**
 * Universal Wallet Connector Component
 *
 * Desktop (Electron):
 * - Shows "Load Keypair" button to import from file
 * - Uses system keychain for secure storage
 * - Displays loaded wallet address
 *
 * Web:
 * - Shows "Connect Wallet" button
 * - Opens Phantom/Solflare wallet modal
 * - Uses browser extensions
 */
export function WalletConnector() {
  const { publicKey: webPublicKey, connected: webConnected, disconnect: webDisconnect } = useWallet()
  const { setVisible: openWalletModal } = useWalletModal()
  const { connection: desktopConnection, isLoading, error, isDesktop, loadKeypairFile, disconnect: desktopDisconnect } = useDesktopWallet()

  if (isDesktop) {
    // Desktop Electron App
    if (desktopConnection?.connected) {
      return (
        <div className="flex items-center gap-3 px-4 py-2 bg-green-600/10 border border-green-600/30 rounded-lg">
          <CheckCircle2 className="w-5 h-5 text-green-500" />
          <div className="flex-1">
            <p className="text-sm text-gray-400">Wallet Connected</p>
            <p className="font-mono text-sm truncate text-green-400">
              {desktopConnection.publicKey.slice(0, 10)}...{desktopConnection.publicKey.slice(-10)}
            </p>
          </div>
          <button
            onClick={desktopDisconnect}
            className="px-3 py-1 text-sm bg-red-600/20 hover:bg-red-600/30 text-red-400 rounded transition"
          >
            Disconnect
          </button>
        </div>
      )
    }

    if (error) {
      return (
        <div className="flex items-center gap-3 px-4 py-2 bg-red-600/10 border border-red-600/30 rounded-lg">
          <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm text-red-400">{error}</p>
          </div>
          <button
            onClick={loadKeypairFile}
            disabled={isLoading}
            className="px-3 py-1 text-sm bg-accent-green/20 hover:bg-accent-green/30 text-accent-green rounded transition disabled:opacity-50"
          >
            Retry
          </button>
        </div>
      )
    }

    return (
      <button
        onClick={loadKeypairFile}
        disabled={isLoading}
        className="flex items-center gap-2 px-4 py-2 bg-accent-green hover:bg-green-500 text-dark-900 rounded-lg transition font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isLoading ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <Plus className="w-4 h-4" />
        )}
        {isLoading ? 'Loading...' : 'Load Keypair'}
      </button>
    )
  }

  // Web App (Browser)
  if (webConnected && webPublicKey) {
    return (
      <div className="flex items-center gap-3 px-4 py-2 bg-green-600/10 border border-green-600/30 rounded-lg">
        <CheckCircle2 className="w-5 h-5 text-green-500" />
        <div className="flex-1">
          <p className="text-sm text-gray-400">Wallet Connected</p>
          <p className="font-mono text-sm truncate text-green-400">
            {webPublicKey.toBase58().slice(0, 10)}...{webPublicKey.toBase58().slice(-10)}
          </p>
        </div>
        <button
          onClick={webDisconnect}
          className="px-3 py-1 text-sm bg-red-600/20 hover:bg-red-600/30 text-red-400 rounded transition"
        >
          Disconnect
        </button>
      </div>
    )
  }

  return (
    <button
      onClick={() => openWalletModal(true)}
      className="flex items-center gap-2 px-4 py-2 bg-accent-green hover:bg-green-500 text-dark-900 rounded-lg transition font-semibold"
    >
      <Wallet className="w-4 h-4" />
      Connect Wallet
    </button>
  )
}
