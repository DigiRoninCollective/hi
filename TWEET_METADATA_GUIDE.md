# Tweet Metadata Extraction & Display Guide

This document describes the tweet metadata scraping and enrichment system that was added to enhance the Groq AI analysis.

## Overview

The system automatically extracts and displays tweet metadata including:
- **Images**: Count and URLs of tweet media
- **User Info**: Author name, follower count, verified status, profile picture
- **Links**: Website URLs, external links, and link count

## Architecture

### 1. Tweet Metadata Service (`src/tweet-metadata.service.ts`)

Enriches basic tweet data with additional metadata from Twitter API.

**Key Methods:**

- **`enrichTweet(tweetData)`**: Enriches a single tweet with metadata
  - Fetches user information (name, followers, verified status, profile image)
  - Extracts website URLs (filters out twitter.com, x.com, t.co)
  - Parses and categorizes media (images, videos, gifs)

- **`formatForGroqAnalysis(enrichedData)`**: Prepares enriched data for Groq API
  - Structures metadata in a format optimized for Groq analysis
  - Includes author credibility signals (followers, verified status)
  - Includes external links and media information

- **`fetchUserInfo(userId, username)`**: Queries Twitter API for user metadata
  - Retrieves: name, follower count, verified status, profile image URL

### 2. API Endpoint Enhancement (`src/api-routes.ts`)

**POST `/api/groq/suggest`**

Now accepts enriched metadata parameters:

```json
{
  "text": "Tweet text content",
  "tweetId": "tweet_id_123",
  "authorUsername": "username",
  "urls": ["https://example.com", ...],
  "mediaUrls": ["https://pbs.twimg.com/media/..."],
  "websiteUrls": ["https://example.com"],
  "authorName": "User Display Name",
  "authorFollowers": 50000,
  "authorVerified": true
}
```

**Response includes:**

```json
{
  "success": true,
  "suggestions": [...],
  "count": 1,
  "metadata": {
    "authorName": "User Display Name",
    "authorFollowers": 50000,
    "authorVerified": true,
    "websiteUrls": ["https://example.com"],
    "hasWebsite": true
  }
}
```

### 3. Frontend Display (`web/src/pages/FeedPage.tsx`)

Tweet metadata is displayed as a metadata section under each tweet:

```
👥 50,000 followers ✓ (verified badge)
📷 2 images
🔗 1 link
```

**Features:**
- Shows follower count with locale formatting
- Displays verified checkmark (blue) for verified accounts
- Shows image/video count
- Shows external link count
- Metadata appears below tweet content, above action buttons

## Data Flow

```
Twitter Stream
    ↓
processTweet() - Captures initial metadata
    ↓
TweetData {
  id, text, authorId, authorUsername,
  urls[], mediaUrls[]
}
    ↓
Frontend Groq Analysis Button
    ↓
analyzeWithGroq() - Enriches with metadata
    ↓
Extract metadata:
- websiteUrls (non-twitter links)
- authorFollowers, authorVerified, authorName
    ↓
POST /api/groq/suggest
    ↓
Groq LLM Analysis
    ↓
Display suggestions + metadata
```

## Website Link Detection

Website URLs are identified by filtering:
- ❌ twitter.com (removed)
- ❌ x.com (removed)
- ❌ t.co (removed)
- ✅ All other domains (kept as website URLs)

```javascript
const websiteUrls = urls.filter((url) => {
  const domain = new URL(url).hostname.toLowerCase()
  return !domain.includes('twitter.com') &&
         !domain.includes('x.com') &&
         !domain.includes('t.co')
})
```

## Groq Analysis Enhancement

The enriched metadata helps Groq make better token suggestions:

- **Author Credibility**: Follower count and verified status indicate launch legitimacy
- **External Links**: Website URLs suggest more established projects
- **Media**: Images/videos can help identify project branding
- **Context**: User name and follower count provide market research data

### Example Groq Prompt Enhancement

Instead of just analyzing tweet text, Groq now receives:

```
Tweet: "Launching $MOON - new DeFi platform with AI"
Author: @crypto_expert (50K followers, verified ✓)
Website: https://moon-protocol.io
Media: 2 images available
```

This enables Groq to make more informed token name/ticker suggestions.

## Usage

### Manual Analysis (Frontend)

1. Tweet appears in feed
2. Metadata automatically shown (👥🎖️📷🔗)
3. Click "Groq Analysis" button
4. Metadata + tweet sent to backend
5. AI suggestions displayed with context

### Automatic Enrichment (Backend)

When implementing automatic enrichment in the future:

```typescript
import { TweetMetadataService } from './tweet-metadata.service'

const metadataService = new TweetMetadataService(bearerToken)

// Enrich tweet data
const enrichedTweet = await metadataService.enrichTweet(tweetData)

// Format for Groq
const groqInput = metadataService.formatForGroqAnalysis(enrichedTweet)
```

## Performance Considerations

- **User Info Fetching**: Adds ~500ms per tweet (Twitter API call)
- **Caching Recommendation**: Cache user info for 1 hour to avoid rate limits
- **Batch Operations**: Use `enrichTweets()` for multiple tweets at once

## Twitter API Fields Used

The service requires these Twitter API v2 fields:

```
user.fields:
  - public_metrics (followers_count)
  - verified
  - profile_image_url
  - name
```

Ensure your Twitter API credentials have access to these fields.

## Future Enhancements

1. **Automatic Enrichment**: Enrich tweets automatically on receipt
2. **Image Analysis**: Use vision AI to analyze token logos in tweets
3. **Website Scraping**: Extract metadata from linked websites
4. **Sentiment Analysis**: Analyze community sentiment from linked discussions
5. **Historical Data**: Track author's launch success rate
6. **Caching Layer**: Cache user info and link metadata

## Troubleshooting

### Missing User Info
- **Issue**: authorFollowers/authorVerified null
- **Cause**: Twitter API user lookup failed
- **Fix**: Check Twitter API credentials and rate limits

### Missing Website URLs
- **Issue**: websiteUrls empty but tweet has links
- **Cause**: All links were from twitter.com/x.com/t.co
- **Fix**: Look for legitimate website links in tweet

### Metadata Not Displaying
- **Issue**: Metadata section not visible on tweet
- **Cause**: event.data missing metadata fields
- **Fix**: Ensure analyzeWithGroq() was called and data was returned

## Environment Setup

No additional environment variables required. The service uses existing:
- `TWITTER_BEARER_TOKEN`: For Twitter API v2 access
- `TWITTER_API_KEY`, `TWITTER_API_SECRET`, etc.: Already configured

## API Rate Limits

Twitter API v2 rate limits for user lookups:
- **Free tier**: 300 requests/15 minutes
- **Premium tier**: Much higher limits

Consider implementing a queue/cache to avoid hitting rate limits during high-volume tweet streams.