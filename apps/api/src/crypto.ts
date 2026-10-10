import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const VERSION = 'v1';

/** Accepts a 32-byte key as base64 or hex. */
export function parseKey(raw: string): Buffer {
  const trimmed = raw.trim();
  const key = /^[0-9a-f]{64}$/i.test(trimmed)
    ? Buffer.from(trimmed, 'hex')
    : Buffer.from(trimmed, 'base64');
  if (key.length !== 32) {
    throw new Error('TOKEN_ENCRYPTION_KEY must decode to 32 bytes (openssl rand -base64 32)');
  }
  return key;
}

/**
 * Development fallback so local runs work without configuration. Production
 * config validation refuses to start without a real key.
 */
export function devKey(projectId: string): Buffer {
  return createHash('sha256').update(`budgetwise-dev-key:${projectId}`).digest();
}

export interface SecretBox {
  encrypt(plaintext: string): string;
  decrypt(payload: string): string;
}

/** AES-256-GCM: "v1.<iv>.<tag>.<ciphertext>", all base64url. */
export function createSecretBox(key: Buffer): SecretBox {
  if (key.length !== 32) throw new Error('Key must be 32 bytes');
  return {
    encrypt(plaintext) {
      const iv = randomBytes(12);
      const cipher = createCipheriv(ALGORITHM, key, iv);
      const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
      const tag = cipher.getAuthTag();
      return [VERSION, iv, tag, ciphertext]
        .map((p) => (typeof p === 'string' ? p : p.toString('base64url')))
        .join('.');
    },
    decrypt(payload) {
      const [version, iv, tag, ciphertext] = payload.split('.');
      if (version !== VERSION || !iv || !tag || !ciphertext) throw new Error('Malformed secret');
      const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(iv, 'base64url'));
      decipher.setAuthTag(Buffer.from(tag, 'base64url'));
      return Buffer.concat([
        decipher.update(Buffer.from(ciphertext, 'base64url')),
        decipher.final(),
      ]).toString('utf8');
    },
  };
}

export function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}
