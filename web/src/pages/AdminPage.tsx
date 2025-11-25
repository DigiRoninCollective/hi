import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { Shield, Save, AlertCircle } from 'lucide-react'

interface PlatformSettings {
  buy_fee_bps: number
  sell_fee_bps: number
  fee_wallet: string
}

export default function AdminPage() {
  const { user } = useAuth()
  const [settings, setSettings] = useState<PlatformSettings>({
    buy_fee_bps: 150,
    sell_fee_bps: 150,
    fee_wallet: '',
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  const isAdmin = user?.role === 'admin'

  useEffect(() => {
    const fetchSettings = async () => {
      setLoading(true)
      try {
        const res = await fetch('/api/auth/admin/platform-settings', { credentials: 'include' })
        if (!res.ok) {
          throw new Error('Not authorized')
        }
        const data = await res.json()
        setSettings({
          buy_fee_bps: data.buy_fee_bps ?? 150,
          sell_fee_bps: data.sell_fee_bps ?? 150,
          fee_wallet: data.fee_wallet ?? '',
        })
      } catch (err: any) {
        setError(err.message || 'Failed to load settings')
      } finally {
        setLoading(false)
      }
    }
    if (isAdmin) {
      fetchSettings()
    } else {
      setLoading(false)
    }
  }, [isAdmin])

  const saveSettings = async () => {
    setSaving(true)
    setError(null)
    setSaved(false)
    try {
      const res = await fetch('/api/auth/admin/platform-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(settings),
      })
      if (!res.ok) {
        throw new Error('Failed to save')
      }
      setSaved(true)
    } catch (err: any) {
      setError(err.message || 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  if (!isAdmin) {
    return (
      <div className="max-w-xl mx-auto mt-12 bg-dark-800 border border-dark-600 rounded-xl p-6 text-center">
        <Shield className="w-10 h-10 text-yellow-400 mx-auto mb-3" />
        <h2 className="text-xl font-semibold mb-2">Admin only</h2>
        <p className="text-gray-400 text-sm">You need admin access to view this page.</p>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Shield className="w-6 h-6 text-accent-green" />
        <div>
          <h1 className="text-2xl font-bold">Platform Settings</h1>
          <p className="text-sm text-gray-400">Configure fee defaults for buys and auto-sells.</p>
        </div>
      </div>

      <div className="bg-dark-800 border border-dark-600 rounded-xl p-6 space-y-4">
        {error && (
          <div className="flex items-center gap-2 text-sm text-yellow-400 bg-yellow-400/10 border border-yellow-400/30 rounded-lg px-3 py-2">
            <AlertCircle className="w-4 h-4" />
            {error}
          </div>
        )}
        {saved && (
          <div className="text-sm text-accent-green bg-accent-green/10 border border-accent-green/30 rounded-lg px-3 py-2">
            Settings saved
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-gray-400 mb-1">Buy fee (bps)</label>
            <input
              type="number"
              value={settings.buy_fee_bps}
              onChange={(e) => setSettings((s) => ({ ...s, buy_fee_bps: parseInt(e.target.value || '0', 10) }))}
              className="w-full"
              min={0}
            />
            <p className="text-xs text-gray-500 mt-1">150 bps = 1.5%</p>
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Sell fee (bps)</label>
            <input
              type="number"
              value={settings.sell_fee_bps}
              onChange={(e) => setSettings((s) => ({ ...s, sell_fee_bps: parseInt(e.target.value || '0', 10) }))}
              className="w-full"
              min={0}
            />
            <p className="text-xs text-gray-500 mt-1">Applied to auto-sell actions.</p>
          </div>
        </div>

        <div>
          <label className="block text-xs text-gray-400 mb-1">Fee wallet (destination)</label>
          <input
            type="text"
            value={settings.fee_wallet}
            onChange={(e) => setSettings((s) => ({ ...s, fee_wallet: e.target.value }))}
            className="w-full"
            placeholder="Fee destination public key"
          />
        </div>

        <div className="flex justify-end">
          <button
            onClick={saveSettings}
            disabled={saving || loading}
            className="flex items-center gap-2 px-4 py-2 bg-accent-green text-dark-900 rounded-lg font-semibold hover:bg-green-400 disabled:opacity-60"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}
