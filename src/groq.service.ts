import fetch from 'node-fetch';
import { GroqConfig, ParsedLaunchCommand, TweetData, GroqAnalysisResult } from './types';

interface GroqSuggestionResponse {
  ticker?: string;
  name?: string;
  reason?: string;
  website?: string;
  twitter?: string;
  imageUrl?: string;
  bannerUrl?: string;
  avatarUrl?: string;
}

interface GroqAlertResponse {
  isAlert?: boolean | string;
  confidence?: number | string;
  reason?: string;
  keywords?: Array<string>;
  sentiment?: string;
}

/** 
 * Lightweight Groq client for inferring token name/ticker from tweet text.
 */
export class GroqService {
  private config: GroqConfig;

  constructor(config: GroqConfig) {
    this.config = config;
  }

  /**
   * Ask Groq to suggest token name/ticker(s) from a tweet.
   */
  async suggestLaunchCommands(tweet: TweetData): Promise<ParsedLaunchCommand[]> {
    if (!this.config.enabled || !this.config.apiKey) {
      return [];
    }

    const models: string[] = [];
    if (this.config.model) models.push(this.config.model);
    if (this.config.secondaryModel && this.config.secondaryModel !== this.config.model) {
      models.push(this.config.secondaryModel);
    }

    // Ensure we don't exceed requested suggestion count
    const maxSuggestions = Math.max(1, this.config.suggestionCount || 1);

    const requests = models.slice(0, maxSuggestions).map(model =>
      this.fetchSuggestion(tweet, model).catch(() => null)
    );

    const results = await Promise.all(requests);

    // Deduplicate by ticker
    const seen = new Set<string>();
    const commands: ParsedLaunchCommand[] = [];
    for (const res of results) {
      if (res && !seen.has(res.ticker)) {
        seen.add(res.ticker);
        commands.push(res);
      }
    }

    return commands.slice(0, maxSuggestions);
  }

