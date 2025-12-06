import { useState, useRef } from 'react'
import { Upload, Loader2, Check, X, ExternalLink, ArrowLeft } from 'lucide-react'
import { Keypair } from '@solana/web3.js'
import bs58 from 'bs58'
import { useBackNavigation } from '../hooks/useNavigation'

interface TokenFormData {
  name: string
  symbol: string
  description: string
  website: string
  twitter: string
  telegram: string
  imageFile: File | null
  imagePreview: string | null
  privatKey: string
  amount: string
  slippage: string
  priorityFee: string
  showName: boolean
}

interface CreateStatus {
  status: 'idle' | 'uploading' | 'creating' | 'signing' | 'success' | 'error'
  message: string
  signature?: string
  explorerUrl?: string
}

export default function LocalTokenCreatePage() {
  const { goBack } = useBackNavigation()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [form, setForm] = useState<TokenFormData>({
    name: '',
    symbol: '',
    description: '',
    website: '',
    twitter: '',
    telegram: '',
    imageFile: null,
    imagePreview: null,
    privatKey: '',
    amount: '1',
    slippage: '10',
    priorityFee: '0.0005',
    showName: true,
  })

  const [status, setStatus] = useState<CreateStatus>({
    status: 'idle',
    message: '',
  })

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setForm((prev) => ({
      ...prev,
      imageFile: file,
    }))

    const reader = new FileReader()
    reader.onload = (event) => {
      setForm((prev) => ({
        ...prev,
        imagePreview: event.target?.result as string,
      }))
    }
    reader.readAsDataURL(file)
  }

  const removeImage = () => {
    setForm((prev) => ({
      ...prev,
      imageFile: null,
      imagePreview: null,
    }))
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const validateInputs = (): string | null => {
    if (!form.name.trim()) return 'Token name is required'
    if (!form.symbol.trim()) return 'Token symbol is required'
    if (!form.privatKey.trim()) return 'Private key is required'
    if (!form.imageFile) return 'Token image is required'
    if (form.symbol.length > 10) return 'Symbol must be 10 characters or less'
    if (form.name.length > 32) return 'Name must be 32 characters or less'
    if (isNaN(parseFloat(form.amount)) || parseFloat(form.amount) <= 0) {
      return 'Amount must be a positive number'
    }

    // Validate private key format
    try {
      const decoded = bs58.decode(form.privatKey)
      if (decoded.length !== 64) {
        return 'Private key must be 64 bytes (base58 encoded)'
      }
    } catch {
      return 'Invalid private key format (must be base58 encoded)'
    }

    return null
  }

  const getPublicKeyFromPrivateKey = (privateKeyBase58: string): string => {
    try {
      const keypair = Keypair.fromSecretKey(bs58.decode(privateKeyBase58))
      return keypair.publicKey.toBase58()
    } catch {
      throw new Error('Invalid private key')
    }
  }

  const handleCreate = async () => {
    const error = validateInputs()
    if (error) {
      setStatus({
        status: 'error',
        message: error,
      })
      return
    }

    try {
      setStatus({
        status: 'uploading',
        message: 'Uploading image to IPFS...',
      })

      // Step 1: Upload image and metadata to pump.fun IPFS
      const imageFormData = new FormData()
      imageFormData.append('file', form.imageFile!)
      imageFormData.append('name', form.name)
      imageFormData.append('symbol', form.symbol)
      imageFormData.append('description', form.description || `${form.symbol} token`)
      imageFormData.append('showName', form.showName ? 'true' : 'false')
      if (form.website) imageFormData.append('website', form.website)
      if (form.twitter) imageFormData.append('twitter', form.twitter)
      if (form.telegram) imageFormData.append('telegram', form.telegram)

      const metadataResponse = await fetch('https://pump.fun/api/ipfs', {
        method: 'POST',
        body: imageFormData,
      })

      if (!metadataResponse.ok) {
        throw new Error('Failed to upload image to IPFS')
      }

      const metadataJSON = await metadataResponse.json()
      const metadataUri = metadataJSON.metadataUri

      if (!metadataUri) {
        throw new Error('Failed to get metadata URI from IPFS upload')
      }

      // Step 2: Create transaction via PumpPortal API
      setStatus({
        status: 'creating',
        message: 'Creating token transaction...',
      })

      // Derive public key from private key
      let publicKey: string
      try {
        publicKey = getPublicKeyFromPrivateKey(form.privatKey)
      } catch (err) {
        throw new Error('Failed to derive public key from private key')
      }

      const createResponse = await fetch('https://pumpportal.fun/api/trade-local', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          publicKey: publicKey,
          action: 'create',
          tokenMetadata: {
            name: form.name,
            symbol: form.symbol,
            uri: metadataUri,
          },
          mint: undefined, // Let server generate
          denominatedInSol: 'true',
          amount: parseFloat(form.amount),
          slippage: parseFloat(form.slippage),
          priorityFee: parseFloat(form.priorityFee),
          pool: 'pump',
          isMayhemMode: 'false',
        }),
      })

      if (!createResponse.ok) {
        throw new Error(`Failed to create token: ${createResponse.statusText}`)
      }

      // Step 3: Sign and send transaction
      setStatus({
        status: 'signing',
        message: 'Signing and sending transaction...',
      })

      const txData = await createResponse.arrayBuffer()

      // Send to backend for signing (since we have the private key in the form)
      const signResponse = await fetch('/api/tokens/create-local', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          txData: Array.from(new Uint8Array(txData)),
          privateKey: form.privatKey,
        }),
      })

      if (!signResponse.ok) {
        throw new Error('Failed to sign and send transaction')
      }

      const result = await signResponse.json()

      setStatus({
        status: 'success',
        message: 'Token created successfully!',
        signature: result.signature,
        explorerUrl: `https://solscan.io/tx/${result.signature}`,
      })

      // Reset form
      setForm({
        name: '',
        symbol: '',
        description: '',
        website: '',
        twitter: '',
        telegram: '',
        imageFile: null,
        imagePreview: null,
        privatKey: '',
        amount: '1',
        slippage: '10',
        priorityFee: '0.0005',
        showName: true,
      })
    } catch (error) {
      setStatus({
        status: 'error',
        message: error instanceof Error ? error.message : 'An error occurred',
      })
    }
  }

  return (
    <div className="max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={goBack}
          className="p-2 hover:bg-dark-700 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-6 h-6 text-gray-400" />
        </button>
        <h1 className="text-2xl font-bold">Create Token (Local Signing)</h1>
      </div>

      {/* Form */}
      <div className="bg-dark-800 rounded-xl border border-dark-600 p-6 space-y-6">
        {/* Token Info */}
        <div>
          <h2 className="text-lg font-semibold mb-4">Token Information</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-400 mb-2">
                Name <span className="text-gray-600">({form.name.length}/32)</span>
              </label>
              <input
                type="text"
                value={form.name}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    name: e.target.value.slice(0, 32),
                  }))
                }
                placeholder="e.g., My Token"
                className="w-full px-3 py-2 bg-dark-700 border border-dark-600 rounded-lg text-white placeholder-gray-500 focus:border-accent-green focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-2">
                Symbol <span className="text-gray-600">({form.symbol.length}/10)</span>
              </label>
              <input
                type="text"
                value={form.symbol}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    symbol: e.target.value.toUpperCase().slice(0, 10),
                  }))
                }
                placeholder="e.g., TOKEN"
                className="w-full px-3 py-2 bg-dark-700 border border-dark-600 rounded-lg text-white placeholder-gray-500 focus:border-accent-green focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm text-gray-400 mb-2">Description</label>
          <textarea
            value={form.description}
            onChange={(e) =>
              setForm((prev) => ({
                ...prev,
                description: e.target.value.slice(0, 500),
              }))
            }
            placeholder="Describe your token..."
            rows={3}
            className="w-full px-3 py-2 bg-dark-700 border border-dark-600 rounded-lg text-white placeholder-gray-500 focus:border-accent-green focus:outline-none"
          />
          <p className="text-xs text-gray-500 mt-1">{form.description.length}/500</p>
        </div>

        {/* Social Links */}
        <div>
          <h2 className="text-lg font-semibold mb-4">Social Links</h2>
          <div className="space-y-3">
            <div>
              <label className="block text-sm text-gray-400 mb-2">Website</label>
              <input
                type="url"
                value={form.website}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    website: e.target.value,
                  }))
                }
                placeholder="https://example.com"
                className="w-full px-3 py-2 bg-dark-700 border border-dark-600 rounded-lg text-white placeholder-gray-500 focus:border-accent-green focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-2">Twitter/X</label>
              <input
                type="url"
                value={form.twitter}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    twitter: e.target.value,
                  }))
                }
                placeholder="https://x.com/yourhandle"
                className="w-full px-3 py-2 bg-dark-700 border border-dark-600 rounded-lg text-white placeholder-gray-500 focus:border-accent-green focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-2">Telegram</label>
              <input
                type="url"
                value={form.telegram}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    telegram: e.target.value,
                  }))
                }
                placeholder="https://t.me/yourchannel"
                className="w-full px-3 py-2 bg-dark-700 border border-dark-600 rounded-lg text-white placeholder-gray-500 focus:border-accent-green focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* Image Upload */}
        <div>
          <h2 className="text-lg font-semibold mb-4">Token Image</h2>
          {form.imagePreview ? (
            <div className="relative inline-block">
              <img
                src={form.imagePreview}
                alt="Token preview"
                className="w-24 h-24 rounded-lg border border-dark-600"
              />
              <button
                onClick={removeImage}
                className="absolute -top-2 -right-2 bg-red-600 rounded-full p-1 hover:bg-red-700"
              >
                <X className="w-4 h-4 text-white" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full px-4 py-8 border-2 border-dashed border-dark-600 rounded-lg hover:border-accent-green transition-colors flex flex-col items-center justify-center gap-2"
            >
              <Upload className="w-6 h-6 text-gray-400" />
              <span className="text-sm text-gray-400">Click to upload image</span>
              <span className="text-xs text-gray-500">PNG, JPG or GIF</span>
            </button>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleImageSelect}
            className="hidden"
          />
        </div>

        {/* Wallet & Security */}
        <div>
          <h2 className="text-lg font-semibold mb-4">Wallet & Transaction Settings</h2>
          <div className="space-y-3">
            <div>
              <label className="block text-sm text-gray-400 mb-2">
                Private Key (Base58)
              </label>
              <input
                type="password"
                value={form.privatKey}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    privatKey: e.target.value,
                  }))
                }
                placeholder="Enter your wallet private key (base58 encoded)"
                className="w-full px-3 py-2 bg-dark-700 border border-dark-600 rounded-lg text-white placeholder-gray-500 focus:border-accent-green focus:outline-none font-mono text-sm"
              />
              <p className="text-xs text-red-400 mt-2">
                ⚠️ Never share your private key. It will only be used to sign this transaction.
              </p>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm text-gray-400 mb-2">Amount (SOL)</label>
                <input
                  type="number"
                  step="0.01"
                  value={form.amount}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      amount: e.target.value,
                    }))
                  }
                  className="w-full px-3 py-2 bg-dark-700 border border-dark-600 rounded-lg text-white placeholder-gray-500 focus:border-accent-green focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-2">Slippage (%)</label>
                <input
                  type="number"
                  step="0.1"
                  value={form.slippage}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      slippage: e.target.value,
                    }))
                  }
                  className="w-full px-3 py-2 bg-dark-700 border border-dark-600 rounded-lg text-white placeholder-gray-500 focus:border-accent-green focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-2">
                  Priority Fee (SOL)
                </label>
                <input
                  type="number"
                  step="0.0001"
                  value={form.priorityFee}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      priorityFee: e.target.value,
                    }))
                  }
                  className="w-full px-3 py-2 bg-dark-700 border border-dark-600 rounded-lg text-white placeholder-gray-500 focus:border-accent-green focus:outline-none"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Show Name Toggle */}
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={form.showName}
            onChange={(e) =>
              setForm((prev) => ({
                ...prev,
                showName: e.target.checked,
              }))
            }
            className="w-4 h-4 rounded bg-dark-700 border border-dark-600"
          />
          <span className="text-sm text-gray-400">Show token name on PumpFun</span>
        </label>

        {/* Status Messages */}
        {status.status !== 'idle' && (
          <div
            className={`p-4 rounded-lg border ${
              status.status === 'success'
                ? 'bg-green-900/30 border-green-700'
                : status.status === 'error'
                ? 'bg-red-900/30 border-red-700'
                : 'bg-blue-900/30 border-blue-700'
            }`}
          >
            <div className="flex items-center gap-3">
              {status.status === 'success' && (
                <Check className="w-5 h-5 text-green-400 flex-shrink-0" />
              )}
              {status.status === 'error' && (
                <X className="w-5 h-5 text-red-400 flex-shrink-0" />
              )}
              {['uploading', 'creating', 'signing'].includes(status.status) && (
                <Loader2 className="w-5 h-5 animate-spin text-blue-400 flex-shrink-0" />
              )}
              <span className="text-sm">{status.message}</span>
            </div>
            {status.explorerUrl && (
              <a
                href={status.explorerUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 flex items-center gap-2 text-blue-400 hover:text-blue-300 text-sm"
              >
                View on Solscan <ExternalLink className="w-4 h-4" />
              </a>
            )}
          </div>
        )}

        {/* Create Button */}
        <button
          onClick={handleCreate}
          disabled={status.status !== 'idle'}
          className="w-full py-3 bg-accent-green text-dark-900 rounded-lg font-bold hover:bg-green-400 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-all"
        >
          {status.status !== 'idle' ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              {status.status === 'uploading' && 'Uploading...'}
              {status.status === 'creating' && 'Creating...'}
              {status.status === 'signing' && 'Signing...'}
              {status.status === 'success' && 'Success!'}
              {status.status === 'error' && 'Error!'}
            </>
          ) : (
            'Create Token'
          )}
        </button>
      </div>

      {/* Security Notice */}
      <div className="mt-6 p-4 bg-yellow-900/20 border border-yellow-700/50 rounded-lg">
        <h3 className="font-semibold text-yellow-400 mb-2">Security Notice</h3>
        <ul className="text-sm text-yellow-200 space-y-1 list-disc list-inside">
          <li>Never share your private key with anyone</li>
          <li>This form only signs transactions locally in your browser</li>
          <li>Your private key is never sent to our servers</li>
          <li>Clear your browser cache after using this form</li>
          <li>Use a dedicated wallet for testing purposes</li>
        </ul>
      </div>
    </div>
  )
}
