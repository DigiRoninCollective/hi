import { useState, useEffect, useRef } from 'react'
import {
  MessageSquare,
  Rocket,
  Filter,
  Bell,
  BellOff,
  ExternalLink,
  RefreshCw,
  Loader2,
  Bookmark,
  EyeOff,
  TrendingUp,
  Hash,
  AtSign,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'

// Platform icons
const DiscordIcon = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
    <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z"/>
  </svg>
)

const TelegramIcon = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
    <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
  </svg>
)

const RedditIcon = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0zm5.01 4.744c.688 0 1.25.561 1.25 1.249a1.25 1.25 0 0 1-2.498.056l-2.597-.547-.8 3.747c1.824.07 3.48.632 4.674 1.488.308-.309.73-.491 1.207-.491.968 0 1.754.786 1.754 1.754 0 .716-.435 1.333-1.01 1.614a3.111 3.111 0 0 1 .042.52c0 2.694-3.13 4.87-7.004 4.87-3.874 0-7.004-2.176-7.004-4.87 0-.183.015-.366.043-.534A1.748 1.748 0 0 1 4.028 12c0-.968.786-1.754 1.754-1.754.463 0 .898.196 1.207.49 1.207-.883 2.878-1.43 4.744-1.487l.885-4.182a.342.342 0 0 1 .14-.197.35.35 0 0 1 .238-.042l2.906.617a1.214 1.214 0 0 1 1.108-.701zM9.25 12C8.561 12 8 12.562 8 13.25c0 .687.561 1.248 1.25 1.248.687 0 1.248-.561 1.248-1.249 0-.688-.561-1.249-1.249-1.249zm5.5 0c-.687 0-1.248.561-1.248 1.25 0 .687.561 1.248 1.249 1.248.688 0 1.249-.561 1.249-1.249 0-.687-.562-1.249-1.25-1.249zm-5.466 3.99a.327.327 0 0 0-.231.094.33.33 0 0 0 0 .463c.842.842 2.484.913 2.961.913.477 0 2.105-.056 2.961-.913a.361.361 0 0 0 .029-.463.33.33 0 0 0-.464 0c-.547.533-1.684.73-2.512.73-.828 0-1.979-.196-2.512-.73a.326.326 0 0 0-.232-.095z"/>
  </svg>
)

interface AlphaSignal {
  id: string
  source: 'discord' | 'telegram' | 'reddit' | 'twitter'
  source_id: string
  source_channel: string | null
  source_author: string | null
  content: string
  category: string
  priority: 'low' | 'medium' | 'high' | 'urgent'
  confidence_score: number
  risk_score: number
  tickers: string[] | null
  contract_addresses: string[] | null
  sentiment: string | null
  engagement_score: number | null
  created_at: string
}

interface FilterState {
  discord: boolean
  telegram: boolean
  reddit: boolean
  twitter: boolean
  minPriority: string
  category: string
}

interface WatchedSource {
  type: 'discord' | 'telegram' | 'reddit'
  identifier: string
  name: string
}

