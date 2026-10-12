import { randomBytes } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { loadConfig } from '../src/config';
import { createSecretBox, parseKey } from '../src/crypto';
import { parseServiceAccount } from '../src/firebase';

describe('secret box', () => {
  const box = createSecretBox(randomBytes(32));

  it('round-trips and never returns the plaintext', () => {
    const sealed = box.encrypt('access-sandbox-123');
    expect(sealed).not.toContain('access-sandbox-123');
    expect(box.decrypt(sealed)).toBe('access-sandbox-123');
  });

  it('uses a fresh IV per encryption', () => {
    expect(box.encrypt('same')).not.toBe(box.encrypt('same'));
  });

  it('rejects tampered ciphertext and wrong keys', () => {
    const sealed = box.encrypt('secret');
    const parts = sealed.split('.');
    parts[3] = Buffer.from('tampered').toString('base64url');
    expect(() => box.decrypt(parts.join('.'))).toThrow();
    expect(() => createSecretBox(randomBytes(32)).decrypt(sealed)).toThrow();
    expect(() => box.decrypt('nonsense')).toThrow('Malformed');
  });

  it('parses base64 and hex keys of exactly 32 bytes', () => {
    const raw = randomBytes(32);
    expect(parseKey(raw.toString('base64')).equals(raw)).toBe(true);
    expect(parseKey(raw.toString('hex')).equals(raw)).toBe(true);
    expect(() => parseKey(randomBytes(16).toString('base64'))).toThrow('32 bytes');
  });
});

describe('config', () => {
  it('defaults to the mock provider for local development', () => {
    const c = loadConfig({});
    expect(c.plaid.provider).toBe('mock');
    expect(c.port).toBe(8787);
    expect(c.allowedOrigins).toEqual(['http://localhost:8081', 'http://localhost:3000']);
  });

  it('requires Plaid keys when the real provider is selected', () => {
    expect(() => loadConfig({ PLAID_PROVIDER: 'plaid' })).toThrow('PLAID_CLIENT_ID');
  });

  it('refuses to run in production without an encryption key or service account', () => {
    expect(() => loadConfig({ NODE_ENV: 'production' })).toThrow(
      /TOKEN_ENCRYPTION_KEY[\s\S]*FIREBASE_SERVICE_ACCOUNT/,
    );
    expect(() =>
      loadConfig({ NODE_ENV: 'production', FIRESTORE_EMULATOR_HOST: 'localhost:8080' }),
    ).not.toThrow();
  });

  it('only allows the Plaid sandbox', () => {
    expect(() => loadConfig({ PLAID_ENV: 'production' })).toThrow();
  });

  it('parses SEED_DEMO_ON_START strictly', () => {
    expect(loadConfig({ SEED_DEMO_ON_START: 'false' }).demo.seedOnStart).toBe(false);
    expect(loadConfig({ SEED_DEMO_ON_START: 'true' }).demo.seedOnStart).toBe(true);
  });
});

describe('service account parsing', () => {
  const sa = { project_id: 'p', client_email: 'e@p.iam.gserviceaccount.com', private_key: 'k' };

  it('accepts raw JSON and base64 JSON', () => {
    expect(parseServiceAccount(JSON.stringify(sa)).project_id).toBe('p');
    expect(parseServiceAccount(Buffer.from(JSON.stringify(sa)).toString('base64')).project_id).toBe(
      'p',
    );
  });

  it('rejects incomplete credentials', () => {
    expect(() => parseServiceAccount(JSON.stringify({ project_id: 'p' }))).toThrow('missing');
  });
});
