# Complete API & Service Requirements Guide

All APIs, credentials, and third-party services needed to get the entire PumpLauncher project running end-to-end.

---

## 🚀 Quick Overview

The project uses **13 external services** across 5 main categories:
1. **Blockchain & Trading** (5 services)
2. **Social Media & Monitoring** (4 services)
3. **AI & Intelligence** (1 service)
4. **Infrastructure & Database** (2 services)
5. **Optional Advanced Features** (3 services)

---

## 📋 Critical Services (Must-Have)

### 1. **Supabase** (Database & Auth)
**What it does:** Stores all user data, tokens, transactions, preferences, and handles authentication.

**Get it:**
- Go to: https://supabase.com
- Click "Start your project"
- Create new project
- Copy these keys from project settings:

```env
SUPABASE_URL=<your_supabase_url_from_dashboard>
SUPABASE_ANON_KEY=<your_anon_key_from_dashboard>
SUPABASE_SERVICE_ROLE_KEY=<your_service_role_key_from_dashboard>
```

**Used by:**
- User authentication
- Token history storage
- Wallet management
- Preferences & settings
- Transaction logs

**Status:** ✅ Already configured in your project

---

### 2. **Solana RPC Provider** (Blockchain Connection)
**What it does:** Connects to Solana blockchain for reading balances, checking transactions, and confirming deployments.

**Options (ranked by quality):**

| Provider | Cost | Speed | Features |
|----------|------|-------|----------|
| **Helius** | Free tier available | ⭐⭐⭐⭐⭐ | Best for Solana, priority fees |
| **QuickNode** | Paid | ⭐⭐⭐⭐ | Reliable, webhooks |
| **Triton** | Paid | ⭐⭐⭐⭐ | Fast, good for trading |
| **Public RPC** | Free | ⭐⭐ | Rate-limited, slow |

**Recommended: Helius**

```bash
# Get free key at: https://www.helius.dev
# Sign up → Create app → Copy API key
```

```env
# Helius (Recommended)
SOLANA_RPC_URL=<your_helius_rpc_url_with_api_key>
SOLANA_WS_URL=<your_helius_wss_url_with_api_key>

# Or use public (NOT recommended for production)
SOLANA_RPC_URL=https://api.mainnet-beta.solana.com
SOLANA_WS_URL=wss://api.mainnet-beta.solana.com
```

**Used by:**
- Checking wallet balances
- Confirming token deployments
- Real-time blockchain updates
- Transaction verification

**Status:** ⚠️ Currently using public RPC (should upgrade for production)

---

### 3. **Solana Wallet** (Private Key)
**What it does:** Your wallet account on Solana. Used for deploying tokens and executing transactions.

**Get it:**
```bash
# Generate new wallet
npm run wallet:new

# Or use existing wallet (export from Phantom, etc.)
# Private key format: Base58 encoded
```

```env
SOLANA_PRIVATE_KEY=<your_base58_encoded_private_key>
```

**Requirements:**
- Fund wallet with SOL (≥0.5 SOL minimum for testing)
- Keep private key safe
- Never share with anyone

**Status:** ✅ You'll generate this when setting up

---

### 4. **Twitter API v2** (Tweet Monitoring)
**What it does:** Streams tweets from accounts you follow and detects token launches.

**Get it:**
1. Go to: https://developer.twitter.com
2. Apply for developer access (24-48 hour approval)
3. Create new project
4. Generate API keys from project settings

```env
TWITTER_ENABLED=true
TWITTER_API_KEY=<your_api_key_from_twitter_dev>
TWITTER_API_SECRET=<your_api_secret_from_twitter_dev>
TWITTER_ACCESS_TOKEN=<your_access_token_from_twitter_dev>
TWITTER_ACCESS_SECRET=<your_access_secret_from_twitter_dev>
TWITTER_BEARER_TOKEN=<your_bearer_token_from_twitter_dev>

# Twitter Monitoring (comma-separated, no @ symbols)
TWITTER_USERNAMES=elonmusk,vitalikbuterin
TWITTER_HASHTAGS=LAUNCH,PUMPFUN
```

**Used by:**
- Real-time tweet streaming
- Detecting token launches
- Groq AI analysis on tweets
- Account monitoring

**Status:** ⚠️ Needs Twitter API approval (takes 24-48 hours)

---

### 5. **Pump.fun** (Token Deployment)
**What it does:** The blockchain platform where you deploy and trade tokens.

**Setup:**
- No API key needed
- Uses Solana wallet you create above
- PumpFun SDK already integrated

```env
PUMPFUN_SDK_ENABLED=true
PUMPFUN_DEFAULT_SLIPPAGE_BPS=1000  # 10% slippage
PUMPFUN_PRIORITY_FEE=250000        # Fee in microlamports
```

