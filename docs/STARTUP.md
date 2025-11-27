# Startup Guide - PumpFun Twitter Launcher

This guide explains how to start the application locally.

## Quick Start

### macOS / Linux
```bash
./start.sh
```

### Windows
```cmd
start.bat
```

## What the Startup Script Does

The startup script automatically:
1. ✅ Checks for Node.js and npm
2. ✅ Verifies `.env` configuration files exist
3. ✅ Installs dependencies (if needed)
4. ✅ Builds TypeScript code (if needed)
5. ✅ Starts backend and frontend simultaneously

## Prerequisites

Before running the startup script, ensure:

### 1. Node.js 18+
```bash
node --version  # Should be v18.0.0 or higher
```

If not installed, download from: https://nodejs.org/

### 2. Environment Files

**Root `.env` file:**
```bash
cp .env.example .env
# Edit .env with your configuration
```

**Web `.env` file:**
```bash
cp .env.example web/.env
# Or copy from root if not present
```

Required environment variables:
- `SOLANA_RPC_URL` - Solana RPC endpoint
- `GROQ_API_KEY` - Groq API key for LLM
- `SUPABASE_URL` - Supabase project URL
- `SUPABASE_ANON_KEY` - Supabase anonymous key
- `PUMPPORTAL_API_KEY` - PumpPortal API key
- `PUMPPORTAL_WALLET_PUBLIC_KEY` - Your wallet public key
- `PUMPPORTAL_WALLET_PRIVATE_KEY` - Your wallet private key

## Running the Application

### Automatic (Recommended)

**macOS / Linux:**
```bash
chmod +x start.sh  # Only needed once
./start.sh
```

**Windows:**
```cmd
start.bat
```

### Manual (3 Terminals)

**Terminal 1 - Backend:**
```bash
npm run dev
```

**Terminal 2 - Frontend:**
```bash
npm run dev:web
```

**Terminal 3 - Optional Monitoring:**
```bash
npm start | grep -i groq  # Monitor Groq API calls
```

### Production Mode

**Build first:**
```bash
npm run build:all
```

**Run production:**
```bash
npm run start:prod
```

## Accessing the Application

Once started, open your browser:

- **Frontend UI:** http://localhost:5173
- **Backend API:** http://localhost:3000
- **Health Check:** http://localhost:3000/api/status

## Stopping the Application

Press `Ctrl+C` in the terminal where the startup script is running.

Both backend and frontend will stop gracefully.

## Troubleshooting

### "Port already in use"

If you see "EADDRINUSE" errors:

```bash
# Kill processes on ports 3000 and 5173
lsof -ti:3000,5173 | xargs kill -9

# Or use:
npm run killdev  # If available in your setup
```

### "Module not found" errors

Reinstall dependencies:
```bash
rm -rf node_modules web/node_modules
npm install
cd web && npm install && cd ..
```

### ".env file not found"

Create the required files:
```bash
# Root .env
touch .env
# Add your configuration

# Web .env
touch web/.env
# Add your configuration (can copy from root)
```

### TypeScript compilation errors

Rebuild the project:
```bash
npm run build
```

### Frontend won't load

Clear cache and reinstall:
```bash
cd web
rm -rf node_modules .next dist
npm install
npm run dev
```

### Backend crashes on startup

Check the logs for errors. Common issues:
- Missing environment variables
- Invalid Solana RPC URL
- Database connection issues
- Port 3000 already in use

## Advanced Usage

### Run Only Backend
```bash
npm run dev
```

### Run Only Frontend
```bash
npm run dev:web
```

### Run Desktop App
```bash
npm run desktop:dev
```

### Run CLI Tool
```bash
npm run cli
```

### Build for Production
```bash
npm run build:all
```

### Watch Mode (Auto-rebuild on changes)
```bash
npm run watch
```

## Environment Variables Reference

### Core Configuration
```env
# Solana Configuration
SOLANA_RPC_URL=https://mainnet.helius-rpc.com/?api-key=YOUR_KEY
SOLANA_PRIVATE_KEY=your_base58_private_key

# PumpPortal Configuration
PUMPPORTAL_API_KEY=your_api_key
PUMPPORTAL_WALLET_PUBLIC_KEY=your_public_key
PUMPPORTAL_WALLET_PRIVATE_KEY=your_private_key

# Database (Supabase)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# AI/LLM
GROQ_ENABLED=true
GROQ_API_KEY=gsk_...
GROQ_MODEL=llama-3.1-8b-instant

# Social Media
TWITTER_ENABLED=false
TWITTER_API_KEY=your_key
TWITTER_API_SECRET=your_secret
TWITTER_ACCESS_TOKEN=your_token
TWITTER_ACCESS_SECRET=your_secret
TWITTER_BEARER_TOKEN=your_bearer_token

# Telegram
TELEGRAM_BOT_TOKEN=your_bot_token
TELEGRAM_CHAT_ID=your_chat_id

# Server
SSE_PORT=3000
SSE_CORS_ORIGIN=*
```

## Performance Tips

1. **Close unused browser tabs** - Reduces memory usage
2. **Use demo mode** - Avoids live API calls during development
3. **Monitor logs** - Check for errors and performance issues
4. **Clear cache** - If you see stale data: `rm -rf .next node_modules`
5. **Use Helius RPC** - Better than free public RPCs for reliability

## Getting Help

Check these resources:
- `/docs/QUICK_START.md` - Quick start guide
- `/docs/TESTING_GUIDE.md` - Testing procedures
- `/docs/PROJECT_STATUS.md` - Current project status
- Browser DevTools (F12) - Frontend errors
- Terminal output - Backend errors

## Useful Commands

```bash
# Check if servers are running
curl http://localhost:3000/api/status

# View backend logs
npm run dev 2>&1 | tee backend.log

# View frontend logs
npm run dev:web 2>&1 | tee frontend.log

# Kill all dev servers (macOS/Linux)
killdev  # If configured in shell

# List what's using ports
lsof -i :3000        # Backend port
lsof -i :5173        # Frontend port
```

## Next Steps

1. Start the application using `./start.sh` or `start.bat`
2. Open http://localhost:5173 in your browser
3. Connect your wallet
4. Navigate to "Create (Local)" to deploy a token
5. Or use "Deploy" to deploy via the web interface

Enjoy! 🚀
