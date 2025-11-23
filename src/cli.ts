import * as readline from 'readline';
import { Keypair, Connection, LAMPORTS_PER_SOL, PublicKey, Transaction, SystemProgram, sendAndConfirmTransaction } from '@solana/web3.js';
import * as bs58 from 'bs58';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config();

const fetch = require('node-fetch');
const PUMPPORTAL_API_URL = 'https://pumpportal.fun/api';

// ============================================
// TYPES
// ============================================

interface TokenMetadata {
  name: string;
  symbol: string;
  description: string;
  imageUrl?: string;
  twitter?: string;
  telegram?: string;
  website?: string;
}

interface LaunchConfig {
  metadata: TokenMetadata;
  initialBuySol: number;
  slippage: number;
  priorityFee: number;
  autoBuy: {
    enabled: boolean;
    walletIndices: number[];
    amountPerWallet: number;
    randomizeAmount: boolean;
    minAmount: number;
    maxAmount: number;
    delayBetweenBuys: number; // ms
  };
}

interface WalletInfo {
  name: string;
  publicKey: string;
  privateKey: string;
  createdAt: string;
  isMain: boolean;
}

interface BundlerConfig {
  enabled: boolean;
  jitoEnabled: boolean;
  jitoTipLamports: number;
  jitoBlockEngineUrl: string;
  maxBundleSize: number;
  retryAttempts: number;
}

interface CLIConfig {
  wallets: WalletInfo[];
  bundler: BundlerConfig;
  rpcUrl: string;
  activeWalletIndex: number;
}

// ============================================
// AUTO-SELL & TRADING TYPES
// ============================================

interface AutoSellConfig {
  id: string;
  tokenMint: string;
  tokenSymbol: string;
  walletIndex: number;
  enabled: boolean;
  takeProfitPercent: number | null;     // e.g., 100 = sell at 2x
  stopLossPercent: number | null;       // e.g., -50 = sell at 50% loss
  trailingStopPercent: number | null;   // e.g., 20 = 20% below highest
  sellPercent: number;                   // How much to sell (100 = all)
  entryPriceSol: number;
  highestPriceSol: number;              // For trailing stop
  createdAt: string;
}

interface Position {
  tokenMint: string;
  tokenSymbol: string;
  walletIndex: number;
  walletName: string;
  tokenBalance: number;
  avgEntryPrice: number;
  currentPrice: number;
  totalInvested: number;
  currentValue: number;
  pnlSol: number;
  pnlPercent: number;
  lastUpdated: string;
}

interface VolumeConfig {
  id: string;
  tokenMint: string;
  tokenSymbol: string;
  enabled: boolean;
  walletIndices: number[];
  minBuySol: number;
  maxBuySol: number;
  minDelayMs: number;
  maxDelayMs: number;
  cycleCount: number;          // How many buy/sell cycles
  completedCycles: number;
  sellDelayMs: number;         // Delay before selling after buy
  randomizeOrder: boolean;     // Randomize wallet order
  createdAt: string;
}

interface BumpConfig {
  id: string;
  tokenMint: string;
  tokenSymbol: string;
  enabled: boolean;
  walletIndices: number[];
  minBuySol: number;
  maxBuySol: number;
  minIntervalMs: number;
  maxIntervalMs: number;
  totalBumps: number;          // Total bumps to perform (0 = infinite)
  completedBumps: number;
  rotateWallets: boolean;      // Rotate through wallets
  currentWalletIndex: number;  // Track current wallet in rotation
  createdAt: string;
}

interface TradingConfig {
  autoSells: AutoSellConfig[];
  positions: Position[];
  volumeTasks: VolumeConfig[];
  bumpTasks: BumpConfig[];
  priceCheckIntervalMs: number;
}

// ============================================
// CLI CLASS
// ============================================

class InteractiveCLI {
  private rl: readline.Interface;
  private config: CLIConfig;
  private configPath: string;
  private tradingConfig: TradingConfig;
  private tradingConfigPath: string;
  private connection: Connection;
  private priceMonitorInterval: NodeJS.Timeout | null = null;
  private volumeTaskIntervals: Map<string, NodeJS.Timeout> = new Map();
  private bumpTaskIntervals: Map<string, NodeJS.Timeout> = new Map();

  constructor() {
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    this.configPath = path.join(process.cwd(), '.cli-config.json');
    this.tradingConfigPath = path.join(process.cwd(), '.trading-config.json');
    this.config = this.loadConfig();
    this.tradingConfig = this.loadTradingConfig();
    this.connection = new Connection(this.config.rpcUrl, 'confirmed');
  }

  private loadConfig(): CLIConfig {
    const defaultConfig: CLIConfig = {
      wallets: [],
      bundler: {
        enabled: false,
        jitoEnabled: false,
        jitoTipLamports: 10000, // 0.00001 SOL default tip
        jitoBlockEngineUrl: 'https://mainnet.block-engine.jito.wtf',
        maxBundleSize: 5,
        retryAttempts: 3,
      },
      rpcUrl: process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com',
      activeWalletIndex: -1,
    };

    // Load main wallet from env if exists
    if (process.env.SOLANA_PRIVATE_KEY) {
      try {
        const keypair = Keypair.fromSecretKey(bs58.decode(process.env.SOLANA_PRIVATE_KEY));
        defaultConfig.wallets.push({
          name: 'Main Wallet (from .env)',
          publicKey: keypair.publicKey.toBase58(),
          privateKey: process.env.SOLANA_PRIVATE_KEY,
          createdAt: new Date().toISOString(),
          isMain: true,
        });
        defaultConfig.activeWalletIndex = 0;
      } catch (e) {
        console.log('Warning: Could not load main wallet from SOLANA_PRIVATE_KEY');
      }
    }

    if (fs.existsSync(this.configPath)) {
      try {
        const saved = JSON.parse(fs.readFileSync(this.configPath, 'utf-8'));
        return { ...defaultConfig, ...saved };
      } catch (e) {
        return defaultConfig;
      }
    }
    return defaultConfig;
  }

  private saveConfig(): void {
    // Don't save main wallet private key to file
    const configToSave = {
      ...this.config,
      wallets: this.config.wallets.map(w => w.isMain ? { ...w, privateKey: '[FROM_ENV]' } : w),
    };
    fs.writeFileSync(this.configPath, JSON.stringify(configToSave, null, 2));
  }

  private loadTradingConfig(): TradingConfig {
    const defaultConfig: TradingConfig = {
      autoSells: [],
      positions: [],
      volumeTasks: [],
      bumpTasks: [],
      priceCheckIntervalMs: 5000, // 5 seconds
    };

    if (fs.existsSync(this.tradingConfigPath)) {
      try {
        const saved = JSON.parse(fs.readFileSync(this.tradingConfigPath, 'utf-8'));
        return { ...defaultConfig, ...saved };
      } catch (e) {
        return defaultConfig;
      }
    }
    return defaultConfig;
  }

  private saveTradingConfig(): void {
    fs.writeFileSync(this.tradingConfigPath, JSON.stringify(this.tradingConfig, null, 2));
  }

  private generateId(): string {
    return Math.random().toString(36).substring(2, 15);
  }

  private prompt(question: string): Promise<string> {
    return new Promise((resolve) => {
      this.rl.question(question, (answer) => {
        resolve(answer.trim());
      });
    });
  }

  private clearScreen(): void {
    console.clear();
  }

  private printHeader(): void {
    console.log('\n' + '='.repeat(60));
    console.log('       ALPHA SIGNAL BOT - Interactive CLI');
    console.log('='.repeat(60));
  }

  private printMenu(title: string, options: string[]): void {
    console.log(`\n--- ${title} ---\n`);
    options.forEach((opt, i) => {
      console.log(`  ${i + 1}. ${opt}`);
    });
    console.log(`  0. Back / Exit\n`);
  }

  // ============================================
  // WALLET MANAGEMENT
  // ============================================

  private async createNewWallet(): Promise<void> {
    this.clearScreen();
    console.log('\n--- Create New Wallet ---\n');

    const name = await this.prompt('Enter wallet name (e.g., "Burner 1"): ');
    if (!name) {
      console.log('Cancelled.');
      return;
    }

    const keypair = Keypair.generate();
    const wallet: WalletInfo = {
      name,
      publicKey: keypair.publicKey.toBase58(),
      privateKey: bs58.encode(keypair.secretKey),
      createdAt: new Date().toISOString(),
      isMain: false,
    };

    this.config.wallets.push(wallet);
    this.saveConfig();

    console.log('\n[SUCCESS] New wallet created!\n');
    console.log(`  Name:        ${wallet.name}`);
    console.log(`  Public Key:  ${wallet.publicKey}`);
    console.log(`  Private Key: ${wallet.privateKey}`);
    console.log('\n  IMPORTANT: Save the private key securely!');
    console.log('  This wallet is unlinked and stored locally.\n');

    await this.prompt('Press Enter to continue...');
  }

  private async listWallets(): Promise<void> {
    this.clearScreen();
    console.log('\n--- Wallet List ---\n');

    if (this.config.wallets.length === 0) {
      console.log('  No wallets configured.\n');
      await this.prompt('Press Enter to continue...');
      return;
    }

    for (let i = 0; i < this.config.wallets.length; i++) {
      const w = this.config.wallets[i];
      const active = i === this.config.activeWalletIndex ? ' [ACTIVE]' : '';
      const main = w.isMain ? ' (Main)' : ' (Unlinked)';

      try {
        const balance = await this.connection.getBalance(new PublicKey(w.publicKey));
        const solBalance = (balance / LAMPORTS_PER_SOL).toFixed(4);
        console.log(`  ${i + 1}. ${w.name}${main}${active}`);
        console.log(`     Address: ${w.publicKey}`);
        console.log(`     Balance: ${solBalance} SOL\n`);
      } catch (e) {
        console.log(`  ${i + 1}. ${w.name}${main}${active}`);
        console.log(`     Address: ${w.publicKey}`);
        console.log(`     Balance: (error fetching)\n`);
      }
    }

    await this.prompt('Press Enter to continue...');
  }

  private async setActiveWallet(): Promise<void> {
    this.clearScreen();
    console.log('\n--- Set Active Wallet ---\n');

    if (this.config.wallets.length === 0) {
      console.log('  No wallets available.\n');
      await this.prompt('Press Enter to continue...');
      return;
    }

    this.config.wallets.forEach((w, i) => {
      const active = i === this.config.activeWalletIndex ? ' [CURRENT]' : '';
      console.log(`  ${i + 1}. ${w.name}${active}`);
    });

    const choice = await this.prompt('\nSelect wallet number (0 to cancel): ');
    const index = parseInt(choice, 10) - 1;

    if (index >= 0 && index < this.config.wallets.length) {
      this.config.activeWalletIndex = index;
      this.saveConfig();
      console.log(`\n[SUCCESS] Active wallet set to: ${this.config.wallets[index].name}`);
    }

    await this.prompt('Press Enter to continue...');
  }

  private async exportWallet(): Promise<void> {
    this.clearScreen();
    console.log('\n--- Export Wallet Private Key ---\n');

    if (this.config.wallets.length === 0) {
      console.log('  No wallets available.\n');
      await this.prompt('Press Enter to continue...');
      return;
    }

    this.config.wallets.forEach((w, i) => {
      console.log(`  ${i + 1}. ${w.name} - ${w.publicKey.substring(0, 20)}...`);
    });

    const choice = await this.prompt('\nSelect wallet number (0 to cancel): ');
    const index = parseInt(choice, 10) - 1;

    if (index >= 0 && index < this.config.wallets.length) {
      const wallet = this.config.wallets[index];
      if (wallet.isMain) {
        console.log('\n  Main wallet private key is in your .env file.');
      } else {
        console.log(`\n  Private Key: ${wallet.privateKey}`);
      }
      console.log('\n  WARNING: Keep this key secure and never share it!');
    }

    await this.prompt('Press Enter to continue...');
  }

