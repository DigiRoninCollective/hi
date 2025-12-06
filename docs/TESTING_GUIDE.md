# Testing Guide: Twitter Feed with Groq & Metadata

Now that Supabase migrations are applied, here's how to test the complete system.

## ✅ What's Now Available

### Database Tables (Just Applied)
- `platform_settings` - Fee configuration
- `user_launch_preferences` - User trading preferences
- `wallet_pools` - Multi-wallet management
- `mint_keys` - Token key storage
- And all other required tables

### Features Ready to Test
1. ✅ Groq AI tweet analysis
2. ✅ Tweet metadata extraction (images, user info, links)
3. ✅ Multi-wallet trading with user preferences
4. ✅ Platform fee management
5. ✅ Admin settings

## Quick Start

### 1. Start the Backend
```bash
npm run build
npm start
```

Server will start on port 3000 (or `SSE_PORT` from .env)

### 2. Start the Frontend
```bash
cd web
npm run dev
```

Web UI will be available at `http://localhost:5173`

### 3. Configure Environment
Ensure `.env` has:
```
GROQ_ENABLED=true
GROQ_API_KEY=gsk_...
GROQ_MODEL=llama-3.1-8b-instant
TWITTER_ENABLED=true
TWITTER_BEARER_TOKEN=...
```

## Testing Scenarios

### Scenario 1: Basic Tweet Analysis

**Steps:**
1. Go to Feed page
2. Look for demo tweet or wait for real tweet
3. Click "🤖 Groq Analysis" button
4. Observe:
   - Loading spinner appears
   - After 2-5 seconds, suggestions appear
   - Shows ticker, name, and description

**Expected Result:**
```
MARS - Mars Coin
Token for interplanetary exploration...
[Deploy MARS]
```

### Scenario 2: Metadata Display

**Steps:**
1. Look at any tweet in the feed
2. Below tweet text, should see metadata section
3. Metadata shows:
   ```
   👥 50,000 followers ✓ (if verified)
   📷 2 images
   🔗 1 link
   ```

**Expected Result:**
- Follower count displayed
- Verified checkmark (if user is verified)
- Image count shown
- Link count shown
- Icons visible and properly styled

### Scenario 3: Website Link Detection

**Steps:**
1. Tweet with external links
2. Click "🤖 Groq Analysis"
3. Check network tab (DevTools)
4. POST request to `/api/groq/suggest` includes:
   ```
   "websiteUrls": ["https://example.com"]
   ```

**Expected Result:**
- Non-twitter links extracted
- twitter.com/x.com/t.co links filtered out
- Website URLs passed to Groq

### Scenario 4: Verified Author

**Steps:**
1. Find tweet from verified account
2. Check metadata display
3. Should show blue checkmark after follower count

**Expected Result:**
```
👥 100,000 followers ✓
```

### Scenario 5: Multiple Images

**Steps:**
1. Find tweet with multiple images
2. Check metadata display
3. Should show image count

**Expected Result:**
```
📷 3 images
```

### Scenario 6: External Website Link

**Steps:**
1. Find tweet linking to external website
2. Check metadata display
3. Should show link count

**Expected Result:**
```
🔗 2 links
```

## Advanced Testing

### Test Database Connectivity

```bash
# Check if tables exist
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public';

# Verify user_launch_preferences table
SELECT * FROM user_launch_preferences LIMIT 1;

# Check platform_settings
SELECT * FROM platform_settings LIMIT 1;
```

### Test Groq API Integration

Check logs for:
```
[x] Groq suggestions enabled (llama-3.1-8b-instant)
```

Monitor Groq API usage at: https://console.groq.com

### Test Multi-Wallet Features

1. Login as S-tier user (role = 'admin')
2. Go to Preferences
3. Enable multi-wallet
4. Set wallet count, amounts, variance
5. Click Buy button on suggestion
6. Check if multi-wallet transaction executes

### Test Platform Fees

1. Execute buy transaction
2. Check fee deduction from wallet
3. Verify fee wallet receives payment
4. Check transaction signature

## Monitoring

### Check Logs

```bash
# Tail logs
npm start | grep -i groq

# Check specific errors
npm start | grep -i "error\|warning"
```

### Network Monitoring

