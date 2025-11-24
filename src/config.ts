import dotenv from 'dotenv';
import { Config } from './types';
import { SSEServerConfig } from './sse-server';
import { AlertConfig } from './alerting';
import { ClassifierConfig } from './classifier';
import { AlphaAggregatorConfig, AlphaClassifierConfig } from './alpha-aggregator.service';
import { DiscordConfig } from './discord.service';
import { TelegramConfig } from './telegram.service';
import { RedditConfig } from './reddit.service';
import { BundlerConfig } from './bundler.service';
import { GroqConfig, ZkMixerConfig } from './types';
import { PumpPortalDataConfig } from './types';
import path from 'path';

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

function validateUrl(url: string, fieldName: string): void {
  try {
    new URL(url);
  } catch {
    throw new Error(`Invalid URL for ${fieldName}: ${url}`);
  }
}

function validatePortNumber(port: number, fieldName: string): void {
  if (port < 1 || port > 65535) {
    throw new Error(`Invalid port number for ${fieldName}: ${port}`);
  }
}

function validateThreshold(value: number, fieldName: string, min: number = 0, max: number = 1): void {
  if (value < min || value > max) {
    throw new Error(`Invalid threshold for ${fieldName}: ${value} (must be between ${min} and ${max})`);
  }
}

export interface FullConfig extends Config {
  sse: SSEServerConfig;
  alerting: AlertConfig;
  classifier: Partial<ClassifierConfig>;
  alpha: AlphaAggregatorConfig;
  bundler: BundlerConfig;
  groq: GroqConfig;
  zkMixer: ZkMixerConfig;
  pumpPortalData: PumpPortalDataConfig;
}

export function loadConfig(): FullConfig {
  const twitterEnabled = getEnvBool('TWITTER_ENABLED', true);
  const twitterRequired = twitterEnabled;

  const ssePort = parseInt(getEnvVar('SSE_PORT', false) || '3000', 10);
  const classifierMinConfidence = parseFloat(getEnvVar('CLASSIFIER_MIN_CONFIDENCE', false) || '0.6');
  const classifierMaxRisk = parseFloat(getEnvVar('CLASSIFIER_MAX_RISK', false) || '0.7');
  const alphaMinConfidence = parseFloat(getEnvVar('ALPHA_MIN_CONFIDENCE', false) || '0.5');
  const alphaMaxRisk = parseFloat(getEnvVar('ALPHA_MAX_RISK', false) || '0.7');
  const rpcUrl = getEnvVar('SOLANA_RPC_URL', false) || 'https://api.mainnet-beta.solana.com';
  const groqTemp = parseFloat(getEnvVar('GROQ_TEMPERATURE', false) || '0.2');

  // Validate configurations
  validatePortNumber(ssePort, 'SSE_PORT');
  validateThreshold(classifierMinConfidence, 'CLASSIFIER_MIN_CONFIDENCE');
  validateThreshold(classifierMaxRisk, 'CLASSIFIER_MAX_RISK');
  validateThreshold(alphaMinConfidence, 'ALPHA_MIN_CONFIDENCE');
  validateThreshold(alphaMaxRisk, 'ALPHA_MAX_RISK');
  validateThreshold(groqTemp, 'GROQ_TEMPERATURE');
  validateUrl(rpcUrl, 'SOLANA_RPC_URL');

  return {
    twitter: {
      enabled: twitterEnabled,
      apiKey: getEnvVar('TWITTER_API_KEY', twitterRequired),
      apiSecret: getEnvVar('TWITTER_API_SECRET', twitterRequired),
      accessToken: getEnvVar('TWITTER_ACCESS_TOKEN', twitterRequired),
      accessSecret: getEnvVar('TWITTER_ACCESS_SECRET', twitterRequired),
      bearerToken: getEnvVar('TWITTER_BEARER_TOKEN', twitterRequired),
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
    pumpPortalData: {
      enabled: getEnvBool('PUMPPORTAL_WS_ENABLED', false),
      subscribeNewTokens: getEnvBool('PUMPPORTAL_WS_SUBSCRIBE_NEW_TOKENS', true),
      tokenTradeMints: getEnvList('PUMPPORTAL_WS_TOKEN_MINTS'),
      accountTradeWallets: getEnvList('PUMPPORTAL_WS_ACCOUNTS'),
      subscribeMigration: getEnvBool('PUMPPORTAL_WS_SUBSCRIBE_MIGRATION', false),
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
        botName: getEnvVar('ALPHA_TELEGRAM_BOT_NAME', false) || 'Alpha Signal Bot',
        botDescription: getEnvVar('ALPHA_TELEGRAM_BOT_DESCRIPTION', false) || 'Multi-source crypto alpha aggregator',
        launchApiUrl: getEnvVar('ALPHA_TELEGRAM_LAUNCH_API_URL', false) || undefined,
        launchApiKey: getEnvVar('ALPHA_TELEGRAM_LAUNCH_API_KEY', false) || undefined,
        defaultLaunchAmount: parseFloat(getEnvVar('ALPHA_TELEGRAM_LAUNCH_AMOUNT', false) || '0.1'),
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
    bundler: {
      enabled: getEnvBool('BUNDLER_ENABLED', false),
      jitoEnabled: getEnvBool('JITO_ENABLED', false),
      jitoTipLamports: parseInt(getEnvVar('JITO_TIP_LAMPORTS', false) || '10000', 10),
      jitoBlockEngineUrl: getEnvVar('JITO_BLOCK_ENGINE_URL', false) || 'https://mainnet.block-engine.jito.wtf',
      maxBundleSize: parseInt(getEnvVar('BUNDLE_MAX_SIZE', false) || '5', 10),
      retryAttempts: parseInt(getEnvVar('BUNDLE_RETRY_ATTEMPTS', false) || '3', 10),
    },
    groq: {
      enabled: getEnvBool('GROQ_ENABLED', false),
      apiKey: getEnvVar('GROQ_API_KEY', false) || undefined,
      model: getEnvVar('GROQ_MODEL', false) || 'llama-3.1-8b-instant',
      secondaryModel: getEnvVar('GROQ_SECONDARY_MODEL', false) || undefined,
      suggestionCount: parseInt(getEnvVar('GROQ_SUGGESTION_COUNT', false) || '2', 10),
      autoDeploySuggestions: getEnvBool('GROQ_AUTO_DEPLOY', true),
      temperature: parseFloat(getEnvVar('GROQ_TEMPERATURE', false) || '0.2'),
      maxTokens: parseInt(getEnvVar('GROQ_MAX_TOKENS', false) || '256', 10),
    },
    zkMixer: {
      enabled: getEnvBool('ZK_MIXER_ENABLED', false),
      artifactDir: getEnvVar('ZK_MIXER_ARTIFACT_DIR', false) || path.join(process.cwd(), '..', 'ZCDOS', 'circuits', 'zk-mixer', 'target'),
      nullifierStorePath: getEnvVar('ZK_MIXER_NULLIFIER_STORE', false) || path.join(process.cwd(), 'zk-nullifiers.json'),
    },
  };
}

export const config = loadConfig();
