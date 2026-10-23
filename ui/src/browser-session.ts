import { renderDocument } from "./api";
import { DRAFT_KEY, decodeDraft, encodeDraft } from "./draft";
import { EditorSession } from "./editor-session";

function readFile(file: File, signal: AbortSignal): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    const abort = () => reader.abort();
    if (signal.aborted) {
      reject(new Error("The file read was cancelled."));
      return;
    }
    reader.onload = () => {
      if (typeof reader.result === "string") resolve(reader.result);
      else reject(new Error("The file did not contain text."));
    };
    reader.onerror = () =>
      reject(new Error("The import file could not be read."));
    reader.onabort = () => reject(new Error("The file read was cancelled."));
    reader.onloadend = () => signal.removeEventListener("abort", abort);
    signal.addEventListener("abort", abort, { once: true });
    reader.readAsText(file);
  });
}

export function download(name: string, type: string, source: BlobPart) {
  const url = URL.createObjectURL(new Blob([source], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  document.body.append(link);
  try {
    link.click();
  } finally {
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}

export function createBrowserSession(): EditorSession {
  let locks: LockManager | undefined;
  try {
    locks = navigator.locks;
  } catch {
    /* Missing locks must fail read-only. */
  }
  return new EditorSession({
    readDraft: () => decodeDraft(window.localStorage.getItem(DRAFT_KEY)),
    writeDraft: (draft) =>
      window.localStorage.setItem(DRAFT_KEY, encodeDraft(draft)),
    withWriter: locks
      ? async (callback) => {
          await locks.request(
            DRAFT_KEY,
            { mode: "exclusive", ifAvailable: true },
            async (lock) => {
              await callback(lock !== null);
            },
          );
        }
      : null,
    readFile,
    render: renderDocument,
    download,
  });
}
