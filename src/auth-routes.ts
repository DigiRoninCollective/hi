import { Router, Request, Response } from 'express';
import {
  registerUser,
  loginUser,
  logoutUser,
  changePassword,
  authMiddleware,
  AuthenticatedRequest,
} from './auth.service';
import {
  getUserSettings,
  upsertUserSettings,
  getWatchedAccounts,
  addWatchedAccount,
  removeWatchedAccount,
  getWordHighlights,
  addWordHighlight,
  removeWordHighlight,
  getContractAddresses,
  addContractAddress,
  removeContractAddress,
  getPlatformSettings,
  upsertPlatformSettings,
  getLaunchPreferencesDb,
  upsertLaunchPreferencesDb,
  listWalletPool,
  addWalletsToPool,
  deactivateWalletPool,
} from './database.service';
import { WalletPoolInsert } from './database.types';
import { encryptSecret } from './utils/crypto.util';

export function createAuthRoutes(): Router {
  const router = Router();

  const requireAdmin = (req: AuthenticatedRequest, res: Response): boolean => {
    if (req.user?.role !== 'admin') {
      res.status(403).json({ error: 'Admin only' });
      return false;
    }
    return true;
  };

  const requireSTier = (req: AuthenticatedRequest, res: Response): boolean => {
    if (req.user?.role !== 'admin') {
      res.status(403).json({ error: 'S-tier required' });
      return false;
    }
    return true;
  };

  // Register new user
  router.post('/register', async (req: Request, res: Response): Promise<Response | void> => {
    const { username, password, email } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    const result = await registerUser(username, password, email);

    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    res.status(201).json({
      success: true,
      user: {
        id: result.user!.id,
        username: result.user!.username,
        email: result.user!.email,
        role: result.user!.role,
      },
    });
  });

  // Login
  router.post('/login', async (req: Request, res: Response): Promise<Response | void> => {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    const ipAddress = req.ip || req.headers['x-forwarded-for']?.toString();
    const userAgent = req.headers['user-agent'];

    const result = await loginUser(username, password, ipAddress, userAgent);

    if (!result.success) {
      return res.status(401).json({ error: result.error });
    }

    // Set session cookie
    res.cookie('session_token', result.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    });

    res.json({
      success: true,
      token: result.token,
      user: {
        id: result.user!.id,
        username: result.user!.username,
        email: result.user!.email,
        role: result.user!.role,
      },
    });
  });

  // Logout
  router.post('/logout', authMiddleware(false), async (req: AuthenticatedRequest, res: Response): Promise<Response | void> => {
    const token = req.headers.authorization?.slice(7) || req.cookies?.session_token;

    if (token) {
      await logoutUser(token);
    }

    res.clearCookie('session_token');
    res.json({ success: true });
  });

  // Get current user
  router.get('/me', authMiddleware(true), async (req: AuthenticatedRequest, res: Response): Promise<Response | void> => {
    res.json({
      user: {
        id: req.user!.id,
        username: req.user!.username,
        email: req.user!.email,
        role: req.user!.role,
        created_at: req.user!.created_at,
        last_login: req.user!.last_login,
      },
    });
  });

  // Change password
  router.post('/change-password', authMiddleware(true), async (req: AuthenticatedRequest, res: Response): Promise<Response | void> => {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Current and new password are required' });
    }

    const result = await changePassword(req.user!.id, currentPassword, newPassword);

    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    res.clearCookie('session_token');
    res.json({ success: true, message: 'Password changed. Please login again.' });
  });

  // Get user settings
  router.get('/settings', authMiddleware(true), async (req: AuthenticatedRequest, res: Response): Promise<Response | void> => {
    const settings = await getUserSettings(req.user!.id);

    if (!settings) {
      // Return defaults
      return res.json({
        color_theme: 'Default',
        image_layout: 'grid',
        card_width: 1200,
        pause_on_hover: true,
        sounds_enabled: true,
        notifications_enabled: true,
      });
    }

    res.json(settings);
  });

  // Update user settings
  router.put('/settings', authMiddleware(true), async (req: AuthenticatedRequest, res: Response): Promise<Response | void> => {
    const { color_theme, image_layout, card_width, pause_on_hover, sounds_enabled, notifications_enabled } = req.body;

    const settings = await upsertUserSettings(req.user!.id, {
      color_theme,
      image_layout,
      card_width,
      pause_on_hover,
      sounds_enabled,
      notifications_enabled,
    });

    if (!settings) {
      return res.status(500).json({ error: 'Failed to update settings' });
    }

    res.json(settings);
  });

  // Watched Accounts
  router.get('/watched-accounts', authMiddleware(true), async (req: AuthenticatedRequest, res: Response): Promise<Response | void> => {
    const accounts = await getWatchedAccounts(req.user!.id);
    res.json(accounts);
  });

  router.post('/watched-accounts', authMiddleware(true), async (req: AuthenticatedRequest, res: Response): Promise<Response | void> => {
    const { twitter_username, twitter_user_id, display_name, avatar_url } = req.body;

    if (!twitter_username) {
      return res.status(400).json({ error: 'Twitter username is required' });
    }

    const account = await addWatchedAccount({
      user_id: req.user!.id,
      twitter_username,
      twitter_user_id,
      display_name,
      avatar_url,
    });

    if (!account) {
      return res.status(500).json({ error: 'Failed to add watched account' });
    }

    res.status(201).json(account);
  });

  router.delete('/watched-accounts/:id', authMiddleware(true), async (req: AuthenticatedRequest, res: Response): Promise<Response | void> => {
    const success = await removeWatchedAccount(req.params.id, req.user!.id);

    if (!success) {
      return res.status(500).json({ error: 'Failed to remove watched account' });
    }

    res.json({ success: true });
  });

  // Word Highlights
  router.get('/word-highlights', authMiddleware(true), async (req: AuthenticatedRequest, res: Response): Promise<Response | void> => {
    const highlights = await getWordHighlights(req.user!.id);
    res.json(highlights);
  });

  router.post('/word-highlights', authMiddleware(true), async (req: AuthenticatedRequest, res: Response): Promise<Response | void> => {
    const { word, color } = req.body;

    if (!word) {
      return res.status(400).json({ error: 'Word is required' });
    }

    const highlight = await addWordHighlight({
      user_id: req.user!.id,
      word,
      color: color || '#22c55e',
    });

    if (!highlight) {
      return res.status(500).json({ error: 'Failed to add word highlight' });
    }

    res.status(201).json(highlight);
  });

  router.delete('/word-highlights/:id', authMiddleware(true), async (req: AuthenticatedRequest, res: Response): Promise<Response | void> => {
    const success = await removeWordHighlight(req.params.id, req.user!.id);

    if (!success) {
      return res.status(500).json({ error: 'Failed to remove word highlight' });
    }

    res.json({ success: true });
  });

  // Contract Addresses
  router.get('/contract-addresses', authMiddleware(true), async (req: AuthenticatedRequest, res: Response): Promise<Response | void> => {
    const addresses = await getContractAddresses(req.user!.id);
    res.json(addresses);
  });

  router.post('/contract-addresses', authMiddleware(true), async (req: AuthenticatedRequest, res: Response): Promise<Response | void> => {
    const { address, label, chain } = req.body;

    if (!address) {
      return res.status(400).json({ error: 'Address is required' });
    }

    const contract = await addContractAddress({
      user_id: req.user!.id,
      address,
      label,
      chain: chain || 'solana',
    });

    if (!contract) {
      return res.status(500).json({ error: 'Failed to add contract address' });
    }

    res.status(201).json(contract);
  });

  router.delete('/contract-addresses/:id', authMiddleware(true), async (req: AuthenticatedRequest, res: Response): Promise<Response | void> => {
    const success = await removeContractAddress(req.params.id, req.user!.id);

    if (!success) {
      return res.status(500).json({ error: 'Failed to remove contract address' });
    }

    res.json({ success: true });
  });

  // Launch preferences (file-based storage)
  router.get('/launch-preferences', authMiddleware(true), async (req: AuthenticatedRequest, res: Response): Promise<Response | void> => {
    const prefs = await getLaunchPreferencesDb(req.user!.id);
    res.json(prefs);
  });

  router.put('/launch-preferences', authMiddleware(true), async (req: AuthenticatedRequest, res: Response): Promise<Response | void> => {
    const prefs = await upsertLaunchPreferencesDb(req.user!.id, req.body);
    if (!prefs) {
      return res.status(500).json({ error: 'Failed to update preferences' });
    }
    res.json(prefs);
  });

  // Admin: platform settings
  router.get('/admin/platform-settings', authMiddleware(true), async (req: AuthenticatedRequest, res: Response): Promise<Response | void> => {
    if (!requireAdmin(req, res)) return;
    const settings = await getPlatformSettings();
    res.json(settings);
  });

  router.put('/admin/platform-settings', authMiddleware(true), async (req: AuthenticatedRequest, res: Response): Promise<Response | void> => {
    if (!requireAdmin(req, res)) return;
    const { buy_fee_bps, sell_fee_bps, fee_wallet } = req.body;
    const updated = await upsertPlatformSettings(
      {
        buy_fee_bps,
        sell_fee_bps,
        fee_wallet,
      },
      req.user?.id
    );
    if (!updated) {
      return res.status(500).json({ error: 'Failed to update platform settings' });
    }
    res.json(updated);
  });

  // Wallet pool (S-tier)
  router.get('/wallet-pool', authMiddleware(true), async (req: AuthenticatedRequest, res: Response): Promise<Response | void> => {
    if (!requireSTier(req, res)) return;
    const pool = await listWalletPool(req.user!.id);
    res.json(pool.map(w => ({ id: w.id, public_key: w.public_key, created_at: w.created_at })));
  });

  router.post('/wallet-pool/generate', authMiddleware(true), async (req: AuthenticatedRequest, res: Response): Promise<Response | void> => {
    if (!requireSTier(req, res)) return;
    const count = Math.max(1, Math.min(20, parseInt(req.body.count || '5', 10)));
    const wallets: WalletPoolInsert[] = [];
    for (let i = 0; i < count; i++) {
      const kp = require('@solana/web3.js').Keypair.generate();
      wallets.push({
        user_id: req.user!.id,
        public_key: kp.publicKey.toBase58(),
        encrypted_private_key: encryptSecret(require('bs58').encode(kp.secretKey)),
        is_active: true,
      });
    }
    await deactivateWalletPool(req.user!.id);
    const inserted = await addWalletsToPool(wallets);
    res.status(201).json(inserted.map(w => ({ id: w.id, public_key: w.public_key, created_at: w.created_at })));
  });

  return router;
}
