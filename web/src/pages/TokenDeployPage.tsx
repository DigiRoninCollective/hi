import { useState, useRef, useCallback } from 'react'
import {
  Rocket,
  Upload,
  Image,
  Clipboard,
  Search,
  X,
  Loader2,
  Check,
  ExternalLink,
  Sparkles,
} from 'lucide-react'

type Platform = 'pump' | 'bonk' | 'bags' | 'bnb' | 'usd1'

interface TokenForm {
  name: string
  symbol: string
  description: string
  website: string
  twitterUrl: string
  platform: Platform
  buyAmount: string
  mayhemMode: boolean
  multiDeploy: boolean
  deployCount: number
  autoSell: boolean
  imageFile: File | null
  imagePreview: string | null
}

interface DeployStatus {
  status: 'idle' | 'deploying' | 'success' | 'error'
  message: string
  mint?: string
  signature?: string
}

export default function TokenDeployPage() {
  const [form, setForm] = useState<TokenForm>({
    name: '',
    symbol: '',
    description: '',
    website: '',
    twitterUrl: '',
    platform: 'pump',
    buyAmount: '0.1',
    mayhemMode: false,
    multiDeploy: false,
    deployCount: 1,
    autoSell: false,
    imageFile: null,
    imagePreview: null,
  })

  const [autoGenerateTicker, setAutoGenerateTicker] = useState(true)
  const [deployStatus, setDeployStatus] = useState<DeployStatus>({
    status: 'idle',
    message: '',
  })

  const fileInputRef = useRef<HTMLInputElement>(null)

  const platforms: { id: Platform; label: string; icon: string; color: string }[] = [
    { id: 'pump', label: 'Pump', icon: '🚀', color: 'bg-green-600' },
    { id: 'bonk', label: 'BONK', icon: '🐕', color: 'bg-orange-500' },
    { id: 'bags', label: 'Bags', icon: '💰', color: 'bg-gray-600' },
    { id: 'bnb', label: 'BNB', icon: '🟡', color: 'bg-yellow-500' },
    { id: 'usd1', label: 'USD1', icon: '💵', color: 'bg-blue-500' },
  ]

  const handleNameChange = (name: string) => {
    setForm((prev) => ({
      ...prev,
      name,
      symbol: autoGenerateTicker ? generateTicker(name) : prev.symbol,
    }))
  }

  const generateTicker = (name: string): string => {
    return name
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '')
      .slice(0, 10)
  }

  const handleImageDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file && file.type.startsWith('image/')) {
      processImageFile(file)
    }
  }, [])

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      processImageFile(file)
    }
  }

  const processImageFile = (file: File) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      setForm((prev) => ({
        ...prev,
        imageFile: file,
        imagePreview: e.target?.result as string,
      }))
    }
    reader.readAsDataURL(file)
  }

  const handlePasteFromClipboard = async () => {
    try {
      const items = await navigator.clipboard.read()
      for (const item of items) {
        const imageType = item.types.find((type) => type.startsWith('image/'))
        if (imageType) {
          const blob = await item.getType(imageType)
          const file = new File([blob], 'pasted-image.png', { type: imageType })
          processImageFile(file)
          break
        }
      }
    } catch (err) {
      console.error('Failed to paste from clipboard:', err)
    }
  }

  const removeImage = () => {
    setForm((prev) => ({
      ...prev,
      imageFile: null,
      imagePreview: null,
    }))
  }

  const handleDeploy = async () => {
    if (!form.name || !form.symbol) {
      setDeployStatus({
        status: 'error',
        message: 'Please enter token name and symbol',
      })
      return
    }

    setDeployStatus({ status: 'deploying', message: 'Creating token...' })

    try {
      const formData = new FormData()
      formData.append('name', form.name)
      formData.append('symbol', form.symbol)
      formData.append('description', form.description || `${form.symbol} - Launched via PumpLauncher`)
      formData.append('website', form.website)
      formData.append('twitterUrl', form.twitterUrl)
      formData.append('platform', form.platform)
      formData.append('buyAmount', form.buyAmount)
      if (form.imageFile) {
        formData.append('image', form.imageFile)
      }

      const response = await fetch('/api/tokens/create', {
        method: 'POST',
        body: formData,
      })

      const result = await response.json()

      if (response.ok && result.success) {
        setDeployStatus({
          status: 'success',
          message: 'Token created successfully!',
          mint: result.mint,
          signature: result.signature,
        })
      } else {
        setDeployStatus({
          status: 'error',
          message: result.error || 'Failed to create token',
        })
      }
    } catch (error) {
      setDeployStatus({
        status: 'error',
        message: 'Network error. Make sure the backend is running.',
      })
    }
  }

  return (
    <div className="max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Rocket className="w-6 h-6 text-accent-green" />
          Token Deploy
        </h1>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-accent-green pulse" />
          <span className="text-sm text-gray-400">Connected</span>
        </div>
      </div>

      {/* Deploy Form */}
      <div className="bg-dark-800 rounded-xl border border-dark-600 p-6 space-y-6">
        {/* Name & Symbol */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-gray-400 mb-2">
              NAME <span className="text-gray-600">{form.name.length}/32</span>
            </label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => handleNameChange(e.target.value.slice(0, 32))}
              placeholder="My Token Name"
              className="w-full"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-2">
              SYMBOL <span className="text-gray-600">{form.symbol.length}/10</span>
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
              placeholder="TICKER"
              className="w-full"
            />
          </div>
        </div>

        {/* Auto-generate ticker */}
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={autoGenerateTicker}
            onChange={(e) => setAutoGenerateTicker(e.target.checked)}
            className="w-4 h-4 rounded bg-dark-700 border-dark-500 text-accent-green focus:ring-accent-green"
          />
          <span className="text-sm text-gray-400">Auto-generate ticker when typing name</span>
        </label>

        {/* Description */}
        <div>
          <label className="block text-sm text-gray-400 mb-2">DESCRIPTION (OPTIONAL)</label>
          <textarea
            value={form.description}
            onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
            placeholder="Describe your token..."
            rows={3}
            className="w-full resize-none"
          />
        </div>

        {/* Website & Twitter */}
        <div className="grid grid-cols-1 gap-4">
          <div>
            <label className="block text-sm text-gray-400 mb-2">WEBSITE (OPTIONAL)</label>
            <input
              type="url"
              value={form.website}
              onChange={(e) => setForm((prev) => ({ ...prev, website: e.target.value }))}
              placeholder="https://example.com"
              className="w-full"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-2">TWITTER URL</label>
            <input
              type="url"
              value={form.twitterUrl}
              onChange={(e) => setForm((prev) => ({ ...prev, twitterUrl: e.target.value }))}
              placeholder="https://x.com/username"
              className="w-full"
            />
          </div>
        </div>

        {/* Platform Selection & Buy Amount */}
        <div className="flex items-end gap-4">
          <div className="flex-1">
            <label className="block text-sm text-gray-400 mb-2">PLATFORM</label>
            <div className="flex flex-wrap gap-2">
              {platforms.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setForm((prev) => ({ ...prev, platform: p.id }))}
                  className={`platform-btn ${p.color} ${
                    form.platform === p.id ? 'selected' : 'opacity-60 hover:opacity-100'
                  }`}
                >
                  <span>{p.icon}</span>
                  <span>{p.label}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="w-24">
            <label className="block text-sm text-gray-400 mb-2 text-right">
              BUY AMOUNT
              <br />
              <span className="text-xs">(SOL)</span>
            </label>
            <input
              type="number"
              value={form.buyAmount}
              onChange={(e) => setForm((prev) => ({ ...prev, buyAmount: e.target.value }))}
              step="0.1"
              min="0"
              className="w-full text-center"
            />
          </div>
        </div>

        {/* Mayhem Mode & Multi-Deploy */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setForm((prev) => ({ ...prev, mayhemMode: !prev.mayhemMode }))}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                form.mayhemMode
                  ? 'bg-purple-600 text-white'
                  : 'bg-dark-700 text-gray-400 hover:text-white'
              }`}
            >
              <Sparkles className="w-4 h-4" />
              MAYHEM MODE
              <div className={`toggle ${form.mayhemMode ? 'active' : ''}`} />
            </button>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-400">MULTI-DEPLOY</span>
            <div
              onClick={() => setForm((prev) => ({ ...prev, multiDeploy: !prev.multiDeploy }))}
              className={`toggle ${form.multiDeploy ? 'active' : ''}`}
            />
            {form.multiDeploy && (
              <input
                type="number"
                value={form.deployCount}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, deployCount: parseInt(e.target.value) || 1 }))
                }
                min="1"
                max="10"
                className="w-12 text-center"
              />
            )}
          </div>
        </div>

        {/* Image Upload */}
        <div>
          <label className="block text-sm text-gray-400 mb-2">
            IMAGE UPLOAD OPTIONS
            <span className="float-right">{form.imageFile ? '1 image' : '0 images'}</span>
          </label>

          {form.imagePreview ? (
            <div className="relative inline-block">
              <img
                src={form.imagePreview}
                alt="Token preview"
                className="w-32 h-32 object-cover rounded-lg border border-dark-500"
              />
              <button
                onClick={removeImage}
                className="absolute -top-2 -right-2 bg-red-500 rounded-full p-1 hover:bg-red-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div
              onDrop={handleImageDrop}
              onDragOver={(e) => e.preventDefault()}
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-dark-500 rounded-lg p-8 text-center cursor-pointer hover:border-dark-400 transition-colors"
            >
              <Upload className="w-8 h-8 mx-auto mb-2 text-gray-500" />
              <p className="text-gray-400 text-sm">
                Click to upload or drag image
                <br />
                anywhere in deploy overlay!
              </p>
            </div>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleImageSelect}
            className="hidden"
          />

          {/* Image action buttons */}
          <div className="flex gap-2 mt-3">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-2 px-4 py-2 bg-dark-700 rounded-lg text-sm hover:bg-dark-600"
            >
              <Image className="w-4 h-4" />
              Image Library
            </button>
            <button
              onClick={handlePasteFromClipboard}
              className="flex items-center gap-2 px-4 py-2 bg-dark-700 rounded-lg text-sm hover:bg-dark-600"
            >
              <Clipboard className="w-4 h-4" />
              Paste from Clipboard
            </button>
            <button className="flex items-center gap-2 px-4 py-2 bg-dark-700 rounded-lg text-sm hover:bg-dark-600">
              <Search className="w-4 h-4" />
            </button>
            <div className="flex-1" />
            <button
              onClick={() => setForm((prev) => ({ ...prev, autoSell: !prev.autoSell }))}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm ${
                form.autoSell
                  ? 'bg-accent-green text-dark-900'
                  : 'bg-dark-700 text-gray-400 hover:text-white'
              }`}
            >
              💰 Auto-sell
              <span className={`text-xs px-2 py-0.5 rounded ${form.autoSell ? 'bg-dark-900/30' : 'bg-dark-600'}`}>
                {form.autoSell ? 'ON' : 'OFF'}
              </span>
            </button>
          </div>
        </div>

        {/* Deploy Buttons */}
        <div className="flex gap-3">
          <button className="px-6 py-3 bg-accent-green text-dark-900 rounded-lg font-bold hover:bg-green-400">
            LETTER
          </button>
          <button className="px-6 py-3 bg-dark-600 text-white rounded-lg font-bold hover:bg-dark-500">
            ASCII
          </button>
          <button
            onClick={handleDeploy}
            disabled={deployStatus.status === 'deploying'}
            className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-accent-green text-dark-900 rounded-lg font-bold hover:bg-green-400 disabled:opacity-50"
          >
            {deployStatus.status === 'deploying' ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Deploying...
              </>
            ) : (
              <>
                <Rocket className="w-5 h-5" />
                Deploy (Enter)
              </>
            )}
          </button>
          <button className="px-6 py-3 bg-dark-700 text-white rounded-lg font-bold hover:bg-dark-600 flex items-center gap-2">
            <span className="grid grid-cols-2 gap-0.5">
              <span className="w-1.5 h-1.5 bg-current rounded-sm" />
              <span className="w-1.5 h-1.5 bg-current rounded-sm" />
              <span className="w-1.5 h-1.5 bg-current rounded-sm" />
              <span className="w-1.5 h-1.5 bg-current rounded-sm" />
            </span>
            Bundle
          </button>
        </div>

        {/* Status Message */}
        {deployStatus.status !== 'idle' && (
          <div
            className={`p-4 rounded-lg ${
              deployStatus.status === 'success'
                ? 'bg-green-900/30 border border-green-700'
                : deployStatus.status === 'error'
                ? 'bg-red-900/30 border border-red-700'
                : 'bg-blue-900/30 border border-blue-700'
            }`}
          >
            <div className="flex items-center gap-2">
              {deployStatus.status === 'success' && <Check className="w-5 h-5 text-green-400" />}
              {deployStatus.status === 'error' && <X className="w-5 h-5 text-red-400" />}
              {deployStatus.status === 'deploying' && (
                <Loader2 className="w-5 h-5 text-blue-400 animate-spin" />
              )}
              <span>{deployStatus.message}</span>
            </div>
            {deployStatus.mint && (
              <div className="mt-2 space-y-1 text-sm">
                <a
                  href={`https://pump.fun/${deployStatus.mint}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-accent-green hover:underline"
                >
                  View on PumpFun <ExternalLink className="w-3 h-3" />
                </a>
                <a
                  href={`https://solscan.io/tx/${deployStatus.signature}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-blue-400 hover:underline"
                >
                  View Transaction <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
