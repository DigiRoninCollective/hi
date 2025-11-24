import { TwitterApi } from 'twitter-api-v2';
import { TweetData } from './types';

export interface EnrichedTweetData extends TweetData {
  authorName?: string;
  authorFollowers?: number;
  authorVerified?: boolean;
  authorProfileImage?: string;
  tweetLinks?: {
    url: string;
    title?: string;
    isWebsite?: boolean;
  }[];
  tweetImages?: {
    url: string;
    type?: string;
  }[];
  hasWebsiteLink?: boolean;
  websiteUrls?: string[];
}

/**
 * Service to enrich tweet data with additional metadata
 */
export class TweetMetadataService {
  private appClient: TwitterApi;

  constructor(bearerToken: string) {
    this.appClient = new TwitterApi(bearerToken);
  }

  /**
   * Extract website URLs from tweet data (filters out twitter.com, t.co shortlinks expanded)
   */
  private extractWebsiteUrls(tweetData: TweetData): string[] {
    if (!tweetData.urls || tweetData.urls.length === 0) {
      return [];
    }

    return tweetData.urls.filter(url => {
      if (!url) return false;
      // Filter out twitter/x domain links
      const domain = new URL(url).hostname.toLowerCase();
      return !domain.includes('twitter.com') && !domain.includes('x.com') && !domain.includes('t.co');
    });
  }

  /**
   * Parse media URLs and categorize them
   */
  private parseMediaUrls(mediaUrls?: string[]): { url: string; type?: string }[] {
    if (!mediaUrls || mediaUrls.length === 0) {
      return [];
    }

    return mediaUrls.map(url => {
      const type = this.detectMediaType(url);
      return { url, type };
    });
  }

  /**
   * Detect media type from URL
   */
  private detectMediaType(url: string): string {
    if (url.includes('video') || url.includes('.mp4') || url.includes('.webm')) {
      return 'video';
    }
    if (url.includes('gif')) {
      return 'gif';
    }
    return 'image';
  }

  /**
   * Fetch user information from Twitter API
   */
  async fetchUserInfo(
    userId: string,
    username: string
  ): Promise<{ name?: string; followers?: number; verified?: boolean; profileImage?: string } | null> {
    try {
      const user = await this.appClient.v2.user(userId, {
        'user.fields': ['public_metrics', 'verified', 'profile_image_url', 'name'],
      });

      if (user.data) {
        return {
          name: user.data.name,
          followers: user.data.public_metrics?.followers_count,
          verified: user.data.verified,
          profileImage: user.data.profile_image_url,
        };
      }
    } catch (error) {
      console.error(`Failed to fetch user info for ${username}:`, error);
    }
    return null;
  }

  /**
   * Enrich tweet data with additional metadata
   */
  async enrichTweet(tweetData: TweetData): Promise<EnrichedTweetData> {
    const enriched: EnrichedTweetData = { ...tweetData };

    // Extract website URLs
    const websiteUrls = this.extractWebsiteUrls(tweetData);
    if (websiteUrls.length > 0) {
      enriched.websiteUrls = websiteUrls;
      enriched.hasWebsiteLink = true;
    }

    // Parse media URLs
    if (tweetData.mediaUrls && tweetData.mediaUrls.length > 0) {
      enriched.tweetImages = this.parseMediaUrls(tweetData.mediaUrls);
    }

    // Convert URLs to link objects
    if (tweetData.urls && tweetData.urls.length > 0) {
      enriched.tweetLinks = tweetData.urls.map(url => ({
        url,
        isWebsite: websiteUrls.includes(url),
      }));
    }

    // Fetch user information
    if (tweetData.authorId && tweetData.authorUsername) {
      try {
        const userInfo = await this.fetchUserInfo(tweetData.authorId, tweetData.authorUsername);
        if (userInfo) {
          enriched.authorName = userInfo.name;
          enriched.authorFollowers = userInfo.followers;
          enriched.authorVerified = userInfo.verified;
          enriched.authorProfileImage = userInfo.profileImage;
        }
      } catch (error) {
        console.error('Failed to enrich tweet with user info:', error);
      }
    }

    return enriched;
  }

  /**
   * Enrich multiple tweets
   */
  async enrichTweets(tweets: TweetData[]): Promise<EnrichedTweetData[]> {
    return Promise.all(tweets.map(tweet => this.enrichTweet(tweet)));
  }

  /**
   * Format enriched tweet data for Groq analysis
   */
  formatForGroqAnalysis(enriched: EnrichedTweetData): {
    text: string;
    urls: string[];
    mediaUrls: string[];
    authorName?: string;
    authorFollowers?: number;
    authorVerified?: boolean;
    websiteUrls?: string[];
  } {
    return {
      text: enriched.text,
      urls: enriched.tweetLinks?.map(l => l.url) || [],
      mediaUrls: enriched.tweetImages?.map(img => img.url) || [],
      authorName: enriched.authorName,
      authorFollowers: enriched.authorFollowers,
      authorVerified: enriched.authorVerified,
      websiteUrls: enriched.websiteUrls,
    };
  }
}