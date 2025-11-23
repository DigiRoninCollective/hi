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

function updateEnvValue(key: string, value: string) {
  let envContent = fs.readFileSync('.env', 'utf-8');
  const regex = new RegExp(`${key}=.*`, 'g');
  if (envContent.match(regex)) {
    envContent = envContent.replace(regex, `${key}=${value}`);
  } else {
    envContent += `\n${key}=${value}`;
  }
  fs.writeFileSync('.env', envContent);
}

function getEnvValue(key: string): string | null {
  if (!fs.existsSync('.env')) return null;
  const envContent = fs.readFileSync('.env', 'utf-8');
  const match = envContent.match(new RegExp(`${key}=(\\S*)`));
  return match ? match[1] : null;
}

async function setupWizard() {
  clearScreen();
  console.log('\n🔧 SETUP WIZARD\n');
  console.log('   1. ⚡ Quick Setup (Essential config only)');
  console.log('   2. 📋 Full Walkthrough (All options)');
  console.log('   3. 🔙 Back to main menu\n');

  const mode = await prompt('   Select mode: ');

  if (mode === '3') return;

  // Copy .env.example if .env doesn't exist
  if (!fs.existsSync('.env')) {
    if (fs.existsSync('.env.example')) {
      fs.copyFileSync('.env.example', '.env');
      console.log('\n✅ Created .env from .env.example');
    }
  }

  if (mode === '1') {
    await quickSetup();
  } else {
    await fullWalkthrough();
  }
}

async function quickSetup() {
  clearScreen();
  console.log('\n⚡ QUICK SETUP\n');
  console.log('Configure only the essentials to get started.\n');

  // Step 1: Wallet
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('STEP 1/2: Wallet Configuration');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const currentPk = getEnvValue('SOLANA_PRIVATE_KEY');
  if (currentPk && currentPk !== 'your_base58_private_key') {
    console.log(`   Current: ${currentPk.substring(0, 8)}...****`);
    const change = await prompt('   Change wallet? (y/N): ');
    if (change.toLowerCase() === 'y') {
      const pk = await prompt('   Enter private key (Base58): ');
      if (pk) {
        updateEnvValue('SOLANA_PRIVATE_KEY', pk);
        console.log('   ✅ Wallet updated\n');
      }
    }
  } else {
    const pk = await prompt('   Enter Solana private key (Base58) or [S]kip: ');
    if (pk && pk.toLowerCase() !== 's') {
      updateEnvValue('SOLANA_PRIVATE_KEY', pk);
      console.log('   ✅ Wallet saved\n');
    } else {
      console.log('   ⏭️  Skipped\n');
    }
  }

  // Step 2: RPC
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('STEP 2/2: RPC Configuration');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log('   Recommended providers:');
  console.log('   • Helius (helius.dev) - Best for Solana');
  console.log('   • QuickNode (quicknode.com)');
  console.log('   • Shyft (shyft.to) - Good free tier\n');

  const currentRpc = getEnvValue('SOLANA_RPC_URL');
  const isPublicRpc = currentRpc?.includes('api.mainnet-beta.solana.com');

  if (isPublicRpc) {
    console.log('   ⚠️  Using public RPC (slow & rate-limited)\n');
  } else if (currentRpc) {
    console.log(`   Current: ${currentRpc.substring(0, 40)}...\n`);
  }

  const rpc = await prompt('   Enter RPC URL or [S]kip: ');
  if (rpc && rpc.toLowerCase() !== 's') {
    updateEnvValue('SOLANA_RPC_URL', rpc);
    console.log('   ✅ RPC saved\n');
  } else {
    console.log('   ⏭️  Skipped\n');
  }

  await finishSetup();
}

