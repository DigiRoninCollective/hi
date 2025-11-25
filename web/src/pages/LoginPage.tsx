import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { LogIn, Loader2, Zap, ArrowLeft } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { useBackNavigation } from '../hooks/useNavigation'

export default function LoginPage() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const { login } = useAuth()
  const { addToast } = useToast()
  const navigate = useNavigate()
  const { goBack } = useBackNavigation()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!username || !password) {
      addToast('error', 'Please enter username and password')
      return
    }

    setIsLoading(true)
    const result = await login(username, password)
    setIsLoading(false)

    if (result.success) {
      addToast('success', 'Welcome back!')
      navigate('/')
    } else {
      addToast('error', result.error || 'Login failed')
    }
  }

  return (
    <div className="min-h-screen bg-dark-900 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        {/* Back Button */}
        <div className="mb-6">
          <button
            onClick={goBack}
            className="p-2 hover:bg-dark-700 rounded-lg transition-colors inline-flex items-center gap-2"
            title="Go back"
          >
            <ArrowLeft className="w-5 h-5 text-gray-400 hover:text-white" />
            <span className="text-sm text-gray-400">Back</span>
          </button>
        </div>

        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center gap-2 mb-4">
            <Zap className="w-10 h-10 text-accent-green" />
            <span className="text-2xl font-bold">PumpLauncher</span>
          </Link>
          <h1 className="text-2xl font-bold">Welcome Back</h1>
          <p className="text-gray-400 mt-2">Sign in to continue</p>
        </div>

        <div className="bg-dark-800 rounded-xl border border-dark-600 p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm text-gray-400 mb-2">USERNAME</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter username"
                className="w-full"
                autoComplete="username"
                autoFocus
              />
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-2">PASSWORD</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                className="w-full"
                autoComplete="current-password"
              />
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
                  <LogIn className="w-5 h-5" />
                  Sign In
                </>
              )}
            </button>
          </form>

          <div className="mt-6 text-center text-sm text-gray-400">
            Don't have an account?{' '}
            <Link to="/register" className="text-accent-green hover:underline">
              Create one
            </Link>
          </div>
        </div>

        <p className="text-center text-gray-500 text-sm mt-6">
          You can also use the app without an account
          <br />
          <Link to="/" className="text-gray-400 hover:text-white">
            Continue as guest
          </Link>
        </p>
      </div>
    </div>
  )
}
