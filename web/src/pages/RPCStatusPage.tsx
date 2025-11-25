import { useState, useEffect } from 'react'
import { Server, Zap, Activity, AlertTriangle, CheckCircle } from 'lucide-react'
import { useAuth } from '../context/AuthContext'

interface RPCEndpoint {
  name: string
  url: string
  status: 'healthy' | 'degraded' | 'down'
  latency: number
  uptime: number
  lastChecked: string
  isActive: boolean
}

export default function RPCStatusPage() {
  const { isAuthenticated } = useAuth()
  const [loading, setLoading] = useState(true)
  const [activeRpc, setActiveRpc] = useState<string>('')
  const [endpoints, setEndpoints] = useState<RPCEndpoint[]>([])
  const [autoFailover, setAutoFailover] = useState(true)
  const [failoverEnabled, setFailoverEnabled] = useState(true)

  useEffect(() => {
    if (isAuthenticated) {
      loadRpcStatus()
    }
  }, [isAuthenticated])

  const loadRpcStatus = async () => {
    try {
      const res = await fetch('/api/rpc/status', { credentials: 'include' })
      if (res.ok) {
        const data = await res.json()
        setActiveRpc(data.activeRpc)
        setEndpoints(data.endpoints || [])
        setAutoFailover(data.autoFailover)
        setFailoverEnabled(data.failoverEnabled)
      }
    } catch (error) {
      console.error('Failed to load RPC status:', error)
    } finally {
      setLoading(false)
    }
  }

  const switchRpc = async (rpcUrl: string) => {
    try {
      const res = await fetch('/api/rpc/switch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ rpcUrl }),
      })
      if (res.ok) {
        setActiveRpc(rpcUrl)
      }
    } catch (error) {
      console.error('Failed to switch RPC:', error)
    }
  }

  const toggleAutoFailover = async () => {
    try {
      const res = await fetch('/api/rpc/auto-failover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ enabled: !autoFailover }),
      })
      if (res.ok) {
        setAutoFailover(!autoFailover)
      }
    } catch (error) {
      console.error('Failed to toggle auto-failover:', error)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy':
        return 'text-green-500'
      case 'degraded':
        return 'text-yellow-500'
      case 'down':
        return 'text-red-500'
      default:
        return 'text-gray-500'
    }
  }

  const getStatusBgColor = (status: string) => {
    switch (status) {
      case 'healthy':
        return 'bg-green-600/10 border-green-600/30'
      case 'degraded':
        return 'bg-yellow-600/10 border-yellow-600/30'
      case 'down':
        return 'bg-red-600/10 border-red-600/30'
      default:
        return 'bg-dark-700 border-dark-600'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy':
        return <CheckCircle className="w-5 h-5 text-green-500" />
      case 'degraded':
        return <AlertTriangle className="w-5 h-5 text-yellow-500" />
      case 'down':
        return <AlertTriangle className="w-5 h-5 text-red-500" />
      default:
        return <Activity className="w-5 h-5 text-gray-500" />
    }
  }

  if (!isAuthenticated) {
    return (
      <div className="max-w-6xl mx-auto text-center py-12">
        <Server className="w-16 h-16 mx-auto mb-4 text-gray-600" />
        <h1 className="text-2xl font-bold mb-2">RPC Status</h1>
        <p className="text-gray-400">Sign in to view RPC endpoint status</p>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto">
        <h1 className="text-2xl font-bold mb-6 flex items-center gap-2">
          <Server className="w-6 h-6 text-accent-green" />
          RPC Status
        </h1>
        <p className="text-gray-400">Loading RPC status...</p>
      </div>
    )
  }

  const activeEndpoint = endpoints.find(e => e.url === activeRpc)
  const healthyEndpoints = endpoints.filter(e => e.status === 'healthy')
  const degradedEndpoints = endpoints.filter(e => e.status === 'degraded')
  const downEndpoints = endpoints.filter(e => e.status === 'down')

  return (
    <div className="max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold mb-6 flex items-center gap-2">
        <Server className="w-6 h-6 text-accent-green" />
        RPC Status
      </h1>

      {/* Overall Status */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-dark-800 rounded-lg border border-dark-600 p-4">
          <p className="text-sm text-gray-400 flex items-center gap-1">
            <CheckCircle className="w-4 h-4 text-green-500" />
            Healthy
          </p>
          <p className="text-3xl font-bold mt-2 text-green-500">{healthyEndpoints.length}</p>
        </div>

        <div className="bg-dark-800 rounded-lg border border-dark-600 p-4">
          <p className="text-sm text-gray-400 flex items-center gap-1">
            <AlertTriangle className="w-4 h-4 text-yellow-500" />
            Degraded
          </p>
          <p className="text-3xl font-bold mt-2 text-yellow-500">{degradedEndpoints.length}</p>
        </div>

        <div className="bg-dark-800 rounded-lg border border-dark-600 p-4">
          <p className="text-sm text-gray-400 flex items-center gap-1">
            <AlertTriangle className="w-4 h-4 text-red-500" />
            Down
          </p>
          <p className="text-3xl font-bold mt-2 text-red-500">{downEndpoints.length}</p>
        </div>

        <div className="bg-dark-800 rounded-lg border border-dark-600 p-4">
          <p className="text-sm text-gray-400 flex items-center gap-1">
            <Zap className="w-4 h-4" />
            Avg Latency
          </p>
          <p className="text-3xl font-bold mt-2">
            {(endpoints.reduce((sum, e) => sum + e.latency, 0) / Math.max(endpoints.length, 1)).toFixed(0)}ms
          </p>
        </div>
      </div>

      {/* Active RPC */}
      {activeEndpoint && (
        <div className={`border rounded-lg p-6 mb-6 ${getStatusBgColor(activeEndpoint.status)}`}>
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2 mb-2">
                {getStatusIcon(activeEndpoint.status)}
                <h3 className="text-lg font-semibold">Active RPC Endpoint</h3>
              </div>
              <p className="text-gray-300 font-mono text-sm">{activeEndpoint.url}</p>
              <div className="grid grid-cols-3 gap-4 mt-4 text-sm">
                <div>
                  <p className="text-gray-400">Latency</p>
                  <p className="font-semibold">{activeEndpoint.latency}ms</p>
                </div>
                <div>
                  <p className="text-gray-400">Uptime</p>
                  <p className="font-semibold">{activeEndpoint.uptime.toFixed(2)}%</p>
                </div>
                <div>
                  <p className="text-gray-400">Last Checked</p>
                  <p className="font-semibold">{new Date(activeEndpoint.lastChecked).toLocaleTimeString()}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Failover Settings */}
      <div className="bg-dark-800 rounded-lg border border-dark-600 p-6 mb-6">
        <h3 className="text-lg font-semibold mb-4">Failover Settings</h3>
        <div className="space-y-4">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={autoFailover}
              onChange={toggleAutoFailover}
              className="w-4 h-4 rounded bg-dark-700 border border-dark-600"
            />
            <div>
              <p className="font-semibold">Auto-failover to Healthy Endpoint</p>
              <p className="text-sm text-gray-400">Automatically switch to a healthy RPC if the active one goes down</p>
            </div>
          </label>

          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={failoverEnabled}
              className="w-4 h-4 rounded bg-dark-700 border border-dark-600"
              disabled
            />
            <div>
              <p className="font-semibold">Multiple Failover Endpoints</p>
              <p className="text-sm text-gray-400">Fallback chain ready with {endpoints.length} endpoints</p>
            </div>
          </label>
        </div>
      </div>

      {/* RPC Endpoints */}
      <div className="space-y-3">
        <h3 className="text-lg font-semibold">Available Endpoints</h3>
        {endpoints.length === 0 ? (
          <div className="bg-dark-800 rounded-lg border border-dark-600 p-6 text-center text-gray-400">
            No RPC endpoints configured
          </div>
        ) : (
          endpoints.map((endpoint, idx) => (
            <div
              key={idx}
              className={`border rounded-lg p-4 transition cursor-pointer ${
                endpoint.isActive
                  ? 'border-accent-green/50 bg-accent-green/5'
                  : `${getStatusBgColor(endpoint.status)}`
              }`}
              onClick={() => switchRpc(endpoint.url)}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    {getStatusIcon(endpoint.status)}
                    <h4 className="font-semibold">{endpoint.name}</h4>
                    {endpoint.isActive && (
                      <span className="px-2 py-1 bg-accent-green/20 text-accent-green text-xs rounded">
                        ACTIVE
                      </span>
                    )}
                  </div>
                  <p className="text-gray-400 font-mono text-sm break-all">{endpoint.url}</p>
                </div>

                <div className="ml-4 text-right">
                  <div className="inline-block">
                    <p className="text-xs text-gray-400">Status</p>
                    <p className={`font-semibold capitalize ${getStatusColor(endpoint.status)}`}>
                      {endpoint.status}
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4 mt-3 pt-3 border-t border-dark-600 text-sm">
                <div>
                  <p className="text-gray-400">Latency</p>
                  <p className="font-semibold">{endpoint.latency}ms</p>
                </div>
                <div>
                  <p className="text-gray-400">Uptime</p>
                  <p className="font-semibold">{endpoint.uptime.toFixed(2)}%</p>
                </div>
                <div>
                  <p className="text-gray-400">Last Checked</p>
                  <p className="text-xs font-semibold">{new Date(endpoint.lastChecked).toLocaleTimeString()}</p>
                </div>
              </div>

              {!endpoint.isActive && (
                <button
                  className="mt-3 px-4 py-2 bg-accent-green/10 hover:bg-accent-green/20 text-accent-green rounded-lg transition text-sm font-semibold"
                  onClick={(e) => {
                    e.stopPropagation()
                    switchRpc(endpoint.url)
                  }}
                >
                  Switch to This Endpoint
                </button>
              )}
            </div>
          ))
        )}
      </div>

      {/* RPC Health Info */}
      <div className="bg-dark-800 rounded-lg border border-dark-600 p-6 mt-6">
        <h3 className="text-lg font-semibold mb-4">RPC Health Information</h3>
        <div className="space-y-2 text-sm text-gray-400">
          <p>• <strong>Healthy:</strong> RPC is responding normally with latency &lt; 500ms</p>
          <p>• <strong>Degraded:</strong> RPC is responding but has higher latency (500ms - 2s) or occasional failures</p>
          <p>• <strong>Down:</strong> RPC is not responding or experiencing persistent failures</p>
          <p className="mt-4">• Latency is measured in milliseconds (lower is better)</p>
          <p>• Uptime is calculated as percentage of successful health checks over the last 24 hours</p>
          <p>• Auto-failover will switch to the best available healthy endpoint automatically</p>
        </div>
      </div>
    </div>
  )
}
