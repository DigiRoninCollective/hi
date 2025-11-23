#!/usr/bin/env ts-node
/**
 * One-Click Startup Script
 * Run with: npx ts-node start.ts
 * Or: npm start
 */

import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';
import { execSync, spawn } from 'child_process';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function prompt(question: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(question, (answer) => resolve(answer.trim()));
  });
}

function clearScreen() {
  console.clear();
}

function printBanner() {
  console.log(`
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║     🚀 PUMP.FUN TOKEN LAUNCHER & TRADING BOT 🚀          ║
║                                                           ║
║     Features:                                             ║
║     • Token Creation (PumpFun SDK)                        ║
║     • Multi-Wallet Management                             ║
║     • Auto-Buy / Auto-Sell (TP/SL/Trailing)              ║
║     • Volume Generation & Bump Bot                        ║
║     • Holder Distribution                                 ║
║     • Jito MEV Protection                                 ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
  `);
}

async function checkEnvironment(): Promise<{ ready: boolean; issues: string[] }> {
  const issues: string[] = [];

  // Check .env file
  if (!fs.existsSync('.env')) {
    issues.push('.env file not found');
  } else {
    const envContent = fs.readFileSync('.env', 'utf-8');

    if (!envContent.includes('SOLANA_PRIVATE_KEY=') ||
        envContent.includes('SOLANA_PRIVATE_KEY=your_base58_private_key')) {
      issues.push('SOLANA_PRIVATE_KEY not configured');
    }

    if (envContent.includes('SOLANA_RPC_URL=https://api.mainnet-beta.solana.com')) {
      issues.push('Using public RPC (recommend Helius/QuickNode for production)');
    }
  }

  // Check node_modules
  if (!fs.existsSync('node_modules')) {
    issues.push('Dependencies not installed (run npm install)');
  }

  // Check if TypeScript is compiled
  if (!fs.existsSync('dist')) {
    issues.push('TypeScript not compiled (run npm run build)');
  }

  return {
    ready: issues.filter(i => !i.includes('recommend')).length === 0,
    issues,
  };
}

async function setupWizard() {
  clearScreen();
  console.log('\n🔧 FIRST-TIME SETUP WIZARD\n');
  console.log('Let\'s get you configured!\n');

  // Copy .env.example if .env doesn't exist
  if (!fs.existsSync('.env')) {
    if (fs.existsSync('.env.example')) {
      fs.copyFileSync('.env.example', '.env');
      console.log('✅ Created .env from .env.example\n');
    }
  }

  // Get RPC URL
  console.log('📡 RPC Configuration');
  console.log('   Recommended: Helius (helius.dev) - free tier available');
  console.log('   Public RPC will be slow and rate-limited\n');

  const rpcChoice = await prompt('Enter RPC URL (or press Enter for public): ');

  if (rpcChoice) {
    let envContent = fs.readFileSync('.env', 'utf-8');
    envContent = envContent.replace(
      /SOLANA_RPC_URL=.*/,
      `SOLANA_RPC_URL=${rpcChoice}`
    );
    fs.writeFileSync('.env', envContent);
    console.log('✅ RPC URL saved\n');
  }

  // Get Private Key
  console.log('🔑 Wallet Configuration');
  console.log('   Enter your Solana wallet private key (Base58 encoded)');
  console.log('   This is stored locally in .env and never shared\n');

  const pkChoice = await prompt('Enter private key (or press Enter to skip): ');

  if (pkChoice) {
    let envContent = fs.readFileSync('.env', 'utf-8');
    envContent = envContent.replace(
      /SOLANA_PRIVATE_KEY=.*/,
      `SOLANA_PRIVATE_KEY=${pkChoice}`
    );
    fs.writeFileSync('.env', envContent);
    console.log('✅ Private key saved\n');
  }

  // Install dependencies if needed
  if (!fs.existsSync('node_modules')) {
    console.log('📦 Installing dependencies...');
    execSync('npm install', { stdio: 'inherit' });
    console.log('✅ Dependencies installed\n');
  }

  // Build TypeScript
  console.log('🔨 Building TypeScript...');
  try {
    execSync('npm run build', { stdio: 'inherit' });
    console.log('✅ Build complete\n');
  } catch (e) {
    console.log('⚠️  Build had some issues, but may still work\n');
  }

  console.log('🎉 Setup complete!\n');
  await prompt('Press Enter to continue to main menu...');
}

