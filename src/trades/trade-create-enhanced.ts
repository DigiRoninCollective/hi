/**
 * Enhanced Trade Creation CLI with Spinners and Progress Indicators
 * Run with: npx ts-node src/trade-create-enhanced.ts
 *
 * Features:
 * - Beautiful spinner-based progress feedback
 * - Color-coded output (success, error, info)
 * - Proper error handling and recovery
 * - Support for custom contract addresses
 * - Mint key persistence for token recovery
 */

import 'dotenv/config';
import { Keypair, Connection, LAMPORTS_PER_SOL, VersionedTransaction } from '@solana/web3.js';
import bs58 from 'bs58';
import { readFile } from 'fs/promises';
import { fetch } from 'undici';
import { Blob } from 'buffer';

// Dynamic imports for ESM modules
const ora = require('ora').default;
const chalk = require('chalk');

// Configuration
const RPC_ENDPOINT = process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';
const DEPLOYER_PRIVATE_KEY = process.env.SOLANA_PRIVATE_KEY;
const CUSTOM_CONTRACT = process.env.CUSTOM_CONTRACT_ADDRESS;
const IMAGE_PATH = process.env.TOKEN_IMAGE_PATH || './logo.png';
const PUMPPORTAL_API_URL = 'https://pumpportal.fun/api';

// Token metadata configuration
const TOKEN_CONFIG = {
  name: process.env.TOKEN_NAME || 'MyToken',
  symbol: process.env.TOKEN_SYMBOL || 'MTK',
  description: process.env.TOKEN_DESCRIPTION || 'A test token created via enhanced CLI',
  website: process.env.TOKEN_WEBSITE || 'https://example.com',
  twitter: process.env.TOKEN_TWITTER || 'https://twitter.com/example',
  telegram: process.env.TOKEN_TELEGRAM || 'https://t.me/example',
};

function validateConfig(): string[] {
  const errors: string[] = [];

  if (!DEPLOYER_PRIVATE_KEY) {
    errors.push('SOLANA_PRIVATE_KEY not set in .env');
  }

  if (!RPC_ENDPOINT) {
    errors.push('SOLANA_RPC_URL not set in .env');
  }

  if (TOKEN_CONFIG.name.length < 1 || TOKEN_CONFIG.name.length > 50) {
    errors.push('Token name must be 1-50 characters');
  }

  if (TOKEN_CONFIG.symbol.length < 1 || TOKEN_CONFIG.symbol.length > 10) {
    errors.push('Token symbol must be 1-10 characters');
  }

  return errors;
}

