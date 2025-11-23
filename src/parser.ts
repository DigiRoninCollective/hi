import { TweetData, ParsedLaunchCommand } from './types';

/**
 * Pattern examples that will be matched:
 * - "$LAUNCH DOGE2" -> ticker: DOGE2
 * - "$LAUNCH PEPE2 My Pepe Token" -> ticker: PEPE2, name: My Pepe Token
 * - "Launch $MOON to the moon!" -> ticker: MOON
 * - "#LAUNCH ROCKET" -> ticker: ROCKET
 * - "Launching $DOGE2 - the next big thing" -> ticker: DOGE2
 */

// Regex patterns for launch commands
const LAUNCH_PATTERNS = [
  // $LAUNCH TICKER [optional name/description]
  /\$LAUNCH\s+([A-Z0-9]{1,10})(?:\s+(.+?))?(?:\n|$|[.!?])/i,

  // #LAUNCH TICKER [optional name/description]
  /#LAUNCH\s+([A-Z0-9]{1,10})(?:\s+(.+?))?(?:\n|$|[.!?])/i,

  // "Launching $TICKER" pattern
  /launching\s+\$([A-Z0-9]{1,10})/i,

  // "Launch $TICKER" pattern
  /launch\s+\$([A-Z0-9]{1,10})/i,

  // Just $TICKER with "launch" somewhere in text
  /\$([A-Z0-9]{1,10})/i,
];

// Pattern to extract image URLs from tweets
const IMAGE_URL_PATTERN = /https?:\/\/[^\s]+\.(?:jpg|jpeg|png|gif|webp)/gi;

// Pattern to extract a description (text after ticker, before any URLs)
const DESCRIPTION_PATTERN = /[^\n.!?]+/;

/**
 * Parse a tweet to extract launch command information
 */
export function parseLaunchCommand(tweet: TweetData): ParsedLaunchCommand | null {
  const text = tweet.text;

  // Check if tweet contains any launch-related keywords
  const hasLaunchKeyword = /launch|launching|\$launch|#launch/i.test(text);

  if (!hasLaunchKeyword) {
    return null;
  }

  let ticker: string | null = null;
  let name: string | null = null;
  let description: string | null = null;

  // Try each pattern to find a match
  for (const pattern of LAUNCH_PATTERNS) {
    const match = text.match(pattern);
    if (match) {
      ticker = match[1].toUpperCase();

      // If there's a second capture group, use it as potential name/description
      if (match[2]) {
        const extraText = match[2].trim();
        // Use first few words as name if available
        const words = extraText.split(/\s+/);
        if (words.length > 0) {
          name = words.slice(0, 4).join(' ');
          if (words.length > 4) {
            description = extraText;
          }
        }
      }
      break;
    }
  }

  if (!ticker) {
    return null;
  }

  // Generate default name if not found
  if (!name) {
    name = `${ticker} Token`;
  }

  // Extract image URL if present
  const imageMatches = text.match(IMAGE_URL_PATTERN);
  const imageUrl = imageMatches ? imageMatches[0] : undefined;

  // Extract description from the tweet if not already found
  if (!description) {
    // Use the tweet text as description, cleaned up
    description = cleanDescription(text, ticker);
  }

  return {
    ticker,
    name,
    description,
    imageUrl,
    tweetId: tweet.id,
    tweetAuthor: tweet.authorUsername,
    tweetText: text,
  };
}

/**
 * Clean up tweet text to use as token description
 */
function cleanDescription(text: string, ticker: string): string {
  let cleaned = text
    // Remove URLs
    .replace(/https?:\/\/[^\s]+/g, '')
    // Remove the launch command itself
    .replace(/\$LAUNCH\s+/gi, '')
    .replace(/#LAUNCH\s+/gi, '')
    // Remove excess whitespace
    .replace(/\s+/g, ' ')
    .trim();

  // Truncate if too long (PumpFun has character limits)
  if (cleaned.length > 200) {
    cleaned = cleaned.substring(0, 197) + '...';
  }

  // Default description if cleaned text is too short
  if (cleaned.length < 10) {
    cleaned = `${ticker} - Launched via Twitter by @${ticker} community`;
  }

  return cleaned;
}

/**
 * Validate ticker format
 */
export function isValidTicker(ticker: string): boolean {
  // Ticker should be 1-10 alphanumeric characters
  return /^[A-Z0-9]{1,10}$/.test(ticker);
}

/**
 * Extract hashtags from tweet
 */
export function extractHashtags(text: string): string[] {
  const matches = text.match(/#[A-Za-z0-9_]+/g);
  return matches ? matches.map(tag => tag.substring(1).toLowerCase()) : [];
}

/**
 * Check if tweet is from a monitored user
 */
export function isFromMonitoredUser(tweet: TweetData, monitoredUsernames: string[]): boolean {
  const lowerUsername = tweet.authorUsername.toLowerCase();
  return monitoredUsernames.some(u => u.toLowerCase() === lowerUsername);
}

/**
 * Check if tweet contains monitored hashtags
 */
export function containsMonitoredHashtag(tweet: TweetData, monitoredHashtags: string[]): boolean {
  const hashtags = extractHashtags(tweet.text);
  return monitoredHashtags.some(h => hashtags.includes(h.toLowerCase()));
}
