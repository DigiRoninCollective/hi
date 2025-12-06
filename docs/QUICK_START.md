# Quick Start: Twitter Feed with Groq AI & Metadata

Get up and running in 2 minutes ✨

## Prerequisites ✅

- Node.js 18+ installed
- `.env` file configured (already done)
- Supabase migrations applied (✅ done)
- Groq API key active (✅ in .env)
- Twitter API access configured (✅ in .env)

## Start the System

### Terminal 1: Backend Server
```bash
npm run build
npm start
```
Expected output:
```
PumpFun Twitter Launcher
Configuration loaded successfully
API routes initialized
SSE server initialized on port 3000
```

### Terminal 2: Frontend (New Terminal)
```bash
cd web
npm run dev
```
Expected output:
```
VITE v5.4.21 building...
Local: http://localhost:5173
```

### Terminal 3: Monitor Groq (Optional)
```bash
npm start | grep -i groq
```

## Access the App

Open browser: **http://localhost:5173**

## Using the Features

### 1. Navigate to Feed Page
- Click "Feed" in navigation
- See live tweet stream
- Each tweet shows metadata: 👥📷🔗

### 2. Click "Groq Analysis"
- Green button with 🤖 emoji
- Shows loading spinner
- Wait 2-5 seconds
- AI suggestions appear

### 3. Deploy Token
- Click "Deploy [TICKER]"
- Token created with AI-suggested name
- View on PumpFun/Solscan

## What You're Looking At

### Tweet Card Structure
```
┌─────────────────────────────────┐
│ @username: Tweet text           │ ← Tweet content
├─────────────────────────────────┤
│ 👥 50,000 followers ✓           │ ← Metadata
│ 📷 2 images                     │
│ 🔗 1 link                       │
├─────────────────────────────────┤
│ [🤖 Groq Analysis] [Buy] [Sell] │ ← Action buttons
└─────────────────────────────────┘
```

### Groq Suggestion
```
┌─────────────────────────────────┐
│ MOON - Moon Protocol            │ ← AI suggestion
│ For token launches...           │ ← Reasoning
│ [Deploy MOON]                   │ ← Deploy button
└─────────────────────────────────┘
```

## Key Features

| Feature | How to Use |
|---------|-----------|
| **Metadata Display** | Automatic on all tweets |
| **Groq Analysis** | Click 🤖 button |
| **Deploy Token** | Click "Deploy [NAME]" |
| **Manual Buy** | Use "Buy with X SOL" button |
| **Watch Accounts** | Add in sidebar |
| **Settings** | Click ⚙️ Preferences |

## Environment Check

### Verify Configuration
```bash
# Check Groq
grep GROQ_ENABLED web/.env
# Should output: GROQ_ENABLED=true

# Check API Key
grep GROQ_API_KEY web/.env
# Should output: GROQ_API_KEY=gsk_...

# Check Database
grep SUPABASE_URL web/.env
# Should output: SUPABASE_URL=https://...
```

## Monitor API Calls

### Watch Groq Requests (Browser DevTools)
1. Press `F12` to open DevTools
2. Click "Network" tab
3. Click "🤖 Groq Analysis" button
4. See `POST /api/groq/suggest` request
5. Click response to see suggestions

### Sample Request
```json
{
  "text": "Launching $MOON token",
  "tweetId": "123456",
  "authorUsername": "user",
  "urls": ["https://example.com"],
  "mediaUrls": ["https://pbs.twimg.com/..."],
  "websiteUrls": ["https://example.com"],
  "authorFollowers": 50000,
  "authorVerified": true
}
```

### Sample Response
```json
{
  "success": true,
  "suggestions": [
    {
      "ticker": "MOON",
      "name": "Moon Protocol",
      "description": "DeFi protocol..."
    }
  ],
  "metadata": {
    "authorFollowers": 50000,
    "authorVerified": true,
    "hasWebsite": true
  }
}
```

