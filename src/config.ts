import dotenv from 'dotenv';
import { Config } from './types';

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

export function loadConfig(): Config {
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
  };
}

export const config = loadConfig();
