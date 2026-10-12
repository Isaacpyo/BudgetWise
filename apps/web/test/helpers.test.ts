import { describe, expect, it } from 'vitest';
import { authErrorMessage, validateCredentials } from '../src/lib/auth-errors';
import { formatChange, timeAgo } from '../src/lib/format';

describe('auth helpers', () => {
  it('maps Firebase error codes to friendly copy', () => {
    expect(authErrorMessage({ code: 'auth/invalid-credential' })).toBe(
      'Email or password is incorrect.',
    );
    expect(authErrorMessage({ code: 'auth/email-already-in-use' })).toMatch(/already exists/);
    expect(authErrorMessage({ code: 'auth/unknown', message: 'Raw' })).toBe('Raw');
  });

  it('validates credentials per mode', () => {
    expect(validateCredentials('nope', '', 'signIn')).toEqual({
      email: 'Enter a valid email address.',
      password: 'Enter your password.',
    });
    expect(validateCredentials('a@b.co', 'short', 'signUp').password).toMatch(/8 characters/);
    expect(validateCredentials('a@b.co', 'short', 'signIn')).toEqual({});
  });
});

describe('format helpers', () => {
  const now = Date.parse('2026-10-10T12:00:00Z');
  it('formats relative times', () => {
    expect(timeAgo(null, now)).toBe('never');
    expect(timeAgo('2026-10-10T11:59:40Z', now)).toBe('just now');
    expect(timeAgo('2026-10-10T11:57:00Z', now)).toBe('3 minutes ago');
    expect(timeAgo('2026-10-10T09:00:00Z', now)).toBe('3 hours ago');
    expect(timeAgo('2026-10-08T12:00:00Z', now)).toBe('2 days ago');
  });

  it('formats month-over-month change', () => {
    expect(formatChange(0.123)).toBe('+12%');
    expect(formatChange(-0.08)).toBe('−8%');
  });
});
