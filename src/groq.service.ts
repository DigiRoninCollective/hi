import fetch from 'node-fetch';
import { GroqConfig, ParsedLaunchCommand, TweetData } from './types';

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

      const parsed = this.safeJsonParse(content);
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

  private safeJsonParse(content: string): GroqSuggestionResponse | null {
    try {
      return JSON.parse(content);
    } catch {
      return null;
    }
  }
}
