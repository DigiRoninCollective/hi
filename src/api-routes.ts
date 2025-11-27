import { Router, Request, Response } from 'express';
import multer from 'multer';
import fetch from 'node-fetch';
import { PumpPortalService } from './pumpportal';
import { EventBus, EventType } from './events';
import { ParsedLaunchCommand, getErrorMessage } from './types';
import { ZkMixerService, ZkProofRequest } from './zk-mixer.service';
import { GroqService } from './groq.service';
import { TelegramService } from './telegram.service';
import { v4 as uuidv4 } from 'uuid';
import * as fs from 'fs';
import * as path from 'path';
import {
  createToken as dbCreateToken,
  getTokens,
  getTokenByMint,
  updateToken,
  getTokenStats,
  createTokenTransaction,
  saveTweet,
  saveEvent,
  getTweets,
} from './database.service';
import { authMiddleware, AuthenticatedRequest } from './auth.service';
import {
  createTokenLimiter,
  buyTokenLimiter,
  sellTokenLimiter,
  validateRequest,
  CreateTokenSchema,
  BuyTokenSchema,
  SellTokenSchema,
  formatErrorResponse,
} from './security.middleware';
import { getPlatformSettings, getLaunchPreferencesDb, listWalletPool } from './database.service';
import { decryptSecret } from './utils/crypto.util';
import bs58 from 'bs58';
import { Keypair } from '@solana/web3.js';
import { getLaunchCandidate, updateLaunchStatus } from './launch-cache';
import { PumpPortalTradingService } from './pumpportal-trading.service';
import { PumpPortalTradingManager, TradingWalletConfig } from './pumpportal-trading-manager';
import { requireSTierHelper } from './route-helpers';

// Fallback in-memory storage (when Supabase is not configured)
interface CreatedToken {
  id: string;
  ticker: string;
  name: string;
  description: string;
  mint: string;
  signature: string;
  platform: string;
  createdAt: Date;
  imageUrl?: string;
}

const createdTokens: CreatedToken[] = [];
const uploadDir = path.join(process.cwd(), 'uploads');
const upload = multer({ dest: uploadDir });

function verifyApiKey(req: Request, res: Response): boolean {
  const headerKey = req.headers['x-api-key'] as string | undefined;
  const expected = process.env.PUMPPORTAL_API_KEY;
  if (!expected) {
    return true; // allow if not configured
  }
  if (!headerKey || headerKey !== expected) {
    res.status(401).json({ error: 'Unauthorized' });
    return false;
  }
  return true;
}


// Check if Supabase is configured
const useSupabase = !!(process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY);

// Ensure upload directory exists
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

