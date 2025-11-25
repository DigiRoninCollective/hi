import { useState } from 'react'
import { ChevronDown, HelpCircle, Rocket, MessageSquare, Settings, Zap } from 'lucide-react'
import { useBackNavigation } from '../hooks/useNavigation'

interface FAQItem {
  category: string
  icon: React.ReactNode
  items: Array<{
    question: string
    answer: string
  }>
}

const faqData: FAQItem[] = [
  {
    category: 'Token Deployment',
    icon: <Rocket className="w-5 h-5 text-accent-green" />,
    items: [
      {
        question: 'What is multi-deploy?',
        answer:
          'Multi-deploy lets you create multiple tokens at once. LETTER creates 26 tokens (A-Z), ASCII creates 95 tokens (all printable characters), and Bundle creates 10 tokens in a batch.',
      },
      {
        question: 'What does the Search button do?',
        answer:
          'The Search button finds existing tokens and populates their details. Enter a token name and it will fetch and fill in name, symbol, description, website, and Twitter information.',
      },
      {
        question: 'What is Mayhem Mode?',
        answer:
          'Mayhem Mode enables aggressive settings for token deployment including higher priority fees, faster execution, and more aggressive transaction parameters.',
      },
      {
        question: 'How do I deploy a token?',
        answer:
          'Fill in token details (name, symbol, description), select a platform (PUMP, BONK, BNB, etc.), upload an image, then click Deploy. The token will be created on the selected platform.',
      },
      {
        question: 'What platforms can I deploy to?',
        answer:
          'PUMP (Pump.fun), BONK, BAGS, BNB, and USD1. Each platform has different parameters and deployment requirements.',
      },
    ],
  },
  {
    category: 'Feed & Monitoring',
    icon: <MessageSquare className="w-5 h-5 text-blue-400" />,
    items: [
      {
        question: 'What is the Live Feed?',
        answer:
          'The Live Feed shows real-time events: tweets, token launches, transactions, and system alerts. You can watch for opportunities and react instantly.',
      },
      {
        question: 'How do I watch Twitter accounts?',
        answer:
          'Add Twitter usernames in the "Watched Accounts" sidebar. The system will monitor their tweets and alert you to potential token launches.',
      },
      {
        question: 'What does the Ignore button do?',
        answer:
          'Clicking Ignore hides an event from your feed for the current session. Useful for clearing noise and focusing on important events.',
      },
      {
        question: 'What is Groq Analysis?',
        answer:
          'Groq Analysis uses AI to analyze tweets and suggest potential token opportunities. Click the 🤖 button on any tweet to get AI-powered insights.',
      },
      {
        question: 'How do filters work?',
        answer:
          'Filters let you show/hide different event types: Tweets, Launches, Alerts, and System events. Use the Filter button to toggle each type on or off.',
      },
    ],
  },
  {
    category: 'Trading & Actions',
    icon: <Zap className="w-5 h-5 text-yellow-400" />,
    items: [
      {
        question: 'What is Auto Deploy?',
        answer:
          'Auto Deploy automatically creates tokens based on detected launches. Requires S-tier (admin) role and configured keyword templates.',
      },
      {
        question: 'What is multi-wallet buying?',
        answer:
          'Multi-wallet buying distributes your purchase across multiple wallets to avoid detection and maximize buys. S-tier required. Configure in Launch Preferences.',
      },
      {
        question: 'What does Buy with X SOL do?',
        answer:
          'Instantly buys tokens on detected launches using your specified SOL amount. S-tier required. Configure the amount in Launch Preferences.',
      },
      {
        question: 'What is auto-sell?',
        answer:
          'Auto-sell automatically sells tokens across your wallet pool. Useful for profit-taking or cutting losses. S-tier required.',
      },
      {
        question: 'What are keyword templates?',
        answer:
          'Keyword templates are custom triggers for auto-deploy. When a tweet contains your keyword, it automatically deploys a token. Configure in Launch Preferences.',
      },
    ],
  },
  {
    category: 'Settings & Preferences',
    icon: <Settings className="w-5 h-5 text-purple-400" />,
    items: [
      {
        question: 'What is S-tier (admin)?',
        answer:
          'S-tier is the highest user role with access to multi-wallet operations, wallet pool generation, and advanced trading features.',
      },
      {
        question: 'How do I configure launch preferences?',
        answer:
          'Click "Preferences" on the feed. Configure initial buy amount, slippage, priority fees, multi-wallet settings, auto-deploy, and more.',
      },
      {
        question: 'What is the wallet pool?',
        answer:
          'The wallet pool is a set of unlinkable wallets generated server-side for multi-wallet operations. S-tier only. Generate new wallets in Launch Preferences.',
      },
      {
        question: 'What does auto top-up do?',
        answer:
          'Auto top-up automatically funds your wallets when they drop below minimum balance. Prevents failed transactions due to insufficient SOL.',
      },
      {
        question: 'What is priority fee?',
        answer:
          'Priority fee (in SOL) speeds up transaction processing on Solana. Higher fees = faster confirmation. Default is 0.0005 SOL.',
      },
    ],
  },
  {
    category: 'General',
    icon: <HelpCircle className="w-5 h-5 text-gray-400" />,
    items: [
      {
        question: 'What does the Swap button do?',
        answer: 'Navigates to the Feed page where you can monitor and execute token swaps based on live market data.',
      },
      {
        question: 'What does the Fund button do?',
        answer:
          'Opens Orca DEX (if wallet connected) to fund your account with SOL or other tokens. Essential for trading.',
      },
      {
        question: 'How do I connect my wallet?',
        answer:
          'Go to Settings to connect your Solana wallet. Once connected, you can execute trades, deployments, and other wallet-dependent actions.',
      },
      {
        question: 'What is demo mode?',
        answer:
          'Demo mode shows sample events and data without needing live connections. Great for testing features and understanding the UI.',
      },
    ],
  },
]

