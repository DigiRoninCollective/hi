import * as readline from 'readline';
import { Keypair, Connection, LAMPORTS_PER_SOL, PublicKey, Transaction, SystemProgram, sendAndConfirmTransaction } from '@solana/web3.js';
import * as bs58 from 'bs58';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config();

// ============================================
// TYPES
// ============================================

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
// CLI CLASS
// ============================================

class InteractiveCLI {
  private rl: readline.Interface;
  private config: CLIConfig;
  private configPath: string;
  private connection: Connection;

  constructor() {
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    this.configPath = path.join(process.cwd(), '.cli-config.json');
    this.config = this.loadConfig();
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
  // MAIN MENU
  // ============================================

  async run(): Promise<void> {
    while (true) {
      this.clearScreen();
      this.printHeader();

      const activeWallet = this.config.activeWalletIndex >= 0
        ? this.config.wallets[this.config.activeWalletIndex]?.name
        : 'None';

      console.log(`\n  Active Wallet: ${activeWallet}`);
      console.log(`  Bundler: ${this.config.bundler.enabled ? 'ON' : 'OFF'} | Jito: ${this.config.bundler.jitoEnabled ? 'ON' : 'OFF'}`);

      this.printMenu('Main Menu', [
        'Wallet Management',
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
          await this.configureBundler();
          break;
        case '3':
          await this.quickCheckBalance();
          break;
        case '4':
          await this.settingsMenu();
          break;
        case '5':
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
