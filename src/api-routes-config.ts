import { Router, Request, Response } from 'express';
import { AuthenticatedRequest, authMiddleware } from './auth.service';
import { requireSTierHelper } from './route-helpers';

export function createConfigRoutes(): Router {
  const router = Router();
  const requireSTier = requireSTierHelper();

  router.get('/mode', authMiddleware(true), (req: AuthenticatedRequest, res: Response) => {
    if (!requireSTier(req, res)) return;
    res.json({
      mode: process.env.AUTO_DEPLOY_MODE || 'semi',
      seedBuyEnabled: process.env.SEED_BUY_ENABLED === 'true',
      tradingWalletOverrides: process.env.TRADING_WALLET_PER_AUTHOR || '',
    });
  });

  return router;
}
