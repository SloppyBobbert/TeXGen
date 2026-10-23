import { type RenderedSource } from "./api";
import { decodeDocument, encodeDocument, type Document } from "./document";
import { type Draft } from "./draft";

export interface SessionIO {
  readDraft: () => Draft;
  writeDraft: (draft: Draft) => void;
  withWriter:
    ((callback: (granted: boolean) => Promise<void>) => Promise<void>) | null;
  readFile: (file: File, signal: AbortSignal) => Promise<string>;
  render: (
    document: Document,
    revision: number,
    signal: AbortSignal,
  ) => Promise<RenderedSource>;
  download: (name: string, type: string, source: string) => void;
}

export interface EditorSnapshot {
  document: Document | null;
  replaced: Document | null;
  revision: number;
  replacement: number;
  ownership: "checking" | "writer" | "readonly";
  ownershipMessage: string;
  dirty: boolean;
  error: string;
  status: string;
  busy: boolean;
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : "The operation failed.";
}

export class EditorSession {
  private state: EditorSnapshot = {
    document: null,
    replaced: null,
    revision: 0,
    replacement: 0,
    ownership: "checking",
    ownershipMessage: "Check draft ownership.",
    dirty: false,
    error: "",
    status: "No document is open.",
    busy: false,
  };
  private listeners = new Set<() => void>();
  private lifecycle = 0;
  private running = false;
  private release: (() => void) | null = null;
  private operation = 0;
  private controller: AbortController | null = null;

  constructor(private io: SessionIO) {}

  getSnapshot = () => this.state;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  private publish(update: Partial<EditorSnapshot>) {
    this.state = { ...this.state, ...update };
    this.listeners.forEach((listener) => listener());
  }

  private invalidate() {
    this.operation++;
    this.controller?.abort();
    this.controller = null;
  }

  start = () => {
    this.stop();
    this.running = true;
    const lifecycle = this.lifecycle;
    if (this.state.dirty) {
      this.publish({
        ownershipMessage:
          "Read-only: export the unsaved document before you reload this tab.",
      });
      return;
    }
    if (!this.reloadDraft()) return;
    if (!this.io.withWriter) {
      this.publish({
        ownershipMessage:
          "Read-only: Web Locks are unavailable. This tab cannot save or replace the draft.",
      });
      return;
    }
    this.publish({
      ownership: "checking",
      ownershipMessage: "Check draft ownership.",
    });
    void this.io
      .withWriter(async (granted) => {
        if (!this.running || lifecycle !== this.lifecycle) return;
        if (!granted) {
          this.publish({
            ownership: "readonly",
            ownershipMessage:
              "Read-only: another tab owns this draft. Close that tab before you request editing.",
          });
          return;
        }
        // Reload under the lock so a waiting reader cannot overwrite a newer draft.
        if (!this.reloadDraft()) return;
        await new Promise<void>((resolve) => {
          this.release = resolve;
          this.publish({
            ownership: "writer",
            ownershipMessage: "This tab owns the editable draft.",
          });
        });
      })
      .catch((error: unknown) => {
        if (this.running && lifecycle === this.lifecycle) {
          this.invalidate();
          this.release = null;
          this.publish({
            ownership: "readonly",
            busy: false,
            ownershipMessage: "Read-only: draft ownership failed.",
            error: message(error),
          });
        }
      });
  };

  stop = () => {
    this.running = false;
    this.lifecycle++;
    this.invalidate();
    this.release?.();
    this.release = null;
    this.publish({
      ownership: "readonly",
      busy: false,
      ownershipMessage: "The editor does not own a writer lock.",
    });
  };

  private reloadDraft(): boolean {
    try {
      const draft = this.io.readDraft();
      this.invalidate();
      this.publish({
        document: draft.active,
        replaced: draft.replaced,
        revision: this.state.revision + 1,
        replacement: this.state.replacement + 1,
        dirty: false,
        error: "",
        busy: false,
        status: draft.active
          ? "The browser draft loaded. Export JSON for a portable backup."
          : "Select a page allowance to create a document.",
      });
      return true;
    } catch (error) {
      this.publish({
        ownership: "readonly",
        ownershipMessage:
          "Read-only: the stored draft could not load. Its contents remain unchanged.",
        error: message(error),
      });
      return false;
    }
  }

