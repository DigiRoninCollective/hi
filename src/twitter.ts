import { TwitterApi, TweetStream, ETwitterStreamEvent, TweetV2SingleStreamResult } from 'twitter-api-v2';
import { TwitterConfig, TweetData, LaunchEventHandler } from './types';
import { GroqService } from './groq.service';
import { sendTelegramAlert } from './services/notifications/telegram-alert';

export class TwitterStreamService {
  private client: TwitterApi;
  private appClient: TwitterApi;
  private config: TwitterConfig;
  private stream: TweetStream<TweetV2SingleStreamResult> | null = null;
  private onLaunchHandler: LaunchEventHandler | null = null;
  private userIds: Map<string, string> = new Map(); // username -> id
  private groqService: GroqService | null;

  constructor(config: TwitterConfig, groqService: GroqService | null = null) {
    this.config = config;
    this.groqService = groqService;

    // User context client (for user-specific operations)
    this.client = new TwitterApi({
      appKey: config.apiKey,
      appSecret: config.apiSecret,
      accessToken: config.accessToken,
      accessSecret: config.accessSecret,
    });

    // App-only client (for streaming with elevated access)
    this.appClient = new TwitterApi(config.bearerToken);
  }

  /**
   * Set the handler for when a qualifying tweet is detected
   */
  onLaunch(handler: LaunchEventHandler): void {
    this.onLaunchHandler = handler;
  }

  /**
   * Resolve usernames to user IDs
   */
  private async resolveUserIds(): Promise<void> {
    if (this.config.usernames.length === 0) return;

    console.log(`Resolving user IDs for: ${this.config.usernames.join(', ')}`);

    try {
      const users = await this.appClient.v2.usersByUsernames(this.config.usernames);

      if (users.data) {
        for (const user of users.data) {
          this.userIds.set(user.username.toLowerCase(), user.id);
          console.log(`  @${user.username} -> ${user.id}`);
        }
      }

      if (users.errors) {
        for (const error of users.errors) {
          console.warn(`  Warning: Could not find user - ${error.detail}`);
        }
      }
    } catch (error) {
      console.error('Error resolving user IDs:', error);
      throw error;
    }
  }

  /**
   * Build filter rules for the stream
   */
  private buildStreamRules(): { value: string; tag: string }[] {
    const rules: { value: string; tag: string }[] = [];

    // Add rules for specific users
    for (const [username, userId] of this.userIds) {
      rules.push({
        value: `from:${username}`,
        tag: `user:${username}`,
      });
    }

    // Add rules for hashtags
    for (const hashtag of this.config.hashtags) {
      rules.push({
        value: `#${hashtag}`,
        tag: `hashtag:${hashtag}`,
      });
    }

    // Add rule for $LAUNCH pattern (common crypto launch pattern)
    rules.push({
      value: '$LAUNCH',
      tag: 'launch-command',
    });

    return rules;
  }

  /**
   * Setup stream rules
   */
  private async setupStreamRules(): Promise<void> {
    // Get existing rules
    const existingRules = await this.appClient.v2.streamRules();

    // Delete existing rules if any
    if (existingRules.data && existingRules.data.length > 0) {
      console.log('Deleting existing stream rules...');
      await this.appClient.v2.updateStreamRules({
        delete: { ids: existingRules.data.map(rule => rule.id) },
      });
    }

    // Build and add new rules
    const newRules = this.buildStreamRules();

    if (newRules.length === 0) {
      throw new Error('No stream rules configured. Add usernames or hashtags to monitor.');
    }

    console.log('Adding stream rules:');
    for (const rule of newRules) {
      console.log(`  ${rule.tag}: ${rule.value}`);
    }

    await this.appClient.v2.updateStreamRules({
      add: newRules,
    });
  }

