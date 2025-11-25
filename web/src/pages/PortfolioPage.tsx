import { useState, useEffect } from 'react'
import { Wallet, TrendingUp, TrendingDown, DollarSign, Percent } from 'lucide-react'
import { useAuth } from '../context/AuthContext'

interface Holding {
  id: string
  symbol: string
  amount: number
  cost: number
  current: number
  change: number
  changePercent: number
  usdValue: number
}

export default function PortfolioPage() {
  const { isAuthenticated } = useAuth()
  const [holdings, setHoldings] = useState<Holding[]>([])
  const [loading, setLoading] = useState(true)
  const [timeframe, setTimeframe] = useState('24h')

  useEffect(() => {
    if (isAuthenticated) {
      loadPortfolio()
    }
  }, [isAuthenticated, timeframe])

  const loadPortfolio = async () => {
    try {
      const res = await fetch(`/api/portfolio?timeframe=${timeframe}`, { credentials: 'include' })
      if (res.ok) {
        const data = await res.json()
        setHoldings(data.holdings || [])
      }
    } catch (error) {
      console.error('Failed to load portfolio:', error)
    } finally {
      setLoading(false)
    }
  }

  const totalValue = holdings.reduce((sum, h) => sum + h.usdValue, 0)
  const totalCost = holdings.reduce((sum, h) => sum + h.cost, 0)
  const totalGain = totalValue - totalCost
  const totalGainPercent = totalCost > 0 ? (totalGain / totalCost) * 100 : 0

  if (!isAuthenticated) {
    return (
      <div className="max-w-6xl mx-auto text-center py-12">
        <Wallet className="w-16 h-16 mx-auto mb-4 text-gray-600" />
        <h1 className="text-2xl font-bold mb-2">Portfolio</h1>
        <p className="text-gray-400">Sign in to view your portfolio</p>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Wallet className="w-6 h-6 text-accent-green" />
          Portfolio
        </h1>
        <div className="flex gap-2">
          {['24h', '7d', '30d', 'all'].map(tf => (
            <button
              key={tf}
              onClick={() => setTimeframe(tf)}
              className={`px-4 py-2 rounded-lg transition ${timeframe === tf ? 'bg-accent-green text-dark-900' : 'bg-dark-700 hover:bg-dark-600'}`}
            >
              {tf.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-dark-800 rounded-lg border border-dark-600 p-6">
          <p className="text-sm text-gray-400 flex items-center gap-1"><DollarSign className="w-4 h-4" /> Total Value</p>
          <p className="text-3xl font-bold mt-2">${totalValue.toFixed(2)}</p>
          <p className="text-xs text-gray-500 mt-1">{(totalValue / 1.5).toFixed(2)} SOL</p>
        </div>

        <div className="bg-dark-800 rounded-lg border border-dark-600 p-6">
          <p className="text-sm text-gray-400">Total Cost</p>
          <p className="text-3xl font-bold mt-2">${totalCost.toFixed(2)}</p>
          <p className="text-xs text-gray-500 mt-1">{(totalCost / 1.5).toFixed(2)} SOL</p>
        </div>

        <div className={`bg-dark-800 rounded-lg border border-dark-600 p-6 ${totalGain >= 0 ? 'border-green-600/30' : 'border-red-600/30'}`}>
          <p className="text-sm text-gray-400 flex items-center gap-1">
            {totalGain >= 0 ? <TrendingUp className="w-4 h-4 text-green-500" /> : <TrendingDown className="w-4 h-4 text-red-500" />}
            Total Gain/Loss
          </p>
          <p className={`text-3xl font-bold mt-2 ${totalGain >= 0 ? 'text-green-500' : 'text-red-500'}`}>
            ${Math.abs(totalGain).toFixed(2)}
          </p>
          <p className={`text-xs mt-1 ${totalGain >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {totalGain >= 0 ? '+' : ''}{totalGainPercent.toFixed(2)}%
          </p>
        </div>

        <div className="bg-dark-800 rounded-lg border border-dark-600 p-6">
          <p className="text-sm text-gray-400 flex items-center gap-1"><Percent className="w-4 h-4" /> ROI</p>
          <p className={`text-3xl font-bold mt-2 ${totalGainPercent >= 0 ? 'text-green-500' : 'text-red-500'}`}>
            {totalGainPercent.toFixed(2)}%
          </p>
          <p className="text-xs text-gray-500 mt-1">Return on Investment</p>
        </div>
      </div>

      {/* Holdings Table */}
      <div className="bg-dark-800 rounded-lg border border-dark-600 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-dark-600 bg-dark-700/50">
                <th className="px-6 py-3 text-left text-sm font-semibold">Token</th>
                <th className="px-6 py-3 text-right text-sm font-semibold">Amount</th>
                <th className="px-6 py-3 text-right text-sm font-semibold">Cost</th>
                <th className="px-6 py-3 text-right text-sm font-semibold">Current</th>
                <th className="px-6 py-3 text-right text-sm font-semibold">Gain/Loss</th>
                <th className="px-6 py-3 text-right text-sm font-semibold">Value (USD)</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-gray-400">
                    Loading portfolio...
                  </td>
                </tr>
              ) : holdings.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-gray-400">
                    No holdings yet
                  </td>
                </tr>
              ) : (
                holdings.map(h => (
                  <tr key={h.id} className="border-b border-dark-600 hover:bg-dark-700/50 transition">
                    <td className="px-6 py-4">
                      <span className="font-semibold">{h.symbol}</span>
                    </td>
                    <td className="px-6 py-4 text-right font-mono text-sm">{h.amount.toFixed(2)}</td>
                    <td className="px-6 py-4 text-right font-mono text-sm">${h.cost.toFixed(2)}</td>
                    <td className="px-6 py-4 text-right font-mono text-sm">${h.current.toFixed(2)}</td>
                    <td className={`px-6 py-4 text-right font-mono text-sm ${h.change >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                      {h.change >= 0 ? '+' : ''}{h.change.toFixed(2)} ({h.changePercent.toFixed(2)}%)
                    </td>
                    <td className="px-6 py-4 text-right font-mono text-sm">${h.usdValue.toFixed(2)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Chart Placeholder */}
      <div className="bg-dark-800 rounded-lg border border-dark-600 p-6 mt-6">
        <h3 className="text-lg font-semibold mb-4">Portfolio Performance</h3>
        <div className="bg-dark-700 rounded h-64 flex items-center justify-center text-gray-500">
          Chart visualization coming soon
        </div>
      </div>
    </div>
  )
}
