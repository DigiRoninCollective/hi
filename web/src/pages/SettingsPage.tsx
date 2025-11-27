import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Settings,
  User,
  Bell,
  Palette,
  Wallet,
  Twitter,
  Save,
  Loader2,
  Plus,
  XCircle,
  Lock,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { KeypairLoader } from '../components/KeypairLoader'

interface WatchedAccount {
  id: string
  twitter_username: string
  is_active: boolean
}

export default function SettingsPage() {
  const { user, settings, updateSettings, isAuthenticated } = useAuth()
  const { addToast } = useToast()
  const navigate = useNavigate()

  const [isSaving, setIsSaving] = useState(false)
  const [localSettings, setLocalSettings] = useState({
    // UI & Appearance
    theme: 'dark' as 'dark' | 'light' | 'system',
    image_layout: 'grid' as 'grid' | 'list' | 'compact',
    card_width: 300,
    show_balance_in_usd: true,
    number_format: 'comma' as 'comma' | 'space' | 'none',
    show_testnet_warning: true,

    // Notifications & Alerts
    notifications_enabled: true,
    sound_enabled: false,
    large_transaction_alert: true,
    large_transaction_threshold: 5, // SOL
    high_slippage_alert: true,
    high_slippage_threshold: 1, // %

    // Trading & Deployment
    auto_deploy_enabled: false,
    default_buy_amount: 0.1,
    default_platform: 'pump',
    slippage_tolerance: 0.5, // %
    transaction_priority: 'normal' as 'low' | 'normal' | 'high' | 'custom',
    custom_priority_fee: 0,
    simulate_transactions: true,

    // Auto-sell & Take-profit
    auto_sell_enabled: false,
    auto_sell_percentage: 25, // %
    take_profit_enabled: false,
    take_profit_targets: '1.5x,2x,5x', // comma-separated
    stop_loss_enabled: false,
    stop_loss_percentage: 10, // %

    // Solana Network
    solana_network: 'mainnet-beta' as 'mainnet-beta' | 'devnet' | 'testnet',
    custom_rpc_url: '',
    use_custom_rpc: false,

    // External Services
    birdeye_api_key: '',
    blockscout_api_key: '',
    alchemy_api_key: '',

    // Data & Backup
    export_settings_frequency: 'never' as 'never' | 'daily' | 'weekly' | 'manual',
    auto_export_transactions: false,
    export_transaction_frequency: 'never' as 'never' | 'weekly' | 'monthly' | 'manual',
    clear_cache_on_exit: false,
  })

  // Watched accounts
  const [watchedAccounts, setWatchedAccounts] = useState<WatchedAccount[]>([])
  const [newAccount, setNewAccount] = useState('')
  const [loadingAccounts, setLoadingAccounts] = useState(false)

  // Password change
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [changingPassword, setChangingPassword] = useState(false)

  useEffect(() => {
    if (settings) {
      setLocalSettings({
        // UI & Appearance
        theme: settings.theme || 'dark',
        image_layout: settings.image_layout || 'grid',
        card_width: settings.card_width || 300,
        show_balance_in_usd: settings.show_balance_in_usd ?? true,
        number_format: settings.number_format || 'comma',
        show_testnet_warning: settings.show_testnet_warning ?? true,

        // Notifications & Alerts
        notifications_enabled: settings.notifications_enabled ?? true,
        sound_enabled: settings.sound_enabled ?? false,
        large_transaction_alert: settings.large_transaction_alert ?? true,
        large_transaction_threshold: settings.large_transaction_threshold || 5,
        high_slippage_alert: settings.high_slippage_alert ?? true,
        high_slippage_threshold: settings.high_slippage_threshold || 1,

        // Trading & Deployment
        auto_deploy_enabled: settings.auto_deploy_enabled ?? false,
        default_buy_amount: settings.default_buy_amount || 0.1,
        default_platform: settings.default_platform || 'pump',
        slippage_tolerance: settings.slippage_tolerance || 0.5,
        transaction_priority: settings.transaction_priority || 'normal',
        custom_priority_fee: settings.custom_priority_fee || 0,
        simulate_transactions: settings.simulate_transactions ?? true,

        // Auto-sell & Take-profit
        auto_sell_enabled: settings.auto_sell_enabled ?? false,
        auto_sell_percentage: settings.auto_sell_percentage || 25,
        take_profit_enabled: settings.take_profit_enabled ?? false,
        take_profit_targets: settings.take_profit_targets || '1.5x,2x,5x',
        stop_loss_enabled: settings.stop_loss_enabled ?? false,
        stop_loss_percentage: settings.stop_loss_percentage || 10,

        // Solana Network
        solana_network: settings.solana_network || 'mainnet-beta',
        custom_rpc_url: settings.custom_rpc_url || '',
        use_custom_rpc: settings.use_custom_rpc ?? false,

        // External Services
        birdeye_api_key: settings.birdeye_api_key || '',
        blockscout_api_key: settings.blockscout_api_key || '',
        alchemy_api_key: settings.alchemy_api_key || '',

        // Data & Backup
        export_settings_frequency: settings.export_settings_frequency || 'never',
        auto_export_transactions: settings.auto_export_transactions ?? false,
        export_transaction_frequency: settings.export_transaction_frequency || 'never',
        clear_cache_on_exit: settings.clear_cache_on_exit ?? false,
      })
    }
  }, [settings])

  useEffect(() => {
    if (isAuthenticated) {
      loadWatchedAccounts()
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

  const handleSaveSettings = async () => {
    setIsSaving(true)
    const success = await updateSettings(localSettings)
    setIsSaving(false)

    if (success) {
      addToast('success', 'Settings saved')
    } else {
      addToast('error', 'Failed to save settings')
    }
  }

  const handleAddAccount = async () => {
    if (!newAccount.trim()) return

    setLoadingAccounts(true)
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
        addToast('success', `Added @${newAccount.replace('@', '')}`)
      } else {
        const data = await res.json()
        addToast('error', data.error || 'Failed to add account')
      }
    } catch {
      addToast('error', 'Network error')
    } finally {
      setLoadingAccounts(false)
    }
  }

  const handleRemoveAccount = async (id: string, username: string) => {
    try {
      const res = await fetch(`/api/auth/watched-accounts/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      })

      if (res.ok) {
        setWatchedAccounts(prev => prev.filter(a => a.id !== id))
        addToast('success', `Removed @${username}`)
      }
    } catch {
      addToast('error', 'Failed to remove account')
    }
  }

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault()

    if (newPassword.length < 8) {
      addToast('error', 'New password must be at least 8 characters')
      return
    }

    if (newPassword !== confirmPassword) {
      addToast('error', 'Passwords do not match')
      return
    }

    setChangingPassword(true)
    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ currentPassword, newPassword }),
      })

      const data = await res.json()

      if (res.ok && data.success) {
        addToast('success', 'Password changed successfully')
        setCurrentPassword('')
        setNewPassword('')
        setConfirmPassword('')
      } else {
        addToast('error', data.error || 'Failed to change password')
      }
    } catch {
      addToast('error', 'Network error')
    } finally {
      setChangingPassword(false)
    }
  }

  if (!isAuthenticated) {
    return (
      <div className="max-w-2xl mx-auto text-center py-12">
        <Settings className="w-16 h-16 mx-auto mb-4 text-gray-600" />
        <h1 className="text-2xl font-bold mb-2">Settings</h1>
        <p className="text-gray-400 mb-6">Sign in to access your settings</p>
        <button
          onClick={() => navigate('/login')}
          className="px-6 py-3 bg-accent-green text-dark-900 rounded-lg font-bold hover:bg-green-400"
        >
          Sign In
        </button>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-6 flex items-center gap-2">
        <Settings className="w-6 h-6 text-accent-green" />
        Settings
      </h1>

      <div className="space-y-6">
        {/* Profile Section */}
        <section className="bg-dark-800 rounded-xl border border-dark-600 p-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <User className="w-5 h-5" />
            Profile
          </h2>
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-dark-600 flex items-center justify-center text-2xl font-bold">
              {user?.username.charAt(0).toUpperCase()}
            </div>
            <div>
              <p className="font-semibold">{user?.username}</p>
              <p className="text-sm text-gray-400 capitalize">{user?.role}</p>
            </div>
          </div>
        </section>

        {/* Keypair Management Section */}
        <section className="bg-dark-800 rounded-xl border border-dark-600 p-6">
          <KeypairLoader />
        </section>

        {/* Appearance Section */}
        <section className="bg-dark-800 rounded-xl border border-dark-600 p-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Palette className="w-5 h-5" />
            Appearance
          </h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-gray-400 mb-2">Theme</label>
              <select
                value={localSettings.theme}
                onChange={(e) => setLocalSettings(s => ({ ...s, theme: e.target.value as 'dark' | 'light' | 'system' }))}
                className="w-full bg-dark-700 rounded-lg px-4 py-2 border border-dark-600"
              >
                <option value="dark">Dark</option>
                <option value="light">Light</option>
                <option value="system">System</option>
              </select>
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-2">Image Layout</label>
              <select
                value={localSettings.image_layout}
                onChange={(e) => setLocalSettings(s => ({ ...s, image_layout: e.target.value as 'grid' | 'list' | 'compact' }))}
                className="w-full bg-dark-700 rounded-lg px-4 py-2 border border-dark-600"
              >
                <option value="grid">Grid</option>
                <option value="list">List</option>
                <option value="compact">Compact</option>
              </select>
            </div>
          </div>
        </section>

        {/* Notifications Section */}
        <section className="bg-dark-800 rounded-xl border border-dark-600 p-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Bell className="w-5 h-5" />
            Notifications
          </h2>
          <div className="space-y-4">
            <label className="flex items-center justify-between cursor-pointer">
              <span>Push Notifications</span>
              <input
                type="checkbox"
                checked={localSettings.notifications_enabled}
                onChange={(e) => setLocalSettings(s => ({ ...s, notifications_enabled: e.target.checked }))}
                className="toggle"
              />
            </label>
            <label className="flex items-center justify-between cursor-pointer">
              <span>Sound Effects</span>
              <input
                type="checkbox"
                checked={localSettings.sound_enabled}
                onChange={(e) => setLocalSettings(s => ({ ...s, sound_enabled: e.target.checked }))}
                className="toggle"
              />
            </label>
          </div>
        </section>

        {/* Trading Defaults Section */}
        <section className="bg-dark-800 rounded-xl border border-dark-600 p-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Wallet className="w-5 h-5" />
            Trading Defaults
          </h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-gray-400 mb-2">Default Buy Amount (SOL)</label>
              <input
                type="number"
                step="0.1"
                min="0"
                value={localSettings.default_buy_amount}
                onChange={(e) => setLocalSettings(s => ({ ...s, default_buy_amount: parseFloat(e.target.value) || 0 }))}
                className="w-full"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-2">Default Platform</label>
              <select
                value={localSettings.default_platform}
                onChange={(e) => setLocalSettings(s => ({ ...s, default_platform: e.target.value }))}
                className="w-full bg-dark-700 rounded-lg px-4 py-2 border border-dark-600"
              >
                <option value="pump">Pump.fun</option>
                <option value="bonk">BONK</option>
                <option value="bags">Bags</option>
              </select>
            </div>
            <label className="flex items-center justify-between cursor-pointer">
              <span>Auto-deploy on launch detection</span>
              <input
                type="checkbox"
                checked={localSettings.auto_deploy_enabled}
                onChange={(e) => setLocalSettings(s => ({ ...s, auto_deploy_enabled: e.target.checked }))}
                className="toggle"
              />
            </label>
          </div>
        </section>

        {/* Display Preferences Section */}
        <section className="bg-dark-800 rounded-xl border border-dark-600 p-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Palette className="w-5 h-5" />
            Display Preferences
          </h2>
          <div className="space-y-4">
            <label className="flex items-center justify-between cursor-pointer">
              <span>Show Balance in USD</span>
              <input
                type="checkbox"
                checked={localSettings.show_balance_in_usd}
                onChange={(e) => setLocalSettings(s => ({ ...s, show_balance_in_usd: e.target.checked }))}
                className="toggle"
              />
            </label>
            <div>
              <label className="block text-sm text-gray-400 mb-2">Number Format</label>
              <select
                value={localSettings.number_format}
                onChange={(e) => setLocalSettings(s => ({ ...s, number_format: e.target.value as 'comma' | 'space' | 'none' }))}
                className="w-full bg-dark-700 rounded-lg px-4 py-2 border border-dark-600"
              >
                <option value="comma">1,234.56</option>
                <option value="space">1 234.56</option>
                <option value="none">1234.56</option>
              </select>
            </div>
            <label className="flex items-center justify-between cursor-pointer">
              <span>Show Testnet Warning</span>
              <input
                type="checkbox"
                checked={localSettings.show_testnet_warning}
                onChange={(e) => setLocalSettings(s => ({ ...s, show_testnet_warning: e.target.checked }))}
                className="toggle"
              />
            </label>
          </div>
        </section>

        {/* Security Alerts Section */}
        <section className="bg-dark-800 rounded-xl border border-dark-600 p-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Lock className="w-5 h-5" />
            Security Alerts
          </h2>
          <div className="space-y-4">
            <label className="flex items-center justify-between cursor-pointer">
              <span>Large Transaction Warning</span>
              <input
                type="checkbox"
                checked={localSettings.large_transaction_alert}
                onChange={(e) => setLocalSettings(s => ({ ...s, large_transaction_alert: e.target.checked }))}
                className="toggle"
              />
            </label>
            {localSettings.large_transaction_alert && (
              <div>
                <label className="block text-sm text-gray-400 mb-2">Threshold (SOL)</label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  value={localSettings.large_transaction_threshold}
                  onChange={(e) => setLocalSettings(s => ({ ...s, large_transaction_threshold: parseFloat(e.target.value) || 0 }))}
                  className="w-full bg-dark-700 rounded-lg px-4 py-2 border border-dark-600"
                />
              </div>
            )}
            <label className="flex items-center justify-between cursor-pointer">
              <span>High Slippage Warning</span>
              <input
                type="checkbox"
                checked={localSettings.high_slippage_alert}
                onChange={(e) => setLocalSettings(s => ({ ...s, high_slippage_alert: e.target.checked }))}
                className="toggle"
              />
            </label>
            {localSettings.high_slippage_alert && (
              <div>
                <label className="block text-sm text-gray-400 mb-2">Threshold (%)</label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  value={localSettings.high_slippage_threshold}
                  onChange={(e) => setLocalSettings(s => ({ ...s, high_slippage_threshold: parseFloat(e.target.value) || 0 }))}
                  className="w-full bg-dark-700 rounded-lg px-4 py-2 border border-dark-600"
                />
              </div>
            )}
          </div>
        </section>

        {/* Advanced Trading Section */}
        <section className="bg-dark-800 rounded-xl border border-dark-600 p-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Settings className="w-5 h-5" />
            Advanced Trading
          </h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-gray-400 mb-2">Slippage Tolerance (%)</label>
              <input
                type="number"
                step="0.1"
                min="0"
                max="50"
                value={localSettings.slippage_tolerance}
                onChange={(e) => setLocalSettings(s => ({ ...s, slippage_tolerance: parseFloat(e.target.value) || 0 }))}
                className="w-full bg-dark-700 rounded-lg px-4 py-2 border border-dark-600"
              />
              <p className="text-xs text-gray-500 mt-1">Protect against price impact (0.1% - 50%)</p>
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-2">Transaction Priority</label>
              <select
                value={localSettings.transaction_priority}
                onChange={(e) => setLocalSettings(s => ({ ...s, transaction_priority: e.target.value as 'low' | 'normal' | 'high' | 'custom' }))}
                className="w-full bg-dark-700 rounded-lg px-4 py-2 border border-dark-600"
              >
                <option value="low">Low (Slower, cheaper)</option>
                <option value="normal">Normal (Balanced)</option>
                <option value="high">High (Faster, expensive)</option>
                <option value="custom">Custom</option>
              </select>
            </div>
            {localSettings.transaction_priority === 'custom' && (
              <div>
                <label className="block text-sm text-gray-400 mb-2">Custom Priority Fee (SOL)</label>
                <input
                  type="number"
                  step="0.00001"
                  min="0"
                  value={localSettings.custom_priority_fee}
                  onChange={(e) => setLocalSettings(s => ({ ...s, custom_priority_fee: parseFloat(e.target.value) || 0 }))}
                  className="w-full bg-dark-700 rounded-lg px-4 py-2 border border-dark-600"
                />
              </div>
            )}
            <label className="flex items-center justify-between cursor-pointer">
              <span>Simulate Transactions Before Sending</span>
              <input
                type="checkbox"
                checked={localSettings.simulate_transactions}
                onChange={(e) => setLocalSettings(s => ({ ...s, simulate_transactions: e.target.checked }))}
                className="toggle"
              />
            </label>
          </div>
        </section>

        {/* Auto-sell & Take-profit Section */}
        <section className="bg-dark-800 rounded-xl border border-dark-600 p-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Wallet className="w-5 h-5" />
            Auto-sell & Take-profit
          </h2>
          <div className="space-y-4">
            <label className="flex items-center justify-between cursor-pointer">
              <span>Enable Auto-sell</span>
              <input
                type="checkbox"
                checked={localSettings.auto_sell_enabled}
                onChange={(e) => setLocalSettings(s => ({ ...s, auto_sell_enabled: e.target.checked }))}
                className="toggle"
              />
            </label>
            {localSettings.auto_sell_enabled && (
              <div>
                <label className="block text-sm text-gray-400 mb-2">Auto-sell Percentage (%)</label>
                <input
                  type="number"
                  step="1"
                  min="0"
                  max="100"
                  value={localSettings.auto_sell_percentage}
                  onChange={(e) => setLocalSettings(s => ({ ...s, auto_sell_percentage: parseFloat(e.target.value) || 0 }))}
                  className="w-full bg-dark-700 rounded-lg px-4 py-2 border border-dark-600"
                />
              </div>
            )}
            <label className="flex items-center justify-between cursor-pointer">
              <span>Enable Take-profit Targets</span>
              <input
                type="checkbox"
                checked={localSettings.take_profit_enabled}
                onChange={(e) => setLocalSettings(s => ({ ...s, take_profit_enabled: e.target.checked }))}
                className="toggle"
              />
            </label>
            {localSettings.take_profit_enabled && (
              <div>
                <label className="block text-sm text-gray-400 mb-2">Take-profit Targets (comma-separated)</label>
                <input
                  type="text"
                  placeholder="1.5x,2x,5x,10x"
                  value={localSettings.take_profit_targets}
                  onChange={(e) => setLocalSettings(s => ({ ...s, take_profit_targets: e.target.value }))}
                  className="w-full bg-dark-700 rounded-lg px-4 py-2 border border-dark-600"
                />
                <p className="text-xs text-gray-500 mt-1">e.g., 1.5x, 2x, 5x, 10x</p>
              </div>
            )}
            <label className="flex items-center justify-between cursor-pointer">
              <span>Enable Stop-loss</span>
              <input
                type="checkbox"
                checked={localSettings.stop_loss_enabled}
                onChange={(e) => setLocalSettings(s => ({ ...s, stop_loss_enabled: e.target.checked }))}
                className="toggle"
              />
            </label>
            {localSettings.stop_loss_enabled && (
              <div>
                <label className="block text-sm text-gray-400 mb-2">Stop-loss Percentage (%)</label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  max="100"
                  value={localSettings.stop_loss_percentage}
                  onChange={(e) => setLocalSettings(s => ({ ...s, stop_loss_percentage: parseFloat(e.target.value) || 0 }))}
                  className="w-full bg-dark-700 rounded-lg px-4 py-2 border border-dark-600"
                />
              </div>
            )}
          </div>
        </section>

        {/* External API Keys Section */}
        <section className="bg-dark-800 rounded-xl border border-dark-600 p-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Settings className="w-5 h-5" />
            External Services
          </h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-gray-400 mb-2">Birdeye API Key (Optional)</label>
              <input
                type="password"
                placeholder="Enter your Birdeye API key"
                value={localSettings.birdeye_api_key}
                onChange={(e) => setLocalSettings(s => ({ ...s, birdeye_api_key: e.target.value }))}
                className="w-full bg-dark-700 rounded-lg px-4 py-2 border border-dark-600"
              />
              <p className="text-xs text-gray-500 mt-1">For advanced charting and analytics</p>
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-2">BlockScout API Key (Optional)</label>
              <input
                type="password"
                placeholder="Enter your BlockScout API key"
                value={localSettings.blockscout_api_key}
                onChange={(e) => setLocalSettings(s => ({ ...s, blockscout_api_key: e.target.value }))}
                className="w-full bg-dark-700 rounded-lg px-4 py-2 border border-dark-600"
              />
              <p className="text-xs text-gray-500 mt-1">For blockchain explorer integration</p>
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-2">Alchemy API Key (Optional)</label>
              <input
                type="password"
                placeholder="Enter your Alchemy API key"
                value={localSettings.alchemy_api_key}
                onChange={(e) => setLocalSettings(s => ({ ...s, alchemy_api_key: e.target.value }))}
                className="w-full bg-dark-700 rounded-lg px-4 py-2 border border-dark-600"
              />
              <p className="text-xs text-gray-500 mt-1">For enhanced RPC features and webhooks</p>
            </div>
          </div>
        </section>

        {/* Data & Backup Section */}
        <section className="bg-dark-800 rounded-xl border border-dark-600 p-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Settings className="w-5 h-5" />
            Data & Backup
          </h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-gray-400 mb-2">Auto-export Settings</label>
              <select
                value={localSettings.export_settings_frequency}
                onChange={(e) => setLocalSettings(s => ({ ...s, export_settings_frequency: e.target.value as 'never' | 'daily' | 'weekly' | 'manual' }))}
                className="w-full bg-dark-700 rounded-lg px-4 py-2 border border-dark-600"
              >
                <option value="never">Never</option>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="manual">Manual Only</option>
              </select>
            </div>
            <label className="flex items-center justify-between cursor-pointer">
              <span>Auto-export Transaction History</span>
              <input
                type="checkbox"
                checked={localSettings.auto_export_transactions}
                onChange={(e) => setLocalSettings(s => ({ ...s, auto_export_transactions: e.target.checked }))}
                className="toggle"
              />
            </label>
            {localSettings.auto_export_transactions && (
              <div>
                <label className="block text-sm text-gray-400 mb-2">Export Frequency</label>
                <select
                  value={localSettings.export_transaction_frequency}
                  onChange={(e) => setLocalSettings(s => ({ ...s, export_transaction_frequency: e.target.value as 'never' | 'weekly' | 'monthly' | 'manual' }))}
                  className="w-full bg-dark-700 rounded-lg px-4 py-2 border border-dark-600"
                >
                  <option value="never">Never</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                  <option value="manual">Manual Only</option>
                </select>
              </div>
            )}
            <label className="flex items-center justify-between cursor-pointer">
              <span>Clear Cache on Exit</span>
              <input
                type="checkbox"
                checked={localSettings.clear_cache_on_exit}
                onChange={(e) => setLocalSettings(s => ({ ...s, clear_cache_on_exit: e.target.checked }))}
                className="toggle"
              />
            </label>
          </div>
        </section>

        {/* Solana Network Section */}
        <section className="bg-dark-800 rounded-xl border border-dark-600 p-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Settings className="w-5 h-5" />
            Solana Network
          </h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-gray-400 mb-2">Network</label>
              <select
                value={localSettings.solana_network}
                onChange={(e) => setLocalSettings(s => ({ ...s, solana_network: e.target.value as 'mainnet-beta' | 'devnet' | 'testnet' }))}
                className="w-full bg-dark-700 rounded-lg px-4 py-2 border border-dark-600"
              >
                <option value="mainnet-beta">Mainnet Beta (Production)</option>
                <option value="devnet">Devnet (Testing)</option>
                <option value="testnet">Testnet (Staging)</option>
              </select>
              <p className="text-xs text-gray-500 mt-2">
                {localSettings.solana_network === 'mainnet-beta' && 'Production network - Real SOL'}
                {localSettings.solana_network === 'devnet' && 'Test network - Free test SOL available'}
                {localSettings.solana_network === 'testnet' && 'Staging network - Test transactions'}
              </p>
            </div>

            <label className="flex items-center justify-between cursor-pointer">
              <span className="text-sm">Use Custom RPC Endpoint</span>
              <input
                type="checkbox"
                checked={localSettings.use_custom_rpc}
                onChange={(e) => setLocalSettings(s => ({ ...s, use_custom_rpc: e.target.checked }))}
                className="toggle"
              />
            </label>

            {localSettings.use_custom_rpc && (
              <div>
                <label className="block text-sm text-gray-400 mb-2">Custom RPC URL</label>
                <input
                  type="text"
                  placeholder="https://api.mainnet-beta.solana.com"
                  value={localSettings.custom_rpc_url}
                  onChange={(e) => setLocalSettings(s => ({ ...s, custom_rpc_url: e.target.value }))}
                  className="w-full bg-dark-700 rounded-lg px-4 py-2 border border-dark-600"
                />
                <p className="text-xs text-gray-500 mt-2">
                  Enter a custom Solana RPC endpoint URL. Useful for private RPC services or dedicated endpoints.
                </p>
              </div>
            )}

            <div className="bg-dark-700 rounded-lg p-3">
              <p className="text-xs text-gray-400">
                <span className="font-semibold">Current Endpoint:</span>
                <br />
                {localSettings.use_custom_rpc && localSettings.custom_rpc_url
                  ? localSettings.custom_rpc_url
                  : `https://api.${localSettings.solana_network}.solana.com`}
              </p>
            </div>
          </div>
        </section>

        {/* Save Button */}
        <button
          onClick={handleSaveSettings}
          disabled={isSaving}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-accent-green text-dark-900 rounded-lg font-bold hover:bg-green-400 disabled:opacity-50"
        >
          {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
          Save Settings
        </button>

        {/* Watched Accounts Section */}
        <section className="bg-dark-800 rounded-xl border border-dark-600 p-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Twitter className="w-5 h-5 text-blue-400" />
            Watched Twitter Accounts
          </h2>

          <div className="flex gap-2 mb-4">
            <input
              type="text"
              value={newAccount}
              onChange={(e) => setNewAccount(e.target.value.replace('@', ''))}
              onKeyDown={(e) => e.key === 'Enter' && handleAddAccount()}
              placeholder="@username"
              className="flex-1"
            />
            <button
              onClick={handleAddAccount}
              disabled={loadingAccounts || !newAccount.trim()}
              className="px-4 py-2 bg-blue-600 rounded-lg hover:bg-blue-500 disabled:opacity-50 flex items-center gap-2"
            >
              {loadingAccounts ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Add
            </button>
          </div>

          <div className="space-y-2">
            {watchedAccounts.length === 0 ? (
              <p className="text-gray-500 text-sm text-center py-4">No accounts added yet</p>
            ) : (
              watchedAccounts.map((account) => (
                <div
                  key={account.id}
                  className="flex items-center justify-between bg-dark-700 rounded-lg px-4 py-3"
                >
                  <span>@{account.twitter_username}</span>
                  <button
                    onClick={() => handleRemoveAccount(account.id, account.twitter_username)}
                    className="text-gray-500 hover:text-red-400"
                  >
                    <XCircle className="w-5 h-5" />
                  </button>
                </div>
              ))
            )}
          </div>
        </section>

        {/* Change Password Section */}
        <section className="bg-dark-800 rounded-xl border border-dark-600 p-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Lock className="w-5 h-5" />
            Change Password
          </h2>

          <form onSubmit={handleChangePassword} className="space-y-4">
            <div>
              <label className="block text-sm text-gray-400 mb-2">Current Password</label>
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="w-full"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-2">New Password</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-2">Confirm New Password</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full"
              />
            </div>
            <button
              type="submit"
              disabled={changingPassword || !currentPassword || !newPassword}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-dark-600 text-white rounded-lg font-bold hover:bg-dark-500 disabled:opacity-50"
            >
              {changingPassword ? <Loader2 className="w-5 h-5 animate-spin" /> : <Lock className="w-5 h-5" />}
              Change Password
            </button>
          </form>
        </section>
      </div>
    </div>
  )
}
