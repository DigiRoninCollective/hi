import { GroqAnalysisResult, LaunchCandidate, TweetData } from './types';

interface TweetMeta extends TweetData {
  tweetUrl?: string;
  authorFollowers?: number;
  authorVerified?: boolean;
  language?: string;
}

export function buildLaunchCandidate(
  tweet: TweetMeta,
  analysis: GroqAnalysisResult,
  options?: { accountProfileId?: string; tradingWalletId?: string }
): LaunchCandidate {
  return {
    tweetId: tweet.id,
    tweetUrl: tweet.tweetUrl,
    tweetText: tweet.text,
    authorId: tweet.authorId,
    authorHandle: tweet.authorUsername,
    authorFollowers: tweet.authorFollowers,
    authorVerified: tweet.authorVerified,
    createdAt: tweet.createdAt instanceof Date ? tweet.createdAt.toISOString() : String(tweet.createdAt),
    urls: tweet.urls,
    mediaUrls: tweet.mediaUrls,
    language: tweet.language,
    analysis,
    source: 'twitter',
    accountProfileId: options?.accountProfileId,
    tradingWalletId: options?.tradingWalletId,
  };
}
