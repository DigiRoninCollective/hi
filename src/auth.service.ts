import crypto from 'crypto';
import { getSupabase } from './supabase';
import { User, Session, UserSettings } from './database.types';
import { createUser, getUserByUsername, updateUser, createUserSettings } from './database.service';
import { Request, Response, NextFunction } from 'express';

const SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

// Password hashing
function hashPassword(password: string, salt?: string): { hash: string; salt: string } {
  const passwordSalt = salt || crypto.randomBytes(32).toString('hex');
  const hash = crypto.pbkdf2Sync(password, passwordSalt, 100000, 64, 'sha512').toString('hex');
  return { hash, salt: passwordSalt };
}

function verifyPassword(password: string, hash: string, salt: string): boolean {
  const result = hashPassword(password, salt);
  return result.hash === hash;
}

// Generate secure session token
function generateSessionToken(): string {
  return crypto.randomBytes(48).toString('hex');
}

// User registration
export interface RegisterResult {
  success: boolean;
  user?: User;
  error?: string;
}

export async function registerUser(
  username: string,
  password: string,
  email?: string
): Promise<RegisterResult> {
  // Validate username
  if (!username || username.length < 3 || username.length > 30) {
    return { success: false, error: 'Username must be between 3 and 30 characters' };
  }

  if (!/^[a-zA-Z0-9_]+$/.test(username)) {
    return { success: false, error: 'Username can only contain letters, numbers, and underscores' };
  }

  // Validate password
  if (!password || password.length < 8) {
    return { success: false, error: 'Password must be at least 8 characters' };
  }

  // Check if username exists
  const existing = await getUserByUsername(username);
  if (existing) {
    return { success: false, error: 'Username already taken' };
  }

  // Hash password
  const { hash, salt } = hashPassword(password);

  // Store password hash in a separate table or use Supabase auth
  // For now, we'll store it in a password_hashes table
  const user = await createUser({
    username,
    email: email || null,
    is_active: true,
    role: 'user',
  });

  if (!user) {
    return { success: false, error: 'Failed to create user' };
  }

  // Store password hash
  const { error: hashError } = await getSupabase()
    .from('password_hashes')
    .insert({
      user_id: user.id,
      hash,
      salt,
    });

  if (hashError) {
    // Rollback user creation
    await getSupabase().from('users').delete().eq('id', user.id);
    return { success: false, error: 'Failed to create user credentials' };
  }

  // Create default settings for user
  await createUserSettings({
    user_id: user.id,
    color_theme: 'Default',
    image_layout: 'grid',
    card_width: 1200,
    pause_on_hover: true,
    sounds_enabled: true,
    notifications_enabled: true,
  });

  return { success: true, user };
}

// User login
export interface LoginResult {
  success: boolean;
  user?: User;
  session?: Session;
  token?: string;
  error?: string;
}

export async function loginUser(
  username: string,
  password: string,
  ipAddress?: string,
  userAgent?: string
): Promise<LoginResult> {
  // Get user
  const user = await getUserByUsername(username);
  if (!user) {
    return { success: false, error: 'Invalid username or password' };
  }

  if (!user.is_active) {
    return { success: false, error: 'Account is deactivated' };
  }

  // Get password hash
  const { data: hashData, error: hashError } = await getSupabase()
    .from('password_hashes')
    .select('hash, salt')
    .eq('user_id', user.id)
    .single();

  if (hashError || !hashData) {
    return { success: false, error: 'Invalid username or password' };
  }

  // Verify password
  if (!verifyPassword(password, hashData.hash, hashData.salt)) {
    return { success: false, error: 'Invalid username or password' };
  }

  // Create session
  const token = generateSessionToken();
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS).toISOString();

  const { data: session, error: sessionError } = await getSupabase()
    .from('sessions')
    .insert({
      user_id: user.id,
      token,
      expires_at: expiresAt,
      ip_address: ipAddress || null,
      user_agent: userAgent || null,
    })
    .select()
    .single();

  if (sessionError || !session) {
    return { success: false, error: 'Failed to create session' };
  }

  // Update last login
  await updateUser(user.id, { last_login: new Date().toISOString() });

  return { success: true, user, session, token };
}