export function createApiRoutes(
  pumpPortal: PumpPortalService | null,
  eventBus: EventBus,
  zkMixer?: ZkMixerService | null,
  groqService?: GroqService | null,
  telegramService?: TelegramService | null
): Router {
  const router = Router();
  let tradingManager: PumpPortalTradingManager | null = null;
  if (process.env.PUMPPORTAL_API_KEY) {
    const tradingConfigs: TradingWalletConfig[] = [
      {
        id: 'default',
        apiKey: process.env.PUMPPORTAL_API_KEY,
        defaultSlippage: 10,
        defaultPriorityFee: 0.0005,
      },
    ];
    tradingManager = new PumpPortalTradingManager(tradingConfigs);
  }
  const requireSTier = requireSTierHelper();

  // Get wallet info
  router.get('/wallet', async (req: Request, res: Response): Promise<Response | void> => {
    if (!pumpPortal) {
      return res.status(503).json({ error: 'PumpPortal service not initialized' });
    }

    try {
      const balance = await pumpPortal.getBalance();
      res.json({
        address: pumpPortal.getWalletAddress(),
        balance,
      });
    } catch (error) {
      res.status(500).json({ error: 'Failed to get wallet info' });
    }
  });

  // Create token (with rate limiting and validation)
  router.post(
    '/tokens/create',
    createTokenLimiter,
    upload.single('image'),
    authMiddleware(false),
    validateRequest(CreateTokenSchema),
    async (req: AuthenticatedRequest, res: Response): Promise<Response | void> => {
    if (!verifyApiKey(req, res)) return;
    if (!pumpPortal) {
      return res.status(503).json({ error: 'PumpPortal service not initialized' });
    }

    const uploadToIpfs = async (
      buffer: Buffer,
      filename: string,
      name: string,
      symbol: string,
      description?: string,
      website?: string,
      twitterHandle?: string
    ): Promise<string | undefined> => {
      try {
        const FormData = require('form-data');
        const formData = new FormData();
        formData.append('file', buffer, { filename, contentType: 'image/png' });
        formData.append('name', name);
        formData.append('symbol', symbol);
        formData.append('description', description || `${symbol} token`);
        formData.append('showName', 'true');
        if (website) formData.append('website', website);
        if (twitterHandle) formData.append('twitter', twitterHandle.startsWith('http') ? twitterHandle : `https://twitter.com/${twitterHandle.replace('@','')}`);

        const resp = await fetch('https://pump.fun/api/ipfs', {
          method: 'POST',
          body: formData,
        });

        if (resp.ok) {
          const json = await resp.json();
          return json.metadataUri as string;
        } else {
          const errText = await resp.text();
          console.error('[IPFS] upload failed:', errText);
          return undefined;
        }
      } catch (e) {
        console.error('[IPFS] upload error:', e);
        return undefined;
      }
    };

    try {
      const {
        name,
        symbol,
        description,
        website,
        twitterUrl,
        twitterHandle,
        platform,
        buyAmount,
        imageUrl,
        imageFile,
        bannerUrl,
        avatarUrl,
        zkProof,
        zkPublicSignals,
      } = req.body;

      if (!name || !symbol) {
        return res.status(400).json({ error: 'Name and symbol are required' });
      }

      let resolvedImageUrl = imageUrl as string | undefined;

      // If imageFile is base64, upload to pump.fun IPFS
      if (!resolvedImageUrl && imageFile) {
        const buffer = Buffer.from(imageFile, 'base64');
        resolvedImageUrl = await uploadToIpfs(buffer, `${symbol}.png`, name, symbol, description, website, twitterHandle || twitterUrl);
      }

      // If multipart file provided, upload it
      if (!resolvedImageUrl && req.file) {
        const buffer = await fs.promises.readFile(req.file.path);
        resolvedImageUrl = await uploadToIpfs(buffer, req.file.originalname || `${symbol}.png`, name, symbol, description, website, twitterHandle || twitterUrl);
        fs.promises.unlink(req.file.path).catch(() => {});
      }

      // Create launch command
      const command: ParsedLaunchCommand = {
        ticker: symbol,
        name: name,
        description: description || `${symbol} token`,
        imageUrl: resolvedImageUrl || imageUrl || avatarUrl || undefined,
        bannerUrl: bannerUrl || undefined,
        website: website || undefined,
        twitterHandle: twitterHandle || twitterUrl || undefined,
        tweetId: `manual-${uuidv4()}`,
        tweetAuthor: 'manual',
        tweetText: `Manual launch: ${symbol}`,
      };

      // Emit creating event
      eventBus.emit(EventType.TOKEN_CREATING, {
        ticker: command.ticker,
        name: command.name,
      });

      // If using Supabase, create pending token record
      if (useSupabase) {
        await dbCreateToken({
          mint_address: `pending-${uuidv4()}`,
          name,
          symbol,
          description: command.description || null,
          image_url: resolvedImageUrl || imageUrl || null,
          platform: (platform || 'pump') as 'pump' | 'bonk' | 'bags' | 'bnb' | 'usd1',
          chain: 'solana',
          created_by: req.user?.id || null,
          initial_buy_sol: buyAmount || null,
          status: 'creating',
        });
      }

      // ZK mixer verification (if enabled)
      if (zkMixer && zkMixer.isEnabled()) {
        if (!zkProof || !zkPublicSignals) {
          return res.status(400).json({ error: 'ZK proof required' });
        }
        try {
          await zkMixer.verifyAndConsume({ proof: zkProof, publicSignals: zkPublicSignals as ZkProofRequest['publicSignals'] });
        } catch (err: any) {
          return res.status(400).json({ error: err.message || 'ZK proof verification failed' });
        }
      }

      // Create the token
      const result = await pumpPortal.createToken(command, zkProof, zkPublicSignals);

      // Store created token
      if (useSupabase) {
        await dbCreateToken({
          mint_address: result.mint,
          name,
          symbol,
          description: command.description || null,
          image_url: resolvedImageUrl || imageUrl || null,
          platform: (platform || 'pump') as 'pump' | 'bonk' | 'bags' | 'bnb' | 'usd1',
          chain: 'solana',
          created_by: req.user?.id || null,
          initial_buy_sol: buyAmount || null,
          signature: result.signature,
          status: 'created',
        });

        // Save event
        await saveEvent({
          type: 'token_created',
          data: {
            ticker: symbol,
            name,
            mint: result.mint,
            signature: result.signature,
            platform: platform || 'pump',
          },
          user_id: req.user?.id || null,
        });
      } else {
        const token: CreatedToken = {
          id: uuidv4(),
          ticker: symbol,
          name,
          description: command.description || '',
          mint: result.mint,
          signature: result.signature,
          platform: platform || 'pump',
          createdAt: new Date(),
          imageUrl,
        };
        createdTokens.unshift(token);
      }

      // Emit success event
      eventBus.emit(EventType.TOKEN_CREATED, {
        ticker: command.ticker,
        name: command.name,
        mint: result.mint,
        signature: result.signature,
      });

      res.json({
        success: true,
        mint: result.mint,
        signature: result.signature,
        pumpFunUrl: `https://pump.fun/${result.mint}`,
        solscanUrl: `https://solscan.io/tx/${result.signature}`,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      // Save failed event if using Supabase
      if (useSupabase) {
        await saveEvent({
          type: 'token_failed',
          data: {
            ticker: req.body.symbol || 'UNKNOWN',
            name: req.body.name || 'Unknown',
            error: errorMessage,
          },
          user_id: (req as AuthenticatedRequest).user?.id || null,
        });
      }

      eventBus.emit(EventType.TOKEN_FAILED, {
        ticker: req.body.symbol || 'UNKNOWN',
        name: req.body.name || 'Unknown',
        error: errorMessage,
      });

      res.status(500).json({ error: errorMessage });
    }
    }
  );

  // Multi-wallet buy (S-tier only)
  router.post(
    '/actions/buy-multi',
    buyTokenLimiter,
    authMiddleware(true),
    async (req: AuthenticatedRequest, res: Response): Promise<Response | void> => {
      if (!requireSTier(req, res)) return;
      if (!pumpPortal) {
        return res.status(503).json({ error: 'PumpPortal service not initialized' });
      }
      const { mint, totalAmountSol } = req.body;
      const total = parseFloat(totalAmountSol);
      if (!mint || !total || total <= 0) {
        return res.status(400).json({ error: 'mint and totalAmountSol are required' });
      }

      try {
        const prefs = await getLaunchPreferencesDb(req.user!.id);
        const settings = await getPlatformSettings();
        const pool = await listWalletPool(req.user!.id);

        if (!prefs.enable_multi_wallet) {
          return res.status(400).json({ error: 'Multi-wallet is not enabled in preferences' });
        }
        if (pool.length === 0) {
          return res.status(400).json({ error: 'No wallets in pool' });
        }

        const walletCount = Math.max(1, Math.min(prefs.wallets_to_use, pool.length));
        const selected = pool.slice(0, walletCount);

        // Apply fee on top
        const feeBps = settings.buy_fee_bps ?? 150;
        const feeAmount = (total * feeBps) / 10000;
        if (feeAmount > 0) {
          await pumpPortal.transferSol(settings.fee_wallet, feeAmount);
        }

        // Split amounts with variance
        const splits: number[] = [];
        const variance = Math.max(0, prefs.amount_variance_bps);
        let remaining = total;
        for (let i = 0; i < walletCount; i++) {
          if (i === walletCount - 1) {
            splits.push(Math.max(0.0001, remaining));
          } else {
            const base = total / walletCount;
            const delta = (Math.random() * 2 - 1) * (variance / 10000);
            const amt = Math.max(0.0001, base * (1 + delta));
            splits.push(amt);
            remaining -= amt;
          }
        }

        const results: { wallet: string; amount: number; signature?: string; error?: string }[] = [];
        for (let i = 0; i < selected.length; i++) {
          const w = selected[i];
          const amount = Math.min(Math.max(0.0001, splits[i]), prefs.max_per_wallet_sol);
          try {
            const secret = decryptSecret(w.encrypted_private_key);
            const kp = Keypair.fromSecretKey(bs58.decode(secret));

            // Auto top-up if requested
            if (prefs.auto_top_up) {
              const bal = await pumpPortal.getBalanceFor(kp.publicKey.toBase58());
              const needed = amount + 0.01; // padding for fees
              if (bal < needed && prefs.top_up_amount_sol > 0) {
                await pumpPortal.transferSol(kp.publicKey.toBase58(), prefs.top_up_amount_sol);
              }
            }

            const sig = await pumpPortal.buyTokenWithWallet(kp, mint, amount);
            results.push({ wallet: kp.publicKey.toBase58(), amount, signature: sig });
          } catch (err: any) {
            results.push({ wallet: w.public_key, amount, error: String(err?.message || err) });
          }

          // Jitter
          if (prefs.timing_jitter_ms > 0 && i < selected.length - 1) {
            const jitter = Math.random() * prefs.timing_jitter_ms;
            await new Promise((resolve) => setTimeout(resolve, jitter));
          }
        }

        res.json({
          success: true,
          feeAmount,
          totalRequested: total,
          results,
        });
      } catch (err: any) {
        res.status(500).json({ error: String(err?.message || err) });
      }
    }
  );

  // Multi-wallet sell (S-tier only)
  router.post(
    '/actions/sell-multi',
    sellTokenLimiter,
    authMiddleware(true),
    async (req: AuthenticatedRequest, res: Response): Promise<Response | void> => {
      if (!requireSTier(req, res)) return;
      if (!pumpPortal) {
        return res.status(503).json({ error: 'PumpPortal service not initialized' });
      }
      const { mint, totalTokenAmount } = req.body;
      const total = parseFloat(totalTokenAmount);
      if (!mint || !total || total <= 0) {
        return res.status(400).json({ error: 'mint and totalTokenAmount are required' });
      }

      try {
        const prefs = await getLaunchPreferencesDb(req.user!.id);
        const settings = await getPlatformSettings();
        const pool = await listWalletPool(req.user!.id);

        if (!prefs.enable_multi_wallet) {
          return res.status(400).json({ error: 'Multi-wallet is not enabled in preferences' });
        }
        if (pool.length === 0) {
          return res.status(400).json({ error: 'No wallets in pool' });
        }

        const walletCount = Math.max(1, Math.min(prefs.wallets_to_use, pool.length));
        const selected = pool.slice(0, walletCount);

        // Apply fee on top (from main wallet)
        const feeBps = settings.sell_fee_bps ?? 150;
        const feeAmount = (total * feeBps) / 10000;
        if (feeAmount > 0) {
          await pumpPortal.transferSol(settings.fee_wallet, feeAmount);
        }

        // Split token amounts with variance
        const splits: number[] = [];
        const variance = Math.max(0, prefs.amount_variance_bps);
        let remaining = total;
        for (let i = 0; i < walletCount; i++) {
          if (i === walletCount - 1) {
            splits.push(Math.max(0.0001, remaining));
          } else {
            const base = total / walletCount;
            const delta = (Math.random() * 2 - 1) * (variance / 10000);
            const amt = Math.max(0.0001, base * (1 + delta));
            splits.push(amt);
            remaining -= amt;
          }
        }

        // Execute in reverse order for "auto-sell" feel
        const results: { wallet: string; amount: number; signature?: string; error?: string }[] = [];
        for (let idx = selected.length - 1; idx >= 0; idx--) {
          const w = selected[idx];
          const amount = Math.max(0.0001, splits[idx]);
          try {
            const secret = decryptSecret(w.encrypted_private_key);
            const kp = Keypair.fromSecretKey(bs58.decode(secret));
            const sig = await pumpPortal.sellTokenWithWallet(kp, mint, amount);
            results.push({ wallet: kp.publicKey.toBase58(), amount, signature: sig });
          } catch (err: any) {
            results.push({ wallet: w.public_key, amount, error: String(err?.message || err) });
          }

          if (prefs.timing_jitter_ms > 0 && idx > 0) {
            const jitter = Math.random() * prefs.timing_jitter_ms;
            await new Promise((resolve) => setTimeout(resolve, jitter));
          }
        }

        res.json({
          success: true,
          feeAmount,
          totalRequested: total,
          results,
        });
      } catch (err: any) {
        res.status(500).json({ error: String(err?.message || err) });
      }
    }
  );

  // Auto deploy from tweet + keyword template
  router.post(
    '/actions/auto-deploy',
    createTokenLimiter,
    authMiddleware(true),
    async (req: AuthenticatedRequest, res: Response): Promise<Response | void> => {
      if (!pumpPortal) {
        return res.status(503).json({ error: 'PumpPortal service not initialized' });
      }

      const { keyword, tweetText, tweetAuthor, tweetId } = req.body;
      if (!keyword || !tweetText) {
        return res.status(400).json({ error: 'keyword and tweetText are required' });
      }

      const upper = String(keyword).trim().toUpperCase();
      const tickerBase = upper.replace(/[^A-Z]/g, '').slice(0, 4) || 'AUTO';
      const ticker = `${tickerBase}${Math.floor(Math.random() * 90 + 10)}`;
      const name = `${keyword} Meme`;
      const description = `${keyword} auto-deploy\n\n${tweetText.substring(0, 180)}`;

      const command: ParsedLaunchCommand = {
        ticker,
        name,
        description,
        tweetId: tweetId || `auto-${uuidv4()}`,
        tweetAuthor: tweetAuthor || 'auto',
        tweetText,
      };

      try {
        const result = await pumpPortal.createToken(command);
        eventBus.emit(EventType.TOKEN_CREATED, {
          ticker: command.ticker,
          name: command.name,
          mint: result.mint,
          signature: result.signature,
        });
        res.json({
          success: true,
          mint: result.mint,
          signature: result.signature,
          pumpfun: `https://pump.fun/${result.mint}`,
        });
      } catch (err: any) {
        console.error('Auto-deploy failed:', err);
        res.status(500).json({ error: getErrorMessage(err) });
      }
    }
  );

  // Get created tokens
  router.get('/tokens', authMiddleware(false), async (req: AuthenticatedRequest, res: Response): Promise<Response | void> => {
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;

    if (useSupabase) {
      const tokens = await getTokens(limit, offset, req.user?.id);
      const stats = await getTokenStats();
      res.json({
        tokens,
        total: stats.total,
        successful: stats.successful,
        failed: stats.failed,
      });
    } else {
      res.json({
        tokens: createdTokens.slice(offset, offset + limit),
        total: createdTokens.length,
      });
    }
  });

  // Get token by mint
  router.get('/tokens/:mint', async (req: Request, res: Response): Promise<Response | void> => {
    if (useSupabase) {
      const token = await getTokenByMint(req.params.mint);
      if (!token) {
        return res.status(404).json({ error: 'Token not found' });
      }
      res.json(token);
    } else {
      const token = createdTokens.find((t) => t.mint === req.params.mint);
      if (!token) {
        return res.status(404).json({ error: 'Token not found' });
      }
      res.json(token);
    }
  });

  // Buy token
  router.post(
    '/tokens/:mint/buy',
    buyTokenLimiter,
    authMiddleware(true),
    validateRequest(BuyTokenSchema),
    async (req: AuthenticatedRequest, res: Response): Promise<Response | void> => {
    if (!pumpPortal) {
      return res.status(503).json({ error: 'PumpPortal service not initialized' });
    }

    try {
      const { amount, zkProof, zkPublicSignals } = req.body;
      const mint = req.params.mint;

      if (!amount || amount <= 0) {
        return res.status(400).json({ error: 'Valid amount is required' });
      }

      const signature = await pumpPortal.buyToken(mint, amount, zkProof, zkPublicSignals);

      // Save transaction if using Supabase
      if (useSupabase) {
        const token = await getTokenByMint(mint);
        if (token) {
          await createTokenTransaction({
            token_id: token.id,
            user_id: req.user?.id || null,
            type: 'buy',
            amount_sol: amount,
            signature,
            status: 'confirmed',
          });
        }
      }

      eventBus.emit(EventType.ALERT_SUCCESS, {
        title: 'Buy Order Executed',
        message: `Bought ${amount} SOL worth of ${mint}`,
        metadata: { mint, amount, signature },
      });

      res.json({
        success: true,
        signature,
        solscanUrl: `https://solscan.io/tx/${signature}`,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      res.status(500).json({ error: errorMessage });
    }
    }
  );

  // Sell token
  router.post(
    '/tokens/:mint/sell',
    sellTokenLimiter,
    authMiddleware(true),
    validateRequest(SellTokenSchema),
    async (req: AuthenticatedRequest, res: Response): Promise<Response | void> => {
    if (!pumpPortal) {
      return res.status(503).json({ error: 'PumpPortal service not initialized' });
    }

    try {
      const { amount, zkProof, zkPublicSignals } = req.body;
      const mint = req.params.mint;

      if (!amount || amount <= 0) {
        return res.status(400).json({ error: 'Valid amount is required' });
      }

      const signature = await pumpPortal.sellToken(mint, amount, zkProof, zkPublicSignals);

      // Save transaction if using Supabase
      if (useSupabase) {
        const token = await getTokenByMint(mint);
        if (token) {
          await createTokenTransaction({
            token_id: token.id,
            user_id: req.user?.id || null,
            type: 'sell',
            amount_sol: amount,
            signature,
            status: 'confirmed',
          });
        }
      }

      eventBus.emit(EventType.ALERT_SUCCESS, {
        title: 'Sell Order Executed',
        message: `Sold ${amount} tokens of ${mint}`,
        metadata: { mint, amount, signature },
      });

      res.json({
        success: true,
        signature,
        solscanUrl: `https://solscan.io/tx/${signature}`,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      res.status(500).json({ error: errorMessage });
    }
    }
  );

  // Image upload endpoint (base64)
  router.post('/upload/image', (req: Request, res: Response): Response | void => {
    try {
      const { image, filename } = req.body;

      if (!image) {
        return res.status(400).json({ error: 'Image data is required' });
      }

      // Extract base64 data
      const matches = image.match(/^data:image\/(\w+);base64,(.+)$/);
      if (!matches) {
        return res.status(400).json({ error: 'Invalid image format' });
      }

      const ext = matches[1];
      const data = matches[2];
      const buffer = Buffer.from(data, 'base64');

      const imageFilename = filename || `${uuidv4()}.${ext}`;
      const imagePath = path.join(uploadDir, imageFilename);

      fs.writeFileSync(imagePath, buffer);

      res.json({
        success: true,
        filename: imageFilename,
        url: `/uploads/${imageFilename}`,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      res.status(500).json({ error: errorMessage });
    }
  });

  // Get system status
  router.get('/status', async (req: Request, res: Response): Promise<Response | void> => {
    const walletInfo = pumpPortal
      ? {
          address: pumpPortal.getWalletAddress(),
          balance: await pumpPortal.getBalance().catch(() => 0),
        }
      : null;

    let tokenStats = { total: createdTokens.length, successful: 0, failed: 0 };
    if (useSupabase) {
      tokenStats = await getTokenStats();
    }

    res.json({
      status: 'running',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      wallet: walletInfo,
      tokensCreated: tokenStats.total,
      tokensSuccessful: tokenStats.successful,
      tokensFailed: tokenStats.failed,
      supabaseEnabled: useSupabase,
    });
  });

  // Get tweets (stored in database)
  router.get('/tweets', async (req: Request, res: Response): Promise<Response | void> => {
    if (!useSupabase) {
      return res.json({ tweets: [], total: 0, message: 'Supabase not configured' });
    }

    const limit = parseInt(req.query.limit as string) || 100;
    const offset = parseInt(req.query.offset as string) || 0;
    const tweets = await getTweets(limit, offset);

    res.json({
      tweets,
      total: tweets.length,
    });
  });

  // Groq suggestions endpoint - analyze tweet and suggest token name/ticker
  router.post('/groq/suggest', async (req: Request, res: Response): Promise<Response | void> => {
    if (!groqService) {
      return res.status(503).json({ error: 'Groq service not initialized' });
    }

    try {
      const { text, tweetId, authorUsername, urls, mediaUrls, authorName, authorFollowers, authorVerified, websiteUrls } = req.body;

      if (!text) {
        return res.status(400).json({ error: 'Tweet text is required' });
      }

      // Create TweetData object for Groq service with enriched metadata
      const tweetData = {
        id: tweetId || 'unknown',
        text,
        authorUsername: authorUsername || 'unknown',
        authorId: 'unknown',
        createdAt: new Date(),
        urls,
        mediaUrls,
      };

      // Get suggestions from Groq
      const suggestions = await groqService.suggestLaunchCommands(tweetData);

      res.json({
        success: true,
        suggestions: suggestions.map(cmd => ({
          ticker: cmd.ticker,
          name: cmd.name,
          description: cmd.description,
          website: cmd.website,
          twitterHandle: cmd.twitterHandle,
          imageUrl: cmd.imageUrl,
          bannerUrl: cmd.bannerUrl,
          avatarUrl: cmd.avatarUrl,
        })),
        count: suggestions.length,
        metadata: {
          authorName,
          authorFollowers,
          authorVerified,
          websiteUrls,
          hasWebsite: websiteUrls && websiteUrls.length > 0,
        },
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      res.status(500).json({ error: errorMessage });
    }
  });

  // Groq detailed analysis endpoint
  router.post('/groq/analyze-detailed', authMiddleware(true), async (req: AuthenticatedRequest, res: Response): Promise<Response | void> => {
    if (!requireSTier(req, res)) return;
    if (!groqService) {
      return res.status(503).json({ error: 'Groq service not initialized' });
    }

    try {
      const { text, tweetId, authorUsername, authorFollowers, authorVerified, urls, mediaUrls, language } = req.body;

      if (!text || !authorUsername) {
        return res.status(400).json({ error: 'text and authorUsername are required' });
      }

      const tweetData = {
        id: tweetId || 'unknown',
        text,
        authorUsername,
        authorId: 'unknown',
        createdAt: new Date(),
        urls,
        mediaUrls,
      };

      const analysis = await groqService.analyzeTweetDetailed({
        ...tweetData,
        authorFollowers: authorFollowers ? Number(authorFollowers) : undefined,
        authorVerified: Boolean(authorVerified),
        language,
      });

      if (!analysis) {
        return res.status(502).json({ error: 'Groq analysis failed' });
      }

      res.json({ success: true, analysis });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      res.status(500).json({ error: errorMessage });
    }
  });

  // Analyze tweet for trading alerts and send Telegram notification
  router.post('/groq/analyze-alert', authMiddleware(true), async (req: AuthenticatedRequest, res: Response): Promise<Response | void> => {
    if (!requireSTier(req, res)) return;
    if (!groqService) {
      return res.status(503).json({ error: 'Groq service not initialized' });
    }

    try {
      const { text, tweetId, authorUsername, urls, mediaUrls, telegramService } = req.body;

      if (!text) {
        return res.status(400).json({ error: 'Tweet text is required' });
      }

      // Create TweetData object for Groq service
      const tweetData = {
        id: tweetId || 'unknown',
        text,
        authorUsername: authorUsername || 'unknown',
        authorId: 'unknown',
        createdAt: new Date(),
        urls,
        mediaUrls,
      };

      // Analyze tweet for alert worthiness
      const analysis = await groqService.analyzeTweetForAlert(tweetData);

      if (!analysis) {
        return res.json({
          success: true,
          isAlert: false,
          message: 'Tweet analyzed but no alert triggered',
        });
      }

      // If it's an alert and Telegram service is passed, send notification
      if (analysis.isAlert && analysis.confidence >= 0.6) {
        // Format alert message
        const sentimentEmoji = {
          bullish: '🟢',
          neutral: '🟡',
          bearish: '🔴',
        }[analysis.sentiment];

        const alertMessage = `
${sentimentEmoji} *Trading Alert Detected*

*Author:* @${authorUsername}
*Confidence:* ${(analysis.confidence * 100).toFixed(1)}%
*Sentiment:* ${analysis.sentiment.toUpperCase()}

*Reason:* ${analysis.reason}

*Keywords:* ${analysis.keywords.length > 0 ? analysis.keywords.join(', ') : 'N/A'}

*Tweet:* "${text.substring(0, 200)}${text.length > 200 ? '...' : ''}"

${urls?.length ? `*Links:* ${urls.join(', ')}` : ''}
        `.trim();

        // Send to Telegram (if telegram service is available)
        // This would be called from the frontend/Twitter feed with the telegram service
        res.json({
          success: true,
          isAlert: true,
          analysis,
          alertMessage,
          sent: false, // Would be true if telegram service was passed
        });
      } else {
        res.json({
          success: true,
          isAlert: false,
          analysis,
          message: 'Tweet analyzed but confidence below threshold',
        });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      res.status(500).json({ error: errorMessage });
    }
  });

  // ============================================
  // TELEGRAM BOT ADMIN ROUTES
  // ============================================

  // Get bot status
  router.get('/telegram/status', authMiddleware(true), async (req: AuthenticatedRequest, res: Response): Promise<Response | void> => {
    if (!requireSTier(req, res)) return;

    if (!telegramService) {
      return res.status(503).json({ error: 'Telegram service not initialized' });
    }

    const status = telegramService.getStatus();
    res.json(status);
  });

  // Get subscribers
  router.get('/telegram/subscribers', authMiddleware(true), async (req: AuthenticatedRequest, res: Response): Promise<Response | void> => {
    if (!requireSTier(req, res)) return;

    if (!telegramService) {
      return res.status(503).json({ error: 'Telegram service not initialized' });
    }

    const subscribers = telegramService.getSubscribers().map(sub => ({
      ...sub,
      subscribedAt: sub.subscribedAt.toISOString(),
    }));
    res.json({ subscribers });
  });

  // Get messages
  router.get('/telegram/messages', authMiddleware(true), async (req: AuthenticatedRequest, res: Response): Promise<Response | void> => {
    if (!requireSTier(req, res)) return;

    if (!telegramService) {
      return res.status(503).json({ error: 'Telegram service not initialized' });
    }

    res.json({ messages: telegramService.getAdminMessages() });
  });

  // Send message to specific chat
  router.post('/telegram/send-message', authMiddleware(true), async (req: AuthenticatedRequest, res: Response): Promise<Response | void> => {
    if (!requireSTier(req, res)) return;

    if (!telegramService) {
      return res.status(503).json({ error: 'Telegram service not initialized' });
    }

    try {
      const { chatId, text } = req.body;

      if (!chatId || !text) {
        return res.status(400).json({ error: 'chatId and text are required' });
      }

      await telegramService.sendAdminMessage(String(chatId), String(text));
      res.json({ success: true, message: `Message sent to ${chatId}` });
    } catch (error) {
      res.status(500).json({ error: 'Failed to send message' });
    }
  });

  // Broadcast message to subscribers
  router.post('/telegram/broadcast', authMiddleware(true), async (req: AuthenticatedRequest, res: Response): Promise<Response | void> => {
    if (!requireSTier(req, res)) return;

    if (!telegramService) {
      return res.status(503).json({ error: 'Telegram service not initialized' });
    }

    try {
      const { message, alertType } = req.body;

      if (!message || !alertType) {
        return res.status(400).json({ error: 'message and alertType are required' });
      }

      if (!['tokenLaunches', 'highPrioritySignals', 'systemAlerts'].includes(alertType)) {
        return res.status(400).json({ error: 'Invalid alertType' });
      }

      const result = await telegramService.broadcastAlert(String(message), alertType);
      res.json({
        success: true,
        ...result,
        message: `Broadcast sent to ${alertType} subscribers`,
      });
    } catch (error) {
      res.status(500).json({ error: 'Failed to send broadcast' });
    }
  });

  // Update subscriber status
  router.put('/telegram/subscribers/:chatId', authMiddleware(true), async (req: AuthenticatedRequest, res: Response): Promise<Response | void> => {
    if (!requireSTier(req, res)) return;

    if (!telegramService) {
      return res.status(503).json({ error: 'Telegram service not initialized' });
    }

    try {
      const { chatId } = req.params;
      const { isActive } = req.body;

      if (typeof isActive !== 'boolean') {
        return res.status(400).json({ error: 'isActive must be boolean' });
      }

      const updated = telegramService.updateSubscriberStatus(chatId, isActive);
      if (!updated) {
        return res.status(404).json({ error: 'Subscriber not found' });
      }

      res.json({
        success: true,
        message: `Subscriber ${chatId} updated`,
        isActive: updated.isActive,
      });
    } catch (error) {
      res.status(500).json({ error: 'Failed to update subscriber' });
    }
  });

  // ============================================
  // MANUAL LAUNCH CONTROL
  // ============================================

  // Trigger launch from cached candidate (semi-auto mode)
  router.post('/launch/from-candidate/:tweetId', authMiddleware(true), async (req: AuthenticatedRequest, res: Response): Promise<Response | void> => {
    if (!requireSTier(req, res)) return;
    if (!pumpPortal) {
      return res.status(503).json({ error: 'PumpPortal service not initialized' });
    }

    const tweetId = req.params.tweetId;
    const cached = getLaunchCandidate(tweetId);
    if (!cached) {
      return res.status(404).json({ error: 'Launch candidate not found' });
    }

    if (cached.status === 'launched') {
      return res.status(400).json({ error: 'Candidate already launched' });
    }

    const { candidate, command } = cached;
    const deployTicker = candidate.analysis.tokenTicker || command.ticker;
    const deployName = candidate.analysis.tokenName || command.name;

    try {
      updateLaunchStatus(tweetId, 'queued');
      eventBus.emit(EventType.TWEET_CLASSIFIED, {
        tweetId,
        authorUsername: candidate.authorHandle,
        text: candidate.tweetText,
        classification: undefined,
        analysis: candidate.analysis,
        launchStatus: 'queued',
      });

      const result = await pumpPortal.createToken(
        { ...command, ticker: deployTicker, name: deployName },
        (command as any).zkProof,
        (command as any).zkPublicSignals
      );

      updateLaunchStatus(tweetId, 'launched');

      eventBus.emit(EventType.TOKEN_CREATED, {
        ticker: deployTicker,
        name: deployName,
        mint: result.mint,
        signature: result.signature,
      });

      res.json({
        success: true,
        ticker: deployTicker,
        name: deployName,
        mint: result.mint,
        signature: result.signature,
      });
    } catch (error) {
      updateLaunchStatus(tweetId, 'failed');
      eventBus.emit(EventType.TOKEN_FAILED, {
        ticker: deployTicker,
        name: deployName,
        error: String(error),
      });
      res.status(500).json({ error: 'Failed to launch token', details: error instanceof Error ? error.message : String(error) });
    }
  });

  // Skip candidate manually
  router.post('/launch/skip/:tweetId', authMiddleware(true), async (req: AuthenticatedRequest, res: Response): Promise<Response | void> => {
    if (!requireSTier(req, res)) return;

    const tweetId = req.params.tweetId;
    const cached = getLaunchCandidate(tweetId);
    if (!cached) {
      return res.status(404).json({ error: 'Launch candidate not found' });
    }

    updateLaunchStatus(tweetId, 'skipped-manual');

    eventBus.emit(EventType.TWEET_CLASSIFIED, {
      tweetId,
      authorUsername: cached.candidate.authorHandle,
      text: cached.candidate.tweetText,
      classification: undefined,
      analysis: cached.candidate.analysis,
      launchStatus: 'skipped-manual',
    });

    res.json({ success: true, status: 'skipped' });
  });

  // Collect creator fee via PumpPortal
  router.post('/pumpportal/collect-fee', authMiddleware(true), async (req: AuthenticatedRequest, res: Response): Promise<Response | void> => {
    if (!requireSTier(req, res)) return;
    if (!pumpPortal) {
      return res.status(503).json({ error: 'PumpPortal service not initialized' });
    }

    try {
      const { pool, mint, priorityFee } = req.body;
      const result = await pumpPortal.collectCreatorFee({ pool, mint, priorityFee });
      res.json({ success: true, signature: result.signature });
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to collect creator fee' });
    }
  });

  // Hosted buy via PumpPortal
  router.post('/pumpportal/buy-hosted', authMiddleware(true), async (req: AuthenticatedRequest, res: Response): Promise<Response | void> => {
    if (!requireSTier(req, res)) return;
    if (!tradingManager) {
      return res.status(503).json({ error: 'PumpPortal trading service not initialized' });
    }

    try {
      const { mint, amountSol, slippage, priorityFee, pool, walletId } = req.body;
      if (!mint || !amountSol) {
        return res.status(400).json({ error: 'mint and amountSol are required' });
      }

      const maxSol = Number(process.env.PUMPPORTAL_MAX_SOL_PER_TRADE || '2');
      if (Number(amountSol) > maxSol) {
        return res.status(400).json({ error: `amountSol too high. Max per trade: ${maxSol} SOL` });
      }

      const walletKey = walletId || 'default';
      if (!tradingManager.hasWallet(walletKey)) {
        return res.status(400).json({ error: `Unknown wallet: ${walletKey}` });
      }
      const svc = tradingManager.getWallet(walletKey);
      const signature = await svc.buyToken({
        mint: String(mint),
        amountSol: Number(amountSol),
        slippageBps: slippage !== undefined ? Number(slippage) : undefined,
        priorityFee: priorityFee !== undefined ? Number(priorityFee) : undefined,
        pool,
      });
      res.json({ success: true, signature, walletId: walletKey });
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to submit buy' });
    }
  });

  // Hosted sell via PumpPortal
  router.post('/pumpportal/sell-hosted', authMiddleware(true), async (req: AuthenticatedRequest, res: Response): Promise<Response | void> => {
    if (!requireSTier(req, res)) return;
    if (!tradingManager) {
      return res.status(503).json({ error: 'PumpPortal trading service not initialized' });
    }

    try {
      const { mint, tokenAmount, slippage, priorityFee, pool, walletId } = req.body;
      if (!mint || !tokenAmount) {
        return res.status(400).json({ error: 'mint and tokenAmount are required' });
      }

      const maxTokens = Number(process.env.PUMPPORTAL_MAX_TOKEN_AMOUNT || '100000000');
      if (Number(tokenAmount) > maxTokens) {
        return res.status(400).json({ error: `tokenAmount too high. Max per trade: ${maxTokens}` });
      }

      const walletKey = walletId || 'default';
      if (!tradingManager.hasWallet(walletKey)) {
        return res.status(400).json({ error: `Unknown wallet: ${walletKey}` });
      }
      const svc = tradingManager.getWallet(walletKey);
      const signature = await svc.sellToken({
        mint: String(mint),
        tokenAmount: Number(tokenAmount),
        slippageBps: slippage !== undefined ? Number(slippage) : undefined,
        priorityFee: priorityFee !== undefined ? Number(priorityFee) : undefined,
        pool,
      });
      res.json({ success: true, signature, walletId: walletKey });
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to submit sell' });
    }
  });

  // List trading wallets (admin)
  router.get('/pumpportal/wallets', authMiddleware(true), async (req: AuthenticatedRequest, res: Response): Promise<Response | void> => {
    if (!requireSTier(req, res)) return;
    if (!tradingManager) {
      return res.json({ wallets: [] });
    }

    res.json({ wallets: tradingManager.listWallets() });
  });

  // Create token with local signing (user signs transaction in browser)
  router.post('/tokens/create-local', authMiddleware(false), async (req: AuthenticatedRequest, res: Response): Promise<Response | void> => {
    try {
      const { txData, privateKey } = req.body;

      if (!txData || !privateKey) {
        return res.status(400).json({ error: 'Transaction data and private key are required' });
      }

      // Import required modules for transaction signing
      const { VersionedTransaction, Keypair, Connection } = require('@solana/web3.js');
      const bs58 = require('bs58');

      // Decode transaction
      const txBuffer = new Uint8Array(txData);
      const tx = VersionedTransaction.deserialize(txBuffer);

      // Decode private key (base58)
      const signerKeypair = Keypair.fromSecretKey(bs58.decode(privateKey));

      // Sign transaction
      tx.sign([signerKeypair]);

      // Send transaction
      const rpcUrl = process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';
      const connection = new Connection(rpcUrl, 'confirmed');
      const signature = await connection.sendTransaction(tx);

      res.json({
        success: true,
        signature,
        explorerUrl: `https://solscan.io/tx/${signature}`
      });
    } catch (error) {
      console.error('[LOCAL_SIGN] Error:', error);
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to sign and send transaction'
      });
    }
  });

  return router;
}