export default function AlphaFeedPage() {
  const { isAuthenticated } = useAuth()
  const [signals, setSignals] = useState<AlphaSignal[]>([])
  const [loading, setLoading] = useState(true)
  const [connected, setConnected] = useState(false)
  const [notifications, setNotifications] = useState(true)
  const [filters, setFilters] = useState<FilterState>({
    discord: true,
    telegram: true,
    reddit: true,
    twitter: true,
    minPriority: 'low',
    category: 'all',
  })
  const [showFilters, setShowFilters] = useState(false)
  const [stats, setStats] = useState<any>(null)
  const [serviceStatus, setServiceStatus] = useState<any>(null)
  const [newSource, setNewSource] = useState({ type: 'discord' as WatchedSource['type'], identifier: '', name: '' })
  const [addingSource, setAddingSource] = useState(false)

  const feedRef = useRef<HTMLDivElement>(null)
  const eventSourceRef = useRef<EventSource | null>(null)

  useEffect(() => {
    loadSignals()
    loadStats()
    loadServiceStatus()
    connectToStream()

    const interval = setInterval(loadSignals, 30000) // Refresh every 30s

    return () => {
      clearInterval(interval)
      eventSourceRef.current?.close()
    }
  }, [filters])

  const connectToStream = () => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close()
    }

    const es = new EventSource('/events')
    eventSourceRef.current = es

    es.onopen = () => setConnected(true)
    es.onerror = () => {
      setConnected(false)
      setTimeout(connectToStream, 5000)
    }

    // Listen for alpha-related events
    es.addEventListener('alert_info', (e) => {
      const event = JSON.parse(e.data)
      if (event.data?.metadata?.source && ['discord', 'telegram', 'reddit'].includes(event.data.metadata.source)) {
        loadSignals() // Reload signals when new alpha comes in
      }
    })
  }

  const loadSignals = async () => {
    try {
      const params = new URLSearchParams()
      params.append('limit', '100')
      if (filters.minPriority !== 'low') params.append('minPriority', filters.minPriority)
      if (filters.category !== 'all') params.append('category', filters.category)

      const res = await fetch(`/api/alpha/signals?${params}`)
      if (res.ok) {
        const data = await res.json()
        setSignals(data.signals || [])
      }
    } catch (err) {
      console.error('Failed to load signals:', err)
    } finally {
      setLoading(false)
    }
  }

  const loadStats = async () => {
    try {
      const res = await fetch('/api/alpha/stats')
      if (res.ok) {
        const data = await res.json()
        setStats(data)
      }
    } catch {
      // Ignore
    }
  }

  const loadServiceStatus = async () => {
    try {
      const res = await fetch('/api/alpha/status')
      if (res.ok) {
        const data = await res.json()
        setServiceStatus(data)
      }
    } catch {
      // Ignore
    }
  }

  const addWatchedSource = async () => {
    if (!newSource.identifier.trim()) return

    setAddingSource(true)
    try {
      const res = await fetch('/api/alpha/watch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          source: newSource.type,
          identifier: newSource.identifier,
          name: newSource.name || newSource.identifier,
        }),
      })

      if (res.ok) {
        setNewSource({ type: 'discord', identifier: '', name: '' })
        loadServiceStatus()
      }
    } catch {
      // Ignore
    } finally {
      setAddingSource(false)
    }
  }

  const interactWithSignal = async (signalId: string, type: 'save' | 'like' | 'hide') => {
    if (!isAuthenticated) return

    try {
      await fetch(`/api/alpha/signals/${signalId}/interact`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ type }),
      })
    } catch {
      // Ignore
    }
  }

  const getSourceIcon = (source: string) => {
    switch (source) {
      case 'discord':
        return <DiscordIcon />
      case 'telegram':
        return <TelegramIcon />
      case 'reddit':
        return <RedditIcon />
      default:
        return <AtSign className="w-5 h-5" />
    }
  }

  const getSourceColor = (source: string) => {
    switch (source) {
      case 'discord':
        return 'text-indigo-400'
      case 'telegram':
        return 'text-blue-400'
      case 'reddit':
        return 'text-orange-400'
      default:
        return 'text-gray-400'
    }
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent':
        return 'bg-red-500/20 text-red-400 border-red-500/50'
      case 'high':
        return 'bg-orange-500/20 text-orange-400 border-orange-500/50'
      case 'medium':
        return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50'
      default:
        return 'bg-gray-500/20 text-gray-400 border-gray-500/50'
    }
  }

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'launch_alert':
        return <Rocket className="w-4 h-4" />
      case 'token_mention':
        return <Hash className="w-4 h-4" />
      case 'whale_movement':
        return <TrendingUp className="w-4 h-4" />
      default:
        return <MessageSquare className="w-4 h-4" />
    }
  }

  const formatTime = (timestamp: string): string => {
    const date = new Date(timestamp)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)

    if (diffMins < 1) return 'just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`
    return date.toLocaleDateString()
  }

  const shouldShowSignal = (signal: AlphaSignal): boolean => {
    if (!filters[signal.source]) return false
    return true
  }

  const filteredSignals = signals.filter(shouldShowSignal)

  return (
    <div className="h-[calc(100vh-10rem)] flex gap-6">
      {/* Sidebar */}
      <div className="w-72 bg-dark-800 rounded-xl border border-dark-600 p-4 flex flex-col">
        <h3 className="font-semibold mb-4 flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-accent-green" />
          Alpha Sources
        </h3>

        {/* Service Status */}
        {serviceStatus && (
          <div className="mb-4 space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <DiscordIcon />
                Discord
              </span>
              <span className={serviceStatus.services?.discord?.connected ? 'text-green-400' : 'text-gray-500'}>
                {serviceStatus.services?.discord?.enabled ? (serviceStatus.services?.discord?.connected ? 'Connected' : 'Disconnected') : 'Disabled'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <TelegramIcon />
                Telegram
              </span>
              <span className={serviceStatus.services?.telegram?.running ? 'text-green-400' : 'text-gray-500'}>
                {serviceStatus.services?.telegram?.enabled ? (serviceStatus.services?.telegram?.running ? 'Running' : 'Stopped') : 'Disabled'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <RedditIcon />
                Reddit
              </span>
              <span className={serviceStatus.services?.reddit?.running ? 'text-green-400' : 'text-gray-500'}>
                {serviceStatus.services?.reddit?.enabled ? (serviceStatus.services?.reddit?.running ? 'Running' : 'Stopped') : 'Disabled'}
              </span>
            </div>
          </div>
        )}

        {/* Add Source */}
        {isAuthenticated && (
          <div className="mb-4 p-3 bg-dark-700 rounded-lg">
            <p className="text-xs text-gray-400 mb-2">Add Watched Source</p>
            <select
              value={newSource.type}
              onChange={(e) => setNewSource((prev) => ({ ...prev, type: e.target.value as WatchedSource['type'] }))}
              className="w-full mb-2 text-sm py-1.5"
            >
              <option value="discord">Discord Channel</option>
              <option value="telegram">Telegram Chat</option>
              <option value="reddit">Subreddit</option>
            </select>
            <input
              type="text"
              value={newSource.identifier}
              onChange={(e) => setNewSource((prev) => ({ ...prev, identifier: e.target.value }))}
              placeholder={newSource.type === 'reddit' ? 'r/CryptoMoonShots' : 'Channel ID'}
              className="w-full mb-2 text-sm py-1.5"
            />
            <button
              onClick={addWatchedSource}
              disabled={addingSource || !newSource.identifier}
              className="w-full py-1.5 bg-accent-green text-black rounded-lg text-sm font-medium hover:bg-accent-green/90 disabled:opacity-50"
            >
              {addingSource ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Add Source'}
            </button>
          </div>
        )}

        {/* Stats */}
        {stats && (
          <div className="mt-auto pt-4 border-t border-dark-600 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-400">Total Signals</span>
              <span>{stats.database?.total || 0}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Last 24h</span>
              <span>{stats.database?.last24h || 0}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">High Priority</span>
              <span className="text-orange-400">{stats.aggregator?.highPriority || 0}</span>
            </div>
          </div>
        )}

        {/* Connection Status */}
        <div className="mt-4 pt-4 border-t border-dark-600">
          <div className="flex items-center gap-2 text-sm">
            <div className={`w-2 h-2 rounded-full ${connected ? 'bg-accent-green pulse' : 'bg-red-500'}`} />
            <span className="text-gray-400">{connected ? 'Live' : 'Disconnected'}</span>
          </div>
        </div>
      </div>

      {/* Main Feed */}
      <div className="flex-1 bg-dark-800 rounded-xl border border-dark-600 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-dark-600">
          <h2 className="font-semibold flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-accent-green" />
            Alpha Feed
            <span className="text-sm text-gray-500">({filteredSignals.length} signals)</span>
          </h2>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`p-2 rounded-lg hover:bg-dark-700 ${showFilters ? 'bg-dark-700' : ''}`}
            >
              <Filter className="w-4 h-4" />
            </button>
            <button
              onClick={() => setNotifications(!notifications)}
              className="p-2 rounded-lg hover:bg-dark-700"
            >
              {notifications ? <Bell className="w-4 h-4 text-accent-green" /> : <BellOff className="w-4 h-4 text-gray-500" />}
            </button>
            <button onClick={loadSignals} className="p-2 rounded-lg hover:bg-dark-700 text-gray-500">
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Filters */}
        {showFilters && (
          <div className="flex flex-wrap gap-4 p-4 border-b border-dark-600 bg-dark-700/50">
            <div className="flex gap-4">
              {(['discord', 'telegram', 'reddit', 'twitter'] as const).map((source) => (
                <label key={source} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={filters[source]}
                    onChange={(e) => setFilters((prev) => ({ ...prev, [source]: e.target.checked }))}
                    className="w-4 h-4 rounded bg-dark-700 border-dark-500 text-accent-green"
                  />
                  <span className={`text-sm capitalize ${getSourceColor(source)}`}>{source}</span>
                </label>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-400">Min Priority:</span>
              <select
                value={filters.minPriority}
                onChange={(e) => setFilters((prev) => ({ ...prev, minPriority: e.target.value }))}
                className="text-sm py-1 px-2"
              >
                <option value="low">All</option>
                <option value="medium">Medium+</option>
                <option value="high">High+</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-400">Category:</span>
              <select
                value={filters.category}
                onChange={(e) => setFilters((prev) => ({ ...prev, category: e.target.value }))}
                className="text-sm py-1 px-2"
              >
                <option value="all">All</option>
                <option value="launch_alert">Launch Alerts</option>
                <option value="token_mention">Token Mentions</option>
                <option value="whale_movement">Whale Movements</option>
                <option value="news">News</option>
              </select>
            </div>
          </div>
        )}

        {/* Signals List */}
        <div ref={feedRef} className="flex-1 overflow-auto p-4 space-y-3">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-accent-green" />
            </div>
          ) : filteredSignals.length === 0 ? (
            <div className="text-center text-gray-500 py-12">
              <TrendingUp className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No alpha signals yet</p>
              <p className="text-sm">Configure your sources to start receiving signals</p>
            </div>
          ) : (
            filteredSignals.map((signal) => (
              <div
                key={signal.id}
                className="bg-dark-700 rounded-lg p-4 hover:bg-dark-600 transition-colors border-l-4 border-l-dark-500"
                style={{
                  borderLeftColor: signal.priority === 'urgent' ? '#ef4444' : signal.priority === 'high' ? '#f97316' : signal.priority === 'medium' ? '#eab308' : '#6b7280',
                }}
              >
                <div className="flex items-start gap-3">
                  {/* Source Icon */}
                  <div className={`mt-1 ${getSourceColor(signal.source)}`}>
                    {getSourceIcon(signal.source)}
                  </div>

                  <div className="flex-1 min-w-0">
                    {/* Header */}
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium border ${getPriorityColor(signal.priority)}`}>
                        {signal.priority.toUpperCase()}
                      </span>
                      <span className="flex items-center gap-1 text-xs text-gray-400">
                        {getCategoryIcon(signal.category)}
                        {signal.category.replace('_', ' ')}
                      </span>
                      <span className="text-xs text-gray-500">{signal.source_channel}</span>
                      <span className="text-xs text-gray-500 ml-auto">{formatTime(signal.created_at)}</span>
                    </div>

                    {/* Content */}
                    <p className="text-sm text-gray-300 mb-2 whitespace-pre-wrap break-words">
                      {signal.content.slice(0, 500)}{signal.content.length > 500 ? '...' : ''}
                    </p>

                    {/* Tickers */}
                    {signal.tickers && signal.tickers.length > 0 && (
                      <div className="flex flex-wrap gap-2 mb-2">
                        {signal.tickers.map((ticker) => (
                          <span key={ticker} className="px-2 py-0.5 bg-accent-green/20 text-accent-green rounded text-xs font-medium">
                            ${ticker}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Contract Addresses */}
                    {signal.contract_addresses && signal.contract_addresses.length > 0 && (
                      <div className="flex flex-wrap gap-2 mb-2">
                        {signal.contract_addresses.slice(0, 2).map((addr) => (
                          <a
                            key={addr}
                            href={`https://solscan.io/token/${addr}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-2 py-0.5 bg-blue-500/20 text-blue-400 rounded text-xs font-mono hover:underline flex items-center gap-1"
                          >
                            {addr.slice(0, 8)}...{addr.slice(-6)}
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        ))}
                      </div>
                    )}

                    {/* Footer */}
                    <div className="flex items-center gap-4 text-xs text-gray-500">
                      <span>@{signal.source_author || 'unknown'}</span>
                      <span>Confidence: {(signal.confidence_score * 100).toFixed(0)}%</span>
                      {signal.engagement_score !== null && <span>Engagement: {signal.engagement_score}</span>}

                      {/* Actions */}
                      {isAuthenticated && (
                        <div className="flex gap-2 ml-auto">
                          <button
                            onClick={() => interactWithSignal(signal.id, 'save')}
                            className="hover:text-accent-green"
                            title="Save"
                          >
                            <Bookmark className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => interactWithSignal(signal.id, 'hide')}
                            className="hover:text-red-400"
                            title="Hide"
                          >
                            <EyeOff className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </div>
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
