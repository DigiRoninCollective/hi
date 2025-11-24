import { useState, useEffect, useRef } from 'react'
import {
  MessageSquare,
  Rocket,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Filter,
  Bell,
  BellOff,
  Trash2,
  ExternalLink,
  Twitter,
  RefreshCw,
  Loader2,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'

interface FeedEvent {
  id: string
  type: string
  timestamp: string
  data: Record<string, any>
}

interface FilterState {
  tweets: boolean
  launches: boolean
  alerts: boolean
  system: boolean
}

interface WatchedAccount {
  id: string
  twitter_username: string
  is_active: boolean
}

interface LaunchPreferences {
  initialBuySol: number
  slippage: number
  priorityFee: number
  autoDeploy: boolean
  mayhemMode: boolean
  enableMulti: boolean
  walletsToUse: number
  maxPerWallet: number
  varianceBps: number
  jitterMs: number
  autoTopUp: boolean
  minBalance: number
  topUpAmount: number
}

interface GroqSuggestion {
  ticker: string
  name: string
  description?: string
  website?: string
  twitterHandle?: string
  imageUrl?: string
  bannerUrl?: string
  avatarUrl?: string
}

const demoEvents: FeedEvent[] = [
  {
    id: 'demo-1',
    type: 'tweet_received',
    timestamp: new Date(Date.now() - 1000 * 60).toISOString(),
    data: {
      tweetId: '1234567890',
      authorUsername: 'elonmusk',
      text: 'Let’s see what happens when we $LAUNCH MARSCOIN today 🚀',
    },
  },
  {
    id: 'demo-2',
    type: 'launch_detected',
    timestamp: new Date(Date.now() - 1000 * 45).toISOString(),
    data: {
      ticker: 'MARS',
      name: 'Mars Coin',
      confidence: 0.92,
    },
  },
  {
    id: 'demo-3',
    type: 'token_created',
    timestamp: new Date(Date.now() - 1000 * 35).toISOString(),
    data: {
      ticker: 'MARS',
      name: 'Mars Coin',
      mint: 'F1eetB3y0nd1234567890SPACE',
      signature: '4x9...abc',
    },
  },
  {
    id: 'demo-4',
    type: 'alert_success',
    timestamp: new Date(Date.now() - 1000 * 20).toISOString(),
    data: {
      title: 'Auto-buy executed',
      message: 'Bought 0.5 SOL of MARS at 0.00012',
    },
  },
  {
    id: 'demo-5',
    type: 'alert_warning',
    timestamp: new Date(Date.now() - 1000 * 10).toISOString(),
    data: {
      title: 'High slippage',
      message: 'Priority fee spiking; watch next trades',
    },
  },
  {
    id: 'demo-6',
    type: 'system_started',
    timestamp: new Date(Date.now() - 1000 * 5).toISOString(),
    data: {
      components: ['classifier', 'sse-server', 'pumpportal', 'pumpportal-data'],
    },
  },
]

export default function FeedPage() {
  const { isAuthenticated } = useAuth()
  const [events, setEvents] = useState<FeedEvent[]>([])
  const [connected, setConnected] = useState(false)
  const [notifications, setNotifications] = useState(true)
  const [filters, setFilters] = useState<FilterState>({
    tweets: true,
    launches: true,
    alerts: true,
    system: true,
  })
  const [showFilters, setShowFilters] = useState(false)
  const [watchedAccounts, setWatchedAccounts] = useState<WatchedAccount[]>([])
  const [newAccount, setNewAccount] = useState('')
  const [loadingAccount, setLoadingAccount] = useState(false)
  const [demoMode, setDemoMode] = useState(false)
  const [showPrefs, setShowPrefs] = useState(false)
  const [prefs, setPrefs] = useState<LaunchPreferences>({
    initialBuySol: 0.1,
    slippage: 10,
    priorityFee: 0.0005,
    autoDeploy: false,
    mayhemMode: false,
    enableMulti: false,
    walletsToUse: 3,
    maxPerWallet: 1,
    varianceBps: 250,
    jitterMs: 8000,
    autoTopUp: false,
    minBalance: 0.2,
    topUpAmount: 0.5,
  })
  const [savingPrefs, setSavingPrefs] = useState(false)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [groqSuggestions, setGroqSuggestions] = useState<Record<string, GroqSuggestion[]>>({})
  const [loadingSuggestions, setLoadingSuggestions] = useState<Record<string, boolean>>({})
  const { user } = useAuth()

  const feedRef = useRef<HTMLDivElement>(null)
  const eventSourceRef = useRef<EventSource | null>(null)

  useEffect(() => {
    // Connect to SSE stream
    if (!demoMode) {
      connectToStream()
    }

    // Load initial events
    if (!demoMode) {
      loadEvents()
    } else {
      loadDemoFeed()
    }

    // Load watched accounts if authenticated
    if (isAuthenticated) {
      loadWatchedAccounts()
    }

    return () => {
      eventSourceRef.current?.close()
    }
  }, [isAuthenticated, demoMode])

  useEffect(() => {
    if (isAuthenticated) {
      loadPrefs()
    }
  }, [isAuthenticated])

  const loadWatchedAccounts = async () => {
    try {
      const res = await fetch('/api/auth/watched-accounts', { credentials: 'include' })
      if (res.ok) {
        const data = await res.json()
        setWatchedAccounts(data.accounts || [])
      }
    } catch {
      // Ignore errors
    }
  }

  const connectToStream = () => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close()
    }

    const es = new EventSource('/events')
    eventSourceRef.current = es

    es.onopen = () => {
      setConnected(true)
    }

    es.onerror = () => {
      setConnected(false)
      // Reconnect after 5 seconds
      setTimeout(connectToStream, 5000)
    }

    es.addEventListener('connected', () => {
      setConnected(true)
    })

    // Listen for all event types
    const eventTypes = [
      'tweet_received',
      'tweet_filtered',
      'tweet_classified',
      'launch_detected',
      'launch_command_parsed',
      'token_creating',
      'token_created',
      'token_failed',
      'transaction_signing',
      'transaction_sent',
      'transaction_confirmed',
      'transaction_failed',
      'alert_info',
      'alert_warning',
      'alert_error',
      'alert_success',
      'system_started',
      'system_stopped',
      'system_error',
    ]

    eventTypes.forEach((type) => {
      es.addEventListener(type, (e) => {
        const event = JSON.parse(e.data)
        addEvent(event)

        // Show notification for important events
        if (notifications && ['token_created', 'launch_detected', 'alert_error'].includes(type)) {
          showNotification(event)
        }
      })
    })
  }

  const loadEvents = async () => {
    try {
      const res = await fetch('/api/events?limit=100')
      const data = await res.json()
      if (data.events) {
        setEvents(data.events.reverse())
      }
    } catch (err) {
      console.error('Failed to load events:', err)
    }
  }

  const loadDemoFeed = () => {
    setEvents(demoEvents)
    setConnected(true)
  }

  const loadPrefs = async () => {
    try {
      const res = await fetch('/api/auth/launch-preferences', { credentials: 'include' })
      if (res.ok) {
        const data = await res.json()
        setPrefs({
          initialBuySol: data.initial_buy_sol ?? 0.1,
          slippage: data.slippage ?? 10,
          priorityFee: data.priority_fee ?? 0.0005,
          autoDeploy: data.auto_deploy ?? false,
          mayhemMode: data.mayhem_mode ?? false,
          enableMulti: data.enable_multi_wallet ?? false,
          walletsToUse: data.wallets_to_use ?? 3,
          maxPerWallet: data.max_per_wallet_sol ?? 1,
          varianceBps: data.amount_variance_bps ?? 250,
          jitterMs: data.timing_jitter_ms ?? 8000,
          autoTopUp: data.auto_top_up ?? false,
          minBalance: data.min_balance_sol ?? 0.2,
          topUpAmount: data.top_up_amount_sol ?? 0.5,
        })
      }
    } catch (err) {
      console.error('Failed to load preferences', err)
    }
  }

  const savePrefs = async () => {
    setSavingPrefs(true)
    try {
      const res = await fetch('/api/auth/launch-preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          initial_buy_sol: prefs.initialBuySol,
          slippage: prefs.slippage,
          priority_fee: prefs.priorityFee,
          auto_deploy: prefs.autoDeploy,
          mayhem_mode: prefs.mayhemMode,
          enable_multi_wallet: prefs.enableMulti,
          wallets_to_use: prefs.walletsToUse,
          max_per_wallet_sol: prefs.maxPerWallet,
          amount_variance_bps: prefs.varianceBps,
          timing_jitter_ms: prefs.jitterMs,
          auto_top_up: prefs.autoTopUp,
          min_balance_sol: prefs.minBalance,
          top_up_amount_sol: prefs.topUpAmount,
        }),
      })
      if (!res.ok) throw new Error('Failed to save')
    } catch (err) {
      console.error('Failed to save preferences', err)
    } finally {
      setSavingPrefs(false)
      setShowPrefs(false)
    }
  }

  const addEvent = (event: FeedEvent) => {
    setEvents((prev) => {
      const newEvents = [event, ...prev].slice(0, 500) // Keep last 500 events
      return newEvents
    })

    // Auto-scroll to top (newest messages at top like Discord)
    if (feedRef.current && feedRef.current.scrollTop < 100) {
      feedRef.current.scrollTop = 0
    }
  }

  const showNotification = (event: FeedEvent) => {
    if ('Notification' in window && Notification.permission === 'granted') {
      const title = getEventTitle(event)
      const body = getEventDescription(event)
      new Notification(title, { body, icon: '/favicon.svg' })
    }
  }

  const requestNotificationPermission = async () => {
    if ('Notification' in window) {
      const permission = await Notification.requestPermission()
      if (permission === 'granted') {
        setNotifications(true)
      }
    }
  }

  const clearFeed = () => {
    setEvents([])
  }

  const addWatchedAccount = async () => {
    if (!newAccount.trim()) return

    if (isAuthenticated) {
      setLoadingAccount(true)
      try {
        const res = await fetch('/api/auth/watched-accounts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ twitter_username: newAccount.replace('@', '') }),
        })

        if (res.ok) {
          const data = await res.json()
          setWatchedAccounts(prev => [...prev, data.account])
          setNewAccount('')
        }
      } catch {
        // Ignore errors
      } finally {
        setLoadingAccount(false)
      }
    } else {
      // For non-authenticated users, just store locally
      const username = newAccount.replace('@', '')
      if (!watchedAccounts.find(a => a.twitter_username === username)) {
        setWatchedAccounts(prev => [...prev, { id: Date.now().toString(), twitter_username: username, is_active: true }])
        setNewAccount('')
      }
    }
  }

  const removeWatchedAccount = async (account: WatchedAccount) => {
    if (isAuthenticated) {
      try {
        const res = await fetch(`/api/auth/watched-accounts/${account.id}`, {
          method: 'DELETE',
          credentials: 'include',
        })

        if (res.ok) {
          setWatchedAccounts(prev => prev.filter(a => a.id !== account.id))
        }
      } catch {
        // Ignore errors
      }
    } else {
      setWatchedAccounts(prev => prev.filter(a => a.id !== account.id))
    }
  }

  const getEventTitle = (event: FeedEvent): string => {
    const titles: Record<string, string> = {
      tweet_received: 'Tweet Received',
      tweet_filtered: 'Tweet Filtered',
      tweet_classified: 'Tweet Classified',
      launch_detected: 'Launch Detected!',
      launch_command_parsed: 'Launch Command',
      token_creating: 'Creating Token...',
      token_created: 'Token Created!',
      token_failed: 'Token Failed',
      transaction_signing: 'Signing Transaction',
      transaction_sent: 'Transaction Sent',
      transaction_confirmed: 'Transaction Confirmed',
      transaction_failed: 'Transaction Failed',
      alert_info: 'Info',
      alert_warning: 'Warning',
      alert_error: 'Error',
      alert_success: 'Success',
      system_started: 'System Started',
      system_stopped: 'System Stopped',
      system_error: 'System Error',
    }
    return titles[event.type] || event.type
  }

  const getEventDescription = (event: FeedEvent): string => {
    const data = event.data
    switch (event.type) {
      case 'tweet_received':
        return `@${data.authorUsername}: ${data.text?.slice(0, 100)}...`
      case 'token_created':
        return `${data.ticker} (${data.name}) - ${data.mint?.slice(0, 8)}...`
      case 'token_failed':
        return `${data.ticker} - ${data.error}`
      case 'launch_detected':
        return `Ticker: ${data.ticker}, Name: ${data.name}`
      case 'alert_info':
      case 'alert_warning':
      case 'alert_error':
      case 'alert_success':
        return data.message || data.title
      default:
        return JSON.stringify(data).slice(0, 100)
    }
  }

  const getEventIcon = (event: FeedEvent) => {
    const iconProps = { className: 'w-5 h-5' }
    switch (event.type) {
      case 'tweet_received':
      case 'tweet_classified':
        return <Twitter {...iconProps} className="w-5 h-5 text-blue-400" />
      case 'tweet_filtered':
        return <Filter {...iconProps} className="w-5 h-5 text-gray-400" />
      case 'launch_detected':
      case 'launch_command_parsed':
        return <Rocket {...iconProps} className="w-5 h-5 text-accent-green" />
      case 'token_creating':
        return <RefreshCw {...iconProps} className="w-5 h-5 text-yellow-400 animate-spin" />
      case 'token_created':
      case 'transaction_confirmed':
      case 'alert_success':
        return <CheckCircle {...iconProps} className="w-5 h-5 text-green-400" />
      case 'token_failed':
      case 'transaction_failed':
      case 'alert_error':
      case 'system_error':
        return <XCircle {...iconProps} className="w-5 h-5 text-red-400" />
      case 'alert_warning':
        return <AlertTriangle {...iconProps} className="w-5 h-5 text-yellow-400" />
      default:
        return <MessageSquare {...iconProps} className="w-5 h-5 text-gray-400" />
    }
  }

  const getEventColor = (event: FeedEvent): string => {
    switch (event.type) {
      case 'token_created':
      case 'transaction_confirmed':
      case 'alert_success':
        return 'border-l-green-500'
      case 'token_failed':
      case 'transaction_failed':
      case 'alert_error':
      case 'system_error':
        return 'border-l-red-500'
      case 'alert_warning':
        return 'border-l-yellow-500'
      case 'launch_detected':
      case 'launch_command_parsed':
        return 'border-l-accent-green'
      case 'tweet_received':
      case 'tweet_classified':
        return 'border-l-blue-400'
      default:
        return 'border-l-dark-500'
    }
  }

  const shouldShowEvent = (event: FeedEvent): boolean => {
    if (event.type.startsWith('tweet_') && !filters.tweets) return false
    if ((event.type.includes('launch') || event.type.includes('token')) && !filters.launches)
      return false
    if (event.type.startsWith('alert_') && !filters.alerts) return false
    if (event.type.startsWith('system_') && !filters.system) return false
    return true
  }

  const filteredEvents = events.filter(shouldShowEvent)

  const formatTime = (timestamp: string): string => {
    const date = new Date(timestamp)
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
  }

  const triggerBuy = async (event: FeedEvent) => {
    if (user?.role !== 'admin') {
      alert('S-tier required for multi-wallet buys')
      return
    }
    const mint = event.data?.mint
    setActionLoading(event.id)
    try {
      const res = await fetch('/api/actions/buy-multi', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          mint,
          totalAmountSol: prefs.initialBuySol,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Buy failed')
      alert(`Buy dispatched. Fee: ${data.feeAmount?.toFixed?.(4) ?? (data.feeAmount || 0)} SOL`)
    } catch (err: any) {
      alert(err.message || 'Buy failed')
    } finally {
      setActionLoading(null)
    }
  }

  const triggerSell = async (event: FeedEvent) => {
    if (user?.role !== 'admin') {
      alert('S-tier required for multi-wallet sells')
      return
    }
    const mint = event.data?.mint
    const input = window.prompt('Enter total token amount to sell (will be split across wallets):', '1000')
    if (!input) return
    setActionLoading(event.id)
    try {
      const res = await fetch('/api/actions/sell-multi', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          mint,
          totalTokenAmount: parseFloat(input),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Sell failed')
      alert(`Sell dispatched. Fee: ${data.feeAmount?.toFixed?.(4) ?? (data.feeAmount || 0)} SOL`)
    } catch (err: any) {
      alert(err.message || 'Sell failed')
    } finally {
      setActionLoading(null)
    }
  }

  const analyzeWithGroq = async (event: FeedEvent) => {
    if (event.type !== 'tweet_received') return

    const eventId = event.id
    setLoadingSuggestions(prev => ({ ...prev, [eventId]: true }))

    try {
      const res = await fetch('/api/groq/suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: event.data.text,
          tweetId: event.data.tweetId,
          authorUsername: event.data.authorUsername,
        }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Analysis failed')

      if (data.suggestions && data.suggestions.length > 0) {
        setGroqSuggestions(prev => ({ ...prev, [eventId]: data.suggestions }))
      }
    } catch (err: any) {
      console.error('Groq analysis failed:', err)
    } finally {
      setLoadingSuggestions(prev => ({ ...prev, [eventId]: false }))
    }
  }

  return (
    <div className="h-[calc(100vh-10rem)] flex gap-6">
      {/* Sidebar - Watched Accounts */}
      <div className="w-64 bg-dark-800 rounded-xl border border-dark-600 p-4 flex flex-col">
        <h3 className="font-semibold mb-4 flex items-center gap-2">
          <Twitter className="w-4 h-4 text-blue-400" />
          Watched Accounts
        </h3>

        <div className="flex gap-2 mb-4">
          <input
            type="text"
            value={newAccount}
            onChange={(e) => setNewAccount(e.target.value.replace('@', ''))}
            onKeyDown={(e) => e.key === 'Enter' && addWatchedAccount()}
            placeholder="@username"
            className="flex-1 text-sm py-2"
          />
          <button
            onClick={addWatchedAccount}
            disabled={loadingAccount}
            className="px-3 py-2 bg-blue-600 rounded-lg hover:bg-blue-500 disabled:opacity-50"
          >
            {loadingAccount ? <Loader2 className="w-4 h-4 animate-spin" /> : '+'}
          </button>
        </div>

        <div className="flex-1 overflow-auto space-y-2">
          {watchedAccounts.length === 0 ? (
            <p className="text-gray-500 text-sm">No accounts added yet</p>
          ) : (
            watchedAccounts.map((account) => (
              <div
                key={account.id}
                className="flex items-center justify-between bg-dark-700 rounded-lg px-3 py-2"
              >
                <span className="text-sm">@{account.twitter_username}</span>
                <button
                  onClick={() => removeWatchedAccount(account)}
                  className="text-gray-500 hover:text-red-400"
                >
                  <XCircle className="w-4 h-4" />
                </button>
              </div>
            ))
          )}
        </div>

        {/* Connection Status */}
        <div className="mt-4 pt-4 border-t border-dark-600">
          <div className="flex items-center gap-2 text-sm">
            <div
              className={`w-2 h-2 rounded-full ${connected ? 'bg-accent-green pulse' : 'bg-red-500'}`}
            />
            <span className="text-gray-400">{connected ? 'Live' : 'Disconnected'}</span>
          </div>
        </div>
      </div>

      {/* Main Feed */}
      <div className="flex-1 bg-dark-800 rounded-xl border border-dark-600 flex flex-col">
        {/* Feed Header */}
        <div className="flex items-center justify-between p-4 border-b border-dark-600">
          <h2 className="font-semibold flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-accent-green" />
            Live Feed
            <span className="text-sm text-gray-500">({filteredEvents.length} events)</span>
          </h2>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`p-2 rounded-lg hover:bg-dark-700 ${showFilters ? 'bg-dark-700' : ''}`}
            >
              <Filter className="w-4 h-4" />
            </button>
            <button
              onClick={() => {
                if (notifications) {
                  setNotifications(false)
                } else {
                  requestNotificationPermission()
                }
              }}
              className="p-2 rounded-lg hover:bg-dark-700"
            >
              {notifications ? (
                <Bell className="w-4 h-4 text-accent-green" />
              ) : (
                <BellOff className="w-4 h-4 text-gray-500" />
              )}
            </button>
            <button onClick={clearFeed} className="p-2 rounded-lg hover:bg-dark-700 text-gray-500">
              <Trash2 className="w-4 h-4" />
            </button>
            <button
              onClick={connectToStream}
              className="p-2 rounded-lg hover:bg-dark-700 text-gray-500"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            <button
              onClick={() => setDemoMode((prev) => !prev)}
              className={`px-3 py-2 rounded-lg text-sm ${
                demoMode ? 'bg-accent-green/20 text-accent-green' : 'bg-dark-700 text-gray-300'
              }`}
            >
              {demoMode ? 'Demo: On' : 'Load Demo'}
            </button>
            {demoMode && (
              <button
                onClick={loadDemoFeed}
                className="p-2 rounded-lg hover:bg-dark-700 text-gray-300"
                title="Refresh demo data"
              >
                <Loader2 className="w-4 h-4" />
              </button>
            )}
            <button
              onClick={() => setShowPrefs(true)}
              className="px-3 py-2 rounded-lg bg-dark-700 border border-dark-500 text-gray-100 hover:bg-dark-600 text-sm"
            >
              Preferences
            </button>
          </div>
        </div>

        {/* Filters */}
        {showFilters && (
          <div className="flex gap-4 p-4 border-b border-dark-600 bg-dark-700/50">
            {Object.entries(filters).map(([key, value]) => (
              <label key={key} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={value}
                  onChange={(e) => setFilters((prev) => ({ ...prev, [key]: e.target.checked }))}
                  className="w-4 h-4 rounded bg-dark-700 border-dark-500 text-accent-green focus:ring-accent-green"
                />
                <span className="text-sm capitalize">{key}</span>
              </label>
            ))}
          </div>
        )}

        {/* Events List */}
        <div ref={feedRef} className="flex-1 overflow-auto p-4 space-y-2">
          {filteredEvents.length === 0 ? (
            <div className="text-center text-gray-500 py-12">
              <MessageSquare className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No events yet</p>
              <p className="text-sm">Events will appear here in real-time</p>
            </div>
          ) : (
            filteredEvents.map((event) => (
              <div
                key={event.id}
                className={`feed-message bg-dark-700 rounded-lg p-3 border-l-4 ${getEventColor(
                  event
                )} hover:bg-dark-600 transition-colors`}
              >
                <div className="flex items-start gap-3">
                  <div className="mt-1">{getEventIcon(event)}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-sm">{getEventTitle(event)}</span>
                      <span className="text-xs text-gray-500">{formatTime(event.timestamp)}</span>
                    </div>
                    <p className="text-sm text-gray-400 break-words">
                      {getEventDescription(event)}
                    </p>

                    {/* Extra info for token events */}
                    {event.type === 'token_created' && event.data.mint && (
                      <div className="mt-2 flex gap-2">
                        <a
                          href={`https://pump.fun/${event.data.mint}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-accent-green hover:underline flex items-center gap-1"
                        >
                          PumpFun <ExternalLink className="w-3 h-3" />
                        </a>
                        <a
                          href={`https://solscan.io/token/${event.data.mint}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-blue-400 hover:underline flex items-center gap-1"
                        >
                          Solscan <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    )}

                    {/* Tweet link */}
                    {event.type === 'tweet_received' && event.data.tweetId && (
                      <a
                        href={`https://twitter.com/${event.data.authorUsername}/status/${event.data.tweetId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-2 text-xs text-blue-400 hover:underline flex items-center gap-1 inline-flex"
                      >
                        View Tweet <ExternalLink className="w-3 h-3" />
                      </a>
                    )}

                    {/* Quick actions */}
                    {(event.type === 'tweet_received' ||
                      event.type === 'launch_detected' ||
                      event.type === 'launch_command_parsed') && (
                      <>
                        <div className="mt-3 flex items-center gap-2 text-xs flex-wrap">
                          {event.type === 'tweet_received' && (
                            <button
                              disabled={loadingSuggestions[event.id]}
                              onClick={() => analyzeWithGroq(event)}
                              className="px-3 py-1 rounded-full bg-purple-500/10 text-purple-400 border border-purple-400/30 hover:bg-purple-500/20 transition-colors disabled:opacity-50 flex items-center gap-1"
                            >
                              {loadingSuggestions[event.id] ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              ) : (
                                '🤖'
                              )}
                              {loadingSuggestions[event.id] ? 'Analyzing...' : 'Groq Analysis'}
                            </button>
                          )}
                          <button
                            disabled={actionLoading === event.id}
                            onClick={() => triggerBuy(event)}
                            className="px-3 py-1 rounded-full bg-accent-green/10 text-accent-green border border-accent-green/30 hover:bg-accent-green/20 transition-colors disabled:opacity-50"
                          >
                            Auto Deploy
                          </button>
                          <button
                            disabled={actionLoading === event.id}
                            onClick={() => triggerBuy(event)}
                            className="px-3 py-1 rounded-full bg-blue-500/10 text-blue-400 border border-blue-400/30 hover:bg-blue-500/20 transition-colors disabled:opacity-50"
                          >
                            Buy with {prefs.initialBuySol} SOL
                          </button>
                          <button className="px-3 py-1 rounded-full bg-dark-600 text-gray-300 border border-dark-500 hover:bg-dark-500 transition-colors">
                            Ignore
                          </button>
                        </div>

                        {/* Show Groq suggestions if available */}
                        {groqSuggestions[event.id] && groqSuggestions[event.id].length > 0 && (
                          <div className="mt-3 space-y-2 border-t border-dark-600 pt-2">
                            {groqSuggestions[event.id].map((suggestion, idx) => (
                              <div key={idx} className="text-xs bg-dark-600/50 rounded-lg p-2">
                                <div className="font-semibold text-accent-green">
                                  {suggestion.ticker} - {suggestion.name}
                                </div>
                                {suggestion.description && (
                                  <div className="text-gray-400 text-xs mt-1">{suggestion.description}</div>
                                )}
                                <div className="mt-2 flex gap-2">
                                  <button
                                    disabled={actionLoading === event.id}
                                    onClick={() => triggerBuy(event)}
                                    className="px-2 py-1 text-xs rounded bg-accent-green text-dark-900 font-semibold hover:bg-green-400 disabled:opacity-50"
                                  >
                                    Deploy {suggestion.ticker}
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </>
                    )}
                    {event.type === 'token_created' && event.data.mint && (
                      <div className="mt-2 flex items-center gap-2 text-xs">
                        <button
                          disabled={actionLoading === event.id}
                          onClick={() => triggerSell(event)}
                          className="px-3 py-1 rounded-full bg-red-500/10 text-red-400 border border-red-400/30 hover:bg-red-500/20 transition-colors disabled:opacity-50"
                        >
                          Auto Sell (multi)
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Preferences drawer */}
      {showPrefs && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center px-4">
          <div className="w-full max-w-lg bg-dark-800 border border-dark-600 rounded-2xl p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-xl font-semibold">Launch Preferences</h3>
                <p className="text-sm text-gray-400">
                  Defaults used for auto-deploy and quick buys.
                </p>
              </div>
              <button onClick={() => setShowPrefs(false)} className="text-gray-400 hover:text-white">
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">INITIAL BUY (SOL)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={prefs.initialBuySol}
                    onChange={(e) => setPrefs((p) => ({ ...p, initialBuySol: parseFloat(e.target.value) || 0 }))}
                    className="w-full"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">SLIPPAGE (%)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={prefs.slippage}
                    onChange={(e) => setPrefs((p) => ({ ...p, slippage: parseFloat(e.target.value) || 0 }))}
                    className="w-full"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">PRIORITY FEE (SOL)</label>
                  <input
                    type="number"
                    step="0.0001"
                    value={prefs.priorityFee}
                    onChange={(e) => setPrefs((p) => ({ ...p, priorityFee: parseFloat(e.target.value) || 0 }))}
                    className="w-full"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <input
                    id="autoDeploy"
                    type="checkbox"
                    checked={prefs.autoDeploy}
                    onChange={(e) => setPrefs((p) => ({ ...p, autoDeploy: e.target.checked }))}
                    className="w-4 h-4 rounded bg-dark-700 border-dark-500 text-accent-green focus:ring-accent-green"
                  />
                  <label htmlFor="autoDeploy" className="text-sm text-gray-200">
                    Auto-deploy when launch is detected
                  </label>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <input
                  id="mayhemMode"
                  type="checkbox"
                  checked={prefs.mayhemMode}
                  onChange={(e) => setPrefs((p) => ({ ...p, mayhemMode: e.target.checked }))}
                  className="w-4 h-4 rounded bg-dark-700 border-dark-500 text-accent-green focus:ring-accent-green"
                />
                <label htmlFor="mayhemMode" className="text-sm text-gray-200">
                  Mayhem mode (aggressive settings)
                </label>
              </div>

              <div className="border-t border-dark-600 pt-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="text-sm font-semibold">Multi-wallet (S-tier)</p>
                    <p className="text-xs text-gray-400">Randomized buys across your pool.</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={prefs.enableMulti}
                        onChange={(e) => setPrefs((p) => ({ ...p, enableMulti: e.target.checked }))}
                        className="w-4 h-4 rounded bg-dark-700 border-dark-500 text-accent-green focus:ring-accent-green"
                      />
                      Enable
                    </label>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-gray-400 mb-1 block">Wallets to use</label>
                    <input
                      type="number"
                      min={1}
                      max={20}
                      value={prefs.walletsToUse}
                      onChange={(e) => setPrefs((p) => ({ ...p, walletsToUse: parseInt(e.target.value || '1', 10) }))}
                      className="w-full"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 mb-1 block">Max per wallet (SOL)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={prefs.maxPerWallet}
                      onChange={(e) => setPrefs((p) => ({ ...p, maxPerWallet: parseFloat(e.target.value) || 0 }))}
                      className="w-full"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 mt-3">
                  <div>
                    <label className="text-xs text-gray-400 mb-1 block">Amount variance (bps)</label>
                    <input
                      type="number"
                      value={prefs.varianceBps}
                      onChange={(e) => setPrefs((p) => ({ ...p, varianceBps: parseInt(e.target.value || '0', 10) }))}
                      className="w-full"
                    />
                    <p className="text-xs text-gray-500 mt-1">250 bps = ±2.5%</p>
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 mb-1 block">Timing jitter (ms)</label>
                    <input
                      type="number"
                      value={prefs.jitterMs}
                      onChange={(e) => setPrefs((p) => ({ ...p, jitterMs: parseInt(e.target.value || '0', 10) }))}
                      className="w-full"
                    />
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={prefs.autoTopUp}
                      onChange={(e) => setPrefs((p) => ({ ...p, autoTopUp: e.target.checked }))}
                      className="w-4 h-4 rounded bg-dark-700 border-dark-500 text-accent-green focus:ring-accent-green"
                    />
                    Auto top-up wallets
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={prefs.autoDeploy}
                      onChange={(e) => setPrefs((p) => ({ ...p, autoDeploy: e.target.checked }))}
                      className="w-4 h-4 rounded bg-dark-700 border-dark-500 text-accent-green focus:ring-accent-green"
                    />
                    Auto deploy on launch
                  </label>
                </div>
                <div className="grid grid-cols-2 gap-3 mt-3">
                  <div>
                    <label className="text-xs text-gray-400 mb-1 block">Min balance (SOL)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={prefs.minBalance}
                      onChange={(e) => setPrefs((p) => ({ ...p, minBalance: parseFloat(e.target.value) || 0 }))}
                      className="w-full"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 mb-1 block">Top-up amount (SOL)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={prefs.topUpAmount}
                      onChange={(e) => setPrefs((p) => ({ ...p, topUpAmount: parseFloat(e.target.value) || 0 }))}
                      className="w-full"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setShowPrefs(false)}
                className="px-4 py-2 rounded-lg bg-dark-700 text-gray-200 hover:bg-dark-600"
              >
                Cancel
              </button>
              <button
                onClick={savePrefs}
                disabled={savingPrefs}
                className="px-4 py-2 rounded-lg bg-accent-green text-dark-900 font-semibold hover:bg-green-400 disabled:opacity-50"
              >
                {savingPrefs ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save preferences'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