**Used by:**
- Token creation/deployment
- Token trading
- Real-time data

**Status:** ✅ Already integrated in code

---

## 🤖 AI & Intelligence Services

### 6. **Groq API** (AI Suggestions)
**What it does:** Analyzes tweets and suggests ticker names and descriptions for tokens using AI.

**Get it:**
1. Go to: https://console.groq.com/keys
2. Sign up with Google/GitHub
3. Create API key
4. Copy key to .env

```env
GROQ_ENABLED=true
GROQ_API_KEY=<your_groq_api_key>
GROQ_MODEL=llama-3.3-70b
GROQ_SECONDARY_MODEL=mixtral-8x7b-32768
GROQ_SUGGESTION_COUNT=2
GROQ_AUTO_DEPLOY=true
GROQ_TEMPERATURE=0.2
GROQ_MAX_TOKENS=256
```

**Free Tier:**
- 9,000 API calls/day
- Unlimited concurrent requests
- No credit card needed

**Used by:**
- Analyzing tweets for token info
- Suggesting ticker names
- Generating descriptions
- AI-powered automation

**Status:** ✅ Already configured

---

## 📡 Optional: Social Monitoring (Alpha Aggregator)

These are optional but enable multi-source signal aggregation from Discord, Telegram, and Reddit.

### 7. **Discord Bot** (Optional)
**What it does:** Monitor Discord channels for token launch signals.

**Get it:**
1. Go to: https://discord.com/developers/applications
2. Click "New Application"
3. Go to "Bot" tab, click "Add Bot"
4. Copy token under "TOKEN" section

```env
ALPHA_DISCORD_ENABLED=false
ALPHA_DISCORD_BOT_TOKEN=<your_discord_bot_token>
ALPHA_DISCORD_CHANNELS=<channel_ids_comma_separated>
```

**Used by:**
- Monitoring Discord channels
- Collecting signals from multiple servers
- Alpha aggregation

**Status:** ❌ Optional (disabled by default)

---

### 8. **Telegram Bot** (For Notifications!)
**What it does:** Telegram bot that notifies you of events and lets you control the system via Telegram.

**Get it:**
1. Open Telegram
2. Chat with **@BotFather**
3. Send: `/newbot`
4. Follow prompts:
   - Name: `PumpLauncher Bot`
   - Username: `YourUsername_PumpLauncherBot`
5. Copy the token (long string with numbers and colon)

```env
TELEGRAM_BOT_TOKEN=<your_bot_token_from_botfather>
TELEGRAM_CHAT_ID=<your_chat_id_from_getUpdates>

# Alert system
ALERTING_ENABLED=true
ALERT_CONSOLE_OUTPUT=true

# Alpha Telegram (optional - for signal aggregation)
ALPHA_TELEGRAM_ENABLED=false
ALPHA_TELEGRAM_BOT_TOKEN=<token_or_same_as_above>
ALPHA_TELEGRAM_CHATS=<chat_ids_comma_separated>
ALPHA_TELEGRAM_POLLING=true
ALPHA_TELEGRAM_BOT_NAME=Alpha Signal Bot
ALPHA_TELEGRAM_BOT_DESCRIPTION=Multi-source crypto alpha aggregator
```

**Get your Chat ID:**
1. Send any message to your bot
2. Go to: https://api.telegram.org/bot{YOUR_TOKEN}/getUpdates
3. Replace {YOUR_TOKEN} with your actual token
4. Copy the `chat.id` from response

**Used by:**
- Sending alerts when tokens launch
- Receiving notifications
- Future: Control bot via Telegram commands

**Status:** ⚠️ Bot token and chat ID needed

---

### 9. **Reddit API** (Optional)
**What it does:** Monitor Reddit communities for token launch signals.

**Get it:**
1. Go to: https://reddit.com/prefs/apps
2. Create "personal use script" app
3. Copy credentials

```env
ALPHA_REDDIT_ENABLED=false
ALPHA_REDDIT_CLIENT_ID=<your_reddit_client_id>
ALPHA_REDDIT_CLIENT_SECRET=<your_reddit_client_secret>
ALPHA_REDDIT_USERNAME=<your_reddit_username>
ALPHA_REDDIT_PASSWORD=<your_reddit_password>
ALPHA_REDDIT_USER_AGENT=AlphaAggregator/1.0.0
ALPHA_REDDIT_SUBREDDITS=CryptoMoonShots,SatoshiStreetBets
ALPHA_REDDIT_POLL_INTERVAL=30000
```

**Status:** ❌ Optional (disabled by default)

---

## ⚡ Advanced Features (Optional)

### 10. **Jito Bundler** (MEV Protection)
**What it does:** Bundles transactions to protect against MEV (Maximal Extractable Value) attacks.

