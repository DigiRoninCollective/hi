import Snoowrap from 'snoowrap';
import { EventBus, EventType, eventBus } from './events';
import { AlphaSignalInsert, AlphaSourceType } from './database.types';

export interface RedditConfig {
  clientId?: string;
  clientSecret?: string;
  username?: string;
  password?: string;
  userAgent?: string;
  watchedSubreddits?: string[];
  pollIntervalMs?: number;
  enabled: boolean;
}

export interface RedditPostData {
  id: string;
  title: string;
  content: string;
  authorUsername: string;
  subreddit: string;
  score: number;
  upvoteRatio: number;
  numComments: number;
  createdAt: Date;
  url: string;
  permalink: string;
  isVideo: boolean;
  isSelf: boolean;
  thumbnail: string | null;
  flair: string | null;
  awards: number;
}

export interface RedditCommentData {
  id: string;
  postId: string;
  content: string;
  authorUsername: string;
  subreddit: string;
  score: number;
  createdAt: Date;
  permalink: string;
  parentId: string | null;
  depth: number;
}

/**
 * Reddit monitoring service for alpha signal aggregation
 */
export class RedditService {
  private reddit: Snoowrap | null = null;
  private config: RedditConfig;
  private eventBus: EventBus;
  private watchedSubreddits: Set<string>;
  private isRunning: boolean = false;
  private pollInterval: NodeJS.Timeout | null = null;
  private seenPostIds: Set<string> = new Set();
  private onPostHandler: ((post: RedditPostData) => Promise<void>) | null = null;
  private onCommentHandler: ((comment: RedditCommentData) => Promise<void>) | null = null;

  constructor(config: RedditConfig, bus: EventBus = eventBus) {
    this.config = config;
    this.eventBus = bus;
    this.watchedSubreddits = new Set(config.watchedSubreddits || []);
  }

  /**
   * Set handler for incoming posts
   */
  onPost(handler: (post: RedditPostData) => Promise<void>): void {
    this.onPostHandler = handler;
  }

  /**
   * Set handler for incoming comments
   */
  onComment(handler: (comment: RedditCommentData) => Promise<void>): void {
    this.onCommentHandler = handler;
  }

