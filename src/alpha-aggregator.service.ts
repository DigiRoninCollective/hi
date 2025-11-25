import { EventBus, EventType, eventBus } from './events';
import { DiscordService, DiscordMessageData, DiscordConfig } from './discord.service';
import { TelegramService, TelegramMessageData, TelegramConfig } from './telegram.service';
import { RedditService, RedditPostData, RedditConfig } from './reddit.service';
import {
  AlphaSignal,
  AlphaSignalInsert,
  AlphaSignalCategory,
  AlphaSignalPriority,
  AlphaSourceType,
} from './database.types';

export interface AlphaAggregatorConfig {
  discord: DiscordConfig;
  telegram: TelegramConfig;
  reddit: RedditConfig;
  classifier: AlphaClassifierConfig;
}

export interface AlphaClassifierConfig {
  // Keywords that indicate high-value alpha
  launchKeywords: string[];
  tickerPattern: RegExp;
  contractPattern: RegExp;
  // Spam/low-quality indicators
  spamKeywords: string[];
  // Confidence thresholds
  minConfidenceThreshold: number;
  maxRiskThreshold: number;
  // Trusted sources (channels, users)
  trustedChannels: string[];
  trustedUsers: string[];
}

export interface ClassifiedSignal extends AlphaSignalInsert {
  category: AlphaSignalCategory;
  priority: AlphaSignalPriority;
  confidence_score: number;
  risk_score: number;
  tickers: string[];
  contract_addresses: string[];
}

// Default classifier config
const DEFAULT_CLASSIFIER_CONFIG: AlphaClassifierConfig = {
  launchKeywords: [
    'launch', 'launching', 'stealth', 'fair launch', 'presale',
    'mint', 'minting', 'deploy', 'deployed', 'live now',
    'just launched', 'gem', '100x', '1000x', 'moonshot',
    'alpha', 'call', 'buy signal', 'entry', 'dyor',
  ],
  tickerPattern: /\$([A-Z]{2,10})\b/gi,
  contractPattern: /\b([A-HJ-NP-Za-km-z1-9]{32,44})\b/g, // Solana base58 addresses
  spamKeywords: [
    'giveaway', 'airdrop', 'free', 'claim now', 'dm me',
    'send sol', 'double your', 'guaranteed', 'no risk',
    'act fast', 'limited time', 'hurry', 'last chance',
  ],
  minConfidenceThreshold: 0.5,
  maxRiskThreshold: 0.7,
  trustedChannels: [],
  trustedUsers: [],
};

/**
 * Alpha Aggregator - Coordinates multi-source signal collection and classification
 */
export class AlphaAggregatorService {
  private eventBus: EventBus;
  private config: AlphaAggregatorConfig;
  private classifierConfig: AlphaClassifierConfig;

  // Source services
  private discordService: DiscordService | null = null;
  private telegramService: TelegramService | null = null;
  private redditService: RedditService | null = null;

  // Signal handler
  private onSignalHandler: ((signal: ClassifiedSignal) => Promise<void>) | null = null;

  // Statistics
  private stats = {
    totalProcessed: 0,
    bySource: {
      discord: 0,
      telegram: 0,
      reddit: 0,
      twitter: 0,
    },
    byCategory: {
      token_mention: 0,
      launch_alert: 0,
      whale_movement: 0,
      news: 0,
      sentiment: 0,
      technical: 0,
      other: 0,
    },
    filtered: 0,
    highPriority: 0,
  };

  constructor(config: AlphaAggregatorConfig, bus: EventBus = eventBus) {
    this.eventBus = bus;
    this.config = config;
    this.classifierConfig = { ...DEFAULT_CLASSIFIER_CONFIG, ...config.classifier };

    // Initialize source services
    if (config.discord.enabled) {
      this.discordService = new DiscordService(config.discord, bus);
    }
    if (config.telegram.enabled) {
      this.telegramService = new TelegramService(config.telegram, bus);
    }
    if (config.reddit.enabled) {
      this.redditService = new RedditService(config.reddit, bus);
    }
  }

  getTelegramService(): TelegramService | null {
    return this.telegramService;
  }

  /**
   * Set handler for classified signals
   */
  onSignal(handler: (signal: ClassifiedSignal) => Promise<void>): void {
    this.onSignalHandler = handler;
  }