async function fullWalkthrough() {
  clearScreen();
  console.log('\n📋 FULL WALKTHROUGH\n');
  console.log('Press [S] at any prompt to skip that section.\n');

  const steps = [
    { name: 'Wallet', fn: configureWallet },
    { name: 'RPC', fn: configureRpc },
    { name: 'Telegram Bot', fn: configureTelegram },
    { name: 'Twitter API', fn: configureTwitter },
    { name: 'Jito MEV Protection', fn: configureJito },
    { name: 'PumpFun Settings', fn: configurePumpFun },
  ];

  for (let i = 0; i < steps.length; i++) {
    clearScreen();
    console.log(`\n📋 FULL WALKTHROUGH - Step ${i + 1}/${steps.length}\n`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`${steps[i].name.toUpperCase()} CONFIGURATION`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    const skip = await prompt(`Configure ${steps[i].name}? (Y/n/skip all): `);

    if (skip.toLowerCase() === 'skip all') {
      console.log('\n⏭️  Skipping remaining configuration...');
      break;
    }

    if (skip.toLowerCase() !== 'n') {
      await steps[i].fn();
    } else {
      console.log('   ⏭️  Skipped\n');
    }
  }

  await finishSetup();
}

async function configureWallet() {
  console.log('   Your Solana wallet private key (Base58 encoded)');
  console.log('   This is stored locally in .env and never shared.\n');

  const currentPk = getEnvValue('SOLANA_PRIVATE_KEY');
  if (currentPk && currentPk !== 'your_base58_private_key') {
    console.log(`   Current: ${currentPk.substring(0, 8)}...****\n`);
  }

  const pk = await prompt('   Enter private key or [S]kip: ');
  if (pk && pk.toLowerCase() !== 's') {
    updateEnvValue('SOLANA_PRIVATE_KEY', pk);
    console.log('   ✅ Wallet saved\n');
  }
}

async function configureRpc() {
  console.log('   Recommended RPC Providers:');
  console.log('   1. Helius (helius.dev) - Best for Solana, free tier');
  console.log('   2. QuickNode (quicknode.com) - Reliable');
  console.log('   3. Triton (triton.one) - Fast');
  console.log('   4. Shyft (shyft.to) - Good free tier');
  console.log('   5. Public (slow, not recommended)\n');

  const currentRpc = getEnvValue('SOLANA_RPC_URL');
  if (currentRpc) {
    console.log(`   Current: ${currentRpc.substring(0, 50)}...\n`);
  }

  const choice = await prompt('   Enter RPC URL or [S]kip: ');
  if (choice && choice.toLowerCase() !== 's') {
    updateEnvValue('SOLANA_RPC_URL', choice);

    // Also set WebSocket URL if it's a Helius URL
    if (choice.includes('helius')) {
      const wsUrl = choice.replace('https://', 'wss://');
      updateEnvValue('SOLANA_WS_URL', wsUrl);
      console.log('   ✅ RPC & WebSocket URLs saved\n');
    } else {
      console.log('   ✅ RPC URL saved\n');
    }
  }
}

async function configureTelegram() {
  console.log('   Create a bot via @BotFather on Telegram');
  console.log('   You\'ll receive a bot token like: 123456:ABC-DEF...\n');

  const currentToken = getEnvValue('TELEGRAM_BOT_TOKEN');
  if (currentToken && currentToken !== 'your_telegram_bot_token') {
    console.log(`   Current: ${currentToken.substring(0, 10)}...****\n`);
  }

  const token = await prompt('   Enter Telegram bot token or [S]kip: ');
  if (token && token.toLowerCase() !== 's') {
    updateEnvValue('TELEGRAM_BOT_TOKEN', token);
    console.log('   ✅ Telegram bot token saved\n');

    const chatId = await prompt('   Enter your Chat ID (optional) or [S]kip: ');
    if (chatId && chatId.toLowerCase() !== 's') {
      updateEnvValue('TELEGRAM_CHAT_ID', chatId);
      console.log('   ✅ Chat ID saved\n');
    }

    updateEnvValue('ALPHA_TELEGRAM_ENABLED', 'true');
    updateEnvValue('ALPHA_TELEGRAM_BOT_TOKEN', token);
  }
}

async function configureTwitter() {
  console.log('   Create an app at developer.twitter.com');
  console.log('   You\'ll need API Key, Secret, and Bearer Token.\n');

  const currentKey = getEnvValue('TWITTER_API_KEY');
  if (currentKey && currentKey !== 'your_api_key') {
    console.log('   ✅ Twitter credentials already configured\n');
    const change = await prompt('   Reconfigure? (y/N): ');
    if (change.toLowerCase() !== 'y') return;
  }

  const apiKey = await prompt('   API Key or [S]kip: ');
  if (apiKey && apiKey.toLowerCase() !== 's') {
    updateEnvValue('TWITTER_API_KEY', apiKey);

    const apiSecret = await prompt('   API Secret: ');
    if (apiSecret) updateEnvValue('TWITTER_API_SECRET', apiSecret);

    const bearerToken = await prompt('   Bearer Token: ');
    if (bearerToken) updateEnvValue('TWITTER_BEARER_TOKEN', bearerToken);

    const accessToken = await prompt('   Access Token (optional): ');
    if (accessToken) updateEnvValue('TWITTER_ACCESS_TOKEN', accessToken);

    const accessSecret = await prompt('   Access Secret (optional): ');
    if (accessSecret) updateEnvValue('TWITTER_ACCESS_SECRET', accessSecret);

    console.log('   ✅ Twitter credentials saved\n');
  }
}

async function configureJito() {
  console.log('   Jito provides MEV protection & faster tx landing.');
  console.log('   Tip amount: 0.00001 SOL per transaction (default)\n');

  const enabled = await prompt('   Enable Jito? (y/N): ');
  if (enabled.toLowerCase() === 'y') {
    updateEnvValue('JITO_ENABLED', 'true');
    updateEnvValue('BUNDLER_ENABLED', 'true');

    console.log('\n   Block Engine regions:');
    console.log('   1. Default (mainnet.block-engine.jito.wtf)');
    console.log('   2. Amsterdam');
    console.log('   3. Frankfurt');
    console.log('   4. New York');
    console.log('   5. Tokyo\n');

    const region = await prompt('   Select region (1-5) or [S]kip: ');
    const regionUrls: { [key: string]: string } = {
      '1': 'https://mainnet.block-engine.jito.wtf',
      '2': 'https://amsterdam.mainnet.block-engine.jito.wtf',
      '3': 'https://frankfurt.mainnet.block-engine.jito.wtf',
      '4': 'https://ny.mainnet.block-engine.jito.wtf',
      '5': 'https://tokyo.mainnet.block-engine.jito.wtf',
    };

    if (region && regionUrls[region]) {
      updateEnvValue('JITO_BLOCK_ENGINE_URL', regionUrls[region]);
    }

    const tip = await prompt('   Tip amount in SOL (default 0.00001) or [S]kip: ');
    if (tip && tip.toLowerCase() !== 's') {
      updateEnvValue('JITO_TIP_SOL', tip);
    }

    console.log('   ✅ Jito enabled\n');
  } else {
    updateEnvValue('JITO_ENABLED', 'false');
    console.log('   ⏭️  Jito disabled\n');
  }
}

async function configurePumpFun() {
  console.log('   Configure default PumpFun token launch settings.\n');

  const slippage = await prompt('   Default slippage % (default 10) or [S]kip: ');
  if (slippage && slippage.toLowerCase() !== 's') {
    const bps = parseFloat(slippage) * 100;
    updateEnvValue('PUMPFUN_DEFAULT_SLIPPAGE_BPS', bps.toString());
  }

  const initialBuy = await prompt('   Default initial buy SOL (default 0.1) or [S]kip: ');
  if (initialBuy && initialBuy.toLowerCase() !== 's') {
    updateEnvValue('DEFAULT_INITIAL_BUY_SOL', initialBuy);
  }

  const priorityFee = await prompt('   Priority fee microlamports (default 250000) or [S]kip: ');
  if (priorityFee && priorityFee.toLowerCase() !== 's') {
    updateEnvValue('PUMPFUN_PRIORITY_FEE', priorityFee);
  }

  console.log('   ✅ PumpFun settings saved\n');
}

async function finishSetup() {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('FINISHING SETUP');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

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
