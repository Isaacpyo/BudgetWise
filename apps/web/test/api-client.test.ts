import { describe, expect, it, vi } from 'vitest';
import { ApiError, createApiClient, errorMessage } from '../src/lib/api-client';
import { createApiStatusStore } from '../src/lib/api-status';

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function client(fetchImpl: typeof fetch, token: string | null = 'id-token') {
  return createApiClient({
    baseUrl: 'https://api.example',
    getToken: async () => token,
    status: createApiStatusStore(),
    fetch: fetchImpl,
    sleep: async () => {},
  });
}

describe('api client', () => {
  it('sends the Firebase ID token and JSON body', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(json(200, { budget: { category: 'groceries', limitCents: 5000 } }));
    await client(fetchMock).setBudget('groceries', 5000);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('https://api.example/v1/budgets/groceries');
    expect(init.method).toBe('PUT');
    expect(init.headers).toMatchObject({
      Authorization: 'Bearer id-token',
      'Content-Type': 'application/json',
    });
    expect(JSON.parse(init.body)).toEqual({ limitCents: 5000 });
  });

  it('omits Authorization when signed out', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(json(200, { ok: true, provider: 'mock', version: '1' }));
    await client(fetchMock, null).health();
    expect(fetchMock.mock.calls[0]![1].headers).not.toHaveProperty('Authorization');
  });

  it('retries while Render is booting (502/503/504)', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response('', { status: 503 }))
      .mockResolvedValueOnce(new Response('', { status: 502 }))
      .mockResolvedValueOnce(json(200, { customToken: 't', reseeded: false }));
    await expect(client(fetchMock).demoSession()).resolves.toEqual({
      customToken: 't',
      reseeded: false,
    });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('surfaces API error bodies as ApiError', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        json(400, { error: { code: 'VALIDATION_ERROR', message: 'Budget must be at least $1' } }),
      );
    const err = await client(fetchMock)
      .setBudget('groceries', 1)
      .catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err).toMatchObject({
      status: 400,
      code: 'VALIDATION_ERROR',
      message: 'Budget must be at least $1',
    });
    expect(errorMessage(err)).toBe('Budget must be at least $1');
  });

  it('never retries a failed POST on network errors (exchanges are single-use)', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));
    const err = await client(fetchMock)
      .exchange({ publicToken: 'public-sandbox-123' })
      .catch((e: unknown) => e);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(err).toMatchObject({ code: 'NETWORK' });
  });

  it('retries idempotent requests on network errors', async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    await expect(client(fetchMock).deleteBudget('groceries')).resolves.toBeUndefined();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