  /**
   * Classify and score a signal
   */
  classifySignal(signal: AlphaSignalInsert): ClassifiedSignal {
    const content = signal.content.toLowerCase();
    const originalContent = signal.content;

    // Extract tickers
    const tickerMatches = originalContent.match(this.classifierConfig.tickerPattern) || [];
    const tickers = tickerMatches.map((t) => t.replace('$', '').toUpperCase());

    // Extract contract addresses
    const contractMatches = originalContent.match(this.classifierConfig.contractPattern) || [];
    const contractAddresses = contractMatches.filter((addr) => addr.length >= 32 && addr.length <= 44);

    // Calculate scores
    let launchScore = 0;
    let spamScore = 0;
    let mentionScore = 0;

    // Check launch keywords
    for (const keyword of this.classifierConfig.launchKeywords) {
      if (content.includes(keyword.toLowerCase())) {
        launchScore += 0.15;
      }
    }

    // Check spam keywords
    for (const keyword of this.classifierConfig.spamKeywords) {
      if (content.includes(keyword.toLowerCase())) {
        spamScore += 0.2;
      }
    }

    // Tickers boost confidence
    if (tickers.length > 0) {
      mentionScore += 0.2 * Math.min(tickers.length, 3);
    }

    // Contract addresses are valuable
    if (contractAddresses.length > 0) {
      launchScore += 0.25;
    }

    // Trusted source bonus
    const channel = signal.source_channel?.toLowerCase() || '';
    const author = signal.source_author?.toLowerCase() || '';

    if (this.classifierConfig.trustedChannels.some((c) => channel.includes(c.toLowerCase()))) {
      launchScore += 0.2;
      spamScore -= 0.3;
    }

    if (this.classifierConfig.trustedUsers.some((u) => author.includes(u.toLowerCase()))) {
      launchScore += 0.15;
      spamScore -= 0.2;
    }

    // Normalize scores
    const confidenceScore = Math.max(0, Math.min(1, launchScore + mentionScore));
    const riskScore = Math.max(0, Math.min(1, spamScore));

    // Determine category
    let category: AlphaSignalCategory = 'other';
    if (launchScore >= 0.3 && contractAddresses.length > 0) {
      category = 'launch_alert';
    } else if (launchScore >= 0.2 || tickers.length > 0) {
      category = 'token_mention';
    } else if (content.includes('whale') || content.includes('large transfer')) {
      category = 'whale_movement';
    } else if (content.includes('news') || content.includes('announced') || content.includes('partnership')) {
      category = 'news';
    } else if (content.includes('bullish') || content.includes('bearish') || content.includes('sentiment')) {
      category = 'sentiment';
    } else if (content.includes('chart') || content.includes('ta') || content.includes('support') || content.includes('resistance')) {
      category = 'technical';
    }

    // Determine priority
    let priority: AlphaSignalPriority = 'low';
    if (category === 'launch_alert' && confidenceScore >= 0.7 && riskScore < 0.3) {
      priority = 'urgent';
    } else if (confidenceScore >= 0.6 && riskScore < 0.4) {
      priority = 'high';
    } else if (confidenceScore >= 0.4) {
      priority = 'medium';
    }

    return {
      ...signal,
      category,
      priority,
      confidence_score: confidenceScore,
      risk_score: riskScore,
      tickers,
      contract_addresses: contractAddresses,
    };
  }

  /**
   * Process a signal from any source
   */
  private async processSignal(signal: AlphaSignalInsert): Promise<void> {
    // Classify the signal
    const classified = this.classifySignal(signal);

    // Update stats
    this.stats.totalProcessed++;
    this.stats.bySource[classified.source]++;
    this.stats.byCategory[classified.category]++;

    // Filter low-quality signals
    if (
      classified.confidence_score < this.classifierConfig.minConfidenceThreshold ||
      classified.risk_score > this.classifierConfig.maxRiskThreshold
    ) {
      this.stats.filtered++;
      console.log(`[AlphaAggregator] Filtered signal from ${classified.source}: confidence=${classified.confidence_score.toFixed(2)}, risk=${classified.risk_score.toFixed(2)}`);
      return;
    }

    if (classified.priority === 'urgent' || classified.priority === 'high') {
      this.stats.highPriority++;
    }

    console.log(`[AlphaAggregator] New ${classified.priority} ${classified.category} signal from ${classified.source}`);
    console.log(`  Tickers: ${classified.tickers.join(', ') || 'none'}`);
    console.log(`  Confidence: ${classified.confidence_score.toFixed(2)}, Risk: ${classified.risk_score.toFixed(2)}`);

    // Emit alpha signal event
    this.eventBus.emit(EventType.ALERT_INFO, {
      title: `Alpha Signal [${classified.priority.toUpperCase()}]`,
      message: `${classified.source}: ${classified.content.substring(0, 100)}...`,
      metadata: {
        source: classified.source,
        category: classified.category,
        priority: classified.priority,
        tickers: classified.tickers,
        confidence: classified.confidence_score,
      },
    });

    // Call handler if set
    if (this.onSignalHandler) {
      try {
        await this.onSignalHandler(classified);
      } catch (error) {
        console.error('[AlphaAggregator] Error in signal handler:', error);
      }
    }
  }

