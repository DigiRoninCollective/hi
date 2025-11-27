import { useState } from 'react'
import {
  FileUp,
  Lock,
  Unlock,
  Trash2,
  Copy,
  Download,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react'

interface Keypair {
  publicKey: string
  secretKey: string
  name: string
  createdAt: string
  network: string
}

export function KeypairLoader() {
  const [keypair, setKeypair] = useState<Keypair | null>(null)
  const [showSecret, setShowSecret] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [copied, setCopied] = useState<'public' | 'secret' | null>(null)

  const handleOpenFile = async () => {
    setLoading(true)
    setError(null)
    setSuccess(null)

    try {
      const result = await (window as any).electron?.file.openKeypair()

      if (!result?.success) {
        throw new Error(result?.error || 'Failed to load keypair file')
      }

      const loadedKeypair = result.keypair
      setKeypair(loadedKeypair)
      setSuccess(`✅ Loaded keypair: ${loadedKeypair.name}`)

      // Save to keychain
      const saveResult = await (window as any).electron?.wallet.save(
        loadedKeypair.secretKey
      )

      if (saveResult?.success) {
        setSuccess(
          `✅ Keypair loaded and saved securely (${saveResult.method})`
        )
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      setError(message)
      setKeypair(null)
    } finally {
      setLoading(false)
    }
  }

  const handleSaveKeypair = async () => {
    if (!keypair) return

    setLoading(true)
    setError(null)

    try {
      const result = await (window as any).electron?.file.saveKeypair(keypair)

      if (!result?.success) {
        throw new Error(result?.error || 'Failed to save keypair')
      }

      setSuccess(`✅ Keypair saved to: ${result.filePath}`)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  const handleClearKeypair = async () => {
    setLoading(true)
    setError(null)

    try {
      const result = await (window as any).electron?.wallet.clear()

      if (result?.success) {
        setKeypair(null)
        setShowSecret(false)
        setSuccess('✅ Keypair cleared from storage')
        setTimeout(() => setSuccess(null), 3000)
      } else {
        throw new Error(result?.error || 'Failed to clear keypair')
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  const handleCopyPublic = () => {
    if (keypair) {
      navigator.clipboard.writeText(keypair.publicKey)
      setCopied('public')
      setTimeout(() => setCopied(null), 2000)
    }
  }

  const handleCopySecret = () => {
    if (keypair && showSecret) {
      navigator.clipboard.writeText(keypair.secretKey)
      setCopied('secret')
      setTimeout(() => setCopied(null), 2000)
    }
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <FileUp className="w-5 h-5 text-accent-green" />
        <h3 className="text-lg font-semibold">Wallet Keypair Management</h3>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="bg-red-600/10 border border-red-600/30 rounded-lg p-4 flex gap-3">
          <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-red-400 text-sm font-medium">Error</p>
            <p className="text-red-300 text-sm">{error}</p>
          </div>
        </div>
      )}

      {/* Success Alert */}
      {success && (
        <div className="bg-green-600/10 border border-green-600/30 rounded-lg p-4 flex gap-3">
          <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
          <p className="text-green-300 text-sm">{success}</p>
        </div>
      )}

      {/* No Keypair Loaded */}
      {!keypair ? (
        <div>
          <button
            onClick={handleOpenFile}
            disabled={loading}
            className="w-full border-2 border-dashed border-dark-500 hover:border-accent-green rounded-lg p-8 text-center transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <div className="flex flex-col items-center gap-3">
              <FileUp className="w-8 h-8 text-gray-400" />
              <div className="text-sm text-gray-400">
                <p className="font-medium">
                  {loading ? 'Loading...' : 'Click to select keypair.json file'}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  Your private key will be stored securely in your system keychain
                </p>
              </div>
            </div>
          </button>
        </div>
      ) : (
        /* Keypair Loaded */
        <div className="space-y-3">
          {/* Keypair Info */}
          <div className="bg-dark-700 rounded-lg p-4 space-y-3">
            {/* Name */}
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wide">
                Wallet Name
              </p>
              <p className="text-sm font-medium mt-1">{keypair.name}</p>
            </div>

            {/* Network */}
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wide">
                Network
              </p>
              <p className="text-sm font-medium mt-1 capitalize">
                {keypair.network}
              </p>
            </div>

            {/* Created Date */}
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wide">
                Created
              </p>
              <p className="text-sm font-medium mt-1">
                {new Date(keypair.createdAt).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </p>
            </div>
          </div>

          {/* Public Key */}
          <div className="bg-dark-700 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs text-gray-400 uppercase tracking-wide">
                Public Key
              </p>
              <button
                onClick={handleCopyPublic}
                className="p-1 hover:bg-dark-600 rounded text-gray-400 hover:text-gray-200 transition"
                title="Copy to clipboard"
              >
                <Copy className="w-4 h-4" />
              </button>
            </div>
            <p className="font-mono text-xs bg-dark-800 rounded p-2 break-all text-gray-300">
              {keypair.publicKey}
            </p>
            {copied === 'public' && (
              <p className="text-xs text-green-400 mt-1">✓ Copied!</p>
            )}
          </div>

          {/* Secret Key */}
          <div className="bg-dark-700 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs text-gray-400 uppercase tracking-wide">
                Private Key
              </p>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setShowSecret(!showSecret)}
                  className="p-1 hover:bg-dark-600 rounded text-gray-400 hover:text-gray-200 transition"
                  title={showSecret ? 'Hide' : 'Show'}
                >
                  {showSecret ? (
                    <Unlock className="w-4 h-4" />
                  ) : (
                    <Lock className="w-4 h-4" />
                  )}
                </button>
                {showSecret && (
                  <button
                    onClick={handleCopySecret}
                    className="p-1 hover:bg-dark-600 rounded text-gray-400 hover:text-gray-200 transition"
                    title="Copy to clipboard"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
            {showSecret ? (
              <>
                <p className="font-mono text-xs bg-dark-800 rounded p-2 break-all text-gray-300">
                  {keypair.secretKey}
                </p>
                <p className="text-xs text-yellow-400 mt-2">
                  ⚠️ Never share your private key!
                </p>
                {copied === 'secret' && (
                  <p className="text-xs text-green-400 mt-1">✓ Copied!</p>
                )}
              </>
            ) : (
              <p className="font-mono text-xs bg-dark-800 rounded p-2 text-gray-400">
                ••••••••••••••••••••••••••••••••••••••••••
              </p>
            )}
          </div>

          {/* Actions */}
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={handleSaveKeypair}
              disabled={loading}
              className="flex items-center justify-center gap-2 px-4 py-2 bg-accent-green/10 hover:bg-accent-green/20 text-accent-green rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Download className="w-4 h-4" />
              Export
            </button>
            <button
              onClick={handleClearKeypair}
              disabled={loading}
              className="flex items-center justify-center gap-2 px-4 py-2 bg-red-600/10 hover:bg-red-600/20 text-red-400 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Trash2 className="w-4 h-4" />
              Clear
            </button>
          </div>

          {/* Security Note */}
          <div className="bg-blue-600/10 border border-blue-600/30 rounded-lg p-3">
            <p className="text-xs text-blue-300">
              🔐 Your private key is stored securely in your system keychain
              and is never logged or transmitted.
            </p>
          </div>
        </div>
      )}

      {/* Info Section */}
      <div className="bg-dark-700 rounded-lg p-4 space-y-2 text-sm text-gray-400">
        <p className="font-medium text-gray-300">How to use:</p>
        <ol className="list-decimal list-inside space-y-1 text-xs">
          <li>Click above to select a keypair.json file</li>
          <li>Your keypair will be stored securely in your system keychain</li>
          <li>Use this keypair for all token deployments</li>
          <li>Clear when done or switch to a different keypair</li>
        </ol>
      </div>
    </div>
  )
}

export default KeypairLoader