**Get it:**
- No API key needed for basic usage
- Go to: https://jito.wtf for private bundles

```env
BUNDLER_ENABLED=false
JITO_ENABLED=false
JITO_TIP_LAMPORTS=10000
JITO_TIP_SOL=0.00001
JITO_BLOCK_ENGINE_URL=https://mainnet.block-engine.jito.wtf
```

**Status:** ❌ Optional (disabled by default)

---

### 11. **Raydium** (Token Graduation)
**What it does:** Handles token graduation from Pump.fun to Raydium DEX.

```env
RAYDIUM_ENABLED=false
RAYDIUM_AUTO_LP=false
RAYDIUM_LP_SOL_AMOUNT=1.0
```

**Status:** ❌ Optional (disabled by default)

---

### 12. **Webhooks & Custom Integrations**

Optional webhooks for external integrations:

```env
# Custom webhook
ALERT_WEBHOOK_URL=<your_webhook_endpoint>

# Discord webhook (for alerts)
DISCORD_WEBHOOK_URL=<your_discord_webhook_url>

# Telegram already configured above
```

**Status:** ❌ Optional

---

## 🗄️ Database Tables (Auto-created)

Once Supabase is connected, these tables are created:

| Table | Purpose |
|-------|---------|
| `users` | User accounts and authentication |
| `wallets` | User wallet addresses |
| `tokens` | Token deployment history |
| `transactions` | Buy/sell transaction logs |
| `watched_accounts` | Twitter accounts to monitor |
| `user_preferences` | User settings (buy amount, slippage, etc.) |
| `alerts` | Alert history |
| `groq_analysis_cache` | Cached Groq suggestions |
| `wallet_pool` | Multi-wallet management (S-tier) |

---

## 🔑 Complete .env Setup Guide

### Step 1: Copy Template
```bash
cp .env.backup .env
```

### Step 2: Fill in Critical Variables

```env
# ========== CRITICAL (DO FIRST) ==========

# Supabase (from supabase.com)
SUPABASE_URL=<your_supabase_url>
SUPABASE_ANON_KEY=<your_anon_key>
SUPABASE_SERVICE_ROLE_KEY=<your_service_role_key>

# Solana (generate with: npm run wallet:new)
SOLANA_PRIVATE_KEY=<your_base58_private_key>
SOLANA_RPC_URL=<your_helius_rpc_url>
SOLANA_WS_URL=<your_helius_wss_url>

# Twitter (from developer.twitter.com)
TWITTER_ENABLED=true
TWITTER_API_KEY=<your_key>
TWITTER_API_SECRET=<your_secret>
TWITTER_BEARER_TOKEN=<your_bearer_token>
TWITTER_ACCESS_TOKEN=<your_token>
TWITTER_ACCESS_SECRET=<your_secret>

# Groq AI (from console.groq.com)
GROQ_ENABLED=true
GROQ_API_KEY=<your_groq_key>

# ========== TELEGRAM (SETUP NEXT) ==========

TELEGRAM_BOT_TOKEN=<your_bot_token>
TELEGRAM_CHAT_ID=<your_chat_id>
ALERTING_ENABLED=true

# ========== OPTIONAL (CAN SKIP) ==========

ALPHA_DISCORD_ENABLED=false
ALPHA_REDDIT_ENABLED=false
BUNDLER_ENABLED=false
JITO_ENABLED=false
RAYDIUM_ENABLED=false
```

### Step 3: Verify
```bash
# Check critical variables are set (not empty)
grep -E "SUPABASE_URL|SOLANA_PRIVATE_KEY|GROQ_API_KEY" .env | grep -v "^#"
```

---

## 🧪 Testing Each Service

### Test Supabase Connection
```bash
curl https://your-project.supabase.co/rest/v1/users
```

### Test Solana RPC
```bash
curl -X POST <your_rpc_url> \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"getBalance","params":["<your_wallet_address>"]}'
```

### Test Twitter API
```bash
grep TWITTER_BEARER_TOKEN .env
# Should show your token (not empty)
```

### Test Groq API
```bash
curl -X POST https://api.groq.com/openai/v1/chat/completions \
  -H "Authorization: Bearer <your_key>" \
  -H "Content-Type: application/json" \
  -d '{"model":"llama-3.3-70b","messages":[{"role":"user","content":"test"}]}'
```

### Test Telegram Bot
```bash
# Send message to bot in Telegram
# Should receive confirmation
```

---

## 🚀 Complete Startup Checklist

