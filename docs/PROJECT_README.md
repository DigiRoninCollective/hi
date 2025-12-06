# PumpFun Twitter Launcher

A TypeScript/Node.js service that monitors Twitter for token launch commands and automatically creates tokens on PumpFun via PumpPortal. Now includes a full **Web UI** for manual token deployment and real-time feed monitoring (Discord/Telegram style).

## Features

- **Web UI**: Dark-themed token deployment interface with real-time feed
- **Manual Token Deploy**: Deploy tokens directly from the browser
- **Twitter Feed**: Discord/Telegram-style live feed of tweets and events
- **Twitter Stream Monitoring**: Real-time monitoring of tweets from specific users or hashtags via Twitter API v2
- **Tweet Classification**: ML-inspired classifier with confidence scoring, spam detection, and risk assessment
- **Launch Command Parsing**: Detects patterns like `$LAUNCH DOGE2` or `#LAUNCH PEPE`
- **Automatic Token Creation**: Creates tokens on PumpFun via PumpPortal's API
- **Transaction Signing**: Signs and sends Solana transactions using your bot wallet
- **SSE Event Streaming**: Real-time Server-Sent Events for monitoring and dashboards
- **Multi-Channel Alerting**: Console, Discord, Telegram, and webhook notifications

## Prerequisites

- Node.js 18+
- Twitter Developer Account with API v2 access (filtered stream permissions)
- Solana wallet with SOL for gas fees
- PumpPortal API key

## Installation

```bash
npm install
```

## Configuration

Copy `.env.example` to `.env` and fill in your credentials:

```bash
cp .env.example .env
```

### Environment Variables

#### Required

| Variable | Description |
|----------|-------------|
| `TWITTER_API_KEY` | Twitter API key (required when `TWITTER_ENABLED=true`) |
| `TWITTER_API_SECRET` | Twitter API secret (required when `TWITTER_ENABLED=true`) |
| `TWITTER_ACCESS_TOKEN` | Twitter access token (required when `TWITTER_ENABLED=true`) |
| `TWITTER_ACCESS_SECRET` | Twitter access secret (required when `TWITTER_ENABLED=true`) |
| `TWITTER_BEARER_TOKEN` | Twitter bearer token (required when `TWITTER_ENABLED=true`) |
| `SOLANA_PRIVATE_KEY` | Base58 encoded Solana private key |
| `PUMPPORTAL_API_KEY` | PumpPortal API key |
| `PUMPPORTAL_WS_ENABLED` | false | Enable PumpPortal Data websocket |
| `PUMPPORTAL_WS_SUBSCRIBE_NEW_TOKENS` | true | Subscribe to new token events |
| `PUMPPORTAL_WS_TOKEN_MINTS` | - | Comma-separated mints to monitor trades |
| `PUMPPORTAL_WS_ACCOUNTS` | - | Comma-separated accounts to monitor trades |
| `PUMPPORTAL_WS_SUBSCRIBE_MIGRATION` | false | Subscribe to migration events |
| `DEFAULT_BUY_FEE_BPS` | 150 | Default fee (bps) on buys when no DB setting exists |
| `DEFAULT_SELL_FEE_BPS` | 150 | Default fee (bps) on sells when no DB setting exists |
| `PLATFORM_FEE_WALLET` | GAffyNL3KmejcYgVtVDg5zhs2Deeptg8BgE9EYN4WzrD | Destination wallet for platform fees |
| `ENCRYPTION_KEY` | - | 32-byte AES key (hex or base64) for encrypting wallet pools |
| `SUPABASE_DB_URL` | - | Postgres connection string for migrations (used by scripts/apply-supabase-migrations.js) |

> Note: The Solana 1.x SDK (via PumpFun/Raydium/Jito deps) pulls `bigint-buffer` (GHSA-3gc7-fjrx-p6mg). No patched 1.x release exists yet; functional impact is low because web3 uses it on fixed-size fields. Upgrade when upstream publishes a fix.

#### Optional

