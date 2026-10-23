import { useEffect, useRef, useState } from "react";
import type { RenderTask } from "pdfjs-dist";
import type { LoadedPdf } from "./pdf";

export function PdfPage({ pdf, page }: { pdf: LoadedPdf; page: number }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let current = true;
    let task: RenderTask | undefined;
    const element = canvas.current;
    if (element) {
      delete element.dataset.renderedPage;
      element.setAttribute("aria-busy", "true");
    }
    setError("");
    void (async () => {
      const source = await pdf.document.getPage(page);
      if (!current || !element) return;
      const original = source.getViewport({ scale: 1 });
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      const scale =
        Math.min(760 / original.width, 1100 / original.height, 1.5) * ratio;
      const viewport = source.getViewport({ scale });
      if (
        ![viewport.width, viewport.height].every(
          (value) => Number.isFinite(value) && value > 0,
        ) ||
        viewport.width * viewport.height > 4_000_000
      )
        throw new Error("This page exceeds the preview canvas limit.");
      element.width = Math.ceil(viewport.width);
      element.height = Math.ceil(viewport.height);
      if (!element.getContext("2d"))
        throw new Error("The browser cannot create a PDF canvas.");
      task = source.render({ canvas: element, viewport });
      await task.promise;
      if (current) {
        element.dataset.renderedPage = String(page);
        element.setAttribute("aria-busy", "false");
      }
    })().catch((failure: unknown) => {
      if (current)
        setError(
          failure instanceof Error
            ? failure.message
            : "The page could not be rendered.",
        );
    });
    return () => {
      current = false;
      task?.cancel();
      if (element) {
        delete element.dataset.renderedPage;
        element.width = 0;
        element.height = 0;
      }
    };
  }, [pdf, page]);
  return (
    <div className="pdf-page">
      {error ? (
        <p role="alert">{error} The source and retained PDF are unchanged.</p>
      ) : null}
      <canvas
        ref={canvas}
        role="img"
        aria-label={`PDF page ${page}`}
        hidden={!!error}
      />
    </div>
  );
}
