import {
  Connection,
  Keypair,
  VersionedTransaction,
  TransactionMessage,
  PublicKey,
  LAMPORTS_PER_SOL,
} from '@solana/web3.js';
import bs58 from 'bs58';
import fetch from 'node-fetch';
import {
  SolanaConfig,
  PumpPortalConfig,
  TokenDefaults,
  ParsedLaunchCommand,
  TokenMetadataIPFS,
  PumpPortalCreateResponse,
} from './types';

const PUMPPORTAL_API_URL = 'https://pumpportal.fun/api';

export class PumpPortalService {
  private connection: Connection;
  private wallet: Keypair;
  private config: PumpPortalConfig;
  private defaults: TokenDefaults;

  constructor(
    solanaConfig: SolanaConfig,
    pumpPortalConfig: PumpPortalConfig,
    defaults: TokenDefaults
  ) {
    this.connection = new Connection(solanaConfig.rpcUrl, 'confirmed');
    this.wallet = Keypair.fromSecretKey(bs58.decode(solanaConfig.privateKey));
    this.config = pumpPortalConfig;
    this.defaults = defaults;

    console.log(`Wallet initialized: ${this.wallet.publicKey.toBase58()}`);
  }

  /**
   * Get wallet public key
   */
  getWalletAddress(): string {
    return this.wallet.publicKey.toBase58();
  }

  /**
   * Get wallet SOL balance
   */
  async getBalance(): Promise<number> {
    const balance = await this.connection.getBalance(this.wallet.publicKey);
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

  /**
   * Create a new token on PumpFun via PumpPortal
   */
  async createToken(command: ParsedLaunchCommand): Promise<{
    signature: string;
    mint: string;
  }> {
    console.log(`\nCreating token: ${command.ticker} (${command.name})`);
    console.log(`  Description: ${command.description?.substring(0, 50)}...`);
    console.log(`  Tweet: https://twitter.com/${command.tweetAuthor}/status/${command.tweetId}`);

    // Check wallet balance
    const balance = await this.getBalance();
    console.log(`  Wallet balance: ${balance.toFixed(4)} SOL`);

    const requiredBalance = this.defaults.initialBuySol + 0.05; // Initial buy + fees
    if (balance < requiredBalance) {
      throw new Error(
        `Insufficient balance. Have ${balance.toFixed(4)} SOL, need at least ${requiredBalance.toFixed(4)} SOL`
      );
    }

    // Generate a new mint keypair for the token
    const mintKeypair = Keypair.generate();
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
      throw new Error(`PumpPortal API error: ${response.status} - ${errorText}`);
    }

    // Get the transaction from the response
    const transactionData = await response.arrayBuffer();
    const transaction = VersionedTransaction.deserialize(new Uint8Array(transactionData));

    // Sign the transaction with both the wallet and mint keypair
    console.log('Signing transaction...');
    transaction.sign([this.wallet, mintKeypair]);

    // Send the transaction
    console.log('Sending transaction to Solana...');
    const signature = await this.connection.sendTransaction(transaction, {
      skipPreflight: false,
      preflightCommitment: 'confirmed',
      maxRetries: 3,
    });

    console.log(`Transaction sent: ${signature}`);

    // Wait for confirmation
    console.log('Waiting for confirmation...');
    const confirmation = await this.connection.confirmTransaction(signature, 'confirmed');

    if (confirmation.value.err) {
      throw new Error(`Transaction failed: ${JSON.stringify(confirmation.value.err)}`);
    }

    console.log(`\nToken created successfully!`);
    console.log(`  Signature: ${signature}`);
    console.log(`  Mint: ${mintKeypair.publicKey.toBase58()}`);
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
  async buyToken(mintAddress: string, solAmount: number): Promise<string> {
    console.log(`\nBuying ${solAmount} SOL worth of token ${mintAddress}`);

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

    transaction.sign([this.wallet]);

    const signature = await this.connection.sendTransaction(transaction, {
      skipPreflight: false,
      preflightCommitment: 'confirmed',
    });

    await this.connection.confirmTransaction(signature, 'confirmed');

    console.log(`Buy transaction confirmed: ${signature}`);
    return signature;
  }

  /**
   * Sell tokens on PumpFun
   */
  async sellToken(mintAddress: string, tokenAmount: number): Promise<string> {
    console.log(`\nSelling ${tokenAmount} tokens of ${mintAddress}`);

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

    transaction.sign([this.wallet]);

    const signature = await this.connection.sendTransaction(transaction, {
      skipPreflight: false,
      preflightCommitment: 'confirmed',
    });

    await this.connection.confirmTransaction(signature, 'confirmed');

    console.log(`Sell transaction confirmed: ${signature}`);
    return signature;
  }
}
