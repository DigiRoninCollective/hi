// Configuration types
export interface Config {
  twitter: TwitterConfig;
  solana: SolanaConfig;
  pumpPortal: PumpPortalConfig;
  tokenDefaults: TokenDefaults;
  groq: GroqConfig;
  zkMixer: ZkMixerConfig;
}

export interface TwitterConfig {
  enabled: boolean;
  apiKey: string;
  apiSecret: string;
  accessToken: string;
  accessSecret: string;
  bearerToken: string;
  usernames: string[];
  hashtags: string[];
}

export interface SolanaConfig {
  privateKey: string;
  rpcUrl: string;
}

export interface PumpPortalConfig {
  apiKey: string;
}

export interface TokenDefaults {
  decimals: number;
  initialBuySol: number;
}

export interface GroqConfig {
  enabled: boolean;
  apiKey?: string;
  model: string;
  secondaryModel?: string;
  suggestionCount: number;
  autoDeploySuggestions: boolean;
  temperature: number;
  maxTokens: number;
}

export interface ZkMixerConfig {
  enabled: boolean;
  artifactDir: string;
  nullifierStorePath?: string;
}

// Tweet parsing types
export interface ParsedLaunchCommand {
  ticker: string;
  name: string;
  description?: string;
  imageUrl?: string;
  bannerUrl?: string;
  avatarUrl?: string;
  website?: string;
  twitterHandle?: string;
  tweetId: string;
  tweetAuthor: string;
  tweetText: string;
  zkProof?: Uint8Array;
  zkPublicSignals?: {
    merkle_root: string;
    nullifier_hash: string;
    recipient: string;
  };
}

export interface TweetData {
  id: string;
  text: string;
  authorId: string;
  authorUsername: string;
  createdAt: Date;
  urls?: string[];
  mediaUrls?: string[];
}

// PumpPortal types
export interface PumpPortalCreateRequest {
  action: 'create';
  tokenMetadata: TokenMetadata;
  mint: string;
  denominatedInSol: 'true' | 'false';
  amount: number;
  slippage: number;
  priorityFee: number;
  pool: 'pump' | 'raydium';
}

export interface TokenMetadata {
  name: string;
  symbol: string;
  uri: string;
}

export interface TokenMetadataIPFS {
  name: string;
  symbol: string;
  description: string;
  image?: string;
  showName: boolean;
  createdOn: string;
  twitter?: string;
  telegram?: string;
  website?: string;
}

export interface PumpPortalCreateResponse {
  signature?: string;
  mint?: string;
  error?: string;
}

export interface IPFSMetadataResponse {
  metadataUri: string;
}

// Event types
export type LaunchEventHandler = (command: ParsedLaunchCommand) => Promise<void>;

// Error handling utilities
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return String(error);
}

export class AppError extends Error {
  constructor(
    public code: string,
    message: string,
    public statusCode: number = 500,
    public details?: Record<string, unknown>
  ) {
    super(message);
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

export function assertError(error: unknown): Error {
  if (error instanceof Error) return error;
  return new Error(String(error));
}

// API Response types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  statusCode: number;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

// Generic result type for operations
export type Result<T, E = Error> =
  | { ok: true; value: T }
  | { ok: false; error: E };

export function isError<T>(result: Result<T>): result is { ok: false; error: Error } {
  return !result.ok;
}

export function getValue<T>(result: Result<T>): T | undefined {
  return result.ok ? result.value : undefined;
}

// Common type patterns
export type Callback<Args extends unknown[] = [], Return = void> = (...args: Args) => Return;
export type AsyncCallback<Args extends unknown[] = [], Return = void> = (...args: Args) => Promise<Return>;

export interface Nullable<T> {
  value: T | null;
}

export type Optional<T> = T | undefined;

// Record type helpers
export type Dictionary<T> = Record<string, T>;
export type Readonly<T> = {
  readonly [K in keyof T]: T[K];
};
