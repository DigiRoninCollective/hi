import { useState, useEffect } from 'react'
import { AlertTriangle, Power, Pause, Lock, Clock } from 'lucide-react'
import { useAuth } from '../context/AuthContext'

export default function EmergencyControlPage() {
  const { isAuthenticated } = useAuth()
  const [tradingActive, setTradingActive] = useState(true)
  const [walletLocked, setWalletLocked] = useState(false)
  const [lastAction, setLastAction] = useState<string | null>(null)
  const [confirmingAction, setConfirmingAction] = useState<string | null>(null)

  useEffect(() => {
    if (isAuthenticated) {
      loadEmergencyStatus()
    }
  }, [isAuthenticated])

  const loadEmergencyStatus = async () => {
    try {
      const res = await fetch('/api/emergency/status', { credentials: 'include' })
      if (res.ok) {
        const data = await res.json()
        setTradingActive(data.tradingActive)
        setWalletLocked(data.walletLocked)
        setLastAction(data.lastAction)
      }
    } catch (error) {
      console.error('Failed to load emergency status:', error)
    }
  }

  const killSwitch = async () => {
    setConfirmingAction(null)
    try {
      const res = await fetch('/api/emergency/kill-switch', {
        method: 'POST',
        credentials: 'include',
      })
      if (res.ok) {
        setTradingActive(false)
        setLastAction(new Date().toISOString())
      }
    } catch (error) {
      console.error('Failed to activate kill switch:', error)
    }
  }

  const resumeTrading = async () => {
    try {
      const res = await fetch('/api/emergency/resume', {
        method: 'POST',
        credentials: 'include',
      })
      if (res.ok) {
        setTradingActive(true)
        setLastAction(new Date().toISOString())
      }
    } catch (error) {
      console.error('Failed to resume trading:', error)
    }
  }

  const emergencyLockWallet = async () => {
    setConfirmingAction(null)
    try {
      const res = await fetch('/api/emergency/lock-wallet', {
        method: 'POST',
        credentials: 'include',
      })
      if (res.ok) {
        setWalletLocked(true)
        setLastAction(new Date().toISOString())
      }
    } catch (error) {
      console.error('Failed to lock wallet:', error)
    }
  }

  const unlockWallet = async () => {
    try {
      const res = await fetch('/api/emergency/unlock-wallet', {
        method: 'POST',
        credentials: 'include',
      })
      if (res.ok) {
        setWalletLocked(false)
        setLastAction(new Date().toISOString())
      }
    } catch (error) {
      console.error('Failed to unlock wallet:', error)
    }
  }

  if (!isAuthenticated) {
    return (
      <div className="max-w-6xl mx-auto text-center py-12">
        <AlertTriangle className="w-16 h-16 mx-auto mb-4 text-gray-600" />
        <h1 className="text-2xl font-bold mb-2">Emergency Controls</h1>
        <p className="text-gray-400">Sign in to access emergency controls</p>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <AlertTriangle className="w-6 h-6 text-red-500" />
          Emergency Controls
        </h1>
      </div>

      {/* Status Summary */}
      <div className="bg-red-600/10 border border-red-600/30 rounded-lg p-6 mb-6">
        <p className="text-red-400 mb-2 font-semibold">CRITICAL: Use only in emergencies</p>
        <p className="text-gray-300">These controls will immediately halt all trading and lock your wallet. Use with extreme caution.</p>
      </div>

      {/* Current Status */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-dark-800 rounded-lg border border-dark-600 p-6">
          <p className="text-sm text-gray-400 flex items-center gap-1">
            <Pause className="w-4 h-4" />
            Trading Status
          </p>
          <p className={`text-3xl font-bold mt-2 ${tradingActive ? 'text-green-500' : 'text-red-500'}`}>
            {tradingActive ? 'ACTIVE' : 'PAUSED'}
          </p>
          <p className="text-xs text-gray-500 mt-1">{tradingActive ? 'Trading enabled' : 'All trading halted'}</p>
        </div>

        <div className="bg-dark-800 rounded-lg border border-dark-600 p-6">
          <p className="text-sm text-gray-400 flex items-center gap-1">
            <Lock className="w-4 h-4" />
            Wallet Status
          </p>
          <p className={`text-3xl font-bold mt-2 ${walletLocked ? 'text-red-500' : 'text-green-500'}`}>
            {walletLocked ? 'LOCKED' : 'UNLOCKED'}
          </p>
          <p className="text-xs text-gray-500 mt-1">{walletLocked ? 'Wallet locked' : 'Wallet operational'}</p>
        </div>
      </div>

      {lastAction && (
        <div className="bg-dark-700 rounded-lg border border-dark-600 p-4 mb-6 flex items-center gap-2">
          <Clock className="w-4 h-4 text-gray-400" />
          <span className="text-sm text-gray-400">
            Last action: {new Date(lastAction).toLocaleString()}
          </span>
        </div>
      )}

      {/* Emergency Controls */}
      <div className="space-y-4">
        {/* Kill Switch */}
        <div className="bg-dark-800 rounded-lg border border-dark-600 p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-semibold flex items-center gap-2 text-red-400">
                <Power className="w-5 h-5" />
                Kill Switch
              </h3>
              <p className="text-sm text-gray-400 mt-1">Immediately stop all trading activity. Cannot be undone with simple toggle.</p>
            </div>
          </div>

          {confirmingAction === 'kill-switch' ? (
            <div className="bg-red-600/10 border border-red-600/30 rounded p-4 space-y-3">
              <p className="text-red-400 font-semibold">Are you absolutely sure? This will:</p>
              <ul className="text-sm text-red-300 space-y-1 ml-4">
                <li>• Immediately cancel all pending trades</li>
                <li>• Disable all buy/sell orders</li>
                <li>• Require manual intervention to resume</li>
              </ul>
              <div className="flex gap-2 mt-4">
                <button
                  onClick={killSwitch}
                  className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition font-semibold"
                >
                  CONFIRM KILL SWITCH
                </button>
                <button
                  onClick={() => setConfirmingAction(null)}
                  className="flex-1 px-4 py-2 bg-dark-700 hover:bg-dark-600 text-gray-300 rounded-lg transition"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setConfirmingAction('kill-switch')}
              disabled={!tradingActive}
              className={`w-full px-4 py-3 rounded-lg transition font-semibold flex items-center justify-center gap-2 ${
                tradingActive
                  ? 'bg-red-600 hover:bg-red-700 text-white'
                  : 'bg-dark-700 text-gray-500 cursor-not-allowed'
              }`}
            >
              <Power className="w-4 h-4" />
              {tradingActive ? 'Activate Kill Switch' : 'Kill Switch Already Active'}
            </button>
          )}
        </div>

        {/* Resume Trading */}
        <div className="bg-dark-800 rounded-lg border border-dark-600 p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-semibold flex items-center gap-2 text-green-400">
                <Pause className="w-5 h-5" />
                Resume Trading
              </h3>
              <p className="text-sm text-gray-400 mt-1">Carefully re-enable trading after emergency. All settings preserved.</p>
            </div>
          </div>

          <button
            onClick={resumeTrading}
            disabled={tradingActive}
            className={`w-full px-4 py-3 rounded-lg transition font-semibold flex items-center justify-center gap-2 ${
              !tradingActive
                ? 'bg-green-600 hover:bg-green-700 text-white'
                : 'bg-dark-700 text-gray-500 cursor-not-allowed'
            }`}
          >
            <Pause className="w-4 h-4" />
            {!tradingActive ? 'Resume Trading' : 'Trading Already Active'}
          </button>
        </div>

        {/* Emergency Wallet Lock */}
        <div className="bg-dark-800 rounded-lg border border-dark-600 p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-semibold flex items-center gap-2 text-red-400">
                <Lock className="w-5 h-5" />
                Emergency Wallet Lock
              </h3>
              <p className="text-sm text-gray-400 mt-1">Lock wallet to prevent any transactions or movements.</p>
            </div>
          </div>

          {confirmingAction === 'lock-wallet' ? (
            <div className="bg-red-600/10 border border-red-600/30 rounded p-4 space-y-3">
              <p className="text-red-400 font-semibold">Confirm wallet lock?</p>
              <p className="text-sm text-red-300">Your wallet will be completely locked. Only you can unlock it.</p>
              <div className="flex gap-2 mt-4">
                <button
                  onClick={emergencyLockWallet}
                  className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition font-semibold"
                >
                  CONFIRM LOCK
                </button>
                <button
                  onClick={() => setConfirmingAction(null)}
                  className="flex-1 px-4 py-2 bg-dark-700 hover:bg-dark-600 text-gray-300 rounded-lg transition"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setConfirmingAction('lock-wallet')}
              disabled={walletLocked}
              className={`w-full px-4 py-3 rounded-lg transition font-semibold flex items-center justify-center gap-2 ${
                !walletLocked
                  ? 'bg-red-600 hover:bg-red-700 text-white'
                  : 'bg-dark-700 text-gray-500 cursor-not-allowed'
              }`}
            >
              <Lock className="w-4 h-4" />
              {!walletLocked ? 'Lock Wallet' : 'Wallet Already Locked'}
            </button>
          )}
        </div>

        {/* Unlock Wallet */}
        <div className="bg-dark-800 rounded-lg border border-dark-600 p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-semibold flex items-center gap-2 text-blue-400">
                <Lock className="w-5 h-5" />
                Unlock Wallet
              </h3>
              <p className="text-sm text-gray-400 mt-1">Restore wallet access after emergency lock.</p>
            </div>
          </div>

          <button
            onClick={unlockWallet}
            disabled={!walletLocked}
            className={`w-full px-4 py-3 rounded-lg transition font-semibold flex items-center justify-center gap-2 ${
              walletLocked
                ? 'bg-blue-600 hover:bg-blue-700 text-white'
                : 'bg-dark-700 text-gray-500 cursor-not-allowed'
            }`}
          >
            <Lock className="w-4 h-4" />
            {walletLocked ? 'Unlock Wallet' : 'Wallet Already Unlocked'}
          </button>
        </div>
      </div>
    </div>
  )
}
