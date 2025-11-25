import { useState, useEffect } from 'react'

import { useBackNavigation } from '../hooks/useNavigation'
import {
  Send,
  MessageCircle,
  Users,
  Activity,
  Settings as SettingsIcon,
  ArrowLeft,
  Loader2,
  AlertCircle,

  Copy,

  Eye,
  EyeOff,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'

interface Subscriber {
  chatId: string
  userId: string
  username: string
  subscribedAt: string
  isActive: boolean
  alertTypes: {
    tokenLaunches: boolean
    highPrioritySignals: boolean
    systemAlerts: boolean
  }
}

interface BotStatus {
  isRunning: boolean
  botUsername: string
  botId: number
  firstName: string
  subscriberCount: number
}

interface Message {
  id: string
  timestamp: string
  chatId: string
  username: string
  content: string
  type: 'sent' | 'received'
}

export default function TelegramAdminPage() {

  const { goBack } = useBackNavigation()
  const { user } = useAuth()

  const [botStatus, setBotStatus] = useState<BotStatus | null>(null)
  const [subscribers, setSubscribers] = useState<Subscriber[]>([])
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'status' | 'subscribers' | 'messages' | 'broadcast'>('status')
  const [messageInput, setMessageInput] = useState('')
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null)
  const [sendingMessage, setSendingMessage] = useState(false)
  const [broadcastMessage, setBroadcastMessage] = useState('')
  const [broadcastAlertType, setBroadcastAlertType] = useState<'tokenLaunches' | 'highPrioritySignals' | 'systemAlerts'>('tokenLaunches')
  const [sendingBroadcast, setSendingBroadcast] = useState(false)
  const [showBotToken, setShowBotToken] = useState(false)
  const [botToken, setBotToken] = useState('')


  const isAdmin = user?.role === 'admin'

  useEffect(() => {
    if (!isAdmin) {
      setLoading(false)
      return
    }
    fetchBotStatus()
    const interval = setInterval(fetchBotStatus, 10000)
    return () => clearInterval(interval)
  }, [isAdmin])

  useEffect(() => {
    if (!isAdmin) return
    if (activeTab === 'subscribers') {
      fetchSubscribers()
    } else if (activeTab === 'messages') {
      fetchMessages()
    }
  }, [activeTab, isAdmin])

  const fetchBotStatus = async () => {
    try {
      const res = await fetch('/api/telegram/status', { credentials: 'include' })
      if (res.ok) {
        const data = await res.json()
        setBotStatus(data)
        setError(null)
      }
    } catch (err) {
      console.error('Failed to fetch bot status:', err)
    }
  }

  const fetchSubscribers = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/telegram/subscribers', { credentials: 'include' })
      if (res.ok) {
        const data = await res.json()
        setSubscribers(data.subscribers || [])
      }
    } catch (err: any) {
      setError(err.message || 'Failed to fetch subscribers')
    } finally {
      setLoading(false)
    }
  }

  const fetchMessages = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/telegram/messages', { credentials: 'include' })
      if (res.ok) {
        const data = await res.json()
        setMessages(data.messages || [])
      }
    } catch (err: any) {
      setError(err.message || 'Failed to fetch messages')
    } finally {
      setLoading(false)
    }
  }

  const sendMessageToChat = async () => {
    if (!messageInput.trim() || !selectedChatId) {
      setError('Please select a chat and enter a message')
      return
    }

    setSendingMessage(true)
    try {
      const res = await fetch('/api/telegram/send-message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          chatId: selectedChatId,
          text: messageInput,
        }),
      })

      if (!res.ok) throw new Error('Failed to send message')

      setMessageInput('')
      setError(null)

      // Add message to local list
      const newMessage: Message = {
        id: Date.now().toString(),
        timestamp: new Date().toISOString(),
        chatId: selectedChatId,
        username: 'Admin',
        content: messageInput,
        type: 'sent',
      }
      setMessages(prev => [newMessage, ...prev])
    } catch (err: any) {
      setError(err.message || 'Failed to send message')
    } finally {
      setSendingMessage(false)
    }
  }

  const sendBroadcast = async () => {
    if (!broadcastMessage.trim()) {
      setError('Please enter a broadcast message')
      return
    }

    setSendingBroadcast(true)
    try {
      const res = await fetch('/api/telegram/broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          message: broadcastMessage,
          alertType: broadcastAlertType,
        }),
      })

      if (!res.ok) throw new Error('Failed to send broadcast')

      const data = await res.json()
      setBroadcastMessage('')
      setError(null)
      alert(`Broadcast sent to ${data.sent} subscribers`)
    } catch (err: any) {
      setError(err.message || 'Failed to send broadcast')
    } finally {
      setSendingBroadcast(false)
    }
  }

  const toggleSubscriber = async (subscriber: Subscriber) => {
    try {
      const res = await fetch(`/api/telegram/subscribers/${subscriber.chatId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          isActive: !subscriber.isActive,
        }),
      })

      if (!res.ok) throw new Error('Failed to update subscriber')

      setSubscribers(prev =>
        prev.map(s =>
          s.chatId === subscriber.chatId ? { ...s, isActive: !s.isActive } : s
        )
      )
    } catch (err: any) {
      setError(err.message || 'Failed to update subscriber')
    }
  }

  if (!isAdmin) {
    return (
      <div className="max-w-xl mx-auto mt-12 bg-dark-800 border border-dark-600 rounded-xl p-6 text-center">
        <SettingsIcon className="w-10 h-10 text-yellow-400 mx-auto mb-3" />
        <h2 className="text-xl font-semibold mb-2">Admin only</h2>
        <p className="text-gray-400 text-sm">You need admin access to view this page.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={goBack}
          className="p-2 hover:bg-dark-700 rounded-lg transition-colors"
          title="Go back"
        >
          <ArrowLeft className="w-5 h-5 text-gray-400 hover:text-white" />
        </button>
        <MessageCircle className="w-6 h-6 text-accent-green" />
        <div>
          <h1 className="text-2xl font-bold">Telegram Bot Admin</h1>
          <p className="text-sm text-gray-400">Manage your Telegram bot and subscribers</p>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="flex items-center gap-2 text-sm text-red-400 bg-red-400/10 border border-red-400/30 rounded-lg px-3 py-2">
          <AlertCircle className="w-4 h-4" />
          {error}
        </div>
      )}

      {/* Bot Status Card */}
      {botStatus && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-dark-800 border border-dark-600 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className={`w-2 h-2 rounded-full ${botStatus.isRunning ? 'bg-accent-green pulse' : 'bg-red-500'}`} />
              <span className="text-xs text-gray-400">Status</span>
            </div>
            <p className="text-lg font-bold">{botStatus.isRunning ? 'Online' : 'Offline'}</p>
          </div>

          <div className="bg-dark-800 border border-dark-600 rounded-xl p-4">
            <p className="text-xs text-gray-400 mb-2">Bot Name</p>
            <p className="text-lg font-bold font-mono truncate">@{botStatus.botUsername}</p>
          </div>

          <div className="bg-dark-800 border border-dark-600 rounded-xl p-4">
            <p className="text-xs text-gray-400 mb-2">Subscribers</p>
            <p className="text-lg font-bold">{botStatus.subscriberCount}</p>
          </div>

          <div className="bg-dark-800 border border-dark-600 rounded-xl p-4">
            <p className="text-xs text-gray-400 mb-2">Bot ID</p>
            <p className="text-lg font-bold font-mono text-sm">{botStatus.botId}</p>
          </div>
        </div>
      )}

      {loading && activeTab !== 'status' ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-accent-green" />
        </div>
      ) : (
        <>
          {/* Tabs */}
          <div className="flex gap-2 border-b border-dark-600">
            {(['status', 'subscribers', 'messages', 'broadcast'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2 border-b-2 transition-colors capitalize ${
                  activeTab === tab
                    ? 'border-accent-green text-accent-green font-medium'
                    : 'border-transparent text-gray-400 hover:text-white'
                }`}
              >
                {tab === 'broadcast' ? 'Broadcast' : tab === 'messages' ? 'Messages' : tab}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          {activeTab === 'status' && (
            <div className="bg-dark-800 border border-dark-600 rounded-xl p-6 space-y-4">
              <div>
                <h3 className="font-semibold mb-3">Bot Configuration</h3>
                <div className="space-y-3">
                  <div>
                    <label className="text-xs text-gray-400">Bot Token</label>
                    <div className="flex items-center gap-2 mt-1">
                      <input
                        type={showBotToken ? 'text' : 'password'}
                        value={botToken}
                        readOnly
                        placeholder="Loading..."
                        className="flex-1"
                      />
                      <button
                        onClick={() => setShowBotToken(!showBotToken)}
                        className="p-2 hover:bg-dark-700 rounded-lg"
                      >
                        {showBotToken ? (
                          <EyeOff className="w-4 h-4 text-gray-400" />
                        ) : (
                          <Eye className="w-4 h-4 text-gray-400" />
                        )}
                      </button>
                      <button
                        onClick={() => navigator.clipboard.writeText(botToken)}
                        className="p-2 hover:bg-dark-700 rounded-lg"
                      >
                        <Copy className="w-4 h-4 text-gray-400" />
                      </button>
                    </div>
                  </div>

                  <div>
                    <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                      <Activity className="w-4 h-4" />
                      Service Information
                    </h4>
                    <div className="bg-dark-700 rounded-lg p-3 space-y-2 text-sm">
                      <p>
                        <span className="text-gray-400">Bot Name:</span>{' '}
                        <span className="font-mono">{botStatus?.firstName}</span>
                      </p>
                      <p>
                        <span className="text-gray-400">Bot ID:</span>{' '}
                        <span className="font-mono">{botStatus?.botId}</span>
                      </p>
                      <p>
                        <span className="text-gray-400">Total Subscribers:</span>{' '}
                        <span className="font-bold text-accent-green">{botStatus?.subscriberCount || 0}</span>
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'subscribers' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold flex items-center gap-2">
                  <Users className="w-4 h-4" />
                  Active Subscribers ({subscribers.filter(s => s.isActive).length}/{subscribers.length})
                </h3>
                <button
                  onClick={fetchSubscribers}
                  className="px-3 py-1 text-sm bg-dark-700 rounded-lg hover:bg-dark-600"
                >
                  Refresh
                </button>
              </div>

              <div className="space-y-2 max-h-[600px] overflow-auto">
                {subscribers.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <Users className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p>No subscribers yet</p>
                  </div>
                ) : (
                  subscribers.map(subscriber => (
                    <div
                      key={subscriber.chatId}
                      className={`bg-dark-800 border border-dark-600 rounded-lg p-4 ${
                        !subscriber.isActive ? 'opacity-60' : ''
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="font-semibold">@{subscriber.username}</h4>
                            {subscriber.isActive ? (
                              <span className="text-xs bg-accent-green/20 text-accent-green px-2 py-0.5 rounded-full">
                                Active
                              </span>
                            ) : (
                              <span className="text-xs bg-red-400/20 text-red-400 px-2 py-0.5 rounded-full">
                                Inactive
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-gray-500 font-mono mb-2">{subscriber.chatId}</p>
                          <div className="text-xs space-y-1 text-gray-400">
                            <p>
                              Launches: {subscriber.alertTypes.tokenLaunches ? '✅' : '❌'} | Signals:{' '}
                              {subscriber.alertTypes.highPrioritySignals ? '✅' : '❌'} | System:{' '}
                              {subscriber.alertTypes.systemAlerts ? '✅' : '❌'}
                            </p>
                            <p>Subscribed: {new Date(subscriber.subscribedAt).toLocaleDateString()}</p>
                          </div>
                        </div>
                        <button
                          onClick={() => toggleSubscriber(subscriber)}
                          className={`px-3 py-1 text-sm rounded-lg transition-colors ${
                            subscriber.isActive
                              ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
                              : 'bg-accent-green/20 text-accent-green hover:bg-accent-green/30'
                          }`}
                        >
                          {subscriber.isActive ? 'Deactivate' : 'Activate'}
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {activeTab === 'messages' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* Message Input */}
              <div className="lg:col-span-1 bg-dark-800 border border-dark-600 rounded-xl p-4 h-fit">
                <h3 className="font-semibold mb-3">Send Message</h3>
                <div className="space-y-3">
                  <div>
                    <label className="text-xs text-gray-400">Select Chat</label>
                    <select
                      value={selectedChatId || ''}
                      onChange={e => setSelectedChatId(e.target.value || null)}
                      className="w-full mt-1"
                    >
                      <option value="">Choose a subscriber...</option>
                      {subscribers.map(sub => (
                        <option key={sub.chatId} value={sub.chatId}>
                          @{sub.username}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-xs text-gray-400">Message</label>
                    <textarea
                      value={messageInput}
                      onChange={e => setMessageInput(e.target.value)}
                      placeholder="Type message..."
                      rows={4}
                      className="w-full mt-1 resize-none"
                    />
                  </div>

                  <button
                    onClick={sendMessageToChat}
                    disabled={sendingMessage || !selectedChatId || !messageInput.trim()}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-accent-green text-dark-900 rounded-lg font-semibold hover:bg-green-400 disabled:opacity-50"
                  >
                    {sendingMessage ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Send className="w-4 h-4" />
                    )}
                    {sendingMessage ? 'Sending...' : 'Send Message'}
                  </button>
                </div>
              </div>

              {/* Message History */}
              <div className="lg:col-span-2 bg-dark-800 border border-dark-600 rounded-xl p-4">
                <h3 className="font-semibold mb-3">Message History</h3>
                <div className="space-y-2 max-h-[500px] overflow-auto">
                  {messages.length === 0 ? (
                    <p className="text-center text-gray-500 py-8">No messages yet</p>
                  ) : (
                    messages.map(msg => (
                      <div
                        key={msg.id}
                        className={`p-3 rounded-lg text-sm ${
                          msg.type === 'sent'
                            ? 'bg-accent-green/10 border border-accent-green/30 ml-4'
                            : 'bg-dark-700 border border-dark-600 mr-4'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-semibold text-xs">{msg.username}</span>
                          <span className="text-xs text-gray-500">
                            {new Date(msg.timestamp).toLocaleTimeString()}
                          </span>
                        </div>
                        <p className="text-gray-200">{msg.content}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'broadcast' && (
            <div className="bg-dark-800 border border-dark-600 rounded-xl p-6 space-y-4">
              <div>
                <h3 className="font-semibold mb-3 flex items-center gap-2">
                  <Send className="w-4 h-4" />
                  Send Broadcast Message
                </h3>
                <p className="text-sm text-gray-400 mb-4">
                  Message will be sent to all subscribers with the selected alert type enabled.
                </p>

                <div className="space-y-4">
                  <div>
                    <label className="text-xs text-gray-400 mb-2 block">Alert Type</label>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { value: 'tokenLaunches' as const, label: '🚀 Token Launches' },
                        { value: 'highPrioritySignals' as const, label: '🎯 High Priority Signals' },
                        { value: 'systemAlerts' as const, label: '⚙️ System Alerts' },
                      ].map(type => (
                        <button
                          key={type.value}
                          onClick={() => setBroadcastAlertType(type.value)}
                          className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                            broadcastAlertType === type.value
                              ? 'bg-accent-green text-dark-900'
                              : 'bg-dark-700 text-gray-300 hover:bg-dark-600'
                          }`}
                        >
                          {type.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="text-xs text-gray-400 mb-2 block">Message</label>
                    <textarea
                      value={broadcastMessage}
                      onChange={e => setBroadcastMessage(e.target.value)}
                      placeholder="Enter broadcast message (supports Markdown)..."
                      rows={6}
                      className="w-full resize-none"
                    />
                  </div>

                  <div className="flex items-center gap-2 text-sm text-gray-400">
                    <span>
                      Will reach ~{subscribers.filter(s => s.isActive && s.alertTypes[broadcastAlertType]).length}{' '}
                      subscribers
                    </span>
                  </div>

                  <button
                    onClick={sendBroadcast}
                    disabled={sendingBroadcast || !broadcastMessage.trim()}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-accent-green text-dark-900 rounded-lg font-semibold hover:bg-green-400 disabled:opacity-50"
                  >
                    {sendingBroadcast ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Send className="w-4 h-4" />
                    )}
                    {sendingBroadcast ? 'Sending...' : 'Send Broadcast'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}