| Variable | Default | Description |
|----------|---------|-------------|
| `TWITTER_ENABLED` | true | Set to `false` to run without Twitter streaming (skips all Twitter API keys) |
| `TWITTER_USERNAMES` | - | Comma-separated usernames to monitor |
| `TWITTER_HASHTAGS` | - | Comma-separated hashtags to monitor |
| `SOLANA_RPC_URL` | mainnet | Solana RPC endpoint |
| `SSE_PORT` | 3000 | SSE server port |
| `DISCORD_WEBHOOK_URL` | - | Discord webhook for alerts |
| `TELEGRAM_BOT_TOKEN` | - | Telegram bot token |
| `TELEGRAM_CHAT_ID` | - | Telegram chat ID |
| `CLASSIFIER_MIN_CONFIDENCE` | 0.6 | Minimum confidence to trigger launch |
| `CLASSIFIER_MAX_RISK` | 0.7 | Maximum risk score allowed |
| `TRUSTED_USERS` | - | Users that bypass risk checks |
| `GROQ_ENABLED` | false | Enable Groq-powered tweet analysis for ticker/name suggestions |
| `GROQ_API_KEY` | - | Groq API key (required when `GROQ_ENABLED=true`) |
| `GROQ_MODEL` | llama-3.1-8b-instant | Primary Groq model to use (fast) |
| `GROQ_SECONDARY_MODEL` | - | Optional secondary Groq model for extra suggestions (e.g., llama-3.1-70b-versatile) |
| `GROQ_SUGGESTION_COUNT` | 2 | Max Groq suggestions to consider per tweet |
| `GROQ_AUTO_DEPLOY` | true | When true, Groq suggestions enter the normal auto-deploy flow |
| `GROQ_TEMPERATURE` | 0.2 | Sampling temperature for Groq calls |
| `GROQ_MAX_TOKENS` | 256 | Max tokens for Groq responses |
| `ZK_MIXER_ENABLED` | false | Enable Groth16 (bn254) proof verification for mixer withdrawals |
| `ZK_MIXER_ARTIFACT_DIR` | ../ZCDOS/circuits/zk-mixer/target | Path to verification_key.json/wasm/ACIR |
| `ZK_MIXER_NULLIFIER_STORE` | ./zk-nullifiers.json | File to persist used nullifier hashes |

## Usage

### Quick Start (with Web UI)

```bash
# Install dependencies
npm install

# Build backend
npm run build

# Build frontend
npm run build:web

# Start the server
npm start
```

Then open http://localhost:3000 in your browser.

### Development

**Backend only:**
```bash
npm run dev
```

**Frontend development (with hot reload):**
```bash
# Terminal 1: Start backend
npm run dev

# Terminal 2: Start frontend dev server
npm run dev:web
```

The frontend dev server runs on port 5173 and proxies API requests to the backend on port 3000.

### Production

```bash
npm run build:all  # Builds both backend and frontend
npm start
```

### Apply Supabase migrations without Supabase CLI

```bash
# Install dependency once
npm install pg

# Run migrations (uses supabase/migrations/*.sql)
SUPABASE_DB_URL="postgresql://postgres:<password>@db.<ref>.supabase.co:5432/postgres" npm run db:push
```

### MCP server (Claude Desktop / MCP clients)

```bash
npm install @modelcontextprotocol/sdk
npm run mcp  # starts stdio MCP server exposing health/config/wallet/launch tools
```

## Web Interface

The web UI provides three main pages:

### Home (`/`)
- Overview of features
- Quick access to Deploy and Feed
- Live stats (when connected)

### Token Deploy (`/deploy`)
- **Token Name/Symbol**: Enter your token details (auto-ticker generation)
- **Description**: Optional token description
- **Website/Twitter**: Links for your token
- **Platform Selection**: Choose deployment platform (PumpFun, etc.)
- **Buy Amount**: Initial buy amount in SOL
- **Image Upload**: Drag & drop or paste from clipboard
- **Mayhem Mode**: Toggle for aggressive settings
- **Multi-Deploy**: Deploy multiple tokens at once
- **Auto-sell**: Automatic sell toggle

### Live Feed (`/feed`)
- **Discord/Telegram-style feed**: Real-time event stream
- **Twitter accounts**: Add/remove watched accounts
- **Filters**: Filter by tweets, launches, alerts, system events
- **Notifications**: Browser notifications for important events
- Click on tokens/transactions to view on PumpFun/Solscan

