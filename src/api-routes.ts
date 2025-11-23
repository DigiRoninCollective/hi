import { Router, Request, Response } from 'express';
import { PumpPortalService } from './pumpportal';
import { EventBus, EventType } from './events';
import { ParsedLaunchCommand } from './types';
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

// Check if Supabase is configured
const useSupabase = !!(process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY);

// Ensure upload directory exists
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

export function createApiRoutes(
  pumpPortal: PumpPortalService | null,
  eventBus: EventBus
): Router {
  const router = Router();

  // Get wallet info
  router.get('/wallet', async (req: Request, res: Response) => {
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

  // Create token (with optional auth)
  router.post('/tokens/create', authMiddleware(false), async (req: AuthenticatedRequest, res: Response) => {
    if (!pumpPortal) {
      return res.status(503).json({ error: 'PumpPortal service not initialized' });
    }

    try {
      const { name, symbol, description, website, twitterUrl, platform, buyAmount, imageUrl } = req.body;

      if (!name || !symbol) {
        return res.status(400).json({ error: 'Name and symbol are required' });
      }

      // Create launch command
      const command: ParsedLaunchCommand = {
        ticker: symbol,
        name: name,
        description: description || `${symbol} - Launched via PumpLauncher`,
        imageUrl: imageUrl || undefined,
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
          image_url: imageUrl || null,
          platform: (platform || 'pump') as 'pump' | 'bonk' | 'bags' | 'bnb' | 'usd1',
          chain: 'solana',
          created_by: req.user?.id || null,
          initial_buy_sol: buyAmount || null,
          status: 'creating',
        });
      }

      // Create the token
      const result = await pumpPortal.createToken(command);

      // Store created token
      if (useSupabase) {
        await dbCreateToken({
          mint_address: result.mint,
          name,
          symbol,
          description: command.description || null,
          image_url: imageUrl || null,
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
  });

  // Get created tokens
  router.get('/tokens', authMiddleware(false), async (req: AuthenticatedRequest, res: Response) => {
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
  router.get('/tokens/:mint', async (req: Request, res: Response) => {
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
  router.post('/tokens/:mint/buy', authMiddleware(false), async (req: AuthenticatedRequest, res: Response) => {
    if (!pumpPortal) {
      return res.status(503).json({ error: 'PumpPortal service not initialized' });
    }

    try {
      const { amount } = req.body;
      const mint = req.params.mint;

      if (!amount || amount <= 0) {
        return res.status(400).json({ error: 'Valid amount is required' });
      }

      const signature = await pumpPortal.buyToken(mint, amount);

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
  });

  // Sell token
  router.post('/tokens/:mint/sell', authMiddleware(false), async (req: AuthenticatedRequest, res: Response) => {
    if (!pumpPortal) {
      return res.status(503).json({ error: 'PumpPortal service not initialized' });
    }

    try {
      const { amount } = req.body;
      const mint = req.params.mint;

      if (!amount || amount <= 0) {
        return res.status(400).json({ error: 'Valid amount is required' });
      }

      const signature = await pumpPortal.sellToken(mint, amount);

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
  });

  // Image upload endpoint (base64)
  router.post('/upload/image', (req: Request, res: Response) => {
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
  router.get('/status', async (req: Request, res: Response) => {
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
  router.get('/tweets', async (req: Request, res: Response) => {
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

  return router;
}
