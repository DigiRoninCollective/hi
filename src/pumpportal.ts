import {
  Connection,
  Keypair,
  VersionedTransaction,
  LAMPORTS_PER_SOL,
} from '@solana/web3.js';
import fetch from 'node-fetch';
import {
  SolanaConfig,
  TokenDefaults,
  ParsedLaunchCommand,
} from './types';
import { ZkMixerService, ZkProofRequest } from './zk-mixer.service';
import { MintKeyManager } from './mint-key-manager';
import { loadKeypairFromSecret } from './utils/secure-wallet';

const PUMPPORTAL_API_URL = 'https://pumpportal.fun/api';

export class PumpPortalService {
  private readonly connection: Connection;
  private readonly wallet: Keypair;
  private readonly defaults: TokenDefaults;
  private readonly zkMixer?: ZkMixerService | null;
  private readonly mintKeyManager: MintKeyManager;

  constructor(
    solanaConfig: SolanaConfig,
    defaults: TokenDefaults,
    zkMixer?: ZkMixerService | null,
    db?: any // Optional Supabase client for MintKeyManager
  ) {
    this.connection = new Connection(solanaConfig.rpcUrl, 'confirmed');
    this.wallet = loadKeypairFromSecret(solanaConfig.privateKey, 'SOLANA_PRIVATE_KEY');
    this.defaults = defaults;
    this.zkMixer = zkMixer;
    this.mintKeyManager = new MintKeyManager(db);

    console.log(`Wallet initialized: ${this.wallet.publicKey.toBase58()}`);
  }

  /**
   * Get wallet public key
   */
  getWalletAddress(): string {
    return this.wallet.publicKey.toBase58();
  }

  /**
   * Transfer SOL from the primary wallet
   */
  async transferSol(to: string, amountSol: number): Promise<string> {
    const tx = new (await import('@solana/web3.js')).Transaction().add(
      (await import('@solana/web3.js')).SystemProgram.transfer({
        fromPubkey: this.wallet.publicKey,
        toPubkey: new (await import('@solana/web3.js')).PublicKey(to),
        lamports: amountSol * LAMPORTS_PER_SOL,
      })
    );
    const sig = await this.connection.sendTransaction(tx, [this.wallet], { skipPreflight: false });
    await this.connection.confirmTransaction(sig, 'confirmed');
    return sig;
  }

  /**
   * Get wallet SOL balance
   */
  async getBalance(): Promise<number> {
    const balance = await this.connection.getBalance(this.wallet.publicKey);
    return balance / LAMPORTS_PER_SOL;
  }

  async getBalanceFor(pubkey: string): Promise<number> {
    const balance = await this.connection.getBalance(new (await import('@solana/web3.js')).PublicKey(pubkey));
    return balance / LAMPORTS_PER_SOL;
  }

  /**
   * Upload token metadata to IPFS via PumpPortal
   */
  private async uploadMetadata(command: ParsedLaunchCommand): Promise<string> {
    console.log('Uploading token metadata to IPFS...');

    const formData = new URLSearchParams();
    formData.append('name', command.name);
    formData.append('symbol', command.ticker);
    formData.append('description', command.description || `${command.ticker} token launched via Twitter`);
    formData.append('showName', 'true');

    // Add Twitter reference
    formData.append('twitter', `https://twitter.com/${command.tweetAuthor}/status/${command.tweetId}`);

    const response = await fetch(`${PUMPPORTAL_API_URL}/ipfs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData.toString(),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to upload metadata: ${response.status} - ${errorText}`);
    }

