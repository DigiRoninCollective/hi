import dotenv from 'dotenv';
import { Config } from './types';
import { SSEServerConfig } from './sse-server';
import { AlertConfig } from './alerting';
import { ClassifierConfig } from './classifier';

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
  };
}

export const config = loadConfig();
