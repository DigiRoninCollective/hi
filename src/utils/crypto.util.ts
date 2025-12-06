import crypto from 'crypto';

const KEY_ENV = process.env.ENCRYPTION_KEY || '';

function getKey(): Buffer {
  // Expect a 32-byte key provided as hex or base64
  if (!KEY_ENV) {
    throw new Error('ENCRYPTION_KEY is required for secure key storage');
  }
  if (/^[0-9a-fA-F]{64}$/.test(KEY_ENV)) {
    return Buffer.from(KEY_ENV, 'hex');
  }
  // Assume base64
  const buf = Buffer.from(KEY_ENV, 'base64');
  if (buf.length !== 32) {
    throw new Error('ENCRYPTION_KEY must decode to 32 bytes (AES-256-GCM)');
  }
  return buf;
}

export function encryptSecret(plain: string): string {
  const key = getKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString('base64');
}

export function decryptSecret(payload: string): string {
  const key = getKey();
  const buf = Buffer.from(payload, 'base64');
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const data = buf.subarray(28);
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  const dec = Buffer.concat([decipher.update(data), decipher.final()]);
  return dec.toString('utf8');
}