  refreshReader = () => {
    if (
      this.running &&
      this.state.ownership === "readonly" &&
      !this.state.dirty
    )
      this.reloadDraft();
  };

  private requireWriter() {
    if (!this.running || this.state.ownership !== "writer")
      throw new Error(
        "This tab is read-only. Request editing before you change the document.",
      );
  }

  edit = (change: (document: Document) => Document) => {
    try {
      this.requireWriter();
      if (!this.state.document) throw new Error("Create a document first.");
      const document = decodeDocument(change(this.state.document));
      this.invalidate();
      this.publish({
        document,
        revision: this.state.revision + 1,
        dirty: true,
        error: "",
        busy: false,
      });
      this.save();
    } catch (error) {
      this.publish({ error: message(error) });
    }
  };

  save = () => {
    try {
      this.requireWriter();
      this.io.writeDraft({
        version: 1,
        active: this.state.document,
        replaced: this.state.replaced,
      });
      this.publish({
        dirty: false,
        error: "",
        status:
          "Draft recovery saved in this browser. Export JSON for a portable backup.",
      });
    } catch (error) {
      this.publish({
        dirty: true,
        error:
          "Draft save failed. Export JSON before you close this tab. " +
          message(error),
      });
    }
  };

  replace = (input: Document) => {
    try {
      this.requireWriter();
      const document = decodeDocument(input);
      this.invalidate();
      const replaced = this.state.document ?? this.state.replaced;
      // One atomic write preserves the old document before memory changes.
      this.io.writeDraft({ version: 1, active: document, replaced });
      this.publish({
        document,
        replaced,
        revision: this.state.revision + 1,
        replacement: this.state.replacement + 1,
        dirty: false,
        error: "",
        busy: false,
        status:
          "The document opened. The previous document remains in replacement recovery.",
      });
    } catch (error) {
      this.publish({
        busy: false,
        error:
          "Replacement stopped because recovery could not save. The current document is unchanged. Export JSON. " +
          message(error),
      });
    }
  };

  restore = () => {
    if (this.state.replaced) this.replace(this.state.replaced);
  };

  editRaw = (source: string) => {
    this.edit((document) => {
      if (document.content.mode !== "raw")
        throw new Error("Open the raw editor before you edit source.");
      return { ...document, content: { mode: "raw", source } };
    });
  };

  private saveMode(document: Document) {
    this.requireWriter();
    const validated = decodeDocument(document);
    // Mode recovery and active content save together; replacement recovery is separate.
    this.io.writeDraft({
      version: 1,
      active: validated,
      replaced: this.state.replaced,
    });
    this.invalidate();
    this.publish({
      document: validated,
      revision: this.state.revision + 1,
      replacement: this.state.replacement + 1,
      dirty: false,
      error: "",
      busy: false,
      status:
        "The mode changed. The previous content is saved as mode recovery.",
    });
  }

  toRaw = async (confirm: () => boolean) => {
    let pending: ReturnType<EditorSession["begin"]> | null = null;
    try {
      this.requireWriter();
      const document = this.state.document;
      if (!document || document.content.mode !== "structured")
        throw new Error("A structured document is required.");
      pending = this.begin();
      const { tag, signal } = pending;
      const recovery = document.modeRecovery;
      const saved = recovery?.content;
      const result =
        saved?.mode === "raw"
          ? {
              documentId: document.id,
              revision: tag.revision,
              source: saved.source,
            }
          : await this.io.render(document, tag.revision, signal);
      if (!this.current(tag)) return;
      if (result.documentId !== document.id || result.revision !== tag.revision)
        throw new Error(
          "The source response does not match this document revision.",
        );
      const converted = decodeDocument({
        ...document,
        layout:
          recovery && saved?.mode === "raw" ? recovery.layout : document.layout,
        content: { mode: "raw", source: result.source },
        modeRecovery: { layout: document.layout, content: document.content },
      });
      if (confirm() && this.current(tag)) this.saveMode(converted);
    } catch (error) {
      if (!pending || this.current(pending.tag))
        this.publish({
          error:
            "Mode change stopped. The current document is unchanged. Export JSON. " +
            message(error),
        });
    } finally {
      if (pending && this.current(pending.tag)) this.publish({ busy: false });
    }
  };