// Logout
export async function logoutUser(token: string): Promise<boolean> {
  const { error } = await getSupabase()
    .from('sessions')
    .delete()
    .eq('token', token);

  return !error;
}

// Logout all sessions for user
export async function logoutAllSessions(userId: string): Promise<boolean> {
  const { error } = await getSupabase()
    .from('sessions')
    .delete()
    .eq('user_id', userId);

  return !error;
}

// Validate session
export async function validateSession(token: string): Promise<{ valid: boolean; user?: User; session?: Session }> {
  const { data: session, error } = await getSupabase()
    .from('sessions')
    .select('*, users(*)')
    .eq('token', token)
    .single();

  if (error || !session) {
    return { valid: false };
  }

  // Check if session is expired
  if (new Date(session.expires_at) < new Date()) {
    // Delete expired session
    await getSupabase().from('sessions').delete().eq('token', token);
    return { valid: false };
  }

  const user = session.users as unknown as User;
  if (!user || !user.is_active) {
    return { valid: false };
  }

  return { valid: true, user, session };
}

// Extend session
export async function extendSession(token: string): Promise<boolean> {
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS).toISOString();

  const { error } = await getSupabase()
    .from('sessions')
    .update({ expires_at: expiresAt })
    .eq('token', token);

  return !error;
}

// Change password
export async function changePassword(
  userId: string,
  currentPassword: string,
  newPassword: string
): Promise<{ success: boolean; error?: string }> {
  // Validate new password
  if (!newPassword || newPassword.length < 8) {
    return { success: false, error: 'New password must be at least 8 characters' };
  }

  // Get current hash
  const { data: hashData, error: hashError } = await getSupabase()
    .from('password_hashes')
    .select('hash, salt')
    .eq('user_id', userId)
    .single();

  if (hashError || !hashData) {
    return { success: false, error: 'User not found' };
  }

  // Verify current password
  if (!verifyPassword(currentPassword, hashData.hash, hashData.salt)) {
    return { success: false, error: 'Current password is incorrect' };
  }

  // Hash new password
  const { hash, salt } = hashPassword(newPassword);

  // Update password
  const { error: updateError } = await getSupabase()
    .from('password_hashes')
    .update({ hash, salt })
    .eq('user_id', userId);

  if (updateError) {
    return { success: false, error: 'Failed to update password' };
  }

  // Invalidate all other sessions
  await logoutAllSessions(userId);

  return { success: true };
}

// Express middleware for authentication
export interface AuthenticatedRequest extends Request {
  user?: User;
  session?: Session;
}

export function authMiddleware(required: boolean = true) {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

    // Also check for token in cookies
    const cookieToken = req.cookies?.session_token;
    const sessionToken = token || cookieToken;

    if (!sessionToken) {
      if (required) {
        return res.status(401).json({ error: 'Authentication required' });
      }
      return next();
    }

    const { valid, user, session } = await validateSession(sessionToken);

    if (!valid) {
      if (required) {
        return res.status(401).json({ error: 'Invalid or expired session' });
      }
      return next();
    }

    req.user = user;
    req.session = session;

    // Extend session on activity
    await extendSession(sessionToken);

    next();
  };
}

// Admin only middleware
export function adminMiddleware(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
}

// Clean up expired sessions (call periodically)
export async function cleanupExpiredSessions(): Promise<number> {
  const { data, error } = await getSupabase()
    .from('sessions')
    .delete()
    .lt('expires_at', new Date().toISOString())
    .select();

  if (error) {
    console.error('Error cleaning up sessions:', error);
    return 0;
  }

  return data?.length || 0;
}
