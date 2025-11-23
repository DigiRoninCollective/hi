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
| `TWITTER_API_KEY` | Twitter API key |
| `TWITTER_API_SECRET` | Twitter API secret |
| `TWITTER_ACCESS_TOKEN` | Twitter access token |
| `TWITTER_ACCESS_SECRET` | Twitter access secret |
| `TWITTER_BEARER_TOKEN` | Twitter bearer token |
| `SOLANA_PRIVATE_KEY` | Base58 encoded Solana private key |
| `PUMPPORTAL_API_KEY` | PumpPortal API key |

#### Optional

| Variable | Default | Description |
|----------|---------|-------------|
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
