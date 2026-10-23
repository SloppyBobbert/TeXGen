import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { openPdf } from "./pdf";

const mocks = vi.hoisted(() => ({
  getDocument: vi.fn(),
  create: vi.fn(),
  terminate: vi.fn(),
  destroyWorker: vi.fn(),
  destroyLoading: vi.fn(),
}));
vi.mock("pdfjs-dist", () => ({
  PDFWorker: { create: mocks.create },
  getDocument: mocks.getDocument,
}));

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal(
    "Worker",
    class {
      terminate = mocks.terminate;
    },
  );
  mocks.create.mockReturnValue({ destroy: mocks.destroyWorker });
  mocks.destroyLoading.mockResolvedValue(undefined);
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

function candidate(pages = 2) {
  const operators = vi.fn().mockResolvedValue({});
  const getPage = vi.fn().mockResolvedValue({
    getViewport: () => ({ width: 595.28, height: 841.89 }),
    getOperatorList: operators,
    cleanup: vi.fn(),
  });
  const document = { numPages: pages, getPage };
  mocks.getDocument.mockReturnValue({
    promise: Promise.resolve(document),
    destroy: mocks.destroyLoading,
  });
  return { document, getPage, operators };
}

test("PDF parsing uses a dedicated worker and checks every page without consuming export bytes", async () => {
  const fake = candidate();
  const bytes = new Uint8Array([1, 2, 3]);
  const controller = new AbortController();
  const result = await openPdf(bytes, controller.signal);
  expect(result.document).toBe(fake.document);
  expect(fake.getPage.mock.calls).toEqual([[1], [2]]);
  expect(fake.operators).toHaveBeenCalledTimes(2);
  expect(mocks.getDocument.mock.calls[0][0]).toMatchObject({
    stopAtErrors: true,
    useWasm: false,
    useSystemFonts: false,
    enableXfa: false,
  });
  expect(mocks.getDocument.mock.calls[0][0].data).not.toBe(bytes);
  expect(Array.from(bytes)).toEqual([1, 2, 3]);
  controller.abort();
  expect(mocks.terminate).not.toHaveBeenCalled();
  result.close();
  result.close();
  await vi.waitFor(() => expect(mocks.terminate).toHaveBeenCalledTimes(1));
});

test("document destruction finishes before its worker is terminated", async () => {
  candidate();
  let finish!: () => void;
  mocks.destroyLoading.mockReturnValueOnce(
    new Promise<void>((resolve) => {
      finish = resolve;
    }),
  );
  const result = await openPdf(
    new Uint8Array([1]),
    new AbortController().signal,
  );
  result.close();
  result.close();
  expect(mocks.destroyLoading).toHaveBeenCalledOnce();
  expect(mocks.destroyWorker).not.toHaveBeenCalled();
  expect(mocks.terminate).not.toHaveBeenCalled();
  finish();
  await vi.waitFor(() => expect(mocks.terminate).toHaveBeenCalledOnce());
  expect(mocks.destroyWorker).toHaveBeenCalledOnce();
});

test("stalled document destruction has a bounded worker termination fallback", async () => {
  vi.useFakeTimers();
  candidate();
  mocks.destroyLoading.mockReturnValueOnce(new Promise(() => {}));
  const result = await openPdf(
    new Uint8Array([1]),
    new AbortController().signal,
  );
  result.close();
  expect(mocks.terminate).not.toHaveBeenCalled();
  await vi.advanceTimersByTimeAsync(1_000);
  expect(mocks.destroyWorker).toHaveBeenCalledOnce();
  expect(mocks.terminate).toHaveBeenCalledOnce();
  result.close();
  await vi.advanceTimersByTimeAsync(30_000);
  expect(mocks.terminate).toHaveBeenCalledOnce();
});

test("failed document destruction still terminates its worker", async () => {
  candidate();
  mocks.destroyLoading.mockRejectedValueOnce(new Error("Worker failed"));
  const result = await openPdf(
    new Uint8Array([1]),
    new AbortController().signal,
  );
  result.close();
  await vi.waitFor(() => expect(mocks.terminate).toHaveBeenCalledOnce());
  expect(mocks.destroyWorker).toHaveBeenCalledOnce();
});

test("empty or oversized candidates never create a parser", async () => {
  for (const bytes of [
    new Uint8Array(),
    new Uint8Array(10 * 1024 * 1024 + 1),
  ]) {
    await expect(openPdf(bytes, new AbortController().signal)).rejects.toThrow(
      "limit",
    );
  }
  expect(mocks.create).not.toHaveBeenCalled();
});

test("cancellation rejects a suspended parser and terminates its worker", async () => {
  mocks.getDocument.mockReturnValue({
    promise: new Promise(() => {}),
    destroy: mocks.destroyLoading,
  });
  const controller = new AbortController();
  const result = openPdf(new Uint8Array([1]), controller.signal);
  const check = expect(result).rejects.toMatchObject({ name: "AbortError" });
  await vi.waitFor(() => expect(mocks.getDocument).toHaveBeenCalled());
  controller.abort();
  await check;
  await vi.waitFor(() => expect(mocks.terminate).toHaveBeenCalledTimes(1));
});

test("bad page metadata is rejected and its worker is cleaned", async () => {
  candidate(0);
  await expect(
    openPdf(new Uint8Array([1]), new AbortController().signal),
  ).rejects.toThrow("page");
  expect(mocks.destroyLoading).toHaveBeenCalledTimes(1);
  await vi.waitFor(() => expect(mocks.terminate).toHaveBeenCalledTimes(1));
});

test("an error on a later page cannot publish a partially checked PDF", async () => {
  const fake = candidate();
  fake.operators
    .mockResolvedValueOnce({})
    .mockRejectedValueOnce(new Error("The page is malformed."));
  await expect(
    openPdf(new Uint8Array([1]), new AbortController().signal),
  ).rejects.toThrow("malformed");
  await vi.waitFor(() => expect(mocks.terminate).toHaveBeenCalledTimes(1));
});
