import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { App } from "./App";
import { connect, getCatalog } from "./api";
import { type Catalog } from "./catalog";
import { createBrowserSession } from "./browser-session";
import { createDocument } from "./document";
import { DRAFT_KEY } from "./draft";
import { COMPACT_CANDIDATE, Editor } from "./Editor";
import { PdfPreview } from "./PdfPreview";

export function BrowserApp() {
  const [session] = useState(createBrowserSession);
  const snapshot = useSyncExternalStore(session.subscribe, session.getSnapshot);
  const [connection, setConnection] = useState<{
    state: "connecting" | "ready" | "error";
    message: string;
  }>({
    state: "connecting",
    message: "Connect to the local server.",
  });
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [compilerEnabled, setCompilerEnabled] = useState(false);
  const pending = useRef<AbortController | null>(null);
  const refresh = useCallback(async () => {
    pending.current?.abort();
    const controller = new AbortController();
    pending.current = controller;
    setCompilerEnabled(false);
    setConnection({
      state: "connecting",
      message: "Connect to the local server.",
    });
    try {
      const health = await connect(controller.signal);
      const catalog = await getCatalog(controller.signal);
      if (pending.current !== controller || controller.signal.aborted) return;
      setCatalog(catalog);
      setCompilerEnabled(health.pdfCompilation === "enabled");
      setConnection({
        state: "ready",
        message: `The protected server is ready. Version ${health.version}.`,
      });
    } catch (error) {
      if (pending.current !== controller || controller.signal.aborted) return;
      setConnection({
        state: "error",
        message:
          error instanceof Error ? error.message : "The connection failed.",
      });
    }
  }, []);

  useEffect(() => {
    session.start();
    const storage = (event: StorageEvent) => {
      if (event.key === DRAFT_KEY || event.key === null)
        session.refreshReader();
    };
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (session.getSnapshot().dirty) event.preventDefault();
    };
    const pageShow = (event: PageTransitionEvent) => {
      if (event.persisted) session.start();
    };
    window.addEventListener("storage", storage);
    window.addEventListener("beforeunload", beforeUnload);
    window.addEventListener("pagehide", session.stop);
    window.addEventListener("pageshow", pageShow);
    return () => {
      session.stop();
      window.removeEventListener("storage", storage);
      window.removeEventListener("beforeunload", beforeUnload);
      window.removeEventListener("pagehide", session.stop);
      window.removeEventListener("pageshow", pageShow);
    };
  }, [session]);

  useEffect(() => {
    void refresh();
    return () => {
      pending.current?.abort();
    };
  }, [refresh]);

  return (
    <App
      {...connection}
      compilerEnabled={compilerEnabled}
      onRetry={() => void refresh()}
    >
      <Editor
        snapshot={snapshot}
        catalog={catalog}
        actions={session}
        onCreate={(allowance) =>
          session.replace(
            createDocument(crypto.randomUUID(), allowance, COMPACT_CANDIDATE),
          )
        }
        preview={
          <PdfPreview
            document={snapshot.document}
            revision={snapshot.revision}
            writable={snapshot.ownership === "writer"}
            enabled={compilerEnabled && connection.state === "ready"}
          />
        }
      />
    </App>
  );
}
