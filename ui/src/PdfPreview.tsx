import { useCallback, useEffect, useRef, useState } from "react";
import { cancelCompilation, compileDocument } from "./api";
import { download } from "./browser-session";
import type { Document } from "./document";
import { openPdf, type LoadedPdf } from "./pdf";
import { PdfPage } from "./PdfPage";

interface Retained {
  id: string;
  revision: number;
  allowance: number;
  bytes: Uint8Array<ArrayBuffer>;
  pdf: LoadedPdf;
}
interface Pending {
  id: string;
  controller: AbortController;
}

export function PdfPreview({
  document,
  revision,
  writable,
  enabled,
}: {
  document: Document | null;
  revision: number;
  writable: boolean;
  enabled: boolean;
}) {
  const [retained, setRetained] = useState<Retained | null>(null);
  const [page, setPage] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [exportError, setExportError] = useState("");
  const pending = useRef<Pending | null>(null);
  const saved = useRef<Retained | null>(null);
  const mounted = useRef(false);
  const sequence = useRef(0);
  const latest = useRef({ id: document?.id, revision, writable, enabled });
  latest.current = { id: document?.id, revision, writable, enabled };
  const cancel = useCallback(() => {
    const operation = pending.current;
    if (!operation) return;
    pending.current = null;
    const cancelledSequence = sequence.current;
    operation.controller.abort();
    if (mounted.current) setBusy(false);
    void cancelCompilation(operation.id).catch((failure: unknown) => {
      if (
        mounted.current &&
        sequence.current === cancelledSequence &&
        !pending.current
      )
        setError(
          failure instanceof Error
            ? failure.message
            : "Cancellation could not be confirmed.",
        );
    });
  }, []);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      cancel();
      saved.current?.pdf.close();
    };
  }, [cancel]);
  useEffect(() => {
    cancel();
  }, [document?.id, revision, writable, enabled, cancel]);

  async function compile() {
    if (!document || !enabled || !writable || pending.current) return;
    const id = Array.from(crypto.getRandomValues(new Uint8Array(32)), (byte) =>
      byte.toString(16).padStart(2, "0"),
    ).join("");
    const operation = { id, controller: new AbortController() };
    pending.current = operation;
    sequence.current++;
    setBusy(true);
    setError("");
    const current = () =>
      mounted.current &&
      pending.current === operation &&
      !operation.controller.signal.aborted &&
      latest.current.id === document.id &&
      latest.current.revision === revision &&
      latest.current.writable &&
      latest.current.enabled;
    let candidate: LoadedPdf | undefined;
    try {
      const bytes = await compileDocument(
        document,
        revision,
        id,
        operation.controller.signal,
      );
      if (!current()) return;
      candidate = await openPdf(bytes, operation.controller.signal);
      if (!current()) {
        candidate.close();
        return;
      }
      const next = {
        id: document.id,
        revision,
        allowance: document.pageAllowance,
        bytes,
        pdf: candidate,
      };
      const previous = saved.current;
      saved.current = next;
      setRetained(next);
      setPage(1);
      previous?.pdf.close();
    } catch (failure) {
      candidate?.close();
      if (current())
        setError(
          failure instanceof Error
            ? failure.message
            : "PDF compilation failed.",
        );
    } finally {
      if (pending.current === operation) {
        pending.current = null;
        if (mounted.current) setBusy(false);
      }
    }
  }
  const outdated =
    retained !== null &&
    (retained.id !== document?.id || retained.revision !== revision);
  const pages = retained?.pdf.document.numPages ?? 0;
  return (
    <section className="preview-panel" aria-labelledby="pdf-heading">
      <header className="preview-toolbar">
        <h2 id="pdf-heading">PDF preview and export</h2>
        {!enabled ? (
          <p>
            PDF compilation is disabled. Start with --compiler and an available
            verified local runtime to opt in.
          </p>
        ) : null}
        <div className="actions">
          <button
            className="primary-button"
            disabled={!document || !enabled || !writable || busy}
            onClick={() => void compile()}
          >
            Compile PDF
          </button>
          <button disabled={!busy} onClick={cancel}>
            Cancel compilation
          </button>
          <button
            disabled={!retained}
            onClick={() => {
              if (
                retained &&
                (!outdated ||
                  window.confirm(
                    "Export the outdated PDF? It does not match the current document revision.",
                  ))
              ) {
                try {
                  download(
                    "texgen-document.pdf",
                    "application/pdf",
                    retained.bytes,
                  );
                  setExportError("");
                } catch (failure) {
                  setExportError(
                    failure instanceof Error
                      ? failure.message
                      : "The download could not start.",
                  );
                }
              }
            }}
          >
            Export PDF
          </button>
        </div>
      </header>
      {busy ? (
        <p role="status">
          Compilation or PDF verification is in progress. Editing cancels this
          result.
        </p>
      ) : null}
      {error ? (
        <p role="alert">{error} The source and last valid PDF are unchanged.</p>
      ) : null}
      {exportError ? (
        <p role="alert">
          PDF export failed. {exportError} The last valid PDF is still
          available. Select Export PDF to try again.
        </p>
      ) : null}
      {retained ? (
        <>
          <p role="status">
            Retained PDF: document {retained.id}, revision {retained.revision}.
            Actual page count: {pages}.
          </p>
          {outdated ? (
            <p role="alert">
              This PDF is outdated. Compile the current document before you use
              it.
            </p>
          ) : null}
          {pages > retained.allowance ? (
            <p role="alert">
              The PDF exceeds its page allowance of {retained.allowance}. All{" "}
              {pages} pages are retained. No content was removed or resized.
            </p>
          ) : null}
          <p>
            Parser checks passed. This is not a visual layout check. Inspect
            formulas for clipping or overlap, especially after raw TeX edits.
          </p>
          <p>
            The preview is scaled to fit. The exported PDF keeps its original
            pages and dimensions.
          </p>
          <div className="actions">
            <button
              disabled={page <= 1}
              onClick={() => setPage((value) => value - 1)}
            >
              Previous page
            </button>
            <label>
              PDF page{" "}
              <input
                type="number"
                min="1"
                max={pages}
                step="1"
                value={page}
                onChange={(event) => {
                  const value = Number(event.target.value);
                  if (
                    Number.isSafeInteger(value) &&
                    value >= 1 &&
                    value <= pages
                  )
                    setPage(value);
                }}
              />
            </label>
            <span>of {pages}</span>
            <button
              disabled={page >= pages}
              onClick={() => setPage((value) => value + 1)}
            >
              Next page
            </button>
          </div>
          <PdfPage pdf={retained.pdf} page={page} />
        </>
      ) : (
        <div className="pdf-empty">
          <span className="empty-sheet" aria-hidden="true">
            📄
          </span>
          <h3>Your PDF will appear here</h3>
          <p>No verified PDF is retained yet.</p>
          <p className="muted">
            Build your document, then select Compile PDF. Every page stays in
            the preview and export.
          </p>
        </div>
      )}
    </section>
  );
}