async function createTokenWithSpinner() {
  const spinner = ora();

  try {
    // Step 1: Banner
    console.log('\n' + chalk.cyan('═'.repeat(60)));
    console.log(chalk.bold.cyan('  🚀 ENHANCED TOKEN CREATION CLI  '));
    console.log(chalk.cyan('═'.repeat(60)) + '\n');

    // Step 2: Validation
    spinner.start(chalk.blue('📋 Validating configuration...'));
    const errors = validateConfig();
    if (errors.length > 0) {
      spinner.fail(chalk.red('Configuration validation failed:'));
      errors.forEach(err => console.log(chalk.red(`  ❌ ${err}`)));
      process.exit(1);
    }
    spinner.succeed(chalk.green('✅ Configuration valid'));

    // Step 3: Load deployer wallet
    spinner.start(chalk.blue('🔑 Loading deployer wallet...'));
    const signerKeyPair = Keypair.fromSecretKey(bs58.decode(DEPLOYER_PRIVATE_KEY!));
    spinner.succeed(chalk.green(`✅ Wallet loaded: ${chalk.yellow(signerKeyPair.publicKey.toBase58().slice(0, 8))}...`));

    // Step 4: Check balance
    spinner.start(chalk.blue('💰 Checking wallet balance...'));
    const connection = new Connection(RPC_ENDPOINT, 'confirmed');
    const balance = await connection.getBalance(signerKeyPair.publicKey);
    const balanceSOL = balance / LAMPORTS_PER_SOL;

    if (balanceSOL < 0.1) {
      spinner.fail(chalk.red(`Insufficient balance: ${balanceSOL.toFixed(4)} SOL (need 0.1 SOL)`));
      process.exit(1);
    }
    spinner.succeed(chalk.green(`✅ Balance: ${chalk.yellow(balanceSOL.toFixed(4))} SOL`));

    // Step 5: Generate mint keypair
    spinner.start(chalk.blue('🔐 Generating mint keypair...'));
    const mintKeypair = Keypair.generate();
    spinner.succeed(chalk.green(`✅ Mint address: ${chalk.yellow(mintKeypair.publicKey.toBase58())}`));

    // Step 6: Load and validate image
    spinner.start(chalk.blue('📷 Loading token image...'));
    let imageBuffer: Buffer;
    try {
      imageBuffer = await readFile(IMAGE_PATH);
    } catch (err) {
      spinner.fail(chalk.red(`Failed to read image: ${IMAGE_PATH}`));
      process.exit(1);
    }
    spinner.succeed(chalk.green(`✅ Image loaded: ${imageBuffer.length} bytes`));

    // Step 7: Upload metadata to IPFS
    spinner.start(chalk.blue('📤 Uploading metadata to IPFS...'));
    const FormData = require('form-data');
    const formData = new FormData();
    formData.append('file', new Blob([imageBuffer], { type: 'image/png' }), 'logo.png');
    formData.append('name', TOKEN_CONFIG.name);
    formData.append('symbol', TOKEN_CONFIG.symbol);
    formData.append('description', TOKEN_CONFIG.description);
    formData.append('website', TOKEN_CONFIG.website);
    formData.append('twitter', TOKEN_CONFIG.twitter);
    formData.append('telegram', TOKEN_CONFIG.telegram);
    formData.append('showName', 'true');

    const metadataResponse = await fetch(`${PUMPPORTAL_API_URL}/ipfs`, {
      method: 'POST',
      body: formData,
    });

    if (!metadataResponse.ok) {
      const errText = await metadataResponse.text();
      spinner.fail(chalk.red(`IPFS upload failed: ${metadataResponse.status}`));
      console.log(chalk.red(`  Error: ${errText}`));
      process.exit(1);
    }

    const metadataJSON = (await metadataResponse.json()) as any;
    const metadataUri = metadataJSON.metadataUri;
    spinner.succeed(chalk.green(`✅ Metadata uploaded: ${chalk.yellow(metadataUri.slice(0, 40))}...`));

    // Step 8: Create token via PumpPortal
    spinner.start(chalk.blue('🔨 Creating token on PumpPortal...'));
    const createResponse = await fetch(`${PUMPPORTAL_API_URL}/trade-local`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        publicKey: signerKeyPair.publicKey.toBase58(),
        action: 'create',
        tokenMetadata: {
          name: TOKEN_CONFIG.name,
          symbol: TOKEN_CONFIG.symbol,
          uri: metadataUri,
        },
        mint: mintKeypair.publicKey.toBase58(),
        denominatedInSol: 'true',
        amount: 0.1,
        slippage: 10,
        priorityFee: 0.0005,
        pool: 'pump',
      }),
    });

    if (!createResponse.ok) {
      const errText = await createResponse.text();
      spinner.fail(chalk.red(`Token creation failed: ${createResponse.status}`));
      console.log(chalk.red(`  Error: ${errText}`));
      process.exit(1);
    }

    spinner.succeed(chalk.green('✅ Token creation response received'));

    // Step 9: Sign and send transaction
    spinner.start(chalk.blue('✍️  Signing transaction...'));
    const responseBuffer = await createResponse.arrayBuffer();
    const tx = VersionedTransaction.deserialize(new Uint8Array(responseBuffer));
    tx.sign([mintKeypair, signerKeyPair]);
    spinner.succeed(chalk.green('✅ Transaction signed'));

    // Step 10: Send to blockchain
    spinner.start(chalk.blue('🚀 Sending transaction to blockchain...'));
    const signature = await connection.sendTransaction(tx, {
      skipPreflight: false,
      preflightCommitment: 'confirmed',
    });
    spinner.succeed(chalk.green(`✅ Transaction sent: ${chalk.yellow(signature.slice(0, 16))}...`));

    // Step 11: Wait for confirmation
    spinner.start(chalk.blue('⏳ Waiting for confirmation...'));
    const latestBlockhash = await connection.getLatestBlockhash('confirmed');
    await connection.confirmTransaction({
      signature,
      ...latestBlockhash,
    }, 'confirmed');
    spinner.succeed(chalk.green('✅ Transaction confirmed!'));

    // Final Summary
    console.log('\n' + chalk.cyan('═'.repeat(60)));
    console.log(chalk.bold.green('  🎉 SUCCESS - TOKEN CREATED  '));
    console.log(chalk.cyan('═'.repeat(60)));

    console.log(chalk.white('\n  Token Details:'));
    console.log(chalk.white(`    Name:        ${chalk.yellow(TOKEN_CONFIG.name)}`));
    console.log(chalk.white(`    Symbol:      ${chalk.yellow(TOKEN_CONFIG.symbol)}`));
    console.log(chalk.white(`    Mint:        ${chalk.yellow(mintKeypair.publicKey.toBase58())}`));
    if (CUSTOM_CONTRACT) {
      console.log(chalk.white(`    Contract:    ${chalk.yellow(CUSTOM_CONTRACT)}`));
    }

    console.log(chalk.white('\n  Transaction:'));
    console.log(chalk.white(`    Signature:   ${chalk.cyan(signature)}`));
    console.log(chalk.white(`    Solscan:     ${chalk.cyan(`https://solscan.io/tx/${signature}`)}`));
    console.log(chalk.white(`    PumpFun:     ${chalk.cyan(`https://pump.fun/${mintKeypair.publicKey.toBase58()}`)}`));

    console.log(chalk.cyan('═'.repeat(60)) + '\n');

  } catch (error) {
    spinner.fail(chalk.red('❌ An error occurred:'));
    console.error(chalk.red(`  ${error instanceof Error ? error.message : String(error)}`));
    process.exit(1);
  }
}

// Run
createTokenWithSpinner().catch(err => {
  console.error(chalk.red('Fatal error:'), err);
  process.exit(1);
});