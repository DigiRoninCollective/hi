import { useWallet } from '@solana/wallet-adapter-react'
import { useDesktopWallet } from '../hooks/useDesktopWallet'
import { useConnect, useDisconnect, useModal } from '@phantom/react-sdk'
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
 * - Uses Phantom React SDK for seamless connection
 * - Supports multiple authentication methods (Google, Apple, Phantom Login, Solana wallets)
 */
export function WalletConnector() {
  // Solana wallet adapter (fallback for browser extensions)
  const { publicKey: adapterPublicKey, connected: adapterConnected } = useWallet()

  // Phantom React SDK hooks
  const { connect, connecting, accounts } = useConnect()
  const { disconnect } = useDisconnect()
  const { open: openModal } = useModal()

  // Desktop wallet management
  const { connection: desktopConnection, isLoading, error, isDesktop, loadKeypairFile, disconnect: desktopDisconnect } = useDesktopWallet()

  const phantomConnected = accounts && accounts.length > 0
  const phantomAccount = accounts?.[0]

  // Desktop mode: use keypair import
  if (isDesktop) {
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

  // Web App: use Phantom SDK or fallback to wallet adapter
  if (phantomConnected && phantomAccount) {
    return (
      <div className="flex items-center gap-3 px-4 py-2 bg-green-600/10 border border-green-600/30 rounded-lg">
        <CheckCircle2 className="w-5 h-5 text-green-500" />
        <div className="flex-1">
          <p className="text-sm text-gray-400">Wallet Connected (Phantom)</p>
          <p className="font-mono text-sm truncate text-green-400">
            {phantomAccount.address.slice(0, 10)}...{phantomAccount.address.slice(-10)}
          </p>
        </div>
        <button
          onClick={disconnect}
          className="px-3 py-1 text-sm bg-red-600/20 hover:bg-red-600/30 text-red-400 rounded transition"
        >
          Disconnect
        </button>
      </div>
    )
  }

  // Fallback: wallet adapter connection (browser extensions)
  if (adapterConnected && adapterPublicKey) {
    return (
      <div className="flex items-center gap-3 px-4 py-2 bg-green-600/10 border border-green-600/30 rounded-lg">
        <CheckCircle2 className="w-5 h-5 text-green-500" />
        <div className="flex-1">
          <p className="text-sm text-gray-400">Wallet Connected</p>
          <p className="font-mono text-sm truncate text-green-400">
            {adapterPublicKey.toBase58().slice(0, 10)}...{adapterPublicKey.toBase58().slice(-10)}
          </p>
        </div>
      </div>
    )
  }

  // Try Phantom SDK first, fallback to wallet adapter modal
  return (
    <button
      onClick={() => openModal()}
      disabled={connecting}
      className="flex items-center gap-2 px-4 py-2 bg-accent-green hover:bg-green-500 text-dark-900 rounded-lg transition font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {connecting ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : (
        <Wallet className="w-4 h-4" />
      )}
      {connecting ? 'Connecting...' : 'Connect Wallet'}
    </button>
  )
}