## API Endpoints

Once running, the following endpoints are available:

### Core Endpoints
| Endpoint | Description |
|----------|-------------|
| `GET /health` | Health check with client count |
| `GET /events` | SSE stream of all events |
| `GET /events/:types` | SSE stream of specific event types |
| `GET /api/events` | Get event history (JSON) |
| `GET /api/stats` | Classifier and system statistics |

### Token Endpoints
| Endpoint | Description |
|----------|-------------|
| `POST /api/tokens/create` | Create a new token |
| `GET /api/tokens` | List created tokens |
| `GET /api/tokens/:mint` | Get token by mint address |
| `POST /api/tokens/:mint/buy` | Buy tokens |
| `POST /api/tokens/:mint/sell` | Sell tokens |

### Utility Endpoints
| Endpoint | Description |
|----------|-------------|
| `GET /api/wallet` | Get wallet address and balance |
| `GET /api/status` | Get system status |
| `POST /api/upload/image` | Upload image (base64) |

### SSE Event Types

```typescript
// Tweet events
tweet:received    // New tweet from monitored source
tweet:filtered    // Tweet filtered out by classifier
tweet:classified  // Tweet classification result

// Launch events
launch:detected   // Valid launch command detected

// Token events
token:creating    // Token creation started
token:created     // Token created successfully
token:failed      // Token creation failed

// Alert events
alert:info / alert:warning / alert:error / alert:success

// System events
system:started / system:stopped / system:error
```

### Example: Connect to SSE Stream

```javascript
const evtSource = new EventSource('http://localhost:3000/events');

evtSource.addEventListener('launch:detected', (e) => {
  const data = JSON.parse(e.data);
  console.log(`Launch detected: ${data.data.ticker}`);
});

evtSource.addEventListener('token:created', (e) => {
  const data = JSON.parse(e.data);
  console.log(`Token created: ${data.data.mint}`);
});
```

## Launch Command Formats

The service recognizes these patterns in tweets:

- `$LAUNCH TICKER` - e.g., `$LAUNCH DOGE2`
- `$LAUNCH TICKER Name` - e.g., `$LAUNCH PEPE2 Pepe Returns`
- `#LAUNCH TICKER` - e.g., `#LAUNCH MOON`
- `Launching $TICKER` - e.g., `Launching $ROCKET`
- `Launch $TICKER` - e.g., `Launch $BASED`

## Architecture

```
├── src/                    # Backend (Node.js/TypeScript)
│   ├── index.ts           # Main entry point and orchestration
│   ├── config.ts          # Configuration loading
│   ├── types.ts           # TypeScript type definitions
│   ├── events.ts          # Event bus and event types
│   ├── twitter.ts         # Twitter stream service
│   ├── parser.ts          # Tweet parsing and command extraction
│   ├── classifier.ts      # Tweet classification and filtering
│   ├── pumpportal.ts      # PumpPortal API integration
│   ├── sse-server.ts      # SSE server + static file serving
│   ├── api-routes.ts      # REST API routes for web UI
│   └── alerting.ts        # Multi-channel alerting service
│
└── web/                    # Frontend (React/Vite/Tailwind)
    ├── src/
    │   ├── App.tsx        # Main app with routing
    │   ├── pages/
    │   │   ├── HomePage.tsx        # Landing page
    │   │   ├── TokenDeployPage.tsx # Token deployment UI
    │   │   └── FeedPage.tsx        # Live feed (Discord-style)
    │   └── components/
    │       └── Layout.tsx          # App layout with navigation
    └── public/             # Static assets
```

### Data Flow

```
Twitter Stream (Ingestion)
        │
        ▼
  Tweet Parser
        │
        ▼
   Classifier ──────► Event Bus ──────► SSE Clients
        │                   │
        ▼                   ▼
  PumpPortal           Alerting
  (Token Creation)     (Notifications)
```

## Security Notes

- Never commit your `.env` file
- Use a dedicated bot wallet, not your main wallet
- Monitor your wallet balance to prevent unexpected losses
- The classifier helps filter spam and high-risk tweets
- Trusted users bypass risk checks - use carefully

## License

MIT
