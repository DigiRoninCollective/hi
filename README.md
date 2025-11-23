# PumpFun Twitter Launcher

A TypeScript/Node.js service that monitors Twitter for token launch commands and automatically creates tokens on PumpFun via PumpPortal. Features SSE streaming, tweet classification, and multi-channel alerting.

## Features

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

### Development

```bash
npm run dev
```

### Production

```bash
npm run build
npm start
```

## API Endpoints

Once running, the following endpoints are available:

| Endpoint | Description |
|----------|-------------|
| `GET /health` | Health check with client count |
| `GET /events` | SSE stream of all events |
| `GET /events/:types` | SSE stream of specific event types |
| `GET /api/events` | Get event history (JSON) |
| `GET /api/stats` | Classifier and system statistics |

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
src/
├── index.ts       # Main entry point and orchestration
├── config.ts      # Configuration loading
├── types.ts       # TypeScript type definitions
├── events.ts      # Event bus and event types
├── twitter.ts     # Twitter stream service (ingestion)
├── parser.ts      # Tweet parsing and command extraction
├── classifier.ts  # Tweet classification and filtering
├── pumpportal.ts  # PumpPortal API integration
├── sse-server.ts  # SSE server for real-time streaming
└── alerting.ts    # Multi-channel alerting service
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
