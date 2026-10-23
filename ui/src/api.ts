import { decodeCatalog, type Catalog } from "./catalog";
import { decodeDocument, type Document } from "./document";

export interface Health {
  status: "ready";
  version: string;
  pdfCompilation: "disabled" | "enabled";
  compilerReason: string;
}

const headers = { "X-TeXGen-Client": "1" };

export async function connect(signal?: AbortSignal): Promise<Health> {
  const token = new URLSearchParams(window.location.hash.slice(1)).get(
    "launch",
  );
  // Remove the launch secret before any request or UI update.
  window.history.replaceState(null, "", window.location.pathname);
  if (token !== null) {
    if (!/^[a-f0-9]{64}$/.test(token)) {
      throw new Error("The launch link is invalid. Restart the launcher.");
    }
    const response = await fetch("/api/session", {
      signal,
      method: "POST",
      credentials: "same-origin",
      cache: "no-store",
      headers: {
        ...headers,
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: "{}",
    });
    if (!response.ok) {
      throw new Error("The launch authorization failed. Restart the launcher.");
    }
  }
  const response = await fetch("/api/health", {
    signal,
    credentials: "same-origin",
    cache: "no-store",
    headers,
  });
  if (!response.ok) {
    throw new Error(
      "The protected session is unavailable. Restart the launcher.",
    );
  }
  const health: unknown = await response.json();
  if (
    typeof health !== "object" ||
    health === null ||
    !("status" in health) ||
    health.status !== "ready" ||
    !("version" in health) ||
    typeof health.version !== "string" ||
    !("pdfCompilation" in health) ||
    (health.pdfCompilation !== "disabled" &&
      health.pdfCompilation !== "enabled") ||
    !("compilerReason" in health) ||
    typeof health.compilerReason !== "string"
  ) {
    throw new Error("The server response is invalid.");
  }
  return health as Health;
}

export async function getCatalog(signal: AbortSignal): Promise<Catalog> {
  const response = await fetch("/api/catalog", {
    signal,
    credentials: "same-origin",
    cache: "no-store",
    headers,
  });
  if (!response.ok)
    throw new Error("The catalog request failed. Check the connection.");
  return decodeCatalog(await response.json());
}

export interface RenderedSource {
  documentId: string;
  revision: number;
  source: string;
}

export async function renderDocument(
  document: Document,
  revision: number,
  signal: AbortSignal,
): Promise<RenderedSource> {
  if (!Number.isSafeInteger(revision) || revision < 0)
    throw new Error("The session revision is invalid.");
  const response = await fetch("/api/render", {
    signal,
    method: "POST",
    credentials: "same-origin",
    cache: "no-store",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify({ document: decodeDocument(document), revision }),
  });
  if (!response.ok)
    throw new Error("TeX export failed. Check the connection and try again.");
  const value: unknown = await response.json();
  if (
    typeof value !== "object" ||
    value === null ||
    !("documentId" in value) ||
    value.documentId !== document.id ||
    !("revision" in value) ||
    value.revision !== revision ||
    !("source" in value) ||
    typeof value.source !== "string"
  )
    throw new Error(
      "The source response does not match this document revision.",
    );
  return { documentId: document.id, revision, source: value.source };
}

async function readBounded(
  response: Response,
  limit: number,
): Promise<Uint8Array<ArrayBuffer>> {
  if (!response.body) throw new Error("The response has no data.");
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > limit)
        throw new Error("The compiler response exceeds its byte limit.");
      chunks.push(value);
    }
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  return bytes;
}

export async function compileDocument(
  document: Document,
  revision: number,
  requestId: string,
  signal: AbortSignal,
): Promise<Uint8Array<ArrayBuffer>> {
  if (
    !Number.isSafeInteger(revision) ||
    revision < 0 ||
    !/^[a-f0-9]{64}$/.test(requestId)
  )
    throw new Error("The compilation request identity is invalid.");
  const response = await fetch("/api/compile", {
    signal,
    method: "POST",
    credentials: "same-origin",
    cache: "no-store",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify({
      document: decodeDocument(document),
      revision,
      requestId,
    }),
  });
  if (!response.ok) {
    let detail =
      "PDF compilation failed. The source and last valid PDF are unchanged.";
    const bytes = await readBounded(response, 512 * 1024);
    try {
      const value: unknown = JSON.parse(new TextDecoder().decode(bytes));
      if (
        typeof value === "object" &&
        value !== null &&
        "error" in value &&
        typeof value.error === "string"
      )
        detail = value.error;
    } catch {
      /* Keep the bounded generic error if the response is not JSON. */
    }
    throw new Error(detail);
  }
  if (
    response.headers.get("Content-Type")?.split(";")[0] !== "application/pdf" ||
    response.headers.get("X-TeXGen-Document-Id") !== document.id ||
    response.headers.get("X-TeXGen-Revision") !== String(revision) ||
    response.headers.get("X-TeXGen-Request-Id") !== requestId
  ) {
    await response.body?.cancel();
    throw new Error("The PDF response does not match this document operation.");
  }
  return readBounded(response, 10 * 1024 * 1024);
}

export async function cancelCompilation(requestId: string): Promise<void> {
  if (!/^[a-f0-9]{64}$/.test(requestId))
    throw new Error("The compilation request identity is invalid.");
  const response = await fetch("/api/compile/cancel", {
    method: "POST",
    credentials: "same-origin",
    cache: "no-store",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify({ requestId }),
  });
  if (!response.ok)
    throw new Error("The server did not confirm the cancellation request.");
}