    const result = await response.json() as { metadataUri: string };
    console.log(`Metadata uploaded: ${result.metadataUri}`);
    return result.metadataUri;
  }

  private async sendAndConfirm(transaction: VersionedTransaction, signers: Keypair[], maxRetries?: number): Promise<string> {
    const latestBlockhash = await this.connection.getLatestBlockhash('confirmed');
    transaction.message.recentBlockhash = latestBlockhash.blockhash;

    transaction.sign(signers);

    const signature = await this.connection.sendTransaction(transaction, {
      skipPreflight: false,
      preflightCommitment: 'confirmed',
      maxRetries,
    });

    await this.connection.confirmTransaction(
      {
        signature,
        ...latestBlockhash,
      },
      'confirmed'
    );

    return signature;
  }

  private async verifyZkProof(action: string, zkProof?: Uint8Array, zkPublicSignals?: ZkProofRequest['publicSignals']): Promise<void> {
    if (!this.zkMixer || !this.zkMixer.isEnabled()) {
      return;
    }

    if (!zkProof || !zkPublicSignals) {
      throw new Error(`ZK proof required for ${action}`);
    }

    await this.zkMixer.verifyAndConsume({ proof: zkProof, publicSignals: zkPublicSignals });
  }

  /**
   * Create a new token on PumpFun via PumpPortal
   */
  async createToken(command: ParsedLaunchCommand, zkProof?: Uint8Array, zkPublicSignals?: ZkProofRequest['publicSignals']): Promise<{
    signature: string;
    mint: string;
  }> {
    console.log(`\nCreating token: ${command.ticker} (${command.name})`);
    console.log(`  Description: ${command.description?.substring(0, 50)}...`);
    console.log(`  Tweet: https://twitter.com/${command.tweetAuthor}/status/${command.tweetId}`);

    await this.verifyZkProof('token creation', zkProof, zkPublicSignals);

    // Check wallet balance
    const balance = await this.getBalance();
    console.log(`  Wallet balance: ${balance.toFixed(4)} SOL`);

    const requiredBalance = this.defaults.initialBuySol + 0.05; // Initial buy + fees
    if (balance < requiredBalance) {
      throw new Error(
        `Insufficient balance. Have ${balance.toFixed(4)} SOL, need at least ${requiredBalance.toFixed(4)} SOL`
      );
    }

    // Generate and save mint keypair (or use custom contract if provided)
    let mintKeypair: Keypair;
    if (command.contractAddress) {
      console.log(`  Using custom contract address: ${command.contractAddress}`);
      // For custom contracts, we still need a mint keypair for signing
      mintKeypair = Keypair.generate();
    } else {
      // Create and persist mint key for recovery
      mintKeypair = await this.mintKeyManager.createAndSaveMintKey(
        command.name,
        command.ticker,
        command.contractAddress,
        command.tweetAuthor
      );
    }
    console.log(`  Mint address: ${mintKeypair.publicKey.toBase58()}`);

    // Upload metadata to IPFS
    const metadataUri = await this.uploadMetadata(command);

    // Create the token via PumpPortal API
    console.log('Sending create request to PumpPortal...');

    const response = await fetch(`${PUMPPORTAL_API_URL}/trade-local`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        publicKey: this.wallet.publicKey.toBase58(),
        action: 'create',
        tokenMetadata: {
          name: command.name,
          symbol: command.ticker,
          uri: metadataUri,
        },
        mint: mintKeypair.publicKey.toBase58(),
        denominatedInSol: 'true',
        amount: this.defaults.initialBuySol,
        slippage: 10,
        priorityFee: 0.0005,
        pool: 'pump',
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      // Mark as failed if using DB
      await this.mintKeyManager.markTokenFailed(
        mintKeypair.publicKey.toBase58(),
        errorText
      );
      throw new Error(`PumpPortal API error: ${response.status} - ${errorText}`);
    }

    // Get the transaction from the response
    const transactionData = await response.arrayBuffer();
    const transaction = VersionedTransaction.deserialize(new Uint8Array(transactionData));

    // Send the transaction
    console.log('Sending transaction to Solana...');
    const signature = await this.sendAndConfirm(transaction, [this.wallet, mintKeypair], 3);
    console.log(`Transaction sent: ${signature}`);

    // Mark as confirmed in database
    await this.mintKeyManager.markTokenConfirmed(
      mintKeypair.publicKey.toBase58(),
      signature,
      command.contractAddress
    );

    console.log(`\nToken created successfully!`);
    console.log(`  Signature: ${signature}`);
    console.log(`  Mint: ${mintKeypair.publicKey.toBase58()}`);
    if (command.contractAddress) {
      console.log(`  Contract: ${command.contractAddress}`);
    }
    console.log(`  View on Solscan: https://solscan.io/tx/${signature}`);
    console.log(`  View on PumpFun: https://pump.fun/${mintKeypair.publicKey.toBase58()}`);

    return {
      signature,
      mint: mintKeypair.publicKey.toBase58(),
    };
  }

  /**
   * Buy tokens on an existing PumpFun token
   */
  async buyToken(mintAddress: string, solAmount: number, zkProof?: Uint8Array, zkPublicSignals?: ZkProofRequest['publicSignals']): Promise<string> {
    console.log(`\nBuying ${solAmount} SOL worth of token ${mintAddress}`);

    await this.verifyZkProof('buy', zkProof, zkPublicSignals);

    const response = await fetch(`${PUMPPORTAL_API_URL}/trade-local`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        publicKey: this.wallet.publicKey.toBase58(),
        action: 'buy',
        mint: mintAddress,
        denominatedInSol: 'true',
        amount: solAmount,
        slippage: 10,
        priorityFee: 0.0005,
        pool: 'pump',
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`PumpPortal API error: ${response.status} - ${errorText}`);
    }

    const transactionData = await response.arrayBuffer();
    const transaction = VersionedTransaction.deserialize(new Uint8Array(transactionData));

    const signature = await this.sendAndConfirm(transaction, [this.wallet]);

    console.log(`Buy transaction confirmed: ${signature}`);
    return signature;
  }

  /**
   * Collect creator fees via PumpPortal hosted API (no local signing required)
   */
  async collectCreatorFee(options?: { pool?: 'pump' | 'meteora-dbc'; mint?: string; priorityFee?: number }): Promise<{ signature: string }> {
    const apiKey = process.env.PUMPPORTAL_API_KEY;
    if (!apiKey) {
      throw new Error('PUMPPORTAL_API_KEY is not configured');
    }

    const pool = options?.pool || 'pump';
    const priorityFee = options?.priorityFee ?? 0.000001;

    const response = await fetch(`${PUMPPORTAL_API_URL}/trade?api-key=${apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'collectCreatorFee',
        priorityFee,
        pool,
        mint: options?.mint,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`PumpPortal collectCreatorFee failed: ${response.status} - ${err}`);
    }

    const data = await response.json() as { signature?: string; error?: string };
    if (!data.signature) {
      throw new Error(`PumpPortal collectCreatorFee missing signature: ${JSON.stringify(data)}`);
    }

    return { signature: data.signature };
  }

  /**
   * Hosted buy via PumpPortal API (no local signing). Denominated in SOL.
   */
  async buyHosted(params: {
    mint: string;
    amountSol: number;
    slippage?: number;
    priorityFee?: number;
    pool?: 'pump' | 'meteora-dbc';
  }): Promise<{ signature: string }> {
    const apiKey = process.env.PUMPPORTAL_API_KEY;
    if (!apiKey) {
      throw new Error('PUMPPORTAL_API_KEY is not configured');
    }

    const response = await fetch(`${PUMPPORTAL_API_URL}/trade?api-key=${apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'buy',
        mint: params.mint,
        denominatedInSol: 'true',
        amount: params.amountSol,
        slippage: params.slippage ?? 10,
        priorityFee: params.priorityFee ?? 0.0005,
        pool: params.pool || 'pump',
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`PumpPortal buyHosted failed: ${response.status} - ${err}`);
    }

    const data = (await response.json()) as { signature?: string; error?: string };
    if (!data.signature) {
      throw new Error(`PumpPortal buyHosted missing signature: ${JSON.stringify(data)}`);
    }
    return { signature: data.signature };
  }

  /**
   * Hosted sell via PumpPortal API (no local signing). Denominated in tokens.
   */
  async sellHosted(params: {
    mint: string;
    tokenAmount: number;
    slippage?: number;
    priorityFee?: number;
    pool?: 'pump' | 'meteora-dbc';
  }): Promise<{ signature: string }> {
    const apiKey = process.env.PUMPPORTAL_API_KEY;
    if (!apiKey) {
      throw new Error('PUMPPORTAL_API_KEY is not configured');
    }

    const response = await fetch(`${PUMPPORTAL_API_URL}/trade?api-key=${apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'sell',
        mint: params.mint,
        tokenAmount: params.tokenAmount,
        slippage: params.slippage ?? 10,
        priorityFee: params.priorityFee ?? 0.0005,
        pool: params.pool || 'pump',
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`PumpPortal sellHosted failed: ${response.status} - ${err}`);
    }

    const data = (await response.json()) as { signature?: string; error?: string };
    if (!data.signature) {
      throw new Error(`PumpPortal sellHosted missing signature: ${JSON.stringify(data)}`);
    }
    return { signature: data.signature };
  }

  /**
   * Sell tokens on PumpFun
   */
  async sellToken(mintAddress: string, tokenAmount: number, zkProof?: Uint8Array, zkPublicSignals?: ZkProofRequest['publicSignals']): Promise<string> {
    console.log(`\nSelling ${tokenAmount} tokens of ${mintAddress}`);

    await this.verifyZkProof('sell', zkProof, zkPublicSignals);

    const response = await fetch(`${PUMPPORTAL_API_URL}/trade-local`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        publicKey: this.wallet.publicKey.toBase58(),
        action: 'sell',
        mint: mintAddress,
        denominatedInSol: 'false',
        amount: tokenAmount,
        slippage: 10,
        priorityFee: 0.0005,
        pool: 'pump',
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`PumpPortal API error: ${response.status} - ${errorText}`);
    }

    const transactionData = await response.arrayBuffer();
    const transaction = VersionedTransaction.deserialize(new Uint8Array(transactionData));

    const signature = await this.sendAndConfirm(transaction, [this.wallet]);

    console.log(`Sell transaction confirmed: ${signature}`);
    return signature;
  }

  /**
   * Buy using a provided wallet (multi-wallet mode)
   */
  async buyTokenWithWallet(wallet: Keypair, mintAddress: string, solAmount: number): Promise<string> {
    const response = await fetch(`${PUMPPORTAL_API_URL}/trade-local`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        publicKey: wallet.publicKey.toBase58(),
        action: 'buy',
        mint: mintAddress,
        denominatedInSol: 'true',
        amount: solAmount,
        slippage: 10,
        priorityFee: 0.0005,
        pool: 'pump',
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`PumpPortal API error: ${response.status} - ${errorText}`);
    }

    const transactionData = await response.arrayBuffer();
    const transaction = VersionedTransaction.deserialize(new Uint8Array(transactionData));
    const signature = await this.sendAndConfirm(transaction, [wallet]);
    return signature;
  }

  /**
   * Sell using a provided wallet (multi-wallet mode)
   */
  async sellTokenWithWallet(wallet: Keypair, mintAddress: string, tokenAmount: number): Promise<string> {
    const response = await fetch(`${PUMPPORTAL_API_URL}/trade-local`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        publicKey: wallet.publicKey.toBase58(),
        action: 'sell',
        mint: mintAddress,
        denominatedInSol: 'false',
        amount: tokenAmount,
        slippage: 10,
        priorityFee: 0.0005,
        pool: 'pump',
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`PumpPortal API error: ${response.status} - ${errorText}`);
    }

    const transactionData = await response.arrayBuffer();
    const transaction = VersionedTransaction.deserialize(new Uint8Array(transactionData));
    const signature = await this.sendAndConfirm(transaction, [wallet]);
    return signature;
  }
}
