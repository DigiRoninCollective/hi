import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  VersionedTransaction,
  TransactionInstruction,
  TransactionMessage,
  SystemProgram,
  LAMPORTS_PER_SOL,
  sendAndConfirmTransaction,
} from '@solana/web3.js';
import * as bs58 from 'bs58';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const fetch = require('node-fetch');

// ============================================
// TYPES
// ============================================

export interface BundlerConfig {
  enabled: boolean;
  jitoEnabled: boolean;
  jitoTipLamports: number;
  jitoBlockEngineUrl: string;
  maxBundleSize: number;
  retryAttempts: number;
}

export interface BundleTransaction {
  transaction: Transaction | VersionedTransaction;
  signers: Keypair[];
}

export interface BundleResult {
  success: boolean;
  bundleId?: string;
  signatures?: string[];
  error?: string;
}

interface JitoBundleResponse {
  jsonrpc: string;
  id: number;
  result?: string;
  error?: {
    code: number;
    message: string;
  };
}

// Jito tip accounts (mainnet)
const JITO_TIP_ACCOUNTS = [
  '96gYZGLnJYVFmbjzopPSU6QiEV5fGqZNyN9nmNhvrZU5',
  'HFqU5x63VTqvQss8hp11i4bVmkdzGtLnGMmFiQASyU5K',
  'Cw8CFyM9FkoMi7K7Crf6HNQqf4uEMzpKw6QNghXLvLkY',
  'ADaUMid9yfUytqMBgopwjb2DTLSokTSzL1zt6iGPaS49',
  'DfXygSm4jCyNCybVYYK6DwvWqjKee8pbDmJGcLWNDXjh',
  'ADuUkR4vqLUMWXxW9gh6D6L8pMSawimctcNZ5pGwDcEt',
  'DttWaMuVvTiduZRnguLF7jNxTgiMBZ1hyAumKUiL2KRL',
  '3AVi9Tg9Uo68tJfuvoKvqKNWKkC5wPdSSdeBnizKZ6jT',
];

// ============================================
// BUNDLER SERVICE
// ============================================

export class BundlerService {
  private connection: Connection;
  private config: BundlerConfig;
  private pendingTransactions: BundleTransaction[] = [];

  constructor(rpcUrl: string, config: BundlerConfig) {
    this.connection = new Connection(rpcUrl, 'confirmed');
    this.config = config;
  }

  /**
   * Get a random Jito tip account
   */
  private getRandomTipAccount(): PublicKey {
    const randomIndex = Math.floor(Math.random() * JITO_TIP_ACCOUNTS.length);
    return new PublicKey(JITO_TIP_ACCOUNTS[randomIndex]);
  }

  /**
   * Create a tip instruction for Jito validators
   */
  createTipInstruction(payer: PublicKey, tipLamports?: number): TransactionInstruction {
    const tip = tipLamports ?? this.config.jitoTipLamports;
    return SystemProgram.transfer({
      fromPubkey: payer,
      toPubkey: this.getRandomTipAccount(),
      lamports: tip,
    });
  }

  /**
   * Add transaction to pending bundle
   */
  addTransaction(transaction: Transaction | VersionedTransaction, signers: Keypair[]): void {
    if (this.pendingTransactions.length >= this.config.maxBundleSize) {
      throw new Error(`Bundle size limit reached (max: ${this.config.maxBundleSize})`);
    }
    this.pendingTransactions.push({ transaction, signers });
  }

  /**
   * Clear pending transactions
   */
  clearPending(): void {
    this.pendingTransactions = [];
  }

  /**
   * Get pending transaction count
   */
  getPendingCount(): number {
    return this.pendingTransactions.length;
  }