## Testing Checklist

Quick verification:

- [ ] Backend starts without errors
- [ ] Frontend loads at localhost:5173
- [ ] Can see tweets in feed
- [ ] Metadata icons visible (👥📷🔗)
- [ ] Can click "🤖 Groq Analysis" button
- [ ] Loading spinner shows
- [ ] Suggestions appear after 2-5 seconds
- [ ] "Deploy" button is clickable
- [ ] Can deploy token with suggested name

## Common Tasks

### View Live Logs
```bash
npm start 2>&1 | tee app.log
```

### Check Database
1. Go to https://supabase.com/dashboard
2. Project: "hi"
3. SQL Editor: Test queries

### Test Groq API
```bash
curl -X POST http://localhost:3000/api/groq/suggest \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Launching new token",
    "tweetId": "123",
    "authorUsername": "user"
  }'
```

### View Feed in Demo Mode
- Feed page → Click "Load Demo"
- Shows mock tweets (no Twitter API needed)
- Groq Analysis still works

## Troubleshooting

### Backend won't start
```bash
# Clear build
rm -rf dist
npm run build
npm start
```

### Frontend won't load
```bash
cd web
npm install
npm run dev
```

### Groq not working
1. Check API key: `echo $GROQ_API_KEY`
2. Check enabled: `grep GROQ_ENABLED web/.env`
3. Restart backend: `npm start`
4. Check browser console (F12) for errors

### No tweets showing
1. Check demo mode: Click "Load Demo"
2. Check Twitter enabled: `grep TWITTER_ENABLED .env`
3. Check bearer token: `grep TWITTER_BEARER_TOKEN .env`
4. Check SSE port: Default 3000

## Next Steps

After verifying everything works:

1. **Test Deployment**
   - Deploy token with Groq suggestion
   - Check on PumpFun/Solscan

2. **Configure Preferences**
   - Set buy amount (Settings → Preferences)
   - Configure multi-wallet (S-tier only)
   - Set fee preferences

3. **Monitor Production**
   - Check logs regularly
   - Monitor Groq API usage
   - Track deployments

4. **Review Documentation**
   - `TESTING_GUIDE.md` - Detailed testing
   - `TWEET_METADATA_GUIDE.md` - Technical details
   - `PROJECT_STATUS.md` - Full overview

## Performance Tips

### For Development
- Keep browser DevTools closed (uses less memory)
- Use demo mode to avoid Twitter API calls
- Monitor logs with: `npm start | grep -i groq`

### For Production
- Set up monitoring alerts
- Cache user info (Twitter API limits)
- Batch process tweets
- Monitor Groq API costs

## Where to Get Help

1. **Documentation**
   - 📖 TESTING_GUIDE.md
   - 📖 TWEET_METADATA_GUIDE.md
   - 📖 PROJECT_STATUS.md

2. **Browser Console (F12)**
   - Error messages
   - Network requests
   - API responses

3. **Server Logs**
   - Backend errors
   - Groq API calls
   - Database queries

4. **Supabase Dashboard**
   - Check database tables
   - Run SQL queries
   - View API logs

## Quick API Endpoints

```
GET  http://localhost:3000/api/status
POST http://localhost:3000/api/groq/suggest
GET  http://localhost:3000/api/tokens
POST http://localhost:3000/api/tokens/create
POST http://localhost:3000/api/actions/buy-multi
```

## Environment Verified ✅

Your `.env` has:
- ✅ Groq API Key configured
- ✅ Supabase URL and keys
- ✅ Twitter monitoring setup
- ✅ Solana RPC configured
- ✅ PumpPortal API key
- ✅ Encryption key (32-byte)

Everything is ready to go! 🚀

---

**Time to first token deployment:** ~5 minutes

**Estimated Groq analysis time:** 2-5 seconds

**Support:** See documentation files or check logs

Good luck! 🎉