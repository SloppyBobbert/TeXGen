import type {
  PDFDocumentLoadingTask,
  PDFDocumentProxy,
  PDFWorker,
} from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

export interface LoadedPdf {
  document: PDFDocumentProxy;
  close(): void;
}

export async function openPdf(
  bytes: Uint8Array,
  signal: AbortSignal,
): Promise<LoadedPdf> {
  if (!bytes.length || bytes.length > 10 * 1024 * 1024)
    throw new Error("The PDF exceeds the input limit or is empty.");
  signal.throwIfAborted();
  const pdfjs = await import("pdfjs-dist");
  signal.throwIfAborted();
  // An explicit port prevents fallback to parsing on the editor's main thread.
  const port = new Worker(workerUrl, { type: "module", name: "texgen-pdf" });
  let worker: PDFWorker | undefined;
  let loading: PDFDocumentLoadingTask | undefined;
  let closed = false;
  let rejectInterrupted: (error: Error) => void = () => {};
  const interrupted = new Promise<never>((_, reject) => {
    rejectInterrupted = reject;
  });
  const timer = setTimeout(() => {
    rejectInterrupted(
      new Error("The PDF verification timed out. The source is unchanged."),
    );
    close();
  }, 30_000);
  function abort() {
    rejectInterrupted(
      new DOMException("PDF verification was cancelled.", "AbortError"),
    );
    close();
  }
  function close() {
    if (closed) return;
    closed = true;
    clearTimeout(timer);
    signal.removeEventListener("abort", abort);
    try {
      if (loading) void loading.destroy().catch(() => {});
      worker?.destroy();
    } finally {
      port.terminate();
    }
  }
  signal.addEventListener("abort", abort, { once: true });
  try {
    worker = pdfjs.PDFWorker.create({ port });
    loading = pdfjs.getDocument({
      // The worker transfers this copy; keep the export bytes attached.
      data: bytes.slice(),
      worker,
      stopAtErrors: true,
      useWasm: false,
      useSystemFonts: false,
      enableXfa: false,
    });
    const verified = loading.promise.then(async (document) => {
      if (!Number.isSafeInteger(document.numPages) || document.numPages < 1)
        throw new Error("The PDF has an invalid page count.");
      for (let index = 1; index <= document.numPages; index++) {
        signal.throwIfAborted();
        if (closed) throw new Error("PDF verification stopped.");
        const page = await document.getPage(index);
        const viewport = page.getViewport({ scale: 1 });
        if (
          ![viewport.width, viewport.height].every(
            (value) => Number.isFinite(value) && value > 0,
          )
        )
          throw new Error("The PDF has invalid page dimensions.");
        await page.getOperatorList();
        page.cleanup();
      }
      return document;
    });
    const document = await Promise.race([verified, interrupted]);
    signal.throwIfAborted();
    clearTimeout(timer);
    // Later edits must not destroy the retained last valid PDF.
    signal.removeEventListener("abort", abort);
    return { document, close };
  } catch (error) {
    close();
    throw error;
  }
}
