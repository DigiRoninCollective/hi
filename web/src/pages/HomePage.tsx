import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useWallet } from '@solana/wallet-adapter-react'
import { useWalletModal } from '@solana/wallet-adapter-react-ui'
import {
  Rocket,
  MessageSquare,
  Zap,
  Shield,
  Globe,
  TrendingUp,
  Wallet,
  KeyRound,
  Send,
  Loader2,
} from 'lucide-react'
import { openExternal } from '../utils/electron'

interface Stats {
  tokensLaunched: number
  tweetsProcessed: number
  activeConnections: number
  successRate: number
}

export default function HomePage() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [walletModalOpen, setWalletModalOpen] = useState(false)

  const navigate = useNavigate()
  const { connected, connecting, publicKey, disconnect } = useWallet()
  const { setVisible: setWalletModalVisible } = useWalletModal()

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await fetch('/api/stats')
        if (res.ok) {
          const data = await res.json()
          setStats({
            tokensLaunched: data.tokensCreated || 0,
            tweetsProcessed: data.tweetsProcessed || 0,
            activeConnections: data.sseClients || 0,
            successRate: data.successRate || 0,
          })
        }
      } catch {
        // Ignore errors
      }
    }

    fetchStats()
    const interval = setInterval(fetchStats, 5000)
    return () => clearInterval(interval)
  }, [])

  const googleAuthUrl = import.meta.env.VITE_GOOGLE_AUTH_URL || '/api/auth/google'
  const telegramAuthUrl =
    import.meta.env.VITE_TELEGRAM_AUTH_URL || 'https://t.me/your_bot_username_here'

  const triggerGoogleAuth = () => {
    openExternal(googleAuthUrl)
  }

  const triggerTelegramAuth = () => {
    openExternal(telegramAuthUrl)
  }

  const features = [
    {
      icon: Rocket,
      title: 'Instant Token Deploy',
      description: 'Deploy tokens to PumpFun with one click. Set name, symbol, image, and buy amount.',
    },
    {
      icon: MessageSquare,
      title: 'Live Twitter Feed',
      description: 'Monitor Twitter accounts in real-time. Discord/Telegram-style interface.',
    },
    {
      icon: Zap,
      title: 'Auto-Launch',
      description: 'Automatically launch tokens when monitored accounts tweet launch commands.',
    },
    {
      icon: Shield,
      title: 'Spam Filter',
      description: 'AI-powered classifier filters spam and risky tweets automatically.',
    },
    {
      icon: Globe,
      title: 'Multi-Platform',
      description: 'Support for PumpFun, with more platforms coming soon.',
    },
    {
      icon: TrendingUp,
      title: 'Real-Time Updates',
      description: 'SSE streaming for instant notifications on token launches and events.',
    },
  ]

  return (
    <div className="space-y-12">
      {/* Hero Section */}
      <section className="grid lg:grid-cols-2 gap-10 items-center py-12">
        <div className="text-left space-y-6">
          <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.25em] text-accent-green bg-accent-green/10 px-3 py-2 rounded-full">
            <Rocket className="w-4 h-4" />
            PumpLauncher
          </p>
          <h1 className="text-5xl font-bold leading-tight">
            Launch Tokens on <span className="text-accent-green">PumpFun</span> with real-time intel.
          </h1>
          <p className="text-lg text-gray-400 max-w-2xl">
            The fastest way to deploy and trade. Monitor Twitter, auto-launch, and track everything in a Discord-style feed.
          </p>
          <div className="flex flex-wrap items-center gap-4">
            <Link
              to="/deploy"
              className="flex items-center gap-2 bg-accent-green text-dark-900 px-6 py-3 rounded-xl font-semibold hover:bg-green-400 transition-colors"
            >
              <Rocket className="w-5 h-5" />
              Deploy Token
            </Link>
            <Link
              to="/feed"
              className="flex items-center gap-2 bg-dark-700 text-white px-6 py-3 rounded-xl font-semibold hover:bg-dark-600 transition-colors border border-dark-500"
            >
              <MessageSquare className="w-5 h-5" />
              View Live Feed
            </Link>
          </div>
        </div>

        {/* Auth entry */}
        <div className="bg-dark-800 border border-dark-600 rounded-2xl p-6 shadow-xl space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-400">Get in fast</p>
              <h3 className="text-xl font-semibold">Sign in or connect</h3>
            </div>
            <KeyRound className="w-6 h-6 text-accent-green" />
          </div>

          <div className="space-y-3">
            <div>
              <label className="block text-xs text-gray-400 mb-1">USERNAME</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="satoshi"
                className="w-full"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">PASSWORD</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="•••••••"
                className="w-full"
              />
            </div>
            <button
              onClick={() => navigate('/login')}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-accent-green text-dark-900 rounded-lg font-bold hover:bg-green-400 transition-colors"
            >
              <KeyRound className="w-4 h-4" />
              Continue with username
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => setWalletModalOpen(true)}
              className="flex items-center justify-center gap-2 px-3 py-3 bg-dark-700 border border-dark-500 rounded-lg hover:bg-dark-600"
            >
              <Wallet className="w-4 h-4 text-accent-green" />
              Wallet Connect
            </button>
            <button
              onClick={triggerGoogleAuth}
              className="flex items-center justify-center gap-2 px-3 py-3 bg-dark-700 border border-dark-500 rounded-lg hover:bg-dark-600"
            >
              <Send className="w-4 h-4 text-blue-400" />
              Google
            </button>
            <button
              onClick={triggerTelegramAuth}
              className="flex items-center justify-center gap-2 px-3 py-3 bg-dark-700 border border-dark-500 rounded-lg hover:bg-dark-600"
            >
              <MessageSquare className="w-4 h-4 text-sky-400" />
              Telegram
            </button>
            <button
              onClick={() => navigate('/register')}
              className="flex items-center justify-center gap-2 px-3 py-3 bg-dark-700 border border-dark-500 rounded-lg hover:bg-dark-600"
            >
              <Shield className="w-4 h-4 text-accent-green" />
              Create Account
            </button>
          </div>

          <p className="text-xs text-gray-500 text-center">
            You can also continue as guest and switch to demo feed if you just want to preview the UI.
          </p>
        </div>
      </section>

      {/* Features Grid */}
      <section>
        <h2 className="text-2xl font-bold text-center mb-8">Features</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature, index) => {
            const Icon = feature.icon
            return (
              <div
                key={index}
                className="bg-dark-800 rounded-xl p-6 border border-dark-600 hover:border-dark-500 transition-colors"
              >
                <div className="w-12 h-12 bg-dark-700 rounded-lg flex items-center justify-center mb-4">
                  <Icon className="w-6 h-6 text-accent-green" />
                </div>
                <h3 className="text-lg font-semibold mb-2">{feature.title}</h3>
                <p className="text-gray-400">{feature.description}</p>
              </div>
            )
          })}
        </div>
      </section>

      {/* Stats Section */}
      <section className="bg-dark-800 rounded-xl p-8 border border-dark-600">
        <h2 className="text-2xl font-bold text-center mb-8">Live Stats</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          <StatCard label="Tokens Launched" value={stats ? stats.tokensLaunched.toString() : '--'} />
          <StatCard label="Tweets Processed" value={stats ? stats.tweetsProcessed.toString() : '--'} />
          <StatCard label="Active Connections" value={stats ? stats.activeConnections.toString() : '--'} />
          <StatCard label="Success Rate" value={stats ? `${Math.round(stats.successRate)}%` : '--%'} />
        </div>
      </section>

      {/* Wallet Connect Modal */}
      {walletModalOpen && (
        <div className="fixed inset-0 bg-black/70 z-40 flex items-center justify-center px-4">
          <div className="bg-dark-800 border border-dark-600 rounded-2xl p-6 w-full max-w-md shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Wallet className="w-5 h-5 text-accent-green" />
                Connect a wallet
              </h3>
              <button
                onClick={() => {
                  setWalletModalOpen(false)
                }}
                className="text-gray-400 hover:text-white"
              >
                ×
              </button>
            </div>

            <div className="grid grid-cols-1 gap-3">
              <button
                onClick={() => setWalletModalVisible(true)}
                className="flex items-center justify-between px-4 py-3 rounded-xl bg-dark-700 hover:bg-dark-600 border border-dark-500"
              >
                <div className="flex items-center gap-3">
                  <span className="text-xl">🟣</span>
                  <div className="text-left">
                    <div className="font-semibold">Select a wallet</div>
                    <div className="text-xs text-gray-400">Phantom, Backpack, Solflare, more</div>
                  </div>
                </div>
                {connecting && <Loader2 className="w-4 h-4 animate-spin text-accent-green" />}
              </button>

              <button
                onClick={() => openExternal('https://station.jup.ag/')}
                className="flex items-center justify-between px-4 py-3 rounded-xl bg-dark-700 hover:bg-dark-600 border border-dark-500"
              >
                <div className="flex items-center gap-3">
                  <span className="text-xl">🟢</span>
                  <div className="text-left">
                    <div className="font-semibold">Jupiter Station</div>
                    <div className="text-xs text-gray-400">Open Station to link</div>
                  </div>
                </div>
              </button>
            </div>

            {connected && publicKey && (
              <div className="text-sm text-accent-green bg-accent-green/10 border border-accent-green/30 rounded-lg px-3 py-2">
                Connected: {publicKey.toBase58().slice(0, 6)}...{publicKey.toBase58().slice(-4)}
              </div>
            )}

            {connected && (
              <button
                onClick={() => disconnect()}
                className="w-full px-4 py-2 rounded-lg border border-dark-500 hover:border-accent-green text-sm text-gray-200"
              >
                Disconnect
              </button>
            )}

            <p className="text-xs text-gray-500">
              Connecting will request signature permission from your wallet extension. We do not store your keys.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-center">
      <div className="text-3xl font-bold text-accent-green mb-1">{value}</div>
      <div className="text-gray-400 text-sm">{label}</div>
    </div>
  )
}
