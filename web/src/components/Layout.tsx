import { Outlet, Link, useLocation } from 'react-router-dom'
import { Rocket, Home, Zap, MessageSquare } from 'lucide-react'
import { useState, useEffect } from 'react'

export default function Layout() {
  const location = useLocation()
  const [connected, setConnected] = useState(false)
  const [walletBalance, setWalletBalance] = useState<number | null>(null)

  useEffect(() => {
    // Check health and get stats
    const checkConnection = async () => {
      try {
        const res = await fetch('/api/stats')
        if (res.ok) {
          setConnected(true)
          const data = await res.json()
          // You could get wallet balance from an extended endpoint
        }
      } catch {
        setConnected(false)
      }
    }

    checkConnection()
    const interval = setInterval(checkConnection, 10000)
    return () => clearInterval(interval)
  }, [])

  const navItems = [
    { path: '/', label: 'Home', icon: Home },
    { path: '/deploy', label: 'Deploy', icon: Rocket },
    { path: '/feed', label: 'Feed', icon: MessageSquare },
  ]

  return (
    <div className="min-h-screen bg-dark-900">
      {/* Header */}
      <header className="bg-dark-800 border-b border-dark-600">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <Link to="/" className="flex items-center gap-2">
              <Zap className="w-8 h-8 text-accent-green" />
              <span className="text-xl font-bold">PumpLauncher</span>
            </Link>

            {/* Navigation */}
            <nav className="flex items-center gap-1">
              {navItems.map((item) => {
                const Icon = item.icon
                const isActive = location.pathname === item.path
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                      isActive
                        ? 'bg-accent-green text-dark-900 font-medium'
                        : 'text-gray-400 hover:text-white hover:bg-dark-700'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span>{item.label}</span>
                  </Link>
                )
              })}
            </nav>

            {/* Status */}
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <div
                  className={`w-2 h-2 rounded-full ${
                    connected ? 'bg-accent-green pulse' : 'bg-red-500'
                  }`}
                />
                <span className="text-sm text-gray-400">
                  {connected ? 'Connected' : 'Disconnected'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Outlet />
      </main>
    </div>
  )
}
