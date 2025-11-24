import { TweetData, ParsedLaunchCommand } from './types';
import { ClassificationResult, EventBus, EventType } from './events';
import { parseLaunchCommand } from './parser';

// Keywords that indicate a launch command
const LAUNCH_KEYWORDS: string[] = [
  'launch', 'launching', 'deploy', 'deploying', 'mint', 'minting',
  'create', 'creating', 'drop', 'dropping', 'release', 'releasing',
];

// Spam indicators
const SPAM_INDICATORS: string[] = [
  'giveaway', 'airdrop', 'free', 'claim', 'click here', 'dm me',
  'send sol', 'double', '100x', '1000x', 'guaranteed', 'scam',
];

// High-risk patterns
const RISK_PATTERNS: RegExp[] = [
  /send\s+\d+\s*sol/i,
  /click\s+(here|link)/i,
  /dm\s+(me|us)/i,
  /t\.me\/\w+/i,
  /discord\.gg\/\w+/i,
];

export interface ClassifierConfig {
  minConfidenceThreshold: number;
  maxRiskThreshold: number;
  trustedUsers: string[];
}

const DEFAULT_CONFIG: ClassifierConfig = {
  minConfidenceThreshold: 0.6,
  maxRiskThreshold: 0.7,
  trustedUsers: [],
};

/**
 * Tweet classifier for filtering and categorizing incoming tweets
 */
export class TweetClassifier {
  private config: ClassifierConfig;
  private eventBus: EventBus;
  private processedCount: number = 0;
  private launchCount: number = 0;
  private spamCount: number = 0;

  constructor(eventBus: EventBus, config: Partial<ClassifierConfig> = {}) {
    this.eventBus = eventBus;
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Classify a tweet and determine if it should trigger actions
   */
  classify(tweet: TweetData, suggestedCommand?: ParsedLaunchCommand): ClassificationResult {
    this.processedCount++;

    const text = tweet.text.toLowerCase();
    const scores = {
      launch: 0,
      mention: 0,
      spam: 0,
    };

    // Check for launch keywords
    for (const keyword of LAUNCH_KEYWORDS) {
      if (text.includes(keyword)) {
        scores.launch += 0.15;
      }
    }

    // Check for $ ticker pattern
    const tickerMatch = tweet.text.match(/\$[A-Z]{1,10}/g);
    if (tickerMatch) {
      scores.launch += 0.2 * tickerMatch.length;
      scores.mention += 0.1;
    }

    // Check for spam indicators
    for (const indicator of SPAM_INDICATORS) {
      if (text.includes(indicator)) {
        scores.spam += 0.2;
      }
    }

    // Check for high-risk patterns
    let riskScore = 0;
    for (const pattern of RISK_PATTERNS) {
      if (pattern.test(text)) {
        riskScore += 0.25;
        scores.spam += 0.15;
      }
    }

    // Trusted user bonus
    if (this.config.trustedUsers.includes(tweet.authorUsername.toLowerCase())) {
      scores.launch += 0.3;
      riskScore = Math.max(0, riskScore - 0.3);
    }

    // Try to parse as launch command
    const launchCommand = suggestedCommand || parseLaunchCommand(tweet);
    if (launchCommand) {
      scores.launch += 0.4;
    }

    // Normalize scores
    const maxScore = Math.max(scores.launch, scores.mention, scores.spam, 0.1);
    const normalizedLaunch = scores.launch / maxScore;

    // Determine category
    let category: ClassificationResult['category'];
    if (scores.spam > 0.5) {
      category = 'spam';
      this.spamCount++;
    } else if (scores.launch > 0.4 && launchCommand) {
      category = 'launch';
      this.launchCount++;
    } else if (tickerMatch) {
      category = 'mention';
    } else {
      category = 'irrelevant';
    }

    // Calculate confidence
    const confidence = Math.min(normalizedLaunch, 1);

    // Determine sentiment (basic)
    let sentiment: ClassificationResult['sentiment'] = 'neutral';
    if (/moon|pump|lfg|bullish|buy/i.test(text)) {
      sentiment = 'positive';
    } else if (/dump|rug|scam|bearish|sell/i.test(text)) {
      sentiment = 'negative';
    }

    const result: ClassificationResult = {
      isLaunchCommand: category === 'launch' && confidence >= this.config.minConfidenceThreshold,
      confidence,
      category,
      ticker: launchCommand?.ticker,
      sentiment,
      riskScore: Math.min(riskScore, 1),
    };

    // Emit classification event
    this.eventBus.emit(EventType.TWEET_CLASSIFIED, {
      tweetId: tweet.id,
      authorUsername: tweet.authorUsername,
      text: tweet.text,
      classification: result,
    });

    return result;
  }

  /**
   * Process and filter a tweet, returning launch command if valid
   */
  processAndFilter(tweet: TweetData, suggestedCommand?: ParsedLaunchCommand): ParsedLaunchCommand | null {
    const classification = this.classify(tweet, suggestedCommand);

    // Check if it passes thresholds
    if (!classification.isLaunchCommand) {
      return null;
    }

    if (classification.riskScore > this.config.maxRiskThreshold) {
      this.eventBus.emit(EventType.ALERT_WARNING, {
        title: 'High Risk Tweet Blocked',
        message: `Tweet from @${tweet.authorUsername} blocked due to high risk score: ${classification.riskScore.toFixed(2)}`,
        metadata: { tweetId: tweet.id, riskScore: classification.riskScore },
      });
      return null;
    }

    // Get the parsed launch command
    const command = suggestedCommand || parseLaunchCommand(tweet);

    if (command) {
      this.eventBus.emit(EventType.LAUNCH_DETECTED, {
        ticker: command.ticker,
        name: command.name,
        tweetId: tweet.id,
        tweetAuthor: tweet.authorUsername,
        confidence: classification.confidence,
      });
    }

    return command;
  }

  /**
   * Get classifier statistics
   */
  getStats(): {
    processed: number;
    launches: number;
    spam: number;
    launchRate: number;
    spamRate: number;
  } {
    return {
      processed: this.processedCount,
      launches: this.launchCount,
      spam: this.spamCount,
      launchRate: this.processedCount > 0 ? this.launchCount / this.processedCount : 0,
      spamRate: this.processedCount > 0 ? this.spamCount / this.processedCount : 0,
    };
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<ClassifierConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Add a trusted user
   */
  addTrustedUser(username: string): void {
    const lower = username.toLowerCase();
    if (!this.config.trustedUsers.includes(lower)) {
      this.config.trustedUsers.push(lower);
    }
  }

  /**
   * Remove a trusted user
   */
  removeTrustedUser(username: string): void {
    const lower = username.toLowerCase();
    this.config.trustedUsers = this.config.trustedUsers.filter(u => u !== lower);
  }
}
