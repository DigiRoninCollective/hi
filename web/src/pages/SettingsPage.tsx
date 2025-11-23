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
    theme: 'dark' as 'dark' | 'light' | 'system',
    image_layout: 'grid' as 'grid' | 'list' | 'compact',
    card_width: 300,
    notifications_enabled: true,
    sound_enabled: false,
    auto_deploy_enabled: false,
    default_buy_amount: 0.1,
    default_platform: 'pump',
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
        theme: settings.theme || 'dark',
        image_layout: settings.image_layout || 'grid',
        card_width: settings.card_width || 300,
        notifications_enabled: settings.notifications_enabled ?? true,
        sound_enabled: settings.sound_enabled ?? false,
        auto_deploy_enabled: settings.auto_deploy_enabled ?? false,
        default_buy_amount: settings.default_buy_amount || 0.1,
        default_platform: settings.default_platform || 'pump',
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
