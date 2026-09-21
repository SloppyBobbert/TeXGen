function checkCancelled(signal) {
  if (signal?.aborted) throw signal.reason ?? new globalThis.DOMException('Request cancelled', 'AbortError');
}

export function createApiClient({ getSession = () => ({ tokens: null }), refreshSession } = {}) {
  let refreshPromise = null;

  function refresh() {
    if (refreshPromise) return refreshPromise;
    const session = getSession();
    if (!session.tokens?.refresh || !refreshSession) return Promise.resolve(false);
    refreshPromise = Promise.resolve().then(() => refreshSession(session)).finally(() => {
      refreshPromise = null;
    });
    return refreshPromise;
  }

  async function request(url, options = {}) {
    if (typeof url !== 'string' || !url.startsWith('/api/')) {
      throw new Error('API requests must use same-origin /api/ paths.');
    }
    checkCancelled(options.signal);
    const original = getSession();
    const send = (session) => {
      const headers = { ...options.headers };
      for (const name of Object.keys(headers)) {
        if (name.toLowerCase() === 'authorization') delete headers[name];
      }
      if (session.tokens?.access) headers.Authorization = `Bearer ${session.tokens.access}`;
      return fetch(url, { ...options, headers });
    };
    const response = await send(original);
    const method = (options.method ?? 'GET').toUpperCase();
    if (response.status !== 401 || !['GET', 'HEAD'].includes(method) || !original.tokens?.refresh) return response;
    checkCancelled(options.signal);
    if (getSession().version !== original.version) return response;
    // Another request may already have refreshed this session while this read was pending.
    if (getSession().tokens?.access === original.tokens.access && !await refresh()) return response;
    checkCancelled(options.signal);
    const current = getSession();
    if (current.version !== original.version || !current.tokens?.access) return response;
    return send(current);
  }

  return { request, refresh };
}