  /**
   * Set up message handlers for all sources
   */
  private setupHandlers(): void {
    // Discord handler
    if (this.discordService) {
      this.discordService.onMessage(async (message: DiscordMessageData) => {
        const signal = DiscordService.toAlphaSignal(message);
        await this.processSignal(signal);
      });
    }

    // Telegram handler
    if (this.telegramService) {
      this.telegramService.onMessage(async (message: TelegramMessageData) => {
        const signal = TelegramService.toAlphaSignal(message);
        await this.processSignal(signal);
      });
    }

    // Reddit handler
    if (this.redditService) {
      this.redditService.onPost(async (post: RedditPostData) => {
        const signal = RedditService.postToAlphaSignal(post);
        await this.processSignal(signal);
      });
    }
  }

  /**
   * Start all source services
   */
  async start(): Promise<void> {
    console.log('[AlphaAggregator] Starting alpha aggregator service...');

    // Set up handlers
    this.setupHandlers();

    // Start all enabled services
    const startPromises: Promise<void>[] = [];

    if (this.discordService) {
      startPromises.push(this.discordService.start());
    }
    if (this.telegramService) {
      startPromises.push(this.telegramService.start());
    }
    if (this.redditService) {
      startPromises.push(this.redditService.start());
    }

    await Promise.all(startPromises);

    this.eventBus.emit(EventType.SYSTEM_STARTED, {
      service: 'alpha-aggregator',
      sources: {
        discord: this.config.discord.enabled,
        telegram: this.config.telegram.enabled,
        reddit: this.config.reddit.enabled,
      },
    });

    console.log('[AlphaAggregator] Service started');
  }

  /**
   * Stop all source services
   */
  async stop(): Promise<void> {
    console.log('[AlphaAggregator] Stopping alpha aggregator service...');

    const stopPromises: Promise<void>[] = [];

    if (this.discordService) {
      stopPromises.push(this.discordService.stop());
    }
    if (this.telegramService) {
      stopPromises.push(this.telegramService.stop());
    }
    if (this.redditService) {
      stopPromises.push(this.redditService.stop());
    }

    await Promise.all(stopPromises);

    console.log('[AlphaAggregator] Service stopped');
  }

  /**
   * Get service statistics
   */
  getStats(): typeof this.stats {
    return { ...this.stats };
  }

  /**
   * Get service status
   */
  getStatus(): {
    discord: { enabled: boolean; connected: boolean };
    telegram: { enabled: boolean; running: boolean };
    reddit: { enabled: boolean; running: boolean };
  } {
    return {
      discord: {
        enabled: this.config.discord.enabled,
        connected: this.discordService?.isServiceConnected() || false,
      },
      telegram: {
        enabled: this.config.telegram.enabled,
        running: this.telegramService?.isServiceRunning() || false,
      },
      reddit: {
        enabled: this.config.reddit.enabled,
        running: this.redditService?.isServiceRunning() || false,
      },
    };
  }

  /**
   * Add watched channel/chat/subreddit
   */
  addWatched(source: AlphaSourceType, identifier: string): void {
    switch (source) {
      case 'discord':
        this.discordService?.addWatchedChannel(identifier);
        break;
      case 'telegram':
        this.telegramService?.addWatchedChat(identifier);
        break;
      case 'reddit':
        this.redditService?.addWatchedSubreddit(identifier);
        break;
    }
  }

  /**
   * Remove watched channel/chat/subreddit
   */
  removeWatched(source: AlphaSourceType, identifier: string): void {
    switch (source) {
      case 'discord':
        this.discordService?.removeWatchedChannel(identifier);
        break;
      case 'telegram':
        this.telegramService?.removeWatchedChat(identifier);
        break;
      case 'reddit':
        this.redditService?.removeWatchedSubreddit(identifier);
        break;
    }
  }

  /**
   * Get all watched items
   */
  getWatched(): {
    discord: string[];
    telegram: string[];
    reddit: string[];
  } {
    return {
      discord: this.discordService?.getWatchedChannels() || [],
      telegram: this.telegramService?.getWatchedChats() || [],
      reddit: this.redditService?.getWatchedSubreddits() || [],
    };
  }

  /**
   * Get Discord bot info
   */
  getDiscordInfo(): ReturnType<DiscordService['getBotInfo']> {
    return this.discordService?.getBotInfo() || null;
  }

  /**
   * Get Discord available channels
   */
  getDiscordChannels(): ReturnType<DiscordService['getAvailableChannels']> {
    return this.discordService?.getAvailableChannels() || [];
  }
}
