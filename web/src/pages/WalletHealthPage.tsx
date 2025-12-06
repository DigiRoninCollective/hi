import { useState, useEffect } from 'react'
import { Wallet, AlertCircle, TrendingUp, BarChart3, Zap } from 'lucide-react'
import { useAuth } from '../context/AuthContext'

interface TokenBalance {
  symbol: string
  amount: number
  usdValue: number
  percentage: number
}

interface WalletHealth {
  solBalance: number
  totalUsdValue: number
  tokenCount: number
  recommendedMinSol: number
  avgTransactionSize: number
  warningLevel: 'healthy' | 'warning' | 'critical'
}

export default function WalletHealthPage() {
  const { isAuthenticated } = useAuth()
  const [loading, setLoading] = useState(true)
  const [walletHealth, setWalletHealth] = useState<WalletHealth | null>(null)
  const [topTokens, setTopTokens] = useState<TokenBalance[]>([])

  useEffect(() => {
    if (isAuthenticated) {
      loadWalletHealth()
    }
  }, [isAuthenticated])

  const loadWalletHealth = async () => {
    try {
      const res = await fetch('/api/wallet/health', { credentials: 'include' })
      if (res.ok) {
        const data = await res.json()
        setWalletHealth(data.health)
        setTopTokens(data.topTokens || [])
      }
    } catch (error) {
      console.error('Failed to load wallet health:', error)
    } finally {
      setLoading(false)
    }
  }

  if (!isAuthenticated) {
    return (
      <div className="max-w-6xl mx-auto text-center py-12">
        <Wallet className="w-16 h-16 mx-auto mb-4 text-gray-600" />
        <h1 className="text-2xl font-bold mb-2">Wallet Health</h1>
        <p className="text-gray-400">Sign in to view wallet health status</p>
      </div>
    )
  }

  if (loading || !walletHealth) {
    return (
      <div className="max-w-6xl mx-auto">
        <h1 className="text-2xl font-bold mb-6 flex items-center gap-2">
          <Wallet className="w-6 h-6 text-accent-green" />
          Wallet Health
        </h1>
        <p className="text-gray-400">Loading wallet data...</p>
      </div>
    )
  }

  const healthColor =
    walletHealth.warningLevel === 'healthy' ? 'text-green-500' :
    walletHealth.warningLevel === 'warning' ? 'text-yellow-500' :
    'text-red-500'

  const healthBgColor =
    walletHealth.warningLevel === 'healthy' ? 'bg-green-600/10 border-green-600/30' :
    walletHealth.warningLevel === 'warning' ? 'bg-yellow-600/10 border-yellow-600/30' :
    'bg-red-600/10 border-red-600/30'

  const healthText =
    walletHealth.warningLevel === 'healthy' ? 'Your wallet is healthy' :
    walletHealth.warningLevel === 'warning' ? 'Warning: Low on SOL reserves' :
    'Critical: Insufficient funds for operations'

  const solPercentage = walletHealth.totalUsdValue > 0
    ? (walletHealth.solBalance / walletHealth.totalUsdValue) * 100
    : 0

  return (
    <div className="max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold mb-6 flex items-center gap-2">
        <Wallet className="w-6 h-6 text-accent-green" />
        Wallet Health
      </h1>

      {/* Health Status Alert */}
      <div className={`border rounded-lg p-6 mb-6 ${healthBgColor}`}>
        <div className="flex items-center justify-between">
          <div>
            <p className={`font-semibold capitalize ${healthColor}`}>
              {walletHealth.warningLevel === 'healthy' ? '✓' : '⚠'} {walletHealth.warningLevel.toUpperCase()}
            </p>
            <p className="text-gray-300 mt-1">{healthText}</p>
          </div>
          <AlertCircle className={`w-8 h-8 ${healthColor}`} />
        </div>
      </div>

      {/* Main Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-dark-800 rounded-lg border border-dark-600 p-6">
          <p className="text-sm text-gray-400 flex items-center gap-1">
            <Wallet className="w-4 h-4" />
            SOL Balance
          </p>
          <p className="text-3xl font-bold mt-2">{walletHealth.solBalance.toFixed(4)}</p>
          <p className="text-xs text-gray-500 mt-1">${(walletHealth.solBalance * 180).toFixed(2)}</p>
        </div>

        <div className="bg-dark-800 rounded-lg border border-dark-600 p-6">
          <p className="text-sm text-gray-400 flex items-center gap-1">
            <TrendingUp className="w-4 h-4" />
            Total Value
          </p>
          <p className="text-3xl font-bold mt-2">${walletHealth.totalUsdValue.toFixed(2)}</p>
          <p className="text-xs text-gray-500 mt-1">{walletHealth.tokenCount} tokens</p>
        </div>

        <div className="bg-dark-800 rounded-lg border border-dark-600 p-6">
          <p className="text-sm text-gray-400 flex items-center gap-1">
            <BarChart3 className="w-4 h-4" />
            SOL %
          </p>
          <p className="text-3xl font-bold mt-2">{solPercentage.toFixed(1)}%</p>
          <p className="text-xs text-gray-500 mt-1">of portfolio</p>
        </div>

        <div className="bg-dark-800 rounded-lg border border-dark-600 p-6">
          <p className="text-sm text-gray-400 flex items-center gap-1">
            <Zap className="w-4 h-4" />
            Min Recommended
          </p>
          <p className="text-3xl font-bold mt-2">{walletHealth.recommendedMinSol.toFixed(2)}</p>
          <p className="text-xs text-gray-500 mt-1">SOL reserve</p>
        </div>
      </div>

      {/* Recommendations */}
      <div className="bg-dark-800 rounded-lg border border-dark-600 p-6 mb-6">
        <h3 className="text-lg font-semibold mb-4">Wallet Recommendations</h3>
        <div className="space-y-3">
          <div className="flex items-start gap-3">
            <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${
              walletHealth.solBalance >= walletHealth.recommendedMinSol
                ? 'bg-green-600/20 text-green-400'
                : 'bg-red-600/20 text-red-400'
            }`}>
              {walletHealth.solBalance >= walletHealth.recommendedMinSol ? '✓' : '!'}
            </div>
            <div>
              <p className="font-semibold">SOL Reserve</p>
              <p className="text-sm text-gray-400">
                Maintain at least {walletHealth.recommendedMinSol.toFixed(2)} SOL for transaction fees and operations
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${
              walletHealth.tokenCount <= 50
                ? 'bg-green-600/20 text-green-400'
                : 'bg-yellow-600/20 text-yellow-400'
            }`}>
              {walletHealth.tokenCount <= 50 ? '✓' : '!'}
            </div>
            <div>
              <p className="font-semibold">Token Diversification</p>
              <p className="text-sm text-gray-400">
                Currently holding {walletHealth.tokenCount} tokens. Consider consolidating low-value positions
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 bg-blue-600/20 text-blue-400">
              ℹ
            </div>
            <div>
              <p className="font-semibold">Average Transaction Size</p>
              <p className="text-sm text-gray-400">
                Your typical transaction size is ${walletHealth.avgTransactionSize.toFixed(2)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Top Token Holdings */}
      <div className="bg-dark-800 rounded-lg border border-dark-600 overflow-hidden">
        <div className="p-6 border-b border-dark-600">
          <h3 className="text-lg font-semibold">Top Token Holdings</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-dark-600 bg-dark-700/50">
                <th className="px-6 py-3 text-left text-sm font-semibold">Token</th>
                <th className="px-6 py-3 text-right text-sm font-semibold">Amount</th>
                <th className="px-6 py-3 text-right text-sm font-semibold">Value (USD)</th>
                <th className="px-6 py-3 text-right text-sm font-semibold">Portfolio %</th>
              </tr>
            </thead>
            <tbody>
              {topTokens.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-gray-400">
                    No tokens found
                  </td>
                </tr>
              ) : (
                topTokens.map((token, idx) => (
                  <tr key={idx} className="border-b border-dark-600 hover:bg-dark-700/50 transition">
                    <td className="px-6 py-4">
                      <span className="font-semibold">{token.symbol}</span>
                    </td>
                    <td className="px-6 py-4 text-right font-mono text-sm">{token.amount.toFixed(6)}</td>
                    <td className="px-6 py-4 text-right font-mono text-sm">${token.usdValue.toFixed(2)}</td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <div className="w-24 h-2 bg-dark-600 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-accent-green rounded-full"
                            style={{ width: `${token.percentage}%` }}
                          />
                        </div>
                        <span className="text-sm text-gray-400 w-12">{token.percentage.toFixed(1)}%</span>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Health Tips */}
      <div className="bg-dark-800 rounded-lg border border-dark-600 p-6 mt-6">
        <h3 className="text-lg font-semibold mb-4">Health Tips</h3>
        <ul className="space-y-2 text-sm text-gray-400">
          <li>• Keep at least 1 SOL in your account for transaction fees</li>
          <li>• Regularly consolidate dust and small token positions</li>
          <li>• Monitor your portfolio allocation to avoid over-concentration</li>
          <li>• Use wallet health checks before major trading sessions</li>
          <li>• Consider emergency reserves for market volatility</li>
        </ul>
      </div>
    </div>
  )
}
