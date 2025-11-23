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
