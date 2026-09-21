import { useContext } from 'react';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import AuthContext, { AuthProvider } from './AuthContext';

const deferred = () => {
  let resolve;
  const promise = new Promise((next) => { resolve = next; });
  return { promise, resolve };
};
const tokens = (username, revision = 0) => ({ access: `header.${globalThis.btoa(JSON.stringify({ username, revision }))}.signature`, refresh: `refresh-${username}` });
const response = (data, status = 200) => ({ ok: status < 400, status, json: async () => data });
function wrapper({ children }) {
  return <MemoryRouter><AuthProvider>{children}</AuthProvider></MemoryRouter>;
}

beforeEach(() => {
  vi.stubGlobal('alert', vi.fn());
  vi.stubGlobal('fetch', vi.fn());
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('authentication request lifetime', () => {
  it('refreshes a read with new credentials without storing tokens in browser storage', async () => {
    const write = vi.spyOn(globalThis.Storage.prototype, 'setItem');
    const renewed = { ...tokens('first', 1), refresh: 'rotated-refresh' };
    fetch.mockResolvedValueOnce(response(tokens('first')))
      .mockResolvedValueOnce(response({}, 401))
      .mockResolvedValueOnce(response(renewed))
      .mockResolvedValueOnce(response([]));
    const { result } = renderHook(() => useContext(AuthContext), { wrapper });
    await act(async () => { await result.current.loginUser('first', 'password'); });
    const request = result.current.apiRequest;
    await act(async () => { expect((await request('/api/cheatsheets/')).status).toBe(200); });
    expect(result.current.authTokens).toEqual(renewed);
    expect(result.current.apiRequest).toBe(request);
    expect(fetch.mock.calls[3][1].headers.Authorization).toBe(`Bearer ${renewed.access}`);
    expect(write).not.toHaveBeenCalled();
  });

  it('stops a hung refresh after ten seconds without replaying the read', async () => {
    vi.useFakeTimers();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    fetch.mockResolvedValueOnce(response(tokens('first')))
      .mockResolvedValueOnce(response({}, 401))
      .mockImplementationOnce((_url, { signal }) => new Promise((_resolve, reject) => {
        signal.addEventListener('abort', () => reject(signal.reason), { once: true });
      }));
    const { result } = renderHook(() => useContext(AuthContext), { wrapper });
    await act(async () => { await result.current.loginUser('first', 'password'); });
    let request;
    await act(async () => { request = result.current.apiRequest('/api/cheatsheets/'); });
    expect(fetch).toHaveBeenCalledTimes(3);
    await act(async () => { await vi.advanceTimersByTimeAsync(10000); await request; });
    expect(result.current.authTokens).toBeNull();
    expect(fetch).toHaveBeenCalledTimes(3);
  });

  it('does not restore a login that completes after logout', async () => {
    const pending = deferred();
    fetch.mockReturnValue(pending.promise);
    const { result } = renderHook(() => useContext(AuthContext), { wrapper });
    let login;
    act(() => { login = result.current.loginUser('first', 'password'); });
    act(() => result.current.logoutUser());
    await act(async () => {
      pending.resolve(response(tokens('first')));
      await login;
    });
    expect(result.current.authTokens).toBeNull();
    expect(result.current.user).toBeNull();
  });

  it('does not replace a newer login with an older response', async () => {
    const old = deferred();
    fetch.mockReturnValueOnce(old.promise).mockResolvedValueOnce(response(tokens('second')));
    const { result } = renderHook(() => useContext(AuthContext), { wrapper });
    let first;
    act(() => { first = result.current.loginUser('first', 'password'); });
    await act(async () => { await result.current.loginUser('second', 'password'); });
    await act(async () => { old.resolve(response(tokens('first'))); await first; });
    expect(result.current.user.username).toBe('second');
    expect(result.current.authTokens).toEqual(tokens('second'));
  });

  it('aborts pending authentication transport on unmount', async () => {
    const pending = deferred();
    fetch.mockReturnValue(pending.promise);
    const { result, unmount } = renderHook(() => useContext(AuthContext), { wrapper });
    let login;
    act(() => { login = result.current.loginUser('first', 'password'); });
    const signal = fetch.mock.calls[0][1].signal;
    unmount();
    pending.resolve(response(tokens('first')));
    await login;
    expect(signal?.aborted).toBe(true);
  });

  it('does not restore refreshed credentials or replay a read after logout', async () => {
    const pending = deferred();
    fetch.mockResolvedValueOnce(response(tokens('first')))
      .mockResolvedValueOnce(response({}, 401))
      .mockReturnValueOnce(pending.promise);
    const { result } = renderHook(() => useContext(AuthContext), { wrapper });
    await act(async () => { await result.current.loginUser('first', 'password'); });
    let request;
    act(() => { request = result.current.apiRequest('/api/cheatsheets/'); });
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(3));
    act(() => result.current.logoutUser());
    await act(async () => { pending.resolve(response(tokens('first'))); await request; });
    expect(result.current.user).toBeNull();
    expect(result.current.authTokens).toBeNull();
    expect(fetch).toHaveBeenCalledTimes(3);
  });
});
