import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react'

interface User {
  id: string
  username: string
  role: 'user' | 'admin' | 'moderator'
}

interface UserSettings {
  theme: 'dark' | 'light' | 'system'
  image_layout: 'grid' | 'list' | 'compact'
  card_width: number
  notifications_enabled: boolean
  sound_enabled: boolean
  auto_deploy_enabled: boolean
  default_buy_amount: number
  default_platform: string
  solana_network?: 'mainnet-beta' | 'devnet' | 'testnet'
  custom_rpc_url?: string
  use_custom_rpc?: boolean
}

interface AuthContextType {
  user: User | null
  settings: UserSettings | null
  isLoading: boolean
  isAuthenticated: boolean
  login: (username: string, password: string) => Promise<{ success: boolean; error?: string }>
  register: (username: string, password: string) => Promise<{ success: boolean; error?: string }>
  logout: () => Promise<void>
  updateSettings: (settings: Partial<UserSettings>) => Promise<boolean>
  refreshUser: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [settings, setSettings] = useState<UserSettings | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const refreshUser = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/me', { credentials: 'include' })
      if (res.ok) {
        const data = await res.json()
        setUser(data.user)

        // Also fetch settings
        const settingsRes = await fetch('/api/auth/settings', { credentials: 'include' })
        if (settingsRes.ok) {
          const settingsData = await settingsRes.json()
          setSettings(settingsData.settings)
        }
      } else {
        setUser(null)
        setSettings(null)
      }
    } catch {
      setUser(null)
      setSettings(null)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    refreshUser()
  }, [refreshUser])

  const login = async (username: string, password: string) => {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ username, password }),
      })
      const data = await res.json()

      if (res.ok && data.success) {
        setUser(data.user)
        await refreshUser() // Fetch settings too
        return { success: true }
      }
      return { success: false, error: data.error || 'Login failed' }
    } catch {
      return { success: false, error: 'Network error' }
    }
  }

  const register = async (username: string, password: string) => {
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ username, password }),
      })
      const data = await res.json()

      if (res.ok && data.success) {
        // Auto-login after registration
        return login(username, password)
      }
      return { success: false, error: data.error || 'Registration failed' }
    } catch {
      return { success: false, error: 'Network error' }
    }
  }

  const logout = async () => {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include',
      })
    } finally {
      setUser(null)
      setSettings(null)
    }
  }

  const updateSettings = async (newSettings: Partial<UserSettings>) => {
    try {
      const res = await fetch('/api/auth/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(newSettings),
      })

      if (res.ok) {
        setSettings(prev => prev ? { ...prev, ...newSettings } : null)
        return true
      }
      return false
    } catch {
      return false
    }
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        settings,
        isLoading,
        isAuthenticated: !!user,
        login,
        register,
        logout,
        updateSettings,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
