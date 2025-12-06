import { Keypair } from '@solana/web3.js';
import bs58 from 'bs58';
import crypto from 'crypto';

/**
 * Offline vanity generator (prefix or suffix).
 *
 * Env vars:
 *   VANITY_PREFIX: desired prefix (optional)
 *   VANITY_SUFFIX: desired suffix (optional)
 *   MAX_ATTEMPTS:  max attempts before stopping (default: 1_000_000)
 *
 * Notes:
 * - Keep prefixes short (3-4 chars). Each char adds ~58x difficulty.
 * - Runs entirely offline; no RPC needed.
 */

const prefix = process.env.VANITY_PREFIX || '';
const suffix = process.env.VANITY_SUFFIX || '';
const maxAttempts = parseInt(process.env.MAX_ATTEMPTS || '1000000', 10);

if (!prefix && !suffix) {
  console.error('Set VANITY_PREFIX or VANITY_SUFFIX to search for.');
  process.exit(1);
}

const targetRegex = new RegExp(`^${prefix}[1-9A-HJ-NP-Za-km-z]*${suffix}$`);

function generateKeypair(): Keypair {
  // Use crypto.randomBytes for entropy; Keypair.generate does the rest.
  return Keypair.generate();
}

async function main() {
  console.log(`Searching for vanity key (prefix="${prefix}", suffix="${suffix}")...`);

  let attempts = 0;
  const start = Date.now();

  while (attempts < maxAttempts) {
    const kp = generateKeypair();
    const pub = kp.publicKey.toBase58();
    attempts++;

    if (targetRegex.test(pub)) {
      const elapsed = ((Date.now() - start) / 1000).toFixed(2);
      console.log('\nMatch found!');
      console.log(`Attempts: ${attempts}`);
      console.log(`Time: ${elapsed}s`);
      console.log(`Public Key:  ${pub}`);
      console.log(`Secret Key:  ${bs58.encode(kp.secretKey)}`);
      return;
    }

    if (attempts % 50000 === 0) {
      const elapsed = ((Date.now() - start) / 1000).toFixed(2);
      console.log(`Attempts: ${attempts} (elapsed ${elapsed}s)`);
    }
  }

  console.log(`Reached MAX_ATTEMPTS=${maxAttempts} without a match.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
