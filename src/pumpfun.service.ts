import { Connection, Keypair, PublicKey, Transaction, LAMPORTS_PER_SOL } from '@solana/web3.js';
import * as bs58 from 'bs58';
import * as fs from 'fs';
import * as path from 'path';

// PumpFun SDK imports
import { PumpFunSDK } from 'pumpdotfun-sdk';
import { AnchorProvider, Wallet } from '@coral-xyz/anchor';

// Jito imports for bundle support - using dynamic import to handle type issues
// import { searcherClient } from 'jito-ts/dist/sdk/block-engine/searcher';
// import { Bundle } from 'jito-ts/dist/sdk/block-engine/types';

// ============================================
// TYPES
// ============================================

export interface TokenCreateParams {
  name: string;
  symbol: string;
  description: string;
  imageUrl?: string;
  twitter?: string;
  telegram?: string;
  website?: string;
  initialBuySOL?: number;
  slippage?: number;
}

export interface TokenCreateResult {
  success: boolean;
  mint?: string;
  signature?: string;
  error?: string;
  pumpFunUrl?: string;
}

export interface BundleResult {
  success: boolean;
  bundleId?: string;
  signatures?: string[];
  error?: string;
}

export interface PumpFunConfig {
  rpcUrl: string;
  wsUrl?: string;
  commitment?: 'processed' | 'confirmed' | 'finalized';
  jitoEnabled?: boolean;
  jitoBlockEngineUrl?: string;
  jitoAuthKeypair?: string;
}

// ============================================
// PUMPFUN SERVICE CLASS
// ============================================

export class PumpFunService {
  private connection: Connection;
  private config: PumpFunConfig;
  private sdk: PumpFunSDK | null = null;

  constructor(config: PumpFunConfig) {
    this.config = config;
    this.connection = new Connection(config.rpcUrl, {
      commitment: config.commitment || 'confirmed',
      wsEndpoint: config.wsUrl,
    });
  }

  /**
   * Initialize the PumpFun SDK with a wallet
   */
  async initializeSDK(wallet: Keypair): Promise<void> {
    const anchorWallet = new Wallet(wallet);
    const provider = new AnchorProvider(this.connection, anchorWallet, {
      commitment: this.config.commitment || 'confirmed',
    });

    this.sdk = new PumpFunSDK(provider);
    console.log('[PumpFun] SDK initialized');
  }

