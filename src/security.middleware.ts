import { Request, Response, NextFunction } from 'express';
import rateLimit, { RateLimitRequestHandler } from 'express-rate-limit';
import { z, ZodError } from 'zod';
import { getErrorMessage } from './types';

/**
 * CORS Configuration
 */
export function corsMiddleware(allowedOrigins: string[]): (req: Request, res: Response, next: NextFunction) => void {
  return (req: Request, res: Response, next: NextFunction): void => {
    const origin = req.headers.origin as string;

    if (allowedOrigins.includes(origin)) {
      res.header('Access-Control-Allow-Origin', origin);
      res.header('Access-Control-Allow-Credentials', 'true');
    } else if (process.env.NODE_ENV === 'development') {
      // Allow localhost in development
      if (origin?.includes('localhost') || origin?.includes('127.0.0.1')) {
        res.header('Access-Control-Allow-Origin', origin);
        res.header('Access-Control-Allow-Credentials', 'true');
      }
    }

    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-API-Key');
    res.header('Access-Control-Max-Age', '86400');

    if (req.method === 'OPTIONS') {
      res.sendStatus(200);
      return;
    }

    next();
  };
}

/**
 * Create Rate Limiters for Different Endpoints
 */

export const createTokenLimiter: RateLimitRequestHandler = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 5, // 5 token creations per minute
  message: 'Too many token creation requests. Please try again in 1 minute.',
  standardHeaders: true, // Return rate limit info in `RateLimit-*` headers
  skip: (req: Request): boolean => {
    // Skip rate limit for health checks
    return req.path === '/health';
  },
});

export const buyTokenLimiter: RateLimitRequestHandler = rateLimit({
  windowMs: 10 * 1000, // 10 seconds
  max: 10, // 10 buys per 10 seconds
  message: 'Too many buy requests. Please try again in 10 seconds.',
  standardHeaders: true,
});

export const sellTokenLimiter: RateLimitRequestHandler = rateLimit({
  windowMs: 10 * 1000, // 10 seconds
  max: 10, // 10 sells per 10 seconds
  message: 'Too many sell requests. Please try again in 10 seconds.',
  standardHeaders: true,
});

export const eventStreamLimiter: RateLimitRequestHandler = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 50, // 50 connections per minute
  message: 'Too many event stream connections.',
  standardHeaders: true,
  skipSuccessfulRequests: true, // Only count failed requests
});

export const generalLimiter: RateLimitRequestHandler = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per 15 minutes
  message: 'Too many requests. Please try again later.',
  standardHeaders: true,
});

/**
 * Validation Schemas
 */

export const CreateTokenSchema = z.object({
  name: z.string().min(1).max(50).describe('Token name'),
  ticker: z
    .string()
    .min(1)
    .max(10)
    .regex(/^[A-Z0-9]+$/, 'Ticker must contain only uppercase letters and numbers')
    .describe('Token ticker/symbol'),
  description: z.string().max(500).optional().describe('Token description'),
  imageUrl: z.string().url('Invalid image URL').optional().describe('Token logo URL'),
  bannerUrl: z.string().url('Invalid banner URL').optional().describe('Token banner URL'),
  website: z.string().url('Invalid website URL').optional().describe('Project website'),
  twitter: z.string().url('Invalid Twitter URL').optional().describe('Twitter profile URL'),
  telegram: z.string().url('Invalid Telegram URL').optional().describe('Telegram URL'),
});

export const BuyTokenSchema = z.object({
  mint: z.string().min(40).max(44).describe('Token mint address'),
  solAmount: z.number().min(0.01).max(100).describe('Amount in SOL'),
  slippage: z.number().min(0.1).max(50).default(2).describe('Slippage tolerance %'),
});

export const SellTokenSchema = z.object({
  mint: z.string().min(40).max(44).describe('Token mint address'),
  tokenAmount: z.number().min(1).describe('Amount of tokens to sell'),
  slippage: z.number().min(0.1).max(50).default(2).describe('Slippage tolerance %'),
});

/**
 * Validation Middleware
 */

export function validateRequest<T>(schema: z.ZodSchema<T>): (req: Request, res: Response, next: NextFunction) => void {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      const validated = schema.parse(req.body);
      req.body = validated;
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        res.status(400).json({
          error: 'Validation failed',
          details: error.errors.map((e) => ({
            field: e.path.join('.'),
            message: e.message,
          })),
        });
        return;
      }
      res.status(400).json({
        error: 'Invalid request',
        message: getErrorMessage(error),
      });
    }
  };
}

/**
 * Error Response Formatter
 */

export interface ErrorResponse {
  error: string;
  message: string;
  statusCode: number;
  details?: unknown;
  timestamp: string;
}

export function formatErrorResponse(
  error: unknown,
  statusCode: number = 500,
  details?: unknown
): ErrorResponse {
  const message = getErrorMessage(error);

  return {
    error:
      statusCode === 400
        ? 'Bad Request'
        : statusCode === 401
        ? 'Unauthorized'
        : statusCode === 403
        ? 'Forbidden'
        : statusCode === 429
        ? 'Too Many Requests'
        : 'Internal Server Error',
    message,
    statusCode,
    details,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Request Logging Middleware
 */

export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const start = Date.now();
  const originalJson = res.json;

  res.json = function (data: any) {
    const duration = Date.now() - start;
    const logLevel = res.statusCode >= 400 ? 'error' : res.statusCode >= 300 ? 'warn' : 'info';

    console.log(
      `[${logLevel.toUpperCase()}] ${req.method} ${req.path} - ${res.statusCode} (${duration}ms)`
    );

    if (res.statusCode >= 400) {
      console.log('  Request:', {
        body: req.body,
        query: req.query,
        ip: req.ip,
      });
      console.log('  Response:', data);
    }

    return originalJson.call(this, data);
  };

  next();
}

/**
 * Security Headers Middleware
 */

export function securityHeaders(req: Request, res: Response, next: NextFunction): void {
  // Prevent clickjacking
  res.setHeader('X-Frame-Options', 'DENY');

  // Prevent MIME type sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');

  // Enable XSS protection
  res.setHeader('X-XSS-Protection', '1; mode=block');

  // Enforce HTTPS in production
  if (process.env.NODE_ENV === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }

  // Referrer policy
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

  next();
}
