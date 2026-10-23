import { afterEach, expect, test, vi } from "vitest";
import { cancelCompilation, compileDocument } from "./api";
import { createDocument } from "./document";

const document = createDocument("pdf-doc", 2, {
  paper: "A4",
  columns: 2,
  marginsMm: 5,
  fontPt: 9,
  spacingPt: 1,
  columnGapMm: 3,
});
const requestId = "a".repeat(64);
function reply(bytes = new Uint8Array([1, 2, 3]), revision = "3") {
  return new Response(bytes, {
    headers: {
      "Content-Type": "application/pdf",
      "X-TeXGen-Document-Id": document.id,
      "X-TeXGen-Revision": revision,
      "X-TeXGen-Request-Id": requestId,
    },
  });
}
afterEach(() => vi.unstubAllGlobals());

test("compile and cancel retain protected credentials and operation identity", async () => {
  const fetch = vi
    .fn()
    .mockResolvedValueOnce(reply())
    .mockResolvedValueOnce(new Response(null, { status: 204 }));
  vi.stubGlobal("fetch", fetch);
  const signal = new AbortController().signal;
  expect(
    Array.from(await compileDocument(document, 3, requestId, signal)),
  ).toEqual([1, 2, 3]);
  const [url, options] = fetch.mock.calls[0];
  expect(url).toBe("/api/compile");
  expect(options).toMatchObject({
    signal,
    credentials: "same-origin",
    cache: "no-store",
    headers: { "X-TeXGen-Client": "1" },
  });
  expect(JSON.parse(options.body)).toEqual({
    document,
    revision: 3,
    requestId,
  });
  await cancelCompilation(requestId);
  expect(fetch.mock.calls[1][0]).toBe("/api/compile/cancel");
  expect(JSON.parse(fetch.mock.calls[1][1].body)).toEqual({ requestId });
});

test("a stale response or oversized body cannot become a PDF candidate", async () => {
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockResolvedValueOnce(reply(undefined, "2"))
      .mockResolvedValueOnce(reply(new Uint8Array(10 * 1024 * 1024 + 1))),
  );
  await expect(
    compileDocument(document, 3, requestId, new AbortController().signal),
  ).rejects.toThrow("operation");
  await expect(
    compileDocument(document, 3, requestId, new AbortController().signal),
  ).rejects.toThrow("limit");
});

test("invalid operation identities do not reach the server", async () => {
  const fetch = vi.fn();
  vi.stubGlobal("fetch", fetch);
  await expect(
    compileDocument(document, -1, requestId, new AbortController().signal),
  ).rejects.toThrow("identity");
  await expect(cancelCompilation("not-an-id")).rejects.toThrow("identity");
  expect(fetch).not.toHaveBeenCalled();
});

test("compiler diagnostics remain a bounded error rather than PDF bytes", async () => {
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockResolvedValue(
        new Response(
          JSON.stringify({ error: "The formula did not compile." }),
          { status: 422 },
        ),
      ),
  );
  await expect(
    compileDocument(document, 3, requestId, new AbortController().signal),
  ).rejects.toThrow("formula");
});