```markdown
## Before Running the Project

- [ ] **Supabase Project Created**
  - [ ] URL copied to .env
  - [ ] Anon key copied
  - [ ] Service role key copied
  - [ ] Migrations applied (run: npm run db:push)

- [ ] **Solana Setup**
  - [ ] Wallet generated or imported (npm run wallet:new)
  - [ ] Private key in .env
  - [ ] Wallet has ≥0.5 SOL for testing
  - [ ] RPC URL set (Helius recommended)

- [ ] **Twitter API (Optional but Recommended)**
  - [ ] Developer account approved
  - [ ] API keys generated
  - [ ] All 5 credentials in .env
  - [ ] TWITTER_ENABLED=true

- [ ] **Groq AI**
  - [ ] Console account created
  - [ ] API key generated
  - [ ] Key in .env
  - [ ] GROQ_ENABLED=true

- [ ] **Telegram Bot (Optional)**
  - [ ] Bot created with @BotFather
  - [ ] Token in .env
  - [ ] Chat ID obtained
  - [ ] ALERTING_ENABLED=true

- [ ] **Environment Variables**
  - [ ] .env file exists
  - [ ] All critical variables filled
  - [ ] No empty values for required keys
  - [ ] Verified with grep command above

## Starting the System

### Terminal 1: Backend
```bash
npm install
npm run build
npm start
```
Expected: "SSE server initialized on port 3000"

### Terminal 2: Frontend
```bash
cd web
npm install
npm run dev
```
Expected: "Local: http://localhost:5173"

### Terminal 3: Monitor (Optional)
```bash
npm start | grep -i "groq\|telegram\|twitter"
```

## Verification

- [ ] Backend starts without errors
- [ ] Frontend loads at http://localhost:5173
- [ ] Can see demo tweets (no API needed)
- [ ] Groq Analysis button works
- [ ] Can deploy test token
- [ ] Telegram alerts working (if enabled)
```

---

## 💰 Cost Breakdown (Monthly)

| Service | Cost | Notes |
|---------|------|-------|
| **Supabase** | $0-25 | Free tier covers most use cases |
| **Solana RPC (Helius)** | $0-50 | Free tier + paid as you scale |
| **Twitter API** | $100-200 | Essential tier minimum |
| **Groq AI** | $0 | Free: 9,000 calls/day |
| **Telegram Bot** | $0 | Completely free |
| **Discord Bot** | $0 | Completely free |
| **Reddit API** | $0 | Completely free |
| **Jito (Optional)** | $0-20 | Only if bundling enabled |
| **Raydium (Optional)** | SOL fees only | Only if liquidity added |
| **PumpFun** | SOL fees only | Transaction fees |
| **Total Minimum** | ~$100/month | Just Twitter API |
| **Recommended Setup** | ~$150-250/month | Full production ready |

---

## 🔄 API Service Dependency Chain

```
User → Frontend
   ↓
Backend Server
   ├─ Supabase (Database)
   │  ├─ User data
   │  └─ Token history
   │
   ├─ Twitter API
   │  └─ Tweet stream
   │
   ├─ Solana RPC
   │  ├─ Balance checks
   │  └─ Transaction confirmation
   │
   ├─ Groq API
   │  └─ AI analysis
   │
   ├─ Pump.fun SDK
   │  └─ Token deployment
   │
   ├─ Telegram Bot
   │  └─ Notifications
   │
   ├─ Discord Bot (optional)
   │  └─ Channel monitoring
   │
   └─ Reddit API (optional)
      └─ Signal aggregation

External:
   ├─ Jito (optional - MEV protection)
   └─ Raydium (optional - token graduation)
```

---

## 📚 Quick Reference

### Environment Variable Categories

**Critical (Can't Run Without):**
- SUPABASE_* - Database
- SOLANA_* - Blockchain
- GROQ_API_KEY - AI

**Important (Features Limited Without):**
- TWITTER_* - Tweet monitoring

**Optional (Nice to Have):**
- TELEGRAM_* - Notifications
- ALPHA_* - Alpha aggregation
- JITO_* - MEV protection
- RAYDIUM_* - Token graduation

### Quick Setup Priority Order

1. **First:** Supabase (database)
2. **Second:** Solana RPC + Wallet
3. **Third:** Groq (AI)
4. **Fourth:** Twitter API (if you want tweet monitoring)
5. **Fifth:** Telegram Bot (if you want notifications)
6. **Sixth+:** Everything else (optional)

---

## ✅ Final Checklist

- [ ] All critical .env variables set
- [ ] Supabase migrations applied
- [ ] Wallet funded with SOL
- [ ] Groq API key working
- [ ] Backend starts without errors
- [ ] Frontend loads
- [ ] Can see demo tweets
- [ ] Ready to deploy! 🎉

---

**For detailed Telegram setup:** See TELEGRAM_BOT_SETUP.md

**Questions?** Check the specific service documentation or your IDE's help system.
