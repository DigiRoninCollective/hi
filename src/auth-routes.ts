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
} from './database.service';

export function createAuthRoutes(): Router {
  const router = Router();

  // Register new user
  router.post('/register', async (req: Request, res: Response) => {
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
  router.post('/login', async (req: Request, res: Response) => {
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
  router.post('/logout', authMiddleware(false), async (req: AuthenticatedRequest, res: Response) => {
    const token = req.headers.authorization?.slice(7) || req.cookies?.session_token;

    if (token) {
      await logoutUser(token);
    }

    res.clearCookie('session_token');
    res.json({ success: true });
  });

  // Get current user
  router.get('/me', authMiddleware(true), async (req: AuthenticatedRequest, res: Response) => {
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
  router.post('/change-password', authMiddleware(true), async (req: AuthenticatedRequest, res: Response) => {
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
  router.get('/settings', authMiddleware(true), async (req: AuthenticatedRequest, res: Response) => {
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
  router.put('/settings', authMiddleware(true), async (req: AuthenticatedRequest, res: Response) => {
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
  router.get('/watched-accounts', authMiddleware(true), async (req: AuthenticatedRequest, res: Response) => {
    const accounts = await getWatchedAccounts(req.user!.id);
    res.json(accounts);
  });

  router.post('/watched-accounts', authMiddleware(true), async (req: AuthenticatedRequest, res: Response) => {
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

  router.delete('/watched-accounts/:id', authMiddleware(true), async (req: AuthenticatedRequest, res: Response) => {
    const success = await removeWatchedAccount(req.params.id, req.user!.id);

    if (!success) {
      return res.status(500).json({ error: 'Failed to remove watched account' });
    }

    res.json({ success: true });
  });

  // Word Highlights
  router.get('/word-highlights', authMiddleware(true), async (req: AuthenticatedRequest, res: Response) => {
    const highlights = await getWordHighlights(req.user!.id);
    res.json(highlights);
  });

  router.post('/word-highlights', authMiddleware(true), async (req: AuthenticatedRequest, res: Response) => {
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

  router.delete('/word-highlights/:id', authMiddleware(true), async (req: AuthenticatedRequest, res: Response) => {
    const success = await removeWordHighlight(req.params.id, req.user!.id);

    if (!success) {
      return res.status(500).json({ error: 'Failed to remove word highlight' });
    }

    res.json({ success: true });
  });

  // Contract Addresses
  router.get('/contract-addresses', authMiddleware(true), async (req: AuthenticatedRequest, res: Response) => {
    const addresses = await getContractAddresses(req.user!.id);
    res.json(addresses);
  });

  router.post('/contract-addresses', authMiddleware(true), async (req: AuthenticatedRequest, res: Response) => {
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

  router.delete('/contract-addresses/:id', authMiddleware(true), async (req: AuthenticatedRequest, res: Response) => {
    const success = await removeContractAddress(req.params.id, req.user!.id);

    if (!success) {
      return res.status(500).json({ error: 'Failed to remove contract address' });
    }

    res.json({ success: true });
  });

  return router;
}
