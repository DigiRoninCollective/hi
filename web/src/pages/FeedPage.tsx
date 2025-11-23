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

  const feedRef = useRef<HTMLDivElement>(null)
  const eventSourceRef = useRef<EventSource | null>(null)

  useEffect(() => {
    // Connect to SSE stream
    connectToStream()

    // Load initial events
    loadEvents()

    // Load watched accounts if authenticated
    if (isAuthenticated) {
      loadWatchedAccounts()
    }

    return () => {
      eventSourceRef.current?.close()
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
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
