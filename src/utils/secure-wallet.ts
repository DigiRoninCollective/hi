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
  return loadKeypairFromSecret(process.env[envVar], envVar);
}
