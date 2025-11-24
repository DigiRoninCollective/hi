import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Activity,
  Bell,
  Bot,
  Cpu,
  LayoutDashboard,
  Loader2,
  MessageCircle,
  PlayCircle,
  PlugZap,
  Radio,
  Rocket,
  Settings,
  Shield,
  Wallet,
  Zap,
} from 'lucide-react'

type Status = 'ok' | 'warn' | 'down'

interface WalletInfo {
  address?: string
  balance?: number
}

interface FeedItem {
  id: string
  source: string
  message: string
  ts: string
  severity: 'info' | 'warn' | 'alert'
}

export default function ControlCenterPage() {
  const navigate = useNavigate()
  const [wallet, setWallet] = useState<WalletInfo>({})
  const [walletLoading, setWalletLoading] = useState(true)
  const [rpcStatus, setRpcStatus] = useState<Status>('warn')
  const [botRunning, setBotRunning] = useState(false)
  const [groqEnabled, setGroqEnabled] = useState(true)
  const [autoDeploy, setAutoDeploy] = useState(false)
  const [mayhemMode, setMayhemMode] = useState(false)
  const [notifications, setNotifications] = useState(true)
  const [feed, setFeed] = useState<FeedItem[]>([])

  useEffect(() => {
    const loadWallet = async () => {
      setWalletLoading(true)
      try {
        const res = await fetch('/api/wallet')
        if (res.ok) {
          const data = await res.json()
          setWallet({ address: data.address, balance: data.balance })
        }
      } catch {
        setWallet({})
      } finally {
        setWalletLoading(false)
      }
    }

    const loadStatus = async () => {
      try {
        const res = await fetch('/api/status')
        if (res.ok) {
          const data = await res.json()
          setRpcStatus(data.ok ? 'ok' : 'warn')
        } else {
          setRpcStatus('warn')
        }
      } catch {
        setRpcStatus('down')
      }
    }

    loadWallet()
    loadStatus()

    // Telegram SSE feed (best effort)
    const source = new EventSource('/events/telegram:message')
    const handler = (event: MessageEvent) => {
      try {
        const payload = JSON.parse(event.data)
        const data = payload.data || {}
        const message = data.content || data.message || data.text
        if (!message) return
        setFeed((prev) => [
          {
            id: payload.id || data.messageId || Date.now().toString(),
            source: 'Telegram',
            message,
            ts: data.createdAt ? new Date(data.createdAt).toLocaleTimeString() : new Date().toLocaleTimeString(),
            severity: (data.severity as FeedItem['severity']) || 'info',
          },
          ...prev.slice(0, 49),
        ])
      } catch {
        // ignore malformed event
      }
    }
    source.addEventListener('message', handler)
    source.onerror = () => {
      source.close()
    }

    return () => {
      source.close()
    }
  }, [])

  const statusDot = (status: Status) => {
    if (status === 'ok') return 'bg-accent-green'
    if (status === 'warn') return 'bg-amber-400'
    return 'bg-red-500'
  }

  const toggleBot = async () => {
    const next = !botRunning
    setBotRunning(next)
    try {
      await fetch(`/api/bot/${next ? 'start' : 'stop'}`, { method: 'POST' })
    } catch {
      // ignore backend unavailability
    }
  }

  const quickActions = useMemo(
    () => [
      { title: 'Deploy token', icon: Rocket, action: () => navigate('/deploy') },
      { title: botRunning ? 'Pause bot' : 'Start bot', icon: botRunning ? Shield : PlayCircle, action: () => toggleBot() },
      { title: 'Open feed', icon: MessageCircle, action: () => navigate('/feed') },
      { title: 'Wallets', icon: Wallet, action: () => navigate('/settings') },
    ],
    [botRunning, navigate]
  )

  const addMockEvent = () => {
    const id = Date.now().toString()
    setFeed((prev) => [
      {
        id,
        source: 'Telegram',
        message: 'New alpha ping added to queue',
        ts: 'just now',
        severity: 'info',
      },
      ...prev,
    ])
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 text-accent-green">
            <LayoutDashboard className="w-5 h-5" />
            <span className="text-sm font-semibold uppercase tracking-wide">Control Center</span>
          </div>
          <h1 className="text-3xl font-bold mt-1">Desktop command deck</h1>
          <p className="text-gray-400 mt-1">
            Full control of wallets, Groq, Telegram feeds, and launch preferences in one view.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => toggleBot()}
            className={`px-4 py-2 rounded-lg flex items-center gap-2 font-semibold transition ${
              botRunning ? 'bg-red-500/20 text-red-200 border border-red-500/40' : 'bg-accent-green text-dark-900'
            }`}
          >
            {botRunning ? <Shield className="w-4 h-4" /> : <PlayCircle className="w-4 h-4" />}
            {botRunning ? 'Pause Bot' : 'Start Bot'}
          </button>
          <button
            onClick={addMockEvent}
            className="px-4 py-2 rounded-lg border border-dark-600 text-sm text-gray-200 hover:border-accent-green transition"
          >
            Inject feed ping
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-dark-800 border border-dark-700 rounded-xl p-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Wallet className="w-5 h-5 text-accent-green" />
              <span className="font-semibold">Wallet</span>
            </div>
            <span className="text-xs text-gray-500 uppercase tracking-wide">Primary</span>
          </div>
          {walletLoading ? (
            <div className="flex items-center gap-2 text-gray-400">
              <Loader2 className="w-4 h-4 animate-spin" />
              Loading wallet...
            </div>
          ) : (
            <>
              <div className="text-3xl font-bold mb-1">
                {wallet.balance !== undefined ? wallet.balance.toFixed(3) : '--'} <span className="text-lg text-gray-400">SOL</span>
              </div>
              <div className="text-sm text-gray-400 truncate">
                {wallet.address || 'No wallet connected'}
              </div>
              <div className="flex items-center gap-2 mt-3">
                <button className="flex-1 py-2 rounded-lg bg-accent-green text-dark-900 font-semibold">Swap</button>
                <button className="flex-1 py-2 rounded-lg border border-dark-600 hover:border-accent-green transition text-sm">Fund</button>
              </div>
            </>
          )}
        </div>

        <div className="bg-dark-800 border border-dark-700 rounded-xl p-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Cpu className="w-5 h-5 text-indigo-300" />
              <span className="font-semibold">Groq</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-400">
              <div className={`w-2 h-2 rounded-full ${groqEnabled ? 'bg-accent-green' : 'bg-gray-500'}`} />
              {groqEnabled ? 'Enabled' : 'Disabled'}
            </div>
          </div>
          <p className="text-sm text-gray-400 mb-3">
            AI assist for names, tickers, and routing. Adjust on/off and guardrails.
          </p>
          <div className="space-y-2">
            <label className="flex items-center justify-between text-sm">
              <span>Groq suggestions</span>
              <input
                type="checkbox"
                className="toggle"
                checked={groqEnabled}
                onChange={(e) => setGroqEnabled(e.target.checked)}
              />
            </label>
            <label className="flex items-center justify-between text-sm">
              <span>Auto-deploy approved</span>
              <input
                type="checkbox"
                className="toggle"
                checked={autoDeploy}
                onChange={(e) => setAutoDeploy(e.target.checked)}
              />
            </label>
            <label className="flex items-center justify-between text-sm">
              <span>Mayhem mode</span>
              <input
                type="checkbox"
                className="toggle"
                checked={mayhemMode}
                onChange={(e) => setMayhemMode(e.target.checked)}
              />
            </label>
          </div>
        </div>

        <div className="bg-dark-800 border border-dark-700 rounded-xl p-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Activity className="w-5 h-5 text-amber-300" />
              <span className="font-semibold">System</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-400">
              <div className={`w-2 h-2 rounded-full ${statusDot(rpcStatus)}`} />
              <span>{rpcStatus === 'ok' ? 'Healthy' : rpcStatus === 'warn' ? 'Degraded' : 'Down'}</span>
            </div>
          </div>
          <div className="space-y-2 text-sm text-gray-300">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2"><Radio className="w-4 h-4 text-accent-green" /> RPC</span>
              <span className="text-gray-400">{rpcStatus.toUpperCase()}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2"><PlugZap className="w-4 h-4 text-indigo-300" /> Webhooks</span>
              <span className="text-gray-400">Active</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2"><Bell className="w-4 h-4 text-amber-300" /> Alerts</span>
              <input
                type="checkbox"
                className="toggle"
                checked={notifications}
                onChange={(e) => setNotifications(e.target.checked)}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-dark-800 border border-dark-700 rounded-xl p-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <MessageCircle className="w-5 h-5 text-cyan-300" />
              <span className="font-semibold">Telegram feed</span>
            </div>
            <button
              onClick={addMockEvent}
              className="text-sm text-accent-green hover:underline"
            >
              Refresh
            </button>
          </div>
          <div className="space-y-2 max-h-72 overflow-auto pr-1">
            {feed.map((item) => (
              <div
                key={item.id}
                className="border border-dark-700 rounded-lg p-3 bg-dark-900/60"
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="font-semibold text-white">{item.source}</span>
                    <span className="text-gray-500">{item.ts}</span>
                  </div>
                  <span
                    className={`text-xs px-2 py-1 rounded-full ${
                      item.severity === 'alert'
                        ? 'bg-red-500/20 text-red-200'
                        : item.severity === 'warn'
                        ? 'bg-amber-500/20 text-amber-200'
                        : 'bg-accent-green/20 text-accent-green'
                    }`}
                  >
                    {item.severity.toUpperCase()}
                  </span>
                </div>
                <p className="text-sm text-gray-200">{item.message}</p>
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between mt-3">
            <div className="flex items-center gap-2 text-sm text-gray-400">
            </div>
            <label className="flex items-center gap-2 text-sm">
              <span>Ingest to auto-deploy</span>
              <input
                type="checkbox"
                className="toggle"
                checked={autoDeploy}
                onChange={(e) => setAutoDeploy(e.target.checked)}
              />
            </label>
          </div>
        </div>

        <div className="space-y-4">
          <div className="bg-dark-800 border border-dark-700 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <Zap className="w-5 h-5 text-accent-green" />
              <span className="font-semibold">Quick actions</span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {quickActions.map((action) => {
                const Icon = action.icon
                return (
                  <button
                    key={action.title}
                    onClick={action.action}
                    className="p-3 rounded-lg border border-dark-700 hover:border-accent-green hover:-translate-y-0.5 transition bg-dark-900 text-left"
                  >
                    <Icon className="w-4 h-4 mb-2 text-accent-green" />
                    <div className="text-sm font-semibold">{action.title}</div>
                  </button>
                )
              })}
            </div>
          </div>

          <div className="bg-dark-800 border border-dark-700 rounded-xl p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Settings className="w-5 h-5 text-gray-300" />
              <span className="font-semibold">Preferences</span>
            </div>
            <label className="flex items-center justify-between text-sm">
              <span>Desktop layout</span>
              <span className="text-gray-400">Fluid</span>
            </label>
            <label className="flex items-center justify-between text-sm">
              <span>Notifications</span>
              <input
                type="checkbox"
                className="toggle"
                checked={notifications}
                onChange={(e) => setNotifications(e.target.checked)}
              />
            </label>
            <label className="flex items-center justify-between text-sm">
              <span>Default priority fee</span>
              <span className="text-gray-400">0.0005</span>
            </label>
            <label className="flex items-center justify-between text-sm">
              <span>Default slippage</span>
              <span className="text-gray-400">10 bps</span>
            </label>
          </div>

          <div className="bg-dark-800 border border-dark-700 rounded-xl p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Bot className="w-5 h-5 text-cyan-300" />
              <span className="font-semibold">Pipelines</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span>Twitter stream</span>
              <div className="flex items-center gap-2 text-gray-400">
                <div className="w-2 h-2 rounded-full bg-accent-green" />
                Live
              </div>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span>Telegram alpha</span>
              <div className="flex items-center gap-2 text-gray-400">
                <div className="w-2 h-2 rounded-full bg-accent-green" />
                Ingesting
              </div>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span>Groq suggestions</span>
              <div className="flex items-center gap-2 text-gray-400">
                <div className="w-2 h-2 rounded-full bg-indigo-300" />
                {groqEnabled ? 'On' : 'Off'}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}