async function quickStart() {
  clearScreen();
  console.log('\n⚡ QUICK START\n');

  const { ready, issues } = await checkEnvironment();

  if (!ready) {
    console.log('❌ Environment not ready:\n');
    issues.forEach(i => console.log(`   • ${i}`));
    console.log('\nRun setup wizard first (option 2)\n');
    await prompt('Press Enter to continue...');
    return;
  }

  console.log('✅ Environment ready!\n');
  console.log('Starting Interactive CLI...\n');

  // Start the CLI
  const cli = spawn('npx', ['ts-node', 'src/cli.ts'], {
    stdio: 'inherit',
    shell: true,
  });

  cli.on('close', (code) => {
    process.exit(code || 0);
  });
}

async function startBotService() {
  clearScreen();
  console.log('\n🤖 STARTING BOT SERVICE\n');

  const { ready, issues } = await checkEnvironment();

  if (!ready) {
    console.log('❌ Environment not ready:\n');
    issues.forEach(i => console.log(`   • ${i}`));
    await prompt('Press Enter to continue...');
    return;
  }

  console.log('Starting main bot service (Telegram, Twitter monitoring)...\n');

  const bot = spawn('npx', ['ts-node', 'src/index.ts'], {
    stdio: 'inherit',
    shell: true,
  });

  bot.on('close', (code) => {
    process.exit(code || 0);
  });
}

async function showStatus() {
  clearScreen();
  console.log('\n📊 SYSTEM STATUS\n');

  const { ready, issues } = await checkEnvironment();

  console.log(`Environment: ${ready ? '✅ Ready' : '❌ Not Ready'}\n`);

  if (issues.length > 0) {
    console.log('Issues/Warnings:');
    issues.forEach(i => {
      const icon = i.includes('recommend') ? '⚠️ ' : '❌ ';
      console.log(`   ${icon}${i}`);
    });
  } else {
    console.log('   No issues found!');
  }

  // Check wallet balance if configured
  if (fs.existsSync('.env')) {
    const envContent = fs.readFileSync('.env', 'utf-8');
    const pkMatch = envContent.match(/SOLANA_PRIVATE_KEY=(\S+)/);
    const rpcMatch = envContent.match(/SOLANA_RPC_URL=(\S+)/);

    if (pkMatch && pkMatch[1] !== 'your_base58_private_key' && rpcMatch) {
      console.log('\n💰 Wallet Info:');
      try {
        const { Keypair, Connection, LAMPORTS_PER_SOL } = require('@solana/web3.js');
        const bs58 = require('bs58');

        const keypair = Keypair.fromSecretKey(bs58.decode(pkMatch[1]));
        const connection = new Connection(rpcMatch[1], 'confirmed');

        const balance = await connection.getBalance(keypair.publicKey);
        console.log(`   Address: ${keypair.publicKey.toBase58().substring(0, 8)}...`);
        console.log(`   Balance: ${(balance / LAMPORTS_PER_SOL).toFixed(4)} SOL`);
      } catch (e: any) {
        console.log(`   Could not fetch wallet info: ${e.message}`);
      }
    }
  }

  console.log('\n📦 Installed SDKs:');
  const packages = ['pumpdotfun-sdk', '@solana/web3.js', '@solana/spl-token', 'jito-ts'];
  packages.forEach(pkg => {
    const installed = fs.existsSync(`node_modules/${pkg}`);
    console.log(`   ${installed ? '✅' : '❌'} ${pkg}`);
  });

  console.log('');
  await prompt('Press Enter to continue...');
}

async function mainMenu() {
  while (true) {
    clearScreen();
    printBanner();

    const { ready } = await checkEnvironment();
    console.log(`   Status: ${ready ? '✅ Ready to launch' : '⚠️  Setup required'}\n`);

    console.log('   1. 🚀 Quick Start (Launch CLI)');
    console.log('   2. 🔧 Setup Wizard (First-time setup)');
    console.log('   3. 🤖 Start Bot Service (Telegram/Twitter)');
    console.log('   4. 📊 System Status');
    console.log('   5. 📖 Open Documentation');
    console.log('   0. 👋 Exit\n');

    const choice = await prompt('   Select option: ');

    switch (choice) {
      case '1':
        await quickStart();
        break;
      case '2':
        await setupWizard();
        break;
      case '3':
        await startBotService();
        break;
      case '4':
        await showStatus();
        break;
      case '5':
        console.log('\n📖 Documentation: https://github.com/your-repo/docs');
        console.log('   .env.example - Configuration reference');
        console.log('   src/cli.ts - Interactive CLI source');
        console.log('   src/pumpfun.service.ts - PumpFun SDK service\n');
        await prompt('Press Enter to continue...');
        break;
      case '0':
        console.log('\n👋 Goodbye!\n');
        rl.close();
        process.exit(0);
      default:
        break;
    }
  }
}

// Entry point
mainMenu().catch((error) => {
  console.error('Error:', error);
  process.exit(1);
});