export default function HelpPage() {
  const { goBack } = useBackNavigation()
  const [expandedItems, setExpandedItems] = useState<Record<string, Set<number>>>({})

  const toggleItem = (category: string, index: number) => {
    setExpandedItems((prev) => {
      const categorySet = prev[category] || new Set()
      const newSet = new Set(categorySet)
      if (newSet.has(index)) {
        newSet.delete(index)
      } else {
        newSet.add(index)
      }
      return { ...prev, [category]: newSet }
    })
  }

  return (
    <div className="min-h-screen bg-dark-900 p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8 flex items-center gap-3">
          <button
            onClick={goBack}
            className="p-2 hover:bg-dark-700 rounded-lg transition-colors"
            title="Go back"
          >
            ← Back
          </button>
          <div>
            <h1 className="text-3xl font-bold text-white flex items-center gap-2">
              <HelpCircle className="w-8 h-8 text-accent-green" />
              Help & FAQ
            </h1>
            <p className="text-gray-400 mt-1">Everything you need to know about PumpLauncher</p>
          </div>
        </div>

        {/* FAQ Sections */}
        <div className="space-y-6">
          {faqData.map((section, sectionIdx) => (
            <div key={sectionIdx} className="bg-dark-800 rounded-xl border border-dark-600 overflow-hidden">
              {/* Section Header */}
              <div className="bg-dark-700 px-6 py-4 flex items-center gap-3">
                {section.icon}
                <h2 className="text-lg font-semibold text-white">{section.category}</h2>
              </div>

              {/* FAQ Items */}
              <div className="divide-y divide-dark-600">
                {section.items.map((item, itemIdx) => (
                  <div key={itemIdx} className="px-6 py-4">
                    <button
                      onClick={() => toggleItem(section.category, itemIdx)}
                      className="w-full flex items-start justify-between gap-4 hover:text-accent-green transition-colors text-left"
                    >
                      <span className="font-medium text-gray-200">{item.question}</span>
                      <ChevronDown
                        className={`w-5 h-5 flex-shrink-0 transition-transform ${
                          expandedItems[section.category]?.has(itemIdx) ? 'rotate-180' : ''
                        }`}
                      />
                    </button>

                    {expandedItems[section.category]?.has(itemIdx) && (
                      <p className="mt-3 text-sm text-gray-400 leading-relaxed">{item.answer}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Quick Tips */}
        <div className="mt-8 bg-accent-green/10 border border-accent-green/30 rounded-xl p-6">
          <h3 className="font-semibold text-accent-green mb-3 flex items-center gap-2">
            <Zap className="w-5 h-5" />
            Quick Tips
          </h3>
          <ul className="space-y-2 text-sm text-gray-300">
            <li>💡 Hover over help icons (?) for quick tooltips on features</li>
            <li>⚙️ Configure all your preferences before deploying or trading</li>
            <li>🔔 Enable notifications to get alerts for important events</li>
            <li>🔑 Always ensure your wallet is connected before trading</li>
            <li>📊 Use demo mode to test features before going live</li>
            <li>⚡ Multi-wallet operations require S-tier (admin) access</li>
          </ul>
        </div>
      </div>
    </div>
  )
}
