import { loadConfig, FullConfig } from './config';
import { TwitterStreamService } from './twitter';
import { PumpPortalService } from './pumpportal';
import { SSEServer } from './sse-server';
import { TweetClassifier } from './classifier';
import { AlertingService } from './alerting';
import { eventBus, EventType } from './events';
import { ParsedLaunchCommand, TweetData } from './types';
import { createApiRoutes } from './api-routes';
import { createAuthRoutes } from './auth-routes';
import { createAlphaRoutes } from './alpha-routes';
import { initSupabase } from './supabase';
import { cleanupExpiredSessions } from './auth.service';
import { saveTweet, saveEvent, saveAlphaSignal } from './database.service';
import { AlphaAggregatorService, ClassifiedSignal } from './alpha-aggregator.service';
import { GroqService } from './groq.service';
import { ZkMixerService } from './zk-mixer.service';
import { PumpPortalDataService } from './pumpportal-data.service';

// Track launched tokens to avoid duplicates
const launchedTokens = new Set<string>();

async function main() {
  console.log('='.repeat(60));
  console.log('  PumpFun Twitter Launcher');
  console.log('  With SSE Streaming, Classification & Alerting');
  console.log('='.repeat(60));
  console.log();

  // Load configuration
  let config: FullConfig;
  try {
    config = loadConfig();
    console.log('Configuration loaded successfully');
  } catch (error) {
    console.error('Failed to load configuration:', error);
    console.error('\nMake sure you have created a .env file with all required variables.');
    console.error('See .env.example for reference.');
    process.exit(1);
  }

  // Initialize Supabase if configured
  const supabaseEnabled = !!(process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY);
  if (supabaseEnabled) {
    try {
      initSupabase();
      console.log('  [x] Supabase initialized');

      // Set up periodic session cleanup (every hour)
      setInterval(async () => {
        const cleaned = await cleanupExpiredSessions();
        if (cleaned > 0) {
          console.log(`Cleaned up ${cleaned} expired sessions`);
        }
      }, 60 * 60 * 1000);
    } catch (error) {
      console.error('Failed to initialize Supabase:', error);
      console.error('Continuing without database persistence...');
    }
  } else {
    console.log('  [ ] Supabase not configured (using in-memory storage)');
  }

  // Initialize components
  console.log('\nInitializing components...');

  // 1. Classifier - for tweet analysis
  const classifier = new TweetClassifier(eventBus, config.classifier);
  console.log('  [x] Tweet classifier initialized');

  // 2. Alerting service - for notifications
  const alerting = new AlertingService(eventBus, config.alerting);
  console.log('  [x] Alerting service initialized');

  // ZK mixer service (Groth16/bn254 off-chain verification)
  const zkMixerService = config.zkMixer.enabled ? new ZkMixerService(config.zkMixer) : null;
  if (zkMixerService) {
    console.log('  [x] ZK Mixer verification enabled (off-chain Groth16 guard)');
  }

  // 3. SSE Server - for real-time streaming
  const sseServer = new SSEServer(eventBus, config.sse);
  sseServer.setClassifier(classifier);
  console.log('  [x] SSE server initialized');

  // Note: We'll set the API routes after PumpPortal is initialized

  // 4. PumpPortal service - for token creation
  console.log('\nInitializing PumpPortal service...');
  const pumpPortal = new PumpPortalService(
    config.solana,
    config.tokenDefaults,
    zkMixerService
  );

  // Check wallet balance
  try {
    const balance = await pumpPortal.getBalance();
    console.log(`  Wallet address: ${pumpPortal.getWalletAddress()}`);
    console.log(`  Wallet balance: ${balance.toFixed(4)} SOL`);

    if (balance < 0.1) {
      eventBus.emit(EventType.ALERT_WARNING, {
        title: 'Low Wallet Balance',
        message: `Bot wallet has only ${balance.toFixed(4)} SOL. Consider adding more funds.`,
        metadata: { balance, wallet: pumpPortal.getWalletAddress() },
      });
    }
  } catch (error) {
    console.error('Failed to check wallet balance:', error);
    eventBus.emit(EventType.SYSTEM_ERROR, {
      component: 'pumpportal',
      message: 'Failed to check wallet balance',
      error: String(error),
    });
    console.error('Make sure your Solana RPC URL is correct and accessible.');
    process.exit(1);
  }

  // Set up API routes with PumpPortal
  const apiRouter = createApiRoutes(pumpPortal, eventBus, zkMixerService);
  sseServer.setApiRouter(apiRouter);
  sseServer.setPumpPortal(pumpPortal);
  console.log('  [x] API routes initialized');

  // Set up auth routes (requires Supabase)
  if (supabaseEnabled) {
    const authRouter = createAuthRoutes();
    sseServer.setAuthRouter(authRouter);
    console.log('  [x] Auth routes initialized');
  }

  // 6. Alpha Aggregator service - for multi-source signal aggregation
  let alphaAggregator: AlphaAggregatorService | null = null;
  const alphaEnabled = config.alpha.discord.enabled || config.alpha.telegram.enabled || config.alpha.reddit.enabled;

  if (alphaEnabled) {
    console.log('\nInitializing Alpha Aggregator service...');
    alphaAggregator = new AlphaAggregatorService(config.alpha, eventBus);

    // Set up signal handler to persist classified signals
    alphaAggregator.onSignal(async (signal: ClassifiedSignal) => {
      if (supabaseEnabled) {
        await saveAlphaSignal(signal).catch(err =>
          console.error('Failed to save alpha signal:', err)
        );
      }

      // Emit event for SSE streaming
      eventBus.emit(EventType.ALERT_INFO, {
        title: `Alpha Signal [${signal.priority.toUpperCase()}]`,
        message: `${signal.source}: ${signal.content.substring(0, 100)}...`,
        metadata: {
          source: signal.source,
          category: signal.category,
          priority: signal.priority,
          tickers: signal.tickers,
          confidence: signal.confidence_score,
        },
      });
    });

    console.log(`  Discord: ${config.alpha.discord.enabled ? 'enabled' : 'disabled'}`);
    console.log(`  Telegram: ${config.alpha.telegram.enabled ? 'enabled' : 'disabled'}`);
    console.log(`  Reddit: ${config.alpha.reddit.enabled ? 'enabled' : 'disabled'}`);
  } else {
    console.log('\n  [ ] Alpha Aggregator disabled (no sources configured)');
  }

  // Set up alpha routes
  const alphaRouter = createAlphaRoutes(alphaAggregator, eventBus);
  sseServer.setAlphaRouter(alphaRouter);
  console.log('  [x] Alpha routes initialized');

  // 6b. PumpPortal data websocket (optional)
  const pumpPortalData = new PumpPortalDataService(config.pumpPortalData, eventBus);
  await pumpPortalData.start();

  // 7. Twitter stream service (can be disabled for local/dev)
  let twitter: TwitterStreamService | null = null;

  const groqService = config.groq.enabled && config.groq.apiKey
    ? new GroqService(config.groq)
    : null;

  if (!config.twitter.enabled) {
    console.log('\n  [ ] Twitter stream disabled (set TWITTER_ENABLED=true to enable)');
  } else {
    if (groqService) {
      console.log(`\n  [x] Groq suggestions enabled (${config.groq.model})`);
    } else if (config.groq.enabled) {
      console.log('\n  [ ] Groq enabled but GROQ_API_KEY missing; skipping suggestions');
    }

    console.log('\nInitializing Twitter stream service...');
    console.log(`  Monitoring users: ${config.twitter.usernames.join(', ') || '(none)'}`);
    console.log(`  Monitoring hashtags: ${config.twitter.hashtags.join(', ') || '(none)'}`);

    twitter = new TwitterStreamService(config.twitter, groqService);

    // Set up the launch handler with classifier integration
    twitter.onLaunch(async (command: ParsedLaunchCommand) => {
      // Emit tweet received event
      const tweetData: TweetData = {
        id: command.tweetId,
        text: command.tweetText,
        authorId: 'unknown',
        authorUsername: command.tweetAuthor,
        createdAt: new Date(),
        urls: command.website ? [command.website] : undefined,
        mediaUrls: command.imageUrl ? [command.imageUrl] : undefined,
      };

      eventBus.emit(EventType.TWEET_RECEIVED, {
        tweetId: command.tweetId,
        authorUsername: command.tweetAuthor,
        text: command.tweetText,
      });

      // Save tweet to database if Supabase is enabled
      if (supabaseEnabled) {
        await saveTweet({
          tweet_id: command.tweetId,
          author_username: command.tweetAuthor,
          content: command.tweetText,
          is_retweet: false,
        }).catch(err => console.error('Failed to save tweet:', err));
      }

    // Run through classifier for additional filtering
    const filteredCommand = classifier.processAndFilter(tweetData, command);

    if (!filteredCommand) {
      console.log(`Tweet filtered out by classifier`);
      eventBus.emit(EventType.TWEET_FILTERED, {
          tweetId: command.tweetId,
          authorUsername: command.tweetAuthor,
          text: command.tweetText,
        });
        return;
      }

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

        // Emit token creating event
        eventBus.emit(EventType.TOKEN_CREATING, {
          ticker: command.ticker,
          name: command.name,
        });

      // If ZK mixer guard is enabled, require proof on the command
      if (zkMixerService && zkMixerService.isEnabled()) {
        if (!command.zkProof || !command.zkPublicSignals) {
          console.error('ZK Mixer enabled but no proof provided; skipping launch.');
          eventBus.emit(EventType.TOKEN_FAILED, {
            ticker: command.ticker,
            name: command.name,
            error: 'Missing ZK proof',
          });
          // Allow retry if proof arrives later
          launchedTokens.delete(launchKey);
          return;
        }
      }

      // Create the token
      const result = await pumpPortal.createToken(command, command.zkProof, command.zkPublicSignals);

        // Emit success event (alerting service will handle notifications)
        eventBus.emit(EventType.TOKEN_CREATED, {
          ticker: command.ticker,
          name: command.name,
          mint: result.mint,
          signature: result.signature,
        });

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

        // Emit failure event
        eventBus.emit(EventType.TOKEN_FAILED, {
          ticker: command.ticker,
          name: command.name,
          error: String(error),
        });

        // Remove from launched set so it can be retried
        launchedTokens.delete(launchKey);
      }
    });
  }

  // Start all services
  console.log('\nStarting services...');

  // Start SSE server
  await sseServer.start();

  // Start Alpha Aggregator
  if (alphaAggregator) {
    try {
      await alphaAggregator.start();
      console.log('  [x] Alpha Aggregator started');
    } catch (error) {
      console.error('Failed to start Alpha Aggregator:', error);
      eventBus.emit(EventType.SYSTEM_ERROR, {
        component: 'alpha-aggregator',
        message: 'Failed to start Alpha Aggregator',
        error: String(error),
      });
      console.error('\nAlpha Aggregator failed to start. Check your API credentials.');
      // Don't exit - let other services continue
    }
  }

  // Start Twitter stream
  if (twitter) {
    try {
      await twitter.start();
    } catch (error) {
      console.error('Failed to start Twitter stream:', error);
      eventBus.emit(EventType.SYSTEM_ERROR, {
        component: 'twitter',
        message: 'Failed to start Twitter stream',
        error: String(error),
      });
      console.error('\nMake sure your Twitter API credentials are correct.');
      console.error('You need Twitter API v2 access with filtered stream permissions.');
      process.exit(1);
    }
  }

  // Emit system started event
  const enabledComponents = ['classifier', 'alerting', 'sse-server', 'pumpportal'];
  if (twitter) enabledComponents.push('twitter');
  if (alphaAggregator) enabledComponents.push('alpha-aggregator');

  eventBus.emit(EventType.SYSTEM_STARTED, {
    timestamp: new Date().toISOString(),
    components: enabledComponents,
  });

  // Handle shutdown
  const shutdown = async () => {
    console.log('\nShutting down...');

    eventBus.emit(EventType.SYSTEM_STOPPED, {
      timestamp: new Date().toISOString(),
      reason: 'manual shutdown',
    });

    if (twitter) {
      await twitter.stop();
    }
    if (alphaAggregator) {
      await alphaAggregator.stop();
    }
    await pumpPortalData.stop();
    await sseServer.stop();

    // Log final stats
    const stats = classifier.getStats();
    console.log('\nFinal Statistics:');
    console.log(`  Tweets processed: ${stats.processed}`);
    console.log(`  Launches detected: ${stats.launches}`);
    console.log(`  Spam filtered: ${stats.spam}`);

    if (alphaAggregator) {
      const alphaStats = alphaAggregator.getStats();
      console.log(`  Alpha signals processed: ${alphaStats.totalProcessed}`);
      console.log(`  Alpha signals filtered: ${alphaStats.filtered}`);
      console.log(`  High priority signals: ${alphaStats.highPriority}`);
    }

    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  // Keep the process running
  console.log('\n' + '='.repeat(60));
  console.log('  Service is running');
  console.log('='.repeat(60));
  console.log(`  SSE Endpoint: http://localhost:${config.sse.port}/events`);
  console.log(`  Health Check: http://localhost:${config.sse.port}/health`);
  console.log(`  Statistics:   http://localhost:${config.sse.port}/api/stats`);
  console.log('='.repeat(60));
  console.log('\nPress Ctrl+C to stop.');
}

// Run the main function
main().catch((error) => {
  console.error('Unhandled error:', error);
  eventBus.emit(EventType.SYSTEM_ERROR, {
    component: 'main',
    message: 'Unhandled error in main',
    error: String(error),
  });
  process.exit(1);
});