  /**
   * Send a single transaction with optional Jito bundling
   */
  async sendTransaction(
    transaction: Transaction,
    signers: Keypair[],
    addTip: boolean = true
  ): Promise<BundleResult> {
    if (!this.config.enabled) {
      // Send as regular transaction
      try {
        const signature = await sendAndConfirmTransaction(this.connection, transaction, signers);
        return { success: true, signatures: [signature] };
      } catch (error: any) {
        return { success: false, error: error.message };
      }
    }

    if (this.config.jitoEnabled) {
      // Add tip if requested
      if (addTip && signers.length > 0) {
        transaction.add(this.createTipInstruction(signers[0].publicKey));
      }
      return this.sendJitoBundle([{ transaction, signers }]);
    }

    // Bundler enabled but not Jito - just send normally
    try {
      const signature = await sendAndConfirmTransaction(this.connection, transaction, signers);
      return { success: true, signatures: [signature] };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Send all pending transactions as a Jito bundle
   */
  async sendPendingBundle(addTipToLast: boolean = true): Promise<BundleResult> {
    if (this.pendingTransactions.length === 0) {
      return { success: false, error: 'No pending transactions' };
    }

    // Add tip to the last transaction
    if (addTipToLast && this.pendingTransactions.length > 0) {
      const lastTx = this.pendingTransactions[this.pendingTransactions.length - 1];
      if (lastTx.transaction instanceof Transaction && lastTx.signers.length > 0) {
        lastTx.transaction.add(this.createTipInstruction(lastTx.signers[0].publicKey));
      }
    }

    const result = await this.sendJitoBundle(this.pendingTransactions);
    this.clearPending();
    return result;
  }

  /**
   * Send bundle to Jito block engine
   */
  private async sendJitoBundle(transactions: BundleTransaction[]): Promise<BundleResult> {
    const serializedTxs: string[] = [];

    // Get recent blockhash
    const { blockhash } = await this.connection.getLatestBlockhash('finalized');

    // Serialize all transactions
    for (const { transaction, signers } of transactions) {
      if (transaction instanceof Transaction) {
        transaction.recentBlockhash = blockhash;
        transaction.feePayer = signers[0]?.publicKey;
        transaction.sign(...signers);
        serializedTxs.push(bs58.encode(transaction.serialize()));
      } else {
        // VersionedTransaction
        serializedTxs.push(bs58.encode(transaction.serialize()));
      }
    }

    // Send to Jito
    let lastError = '';
    for (let attempt = 0; attempt < this.config.retryAttempts; attempt++) {
      try {
        const response = await fetch(`${this.config.jitoBlockEngineUrl}/api/v1/bundles`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: 1,
            method: 'sendBundle',
            params: [serializedTxs],
          }),
        });

        const data = (await response.json()) as JitoBundleResponse;

        if (data.error) {
          lastError = data.error.message;
          console.log(`[Bundler] Jito error (attempt ${attempt + 1}): ${lastError}`);
          await this.sleep(1000 * (attempt + 1)); // Exponential backoff
          continue;
        }

        if (data.result) {
          console.log(`[Bundler] Bundle submitted: ${data.result}`);
          return {
            success: true,
            bundleId: data.result,
            signatures: serializedTxs.map(() => 'pending'), // Signatures are in the bundle
          };
        }
      } catch (error: any) {
        lastError = error.message;
        console.log(`[Bundler] Request error (attempt ${attempt + 1}): ${lastError}`);
        await this.sleep(1000 * (attempt + 1));
      }
    }

    return { success: false, error: lastError || 'Failed after retries' };
  }

  /**
   * Check bundle status
   */
  async getBundleStatus(bundleId: string): Promise<string> {
    try {
      const response = await fetch(`${this.config.jitoBlockEngineUrl}/api/v1/bundles`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'getBundleStatuses',
          params: [[bundleId]],
        }),
      });

      const data = await response.json() as any;
      if (data.result?.value?.[0]) {
        return data.result.value[0].confirmation_status || 'unknown';
      }
      return 'not_found';
    } catch (error: any) {
      return `error: ${error.message}`;
    }
  }

  /**
   * Create a simple transfer transaction
   */
  async createTransferTransaction(
    from: Keypair,
    to: PublicKey,
    lamports: number
  ): Promise<Transaction> {
    const transaction = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: from.publicKey,
        toPubkey: to,
        lamports,
      })
    );

    const { blockhash } = await this.connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = from.publicKey;

    return transaction;
  }

  /**
   * Execute a bundled multi-wallet transfer (spread SOL across wallets)
   */
  async spreadSol(
    sourceKeypair: Keypair,
    destinations: PublicKey[],
    amountPerWallet: number
  ): Promise<BundleResult> {
    const transaction = new Transaction();

    for (const dest of destinations) {
      transaction.add(
        SystemProgram.transfer({
          fromPubkey: sourceKeypair.publicKey,
          toPubkey: dest,
          lamports: Math.floor(amountPerWallet * LAMPORTS_PER_SOL),
        })
      );
    }

    // Add Jito tip if enabled
    if (this.config.jitoEnabled) {
      transaction.add(this.createTipInstruction(sourceKeypair.publicKey));
    }

    return this.sendTransaction(transaction, [sourceKeypair], false);
  }

  /**
   * Collect SOL from multiple wallets back to one
   */
  async collectSol(
    sourceKeypairs: Keypair[],
    destination: PublicKey,
    leaveMinimum: number = 0.001 // Leave some for rent
  ): Promise<BundleResult[]> {
    const results: BundleResult[] = [];

    for (const keypair of sourceKeypairs) {
      try {
        const balance = await this.connection.getBalance(keypair.publicKey);
        const minLamports = Math.floor(leaveMinimum * LAMPORTS_PER_SOL);
        const transferAmount = balance - minLamports - 5000; // 5000 for tx fee

        if (transferAmount <= 0) {
          results.push({ success: false, error: 'Insufficient balance' });
          continue;
        }

        const transaction = new Transaction().add(
          SystemProgram.transfer({
            fromPubkey: keypair.publicKey,
            toPubkey: destination,
            lamports: transferAmount,
          })
        );

        const result = await this.sendTransaction(transaction, [keypair], true);
        results.push(result);
      } catch (error: any) {
        results.push({ success: false, error: error.message });
      }
    }

    return results;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// ============================================
// EXPORTS
// ============================================

export function createBundler(rpcUrl: string, config?: Partial<BundlerConfig>): BundlerService {
  const defaultConfig: BundlerConfig = {
    enabled: false,
    jitoEnabled: false,
    jitoTipLamports: 10000,
    jitoBlockEngineUrl: 'https://mainnet.block-engine.jito.wtf',
    maxBundleSize: 5,
    retryAttempts: 3,
  };

  return new BundlerService(rpcUrl, { ...defaultConfig, ...config });
}
