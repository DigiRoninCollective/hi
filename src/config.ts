import dotenv from 'dotenv';
import { Config } from './types';
import { SSEServerConfig } from './sse-server';
import { AlertConfig } from './alerting';
import { ClassifierConfig } from './classifier';
import { AlphaAggregatorConfig, AlphaClassifierConfig } from './alpha-aggregator.service';
import { DiscordConfig } from './discord.service';
import { TelegramConfig } from './telegram.service';
import { RedditConfig } from './reddit.service';

dotenv.config();

function getEnvVar(key: string, required: boolean = true): string {
  const value = process.env[key];
  if (required && !value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value || '';
}

function getEnvList(key: string): string[] {
  const value = process.env[key];
  if (!value) return [];
  return value.split(',').map(s => s.trim()).filter(s => s.length > 0);
}

function getEnvBool(key: string, defaultValue: boolean = false): boolean {
  const value = process.env[key];
  if (!value) return defaultValue;
  return value.toLowerCase() === 'true' || value === '1';
}

export interface FullConfig extends Config {
  sse: SSEServerConfig;
  alerting: AlertConfig;
  classifier: Partial<ClassifierConfig>;
  alpha: AlphaAggregatorConfig;
}

export function loadConfig(): FullConfig {
  return {
    twitter: {
      apiKey: getEnvVar('TWITTER_API_KEY'),
      apiSecret: getEnvVar('TWITTER_API_SECRET'),
      accessToken: getEnvVar('TWITTER_ACCESS_TOKEN'),
      accessSecret: getEnvVar('TWITTER_ACCESS_SECRET'),
      bearerToken: getEnvVar('TWITTER_BEARER_TOKEN'),
      usernames: getEnvList('TWITTER_USERNAMES'),
      hashtags: getEnvList('TWITTER_HASHTAGS'),
    },
    solana: {
      privateKey: getEnvVar('SOLANA_PRIVATE_KEY'),
      rpcUrl: getEnvVar('SOLANA_RPC_URL', false) || 'https://api.mainnet-beta.solana.com',
    },
    pumpPortal: {
      apiKey: getEnvVar('PUMPPORTAL_API_KEY'),
    },
    tokenDefaults: {
      decimals: parseInt(getEnvVar('DEFAULT_TOKEN_DECIMALS', false) || '6', 10),
      initialBuySol: parseFloat(getEnvVar('DEFAULT_INITIAL_BUY_SOL', false) || '0.1'),
    },
    sse: {
      port: parseInt(getEnvVar('SSE_PORT', false) || '3000', 10),
      corsOrigin: getEnvVar('SSE_CORS_ORIGIN', false) || '*',
    },
    alerting: {
      enabled: getEnvBool('ALERTING_ENABLED', true),
      webhookUrl: getEnvVar('ALERT_WEBHOOK_URL', false) || undefined,
      discordWebhook: getEnvVar('DISCORD_WEBHOOK_URL', false) || undefined,
      telegramBotToken: getEnvVar('TELEGRAM_BOT_TOKEN', false) || undefined,
      telegramChatId: getEnvVar('TELEGRAM_CHAT_ID', false) || undefined,
      consoleOutput: getEnvBool('ALERT_CONSOLE_OUTPUT', true),
    },
    classifier: {
      minConfidenceThreshold: parseFloat(getEnvVar('CLASSIFIER_MIN_CONFIDENCE', false) || '0.6'),
      maxRiskThreshold: parseFloat(getEnvVar('CLASSIFIER_MAX_RISK', false) || '0.7'),
      trustedUsers: getEnvList('TRUSTED_USERS'),
    },
    alpha: {
      discord: {
        enabled: getEnvBool('ALPHA_DISCORD_ENABLED', false),
        botToken: getEnvVar('ALPHA_DISCORD_BOT_TOKEN', false) || undefined,
        watchedChannelIds: getEnvList('ALPHA_DISCORD_CHANNELS'),
      },
      telegram: {
        enabled: getEnvBool('ALPHA_TELEGRAM_ENABLED', false),
        botToken: getEnvVar('ALPHA_TELEGRAM_BOT_TOKEN', false) || undefined,
        watchedChatIds: getEnvList('ALPHA_TELEGRAM_CHATS'),
        polling: getEnvBool('ALPHA_TELEGRAM_POLLING', true),
      },
      reddit: {
        enabled: getEnvBool('ALPHA_REDDIT_ENABLED', false),
        clientId: getEnvVar('ALPHA_REDDIT_CLIENT_ID', false) || undefined,
        clientSecret: getEnvVar('ALPHA_REDDIT_CLIENT_SECRET', false) || undefined,
        username: getEnvVar('ALPHA_REDDIT_USERNAME', false) || undefined,
        password: getEnvVar('ALPHA_REDDIT_PASSWORD', false) || undefined,
        userAgent: getEnvVar('ALPHA_REDDIT_USER_AGENT', false) || 'AlphaAggregator/1.0.0',
        watchedSubreddits: getEnvList('ALPHA_REDDIT_SUBREDDITS'),
        pollIntervalMs: parseInt(getEnvVar('ALPHA_REDDIT_POLL_INTERVAL', false) || '30000', 10),
      },
      classifier: {
        launchKeywords: getEnvList('ALPHA_LAUNCH_KEYWORDS').length > 0
          ? getEnvList('ALPHA_LAUNCH_KEYWORDS')
          : ['launch', 'launching', 'stealth', 'fair launch', 'presale', 'mint', 'deploy', 'gem', 'alpha', 'call'],
        tickerPattern: /\$([A-Z]{2,10})\b/gi,
        contractPattern: /\b([A-HJ-NP-Za-km-z1-9]{32,44})\b/g,
        spamKeywords: getEnvList('ALPHA_SPAM_KEYWORDS').length > 0
          ? getEnvList('ALPHA_SPAM_KEYWORDS')
          : ['giveaway', 'airdrop', 'free', 'claim now', 'dm me', 'send sol'],
        minConfidenceThreshold: parseFloat(getEnvVar('ALPHA_MIN_CONFIDENCE', false) || '0.5'),
        maxRiskThreshold: parseFloat(getEnvVar('ALPHA_MAX_RISK', false) || '0.7'),
        trustedChannels: getEnvList('ALPHA_TRUSTED_CHANNELS'),
        trustedUsers: getEnvList('ALPHA_TRUSTED_USERS'),
      },
    },
  };
}

export const config = loadConfig();