  toStructured = (confirm: () => boolean) => {
    try {
      this.requireWriter();
      const document = this.state.document;
      const recovery = document?.modeRecovery;
      if (
        document?.content.mode !== "raw" ||
        recovery?.content.mode !== "structured"
      )
        throw new Error(
          "No structured recovery copy exists. Keep this raw document or create a new document.",
        );
      const { tag } = this.begin();
      if (confirm() && this.current(tag))
        this.saveMode({
          ...document,
          layout: recovery.layout,
          content: recovery.content,
          modeRecovery: { layout: document.layout, content: document.content },
        });
    } catch (error) {
      this.publish({
        error:
          "Mode change stopped. The current document is unchanged. Export JSON. " +
          message(error),
      });
    } finally {
      this.publish({ busy: false });
    }
  };

  exportJson = () => {
    try {
      if (!this.state.document) throw new Error("No document is open.");
      this.io.download(
        "texgen-document.json",
        "application/json",
        encodeDocument(this.state.document),
      );
    } catch (error) {
      this.publish({ error: message(error) });
    }
  };

  private begin() {
    this.invalidate();
    const tag = {
      operation: this.operation,
      revision: this.state.revision,
      documentId: this.state.document?.id ?? null,
    };
    const controller = new AbortController();
    this.controller = controller;
    this.publish({ busy: true, error: "" });
    return { tag, signal: controller.signal };
  }

  private current(tag: {
    operation: number;
    revision: number;
    documentId: string | null;
  }) {
    return (
      this.running &&
      tag.operation === this.operation &&
      tag.revision === this.state.revision &&
      tag.documentId === (this.state.document?.id ?? null)
    );
  }

  importFile = async (file: File, confirm: () => boolean) => {
    try {
      this.requireWriter();
    } catch (error) {
      this.publish({ error: message(error) });
      return;
    }
    const { tag, signal } = this.begin();
    try {
      // Pretty JSON and whitespace can exceed the compact canonical byte count.
      if (file.size > 8_000_000)
        throw new Error("The import file exceeds 8 MB.");
      const source = await this.io.readFile(file, signal);
      if (!this.current(tag)) return;
      let value: unknown;
      try {
        value = JSON.parse(source);
      } catch {
        throw new Error("The import file is not valid JSON.");
      }
      const document = decodeDocument(value);
      if (confirm() && this.current(tag)) this.replace(document);
    } catch (error) {
      if (this.current(tag))
        this.publish({
          error:
            "Import failed. The current document is unchanged. " +
            message(error),
        });
    } finally {
      if (this.current(tag)) this.publish({ busy: false });
    }
  };

  exportTex = async () => {
    const document = this.state.document;
    if (!document || !this.running) return;
    const { tag, signal } = this.begin();
    try {
      const result =
        document.content.mode === "raw"
          ? {
              documentId: document.id,
              revision: tag.revision,
              source: document.content.source,
            }
          : await this.io.render(document, tag.revision, signal);
      if (!this.current(tag)) return;
      if (result.documentId !== document.id || result.revision !== tag.revision)
        throw new Error(
          "The source response does not match this document revision.",
        );
      this.io.download(
        "texgen-document.tex",
        "application/x-tex",
        result.source,
      );
      this.publish({
        status: `TeX exported for revision ${tag.revision}. No PDF layout check ran.`,
      });
    } catch (error) {
      if (this.current(tag)) this.publish({ error: message(error) });
    } finally {
      if (this.current(tag)) this.publish({ busy: false });
    }
  };
}
