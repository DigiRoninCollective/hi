import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom'
import { Rocket, Home, Zap, MessageSquare, Settings, LogOut, LogIn, TrendingUp, LayoutDashboard } from 'lucide-react'
import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'

export default function Layout() {
  const location = useLocation()
  const navigate = useNavigate()
  const { user, isAuthenticated, logout, isLoading } = useAuth()
  const [connected, setConnected] = useState(false)
  const [walletBalance, setWalletBalance] = useState<number | null>(null)
  const [showUserMenu, setShowUserMenu] = useState(false)

  useEffect(() => {
    // Check health and get wallet balance
    const checkConnection = async () => {
      try {
        const res = await fetch('/api/stats')
        if (res.ok) {
          setConnected(true)
        }

        // Get wallet balance
        const walletRes = await fetch('/api/wallet')
        if (walletRes.ok) {
          const data = await walletRes.json()
          setWalletBalance(data.balance)
        }
      } catch {
        setConnected(false)
      }
    }

    checkConnection()
    const interval = setInterval(checkConnection, 10000)
    return () => clearInterval(interval)
  }, [])

  const handleLogout = async () => {
    await logout()
    setShowUserMenu(false)
    navigate('/')
  }

  const navItems = [
    { path: '/', label: 'Home', icon: Home },
    { path: '/control', label: 'Control', icon: LayoutDashboard },
    { path: '/deploy', label: 'Deploy', icon: Rocket },
    { path: '/feed', label: 'Feed', icon: MessageSquare },
    { path: '/alpha', label: 'Alpha', icon: TrendingUp },
    { path: '/settings', label: 'Settings', icon: Settings },
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

            {/* Right side - Status & User */}
            <div className="flex items-center gap-4">
              {/* Wallet Balance */}
              {walletBalance !== null && (
                <div className="text-sm text-gray-400">
                  <span className="text-accent-green font-medium">{walletBalance.toFixed(3)}</span> SOL
                </div>
              )}

              {/* Connection Status */}
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

              {/* User Menu */}
              {isLoading ? (
                <div className="w-8 h-8 rounded-full bg-dark-700 animate-pulse" />
              ) : isAuthenticated ? (
                <div className="relative">
                  <button
                    onClick={() => setShowUserMenu(!showUserMenu)}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-dark-700 transition-colors"
                  >
                    <div className="w-8 h-8 rounded-full bg-dark-600 flex items-center justify-center text-sm font-bold">
                      {user?.username.charAt(0).toUpperCase()}
                    </div>
                    <span className="text-sm hidden sm:block">{user?.username}</span>
                  </button>

                  {showUserMenu && (
                    <>
                      <div
                        className="fixed inset-0 z-10"
                        onClick={() => setShowUserMenu(false)}
                      />
                      <div className="absolute right-0 mt-2 w-48 bg-dark-700 rounded-lg shadow-lg border border-dark-600 py-1 z-20">
                        <Link
                          to="/settings"
                          onClick={() => setShowUserMenu(false)}
                          className="flex items-center gap-2 px-4 py-2 text-sm hover:bg-dark-600"
                        >
                          <Settings className="w-4 h-4" />
                          Settings
                        </Link>
                        <button
                          onClick={handleLogout}
                          className="flex items-center gap-2 px-4 py-2 text-sm hover:bg-dark-600 w-full text-left text-red-400"
                        >
                          <LogOut className="w-4 h-4" />
                          Sign Out
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ) : (
                <Link
                  to="/login"
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-dark-700 hover:bg-dark-600 text-sm transition-colors"
                >
                  <LogIn className="w-4 h-4" />
                  <span>Sign In</span>
                </Link>
              )}
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
