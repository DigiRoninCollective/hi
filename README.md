# PumpFun Twitter Launcher

A TypeScript/Node.js service that monitors Twitter for token launch commands and automatically creates tokens on PumpFun via PumpPortal.

## Features

- **Twitter Stream Monitoring**: Real-time monitoring of tweets from specific users or hashtags
- **Launch Command Parsing**: Detects patterns like `$LAUNCH DOGE2` or `#LAUNCH PEPE`
- **Automatic Token Creation**: Creates tokens on PumpFun via PumpPortal's API
- **Transaction Signing**: Signs and sends transactions using your bot wallet

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

### Required Environment Variables

| Variable | Description |
|----------|-------------|
| `TWITTER_API_KEY` | Twitter API key |
| `TWITTER_API_SECRET` | Twitter API secret |
| `TWITTER_ACCESS_TOKEN` | Twitter access token |
| `TWITTER_ACCESS_SECRET` | Twitter access secret |
| `TWITTER_BEARER_TOKEN` | Twitter bearer token |
| `TWITTER_USERNAMES` | Comma-separated list of usernames to monitor |
| `TWITTER_HASHTAGS` | Comma-separated list of hashtags to monitor |
| `SOLANA_PRIVATE_KEY` | Base58 encoded Solana private key |
| `SOLANA_RPC_URL` | Solana RPC endpoint |
| `PUMPPORTAL_API_KEY` | PumpPortal API key |

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
├── twitter.ts     # Twitter stream service
├── parser.ts      # Tweet parsing and command extraction
└── pumpportal.ts  # PumpPortal API integration
```

## Security Notes

- Never commit your `.env` file
- Use a dedicated bot wallet, not your main wallet
- Monitor your wallet balance to prevent unexpected losses
- Consider rate limiting to prevent abuse

## License

MIT