In browser DevTools (F12):
1. Open Network tab
2. Click "Groq Analysis"
3. Monitor requests:
   - POST `/api/groq/suggest` - Should see enriched payload
   - Response includes suggestions + metadata

### Performance Metrics

Measure timing:
- Click to loading spinner: ~100ms
- Groq analysis: 2-5 seconds (API latency)
- Suggestions display: ~100ms
- Total: ~2-5 seconds

## Troubleshooting

### Issue: "Groq service not initialized"

**Solution:**
```bash
# Check .env
GROQ_ENABLED=true
GROQ_API_KEY=gsk_...

# Restart backend
npm run build
npm start
```

### Issue: "Supabase connection error"

**Solution:**
```bash
# Check database URL
echo $SUPABASE_DB_URL

# Test connection
psql $SUPABASE_DB_URL -c "SELECT 1"
```

### Issue: Metadata not showing

**Solution:**
1. Check browser console for errors
2. Verify tweet has URLs/mediaUrls in data
3. Check Network tab for `/api/groq/suggest` response
4. Ensure FeedPage.tsx modifications are in place

### Issue: Website links empty

**Solution:**
1. Tweet probably has only twitter.com links
2. Try tweet with external URL
3. Check filtering logic filters correctly:
   - ❌ twitter.com
   - ❌ x.com
   - ❌ t.co
   - ✅ all others

### Issue: Verified badge not showing

**Solution:**
1. Use tweet from verified account
2. Check `authorVerified` in network response
3. Verify `event.data.authorVerified` is true
4. Check JSX renders checkmark when true

## Testing Checklist

### Core Features
- [ ] Groq Analysis button appears on tweets
- [ ] Button shows loading spinner during analysis
- [ ] Suggestions appear after 2-5 seconds
- [ ] Can deploy token from suggestion
- [ ] Deploy button works with S-tier user

### Metadata Display
- [ ] Metadata section visible below tweets
- [ ] Follower count shows with emoji 👥
- [ ] Verified badge appears for verified users
- [ ] Image count shows 📷
- [ ] Link count shows 🔗
- [ ] Numbers formatted with commas

### Website Link Detection
- [ ] External links extracted
- [ ] twitter.com links filtered out
- [ ] x.com links filtered out
- [ ] t.co links filtered out
- [ ] Groq receives websiteUrls

### Database Integration
- [ ] User preferences save/load
- [ ] Multi-wallet settings persist
- [ ] Fee deductions working
- [ ] Transaction history saved
- [ ] Platform settings applied

### API Endpoints
- [ ] GET `/api/status` returns healthy
- [ ] POST `/api/groq/suggest` accepts requests
- [ ] `/api/groq/suggest` returns suggestions + metadata
- [ ] `/api/tokens` shows created tokens
- [ ] `/api/actions/buy-multi` executes buys

## Performance Benchmarks

Expected performance:
- Metadata display: Instant (< 100ms)
- Groq analysis request: ~2-5 seconds
- API response time: < 500ms
- Frontend rendering: < 100ms

## Demo Mode Testing

For testing without live Twitter stream:

1. Click "Load Demo" on Feed page
2. Demo tweets appear immediately
3. Test Groq Analysis on demo tweets
4. Metadata should display (with demo data)

## Success Criteria

✅ **All tests pass if:**
1. Groq Analysis button works on tweets
2. Metadata displays with correct icons
3. Website links are extracted
4. Verified badge shows correctly
5. Multi-wallet features work
6. Database tables accessible
7. No errors in browser/server console

## Next Steps

After successful testing:

1. **Deploy to production**
   ```bash
   npm run build:web
   git push
   ```

2. **Monitor in production**
   - Watch Groq API usage
   - Monitor error rates
   - Track database performance

3. **Gather user feedback**
   - How helpful are Groq suggestions?
   - Does metadata help decision-making?
   - Any UX improvements needed?

4. **Plan Phase 1 automation**
   - Auto-enrich tweets on receipt
   - Cache user info for performance
   - Batch process multiple tweets

## Support

For issues, check:
- Server logs: `npm start` output
- Browser console: F12 → Console tab
- Network requests: F12 → Network tab
- Database: Supabase Studio SQL editor

Still stuck? Review:
- `TWEET_METADATA_GUIDE.md` - Technical details
- `TWITTER_FEED_ENHANCEMENTS.md` - Feature overview
- `.env.example` - Configuration template