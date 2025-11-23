import { Router, Request, Response } from 'express';
import { PumpPortalService } from './pumpportal';
import { EventBus, EventType } from './events';
import { ParsedLaunchCommand } from './types';
import { v4 as uuidv4 } from 'uuid';
import * as fs from 'fs';
import * as path from 'path';

// Simple in-memory storage for created tokens
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

  // Create token
  router.post('/tokens/create', async (req: Request, res: Response) => {
    if (!pumpPortal) {
      return res.status(503).json({ error: 'PumpPortal service not initialized' });
    }

    try {
      const { name, symbol, description, website, twitterUrl, platform, buyAmount } = req.body;

      if (!name || !symbol) {
        return res.status(400).json({ error: 'Name and symbol are required' });
      }

      // Create launch command
      const command: ParsedLaunchCommand = {
        ticker: symbol,
        name: name,
        description: description || `${symbol} - Launched via PumpLauncher`,
        imageUrl: undefined, // Will be set if image is uploaded
        tweetId: `manual-${uuidv4()}`,
        tweetAuthor: 'manual',
        tweetText: `Manual launch: ${symbol}`,
      };

      // Emit creating event
      eventBus.emit(EventType.TOKEN_CREATING, {
        ticker: command.ticker,
        name: command.name,
      });

      // Create the token
      const result = await pumpPortal.createToken(command);

      // Store created token
      const token: CreatedToken = {
        id: uuidv4(),
        ticker: symbol,
        name,
        description: command.description || '',
        mint: result.mint,
        signature: result.signature,
        platform: platform || 'pump',
        createdAt: new Date(),
      };
      createdTokens.unshift(token);

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

      eventBus.emit(EventType.TOKEN_FAILED, {
        ticker: req.body.symbol || 'UNKNOWN',
        name: req.body.name || 'Unknown',
        error: errorMessage,
      });

      res.status(500).json({ error: errorMessage });
    }
  });

  // Get created tokens
  router.get('/tokens', (req: Request, res: Response) => {
    const limit = parseInt(req.query.limit as string) || 50;
    res.json({
      tokens: createdTokens.slice(0, limit),
      total: createdTokens.length,
    });
  });

  // Get token by mint
  router.get('/tokens/:mint', (req: Request, res: Response) => {
    const token = createdTokens.find((t) => t.mint === req.params.mint);
    if (!token) {
      return res.status(404).json({ error: 'Token not found' });
    }
    res.json(token);
  });

  // Buy token
  router.post('/tokens/:mint/buy', async (req: Request, res: Response) => {
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
  router.post('/tokens/:mint/sell', async (req: Request, res: Response) => {
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

    res.json({
      status: 'running',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      wallet: walletInfo,
      tokensCreated: createdTokens.length,
    });
  });

  return router;
}
