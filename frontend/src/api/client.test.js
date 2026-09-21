import { afterEach, describe, expect, it, vi } from 'vitest';
import { createApiClient } from './client';

afterEach(() => vi.unstubAllGlobals());
const deferred = () => {
  let resolve;
  const promise = new Promise((next) => { resolve = next; });
  return { promise, resolve };
};

function fixture(refresh) {
  let session = { version: 1, tokens: { access: 'old', refresh: 'refresh-token' } };
  const refreshSession = vi.fn(async (original) => {
    await refresh?.();
    if (session.version !== original.version) return false;
    session = { ...session, tokens: { ...session.tokens, access: 'new' } };
    return true;
  });
  const client = createApiClient({ getSession: () => session, refreshSession });
  return { ...client, refreshSession, changeSession: (next) => { session = next; } };
}

describe('API request policy', () => {
  it('shares one refresh for concurrent reads and retries each read only once', async () => {
    const pending = deferred();
    const client = fixture(() => pending.promise);
    const fetch = vi.fn(async (_url, options) => ({ status: options.headers.Authorization === 'Bearer old' ? 401 : 200 }));
    vi.stubGlobal('fetch', fetch);
    const first = client.request('/api/cheatsheets/');
    const second = client.request('/api/cheatsheets/');
    await vi.waitFor(() => expect(client.refreshSession).toHaveBeenCalledTimes(1));
    pending.resolve();
    expect((await first).status).toBe(200);
    expect((await second).status).toBe(200);
    expect(fetch).toHaveBeenCalledTimes(4);
    expect(client.refreshSession).toHaveBeenCalledTimes(1);
  });

  it.each(['POST', 'PATCH', 'PUT', 'DELETE'])('never refreshes or replays an unsafe %s request', async (method) => {
    const client = fixture();
    const response = { status: 401 };
    const fetch = vi.fn().mockResolvedValue(response);
    vi.stubGlobal('fetch', fetch);
    expect(await client.request('/api/compile/', { method, body: 'source' })).toBe(response);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(client.refreshSession).not.toHaveBeenCalled();
  });

  it('returns the second 401 without a refresh loop', async () => {
    const client = fixture();
    const fetch = vi.fn().mockResolvedValue({ status: 401 });
    vi.stubGlobal('fetch', fetch);
    expect((await client.request('/api/cheatsheets/')).status).toBe(401);
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(client.refreshSession).toHaveBeenCalledTimes(1);
  });

  it('does not retry an aborted read after shared refresh', async () => {
    const pending = deferred();
    const client = fixture(() => pending.promise);
    const controller = new globalThis.AbortController();
    const fetch = vi.fn().mockResolvedValue({ status: 401 });
    vi.stubGlobal('fetch', fetch);
    const request = client.request('/api/cheatsheets/', { signal: controller.signal });
    const rejection = expect(request).rejects.toMatchObject({ name: 'AbortError' });
    await vi.waitFor(() => expect(client.refreshSession).toHaveBeenCalledOnce());
    controller.abort();
    pending.resolve();
    await rejection;
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('does not replay an old read with a new login session', async () => {
    const pending = deferred();
    const client = fixture(() => pending.promise);
    const fetch = vi.fn().mockResolvedValue({ status: 401 });
    vi.stubGlobal('fetch', fetch);
    const request = client.request('/api/cheatsheets/');
    await vi.waitFor(() => expect(client.refreshSession).toHaveBeenCalledOnce());
    client.changeSession({ version: 2, tokens: { access: 'other-user' } });
    pending.resolve();
    expect((await request).status).toBe(401);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('does not retry network errors or refresh anonymous requests', async () => {
    const client = fixture();
    client.changeSession({ version: 2, tokens: null });
    const fetch = vi.fn().mockRejectedValueOnce(new TypeError('Network unavailable')).mockResolvedValue({ status: 401 });
    vi.stubGlobal('fetch', fetch);
    await expect(client.request('/api/cheatsheets/')).rejects.toThrow('Network unavailable');
    expect((await client.request('/api/cheatsheets/')).status).toBe(401);
    expect(client.refreshSession).not.toHaveBeenCalled();
    expect(fetch.mock.calls[1][1].headers).not.toHaveProperty('Authorization');
  });

  it('rejects external URLs before attaching credentials', async () => {
    const client = fixture();
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    await expect(client.request('https://example.com/api/')).rejects.toThrow('same-origin');
    expect(fetch).not.toHaveBeenCalled();
  });
});
