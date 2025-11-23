import { Link } from 'react-router-dom'
import { Rocket, MessageSquare, Zap, Shield, Globe, TrendingUp } from 'lucide-react'

export default function HomePage() {
  const features = [
    {
      icon: Rocket,
      title: 'Instant Token Deploy',
      description: 'Deploy tokens to PumpFun with one click. Set name, symbol, image, and buy amount.',
    },
    {
      icon: MessageSquare,
      title: 'Live Twitter Feed',
      description: 'Monitor Twitter accounts in real-time. Discord/Telegram-style interface.',
    },
    {
      icon: Zap,
      title: 'Auto-Launch',
      description: 'Automatically launch tokens when monitored accounts tweet launch commands.',
    },
    {
      icon: Shield,
      title: 'Spam Filter',
      description: 'AI-powered classifier filters spam and risky tweets automatically.',
    },
    {
      icon: Globe,
      title: 'Multi-Platform',
      description: 'Support for PumpFun, with more platforms coming soon.',
    },
    {
      icon: TrendingUp,
      title: 'Real-Time Updates',
      description: 'SSE streaming for instant notifications on token launches and events.',
    },
  ]

  return (
    <div className="space-y-12">
      {/* Hero Section */}
      <section className="text-center py-16">
        <h1 className="text-5xl font-bold mb-4">
          Launch Tokens on{' '}
          <span className="text-accent-green">PumpFun</span>
        </h1>
        <p className="text-xl text-gray-400 mb-8 max-w-2xl mx-auto">
          The fastest way to deploy meme tokens. Monitor Twitter, auto-launch, and trade - all in one place.
        </p>
        <div className="flex items-center justify-center gap-4">
          <Link
            to="/deploy"
            className="flex items-center gap-2 bg-accent-green text-dark-900 px-8 py-4 rounded-xl font-bold text-lg hover:bg-green-400 transition-colors"
          >
            <Rocket className="w-5 h-5" />
            Deploy Token
          </Link>
          <Link
            to="/feed"
            className="flex items-center gap-2 bg-dark-700 text-white px-8 py-4 rounded-xl font-bold text-lg hover:bg-dark-600 transition-colors border border-dark-500"
          >
            <MessageSquare className="w-5 h-5" />
            View Feed
          </Link>
        </div>
      </section>

      {/* Features Grid */}
      <section>
        <h2 className="text-2xl font-bold text-center mb-8">Features</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature, index) => {
            const Icon = feature.icon
            return (
              <div
                key={index}
                className="bg-dark-800 rounded-xl p-6 border border-dark-600 hover:border-dark-500 transition-colors"
              >
                <div className="w-12 h-12 bg-dark-700 rounded-lg flex items-center justify-center mb-4">
                  <Icon className="w-6 h-6 text-accent-green" />
                </div>
                <h3 className="text-lg font-semibold mb-2">{feature.title}</h3>
                <p className="text-gray-400">{feature.description}</p>
              </div>
            )
          })}
        </div>
      </section>

      {/* Stats Section */}
      <section className="bg-dark-800 rounded-xl p-8 border border-dark-600">
        <h2 className="text-2xl font-bold text-center mb-8">Live Stats</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          <StatCard label="Tokens Launched" value="--" />
          <StatCard label="Tweets Processed" value="--" />
          <StatCard label="Active Connections" value="--" />
          <StatCard label="Success Rate" value="--%" />
        </div>
      </section>
    </div>
  )
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-center">
      <div className="text-3xl font-bold text-accent-green mb-1">{value}</div>
      <div className="text-gray-400 text-sm">{label}</div>
    </div>
  )
}
