import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { UserPlus, Loader2, Zap, Check, X } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'

export default function RegisterPage() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const { register } = useAuth()
  const { addToast } = useToast()
  const navigate = useNavigate()

  const passwordRequirements = [
    { label: 'At least 8 characters', met: password.length >= 8 },
  ]

  const usernameRequirements = [
    { label: '3-30 characters', met: username.length >= 3 && username.length <= 30 },
    { label: 'Letters, numbers, underscores only', met: /^[a-zA-Z0-9_]*$/.test(username) },
  ]

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (username.length < 3) {
      addToast('error', 'Username must be at least 3 characters')
      return
    }

    if (password.length < 8) {
      addToast('error', 'Password must be at least 8 characters')
      return
    }

    if (password !== confirmPassword) {
      addToast('error', 'Passwords do not match')
      return
    }

    setIsLoading(true)
    const result = await register(username, password)
    setIsLoading(false)

    if (result.success) {
      addToast('success', 'Account created! Welcome to PumpLauncher')
      navigate('/')
    } else {
      addToast('error', result.error || 'Registration failed')
    }
  }

  return (
    <div className="min-h-screen bg-dark-900 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center gap-2 mb-4">
            <Zap className="w-10 h-10 text-accent-green" />
            <span className="text-2xl font-bold">PumpLauncher</span>
          </Link>
          <h1 className="text-2xl font-bold">Create Account</h1>
          <p className="text-gray-400 mt-2">Join PumpLauncher today</p>
        </div>

        <div className="bg-dark-800 rounded-xl border border-dark-600 p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm text-gray-400 mb-2">USERNAME</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value.slice(0, 30))}
                placeholder="Choose a username"
                className="w-full"
                autoComplete="username"
                autoFocus
              />
              {username && (
                <div className="mt-2 space-y-1">
                  {usernameRequirements.map((req, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs">
                      {req.met ? (
                        <Check className="w-3 h-3 text-green-400" />
                      ) : (
                        <X className="w-3 h-3 text-gray-500" />
                      )}
                      <span className={req.met ? 'text-green-400' : 'text-gray-500'}>
                        {req.label}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-2">PASSWORD</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Create a password"
                className="w-full"
                autoComplete="new-password"
              />
              {password && (
                <div className="mt-2 space-y-1">
                  {passwordRequirements.map((req, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs">
                      {req.met ? (
                        <Check className="w-3 h-3 text-green-400" />
                      ) : (
                        <X className="w-3 h-3 text-gray-500" />
                      )}
                      <span className={req.met ? 'text-green-400' : 'text-gray-500'}>
                        {req.label}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-2">CONFIRM PASSWORD</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm your password"
                className="w-full"
                autoComplete="new-password"
              />
              {confirmPassword && (
                <div className="flex items-center gap-2 text-xs mt-2">
                  {password === confirmPassword ? (
                    <>
                      <Check className="w-3 h-3 text-green-400" />
                      <span className="text-green-400">Passwords match</span>
                    </>
                  ) : (
                    <>
                      <X className="w-3 h-3 text-red-400" />
                      <span className="text-red-400">Passwords don't match</span>
                    </>
                  )}
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-accent-green text-dark-900 rounded-lg font-bold hover:bg-green-400 disabled:opacity-50 transition-colors"
            >
              {isLoading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  <UserPlus className="w-5 h-5" />
                  Create Account
                </>
              )}
            </button>
          </form>

          <div className="mt-6 text-center text-sm text-gray-400">
            Already have an account?{' '}
            <Link to="/login" className="text-accent-green hover:underline">
              Sign in
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
