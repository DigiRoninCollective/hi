import fs from 'fs';
import { Keypair } from '@solana/web3.js';
import bs58 from 'bs58';

function ensureSecret(secret: string | undefined, label: string): string {
  if (!secret || !secret.trim()) {
    throw new Error(`${label} is required and must be provided via a secure secret source (vault/env injection), not a checked-in .env file.`);
  }
  return secret.trim();
}

export function loadKeypairFromSecret(secret: string | undefined, label = 'SOLANA_PRIVATE_KEY'): Keypair {
  const trimmed = ensureSecret(secret, label);

  let decoded: Uint8Array;
  try {
    decoded = bs58.decode(trimmed);
  } catch (err) {
    throw new Error(`${label} is not valid base58: ${(err as Error).message}`);
  }

  if (decoded.length < 64) {
    throw new Error(`${label} must decode to a 64-byte Solana secret key. Got ${decoded.length} bytes.`);
  }

  return Keypair.fromSecretKey(decoded);
}

export function loadKeypairFromEnv(envVar = 'SOLANA_PRIVATE_KEY'): Keypair {
  const jsonPath = process.env.SOLANA_KEYPAIR_JSON_PATH;
  if (jsonPath) {
    return loadKeypairFromJsonFile(jsonPath);
  }
  return loadKeypairFromSecret(process.env[envVar], envVar);
}

function parseKeypairJson(raw: string): Uint8Array {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    throw new Error(`SOLANA_KEYPAIR_JSON_PATH is not valid JSON: ${(err as Error).message}`);
  }

  const toUint8 = (value: unknown): Uint8Array | null => {
    if (Array.isArray(value) && value.every((n) => Number.isInteger(n))) {
      return Uint8Array.from(value as number[]);
    }
    if (typeof value === 'object' && value !== null && Array.isArray((value as any).secretKey)) {
      return Uint8Array.from((value as any).secretKey as number[]);
    }
    return null;
  };

  const decoded = toUint8(parsed);
  if (!decoded) {
    throw new Error('SOLANA_KEYPAIR_JSON_PATH must contain a JSON array of numbers (the secret key) or { "secretKey": [...] }');
  }
  return decoded;
}

export function loadKeypairFromJsonFile(filePath: string): Keypair {
  if (!fs.existsSync(filePath)) {
    throw new Error(`SOLANA_KEYPAIR_JSON_PATH not found: ${filePath}`);
  }
  const raw = fs.readFileSync(filePath, 'utf-8');
  const secret = parseKeypairJson(raw);
  if (secret.length < 64) {
    throw new Error(`SOLANA_KEYPAIR_JSON_PATH must decode to a 64-byte Solana secret key. Got ${secret.length} bytes.`);
  }
  return Keypair.fromSecretKey(secret);
}