  /**
   * Process incoming tweet
   */
  private async processTweet(tweet: TweetV2SingleStreamResult): Promise<void> {
    const tweetData: TweetData = {
      id: tweet.data.id,
      text: tweet.data.text,
      authorId: tweet.data.author_id || 'unknown',
      authorUsername: tweet.includes?.users?.[0]?.username || 'unknown',
      createdAt: new Date(tweet.data.created_at || Date.now()),
      urls: tweet.data?.entities?.urls?.map(u => u.expanded_url).filter(Boolean) as string[] | undefined,
      mediaUrls: tweet.includes?.media
        ?.map(m => m.url || m.preview_image_url)
        .filter(Boolean) as string[] | undefined,
    };

    console.log(`\n[Tweet Received] @${tweetData.authorUsername}:`);
    console.log(`  "${tweetData.text.substring(0, 100)}${tweetData.text.length > 100 ? '...' : ''}"`);

    // Parse the tweet for launch commands
    const { parseLaunchCommand } = await import('./parser.js');
    const commands: any[] = [];

    const parsed = parseLaunchCommand(tweetData);
    if (parsed) {
      commands.push(parsed);
    }

    // Fall back to Groq suggestions when no command is detected
    let groqSuggestions: any[] = [];
    if (this.groqService) {
      groqSuggestions = await this.groqService.suggestLaunchCommands(tweetData);
      if (commands.length === 0 && groqSuggestions.length > 0) {
        for (const suggestion of groqSuggestions) {
          console.log(`[Groq Suggestion] Ticker: ${suggestion.ticker}, Name: ${suggestion.name}`);
          commands.push(suggestion);
        }
      }
    }

    // Keyword triggers for Groq + Telegram alert
    const keywordTriggers = [
      'world record',
      'record',
      'ath',
      'speedrun',
      'trending',
      'viral',
      'breaking',
      'launch',
      'fair launch',
      'stealth',
      'mint',
      'deploy',
      'epic',
      'story',
      'cute',
      'animal',
      'meme',
      'dog',
      'cat',
      'frog',
      'squirrel',
      'hamster',
      'penguin',
      'otter',
      'capybara',
    ];
    const textLower = tweetData.text.toLowerCase();
    const keywordHit = keywordTriggers.some((k) => textLower.includes(k));

    if (keywordHit && groqSuggestions.length > 0) {
      const top = groqSuggestions[0];
      const tweetLink =
        tweetData.authorUsername && tweetData.id
          ? `https://twitter.com/${tweetData.authorUsername}/status/${tweetData.id}`
          : '';
      const alertText = [
        `🚀 *Groq Suggestion*`,
        `@${tweetData.authorUsername || 'unknown'}: ${tweetData.text.substring(0, 180)}`,
        `*Ticker:* ${top.ticker}`,
        `*Name:* ${top.name}`,
        top.description ? `*Reason:* ${top.description.substring(0, 120)}` : '',
        tweetLink,
      ]
        .filter(Boolean)
        .join('\n');
      await sendTelegramAlert(alertText);
    }

    if (commands.length > 0 && this.onLaunchHandler) {
      for (const cmd of commands) {
        console.log(`[Launch Command Detected] Ticker: ${cmd.ticker}, Name: ${cmd.name}`);
        await this.onLaunchHandler(cmd, tweetData);
        // Respect backpressure lightly
        await new Promise(res => setTimeout(res, 100));
      }
    }
  }

  /**
   * Start the Twitter stream
   */
  async start(): Promise<void> {
    console.log('Starting Twitter stream service...');

    // Resolve user IDs first
    await this.resolveUserIds();

    // Setup stream rules
    await this.setupStreamRules();

    // Start the filtered stream
    this.stream = await this.appClient.v2.searchStream({
      'tweet.fields': ['created_at', 'author_id', 'text', 'entities', 'attachments'],
      'user.fields': ['username'],
      'media.fields': ['url', 'preview_image_url', 'type'],
      expansions: ['author_id', 'attachments.media_keys'],
    });

    // Enable auto-reconnect
    this.stream.autoReconnect = true;

    // Handle events
    this.stream.on(ETwitterStreamEvent.Data, async (tweet) => {
      try {
        await this.processTweet(tweet);
      } catch (error) {
        console.error('Error processing tweet:', error);
      }
    });

    this.stream.on(ETwitterStreamEvent.Error, (error) => {
      console.error('Stream error:', error);
    });

    this.stream.on(ETwitterStreamEvent.Connected, () => {
      console.log('Twitter stream connected!');
    });

    this.stream.on(ETwitterStreamEvent.Reconnected, () => {
      console.log('Twitter stream reconnected!');
    });

    this.stream.on(ETwitterStreamEvent.ConnectionClosed, () => {
      console.log('Twitter stream connection closed.');
    });

    console.log('Twitter stream started. Listening for tweets...');
  }

  /**
   * Stop the Twitter stream
   */
  async stop(): Promise<void> {
    if (this.stream) {
      this.stream.close();
      this.stream = null;
      console.log('Twitter stream stopped.');
    }
  }
}