  private async fetchSuggestion(tweet: TweetData, model: string): Promise<ParsedLaunchCommand | null> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);

    try {
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.config.apiKey}`,
        },
        body: JSON.stringify({
          model,
          temperature: this.config.temperature,
          max_tokens: this.config.maxTokens,
          messages: [
            {
              role: 'system',
              content:
                'You extract potential crypto token launch metadata from tweets. ' +
                'Use only the provided tweet text and the provided URLs/media if any. ' +
                'Return JSON only with keys: ' +
                'ticker (2-10 uppercase letters, no $), ' +
                'name (short friendly token name), ' +
                'reason (why this fits), ' +
                'website (choose from provided urls if any match; else empty), ' +
                'twitter (handle only, no @, if text implies; else empty), ' +
                'imageUrl (pfp suggestion url chosen from provided media if available; else empty), ' +
                'bannerUrl (optional url from provided media/urls; else empty), ' +
                'avatarUrl (optional url from provided media/urls; else empty). ' +
                'Do not invent URLs; prefer the provided ones. ' +
                'If no reasonable suggestion, return an empty JSON object.',
            },
            {
              role: 'user',
              content: [
                `Tweet: "${tweet.text}"`,
                tweet.urls?.length ? `URLs: ${tweet.urls.join(', ')}` : 'URLs: none provided',
                tweet.mediaUrls?.length ? `Media: ${tweet.mediaUrls.join(', ')}` : 'Media: none provided',
              ].join('\n'),
            },
          ],
          response_format: { type: 'json_object' },
        }),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!response.ok) {
        const text = await response.text();
        console.error('Groq suggestion request failed:', response.status, text);
        return null;
      }

      const json = await response.json();
      const content = json.choices?.[0]?.message?.content;
      if (!content) {
        return null;
      }

      const parsed = this.safeJsonParse<GroqSuggestionResponse>(content);
      if (!parsed || !parsed.ticker || !parsed.name) {
        return null;
      }

      const ticker = parsed.ticker.trim().replace(/^\$/, '').toUpperCase();
      const name = parsed.name.trim();

      if (!ticker || ticker.length < 2 || ticker.length > 10 || !/^[A-Z0-9]+$/.test(ticker)) {
        return null;
      }

      return {
        ticker,
        name,
        description: parsed.reason,
        website: parsed.website || undefined,
        twitterHandle: parsed.twitter || undefined,
        imageUrl: parsed.imageUrl || parsed.avatarUrl || undefined,
        bannerUrl: parsed.bannerUrl || undefined,
        avatarUrl: parsed.avatarUrl || parsed.imageUrl || undefined,
        tweetId: tweet.id,
        tweetAuthor: tweet.authorUsername,
        tweetText: tweet.text,
      };
    } catch (error) {
      if ((error as Error).name !== 'AbortError') {
        console.error('Groq suggestion error:', error);
      }
      return null;
    }
  }

  private safeJsonParse<T = unknown>(content: string): T | null {
    try {
      return JSON.parse(content) as T;
    } catch {
      return null;
    }
  }

  /**
   * Structured tweet analysis for decisioning
   */
  async analyzeTweetDetailed(tweet: TweetData & { authorFollowers?: number; authorVerified?: boolean; language?: string; urls?: string[]; mediaUrls?: string[] }): Promise<GroqAnalysisResult | null> {
    if (!this.config.enabled || !this.config.apiKey) {
      return null;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    const clamp01 = (n: number): number => Math.max(0, Math.min(1, n));
    const toBool = (v: any): boolean => {
      if (typeof v === 'boolean') return v;
      if (typeof v === 'string') return v.toLowerCase() === 'true' || v === '1';
      return false;
    };
    const toArray = (v: any): string[] => (Array.isArray(v) ? v.map(String).filter(Boolean) : []);

    try {
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.config.apiKey}`,
        },
        body: JSON.stringify({
          model: this.config.model || 'llama-3.3-70b-versatile',
          temperature: this.config.temperature ?? 0.25,
          max_tokens: Math.min(800, this.config.maxTokens || 800),
          messages: [
            {
              role: 'system',
              content:
                'You are a concise crypto trading signal evaluator. ' +
                'Return ONLY JSON with fields: shouldLaunch (bool), confidence (0-1), score1to10 (1-10), reason (string), ' +
                'tokenName (string), tokenTicker (string, 2-8 uppercase letters/numbers), theme (string), tone (string), ' +
                'keywordsDetected (string[]), riskFlags (string[]), nsfwOrSensitive (bool). ' +
                'Be strict: avoid copying existing brand names or tickers unless clearly generic. Prefer safe, non-infringing names.',
            },
            {
              role: 'user',
              content: [
                `Tweet: "${tweet.text}"`,
                `Author: @${tweet.authorUsername}`,
                `Followers: ${tweet.authorFollowers ?? 'unknown'}`,
                `Verified: ${tweet.authorVerified ? 'yes' : 'no'}`,
                `Language: ${tweet.language || 'unknown'}`,
                `URLs: ${tweet.urls?.length ? tweet.urls.join(', ') : 'none'}`,
                `Media count: ${tweet.mediaUrls?.length ?? 0}`,
              ].join('\n'),
            },
          ],
          response_format: { type: 'json_object' },
        }),
        signal: controller.signal as any,
      });

      clearTimeout(timeout);

      if (!response.ok) {
        const text = await response.text();
        console.error('Groq detailed analysis failed:', response.status, text);
        return null;
      }

      const json = await response.json();
      const content = json.choices?.[0]?.message?.content;
      if (!content) return null;

      const parsed = this.safeJsonParse<any>(content);
      if (!parsed) return null;

      const confidenceRaw = Number(parsed.confidence ?? parsed.confidence_score ?? 0);
      const scoreRaw = Number(parsed.score1to10 ?? parsed.score ?? (parsed.confidence ? parsed.confidence * 10 : 0));

      return {
        shouldLaunch: toBool(parsed.shouldLaunch) || (toBool(parsed.isLaunch) && confidenceRaw >= 0.5),
        confidence: clamp01(confidenceRaw),
        score1to10: Math.max(1, Math.min(10, Math.round(scoreRaw || 0))),
        reason: String(parsed.reason || 'No reason provided'),
        tokenName: String(parsed.tokenName || parsed.name || '').slice(0, 80),
        tokenTicker: String(parsed.tokenTicker || parsed.ticker || '').replace(/[^A-Z0-9]/gi, '').toUpperCase().slice(0, 8),
        theme: String(parsed.theme || 'general'),
        tone: String(parsed.tone || 'neutral'),
        keywordsDetected: toArray(parsed.keywordsDetected || parsed.keywords),
        riskFlags: toArray(parsed.riskFlags || parsed.risks),
        nsfwOrSensitive: toBool(parsed.nsfwOrSensitive || parsed.nsfw || parsed.sensitive),
      };
    } catch (error) {
      if ((error as Error).name !== 'AbortError') {
        console.error('Groq detailed analysis error:', error);
      }
      return null;
    }
  }

  /**
   * Analyze a tweet for trading opportunities and alert worthiness
   * Returns alert if tweet matches trigger keywords and quality score
   */
  async analyzeTweetForAlert(tweet: TweetData): Promise<{
    isAlert: boolean;
    confidence: number;
    reason: string;
    keywords: string[];
    sentiment: 'bullish' | 'neutral' | 'bearish';
  } | null> {
    if (!this.config.enabled || !this.config.apiKey) {
      return null;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    try {
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.config.apiKey}`,
        },
        body: JSON.stringify({
          model: this.config.model || 'llama-3.3-70b-versatile',
          temperature: 0.3,
          max_tokens: 500,
          messages: [
            {
              role: 'system',
              content:
                'You are a crypto trading signal analyzer. Analyze tweets for trading opportunities and alert worthiness. ' +
                'Look for: token launches, presales, partnerships, listings, technical analysis, whale movements, regulatory news, security audits. ' +
                'Return JSON with: isAlert (boolean), confidence (0-1), reason (string), keywords (array), sentiment (bullish/neutral/bearish). ' +
                'Only alert=true if tweet contains CLEAR trading signal or opportunity with confidence >= 0.6.',
            },
            {
              role: 'user',
              content:
                `Analyze this tweet for trading alerts:\n\n` +
                `Author: @${tweet.authorUsername}\n` +
                `Text: "${tweet.text}"\n` +
                `URLs: ${tweet.urls?.length ? tweet.urls.join(', ') : 'none'}\n` +
                `\nRespond with JSON only.`,
            },
          ],
          response_format: { type: 'json_object' },
        }),
        signal: controller.signal as any,
      });

      clearTimeout(timeout);

      if (!response.ok) {
        const text = await response.text();
        console.error('Groq alert analysis failed:', response.status, text);
        return null;
      }

      const json = await response.json();
      const content = json.choices?.[0]?.message?.content;
      if (!content) {
        return null;
      }

      const parsed = this.safeJsonParse<GroqAlertResponse>(content);
      if (!parsed) {
        return null;
      }

      return {
        isAlert: parsed.isAlert === true || (typeof parsed.isAlert === 'string' && parsed.isAlert.toLowerCase() === 'true'),
        confidence: Math.min(1, Math.max(0, Number(parsed.confidence) || 0)),
        reason: String(parsed.reason || 'No reason provided'),
        keywords: Array.isArray(parsed.keywords) ? parsed.keywords.map(String) : [],
        sentiment: (['bullish', 'neutral', 'bearish'].includes(String(parsed.sentiment)?.toLowerCase())
          ? String(parsed.sentiment).toLowerCase()
          : 'neutral') as 'bullish' | 'neutral' | 'bearish',
      };
    } catch (error) {
      if ((error as Error).name !== 'AbortError') {
        console.error('Groq tweet alert analysis error:', error);
      }
      return null;
    }
  }
}
