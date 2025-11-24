import { Router, Request, Response } from 'express';
import { EventBus, EventType } from './events';
import { AlphaAggregatorService, ClassifiedSignal } from './alpha-aggregator.service';
import { authMiddleware, AuthenticatedRequest } from './auth.service';
import {
  getAlphaSignals,
  getAlphaSignalById,
  saveAlphaSignal,
  getAlphaSignalStats,
  getWatchedDiscordChannels,
  addWatchedDiscordChannel,
  removeWatchedDiscordChannel,
  getWatchedTelegramChannels,
  addWatchedTelegramChannel,
  removeWatchedTelegramChannel,
  getWatchedSubreddits,
  addWatchedSubreddit,
  removeWatchedSubreddit,
  getUserAlphaFilters,
  createUserAlphaFilter,
  updateUserAlphaFilter,
  deleteUserAlphaFilter,
  addSignalInteraction,
  removeSignalInteraction,
  getUserSignalInteractions,
} from './database.service';
import {
  AlphaSourceType,
  AlphaSignalCategory,
  AlphaSignalPriority,
} from './database.types';

// Check if Supabase is configured
const useSupabase = !!(process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY);

export function createAlphaRoutes(
  alphaAggregator: AlphaAggregatorService | null,
  eventBus: EventBus
): Router {
  const router = Router();

  // ============================================
  // Alpha Signal Endpoints
  // ============================================

  // Get alpha signals with filters
  router.get('/signals', async (req: Request, res: Response): Promise<Response | void> => {
    if (!useSupabase) {
      return res.json({ signals: [], message: 'Supabase not configured' });
    }

    try {
      const options = {
        limit: parseInt(req.query.limit as string) || 50,
        offset: parseInt(req.query.offset as string) || 0,
        source: req.query.source as AlphaSourceType | undefined,
        category: req.query.category as AlphaSignalCategory | undefined,
        minPriority: req.query.minPriority as AlphaSignalPriority | undefined,
        minConfidence: req.query.minConfidence ? parseFloat(req.query.minConfidence as string) : undefined,
        maxRisk: req.query.maxRisk ? parseFloat(req.query.maxRisk as string) : undefined,
        tickers: req.query.tickers ? (req.query.tickers as string).split(',') : undefined,
      };

      const signals = await getAlphaSignals(options);
      res.json({ signals, count: signals.length });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      res.status(500).json({ error: errorMessage });
    }
  });

  // Get single signal by ID
  router.get('/signals/:id', async (req: Request, res: Response): Promise<Response | void> => {
    if (!useSupabase) {
      return res.status(404).json({ error: 'Signal not found' });
    }

    try {
      const signal = await getAlphaSignalById(req.params.id);
      if (!signal) {
        return res.status(404).json({ error: 'Signal not found' });
      }
      res.json(signal);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      res.status(500).json({ error: errorMessage });
    }
  });

  // Get signal statistics
  router.get('/stats', async (req: Request, res: Response): Promise<Response | void> => {
    try {
      // Get in-memory stats from aggregator
      const aggregatorStats = alphaAggregator?.getStats() || {
        totalProcessed: 0,
        bySource: {},
        byCategory: {},
        filtered: 0,
        highPriority: 0,
      };

      // Get database stats if Supabase is configured
      let dbStats = { total: 0, bySource: {}, byCategory: {}, byPriority: {}, last24h: 0 };
      if (useSupabase) {
        dbStats = await getAlphaSignalStats();
      }

      res.json({
        aggregator: aggregatorStats,
        database: dbStats,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      res.status(500).json({ error: errorMessage });
    }
  });

  // ============================================
  // Service Status & Control
  // ============================================

  // Get aggregator service status
  router.get('/status', async (req: Request, res: Response): Promise<Response | void> => {
    if (!alphaAggregator) {
      return res.json({
        enabled: false,
        message: 'Alpha aggregator not initialized',
      });
    }

    try {
      const status = alphaAggregator.getStatus();
      const watched = alphaAggregator.getWatched();
      const discordInfo = alphaAggregator.getDiscordInfo();

      res.json({
        enabled: true,
        services: status,
        watched,
        discord: discordInfo,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      res.status(500).json({ error: errorMessage });
    }
  });

  // Get available Discord channels
  router.get('/discord/channels', async (req: Request, res: Response): Promise<Response | void> => {
    if (!alphaAggregator) {
      return res.json({ channels: [] });
    }

    try {
      const channels = alphaAggregator.getDiscordChannels();
      res.json({ channels });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      res.status(500).json({ error: errorMessage });
    }
  });

  // ============================================
  // Watched Sources Management
  // ============================================

  // Add watched source (unified endpoint)
  router.post('/watch', authMiddleware(true), async (req: AuthenticatedRequest, res: Response): Promise<Response | void> => {
    try {
      const { source, identifier, name } = req.body;
      const userId = req.user!.id;

      if (!source || !identifier) {
        return res.status(400).json({ error: 'Source and identifier are required' });
      }

      // Add to aggregator (in-memory)
      if (alphaAggregator) {
        alphaAggregator.addWatched(source as AlphaSourceType, identifier);
      }

      // Persist to database if Supabase is configured
      if (useSupabase) {
        switch (source) {
          case 'discord':
            await addWatchedDiscordChannel({
              user_id: userId,
              guild_id: req.body.guildId || 'unknown',
              guild_name: req.body.guildName || null,
              channel_id: identifier,
              channel_name: name || null,
            });
            break;
          case 'telegram':
            await addWatchedTelegramChannel({
              user_id: userId,
              chat_id: identifier,
              chat_name: name || null,
              chat_type: req.body.chatType || 'channel',
            });
            break;
          case 'reddit':
            await addWatchedSubreddit({
              user_id: userId,
              subreddit: identifier.replace(/^r\//, ''),
            });
            break;
          default:
            return res.status(400).json({ error: 'Invalid source type' });
        }
      }

      eventBus.emit(EventType.ALERT_INFO, {
        title: 'Source Added',
        message: `Now watching ${source}: ${name || identifier}`,
      });

      res.json({ success: true, source, identifier });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      res.status(500).json({ error: errorMessage });
    }
  });

  // Remove watched source
  router.delete('/watch/:source/:id', authMiddleware(true), async (req: AuthenticatedRequest, res: Response): Promise<Response | void> => {
    try {
      const { source, id } = req.params;
      const userId = req.user!.id;

      // Remove from aggregator
      if (alphaAggregator) {
        alphaAggregator.removeWatched(source as AlphaSourceType, id);
      }

      // Remove from database
      if (useSupabase) {
        switch (source) {
          case 'discord':
            await removeWatchedDiscordChannel(id, userId);
            break;
          case 'telegram':
            await removeWatchedTelegramChannel(id, userId);
            break;
          case 'reddit':
            await removeWatchedSubreddit(id, userId);
            break;
        }
      }

      res.json({ success: true });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      res.status(500).json({ error: errorMessage });
    }
  });

  // Get user's watched sources
  router.get('/watch', authMiddleware(true), async (req: AuthenticatedRequest, res: Response): Promise<Response | void> => {
    if (!useSupabase) {
      // Return in-memory watched if no Supabase
      const watched = alphaAggregator?.getWatched() || { discord: [], telegram: [], reddit: [] };
      return res.json(watched);
    }

    try {
      const userId = req.user!.id;
      const [discord, telegram, reddit] = await Promise.all([
        getWatchedDiscordChannels(userId),
        getWatchedTelegramChannels(userId),
        getWatchedSubreddits(userId),
      ]);

      res.json({ discord, telegram, reddit });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      res.status(500).json({ error: errorMessage });
    }
  });

  // ============================================
  // User Filters
  // ============================================

  // Get user's filters
  router.get('/filters', authMiddleware(true), async (req: AuthenticatedRequest, res: Response): Promise<Response | void> => {
    if (!useSupabase) {
      return res.json({ filters: [] });
    }

    try {
      const filters = await getUserAlphaFilters(req.user!.id);
      res.json({ filters });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      res.status(500).json({ error: errorMessage });
    }
  });

  // Create filter
  router.post('/filters', authMiddleware(true), async (req: AuthenticatedRequest, res: Response): Promise<Response | void> => {
    if (!useSupabase) {
      return res.status(503).json({ error: 'Supabase not configured' });
    }

    try {
      const filter = await createUserAlphaFilter({
        user_id: req.user!.id,
        name: req.body.name,
        sources: req.body.sources || null,
        categories: req.body.categories || null,
        min_confidence: req.body.minConfidence || null,
        max_risk: req.body.maxRisk || null,
        min_priority: req.body.minPriority || null,
        include_keywords: req.body.includeKeywords || null,
        exclude_keywords: req.body.excludeKeywords || null,
        include_tickers: req.body.includeTickers || null,
        notify_enabled: req.body.notifyEnabled !== false,
        notify_channels: req.body.notifyChannels || null,
      });

      if (!filter) {
        return res.status(500).json({ error: 'Failed to create filter' });
      }

      res.json({ filter });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      res.status(500).json({ error: errorMessage });
    }
  });

  // Update filter
  router.put('/filters/:id', authMiddleware(true), async (req: AuthenticatedRequest, res: Response): Promise<Response | void> => {
    if (!useSupabase) {
      return res.status(503).json({ error: 'Supabase not configured' });
    }

    try {
      const filter = await updateUserAlphaFilter(req.params.id, req.user!.id, req.body);
      if (!filter) {
        return res.status(404).json({ error: 'Filter not found' });
      }
      res.json({ filter });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      res.status(500).json({ error: errorMessage });
    }
  });

  // Delete filter
  router.delete('/filters/:id', authMiddleware(true), async (req: AuthenticatedRequest, res: Response): Promise<Response | void> => {
    if (!useSupabase) {
      return res.status(503).json({ error: 'Supabase not configured' });
    }

    try {
      const success = await deleteUserAlphaFilter(req.params.id, req.user!.id);
      if (!success) {
        return res.status(404).json({ error: 'Filter not found' });
      }
      res.json({ success: true });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      res.status(500).json({ error: errorMessage });
    }
  });

  // ============================================
  // Signal Interactions
  // ============================================

  // Like/save/hide signal
  router.post('/signals/:id/interact', authMiddleware(true), async (req: AuthenticatedRequest, res: Response): Promise<Response | void> => {
    if (!useSupabase) {
      return res.status(503).json({ error: 'Supabase not configured' });
    }

    try {
      const { type } = req.body; // 'like', 'save', 'hide', 'report'
      if (!['like', 'save', 'hide', 'report'].includes(type)) {
        return res.status(400).json({ error: 'Invalid interaction type' });
      }

      const interaction = await addSignalInteraction({
        user_id: req.user!.id,
        signal_id: req.params.id,
        interaction_type: type,
      });

      if (!interaction) {
        return res.status(500).json({ error: 'Failed to add interaction' });
      }

      res.json({ success: true, interaction });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      res.status(500).json({ error: errorMessage });
    }
  });

  // Remove interaction
  router.delete('/signals/:id/interact/:type', authMiddleware(true), async (req: AuthenticatedRequest, res: Response): Promise<Response | void> => {
    if (!useSupabase) {
      return res.status(503).json({ error: 'Supabase not configured' });
    }

    try {
      const success = await removeSignalInteraction(req.user!.id, req.params.id, req.params.type);
      res.json({ success });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      res.status(500).json({ error: errorMessage });
    }
  });

  // Get user's saved signals
  router.get('/saved', authMiddleware(true), async (req: AuthenticatedRequest, res: Response): Promise<Response | void> => {
    if (!useSupabase) {
      return res.json({ signals: [] });
    }

    try {
      const interactions = await getUserSignalInteractions(req.user!.id, 'save');
      const signalIds = interactions.map((i) => i.signal_id);

      // Fetch actual signals
      const signals: any[] = [];
      for (const id of signalIds.slice(0, 50)) {
        const signal = await getAlphaSignalById(id);
        if (signal) signals.push(signal);
      }

      res.json({ signals });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      res.status(500).json({ error: errorMessage });
    }
  });

  return router;
}