  private async fundWallet(): Promise<void> {
    this.clearScreen();
    console.log('\n--- Fund Wallet (Transfer SOL) ---\n');

    if (this.config.wallets.length < 2) {
      console.log('  Need at least 2 wallets to transfer between them.\n');
      await this.prompt('Press Enter to continue...');
      return;
    }

    console.log('Source wallets:');
    this.config.wallets.forEach((w, i) => {
      console.log(`  ${i + 1}. ${w.name} - ${w.publicKey.substring(0, 20)}...`);
    });

    const fromChoice = await this.prompt('\nSelect SOURCE wallet number: ');
    const fromIndex = parseInt(fromChoice, 10) - 1;
    if (fromIndex < 0 || fromIndex >= this.config.wallets.length) {
      console.log('Invalid selection.');
      await this.prompt('Press Enter to continue...');
      return;
    }

    const toChoice = await this.prompt('Select DESTINATION wallet number: ');
    const toIndex = parseInt(toChoice, 10) - 1;
    if (toIndex < 0 || toIndex >= this.config.wallets.length || toIndex === fromIndex) {
      console.log('Invalid selection.');
      await this.prompt('Press Enter to continue...');
      return;
    }

    const amountStr = await this.prompt('Amount in SOL to transfer: ');
    const amount = parseFloat(amountStr);
    if (isNaN(amount) || amount <= 0) {
      console.log('Invalid amount.');
      await this.prompt('Press Enter to continue...');
      return;
    }

    const fromWallet = this.config.wallets[fromIndex];
    const toWallet = this.config.wallets[toIndex];

    console.log(`\nTransferring ${amount} SOL`);
    console.log(`  From: ${fromWallet.name}`);
    console.log(`  To:   ${toWallet.name}`);

    const confirm = await this.prompt('\nConfirm? (yes/no): ');
    if (confirm.toLowerCase() !== 'yes') {
      console.log('Cancelled.');
      await this.prompt('Press Enter to continue...');
      return;
    }

    try {
      const fromKeypair = Keypair.fromSecretKey(bs58.decode(fromWallet.privateKey));
      const toPublicKey = new PublicKey(toWallet.publicKey);

      const transaction = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: fromKeypair.publicKey,
          toPubkey: toPublicKey,
          lamports: Math.floor(amount * LAMPORTS_PER_SOL),
        })
      );

      console.log('\nSending transaction...');
      const signature = await sendAndConfirmTransaction(this.connection, transaction, [fromKeypair]);
      console.log(`\n[SUCCESS] Transaction confirmed!`);
      console.log(`  Signature: ${signature}`);
    } catch (error: any) {
      console.log(`\n[ERROR] Transfer failed: ${error.message}`);
    }

    await this.prompt('Press Enter to continue...');
  }

  private async spreadSolToWallets(): Promise<void> {
    this.clearScreen();
    console.log('\n--- Spread SOL Across Wallets ---\n');

    if (this.config.wallets.length < 2) {
      console.log('  Need at least 2 wallets to spread SOL.\n');
      await this.prompt('Press Enter to continue...');
      return;
    }

    console.log('Select SOURCE wallet:');
    this.config.wallets.forEach((w, i) => {
      console.log(`  ${i + 1}. ${w.name} - ${w.publicKey.substring(0, 20)}...`);
    });

    const fromChoice = await this.prompt('\nSource wallet number: ');
    const fromIndex = parseInt(fromChoice, 10) - 1;
    if (fromIndex < 0 || fromIndex >= this.config.wallets.length) {
      console.log('Invalid selection.');
      await this.prompt('Press Enter to continue...');
      return;
    }

    const sourceWallet = this.config.wallets[fromIndex];
    const destWallets = this.config.wallets.filter((_, i) => i !== fromIndex);

    if (destWallets.length === 0) {
      console.log('No destination wallets available.');
      await this.prompt('Press Enter to continue...');
      return;
    }

    console.log('\nDestination wallets:');
    destWallets.forEach((w, i) => {
      console.log(`  ${i + 1}. ${w.name}`);
    });

    const destChoice = await this.prompt('\nSelect destinations (comma-separated, or "all"): ');
    let selectedDests: typeof destWallets;

    if (destChoice.toLowerCase() === 'all') {
      selectedDests = destWallets;
    } else {
      const indices = destChoice.split(',').map(s => parseInt(s.trim(), 10) - 1);
      selectedDests = indices
        .filter(i => i >= 0 && i < destWallets.length)
        .map(i => destWallets[i]);
    }

    if (selectedDests.length === 0) {
      console.log('No valid destinations selected.');
      await this.prompt('Press Enter to continue...');
      return;
    }

    const totalStr = await this.prompt('Total SOL to spread: ');
    const totalSol = parseFloat(totalStr);
    if (isNaN(totalSol) || totalSol <= 0) {
      console.log('Invalid amount.');
      await this.prompt('Press Enter to continue...');
      return;
    }

    console.log('\nDistribution method:');
    console.log('  1. Equal split');
    console.log('  2. Random amounts');
    console.log('  3. Random with variance %');

    const methodChoice = await this.prompt('\nSelect method: ');

    let amounts: number[] = [];
    const numDests = selectedDests.length;

    switch (methodChoice) {
      case '1': // Equal split
        const equalAmount = totalSol / numDests;
        amounts = Array(numDests).fill(equalAmount);
        break;

      case '2': // Random amounts
        // Generate random weights and normalize
        const weights = Array(numDests).fill(0).map(() => Math.random());
        const totalWeight = weights.reduce((a, b) => a + b, 0);
        amounts = weights.map(w => (w / totalWeight) * totalSol);
        break;

      case '3': // Random with variance
        const varianceStr = await this.prompt('Variance % (e.g., 20 for +/- 20%): ');
        const variance = parseFloat(varianceStr) / 100;
        const baseAmount = totalSol / numDests;

        // Generate amounts with variance
        let rawAmounts = Array(numDests).fill(0).map(() => {
          const randomFactor = 1 + (Math.random() * 2 - 1) * variance;
          return baseAmount * randomFactor;
        });

        // Normalize to match total
        const rawTotal = rawAmounts.reduce((a, b) => a + b, 0);
        amounts = rawAmounts.map(a => (a / rawTotal) * totalSol);
        break;

      default:
        console.log('Invalid method.');
        await this.prompt('Press Enter to continue...');
        return;
    }

    // Display planned distribution
    console.log('\n--- Planned Distribution ---\n');
    selectedDests.forEach((w, i) => {
      console.log(`  ${w.name}: ${amounts[i].toFixed(6)} SOL`);
    });
    console.log(`\n  Total: ${amounts.reduce((a, b) => a + b, 0).toFixed(6)} SOL`);
    console.log(`  From: ${sourceWallet.name}`);

    const confirm = await this.prompt('\nExecute? (yes/no): ');
    if (confirm.toLowerCase() !== 'yes') {
      console.log('Cancelled.');
      await this.prompt('Press Enter to continue...');
      return;
    }

    // Execute transfers
    console.log('\nExecuting transfers...\n');
    const fromKeypair = Keypair.fromSecretKey(bs58.decode(sourceWallet.privateKey));

    for (let i = 0; i < selectedDests.length; i++) {
      const dest = selectedDests[i];
      const amount = amounts[i];

      try {
        const toPublicKey = new PublicKey(dest.publicKey);
        const transaction = new Transaction().add(
          SystemProgram.transfer({
            fromPubkey: fromKeypair.publicKey,
            toPubkey: toPublicKey,
            lamports: Math.floor(amount * LAMPORTS_PER_SOL),
          })
        );

        const signature = await sendAndConfirmTransaction(this.connection, transaction, [fromKeypair]);
        console.log(`  [OK] ${dest.name}: ${amount.toFixed(6)} SOL`);
        console.log(`       Sig: ${signature.substring(0, 30)}...`);
      } catch (error: any) {
        console.log(`  [FAIL] ${dest.name}: ${error.message}`);
      }
    }

    console.log('\nSpread complete!');
    await this.prompt('Press Enter to continue...');
  }

  private async collectSolFromWallets(): Promise<void> {
    this.clearScreen();
    console.log('\n--- Collect SOL From Wallets ---\n');

    if (this.config.wallets.length < 2) {
      console.log('  Need at least 2 wallets.\n');
      await this.prompt('Press Enter to continue...');
      return;
    }

    console.log('Select DESTINATION wallet (to collect into):');
    this.config.wallets.forEach((w, i) => {
      console.log(`  ${i + 1}. ${w.name} - ${w.publicKey.substring(0, 20)}...`);
    });

    const destChoice = await this.prompt('\nDestination wallet number: ');
    const destIndex = parseInt(destChoice, 10) - 1;
    if (destIndex < 0 || destIndex >= this.config.wallets.length) {
      console.log('Invalid selection.');
      await this.prompt('Press Enter to continue...');
      return;
    }

    const destWallet = this.config.wallets[destIndex];
    const sourceWallets = this.config.wallets.filter((_, i) => i !== destIndex && !this.config.wallets[i].isMain);

    if (sourceWallets.length === 0) {
      console.log('No source wallets available (main wallet cannot be drained).');
      await this.prompt('Press Enter to continue...');
      return;
    }

    // Check balances
    console.log('\nChecking balances...\n');
    const walletsWithBalances: Array<{ wallet: WalletInfo; balance: number }> = [];

    for (const w of sourceWallets) {
      try {
        const balance = await this.connection.getBalance(new PublicKey(w.publicKey));
        const solBalance = balance / LAMPORTS_PER_SOL;
        console.log(`  ${w.name}: ${solBalance.toFixed(6)} SOL`);
        if (solBalance > 0.001) { // Only include wallets with meaningful balance
          walletsWithBalances.push({ wallet: w, balance: solBalance });
        }
      } catch (e) {
        console.log(`  ${w.name}: (error checking balance)`);
      }
    }

    if (walletsWithBalances.length === 0) {
      console.log('\nNo wallets with sufficient balance to collect.');
      await this.prompt('Press Enter to continue...');
      return;
    }

    const leaveStr = await this.prompt('\nSOL to leave in each wallet (for rent, default 0.001): ');
    const leaveAmount = parseFloat(leaveStr) || 0.001;

    const totalCollectable = walletsWithBalances.reduce((sum, w) => {
      const collectAmount = w.balance - leaveAmount - 0.000005; // minus tx fee
      return sum + Math.max(0, collectAmount);
    }, 0);

    console.log(`\nTotal collectable: ~${totalCollectable.toFixed(6)} SOL`);
    console.log(`Into: ${destWallet.name}`);

    const confirm = await this.prompt('\nCollect? (yes/no): ');
    if (confirm.toLowerCase() !== 'yes') {
      console.log('Cancelled.');
      await this.prompt('Press Enter to continue...');
      return;
    }

    console.log('\nCollecting...\n');
    const destPublicKey = new PublicKey(destWallet.publicKey);

    for (const { wallet, balance } of walletsWithBalances) {
      const collectAmount = balance - leaveAmount - 0.000005;
      if (collectAmount <= 0) continue;

      try {
        const fromKeypair = Keypair.fromSecretKey(bs58.decode(wallet.privateKey));
        const transaction = new Transaction().add(
          SystemProgram.transfer({
            fromPubkey: fromKeypair.publicKey,
            toPubkey: destPublicKey,
            lamports: Math.floor(collectAmount * LAMPORTS_PER_SOL),
          })
        );

        const signature = await sendAndConfirmTransaction(this.connection, transaction, [fromKeypair]);
        console.log(`  [OK] ${wallet.name}: ${collectAmount.toFixed(6)} SOL`);
        console.log(`       Sig: ${signature.substring(0, 30)}...`);
      } catch (error: any) {
        console.log(`  [FAIL] ${wallet.name}: ${error.message}`);
      }
    }

    console.log('\nCollection complete!');
    await this.prompt('Press Enter to continue...');
  }

  private async randomizeAndSpread(): Promise<void> {
    this.clearScreen();
    console.log('\n--- Randomize & Spread SOL ---\n');
    console.log('This creates a random distribution pattern to avoid detection.\n');

    if (this.config.wallets.length < 2) {
      console.log('  Need at least 2 wallets.\n');
      await this.prompt('Press Enter to continue...');
      return;
    }

    console.log('Select SOURCE wallet:');
    this.config.wallets.forEach((w, i) => {
      console.log(`  ${i + 1}. ${w.name}`);
    });

    const fromChoice = await this.prompt('\nSource wallet number: ');
    const fromIndex = parseInt(fromChoice, 10) - 1;
    if (fromIndex < 0 || fromIndex >= this.config.wallets.length) {
      console.log('Invalid selection.');
      await this.prompt('Press Enter to continue...');
      return;
    }

    const sourceWallet = this.config.wallets[fromIndex];
    const destWallets = this.config.wallets.filter((_, i) => i !== fromIndex);

    const totalStr = await this.prompt('Total SOL to distribute: ');
    const totalSol = parseFloat(totalStr);
    if (isNaN(totalSol) || totalSol <= 0) {
      console.log('Invalid amount.');
      await this.prompt('Press Enter to continue...');
      return;
    }

    const minStr = await this.prompt('Min SOL per wallet (e.g., 0.01): ');
    const minSol = parseFloat(minStr) || 0.01;

    const maxStr = await this.prompt('Max SOL per wallet (e.g., 0.5): ');
    const maxSol = parseFloat(maxStr) || 0.5;

    if (minSol > maxSol) {
      console.log('Min cannot be greater than max.');
      await this.prompt('Press Enter to continue...');
      return;
    }

    // Generate random distribution
    const distribution: Array<{ wallet: WalletInfo; amount: number }> = [];
    let remaining = totalSol;
    const shuffledDests = [...destWallets].sort(() => Math.random() - 0.5);

    for (const wallet of shuffledDests) {
      if (remaining < minSol) break;

      // Random amount between min and max, but not more than remaining
      const maxPossible = Math.min(maxSol, remaining - (minSol * (shuffledDests.length - distribution.length - 1)));
      const amount = minSol + Math.random() * (maxPossible - minSol);

      distribution.push({ wallet, amount });
      remaining -= amount;
    }

    // Add any remaining to the last wallet
    if (remaining > 0 && distribution.length > 0) {
      distribution[distribution.length - 1].amount += remaining;
    }

    // Display plan
    console.log('\n--- Randomized Distribution ---\n');
    distribution.forEach(({ wallet, amount }) => {
      console.log(`  ${wallet.name}: ${amount.toFixed(6)} SOL`);
    });
    console.log(`\n  Total: ${distribution.reduce((s, d) => s + d.amount, 0).toFixed(6)} SOL`);

    // Add random delays option
    const delayStr = await this.prompt('\nAdd random delays between transfers? (yes/no): ');
    const addDelays = delayStr.toLowerCase() === 'yes';

    const confirm = await this.prompt('\nExecute? (yes/no): ');
    if (confirm.toLowerCase() !== 'yes') {
      console.log('Cancelled.');
      await this.prompt('Press Enter to continue...');
      return;
    }

    // Execute
    console.log('\nExecuting randomized transfers...\n');
    const fromKeypair = Keypair.fromSecretKey(bs58.decode(sourceWallet.privateKey));

    for (let i = 0; i < distribution.length; i++) {
      const { wallet, amount } = distribution[i];

      // Random delay (1-5 seconds)
      if (addDelays && i > 0) {
        const delay = 1000 + Math.random() * 4000;
        console.log(`  Waiting ${(delay / 1000).toFixed(1)}s...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }

      try {
        const toPublicKey = new PublicKey(wallet.publicKey);
        const transaction = new Transaction().add(
          SystemProgram.transfer({
            fromPubkey: fromKeypair.publicKey,
            toPubkey: toPublicKey,
            lamports: Math.floor(amount * LAMPORTS_PER_SOL),
          })
        );

        const signature = await sendAndConfirmTransaction(this.connection, transaction, [fromKeypair]);
        console.log(`  [OK] ${wallet.name}: ${amount.toFixed(6)} SOL`);
      } catch (error: any) {
        console.log(`  [FAIL] ${wallet.name}: ${error.message}`);
      }
    }

    console.log('\nRandomized spread complete!');
    await this.prompt('Press Enter to continue...');
  }

  private async deleteWallet(): Promise<void> {
    this.clearScreen();
    console.log('\n--- Delete Wallet ---\n');

    const unlinkedWallets = this.config.wallets.filter(w => !w.isMain);
    if (unlinkedWallets.length === 0) {
      console.log('  No unlinked wallets to delete.\n');
      await this.prompt('Press Enter to continue...');
      return;
    }

    console.log('  WARNING: This will remove the wallet from CLI config.');
    console.log('  Make sure you have the private key backed up!\n');

    unlinkedWallets.forEach((w, i) => {
      console.log(`  ${i + 1}. ${w.name} - ${w.publicKey.substring(0, 20)}...`);
    });

    const choice = await this.prompt('\nSelect wallet to delete (0 to cancel): ');
    const index = parseInt(choice, 10) - 1;

    if (index >= 0 && index < unlinkedWallets.length) {
      const walletToDelete = unlinkedWallets[index];
      const confirm = await this.prompt(`Delete "${walletToDelete.name}"? (yes/no): `);

      if (confirm.toLowerCase() === 'yes') {
        const realIndex = this.config.wallets.findIndex(w => w.publicKey === walletToDelete.publicKey);
        this.config.wallets.splice(realIndex, 1);
        if (this.config.activeWalletIndex >= realIndex) {
          this.config.activeWalletIndex = Math.max(0, this.config.activeWalletIndex - 1);
        }
        this.saveConfig();
        console.log('\n[SUCCESS] Wallet deleted.');
      }
    }

    await this.prompt('Press Enter to continue...');
  }

  // ============================================
  // BUNDLER CONFIGURATION
  // ============================================

  private async configureBundler(): Promise<void> {
    while (true) {
      this.clearScreen();
      console.log('\n--- Bundler Configuration ---\n');

      const b = this.config.bundler;
      console.log(`  Current Settings:`);
      console.log(`    Bundler Enabled:     ${b.enabled ? 'YES' : 'NO'}`);
      console.log(`    Jito Bundles:        ${b.jitoEnabled ? 'YES' : 'NO'}`);
      console.log(`    Jito Tip:            ${b.jitoTipLamports} lamports (${(b.jitoTipLamports / LAMPORTS_PER_SOL).toFixed(6)} SOL)`);
      console.log(`    Block Engine URL:    ${b.jitoBlockEngineUrl}`);
      console.log(`    Max Bundle Size:     ${b.maxBundleSize} transactions`);
      console.log(`    Retry Attempts:      ${b.retryAttempts}`);

      this.printMenu('Bundler Options', [
        `Toggle Bundler (currently: ${b.enabled ? 'ON' : 'OFF'})`,
        `Toggle Jito Bundles (currently: ${b.jitoEnabled ? 'ON' : 'OFF'})`,
        'Set Jito Tip Amount',
        'Set Block Engine URL',
        'Set Max Bundle Size',
        'Set Retry Attempts',
      ]);

      const choice = await this.prompt('Select option: ');

      switch (choice) {
        case '1':
          this.config.bundler.enabled = !this.config.bundler.enabled;
          this.saveConfig();
          console.log(`\nBundler ${this.config.bundler.enabled ? 'enabled' : 'disabled'}.`);
          await this.prompt('Press Enter to continue...');
          break;

        case '2':
          this.config.bundler.jitoEnabled = !this.config.bundler.jitoEnabled;
          this.saveConfig();
          console.log(`\nJito bundles ${this.config.bundler.jitoEnabled ? 'enabled' : 'disabled'}.`);
          await this.prompt('Press Enter to continue...');
          break;

        case '3':
          const tipStr = await this.prompt('Enter Jito tip in lamports (e.g., 10000): ');
          const tip = parseInt(tipStr, 10);
          if (!isNaN(tip) && tip >= 0) {
            this.config.bundler.jitoTipLamports = tip;
            this.saveConfig();
            console.log(`\nJito tip set to ${tip} lamports.`);
          }
          await this.prompt('Press Enter to continue...');
          break;

        case '4':
          const url = await this.prompt('Enter Block Engine URL: ');
          if (url) {
            this.config.bundler.jitoBlockEngineUrl = url;
            this.saveConfig();
            console.log(`\nBlock Engine URL updated.`);
          }
          await this.prompt('Press Enter to continue...');
          break;

        case '5':
          const sizeStr = await this.prompt('Enter max bundle size (1-5): ');
          const size = parseInt(sizeStr, 10);
          if (!isNaN(size) && size >= 1 && size <= 5) {
            this.config.bundler.maxBundleSize = size;
            this.saveConfig();
            console.log(`\nMax bundle size set to ${size}.`);
          }
          await this.prompt('Press Enter to continue...');
          break;

        case '6':
          const retryStr = await this.prompt('Enter retry attempts (1-10): ');
          const retry = parseInt(retryStr, 10);
          if (!isNaN(retry) && retry >= 1 && retry <= 10) {
            this.config.bundler.retryAttempts = retry;
            this.saveConfig();
            console.log(`\nRetry attempts set to ${retry}.`);
          }
          await this.prompt('Press Enter to continue...');
          break;

        case '0':
          return;

        default:
          break;
      }
    }
  }

  // ============================================
  // WALLET MENU
  // ============================================

  private async walletMenu(): Promise<void> {
    while (true) {
      this.clearScreen();
      this.printMenu('Wallet Management', [
        'Create New Wallet (Unlinked)',
        'List All Wallets & Balances',
        'Set Active Wallet',
        'Export Wallet Private Key',
        'Fund Wallet (Transfer SOL)',
        'Spread SOL Across Wallets',
        'Collect SOL From Wallets',
        'Randomize & Spread (with delays)',
        'Delete Wallet',
      ]);

      const choice = await this.prompt('Select option: ');

      switch (choice) {
        case '1':
          await this.createNewWallet();
          break;
        case '2':
          await this.listWallets();
          break;
        case '3':
          await this.setActiveWallet();
          break;
        case '4':
          await this.exportWallet();
          break;
        case '5':
          await this.fundWallet();
          break;
        case '6':
          await this.spreadSolToWallets();
          break;
        case '7':
          await this.collectSolFromWallets();
          break;
        case '8':
          await this.randomizeAndSpread();
          break;
        case '9':
          await this.deleteWallet();
          break;
        case '0':
          return;
        default:
          break;
      }
    }
  }

  // ============================================
  // SETTINGS MENU
  // ============================================

  private async settingsMenu(): Promise<void> {
    while (true) {
      this.clearScreen();
      console.log('\n--- Settings ---\n');
      console.log(`  RPC URL: ${this.config.rpcUrl}`);
      console.log(`  Config File: ${this.configPath}`);

      this.printMenu('Settings', [
        'Change RPC URL',
        'View Current Config',
        'Reset Config to Defaults',
      ]);

      const choice = await this.prompt('Select option: ');

      switch (choice) {
        case '1':
          const newRpc = await this.prompt('Enter new RPC URL: ');
          if (newRpc) {
            this.config.rpcUrl = newRpc;
            this.connection = new Connection(newRpc, 'confirmed');
            this.saveConfig();
            console.log('\nRPC URL updated.');
          }
          await this.prompt('Press Enter to continue...');
          break;

        case '2':
          console.log('\n--- Current Config ---');
          console.log(JSON.stringify(this.config, null, 2));
          await this.prompt('\nPress Enter to continue...');
          break;

        case '3':
          const confirm = await this.prompt('Reset all settings? (yes/no): ');
          if (confirm.toLowerCase() === 'yes') {
            if (fs.existsSync(this.configPath)) {
              fs.unlinkSync(this.configPath);
            }
            this.config = this.loadConfig();
            console.log('\nConfig reset to defaults.');
          }
          await this.prompt('Press Enter to continue...');
          break;

        case '0':
          return;

        default:
          break;
      }
    }
  }

  // ============================================
  // QUICK ACTIONS
  // ============================================

  private async quickCheckBalance(): Promise<void> {
    this.clearScreen();
    console.log('\n--- Quick Balance Check ---\n');

    const address = await this.prompt('Enter Solana address (or press Enter for active wallet): ');

    let pubkey: PublicKey;
    try {
      if (address) {
        pubkey = new PublicKey(address);
      } else if (this.config.activeWalletIndex >= 0) {
        pubkey = new PublicKey(this.config.wallets[this.config.activeWalletIndex].publicKey);
      } else {
        console.log('No active wallet set.');
        await this.prompt('Press Enter to continue...');
        return;
      }

      console.log(`\nChecking balance for: ${pubkey.toBase58()}`);
      const balance = await this.connection.getBalance(pubkey);
      console.log(`Balance: ${(balance / LAMPORTS_PER_SOL).toFixed(6)} SOL`);
    } catch (error: any) {
      console.log(`Error: ${error.message}`);
    }

    await this.prompt('\nPress Enter to continue...');
  }

  // ============================================
  // TOKEN LAUNCH METHODS
  // ============================================

  private async tokenLaunchMenu(): Promise<void> {
    while (true) {
      this.clearScreen();
      this.printMenu('Token Launch', [
        'Create New Token (Full Setup)',
        'Quick Launch (Minimal Input)',
        'Buy Existing Token',
        'Sell Token',
        'Multi-Wallet Buy (Bundled)',
        'View Recent Launches',
      ]);

      const choice = await this.prompt('Select option: ');

      switch (choice) {
        case '1':
          await this.createTokenFull();
          break;
        case '2':
          await this.quickLaunch();
          break;
        case '3':
          await this.buyToken();
          break;
        case '4':
          await this.sellToken();
          break;
        case '5':
          await this.multiWalletBuy();
          break;
        case '6':
          await this.viewRecentLaunches();
          break;
        case '0':
          return;
        default:
          break;
      }
    }
  }

  private async createTokenFull(): Promise<void> {
    this.clearScreen();
    console.log('\n--- Create New Token (PumpFun) ---\n');

    if (this.config.activeWalletIndex < 0) {
      console.log('No active wallet set. Please set one first.');
      await this.prompt('Press Enter to continue...');
      return;
    }

    const wallet = this.config.wallets[this.config.activeWalletIndex];
    console.log(`Using wallet: ${wallet.name}`);
    console.log(`Address: ${wallet.publicKey}\n`);

    // Check balance
    try {
      const balance = await this.connection.getBalance(new PublicKey(wallet.publicKey));
      console.log(`Balance: ${(balance / LAMPORTS_PER_SOL).toFixed(4)} SOL\n`);
      if (balance < 0.1 * LAMPORTS_PER_SOL) {
        console.log('Warning: Low balance. Recommend at least 0.1 SOL.');
      }
    } catch (e) {
      console.log('Could not check balance.');
    }

    // Token metadata input
    console.log('--- Token Metadata ---\n');

    const name = await this.prompt('Token Name: ');
    if (!name) {
      console.log('Name is required.');
      await this.prompt('Press Enter to continue...');
      return;
    }

    const symbol = await this.prompt('Token Symbol (e.g., PEPE): ');
    if (!symbol) {
      console.log('Symbol is required.');
      await this.prompt('Press Enter to continue...');
      return;
    }

    const description = await this.prompt('Description (optional): ') || `${symbol} - Created via CLI`;

    console.log('\n--- Social Links (optional) ---\n');
    const twitter = await this.prompt('Twitter URL: ');
    const telegram = await this.prompt('Telegram URL: ');
    const website = await this.prompt('Website URL: ');

    console.log('\n--- Launch Settings ---\n');
    const initialBuyStr = await this.prompt('Initial buy amount in SOL (default 0.1): ');
    const initialBuySol = parseFloat(initialBuyStr) || 0.1;

    const slippageStr = await this.prompt('Slippage % (default 10): ');
    const slippage = parseFloat(slippageStr) || 10;

    const priorityFeeStr = await this.prompt('Priority fee in SOL (default 0.0005): ');
    const priorityFee = parseFloat(priorityFeeStr) || 0.0005;

    // Auto-buy configuration
    console.log('\n--- Auto-Buy Settings ---\n');
    const enableAutoBuy = await this.prompt('Enable auto-buy from other wallets? (yes/no): ');

    let autoBuyConfig = {
      enabled: false,
      walletIndices: [] as number[],
      amountPerWallet: 0.05,
      randomizeAmount: false,
      minAmount: 0.01,
      maxAmount: 0.1,
      delayBetweenBuys: 1000,
    };

    if (enableAutoBuy.toLowerCase() === 'yes') {
      autoBuyConfig.enabled = true;

      // Show available wallets
      const otherWallets = this.config.wallets.filter((_, i) => i !== this.config.activeWalletIndex);
      if (otherWallets.length === 0) {
        console.log('No other wallets available for auto-buy.');
        autoBuyConfig.enabled = false;
      } else {
        console.log('\nAvailable wallets for auto-buy:');
        otherWallets.forEach((w, i) => {
          const realIndex = this.config.wallets.findIndex(ww => ww.publicKey === w.publicKey);
          console.log(`  ${realIndex + 1}. ${w.name}`);
        });

        const walletsChoice = await this.prompt('\nSelect wallets (comma-separated, or "all"): ');
        if (walletsChoice.toLowerCase() === 'all') {
          autoBuyConfig.walletIndices = otherWallets.map(w =>
            this.config.wallets.findIndex(ww => ww.publicKey === w.publicKey)
          );
        } else {
          autoBuyConfig.walletIndices = walletsChoice
            .split(',')
            .map(s => parseInt(s.trim(), 10) - 1)
            .filter(i => i >= 0 && i !== this.config.activeWalletIndex);
        }

        const randomize = await this.prompt('Randomize buy amounts? (yes/no): ');
        autoBuyConfig.randomizeAmount = randomize.toLowerCase() === 'yes';

        if (autoBuyConfig.randomizeAmount) {
          const minStr = await this.prompt('Min SOL per wallet (default 0.01): ');
          autoBuyConfig.minAmount = parseFloat(minStr) || 0.01;

          const maxStr = await this.prompt('Max SOL per wallet (default 0.1): ');
          autoBuyConfig.maxAmount = parseFloat(maxStr) || 0.1;
        } else {
          const amountStr = await this.prompt('SOL per wallet (default 0.05): ');
          autoBuyConfig.amountPerWallet = parseFloat(amountStr) || 0.05;
        }

        const delayStr = await this.prompt('Delay between buys in seconds (default 1): ');
        autoBuyConfig.delayBetweenBuys = (parseFloat(delayStr) || 1) * 1000;
      }
    }

    // Review and confirm
    this.clearScreen();
    console.log('\n--- Launch Summary ---\n');
    console.log(`Token Name:    ${name}`);
    console.log(`Symbol:        ${symbol}`);
    console.log(`Description:   ${description.substring(0, 50)}...`);
    if (twitter) console.log(`Twitter:       ${twitter}`);
    if (telegram) console.log(`Telegram:      ${telegram}`);
    if (website) console.log(`Website:       ${website}`);
    console.log(`\nInitial Buy:   ${initialBuySol} SOL`);
    console.log(`Slippage:      ${slippage}%`);
    console.log(`Priority Fee:  ${priorityFee} SOL`);
    console.log(`\nLaunch Wallet: ${wallet.name}`);

    if (autoBuyConfig.enabled) {
      console.log(`\nAuto-Buy:      YES`);
      console.log(`  Wallets:     ${autoBuyConfig.walletIndices.length}`);
      if (autoBuyConfig.randomizeAmount) {
        console.log(`  Amount:      ${autoBuyConfig.minAmount}-${autoBuyConfig.maxAmount} SOL (random)`);
      } else {
        console.log(`  Amount:      ${autoBuyConfig.amountPerWallet} SOL each`);
      }
      console.log(`  Delay:       ${autoBuyConfig.delayBetweenBuys / 1000}s between buys`);
    }

    const confirm = await this.prompt('\nLaunch token? (yes/no): ');
    if (confirm.toLowerCase() !== 'yes') {
      console.log('Cancelled.');
      await this.prompt('Press Enter to continue...');
      return;
    }

    // Execute launch
    console.log('\n--- Launching Token ---\n');

    try {
      // Generate mint keypair
      const mintKeypair = Keypair.generate();
      console.log(`Mint address: ${mintKeypair.publicKey.toBase58()}`);

      // Upload metadata to IPFS
      console.log('\nUploading metadata to IPFS...');
      const metadataUri = await this.uploadTokenMetadata({
        name,
        symbol,
        description,
        twitter,
        telegram,
        website,
      });
      console.log(`Metadata URI: ${metadataUri}`);

      // Create token
      console.log('\nCreating token on PumpFun...');
      const walletKeypair = Keypair.fromSecretKey(bs58.decode(wallet.privateKey));

      const createResult = await this.createPumpFunToken(
        walletKeypair,
        mintKeypair,
        { name, symbol, description },
        metadataUri,
        initialBuySol,
        slippage,
        priorityFee
      );

      console.log(`\n[SUCCESS] Token created!`);
      console.log(`  Signature: ${createResult.signature}`);
      console.log(`  Mint: ${mintKeypair.publicKey.toBase58()}`);
      console.log(`  PumpFun: https://pump.fun/${mintKeypair.publicKey.toBase58()}`);
      console.log(`  Solscan: https://solscan.io/tx/${createResult.signature}`);

      // Execute auto-buys
      if (autoBuyConfig.enabled && autoBuyConfig.walletIndices.length > 0) {
        console.log('\n--- Executing Auto-Buys ---\n');

        for (let i = 0; i < autoBuyConfig.walletIndices.length; i++) {
          const walletIndex = autoBuyConfig.walletIndices[i];
          const buyWallet = this.config.wallets[walletIndex];

          // Calculate amount
          let buyAmount = autoBuyConfig.amountPerWallet;
          if (autoBuyConfig.randomizeAmount) {
            buyAmount = autoBuyConfig.minAmount +
              Math.random() * (autoBuyConfig.maxAmount - autoBuyConfig.minAmount);
          }

          // Delay between buys (skip first)
          if (i > 0 && autoBuyConfig.delayBetweenBuys > 0) {
            console.log(`  Waiting ${autoBuyConfig.delayBetweenBuys / 1000}s...`);
            await new Promise(r => setTimeout(r, autoBuyConfig.delayBetweenBuys));
          }

          try {
            const buyKeypair = Keypair.fromSecretKey(bs58.decode(buyWallet.privateKey));
            const buyResult = await this.buyPumpFunToken(
              buyKeypair,
              mintKeypair.publicKey.toBase58(),
              buyAmount,
              slippage,
              priorityFee
            );
            console.log(`  [OK] ${buyWallet.name}: ${buyAmount.toFixed(4)} SOL`);
          } catch (error: any) {
            console.log(`  [FAIL] ${buyWallet.name}: ${error.message}`);
          }
        }
      }

      console.log('\n--- Launch Complete ---');
    } catch (error: any) {
      console.log(`\n[ERROR] Launch failed: ${error.message}`);
    }

    await this.prompt('\nPress Enter to continue...');
  }

  private async quickLaunch(): Promise<void> {
    this.clearScreen();
    console.log('\n--- Quick Launch ---\n');

    if (this.config.activeWalletIndex < 0) {
      console.log('No active wallet set.');
      await this.prompt('Press Enter to continue...');
      return;
    }

    const wallet = this.config.wallets[this.config.activeWalletIndex];
    console.log(`Wallet: ${wallet.name}\n`);

    const name = await this.prompt('Token Name: ');
    const symbol = await this.prompt('Symbol: ');

    if (!name || !symbol) {
      console.log('Name and symbol are required.');
      await this.prompt('Press Enter to continue...');
      return;
    }

    const buyStr = await this.prompt('Initial buy SOL (default 0.05): ');
    const buySol = parseFloat(buyStr) || 0.05;

    const confirm = await this.prompt(`\nLaunch ${symbol} with ${buySol} SOL buy? (yes/no): `);
    if (confirm.toLowerCase() !== 'yes') {
      console.log('Cancelled.');
      await this.prompt('Press Enter to continue...');
      return;
    }

    try {
      const mintKeypair = Keypair.generate();
      const walletKeypair = Keypair.fromSecretKey(bs58.decode(wallet.privateKey));

      console.log('\nUploading metadata...');
      const metadataUri = await this.uploadTokenMetadata({
        name,
        symbol,
        description: `${symbol} token`,
      });

      console.log('Creating token...');
      const result = await this.createPumpFunToken(
        walletKeypair,
        mintKeypair,
        { name, symbol, description: `${symbol} token` },
        metadataUri,
        buySol,
        10,
        0.0005
      );

      console.log(`\n[SUCCESS] Token launched!`);
      console.log(`  Mint: ${mintKeypair.publicKey.toBase58()}`);
      console.log(`  PumpFun: https://pump.fun/${mintKeypair.publicKey.toBase58()}`);
    } catch (error: any) {
      console.log(`\n[ERROR] ${error.message}`);
    }

    await this.prompt('\nPress Enter to continue...');
  }

  private async buyToken(): Promise<void> {
    this.clearScreen();
    console.log('\n--- Buy Token ---\n');

    if (this.config.activeWalletIndex < 0) {
      console.log('No active wallet set.');
      await this.prompt('Press Enter to continue...');
      return;
    }

    const wallet = this.config.wallets[this.config.activeWalletIndex];
    console.log(`Wallet: ${wallet.name}\n`);

    const mintAddress = await this.prompt('Token mint address: ');
    if (!mintAddress) {
      console.log('Mint address required.');
      await this.prompt('Press Enter to continue...');
      return;
    }

    const amountStr = await this.prompt('Amount in SOL: ');
    const amount = parseFloat(amountStr);
    if (isNaN(amount) || amount <= 0) {
      console.log('Invalid amount.');
      await this.prompt('Press Enter to continue...');
      return;
    }

    const confirm = await this.prompt(`\nBuy ${amount} SOL worth? (yes/no): `);
    if (confirm.toLowerCase() !== 'yes') {
      console.log('Cancelled.');
      await this.prompt('Press Enter to continue...');
      return;
    }

    try {
      const walletKeypair = Keypair.fromSecretKey(bs58.decode(wallet.privateKey));
      const result = await this.buyPumpFunToken(walletKeypair, mintAddress, amount, 10, 0.0005);
      console.log(`\n[SUCCESS] Buy executed!`);
      console.log(`  Signature: ${result.signature}`);
    } catch (error: any) {
      console.log(`\n[ERROR] ${error.message}`);
    }

    await this.prompt('\nPress Enter to continue...');
  }

  private async sellToken(): Promise<void> {
    this.clearScreen();
    console.log('\n--- Sell Token ---\n');

    if (this.config.activeWalletIndex < 0) {
      console.log('No active wallet set.');
      await this.prompt('Press Enter to continue...');
      return;
    }

    const wallet = this.config.wallets[this.config.activeWalletIndex];
    console.log(`Wallet: ${wallet.name}\n`);

    const mintAddress = await this.prompt('Token mint address: ');
    if (!mintAddress) {
      console.log('Mint address required.');
      await this.prompt('Press Enter to continue...');
      return;
    }

    const amountStr = await this.prompt('Token amount to sell (or "all"): ');

    let amount: number;
    if (amountStr.toLowerCase() === 'all') {
      // TODO: Get token balance
      console.log('Selling all tokens...');
      amount = 1000000000; // Large number for all
    } else {
      amount = parseFloat(amountStr);
      if (isNaN(amount) || amount <= 0) {
        console.log('Invalid amount.');
        await this.prompt('Press Enter to continue...');
        return;
      }
    }

    const confirm = await this.prompt(`\nSell tokens? (yes/no): `);
    if (confirm.toLowerCase() !== 'yes') {
      console.log('Cancelled.');
      await this.prompt('Press Enter to continue...');
      return;
    }

    try {
      const walletKeypair = Keypair.fromSecretKey(bs58.decode(wallet.privateKey));
      const result = await this.sellPumpFunToken(walletKeypair, mintAddress, amount, 10, 0.0005);
      console.log(`\n[SUCCESS] Sell executed!`);
      console.log(`  Signature: ${result.signature}`);
    } catch (error: any) {
      console.log(`\n[ERROR] ${error.message}`);
    }

    await this.prompt('\nPress Enter to continue...');
  }

  private async multiWalletBuy(): Promise<void> {
    this.clearScreen();
    console.log('\n--- Multi-Wallet Buy ---\n');

    if (this.config.wallets.length < 2) {
      console.log('Need at least 2 wallets.');
      await this.prompt('Press Enter to continue...');
      return;
    }

    const mintAddress = await this.prompt('Token mint address: ');
    if (!mintAddress) {
      console.log('Mint address required.');
      await this.prompt('Press Enter to continue...');
      return;
    }

    console.log('\nSelect wallets to buy with:');
    this.config.wallets.forEach((w, i) => {
      console.log(`  ${i + 1}. ${w.name}`);
    });

    const walletsChoice = await this.prompt('\nWallets (comma-separated, or "all"): ');
    let walletIndices: number[];

    if (walletsChoice.toLowerCase() === 'all') {
      walletIndices = this.config.wallets.map((_, i) => i);
    } else {
      walletIndices = walletsChoice
        .split(',')
        .map(s => parseInt(s.trim(), 10) - 1)
        .filter(i => i >= 0 && i < this.config.wallets.length);
    }

    if (walletIndices.length === 0) {
      console.log('No valid wallets selected.');
      await this.prompt('Press Enter to continue...');
      return;
    }

    const randomize = await this.prompt('Randomize amounts? (yes/no): ');
    let amounts: number[] = [];

    if (randomize.toLowerCase() === 'yes') {
      const minStr = await this.prompt('Min SOL: ');
      const maxStr = await this.prompt('Max SOL: ');
      const min = parseFloat(minStr) || 0.01;
      const max = parseFloat(maxStr) || 0.1;

      amounts = walletIndices.map(() => min + Math.random() * (max - min));
    } else {
      const amountStr = await this.prompt('SOL per wallet: ');
      const amount = parseFloat(amountStr) || 0.05;
      amounts = walletIndices.map(() => amount);
    }

    const delayStr = await this.prompt('Delay between buys (seconds, 0 for no delay): ');
    const delay = (parseFloat(delayStr) || 0) * 1000;

    // Summary
    console.log('\n--- Buy Summary ---\n');
    walletIndices.forEach((i, idx) => {
      console.log(`  ${this.config.wallets[i].name}: ${amounts[idx].toFixed(4)} SOL`);
    });
    console.log(`\n  Total: ${amounts.reduce((a, b) => a + b, 0).toFixed(4)} SOL`);

    const confirm = await this.prompt('\nExecute? (yes/no): ');
    if (confirm.toLowerCase() !== 'yes') {
      console.log('Cancelled.');
      await this.prompt('Press Enter to continue...');
      return;
    }

    console.log('\nExecuting buys...\n');

    for (let i = 0; i < walletIndices.length; i++) {
      const walletIndex = walletIndices[i];
      const wallet = this.config.wallets[walletIndex];
      const amount = amounts[i];

      if (i > 0 && delay > 0) {
        console.log(`  Waiting ${delay / 1000}s...`);
        await new Promise(r => setTimeout(r, delay));
      }

      try {
        const keypair = Keypair.fromSecretKey(bs58.decode(wallet.privateKey));
        const result = await this.buyPumpFunToken(keypair, mintAddress, amount, 10, 0.0005);
        console.log(`  [OK] ${wallet.name}: ${amount.toFixed(4)} SOL`);
      } catch (error: any) {
        console.log(`  [FAIL] ${wallet.name}: ${error.message}`);
      }
    }

    console.log('\nMulti-buy complete!');
    await this.prompt('\nPress Enter to continue...');
  }

  private async viewRecentLaunches(): Promise<void> {
    this.clearScreen();
    console.log('\n--- Recent Launches ---\n');
    console.log('(This feature tracks locally launched tokens)\n');
    console.log('No recent launches recorded.');
    await this.prompt('\nPress Enter to continue...');
  }

  // ============================================
  // PUMPFUN API HELPERS
  // ============================================

  private async uploadTokenMetadata(metadata: TokenMetadata): Promise<string> {
    const formData = new URLSearchParams();
    formData.append('name', metadata.name);
    formData.append('symbol', metadata.symbol);
    formData.append('description', metadata.description);
    formData.append('showName', 'true');

    if (metadata.twitter) formData.append('twitter', metadata.twitter);
    if (metadata.telegram) formData.append('telegram', metadata.telegram);
    if (metadata.website) formData.append('website', metadata.website);

    const response = await fetch(`${PUMPPORTAL_API_URL}/ipfs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: formData.toString(),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Metadata upload failed: ${response.status} - ${errorText}`);
    }

    const result = await response.json() as { metadataUri: string };
    return result.metadataUri;
  }

  private async createPumpFunToken(
    walletKeypair: Keypair,
    mintKeypair: Keypair,
    metadata: { name: string; symbol: string; description: string },
    metadataUri: string,
    initialBuySol: number,
    slippage: number,
    priorityFee: number
  ): Promise<{ signature: string }> {
    const response = await fetch(`${PUMPPORTAL_API_URL}/trade-local`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        publicKey: walletKeypair.publicKey.toBase58(),
        action: 'create',
        tokenMetadata: {
          name: metadata.name,
          symbol: metadata.symbol,
          uri: metadataUri,
        },
        mint: mintKeypair.publicKey.toBase58(),
        denominatedInSol: 'true',
        amount: initialBuySol,
        slippage,
        priorityFee,
        pool: 'pump',
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`PumpPortal API error: ${response.status} - ${errorText}`);
    }

    const transactionData = await response.arrayBuffer();
    const { VersionedTransaction } = await import('@solana/web3.js');
    const transaction = VersionedTransaction.deserialize(new Uint8Array(transactionData));

    transaction.sign([walletKeypair, mintKeypair]);

    const signature = await this.connection.sendTransaction(transaction, {
      skipPreflight: false,
      preflightCommitment: 'confirmed',
      maxRetries: 3,
    });

    await this.connection.confirmTransaction(signature, 'confirmed');

    return { signature };
  }

  private async buyPumpFunToken(
    walletKeypair: Keypair,
    mintAddress: string,
    solAmount: number,
    slippage: number,
    priorityFee: number
  ): Promise<{ signature: string }> {
    const response = await fetch(`${PUMPPORTAL_API_URL}/trade-local`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        publicKey: walletKeypair.publicKey.toBase58(),
        action: 'buy',
        mint: mintAddress,
        denominatedInSol: 'true',
        amount: solAmount,
        slippage,
        priorityFee,
        pool: 'pump',
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`PumpPortal API error: ${response.status} - ${errorText}`);
    }

    const transactionData = await response.arrayBuffer();
    const { VersionedTransaction } = await import('@solana/web3.js');
    const transaction = VersionedTransaction.deserialize(new Uint8Array(transactionData));

    transaction.sign([walletKeypair]);

    const signature = await this.connection.sendTransaction(transaction, {
      skipPreflight: false,
      preflightCommitment: 'confirmed',
    });

    await this.connection.confirmTransaction(signature, 'confirmed');

    return { signature };
  }

  private async sellPumpFunToken(
    walletKeypair: Keypair,
    mintAddress: string,
    tokenAmount: number,
    slippage: number,
    priorityFee: number
  ): Promise<{ signature: string }> {
    const response = await fetch(`${PUMPPORTAL_API_URL}/trade-local`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        publicKey: walletKeypair.publicKey.toBase58(),
        action: 'sell',
        mint: mintAddress,
        denominatedInSol: 'false',
        amount: tokenAmount,
        slippage,
        priorityFee,
        pool: 'pump',
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`PumpPortal API error: ${response.status} - ${errorText}`);
    }

    const transactionData = await response.arrayBuffer();
    const { VersionedTransaction } = await import('@solana/web3.js');
    const transaction = VersionedTransaction.deserialize(new Uint8Array(transactionData));

    transaction.sign([walletKeypair]);

    const signature = await this.connection.sendTransaction(transaction, {
      skipPreflight: false,
      preflightCommitment: 'confirmed',
    });

    await this.connection.confirmTransaction(signature, 'confirmed');

    return { signature };
  }

  // ============================================
  // TRADING MENU (Auto-Sell, Positions, Volume)
  // ============================================

  private async tradingMenu(): Promise<void> {
    while (true) {
      this.clearScreen();

      const activeAutoSells = this.tradingConfig.autoSells.filter(a => a.enabled).length;
      const activeVolumeTasks = this.tradingConfig.volumeTasks.filter(v => v.enabled).length;
      const activeBumpTasks = this.bumpTaskIntervals.size;

      console.log(`\n  Auto-Sells: ${activeAutoSells} | Volume Tasks: ${activeVolumeTasks} | Bump Bots: ${activeBumpTasks}`);
      console.log(`  Price Monitor: ${this.priceMonitorInterval ? 'RUNNING' : 'STOPPED'}`);

      this.printMenu('Trading & Automation', [
        'Auto-Sell Setup (TP/SL/Trailing)',
        'View Active Auto-Sells',
        'Position Tracker',
        'Volume Generation',
        'View Volume Tasks',
        'Bump Bot Setup',
        'View Bump Bots',
        'Holder Distribution',
        'Start/Stop Price Monitor',
        'Sell All Positions',
      ]);

      const choice = await this.prompt('Select option: ');

      switch (choice) {
        case '1':
          await this.setupAutoSell();
          break;
        case '2':
          await this.viewAutoSells();
          break;
        case '3':
          await this.positionTracker();
          break;
        case '4':
          await this.setupVolumeGeneration();
          break;
        case '5':
          await this.viewVolumeTasks();
          break;
        case '6':
          await this.setupBumpBot();
          break;
        case '7':
          await this.viewBumpBots();
          break;
        case '8':
          await this.holderDistribution();
          break;
        case '9':
          await this.togglePriceMonitor();
          break;
        case '10':
          await this.sellAllPositions();
          break;
        case '0':
          return;
        default:
          break;
      }
    }
  }

  // ============================================
  // AUTO-SELL METHODS
  // ============================================

  private async setupAutoSell(): Promise<void> {
    this.clearScreen();
    console.log('\n--- Setup Auto-Sell ---\n');

    if (this.config.wallets.length === 0) {
      console.log('No wallets configured.');
      await this.prompt('Press Enter to continue...');
      return;
    }

    // Get token mint
    const tokenMint = await this.prompt('Token Mint Address: ');
    if (!tokenMint) {
      console.log('Token mint is required.');
      await this.prompt('Press Enter to continue...');
      return;
    }

    const tokenSymbol = await this.prompt('Token Symbol (for display): ') || 'UNKNOWN';

    // Select wallet
    console.log('\nAvailable wallets:');
    this.config.wallets.forEach((w, i) => {
      console.log(`  ${i + 1}. ${w.name} - ${w.publicKey.substring(0, 8)}...`);
    });

    const walletChoice = await this.prompt('\nSelect wallet (number): ');
    const walletIndex = parseInt(walletChoice, 10) - 1;

    if (walletIndex < 0 || walletIndex >= this.config.wallets.length) {
      console.log('Invalid wallet selection.');
      await this.prompt('Press Enter to continue...');
      return;
    }

    // Get entry price
    const entryPriceStr = await this.prompt('Entry price in SOL (per token): ');
    const entryPrice = parseFloat(entryPriceStr);
    if (isNaN(entryPrice) || entryPrice <= 0) {
      console.log('Invalid entry price.');
      await this.prompt('Press Enter to continue...');
      return;
    }

    console.log('\n--- Exit Conditions (leave blank to skip) ---\n');

    // Take profit
    const tpStr = await this.prompt('Take Profit % (e.g., 100 for 2x): ');
    const takeProfit = tpStr ? parseFloat(tpStr) : null;

    // Stop loss
    const slStr = await this.prompt('Stop Loss % (e.g., 50 for -50%): ');
    const stopLoss = slStr ? -Math.abs(parseFloat(slStr)) : null;

    // Trailing stop
    const tsStr = await this.prompt('Trailing Stop % (e.g., 20 for 20% from high): ');
    const trailingStop = tsStr ? parseFloat(tsStr) : null;

    // Sell percentage
    const sellPercentStr = await this.prompt('Sell % when triggered (default 100): ');
    const sellPercent = parseFloat(sellPercentStr) || 100;

    if (!takeProfit && !stopLoss && !trailingStop) {
      console.log('\nAt least one exit condition is required.');
      await this.prompt('Press Enter to continue...');
      return;
    }

    // Create auto-sell config
    const autoSell: AutoSellConfig = {
      id: this.generateId(),
      tokenMint,
      tokenSymbol,
      walletIndex,
      enabled: true,
      takeProfitPercent: takeProfit,
      stopLossPercent: stopLoss,
      trailingStopPercent: trailingStop,
      sellPercent,
      entryPriceSol: entryPrice,
      highestPriceSol: entryPrice,
      createdAt: new Date().toISOString(),
    };

    this.tradingConfig.autoSells.push(autoSell);
    this.saveTradingConfig();

    // Show summary
    this.clearScreen();
    console.log('\n--- Auto-Sell Created ---\n');
    console.log(`Token: ${tokenSymbol} (${tokenMint.substring(0, 8)}...)`);
    console.log(`Wallet: ${this.config.wallets[walletIndex].name}`);
    console.log(`Entry Price: ${entryPrice} SOL`);
    if (takeProfit) console.log(`Take Profit: +${takeProfit}% (at ${entryPrice * (1 + takeProfit / 100)} SOL)`);
    if (stopLoss) console.log(`Stop Loss: ${stopLoss}% (at ${entryPrice * (1 + stopLoss / 100)} SOL)`);
    if (trailingStop) console.log(`Trailing Stop: ${trailingStop}% from highest`);
    console.log(`Sell Amount: ${sellPercent}% of holdings`);

    if (!this.priceMonitorInterval) {
      const startMonitor = await this.prompt('\nStart price monitor now? (yes/no): ');
      if (startMonitor.toLowerCase() === 'yes') {
        this.startPriceMonitor();
        console.log('Price monitor started.');
      }
    }

    await this.prompt('\nPress Enter to continue...');
  }

  private async viewAutoSells(): Promise<void> {
    this.clearScreen();
    console.log('\n--- Active Auto-Sells ---\n');

    if (this.tradingConfig.autoSells.length === 0) {
      console.log('No auto-sells configured.');
      await this.prompt('Press Enter to continue...');
      return;
    }

    this.tradingConfig.autoSells.forEach((as, i) => {
      const wallet = this.config.wallets[as.walletIndex];
      console.log(`${i + 1}. [${as.enabled ? 'ON' : 'OFF'}] ${as.tokenSymbol}`);
      console.log(`   Mint: ${as.tokenMint.substring(0, 16)}...`);
      console.log(`   Wallet: ${wallet?.name || 'Unknown'}`);
      console.log(`   Entry: ${as.entryPriceSol} SOL | High: ${as.highestPriceSol} SOL`);
      if (as.takeProfitPercent) console.log(`   TP: +${as.takeProfitPercent}%`);
      if (as.stopLossPercent) console.log(`   SL: ${as.stopLossPercent}%`);
      if (as.trailingStopPercent) console.log(`   Trailing: ${as.trailingStopPercent}%`);
      console.log('');
    });

    console.log('\nOptions: [T]oggle, [D]elete, [B]ack');
    const action = await this.prompt('Select action: ');

    if (action.toLowerCase() === 't') {
      const indexStr = await this.prompt('Toggle which # : ');
      const index = parseInt(indexStr, 10) - 1;
      if (index >= 0 && index < this.tradingConfig.autoSells.length) {
        this.tradingConfig.autoSells[index].enabled = !this.tradingConfig.autoSells[index].enabled;
        this.saveTradingConfig();
        console.log(`Auto-sell ${this.tradingConfig.autoSells[index].enabled ? 'enabled' : 'disabled'}.`);
        await this.prompt('Press Enter to continue...');
      }
    } else if (action.toLowerCase() === 'd') {
      const indexStr = await this.prompt('Delete which # : ');
      const index = parseInt(indexStr, 10) - 1;
      if (index >= 0 && index < this.tradingConfig.autoSells.length) {
        const removed = this.tradingConfig.autoSells.splice(index, 1)[0];
        this.saveTradingConfig();
        console.log(`Removed auto-sell for ${removed.tokenSymbol}.`);
        await this.prompt('Press Enter to continue...');
      }
    }
  }

  // ============================================
  // POSITION TRACKER
  // ============================================

  private async positionTracker(): Promise<void> {
    this.clearScreen();
    console.log('\n--- Position Tracker ---\n');
    console.log('Fetching positions from all wallets...\n');

    const positions: Position[] = [];

    for (let i = 0; i < this.config.wallets.length; i++) {
      const wallet = this.config.wallets[i];
      try {
        // Get token accounts for wallet
        const pubkey = new PublicKey(wallet.publicKey);
        const tokenAccounts = await this.connection.getParsedTokenAccountsByOwner(pubkey, {
          programId: new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'),
        });

        for (const account of tokenAccounts.value) {
          const parsed = account.account.data.parsed.info;
          const tokenBalance = parsed.tokenAmount.uiAmount;

          if (tokenBalance > 0) {
            const mint = parsed.mint;

            // Get price from PumpPortal (simplified)
            let currentPrice = 0;
            try {
              const priceResp = await fetch(`${PUMPPORTAL_API_URL}/token/${mint}`);
              if (priceResp.ok) {
                const priceData = await priceResp.json();
                currentPrice = priceData.price_sol || 0;
              }
            } catch (e) {
              // Price fetch failed, skip
            }

            // Find if we have entry data
            const existingPos = this.tradingConfig.positions.find(
              p => p.tokenMint === mint && p.walletIndex === i
            );

            const avgEntry = existingPos?.avgEntryPrice || currentPrice;
            const totalInvested = existingPos?.totalInvested || (tokenBalance * avgEntry);
            const currentValue = tokenBalance * currentPrice;
            const pnlSol = currentValue - totalInvested;
            const pnlPercent = totalInvested > 0 ? ((currentValue / totalInvested) - 1) * 100 : 0;

            positions.push({
              tokenMint: mint,
              tokenSymbol: existingPos?.tokenSymbol || mint.substring(0, 6),
              walletIndex: i,
              walletName: wallet.name,
              tokenBalance,
              avgEntryPrice: avgEntry,
              currentPrice,
              totalInvested,
              currentValue,
              pnlSol,
              pnlPercent,
              lastUpdated: new Date().toISOString(),
            });
          }
        }
      } catch (error: any) {
        console.log(`Error fetching ${wallet.name}: ${error.message}`);
      }
    }

    // Update stored positions
    this.tradingConfig.positions = positions;
    this.saveTradingConfig();

    // Display positions
    if (positions.length === 0) {
      console.log('No token positions found.');
    } else {
      let totalValue = 0;
      let totalPnl = 0;

      console.log('Token          Wallet         Balance       Price      Value      P&L');
      console.log('-'.repeat(75));

      for (const pos of positions) {
        const pnlColor = pos.pnlPercent >= 0 ? '+' : '';
        console.log(
          `${pos.tokenSymbol.padEnd(14)} ${pos.walletName.substring(0, 12).padEnd(14)} ` +
          `${pos.tokenBalance.toFixed(2).padStart(10)} ` +
          `${pos.currentPrice.toFixed(6).padStart(10)} ` +
          `${pos.currentValue.toFixed(4).padStart(10)} ` +
          `${pnlColor}${pos.pnlPercent.toFixed(1)}%`
        );
        totalValue += pos.currentValue;
        totalPnl += pos.pnlSol;
      }

      console.log('-'.repeat(75));
      console.log(`Total Value: ${totalValue.toFixed(4)} SOL | Total P&L: ${totalPnl >= 0 ? '+' : ''}${totalPnl.toFixed(4)} SOL`);
    }

    console.log('\n[R]efresh, [S]et Entry Price, [B]ack');
    const action = await this.prompt('Select action: ');

    if (action.toLowerCase() === 'r') {
      await this.positionTracker();
    } else if (action.toLowerCase() === 's') {
      const mint = await this.prompt('Token mint to set entry for: ');
      const entry = await this.prompt('Entry price in SOL: ');
      const pos = this.tradingConfig.positions.find(p => p.tokenMint.startsWith(mint));
      if (pos) {
        pos.avgEntryPrice = parseFloat(entry);
        pos.totalInvested = pos.tokenBalance * pos.avgEntryPrice;
        this.saveTradingConfig();
        console.log('Entry price updated.');
      }
      await this.prompt('Press Enter to continue...');
    }
  }

  // ============================================
  // VOLUME GENERATION
  // ============================================

  private async setupVolumeGeneration(): Promise<void> {
    this.clearScreen();
    console.log('\n--- Volume Generation Setup ---\n');
    console.log('This will create coordinated buy/sell cycles to generate volume.\n');

    if (this.config.wallets.length < 2) {
      console.log('Need at least 2 wallets for volume generation.');
      await this.prompt('Press Enter to continue...');
      return;
    }

    // Get token
    const tokenMint = await this.prompt('Token Mint Address: ');
    if (!tokenMint) return;

    const tokenSymbol = await this.prompt('Token Symbol: ') || 'UNKNOWN';

    // Select wallets
    console.log('\nAvailable wallets:');
    this.config.wallets.forEach((w, i) => {
      console.log(`  ${i + 1}. ${w.name}`);
    });

    const walletsChoice = await this.prompt('\nSelect wallets (comma-separated or "all"): ');
    let walletIndices: number[];

    if (walletsChoice.toLowerCase() === 'all') {
      walletIndices = this.config.wallets.map((_, i) => i);
    } else {
      walletIndices = walletsChoice.split(',').map(s => parseInt(s.trim(), 10) - 1).filter(i => i >= 0);
    }

    if (walletIndices.length < 2) {
      console.log('Need at least 2 wallets selected.');
      await this.prompt('Press Enter to continue...');
      return;
    }

    // Volume settings
    console.log('\n--- Volume Settings ---\n');

    const minBuyStr = await this.prompt('Min buy amount in SOL (default 0.01): ');
    const minBuySol = parseFloat(minBuyStr) || 0.01;

    const maxBuyStr = await this.prompt('Max buy amount in SOL (default 0.05): ');
    const maxBuySol = parseFloat(maxBuyStr) || 0.05;

    const minDelayStr = await this.prompt('Min delay between trades in seconds (default 30): ');
    const minDelayMs = (parseFloat(minDelayStr) || 30) * 1000;

    const maxDelayStr = await this.prompt('Max delay between trades in seconds (default 120): ');
    const maxDelayMs = (parseFloat(maxDelayStr) || 120) * 1000;

    const sellDelayStr = await this.prompt('Delay before sell after buy in seconds (default 60): ');
    const sellDelayMs = (parseFloat(sellDelayStr) || 60) * 1000;

    const cycleCountStr = await this.prompt('Number of buy/sell cycles (default 10): ');
    const cycleCount = parseInt(cycleCountStr, 10) || 10;

    const randomize = await this.prompt('Randomize wallet order? (yes/no, default yes): ');
    const randomizeOrder = randomize.toLowerCase() !== 'no';

    // Create volume config
    const volumeConfig: VolumeConfig = {
      id: this.generateId(),
      tokenMint,
      tokenSymbol,
      enabled: false, // Start disabled
      walletIndices,
      minBuySol,
      maxBuySol,
      minDelayMs,
      maxDelayMs,
      cycleCount,
      completedCycles: 0,
      sellDelayMs,
      randomizeOrder,
      createdAt: new Date().toISOString(),
    };

    this.tradingConfig.volumeTasks.push(volumeConfig);
    this.saveTradingConfig();

    // Summary
    console.log('\n--- Volume Task Created ---\n');
    console.log(`Token: ${tokenSymbol}`);
    console.log(`Wallets: ${walletIndices.length}`);
    console.log(`Buy Range: ${minBuySol} - ${maxBuySol} SOL`);
    console.log(`Delay Range: ${minDelayMs / 1000}s - ${maxDelayMs / 1000}s`);
    console.log(`Cycles: ${cycleCount}`);
    console.log(`Status: PAUSED (use View Volume Tasks to start)`);

    await this.prompt('\nPress Enter to continue...');
  }

  private async viewVolumeTasks(): Promise<void> {
    this.clearScreen();
    console.log('\n--- Volume Generation Tasks ---\n');

    if (this.tradingConfig.volumeTasks.length === 0) {
      console.log('No volume tasks configured.');
      await this.prompt('Press Enter to continue...');
      return;
    }

    this.tradingConfig.volumeTasks.forEach((vt, i) => {
      const isRunning = this.volumeTaskIntervals.has(vt.id);
      console.log(`${i + 1}. [${isRunning ? 'RUNNING' : vt.enabled ? 'ENABLED' : 'PAUSED'}] ${vt.tokenSymbol}`);
      console.log(`   Mint: ${vt.tokenMint.substring(0, 16)}...`);
      console.log(`   Wallets: ${vt.walletIndices.length} | Cycles: ${vt.completedCycles}/${vt.cycleCount}`);
      console.log(`   Buy: ${vt.minBuySol}-${vt.maxBuySol} SOL | Delay: ${vt.minDelayMs / 1000}s-${vt.maxDelayMs / 1000}s`);
      console.log('');
    });

    console.log('\nOptions: [S]tart, [P]ause, [D]elete, [B]ack');
    const action = await this.prompt('Select action: ');

    if (action.toLowerCase() === 's') {
      const indexStr = await this.prompt('Start which # : ');
      const index = parseInt(indexStr, 10) - 1;
      if (index >= 0 && index < this.tradingConfig.volumeTasks.length) {
        await this.startVolumeTask(this.tradingConfig.volumeTasks[index]);
        console.log('Volume task started.');
        await this.prompt('Press Enter to continue...');
      }
    } else if (action.toLowerCase() === 'p') {
      const indexStr = await this.prompt('Pause which # : ');
      const index = parseInt(indexStr, 10) - 1;
      if (index >= 0 && index < this.tradingConfig.volumeTasks.length) {
        this.stopVolumeTask(this.tradingConfig.volumeTasks[index].id);
        console.log('Volume task paused.');
        await this.prompt('Press Enter to continue...');
      }
    } else if (action.toLowerCase() === 'd') {
      const indexStr = await this.prompt('Delete which # : ');
      const index = parseInt(indexStr, 10) - 1;
      if (index >= 0 && index < this.tradingConfig.volumeTasks.length) {
        const removed = this.tradingConfig.volumeTasks.splice(index, 1)[0];
        this.stopVolumeTask(removed.id);
        this.saveTradingConfig();
        console.log(`Removed volume task for ${removed.tokenSymbol}.`);
        await this.prompt('Press Enter to continue...');
      }
    }
  }

  private async startVolumeTask(task: VolumeConfig): Promise<void> {
    if (this.volumeTaskIntervals.has(task.id)) {
      console.log('Task already running.');
      return;
    }

    task.enabled = true;
    this.saveTradingConfig();

    console.log(`\n[Volume] Starting task for ${task.tokenSymbol}...`);

    const runCycle = async () => {
      if (task.completedCycles >= task.cycleCount) {
        console.log(`[Volume] ${task.tokenSymbol} completed all ${task.cycleCount} cycles.`);
        this.stopVolumeTask(task.id);
        return;
      }

      // Get wallets in order (randomized if configured)
      let wallets = [...task.walletIndices];
      if (task.randomizeOrder) {
        wallets = wallets.sort(() => Math.random() - 0.5);
      }

      for (const walletIdx of wallets) {
        if (!task.enabled) break;

        const wallet = this.config.wallets[walletIdx];
        if (!wallet || wallet.isMain && wallet.privateKey === '[FROM_ENV]') continue;

        const buyAmount = task.minBuySol + Math.random() * (task.maxBuySol - task.minBuySol);

        console.log(`[Volume] ${wallet.name} buying ${buyAmount.toFixed(4)} SOL of ${task.tokenSymbol}...`);

        try {
          // Execute buy
          let keypair: Keypair;
          if (wallet.isMain && process.env.SOLANA_PRIVATE_KEY) {
            keypair = Keypair.fromSecretKey(bs58.decode(process.env.SOLANA_PRIVATE_KEY));
          } else {
            keypair = Keypair.fromSecretKey(bs58.decode(wallet.privateKey));
          }

          await this.buyPumpFunToken(keypair, task.tokenMint, buyAmount, 15, 0.0001);
          console.log(`[Volume] Buy success for ${wallet.name}`);

          // Wait before selling
          await new Promise(r => setTimeout(r, task.sellDelayMs));

          // Get token balance and sell all
          const tokenAccounts = await this.connection.getParsedTokenAccountsByOwner(
            keypair.publicKey,
            { programId: new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA') }
          );

          for (const acc of tokenAccounts.value) {
            const parsed = acc.account.data.parsed.info;
            if (parsed.mint === task.tokenMint && parsed.tokenAmount.uiAmount > 0) {
              console.log(`[Volume] ${wallet.name} selling ${parsed.tokenAmount.uiAmount} tokens...`);
              await this.sellPumpFunToken(keypair, task.tokenMint, parsed.tokenAmount.uiAmount, 15, 0.0001);
              console.log(`[Volume] Sell success for ${wallet.name}`);
              break;
            }
          }
        } catch (error: any) {
          console.log(`[Volume] Error for ${wallet.name}: ${error.message}`);
        }

        // Random delay before next wallet
        const delay = task.minDelayMs + Math.random() * (task.maxDelayMs - task.minDelayMs);
        await new Promise(r => setTimeout(r, delay));
      }

      task.completedCycles++;
      this.saveTradingConfig();
      console.log(`[Volume] ${task.tokenSymbol} completed cycle ${task.completedCycles}/${task.cycleCount}`);

      // Schedule next cycle
      if (task.enabled && task.completedCycles < task.cycleCount) {
        const nextDelay = task.minDelayMs + Math.random() * (task.maxDelayMs - task.minDelayMs);
        setTimeout(runCycle, nextDelay);
      }
    };

    // Start first cycle
    runCycle();
    this.volumeTaskIntervals.set(task.id, setTimeout(() => {}, 0)); // Placeholder
  }

  private stopVolumeTask(taskId: string): void {
    const task = this.tradingConfig.volumeTasks.find(t => t.id === taskId);
    if (task) {
      task.enabled = false;
      this.saveTradingConfig();
    }

    const interval = this.volumeTaskIntervals.get(taskId);
    if (interval) {
      clearTimeout(interval);
      this.volumeTaskIntervals.delete(taskId);
    }
  }

  // ============================================
  // BUMP BOT
  // ============================================

  private async setupBumpBot(): Promise<void> {
    this.clearScreen();
    console.log('\n--- Bump Bot Setup ---\n');
    console.log('Bump bot makes periodic small buys to keep token visible on pump.fun\n');

    if (this.config.wallets.length === 0) {
      console.log('No wallets configured.');
      await this.prompt('Press Enter to continue...');
      return;
    }

    // Get token
    const tokenMint = await this.prompt('Token Mint Address: ');
    if (!tokenMint) return;

    const tokenSymbol = await this.prompt('Token Symbol: ') || 'UNKNOWN';

    // Select wallets
    console.log('\nAvailable wallets:');
    this.config.wallets.forEach((w, i) => {
      console.log(`  ${i + 1}. ${w.name}`);
    });

    const walletsChoice = await this.prompt('\nSelect wallets (comma-separated or "all"): ');
    let walletIndices: number[];

    if (walletsChoice.toLowerCase() === 'all') {
      walletIndices = this.config.wallets.map((_, i) => i);
    } else {
      walletIndices = walletsChoice.split(',').map(s => parseInt(s.trim(), 10) - 1).filter(i => i >= 0);
    }

    if (walletIndices.length === 0) {
      console.log('No wallets selected.');
      await this.prompt('Press Enter to continue...');
      return;
    }

    // Bump settings
    console.log('\n--- Bump Settings ---\n');

    const minBuyStr = await this.prompt('Min bump amount in SOL (default 0.001): ');
    const minBuySol = parseFloat(minBuyStr) || 0.001;

    const maxBuyStr = await this.prompt('Max bump amount in SOL (default 0.005): ');
    const maxBuySol = parseFloat(maxBuyStr) || 0.005;

    const minIntervalStr = await this.prompt('Min interval between bumps in seconds (default 60): ');
    const minIntervalMs = (parseFloat(minIntervalStr) || 60) * 1000;

    const maxIntervalStr = await this.prompt('Max interval between bumps in seconds (default 180): ');
    const maxIntervalMs = (parseFloat(maxIntervalStr) || 180) * 1000;

    const totalBumpsStr = await this.prompt('Total bumps (0 = infinite, default 50): ');
    const totalBumps = parseInt(totalBumpsStr, 10) || 50;

    const rotateStr = await this.prompt('Rotate through wallets? (yes/no, default yes): ');
    const rotateWallets = rotateStr.toLowerCase() !== 'no';

    // Create bump config
    const bumpConfig: BumpConfig = {
      id: this.generateId(),
      tokenMint,
      tokenSymbol,
      enabled: false,
      walletIndices,
      minBuySol,
      maxBuySol,
      minIntervalMs,
      maxIntervalMs,
      totalBumps,
      completedBumps: 0,
      rotateWallets,
      currentWalletIndex: 0,
      createdAt: new Date().toISOString(),
    };

    this.tradingConfig.bumpTasks.push(bumpConfig);
    this.saveTradingConfig();

    // Summary
    console.log('\n--- Bump Bot Created ---\n');
    console.log(`Token: ${tokenSymbol}`);
    console.log(`Wallets: ${walletIndices.length}`);
    console.log(`Bump Amount: ${minBuySol} - ${maxBuySol} SOL`);
    console.log(`Interval: ${minIntervalMs / 1000}s - ${maxIntervalMs / 1000}s`);
    console.log(`Total Bumps: ${totalBumps === 0 ? 'Infinite' : totalBumps}`);
    console.log(`Rotate Wallets: ${rotateWallets ? 'Yes' : 'No'}`);
    console.log(`Status: PAUSED (use View Bump Bots to start)`);

    await this.prompt('\nPress Enter to continue...');
  }

  private async viewBumpBots(): Promise<void> {
    this.clearScreen();
    console.log('\n--- Bump Bots ---\n');

    if (this.tradingConfig.bumpTasks.length === 0) {
      console.log('No bump bots configured.');
      await this.prompt('Press Enter to continue...');
      return;
    }

    this.tradingConfig.bumpTasks.forEach((bt, i) => {
      const isRunning = this.bumpTaskIntervals.has(bt.id);
      console.log(`${i + 1}. [${isRunning ? 'RUNNING' : 'PAUSED'}] ${bt.tokenSymbol}`);
      console.log(`   Mint: ${bt.tokenMint.substring(0, 16)}...`);
      console.log(`   Wallets: ${bt.walletIndices.length} | Bumps: ${bt.completedBumps}/${bt.totalBumps || '∞'}`);
      console.log(`   Amount: ${bt.minBuySol}-${bt.maxBuySol} SOL | Interval: ${bt.minIntervalMs / 1000}s-${bt.maxIntervalMs / 1000}s`);
      console.log('');
    });

    console.log('\nOptions: [S]tart, [P]ause, [D]elete, [B]ack');
    const action = await this.prompt('Select action: ');

    if (action.toLowerCase() === 's') {
      const indexStr = await this.prompt('Start which # : ');
      const index = parseInt(indexStr, 10) - 1;
      if (index >= 0 && index < this.tradingConfig.bumpTasks.length) {
        this.startBumpBot(this.tradingConfig.bumpTasks[index]);
        console.log('Bump bot started.');
        await this.prompt('Press Enter to continue...');
      }
    } else if (action.toLowerCase() === 'p') {
      const indexStr = await this.prompt('Pause which # : ');
      const index = parseInt(indexStr, 10) - 1;
      if (index >= 0 && index < this.tradingConfig.bumpTasks.length) {
        this.stopBumpBot(this.tradingConfig.bumpTasks[index].id);
        console.log('Bump bot paused.');
        await this.prompt('Press Enter to continue...');
      }
    } else if (action.toLowerCase() === 'd') {
      const indexStr = await this.prompt('Delete which # : ');
      const index = parseInt(indexStr, 10) - 1;
      if (index >= 0 && index < this.tradingConfig.bumpTasks.length) {
        const removed = this.tradingConfig.bumpTasks.splice(index, 1)[0];
        this.stopBumpBot(removed.id);
        this.saveTradingConfig();
        console.log(`Removed bump bot for ${removed.tokenSymbol}.`);
        await this.prompt('Press Enter to continue...');
      }
    }
  }

  private startBumpBot(task: BumpConfig): void {
    if (this.bumpTaskIntervals.has(task.id)) {
      console.log('Bump bot already running.');
      return;
    }

    task.enabled = true;
    this.saveTradingConfig();

    console.log(`\n[Bump] Starting bump bot for ${task.tokenSymbol}...`);

    const runBump = async () => {
      if (!task.enabled) return;

      if (task.totalBumps > 0 && task.completedBumps >= task.totalBumps) {
        console.log(`[Bump] ${task.tokenSymbol} completed all ${task.totalBumps} bumps.`);
        this.stopBumpBot(task.id);
        return;
      }

      // Get wallet (rotate or random)
      let walletIdx: number;
      if (task.rotateWallets) {
        walletIdx = task.walletIndices[task.currentWalletIndex % task.walletIndices.length];
        task.currentWalletIndex++;
      } else {
        walletIdx = task.walletIndices[Math.floor(Math.random() * task.walletIndices.length)];
      }

      const wallet = this.config.wallets[walletIdx];
      if (!wallet) {
        console.log(`[Bump] Wallet ${walletIdx} not found, skipping...`);
        return;
      }

      const buyAmount = task.minBuySol + Math.random() * (task.maxBuySol - task.minBuySol);

      console.log(`[Bump] ${wallet.name} bumping ${task.tokenSymbol} with ${buyAmount.toFixed(4)} SOL...`);

      try {
        let keypair: Keypair;
        if (wallet.isMain && process.env.SOLANA_PRIVATE_KEY) {
          keypair = Keypair.fromSecretKey(bs58.decode(process.env.SOLANA_PRIVATE_KEY));
        } else if (wallet.privateKey && wallet.privateKey !== '[FROM_ENV]') {
          keypair = Keypair.fromSecretKey(bs58.decode(wallet.privateKey));
        } else {
          console.log(`[Bump] Cannot access private key for ${wallet.name}`);
          return;
        }

        await this.buyPumpFunToken(keypair, task.tokenMint, buyAmount, 15, 0.0001);
        task.completedBumps++;
        this.saveTradingConfig();
        console.log(`[Bump] Success! Bump ${task.completedBumps}/${task.totalBumps || '∞'}`);
      } catch (error: any) {
        console.log(`[Bump] Error: ${error.message}`);
      }

      // Schedule next bump
      if (task.enabled && (task.totalBumps === 0 || task.completedBumps < task.totalBumps)) {
        const nextDelay = task.minIntervalMs + Math.random() * (task.maxIntervalMs - task.minIntervalMs);
        const timeout = setTimeout(runBump, nextDelay);
        this.bumpTaskIntervals.set(task.id, timeout);
      }
    };

    // Start first bump
    runBump();
  }

  private stopBumpBot(taskId: string): void {
    const task = this.tradingConfig.bumpTasks.find(t => t.id === taskId);
    if (task) {
      task.enabled = false;
      this.saveTradingConfig();
    }

    const interval = this.bumpTaskIntervals.get(taskId);
    if (interval) {
      clearTimeout(interval);
      this.bumpTaskIntervals.delete(taskId);
    }
  }

  // ============================================
  // HOLDER DISTRIBUTION
  // ============================================

  private async holderDistribution(): Promise<void> {
    this.clearScreen();
    console.log('\n--- Holder Distribution ---\n');
    console.log('Distribute tokens from one wallet to multiple wallets to increase holder count.\n');

    if (this.config.wallets.length < 2) {
      console.log('Need at least 2 wallets for distribution.');
      await this.prompt('Press Enter to continue...');
      return;
    }

    // Get token mint
    const tokenMint = await this.prompt('Token Mint Address: ');
    if (!tokenMint) return;

    // Select source wallet
    console.log('\nSelect SOURCE wallet (has the tokens):');
    this.config.wallets.forEach((w, i) => {
      console.log(`  ${i + 1}. ${w.name}`);
    });

    const sourceChoice = await this.prompt('\nSource wallet #: ');
    const sourceIndex = parseInt(sourceChoice, 10) - 1;

    if (sourceIndex < 0 || sourceIndex >= this.config.wallets.length) {
      console.log('Invalid selection.');
      await this.prompt('Press Enter to continue...');
      return;
    }

    const sourceWallet = this.config.wallets[sourceIndex];

    // Get source wallet keypair and check token balance
    let sourceKeypair: Keypair;
    try {
      if (sourceWallet.isMain && process.env.SOLANA_PRIVATE_KEY) {
        sourceKeypair = Keypair.fromSecretKey(bs58.decode(process.env.SOLANA_PRIVATE_KEY));
      } else if (sourceWallet.privateKey && sourceWallet.privateKey !== '[FROM_ENV]') {
        sourceKeypair = Keypair.fromSecretKey(bs58.decode(sourceWallet.privateKey));
      } else {
        console.log('Cannot access source wallet private key.');
        await this.prompt('Press Enter to continue...');
        return;
      }
    } catch (e) {
      console.log('Error loading source wallet.');
      await this.prompt('Press Enter to continue...');
      return;
    }

    // Check token balance
    console.log('\nChecking token balance...');
    let tokenBalance = 0;
    let tokenAccount: PublicKey | null = null;

    try {
      const tokenAccounts = await this.connection.getParsedTokenAccountsByOwner(
        sourceKeypair.publicKey,
        { programId: new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA') }
      );

      for (const acc of tokenAccounts.value) {
        const parsed = acc.account.data.parsed.info;
        if (parsed.mint === tokenMint) {
          tokenBalance = parsed.tokenAmount.uiAmount || 0;
          tokenAccount = acc.pubkey;
          break;
        }
      }
    } catch (e) {
      console.log('Error checking balance.');
      await this.prompt('Press Enter to continue...');
      return;
    }

    if (tokenBalance <= 0) {
      console.log(`No tokens found in source wallet for mint ${tokenMint.substring(0, 8)}...`);
      await this.prompt('Press Enter to continue...');
      return;
    }

    console.log(`\nToken Balance: ${tokenBalance.toLocaleString()} tokens`);

    // Select destination wallets
    console.log('\nSelect DESTINATION wallets:');
    const otherWallets = this.config.wallets.filter((_, i) => i !== sourceIndex);
    otherWallets.forEach((w, i) => {
      const realIndex = this.config.wallets.findIndex(ww => ww.publicKey === w.publicKey);
      console.log(`  ${realIndex + 1}. ${w.name}`);
    });

    const destChoice = await this.prompt('\nDestination wallets (comma-separated or "all"): ');
    let destIndices: number[];

    if (destChoice.toLowerCase() === 'all') {
      destIndices = this.config.wallets.map((_, i) => i).filter(i => i !== sourceIndex);
    } else {
      destIndices = destChoice.split(',').map(s => parseInt(s.trim(), 10) - 1).filter(i => i >= 0 && i !== sourceIndex);
    }

    if (destIndices.length === 0) {
      console.log('No destination wallets selected.');
      await this.prompt('Press Enter to continue...');
      return;
    }

    // Distribution settings
    console.log('\n--- Distribution Settings ---\n');

    const percentStr = await this.prompt(`Percent of tokens to distribute (1-100, default 80): `);
    const distributePercent = Math.min(100, Math.max(1, parseFloat(percentStr) || 80));

    const totalToDistribute = tokenBalance * (distributePercent / 100);
    const perWallet = totalToDistribute / destIndices.length;

    const randomizeStr = await this.prompt('Randomize amounts? (yes/no, default yes): ');
    const randomize = randomizeStr.toLowerCase() !== 'no';

    const delayStr = await this.prompt('Delay between transfers in seconds (default 2): ');
    const delayMs = (parseFloat(delayStr) || 2) * 1000;

    // Summary and confirm
    console.log('\n--- Distribution Summary ---\n');
    console.log(`Source: ${sourceWallet.name}`);
    console.log(`Destinations: ${destIndices.length} wallets`);
    console.log(`Total to distribute: ${totalToDistribute.toLocaleString()} tokens (${distributePercent}%)`);
    console.log(`Per wallet (avg): ~${perWallet.toLocaleString()} tokens`);
    console.log(`Randomize: ${randomize ? 'Yes' : 'No'}`);

    const confirm = await this.prompt('\nProceed with distribution? (yes/no): ');
    if (confirm.toLowerCase() !== 'yes') {
      console.log('Cancelled.');
      await this.prompt('Press Enter to continue...');
      return;
    }

    // Execute distribution
    console.log('\n--- Distributing Tokens ---\n');

    // Calculate amounts for each wallet
    let amounts: number[] = [];
    if (randomize) {
      // Random distribution that sums to totalToDistribute
      let remaining = totalToDistribute;
      for (let i = 0; i < destIndices.length - 1; i++) {
        const maxForThis = remaining / (destIndices.length - i) * 1.5;
        const minForThis = remaining / (destIndices.length - i) * 0.5;
        const amount = minForThis + Math.random() * (maxForThis - minForThis);
        amounts.push(Math.floor(amount));
        remaining -= amounts[i];
      }
      amounts.push(Math.floor(remaining)); // Last wallet gets remainder
    } else {
      amounts = destIndices.map(() => Math.floor(perWallet));
    }

    // Shuffle amounts for more randomness
    if (randomize) {
      amounts = amounts.sort(() => Math.random() - 0.5);
    }

    let successCount = 0;
    for (let i = 0; i < destIndices.length; i++) {
      const destWallet = this.config.wallets[destIndices[i]];
      const amount = amounts[i];

      if (amount <= 0) continue;

      console.log(`Sending ${amount.toLocaleString()} tokens to ${destWallet.name}...`);

      try {
        // Create token transfer using SPL token
        const { createTransferInstruction, getAssociatedTokenAddress, createAssociatedTokenAccountInstruction, getAccount } = await import('@solana/spl-token');

        const mintPubkey = new PublicKey(tokenMint);
        const destPubkey = new PublicKey(destWallet.publicKey);

        // Get or create destination token account
        const destTokenAccount = await getAssociatedTokenAddress(mintPubkey, destPubkey);

        const transaction = new Transaction();

        // Check if destination token account exists
        try {
          await getAccount(this.connection, destTokenAccount);
        } catch (e) {
          // Account doesn't exist, create it
          transaction.add(
            createAssociatedTokenAccountInstruction(
              sourceKeypair.publicKey,
              destTokenAccount,
              destPubkey,
              mintPubkey
            )
          );
        }

        // Get source token account
        const sourceTokenAccount = await getAssociatedTokenAddress(mintPubkey, sourceKeypair.publicKey);

        // Add transfer instruction (amount needs to be in raw units)
        // Assuming 6 decimals for pump.fun tokens
        const rawAmount = Math.floor(amount * 1_000_000);

        transaction.add(
          createTransferInstruction(
            sourceTokenAccount,
            destTokenAccount,
            sourceKeypair.publicKey,
            rawAmount
          )
        );

        const signature = await sendAndConfirmTransaction(this.connection, transaction, [sourceKeypair]);
        console.log(`  Success! Tx: ${signature.substring(0, 16)}...`);
        successCount++;
      } catch (error: any) {
        console.log(`  Failed: ${error.message}`);
      }

      // Delay before next transfer
      if (i < destIndices.length - 1) {
        await new Promise(r => setTimeout(r, delayMs));
      }
    }

    console.log(`\n--- Distribution Complete ---`);
    console.log(`Successful transfers: ${successCount}/${destIndices.length}`);
    await this.prompt('\nPress Enter to continue...');
  }

  // ============================================
  // PRICE MONITOR
  // ============================================

  private async togglePriceMonitor(): Promise<void> {
    if (this.priceMonitorInterval) {
      clearInterval(this.priceMonitorInterval);
      this.priceMonitorInterval = null;
      console.log('\nPrice monitor stopped.');
    } else {
      this.startPriceMonitor();
      console.log('\nPrice monitor started.');
    }
    await this.prompt('Press Enter to continue...');
  }

  private startPriceMonitor(): void {
    if (this.priceMonitorInterval) return;

    console.log('[Monitor] Starting price monitor...');

    this.priceMonitorInterval = setInterval(async () => {
      for (const autoSell of this.tradingConfig.autoSells) {
        if (!autoSell.enabled) continue;

        try {
          // Get current price
          const priceResp = await fetch(`${PUMPPORTAL_API_URL}/token/${autoSell.tokenMint}`);
          if (!priceResp.ok) continue;

          const priceData = await priceResp.json();
          const currentPrice = priceData.price_sol || 0;

          if (currentPrice <= 0) continue;

          // Update highest price for trailing stop
          if (currentPrice > autoSell.highestPriceSol) {
            autoSell.highestPriceSol = currentPrice;
            this.saveTradingConfig();
          }

          const changePercent = ((currentPrice / autoSell.entryPriceSol) - 1) * 100;
          const fromHighPercent = ((currentPrice / autoSell.highestPriceSol) - 1) * 100;

          let shouldSell = false;
          let reason = '';

          // Check take profit
          if (autoSell.takeProfitPercent && changePercent >= autoSell.takeProfitPercent) {
            shouldSell = true;
            reason = `Take Profit hit (+${changePercent.toFixed(1)}%)`;
          }

          // Check stop loss
          if (autoSell.stopLossPercent && changePercent <= autoSell.stopLossPercent) {
            shouldSell = true;
            reason = `Stop Loss hit (${changePercent.toFixed(1)}%)`;
          }

          // Check trailing stop
          if (autoSell.trailingStopPercent && fromHighPercent <= -autoSell.trailingStopPercent) {
            shouldSell = true;
            reason = `Trailing Stop hit (${fromHighPercent.toFixed(1)}% from high)`;
          }

          if (shouldSell) {
            console.log(`\n[AutoSell] ${autoSell.tokenSymbol}: ${reason}`);
            await this.executeAutoSell(autoSell);
          }
        } catch (error: any) {
          console.log(`[Monitor] Error checking ${autoSell.tokenSymbol}: ${error.message}`);
        }
      }
    }, this.tradingConfig.priceCheckIntervalMs);
  }

  private async executeAutoSell(autoSell: AutoSellConfig): Promise<void> {
    const wallet = this.config.wallets[autoSell.walletIndex];
    if (!wallet) {
      console.log(`[AutoSell] Wallet not found for ${autoSell.tokenSymbol}`);
      return;
    }

    try {
      let keypair: Keypair;
      if (wallet.isMain && process.env.SOLANA_PRIVATE_KEY) {
        keypair = Keypair.fromSecretKey(bs58.decode(process.env.SOLANA_PRIVATE_KEY));
      } else if (wallet.privateKey && wallet.privateKey !== '[FROM_ENV]') {
        keypair = Keypair.fromSecretKey(bs58.decode(wallet.privateKey));
      } else {
        console.log(`[AutoSell] Cannot access private key for ${wallet.name}`);
        return;
      }

      // Get token balance
      const tokenAccounts = await this.connection.getParsedTokenAccountsByOwner(
        keypair.publicKey,
        { programId: new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA') }
      );

      for (const acc of tokenAccounts.value) {
        const parsed = acc.account.data.parsed.info;
        if (parsed.mint === autoSell.tokenMint && parsed.tokenAmount.uiAmount > 0) {
          const sellAmount = parsed.tokenAmount.uiAmount * (autoSell.sellPercent / 100);

          console.log(`[AutoSell] Selling ${sellAmount} ${autoSell.tokenSymbol}...`);

          const result = await this.sellPumpFunToken(keypair, autoSell.tokenMint, sellAmount, 15, 0.0005);
          console.log(`[AutoSell] Sell complete: ${result.signature}`);

          // Disable auto-sell after execution
          autoSell.enabled = false;
          this.saveTradingConfig();
          break;
        }
      }
    } catch (error: any) {
      console.log(`[AutoSell] Error selling ${autoSell.tokenSymbol}: ${error.message}`);
    }
  }

  // ============================================
  // SELL ALL POSITIONS
  // ============================================

  private async sellAllPositions(): Promise<void> {
    this.clearScreen();
    console.log('\n--- Sell All Positions ---\n');
    console.log('WARNING: This will sell ALL token holdings across ALL wallets!\n');

    const confirm = await this.prompt('Type "SELL ALL" to confirm: ');
    if (confirm !== 'SELL ALL') {
      console.log('Cancelled.');
      await this.prompt('Press Enter to continue...');
      return;
    }

    console.log('\nSelling all positions...\n');

    for (const wallet of this.config.wallets) {
      try {
        let keypair: Keypair;
        if (wallet.isMain && process.env.SOLANA_PRIVATE_KEY) {
          keypair = Keypair.fromSecretKey(bs58.decode(process.env.SOLANA_PRIVATE_KEY));
        } else if (wallet.privateKey && wallet.privateKey !== '[FROM_ENV]') {
          keypair = Keypair.fromSecretKey(bs58.decode(wallet.privateKey));
        } else {
          continue;
        }

        const tokenAccounts = await this.connection.getParsedTokenAccountsByOwner(
          keypair.publicKey,
          { programId: new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA') }
        );

        for (const acc of tokenAccounts.value) {
          const parsed = acc.account.data.parsed.info;
          const balance = parsed.tokenAmount.uiAmount;

          if (balance > 0) {
            console.log(`${wallet.name}: Selling ${balance} of ${parsed.mint.substring(0, 8)}...`);
            try {
              await this.sellPumpFunToken(keypair, parsed.mint, balance, 20, 0.0005);
              console.log(`  Success!`);
            } catch (e: any) {
              console.log(`  Failed: ${e.message}`);
            }
          }
        }
      } catch (error: any) {
        console.log(`Error processing ${wallet.name}: ${error.message}`);
      }
    }

    console.log('\nSell all complete.');
    await this.prompt('Press Enter to continue...');
  }

  // ============================================
  // MAIN MENU
  // ============================================

  async run(): Promise<void> {
    while (true) {
      this.clearScreen();
      this.printHeader();

      const activeWallet = this.config.activeWalletIndex >= 0
        ? this.config.wallets[this.config.activeWalletIndex]?.name
        : 'None';

      const activeAutoSells = this.tradingConfig.autoSells.filter(a => a.enabled).length;
      const priceMonitorStatus = this.priceMonitorInterval ? 'ON' : 'OFF';

      console.log(`\n  Active Wallet: ${activeWallet}`);
      console.log(`  Bundler: ${this.config.bundler.enabled ? 'ON' : 'OFF'} | Jito: ${this.config.bundler.jitoEnabled ? 'ON' : 'OFF'}`);
      console.log(`  Auto-Sells: ${activeAutoSells} | Price Monitor: ${priceMonitorStatus}`);

      this.printMenu('Main Menu', [
        'Wallet Management',
        'Token Launch (PumpFun)',
        'Trading & Automation',
        'Bundler Configuration',
        'Quick Balance Check',
        'Settings',
        'Start Bot Service',
      ]);

      const choice = await this.prompt('Select option: ');

      switch (choice) {
        case '1':
          await this.walletMenu();
          break;
        case '2':
          await this.tokenLaunchMenu();
          break;
        case '3':
          await this.tradingMenu();
          break;
        case '4':
          await this.configureBundler();
          break;
        case '5':
          await this.quickCheckBalance();
          break;
        case '6':
          await this.settingsMenu();
          break;
        case '7':
          console.log('\nStarting bot service...');
          console.log('(This would start the main index.ts service)');
          await this.prompt('Press Enter to continue...');
          break;
        case '0':
          console.log('\nGoodbye!\n');
          this.rl.close();
          process.exit(0);
        default:
          break;
      }
    }
  }
}

// ============================================
// ENTRY POINT
// ============================================

async function main() {
  const cli = new InteractiveCLI();
  await cli.run();
}

main().catch((error) => {
  console.error('CLI Error:', error);
  process.exit(1);
});
