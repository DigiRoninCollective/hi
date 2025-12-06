# PumpFun Twitter Launcher

A powerful, automated token launcher for PumpFun that monitors Twitter/X for launch signals and creates tokens with AI-powered intelligence.

**Live token deployment** • **Multi-source alpha signals** • **Local transaction signing** • **Web UI & CLI**

---

## 🚀 Quick Start

### Prerequisites
- **Node.js 18+** - [Download](https://nodejs.org/)
- **Environment files** - Copy `.env.example` to `.env` and fill in your keys

### Start the App (3 seconds)

**macOS/Linux:**
```bash
./start.sh
```

**Windows:**
```bash
start.bat
```

**Or via npm:**
```bash
npm run startup
```

Then open: **http://localhost:5173**

---

## 📋 What You Get

### Features
- ✅ **Twitter Monitoring** - Watch tweets for token launch signals
- ✅ **AI Intelligence** - Groq LLM analyzes tweets and suggests token names
- ✅ **Multi-Source Alpha** - Aggregate signals from Discord, Telegram, Reddit
- ✅ **Web UI** - Beautiful dashboard for token deployment
- ✅ **Local Signing** - Sign transactions in your browser with private key
- ✅ **Auto Trading** - Dev buy, slippage control, MEV protection (Jito)
- ✅ **Real-Time Updates** - WebSocket SSE for live feeds
- ✅ **Desktop App** - Electron wrapper for native experience

### Supported Platforms
- 🌐 **Web** - Browser-based UI
- 🖥️ **Desktop** - Native Electron app (Windows, macOS, Linux)
- ⌨️ **CLI** - Command-line interface

---

## 🎯 Use Cases

### 1. **Deploy Tokens (Web UI)**
Navigate to `/deploy` or `/create-local`:
- Fill in token details (name, symbol, image)
- Connect your wallet or use private key
- Deploy directly to PumpFun

### 2. **Monitor Twitter**
Navigate to `/feed`:
- See live Twitter feed
- AI analyzes tweets
- Click to deploy suggested tokens

### 3. **Multi-Source Signals**
Navigate to `/alpha`:
- Aggregate Discord, Telegram, Reddit signals
- Risk classification
- Trusted channel filtering

---

## 📦 Setup Guide

### 1. Clone & Install
```bash
git clone https://github.com/DigiRoninCollective/hi.git
cd hi
npm install
cd web && npm install && cd ..
```

### 2. Environment Variables

**Create `.env` file:**
```bash
cp .env.example .env
```

**Required variables:**
```env
# Solana
SOLANA_RPC_URL=https://mainnet.helius-rpc.com/?api-key=YOUR_KEY
SOLANA_PRIVATE_KEY=your_base58_private_key

# PumpPortal (API keys you have)
PUMPPORTAL_API_KEY=your_api_key
PUMPPORTAL_WALLET_PUBLIC_KEY=your_public_key
PUMPPORTAL_WALLET_PRIVATE_KEY=your_private_key

# Database (Supabase)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your_anon_key

# AI/LLM (Groq)
GROQ_API_KEY=gsk_...
GROQ_ENABLED=true

# Social (Optional)
TWITTER_ENABLED=false  # Enable when you have API access
TWITTER_BEARER_TOKEN=your_token
```

See `.env.example` for all options.

### 3. Copy to Web
```bash
cp .env web/.env
```

### 4. Run It
```bash
./start.sh    # Unix/macOS
start.bat     # Windows
npm run startup  # Any platform
```

---

## 🎮 Navigation

### Main Pages

| Page | Purpose | Route |
|------|---------|-------|
| **Home** | Dashboard & wallet connection | `/` |
| **Deploy** | Create tokens (simple form) | `/deploy` |
| **Create (Local)** | Create with private key signing | `/create-local` |
| **Feed** | Live Twitter feed with AI | `/feed` |
| **Alpha** | Multi-source signals | `/alpha` |
| **Control** | Advanced controls | `/control` |
| **Settings** | User preferences & config | `/settings` |
| **Portfolio** | View your tokens | `/portfolio` |
| **Help** | Feature documentation | `/help` |

---

## 🔧 Architecture

```
PumpFun Twitter Launcher
├── Backend (Node.js + Express)
│   ├── Twitter monitoring
│   ├── Signal classification
│   ├── Token creation
│   └── Transaction signing
│
├── Frontend (React + Vite)
│   ├── Web UI
│   ├── Wallet connection
│   ├── Token forms
│   └── Live feeds
│
└── Desktop (Electron)
    └── Native app wrapper
```

### Tech Stack
- **Backend:** Node.js, Express, TypeScript
- **Frontend:** React, TypeScript, Tailwind CSS, Vite
- **Database:** Supabase (PostgreSQL)
- **Blockchain:** Solana Web3.js, PumpPortal API
- **AI:** Groq LLM
- **Desktop:** Electron
- **Build:** TypeScript, concurrently

---

## 📁 Project Structure

```
/
├── README.md                 # This file
├── package.json             # Root dependencies
├── tsconfig.json            # TypeScript config
├── start.sh / start.bat      # Quick startup scripts
├── .env                      # Configuration (gitignored)
├── .env.example              # Configuration template
│
├── src/                      # Backend (Node.js)
│   ├── index.ts             # Main bot entry
│   ├── cli.ts               # CLI tool
│   ├── api-routes.ts        # API endpoints
│   ├── services/            # Business logic
│   ├── utils/               # Utilities
│   ├── trades/              # Trading scripts
│   └── ...
│
├── web/                      # Frontend (React)
│   ├── src/
│   │   ├── pages/           # Page components
│   │   ├── components/      # Reusable components
│   │   ├── context/         # Context providers
│   │   └── hooks/           # Custom hooks
│   ├── package.json         # Frontend deps
│   └── .env                 # Frontend config
│
├── desktop/                  # Electron app
│   └── main.js              # Electron entry
│
├── docs/                     # Documentation
│   ├── STARTUP.md           # Detailed startup guide
│   ├── QUICK_START.md       # Quick reference
│   ├── PROJECT_STATUS.md    # Current status
│   └── ...
│
└── scripts/                  # Utility scripts
    ├── start.ts             # Setup script
    ├── groq-*.mjs           # LLM helpers
    └── test-groq.mjs        # Testing
```

---

## 🚀 Common Commands

### Development
```bash
npm run dev              # Run backend
npm run dev:web          # Run frontend
npm run startup          # Run both
npm run build            # Compile TypeScript
npm run watch            # Watch mode
```

### Deployment
```bash
npm run build:all        # Build everything
npm run start:prod       # Run production backend
npm run desktop          # Build desktop app
npm run desktop:pack     # Package for distribution
```

### Tools
```bash
npm run cli              # CLI interface
npm run bot              # Run bot
npm run wallet:new       # Generate wallet
npm run wallet:vanity    # Vanity wallet generator
npm run create:wizard    # Token creation wizard
```

---

## 📚 Documentation

Detailed guides available in `/docs`:

- **[STARTUP.md](docs/STARTUP.md)** - Complete startup and troubleshooting
- **[QUICK_START.md](docs/QUICK_START.md)** - Quick reference guide
- **[PROJECT_STATUS.md](docs/PROJECT_STATUS.md)** - Current features and status
- **[RESEARCH_SUMMARY.txt](docs/RESEARCH_SUMMARY.txt)** - Technical research notes

---

## 🔐 Security

### Best Practices
- ✅ Never commit `.env` files (gitignored)
- ✅ Use strong RPC endpoints (Helius, QuickNode, not public)
- ✅ Keep private keys secure and rotate regularly
- ✅ Use dedicated wallets for testing
- ✅ Enable 2FA on API accounts

### Important Notes
- Private keys are used **only for signing** transactions
- Keys are **never sent to our servers**
- Transaction signing happens **in your browser**
- Clear your browser cache after use

---

## 🐛 Troubleshooting

### "Port already in use"
```bash
# Kill processes on ports 3000 and 5173
lsof -ti:3000,5173 | xargs kill -9
```

### "Module not found"
```bash
rm -rf node_modules web/node_modules
npm install && cd web && npm install && cd ..
```

### "Build errors"
```bash
npm run build  # Check for TypeScript errors
```

### "Frontend won't load"
```bash
cd web
npm install
npm run dev
```

See [STARTUP.md](docs/STARTUP.md) for more troubleshooting.

---

## 📊 API Endpoints

```
GET  /api/status              # Health check
GET  /api/tokens              # List tokens
POST /api/tokens/create       # Create token
POST /api/tokens/create-local # Create with local signing
GET  /api/feed                # Twitter feed
POST /api/groq/suggest        # AI suggestions
GET  /api/wallet              # Wallet info
```

---

## 🤝 Contributing

This is a specialized tool for token launching. Contributions welcome!

Areas for improvement:
- Additional blockchain support
- More signal sources
- Enhanced UI/UX
- Performance optimizations
- Better error handling

---

## 📄 License

MIT License - See repo for details

---

## 🆘 Support

### Getting Help
1. Check [STARTUP.md](docs/STARTUP.md) for common issues
2. Review [PROJECT_STATUS.md](docs/PROJECT_STATUS.md) for current features
3. Check browser console (F12) for frontend errors
4. Review terminal output for backend errors

### Reporting Issues
Create an issue with:
- Error message
- Steps to reproduce
- Environment details
- Screenshots (if applicable)

---

## 🎯 Next Steps

1. **Setup** - Follow the Quick Start above
2. **Configure** - Fill in your `.env` variables
3. **Test** - Create a test token on devnet first
4. **Deploy** - Launch tokens to mainnet
5. **Monitor** - Watch your tokens on PumpFun/Solscan

---

## 📞 Contact

- **GitHub:** [DigiRoninCollective/hi](https://github.com/DigiRoninCollective/hi)
- **Issues:** [Report bugs](https://github.com/DigiRoninCollective/hi/issues)
- **Discussions:** [Ask questions](https://github.com/DigiRoninCollective/hi/discussions)

---

**Built with ❤️ for the Solana community**

*Last updated: November 27, 2025*