  /**
   * Add subreddit to watch list
   */
  addWatchedSubreddit(subreddit: string): void {
    // Normalize subreddit name (remove r/ prefix if present)
    const normalized = subreddit.replace(/^r\//, '').toLowerCase();
    this.watchedSubreddits.add(normalized);
    console.log(`[Reddit] Added watched subreddit: r/${normalized}`);
  }

  /**
   * Remove subreddit from watch list
   */
  removeWatchedSubreddit(subreddit: string): void {
    const normalized = subreddit.replace(/^r\//, '').toLowerCase();
    this.watchedSubreddits.delete(normalized);
    console.log(`[Reddit] Removed watched subreddit: r/${normalized}`);
  }

  /**
   * Get all watched subreddits
   */
  getWatchedSubreddits(): string[] {
    return Array.from(this.watchedSubreddits);
  }

  /**
   * Fetch new posts from watched subreddits
   */
  private async fetchNewPosts(): Promise<void> {
    if (!this.reddit || this.watchedSubreddits.size === 0) return;

    try {
      // Combine all watched subreddits into one query
      const subredditStr = Array.from(this.watchedSubreddits).join('+');

      const posts = await this.reddit.getSubreddit(subredditStr).getNew({ limit: 25 });

      for (const post of posts) {
        // Skip already seen posts
        if (this.seenPostIds.has(post.id)) continue;
        this.seenPostIds.add(post.id);

        // Keep seen set from growing unbounded
        if (this.seenPostIds.size > 10000) {
          const entries = Array.from(this.seenPostIds);
          this.seenPostIds = new Set(entries.slice(-5000));
        }

        const postData: RedditPostData = {
          id: post.id,
          title: post.title,
          content: post.selftext || '',
          authorUsername: post.author?.name || '[deleted]',
          subreddit: post.subreddit?.display_name || 'unknown',
          score: post.score,
          upvoteRatio: post.upvote_ratio,
          numComments: post.num_comments,
          createdAt: new Date(post.created_utc * 1000),
          url: post.url,
          permalink: `https://reddit.com${post.permalink}`,
          isVideo: post.is_video,
          isSelf: post.is_self,
          thumbnail: post.thumbnail && post.thumbnail !== 'self' && post.thumbnail !== 'default'
            ? post.thumbnail
            : null,
          flair: post.link_flair_text || null,
          awards: (post as any).total_awards_received || 0,
        };

        console.log(`[Reddit] New post in r/${postData.subreddit}: ${postData.title.substring(0, 50)}...`);

        // Emit event
        this.eventBus.emit(EventType.ALERT_INFO, {
          title: 'Reddit Post',
          message: `r/${postData.subreddit}: ${postData.title.substring(0, 50)}...`,
          metadata: { source: 'reddit', postId: postData.id },
        });

        // Call handler if set
        if (this.onPostHandler) {
          try {
            await this.onPostHandler(postData);
          } catch (error) {
            console.error('[Reddit] Error in post handler:', error);
          }
        }
      }
    } catch (error) {
      console.error('[Reddit] Error fetching posts:', error);
      this.eventBus.emit(EventType.SYSTEM_ERROR, {
        source: 'reddit',
        error: `Error fetching posts: ${error}`,
      });
    }
  }

  /**
   * Convert Reddit post to alpha signal format
   */
  static postToAlphaSignal(post: RedditPostData): AlphaSignalInsert {
    return {
      source: 'reddit' as AlphaSourceType,
      source_id: post.id,
      source_channel: `r/${post.subreddit}`,
      source_author: post.authorUsername,
      source_author_id: post.authorUsername,
      content: post.title + (post.content ? '\n\n' + post.content : ''),
      content_raw: {
        title: post.title,
        selftext: post.content,
        url: post.url,
        permalink: post.permalink,
        isVideo: post.isVideo,
        isSelf: post.isSelf,
        flair: post.flair,
      },
      has_media: !post.isSelf || post.isVideo,
      media_urls: !post.isSelf && post.url ? [post.url] : null,
      engagement_score: post.score,
      reaction_count: Math.round(post.score * post.upvoteRatio),
      reply_count: post.numComments,
      source_created_at: post.createdAt.toISOString(),
    };
  }

  /**
   * Convert Reddit comment to alpha signal format
   */
  static commentToAlphaSignal(comment: RedditCommentData): AlphaSignalInsert {
    return {
      source: 'reddit' as AlphaSourceType,
      source_id: `comment_${comment.id}`,
      source_channel: `r/${comment.subreddit}`,
      source_author: comment.authorUsername,
      source_author_id: comment.authorUsername,
      content: comment.content,
      content_raw: {
        postId: comment.postId,
        parentId: comment.parentId,
        depth: comment.depth,
        permalink: comment.permalink,
      },
      has_media: false,
      engagement_score: comment.score,
      source_created_at: comment.createdAt.toISOString(),
    };
  }

  /**
   * Start the Reddit monitoring service
   */
  async start(): Promise<void> {
    if (!this.config.enabled) {
      console.log('[Reddit] Service disabled, skipping start');
      return;
    }

    if (!this.config.clientId || !this.config.clientSecret) {
      console.log('[Reddit] No API credentials configured, skipping start');
      return;
    }

    console.log('[Reddit] Starting Reddit service...');

    try {
      // Create Snoowrap instance
      this.reddit = new Snoowrap({
        userAgent: this.config.userAgent || 'AlphaAggregator/1.0.0',
        clientId: this.config.clientId,
        clientSecret: this.config.clientSecret,
        username: this.config.username,
        password: this.config.password,
      });

      // Configure rate limiting
      this.reddit.config({
        requestDelay: 1000, // 1 request per second
        continueAfterRatelimitError: true,
        maxRetryAttempts: 3,
      });

      // Test connection
      const me = await (this.reddit as any).getMe();
      console.log(`[Reddit] Logged in as u/${me.name}`);

      this.isRunning = true;

      this.eventBus.emit(EventType.ALERT_SUCCESS, {
        title: 'Reddit Connected',
        message: `Logged in as u/${me.name}`,
      });

      // Start polling for new posts
      const pollIntervalMs = this.config.pollIntervalMs || 30000; // Default 30 seconds
      console.log(`[Reddit] Polling every ${pollIntervalMs / 1000} seconds`);
      console.log(`[Reddit] Watching subreddits: ${Array.from(this.watchedSubreddits).join(', ') || 'none'}`);

      // Initial fetch
      await this.fetchNewPosts();

      // Set up polling interval
      this.pollInterval = setInterval(async () => {
        await this.fetchNewPosts();
      }, pollIntervalMs);

    } catch (error) {
      console.error('[Reddit] Failed to start:', error);
      this.eventBus.emit(EventType.SYSTEM_ERROR, {
        source: 'reddit',
        error: `Failed to start: ${error}`,
      });
      throw error;
    }
  }

  /**
   * Stop the Reddit monitoring service
   */
  async stop(): Promise<void> {
    console.log('[Reddit] Stopping Reddit service...');
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
    this.reddit = null;
    this.isRunning = false;
    console.log('[Reddit] Service stopped');
  }

  /**
   * Check if service is running
   */
  isServiceRunning(): boolean {
    return this.isRunning;
  }

  /**
   * Get account info
   */
  async getAccountInfo(): Promise<{ username: string; karma: number } | null> {
    if (!this.reddit) return null;
    try {
      const me = await (this.reddit as any).getMe();
      return {
        username: me.name,
        karma: me.link_karma + me.comment_karma,
      };
    } catch (error) {
      console.error('[Reddit] Error getting account info:', error);
      return null;
    }
  }

  /**
   * Search posts in a subreddit
   */
  async searchPosts(
    subreddit: string,
    query: string,
    options: { limit?: number; sort?: 'relevance' | 'new' | 'hot' | 'top' } = {}
  ): Promise<RedditPostData[]> {
    if (!this.reddit) return [];

    try {
      const posts = await (this.reddit as any).getSubreddit(subreddit).search({
        query,
        limit: options.limit || 25,
        sort: options.sort || 'new',
        time: 'day',
      } as any);

      return posts.map((post: any) => ({
        id: post.id,
        title: post.title,
        content: post.selftext || '',
        authorUsername: post.author?.name || '[deleted]',
        subreddit: post.subreddit?.display_name || 'unknown',
        score: post.score,
        upvoteRatio: post.upvote_ratio,
        numComments: post.num_comments,
        createdAt: new Date(post.created_utc * 1000),
        url: post.url,
        permalink: `https://reddit.com${post.permalink}`,
        isVideo: post.is_video,
        isSelf: post.is_self,
        thumbnail: post.thumbnail && post.thumbnail !== 'self' && post.thumbnail !== 'default'
          ? post.thumbnail
          : null,
        flair: post.link_flair_text || null,
        awards: (post as any).total_awards_received || 0,
      }));
    } catch (error) {
      console.error('[Reddit] Error searching posts:', error);
      return [];
    }
  }
}
