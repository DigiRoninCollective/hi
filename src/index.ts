import { loadConfig } from './config';
import { TwitterStreamService } from './twitter';
import { PumpPortalService } from './pumpportal';
import { ParsedLaunchCommand } from './types';

// Track launched tokens to avoid duplicates
const launchedTokens = new Set<string>();

async function main() {
  console.log('='.repeat(60));
  console.log('  PumpFun Twitter Launcher');
  console.log('  Powered by PumpPortal');
  console.log('='.repeat(60));
  console.log();

  // Load configuration
  let config;
  try {
    config = loadConfig();
    console.log('Configuration loaded successfully');
  } catch (error) {
    console.error('Failed to load configuration:', error);
    console.error('\nMake sure you have created a .env file with all required variables.');
    console.error('See .env.example for reference.');
    process.exit(1);
  }

  // Initialize PumpPortal service
  console.log('\nInitializing PumpPortal service...');
  const pumpPortal = new PumpPortalService(
    config.solana,
    config.pumpPortal,
    config.tokenDefaults
  );

  // Check wallet balance
  try {
    const balance = await pumpPortal.getBalance();
    console.log(`Wallet address: ${pumpPortal.getWalletAddress()}`);
    console.log(`Wallet balance: ${balance.toFixed(4)} SOL`);

    if (balance < 0.1) {
      console.warn('\nWarning: Low wallet balance. You may not have enough SOL to create tokens.');
    }
  } catch (error) {
    console.error('Failed to check wallet balance:', error);
    console.error('Make sure your Solana RPC URL is correct and accessible.');
    process.exit(1);
  }

  // Initialize Twitter stream service
  console.log('\nInitializing Twitter stream service...');
  console.log(`Monitoring users: ${config.twitter.usernames.join(', ') || '(none)'}`);
  console.log(`Monitoring hashtags: ${config.twitter.hashtags.join(', ') || '(none)'}`);

  const twitter = new TwitterStreamService(config.twitter);

  // Set up the launch handler
  twitter.onLaunch(async (command: ParsedLaunchCommand) => {
    // Create a unique key for this launch to prevent duplicates
    const launchKey = `${command.ticker}-${command.tweetId}`;

    if (launchedTokens.has(launchKey)) {
      console.log(`\nSkipping duplicate launch: ${command.ticker}`);
      return;
    }

    console.log('\n' + '='.repeat(60));
    console.log('  NEW TOKEN LAUNCH DETECTED');
    console.log('='.repeat(60));

    try {
      // Mark as launched immediately to prevent race conditions
      launchedTokens.add(launchKey);

      // Create the token
      const result = await pumpPortal.createToken(command);

      console.log('\n' + '-'.repeat(40));
      console.log('  TOKEN LAUNCH SUCCESSFUL');
      console.log('-'.repeat(40));
      console.log(`  Ticker: ${command.ticker}`);
      console.log(`  Name: ${command.name}`);
      console.log(`  Mint: ${result.mint}`);
      console.log(`  Signature: ${result.signature}`);
      console.log(`  PumpFun: https://pump.fun/${result.mint}`);
      console.log('-'.repeat(40) + '\n');
    } catch (error) {
      console.error('\nFailed to create token:', error);

      // Remove from launched set so it can be retried
      launchedTokens.delete(launchKey);
    }
  });

  // Start the Twitter stream
  try {
    await twitter.start();
  } catch (error) {
    console.error('Failed to start Twitter stream:', error);
    console.error('\nMake sure your Twitter API credentials are correct.');
    console.error('You need Twitter API v2 access with filtered stream permissions.');
    process.exit(1);
  }

  // Handle shutdown
  const shutdown = async () => {
    console.log('\nShutting down...');
    await twitter.stop();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  // Keep the process running
  console.log('\nService is running. Press Ctrl+C to stop.');
}

// Run the main function
main().catch((error) => {
  console.error('Unhandled error:', error);
  process.exit(1);
});
