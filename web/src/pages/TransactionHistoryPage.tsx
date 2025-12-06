import { useState, useEffect } from 'react'
import { History, Download, Search, TrendingUp, TrendingDown, Clock } from 'lucide-react'
import { useAuth } from '../context/AuthContext'

interface Transaction {
  id: string
  type: 'deploy' | 'buy' | 'sell'
  token: string
  amount: number
  fee: number
  status: 'success' | 'failed' | 'pending'
  timestamp: string
  hash?: string
  usdValue?: number
}

export default function TransactionHistoryPage() {
  const { isAuthenticated } = useAuth()
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')

  useEffect(() => {
    if (isAuthenticated) {
      loadTransactions()
    }
  }, [isAuthenticated])

  const loadTransactions = async () => {
    try {
      const res = await fetch('/api/transactions', { credentials: 'include' })
      if (res.ok) {
        const data = await res.json()
        setTransactions(data.transactions || [])
      }
    } catch (error) {
      console.error('Failed to load transactions:', error)
    } finally {
      setLoading(false)
    }
  }

  const filtered = transactions.filter(t => {
    const matchesFilter = filter === 'all' || t.type === filter
    const matchesSearch = t.token.toLowerCase().includes(search.toLowerCase()) ||
      t.hash?.includes(search) ||
      t.id.includes(search)
    return matchesFilter && matchesSearch
  })

  const totalFees = filtered.reduce((sum, t) => sum + t.fee, 0)
  const successCount = filtered.filter(t => t.status === 'success').length
  const failedCount = filtered.filter(t => t.status === 'failed').length

  if (!isAuthenticated) {
    return (
      <div className="max-w-6xl mx-auto text-center py-12">
        <History className="w-16 h-16 mx-auto mb-4 text-gray-600" />
        <h1 className="text-2xl font-bold mb-2">Transaction History</h1>
        <p className="text-gray-400">Sign in to view your transactions</p>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold mb-6 flex items-center gap-2">
        <History className="w-6 h-6 text-accent-green" />
        Transaction History
      </h1>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-dark-800 rounded-lg border border-dark-600 p-4">
          <p className="text-sm text-gray-400">Total Transactions</p>
          <p className="text-2xl font-bold mt-1">{filtered.length}</p>
        </div>
        <div className="bg-dark-800 rounded-lg border border-dark-600 p-4">
          <p className="text-sm text-gray-400 flex items-center gap-1"><TrendingUp className="w-4 h-4 text-green-500" /> Successful</p>
          <p className="text-2xl font-bold mt-1 text-green-500">{successCount}</p>
        </div>
        <div className="bg-dark-800 rounded-lg border border-dark-600 p-4">
          <p className="text-sm text-gray-400 flex items-center gap-1"><TrendingDown className="w-4 h-4 text-red-500" /> Failed</p>
          <p className="text-2xl font-bold mt-1 text-red-500">{failedCount}</p>
        </div>
        <div className="bg-dark-800 rounded-lg border border-dark-600 p-4">
          <p className="text-sm text-gray-400">Total Fees</p>
          <p className="text-2xl font-bold mt-1">{totalFees.toFixed(4)} SOL</p>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="bg-dark-800 rounded-lg border border-dark-600 p-4 mb-6 space-y-4">
        <div className="flex gap-2 items-center">
          <Search className="w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search by token, hash, or ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 bg-dark-700 rounded-lg px-4 py-2 border border-dark-600"
          />
          <button className="flex items-center gap-2 px-4 py-2 bg-accent-green/10 hover:bg-accent-green/20 text-accent-green rounded-lg transition">
            <Download className="w-4 h-4" />
            Export CSV
          </button>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => setFilter('all')}
            className={`px-4 py-2 rounded-lg transition ${filter === 'all' ? 'bg-accent-green text-dark-900' : 'bg-dark-700 hover:bg-dark-600'}`}
          >
            All
          </button>
          <button
            onClick={() => setFilter('deploy')}
            className={`px-4 py-2 rounded-lg transition ${filter === 'deploy' ? 'bg-accent-green text-dark-900' : 'bg-dark-700 hover:bg-dark-600'}`}
          >
            Deploy
          </button>
          <button
            onClick={() => setFilter('buy')}
            className={`px-4 py-2 rounded-lg transition ${filter === 'buy' ? 'bg-accent-green text-dark-900' : 'bg-dark-700 hover:bg-dark-600'}`}
          >
            Buy
          </button>
          <button
            onClick={() => setFilter('sell')}
            className={`px-4 py-2 rounded-lg transition ${filter === 'sell' ? 'bg-accent-green text-dark-900' : 'bg-dark-700 hover:bg-dark-600'}`}
          >
            Sell
          </button>
        </div>
      </div>

      {/* Transaction List */}
      <div className="space-y-2">
        {loading ? (
          <div className="text-center py-12 text-gray-400">Loading transactions...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-gray-400">No transactions found</div>
        ) : (
          filtered.map(tx => (
            <div key={tx.id} className="bg-dark-800 rounded-lg border border-dark-600 p-4 flex items-center justify-between hover:border-dark-500 transition">
              <div className="flex items-center gap-4 flex-1">
                <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                  tx.type === 'deploy' ? 'bg-blue-600/20 text-blue-400' :
                  tx.type === 'buy' ? 'bg-green-600/20 text-green-400' :
                  'bg-purple-600/20 text-purple-400'
                }`}>
                  {tx.type === 'deploy' ? '🚀' : tx.type === 'buy' ? '📈' : '📊'}
                </div>
                <div className="flex-1">
                  <p className="font-semibold capitalize">{tx.type} {tx.token}</p>
                  <p className="text-sm text-gray-400 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {new Date(tx.timestamp).toLocaleString()}
                  </p>
                </div>
              </div>

              <div className="text-right space-y-1">
                <p className="font-mono">{tx.amount.toFixed(4)} SOL</p>
                <p className={`text-sm ${tx.status === 'success' ? 'text-green-400' : tx.status === 'failed' ? 'text-red-400' : 'text-yellow-400'}`}>
                  {tx.status}
                </p>
              </div>

              <div className="text-right ml-8">
                <p className="text-sm text-gray-400">Fee: {tx.fee.toFixed(4)} SOL</p>
                {tx.hash && (
                  <a href={`https://solscan.io/tx/${tx.hash}`} target="_blank" rel="noopener noreferrer" className="text-xs text-accent-green hover:underline">
                    View on Solscan
                  </a>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
