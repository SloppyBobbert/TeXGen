import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useYouTubeResources } from './youtubeResources';

const apiRequest = vi.hoisted(() => vi.fn());
vi.mock('./useApiRequest', () => ({ useApiRequest: () => apiRequest }));

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

const firstSearch = { key: 1, topics: ['old topic'] };
const nextSearch = { key: 2, topics: ['new topic'] };

beforeEach(() => {
  vi.useFakeTimers();
  apiRequest.mockReset();
});
afterEach(() => vi.useRealTimers());

describe('video response body cancellation', () => {
  for (const action of ['clear', 'replace', 'unmount']) {
    for (const outcome of ['resolve', 'abort', 'error']) {
      it(`ignores an old body that will ${outcome} after ${action}`, async () => {
        const body = deferred();
        apiRequest.mockResolvedValueOnce({ ok: true, json: () => body.promise });
        const { result, rerender, unmount } = renderHook(
          ({ search }) => useYouTubeResources(search),
          { initialProps: { search: firstSearch } },
        );
        await act(async () => { await vi.advanceTimersByTimeAsync(350); });
        expect(apiRequest).toHaveBeenCalledTimes(1);
        const signal = apiRequest.mock.calls[0][1].signal;
        expect(result.current.isLoading).toBe(true);

        if (action === 'unmount') unmount();
        else if (action === 'clear') rerender({ search: null });
        else {
          apiRequest.mockResolvedValueOnce({ ok: true, json: async () => ({ resources: [{ id: 'new' }] }) });
          rerender({ search: nextSearch });
          await act(async () => { await vi.advanceTimersByTimeAsync(350); });
          expect(result.current.resources).toEqual([{ id: 'new' }]);
        }
        expect(signal.aborted).toBe(true);
        const beforeOldBody = result.current;
        await act(async () => {
          if (outcome === 'resolve') body.resolve({ resources: [{ id: 'old' }] });
          else if (outcome === 'abort') body.reject(new window.DOMException('Stopped', 'AbortError'));
          else body.reject(new Error('Old body failed'));
          await Promise.resolve();
        });
        expect(result.current).toEqual(beforeOldBody);
        if (action !== 'unmount') {
          expect(result.current.error).toBe('');
          expect(result.current.isLoading).toBe(false);
          expect(result.current.resources).toEqual(action === 'replace' ? [{ id: 'new' }] : []);
        }
      });
    }
  }
});
