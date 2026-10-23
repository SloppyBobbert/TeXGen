import { afterEach, expect, test, vi } from "vitest";
import { connect, getCatalog, renderDocument } from "./api";
import { createDocument } from "./document";

const health = {
  status: "ready",
  version: "0.1.0",
  pdfCompilation: "disabled",
  compilerReason: "The compiler is not verified.",
};

afterEach(() => {
  vi.unstubAllGlobals();
  window.history.replaceState(null, "", "/");
});

test("launch secrets leave the URL before the authorized request", async () => {
  const token = "a".repeat(64);
  window.history.replaceState(null, "", `/#launch=${token}`);
  const request = vi.fn().mockImplementation(async (url: string) => {
    expect(window.location.hash).toBe("");
    return url === "/api/session"
      ? new Response(null, { status: 204 })
      : new Response(JSON.stringify(health));
  });
  vi.stubGlobal("fetch", request);
  expect(await connect()).toEqual(health);
  expect(request.mock.calls[0][0]).toBe("/api/session");
  expect(request.mock.calls[0][1].headers.Authorization).toBe(
    `Bearer ${token}`,
  );
  expect(request.mock.calls[1][1].headers.Authorization).toBeUndefined();
});

test("invalid launch links do not send requests", async () => {
  window.history.replaceState(null, "", "/#launch=invalid");
  const request = vi.fn();
  vi.stubGlobal("fetch", request);
  await expect(connect()).rejects.toThrow("invalid");
  expect(request).not.toHaveBeenCalled();
  expect(window.location.hash).toBe("");
});

test("a refused session does not become ready", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(new Response(null, { status: 401 })),
  );
  await expect(connect()).rejects.toThrow("unavailable");
});

test("document requests retain protected headers, credentials, revision, and cancellation", async () => {
  const document = createDocument("api-doc", 2, {
    paper: "A4",
    columns: 2,
    marginsMm: 5,
    fontPt: 9,
    spacingPt: 1,
    columnGapMm: 3,
  });
  const signal = new AbortController().signal;
  const reply = { documentId: document.id, revision: 12, source: "SOURCE" };
  const request = vi
    .fn()
    .mockResolvedValue(new Response(JSON.stringify(reply)));
  vi.stubGlobal("fetch", request);
  expect(await renderDocument(document, 12, signal)).toEqual(reply);
  const [url, options] = request.mock.calls[0];
  expect(url).toBe("/api/render");
  expect(options).toMatchObject({
    signal,
    credentials: "same-origin",
    cache: "no-store",
    method: "POST",
    headers: { "X-TeXGen-Client": "1", "Content-Type": "application/json" },
  });
  expect(JSON.parse(options.body)).toEqual({ document, revision: 12 });
  request.mockResolvedValueOnce(
    new Response(JSON.stringify({ ...reply, revision: 11 })),
  );
  await expect(renderDocument(document, 12, signal)).rejects.toThrow(
    "does not match",
  );
  await expect(renderDocument(document, -1, signal)).rejects.toThrow(
    "revision",
  );
});

test("catalog requests validate the response and use the cancellation signal", async () => {
  const signal = new AbortController().signal;
  const request = vi
    .fn()
    .mockResolvedValue(new Response('{"version":1,"subjects":[]}'));
  vi.stubGlobal("fetch", request);
  await expect(getCatalog(signal)).rejects.toThrow("invalid");
  expect(request.mock.calls[0]).toEqual([
    "/api/catalog",
    {
      signal,
      credentials: "same-origin",
      cache: "no-store",
      headers: { "X-TeXGen-Client": "1" },
    },
  ]);
});

test("only an explicit enabled health response permits compiler availability", async () => {
  const fetch = vi
    .fn()
    .mockResolvedValueOnce(
      new Response(JSON.stringify({ ...health, pdfCompilation: "enabled" })),
    )
    .mockResolvedValueOnce(
      new Response(JSON.stringify({ ...health, pdfCompilation: "unknown" })),
    );
  vi.stubGlobal("fetch", fetch);
  expect((await connect()).pdfCompilation).toBe("enabled");
  await expect(connect()).rejects.toThrow("invalid");
});

test("invalid health responses fail validation", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(new Response('{"status":"ready"}')),
  );
  await expect(connect()).rejects.toThrow("invalid");
});
