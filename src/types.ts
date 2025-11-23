// Configuration types
export interface Config {
  twitter: TwitterConfig;
  solana: SolanaConfig;
  pumpPortal: PumpPortalConfig;
  tokenDefaults: TokenDefaults;
}

export interface TwitterConfig {
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

// Tweet parsing types
export interface ParsedLaunchCommand {
  ticker: string;
  name: string;
  description?: string;
  imageUrl?: string;
  tweetId: string;
  tweetAuthor: string;
  tweetText: string;
}

export interface TweetData {
  id: string;
  text: string;
  authorId: string;
  authorUsername: string;
  createdAt: Date;
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