  /**
   * Create a new token using the PumpFun SDK
   */
  async createToken(
    creatorWallet: Keypair,
    params: TokenCreateParams
  ): Promise<TokenCreateResult> {
    try {
      // Initialize SDK if not already done
      if (!this.sdk) {
        await this.initializeSDK(creatorWallet);
      }

      console.log(`[PumpFun] Creating token: ${params.name} (${params.symbol})`);

      // Generate new mint keypair
      const mintKeypair = Keypair.generate();

      // Prepare metadata - SDK expects specific format
      const tokenMetadata: any = {
        name: params.name,
        symbol: params.symbol,
        description: params.description,
        twitter: params.twitter || '',
        telegram: params.telegram || '',
        website: params.website || '',
      };

      // If image URL provided, fetch and convert to Blob
      if (params.imageUrl) {
        try {
          const fetch = require('node-fetch');
          const response = await fetch(params.imageUrl);
          const buffer = await response.buffer();
          tokenMetadata.file = new Blob([buffer]);
        } catch (e) {
          console.log('[PumpFun] Could not fetch image, proceeding without');
        }
      }

      // Create token using SDK
      const createResult = await this.sdk!.createAndBuy(
        creatorWallet,
        mintKeypair,
        tokenMetadata,
        BigInt(Math.floor((params.initialBuySOL || 0.1) * LAMPORTS_PER_SOL)),
        BigInt(Math.floor((params.slippage || 10) * 100)), // Slippage in basis points
        {
          unitLimit: 250000,
          unitPrice: 250000,
        }
      ) as any;

      if (createResult.success) {
        console.log(`[PumpFun] Token created: ${mintKeypair.publicKey.toBase58()}`);
        return {
          success: true,
          mint: mintKeypair.publicKey.toBase58(),
          signature: createResult.signature,
          pumpFunUrl: `https://pump.fun/${mintKeypair.publicKey.toBase58()}`,
        };
      } else {
        return {
          success: false,
          error: 'Token creation failed',
        };
      }
    } catch (error: any) {
      console.error('[PumpFun] Create token error:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Buy tokens using the PumpFun SDK
   */
  async buyToken(
    buyerWallet: Keypair,
    mintAddress: string,
    solAmount: number,
    slippageBps: number = 1000 // 10% default
  ): Promise<TokenCreateResult> {
    try {
      if (!this.sdk) {
        await this.initializeSDK(buyerWallet);
      }

      console.log(`[PumpFun] Buying ${solAmount} SOL of ${mintAddress.substring(0, 8)}...`);

      const mintPubkey = new PublicKey(mintAddress);
      const lamports = BigInt(Math.floor(solAmount * LAMPORTS_PER_SOL));

      const buyResult = await this.sdk!.buy(
        buyerWallet,
        mintPubkey,
        lamports,
        BigInt(slippageBps),
        {
          unitLimit: 250000,
          unitPrice: 250000,
        }
      );

      if (buyResult.success) {
        console.log(`[PumpFun] Buy success: ${buyResult.signature}`);
        return {
          success: true,
          signature: buyResult.signature,
        };
      } else {
        return {
          success: false,
          error: 'Buy failed',
        };
      }
    } catch (error: any) {
      console.error('[PumpFun] Buy error:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Sell tokens using the PumpFun SDK
   */
  async sellToken(
    sellerWallet: Keypair,
    mintAddress: string,
    tokenAmount: number | 'all',
    slippageBps: number = 1000
  ): Promise<TokenCreateResult> {
    try {
      if (!this.sdk) {
        await this.initializeSDK(sellerWallet);
      }

      const mintPubkey = new PublicKey(mintAddress);

      // Get token balance if selling all
      let sellAmount: bigint;
      if (tokenAmount === 'all') {
        const balance = await this.getTokenBalance(sellerWallet.publicKey, mintAddress);
        sellAmount = BigInt(Math.floor(balance * 1_000_000)); // Assuming 6 decimals
      } else {
        sellAmount = BigInt(Math.floor(tokenAmount * 1_000_000));
      }

      console.log(`[PumpFun] Selling ${sellAmount} tokens of ${mintAddress.substring(0, 8)}...`);

      const sellResult = await this.sdk!.sell(
        sellerWallet,
        mintPubkey,
        sellAmount,
        BigInt(slippageBps),
        {
          unitLimit: 250000,
          unitPrice: 250000,
        }
      );

      if (sellResult.success) {
        console.log(`[PumpFun] Sell success: ${sellResult.signature}`);
        return {
          success: true,
          signature: sellResult.signature,
        };
      } else {
        return {
          success: false,
          error: 'Sell failed',
        };
      }
    } catch (error: any) {
      console.error('[PumpFun] Sell error:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Get token balance for a wallet
   */
  async getTokenBalance(walletPubkey: PublicKey, mintAddress: string): Promise<number> {
    try {
      const tokenAccounts = await this.connection.getParsedTokenAccountsByOwner(walletPubkey, {
        programId: new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'),
      });

      for (const account of tokenAccounts.value) {
        const parsed = account.account.data.parsed.info;
        if (parsed.mint === mintAddress) {
          return parsed.tokenAmount.uiAmount || 0;
        }
      }
      return 0;
    } catch (error) {
      return 0;
    }
  }

  /**
   * Get bonding curve info for a token
   */
  async getBondingCurveInfo(mintAddress: string): Promise<any> {
    try {
      if (!this.sdk) {
        throw new Error('SDK not initialized');
      }

      const mintPubkey = new PublicKey(mintAddress);
      const bondingCurve = await this.sdk.getBondingCurveAccount(mintPubkey);

      if (bondingCurve) {
        return {
          virtualTokenReserves: bondingCurve.virtualTokenReserves.toString(),
          virtualSolReserves: bondingCurve.virtualSolReserves.toString(),
          realTokenReserves: bondingCurve.realTokenReserves.toString(),
          realSolReserves: bondingCurve.realSolReserves.toString(),
          tokenTotalSupply: bondingCurve.tokenTotalSupply.toString(),
          complete: bondingCurve.complete,
        };
      }
      return null;
    } catch (error: any) {
      console.error('[PumpFun] Get bonding curve error:', error);
      return null;
    }
  }

  /**
   * Check if token has graduated (bonding curve complete)
   */
  async hasGraduated(mintAddress: string): Promise<boolean> {
    const curveInfo = await this.getBondingCurveInfo(mintAddress);
    return curveInfo?.complete || false;
  }
}

// ============================================
// JITO BUNDLE SERVICE
// ============================================

// Jito tip accounts for validator tips
const JITO_TIP_ACCOUNTS = [
  '96gYZGLnJYVFmbjzopPSU6QiEV5fGqZNyN9nmNhvrZU5',
  'HFqU5x63VTqvQss8hp11i4bVxkqjMHHYSqMsLZn4vaxz',
  'Cw8CFyM9FkoMi7K7Crf6HNQqf4uEMzpKw6QNghXLvLkY',
  'ADaUMid9yfUytqMBgopwjb2DTLSokTSzL1zt6iGPaS49',
  'DfXygSm4jCyNCybVYYK6DwvWqjKee8pbDmJGcLWNDXjh',
  'ADuUkR4vqLUMWXxW9gh6D6L8pMSawimctcNZ5pGwDcEt',
  'DttWaMuVvTiduZRnguLF7jNxTgiMBZ1hyAumKUiL2KRL',
  '3AVi9Tg9Uo68tJfuvoKvqKNWKkC5wPdSSdeBnizKZ6jT',
];

export class JitoBundleService {
  private blockEngineUrl: string;
  private connection: Connection;

  constructor(blockEngineUrl: string, rpcUrl: string) {
    this.blockEngineUrl = blockEngineUrl;
    this.connection = new Connection(rpcUrl, 'confirmed');
  }

  /**
   * Get a random Jito tip account
   */
  getRandomTipAccount(): PublicKey {
    const account = JITO_TIP_ACCOUNTS[Math.floor(Math.random() * JITO_TIP_ACCOUNTS.length)];
    return new PublicKey(account);
  }

  /**
   * Send a bundle of transactions via Jito Block Engine API
   */
  async sendBundle(
    transactions: Transaction[],
    signers: Keypair[][],
    tipLamports: number = 10000
  ): Promise<BundleResult> {
    try {
      console.log(`[Jito] Sending bundle with ${transactions.length} transactions...`);

      // Sign transactions
      const signedTxs: string[] = [];
      for (let i = 0; i < transactions.length; i++) {
        const tx = transactions[i];
        tx.recentBlockhash = (await this.connection.getLatestBlockhash()).blockhash;
        tx.feePayer = signers[i][0].publicKey;
        tx.sign(...signers[i]);
        signedTxs.push(bs58.encode(tx.serialize()));
      }

      // Send to Jito Block Engine via HTTP API
      const fetch = require('node-fetch');
      const response = await fetch(`${this.blockEngineUrl}/api/v1/bundles`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'sendBundle',
          params: [signedTxs],
        }),
      });

      const result = await response.json();

      if (result.error) {
        throw new Error(result.error.message || 'Bundle failed');
      }

      console.log(`[Jito] Bundle sent: ${result.result}`);

      return {
        success: true,
        bundleId: result.result,
        signatures: transactions.map(tx => bs58.encode(tx.signature!)),
      };
    } catch (error: any) {
      console.error('[Jito] Bundle error:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Send single transaction with Jito tip for priority
   */
  async sendWithTip(
    transaction: Transaction,
    signers: Keypair[],
    tipLamports: number = 10000
  ): Promise<BundleResult> {
    try {
      // Add tip transfer to a random Jito validator
      const tipAccount = this.getRandomTipAccount();
      const tipIx = {
        programId: new PublicKey('11111111111111111111111111111111'),
        keys: [
          { pubkey: signers[0].publicKey, isSigner: true, isWritable: true },
          { pubkey: tipAccount, isSigner: false, isWritable: true },
        ],
        data: Buffer.alloc(12),
      };

      // Write transfer instruction data (instruction 2 = transfer, then amount as u64)
      tipIx.data.writeUInt32LE(2, 0);
      tipIx.data.writeBigUInt64LE(BigInt(tipLamports), 4);

      transaction.add(tipIx);

      // Send as bundle
      return this.sendBundle([transaction], [signers], tipLamports);
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Create tip instruction for Jito validators
   */
  createTipInstruction(fromPubkey: PublicKey, tipLamports: number): any {
    const tipAccount = this.getRandomTipAccount();

    const data = Buffer.alloc(12);
    data.writeUInt32LE(2, 0); // Transfer instruction
    data.writeBigUInt64LE(BigInt(tipLamports), 4);

    return {
      programId: new PublicKey('11111111111111111111111111111111'),
      keys: [
        { pubkey: fromPubkey, isSigner: true, isWritable: true },
        { pubkey: tipAccount, isSigner: false, isWritable: true },
      ],
      data,
    };
  }
}

// ============================================
// EXPORT FACTORY FUNCTIONS
// ============================================

export function createPumpFunService(config: PumpFunConfig): PumpFunService {
  return new PumpFunService(config);
}

export function createJitoBundleService(
  blockEngineUrl: string,
  rpcUrl: string
): JitoBundleService {
  return new JitoBundleService(blockEngineUrl, rpcUrl);
}
