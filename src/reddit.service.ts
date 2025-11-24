import fetch from 'node-fetch';
import { EventBus, EventType, eventBus } from './events';
import { AlphaSignalInsert, AlphaSourceType } from './database.types';

interface RedditListingChild<T> {
  data: T;
}

interface RedditListingResponse<T> {
  data?: {
    children?: RedditListingChild<T>[];
  };
}

interface RedditPostApi {
  id: string;
  title: string;
  selftext?: string;
  author?: { name?: string };
  subreddit?: { display_name?: string };
  score: number;
  upvote_ratio: number;
  num_comments: number;
  created_utc: number;
  url: string;
  permalink: string;
  is_video: boolean;
  is_self: boolean;
  thumbnail?: string;
  link_flair_text?: string;
  total_awards_received?: number;
}

interface RedditMeResponse {
  name: string;
  link_karma: number;
  comment_karma: number;
}

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
  private accessToken: string | null = null;
  private tokenExpiresAt = 0;
  private config: RedditConfig;
  private eventBus: EventBus;
  private watchedSubreddits: Set<string>;
  private isRunning: boolean = false;
  private pollInterval: NodeJS.Timeout | null = null;
  private seenPostIds: Set<string> = new Set();
  private onPostHandler: ((post: RedditPostData) => Promise<void>) | null = null;
  private onCommentHandler: ((comment: RedditCommentData) => Promise<void>) | null = null;

  private async ensureToken(): Promise<void> {
    const now = Date.now();
    if (this.accessToken && now < this.tokenExpiresAt - 60_000) {
      return;
    }

    if (!this.config.clientId || !this.config.clientSecret || !this.config.username || !this.config.password) {
      console.warn('[Reddit] Missing credentials; cannot fetch access token');
      this.accessToken = null;
      return;
    }

    const body = new URLSearchParams({
      grant_type: 'password',
      username: this.config.username,
      password: this.config.password,
    });

    const resp = await fetch('https://www.reddit.com/api/v1/access_token', {
      method: 'POST',
      headers: {
        Authorization: 'Basic ' + Buffer.from(`${this.config.clientId}:${this.config.clientSecret}`).toString('base64'),
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': this.config.userAgent || 'AlphaAggregator/1.0.0',
      },
      body,
    });

    if (!resp.ok) {
      console.error('[Reddit] Failed to obtain access token:', resp.status, await resp.text());
      this.accessToken = null;
      return;
    }

    const json = await resp.json() as { access_token?: string; expires_in?: number };
    this.accessToken = json.access_token || null;
    this.tokenExpiresAt = now + (json.expires_in ? json.expires_in * 1000 : 3600_000);
  }

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
    if (this.watchedSubreddits.size === 0) return;
    await this.ensureToken();
    if (!this.accessToken) return;

    try {
      // Combine all watched subreddits into one query
      const subredditStr = Array.from(this.watchedSubreddits).join('+');

      const resp = await fetch(`https://oauth.reddit.com/r/${subredditStr}/new?limit=25`, {
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          'User-Agent': this.config.userAgent || 'AlphaAggregator/1.0.0',
        },
      });

      if (!resp.ok) {
        throw new Error(`Reddit API error: ${resp.status} ${await resp.text()}`);
      }

      const json = await resp.json() as RedditListingResponse<RedditPostApi>;
      const posts = (json?.data?.children || []).map((c: RedditListingChild<RedditPostApi>) => c.data);

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
      await this.ensureToken();

      const me = await this.getAccountInfo();
      console.log(`[Reddit] Logged in as u/${me?.username || 'unknown'}`);

      this.isRunning = true;

      this.eventBus.emit(EventType.ALERT_SUCCESS, {
        title: 'Reddit Connected',
        message: `Logged in as u/${me?.username || 'unknown'}`,
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
    this.accessToken = null;
    this.tokenExpiresAt = 0;
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
    await this.ensureToken();
    if (!this.accessToken) return null;
    try {
      const resp = await fetch('https://oauth.reddit.com/api/v1/me', {
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          'User-Agent': this.config.userAgent || 'AlphaAggregator/1.0.0',
        },
      });

      if (!resp.ok) {
        throw new Error(`Reddit API error: ${resp.status} ${await resp.text()}`);
      }

      const me = await resp.json() as RedditMeResponse;
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
    await this.ensureToken();
    if (!this.accessToken) return [];

    try {
      const params = new URLSearchParams({
        q: query,
        limit: String(options.limit || 25),
        sort: options.sort || 'new',
        t: 'day',
        type: 'link',
      });

      const resp = await fetch(`https://oauth.reddit.com/r/${subreddit}/search?${params.toString()}`, {
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          'User-Agent': this.config.userAgent || 'AlphaAggregator/1.0.0',
        },
      });

      if (!resp.ok) {
        throw new Error(`Reddit API error: ${resp.status} ${await resp.text()}`);
      }

      const json = await resp.json() as RedditListingResponse<RedditPostApi>;
      const posts = (json?.data?.children || []).map((c: RedditListingChild<RedditPostApi>) => c.data);

      return posts.map((post: RedditPostApi) => ({
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
