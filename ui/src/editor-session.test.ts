import { afterEach, expect, test, vi } from "vitest";
import { insertBlock } from "./blocks";
import { createDocument, decodeDocument, type Document } from "./document";
import { decodeDraft, encodeDraft } from "./draft";
import { EditorSession, type SessionIO } from "./editor-session";

const layout = {
  paper: "A4",
  columns: 2,
  marginsMm: 5,
  fontPt: 9,
  spacingPt: 1,
  columnGapMm: 3,
} as const;
const document = () => createDocument("doc", 3, layout);
const sessions: EditorSession[] = [];
afterEach(() => {
  sessions.splice(0).forEach((session) => session.stop());
});

function locks() {
  let held = false;
  return async (callback: (granted: boolean) => Promise<void>) => {
    if (held) {
      await callback(false);
      return;
    }
    held = true;
    try {
      await callback(true);
    } finally {
      held = false;
    }
  };
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
function setup(
  active: Document | null = document(),
  withWriter: SessionIO["withWriter"] = locks(),
) {
  let stored = encodeDraft({ version: 1, active, replaced: null });
  const io: SessionIO = {
    readDraft: vi.fn(() => decodeDraft(stored)),
    writeDraft: vi.fn((draft) => {
      stored = encodeDraft(draft);
    }),
    withWriter,
    readFile: vi.fn(async () => JSON.stringify(document())),
    render: vi.fn(async (document, revision) => ({
      documentId: document.id,
      revision,
      source: "TEX",
    })),
    download: vi.fn(),
  };
  const session = new EditorSession(io);
  sessions.push(session);
  session.start();
  return { session, io, stored: () => decodeDraft(stored) };
}
const file = () =>
  new File(["{}"], "document.json", { type: "application/json" });

test("the atomic draft envelope is distinct from the portable document", () => {
  const original = document();
  expect(
    decodeDraft(
      encodeDraft({ version: 1, active: original, replaced: original }),
    ),
  ).toEqual({ version: 1, active: original, replaced: original });
  expect(decodeDraft(null).active).toBeNull();
  for (const bad of [
    "{",
    "[]",
    '{"version":2,"active":null,"replaced":null}',
    JSON.stringify(original),
  ])
    expect(() => decodeDraft(bad)).toThrow();
  expect(() =>
    decodeDocument({ ...original, replacedDocument: original }),
  ).toThrow();
});

test("accepted edits save content and all layout values for reload", () => {
  const { session, io, stored } = setup();
  session.edit((document) =>
    insertBlock(
      {
        ...document,
        title: "Notes",
        pageAllowance: 5,
        layout: {
          paper: "A4",
          columns: 3,
          marginsMm: 7,
          fontPt: 8.5,
          spacingPt: 0.5,
          columnGapMm: 2,
        },
      },
      { kind: "math", id: "math", latex: "x=1\\\\y=2" },
    ),
  );
  expect(session.getSnapshot().dirty).toBe(false);
  expect(stored().active).toEqual(session.getSnapshot().document);
  session.stop();
  const loaded = new EditorSession({ ...io, withWriter: null });
  sessions.push(loaded);
  loaded.start();
  expect(loaded.getSnapshot().document).toEqual(session.getSnapshot().document);
});

test("save failures preserve edits, show export, and permit a later retry", () => {
  const { session, io, stored } = setup();
  vi.mocked(io.writeDraft).mockImplementationOnce(() => {
    throw new Error("Storage quota");
  });
  session.edit((document) => ({ ...document, title: "Unsaved title" }));
  expect(session.getSnapshot().document?.title).toBe("Unsaved title");
  expect(stored().active?.title).toBe("");
  expect(session.getSnapshot().dirty).toBe(true);
  expect(session.getSnapshot().error).toContain("Export JSON");
  session.exportJson();
  expect(vi.mocked(io.download).mock.calls[0][2]).toContain("Unsaved title");
  session.save();
  expect(stored().active?.title).toBe("Unsaved title");
  expect(session.getSnapshot().dirty).toBe(false);
});

test("Clear/Import recovery save failure stops replacement and preserves the previous slot", () => {
  const { session, io, stored } = setup();
  session.replace({ ...document(), id: "second" });
  session.edit((document) => ({ ...document, title: "Keep this edit" }));
  const before = session.getSnapshot();
  const saved = stored();
  vi.mocked(io.writeDraft).mockImplementationOnce(() => {
    throw new Error("Storage denied");
  });
  session.replace({ ...document(), id: "third" });
  expect(session.getSnapshot().document).toEqual(before.document);
  expect(session.getSnapshot().replaced).toEqual(before.replaced);
  expect(session.getSnapshot().revision).toBe(before.revision);
  expect(stored()).toEqual(saved);
  expect(session.getSnapshot().error).toContain("Replacement stopped");
});

test("replacement recovers even unsaved in-memory edits and restore swaps the two copies", () => {
  const { session, io, stored } = setup();
  vi.mocked(io.writeDraft).mockImplementationOnce(() => {
    throw new Error("Quota");
  });
  session.edit((document) => ({ ...document, title: "Unwritten edit" }));
  session.replace({ ...document(), id: "new" });
  expect(stored().replaced?.title).toBe("Unwritten edit");
  session.restore();
  expect(stored().active?.title).toBe("Unwritten edit");
  expect(stored().replaced?.id).toBe("new");
});

test("JSON export preserves raw source and mode recovery but excludes the replacement slot", async () => {
  const { session, io, stored } = setup({
    ...document(),
    title: "UNRELATED_REPLACEMENT",
  });
  const raw = {
    ...document(),
    content: { mode: "raw", source: "  % raw\r\n\\unknown{é}\n" },
    modeRecovery: {
      layout,
      content: {
        mode: "structured",
        blocks: [{ kind: "text", id: "saved", text: "MODE_RECOVERY" }],
      },
    },
  };
  vi.mocked(io.readFile).mockResolvedValueOnce(JSON.stringify(raw));
  await session.importFile(file(), () => true);
  const exported = session.getSnapshot().document;
  expect(exported).toEqual(raw);
  expect(stored().active).toEqual(raw);
  session.exportJson();
  const json = vi.mocked(io.download).mock.calls[0][2];
  expect(decodeDocument(JSON.parse(json))).toEqual(raw);
  expect(json).not.toContain("UNRELATED_REPLACEMENT");
  await session.exportTex();
  expect(io.render).not.toHaveBeenCalled();
  expect(vi.mocked(io.download).mock.calls[1][2]).toBe(raw.content.source);
});

test.each(["not JSON", '{"version":99}', '{"version":1}'])(
  "invalid import leaves the active document and storage unchanged: %s",
  async (source) => {
    const { session, io, stored } = setup();
    const before = session.getSnapshot().document;
    vi.mocked(io.readFile).mockResolvedValueOnce(source);
    const confirm = vi.fn(() => true);
    await session.importFile(file(), confirm);
    expect(session.getSnapshot().document).toEqual(before);
    expect(stored().active).toEqual(before);
    expect(confirm).not.toHaveBeenCalled();
    expect(io.writeDraft).not.toHaveBeenCalled();
    expect(session.getSnapshot().error).toContain("Import failed");
  },
);

test("a cancelled import and a failed file read do not replace the draft", async () => {
  const { session, io } = setup();
  await session.importFile(file(), () => false);
  expect(io.writeDraft).not.toHaveBeenCalled();
  vi.mocked(io.readFile).mockRejectedValueOnce(new Error("Read denied"));
  await session.importFile(file(), () => true);
  expect(io.writeDraft).not.toHaveBeenCalled();
  expect(session.getSnapshot().error).toContain("Read denied");
});

test("oversized import is refused before the file read", async () => {
  const { session, io } = setup();
  await session.importFile(
    new File([new Uint8Array(8_000_001)], "large.json"),
    () => true,
  );
  expect(io.readFile).not.toHaveBeenCalled();
  expect(session.getSnapshot().error).toContain("8 MB");
});

test("missing Web Locks and a denied lock remain read-only", () => {
  for (const withWriter of [
    null,
    async (callback: (granted: boolean) => Promise<void>) => callback(false),
  ]) {
    const { session, io } = setup(document(), withWriter);
    session.edit((document) => ({ ...document, title: "Forbidden" }));
    session.replace(document());
    expect(session.getSnapshot().ownership).toBe("readonly");
    expect(session.getSnapshot().document?.title).toBe("");
    expect(io.writeDraft).not.toHaveBeenCalled();
    session.exportJson();
    expect(io.download).toHaveBeenCalledOnce();
  }
});

test("two tabs cannot write at once and a new owner reloads the latest draft", async () => {
  const withWriter = vi.fn(locks());
  const { session: first, io } = setup(document(), withWriter);
  const second = new EditorSession(io);
  sessions.push(second);
  second.start();
  expect(second.getSnapshot().ownership).toBe("readonly");
  first.edit((document) => ({ ...document, title: "Newest" }));
  second.edit((document) => ({ ...document, title: "Stale writer" }));
  expect(first.getSnapshot().document?.title).toBe("Newest");
  first.stop();
  await withWriter.mock.results[0].value;
  second.start();
  expect(second.getSnapshot().ownership).toBe("writer");
  expect(second.getSnapshot().document?.title).toBe("Newest");
});

test("storage notifications update readers but never overwrite the writer's unsaved edits", () => {
  const { session, io } = setup();
  const second = new EditorSession(io);
  sessions.push(second);
  second.start();
  session.edit((document) => ({ ...document, title: "Saved" }));
  second.refreshReader();
  expect(second.getSnapshot().document?.title).toBe("Saved");
  vi.mocked(io.writeDraft).mockImplementationOnce(() => {
    throw new Error("Quota");
  });
  session.edit((document) => ({ ...document, title: "Only in memory" }));
  session.refreshReader();
  expect(session.getSnapshot().document?.title).toBe("Only in memory");
});

test("unreadable storage fails closed without writes", () => {
  const { session, io } = setup();
  vi.mocked(io.readDraft).mockImplementation(() => {
    throw new Error("Corrupt record");
  });
  session.stop();
  session.start();
  session.replace(document());
  expect(session.getSnapshot().ownership).toBe("readonly");
  expect(io.writeDraft).not.toHaveBeenCalled();
});

test("lock request rejection fails read-only", async () => {
  const { session } = setup(document(), async () => {
    throw new Error("Lock service denied");
  });
  await Promise.resolve();
  expect(session.getSnapshot().ownership).toBe("readonly");
  expect(session.getSnapshot().error).toContain("Lock service denied");
});

test("a late lock grant cannot revive a disposed session", async () => {
  let grant!: (granted: boolean) => Promise<void>;
  const { session, io } = setup(document(), async (callback) => {
    grant = callback;
  });
  session.stop();
  await grant(true);
  expect(session.getSnapshot().ownership).toBe("readonly");
  expect(io.writeDraft).not.toHaveBeenCalled();
});

test.each(["replace", "edit", "stop"] as const)(
  "%s invalidates pending file reads",
  async (action) => {
    const { session, io } = setup();
    const read = deferred<string>();
    vi.mocked(io.readFile).mockReturnValueOnce(read.promise);
    const confirm = vi.fn(() => true);
    const pending = session.importFile(file(), confirm);
    if (action === "replace")
      session.replace({ ...document(), id: "replacement" });
    else if (action === "edit")
      session.edit((document) => ({
        ...document,
        title: "Edited during import",
      }));
    else session.stop();
    const expected = session.getSnapshot().document;
    expect(vi.mocked(io.readFile).mock.calls[0][1].aborted).toBe(true);
    read.resolve(JSON.stringify({ ...document(), title: "Stale import" }));
    await pending;
    expect(session.getSnapshot().document).toEqual(expected);
    expect(confirm).not.toHaveBeenCalled();
  },
);

test("same-ID import increments the revision and invalidates older rendering", async () => {
  const { session, io } = setup();
  const response = deferred<{
    documentId: string;
    revision: number;
    source: string;
  }>();
  const before = session.getSnapshot().revision;
  vi.mocked(io.render).mockReturnValueOnce(response.promise);
  const pending = session.exportTex();
  await session.importFile(file(), () => true);
  expect(session.getSnapshot().document?.id).toBe("doc");
  expect(session.getSnapshot().revision).toBeGreaterThan(before);
  expect(vi.mocked(io.render).mock.calls[0][2].aborted).toBe(true);
  response.resolve({ documentId: "doc", revision: before, source: "STALE" });
  await pending;
  expect(io.download).not.toHaveBeenCalled();
});

test("request ownership rejects an earlier result even at the same document revision", async () => {
  const { session, io } = setup();
  const response = deferred<{
    documentId: string;
    revision: number;
    source: string;
  }>();
  const revision = session.getSnapshot().revision;
  vi.mocked(io.render).mockReturnValueOnce(response.promise);
  const first = session.exportTex();
  await session.exportTex();
  response.resolve({ documentId: "doc", revision, source: "STALE" });
  await first;
  expect(io.download).toHaveBeenCalledTimes(1);
  expect(vi.mocked(io.download).mock.calls[0][2]).toBe("TEX");
});

test("wrong response identity, render failure, and session disposal cannot export stale TeX", async () => {
  const { session, io } = setup();
  vi.mocked(io.render).mockResolvedValueOnce({
    documentId: "wrong",
    revision: 0,
    source: "BAD",
  });
  await session.exportTex();
  expect(io.download).not.toHaveBeenCalled();
  expect(session.getSnapshot().error).toContain("does not match");
  vi.mocked(io.render).mockRejectedValueOnce(new Error("Server unavailable"));
  await session.exportTex();
  expect(session.getSnapshot().document).toEqual(document());
  const response = deferred<{
    documentId: string;
    revision: number;
    source: string;
  }>();
  const revision = session.getSnapshot().revision;
  vi.mocked(io.render).mockReturnValueOnce(response.promise);
  const pending = session.exportTex();
  session.stop();
  response.resolve({ documentId: "doc", revision, source: "LATE" });
  await pending;
  expect(io.download).not.toHaveBeenCalled();
});

const manualSource = "  % manual\r\n\\\\unknown{é}\n";

async function rawSession() {
  const context = setup({ ...document(), title: "Separate replacement" });
  context.session.replace(document());
  await context.session.toRaw(() => true);
  context.session.editRaw(manualSource);
  return context;
}

test("mode changes save recovery atomically, preserve the separate slot, and restore manual raw source without regeneration", async () => {
  const { session, io, stored } = setup();
  session.replace({ ...document(), id: "active" });
  const structured = session.getSnapshot().document!;
  const replaced = session.getSnapshot().replaced;
  const before = session.getSnapshot().revision;
  await session.toRaw(() => true);
  expect(stored().active?.content).toEqual({ mode: "raw", source: "TEX" });
  expect(stored().active?.modeRecovery).toEqual({
    layout,
    content: structured.content,
  });
  expect(stored().replaced).toEqual(replaced);
  expect(session.getSnapshot().revision).toBe(before + 1);
  expect(session.getSnapshot().ownership).toBe("writer");
  session.editRaw(manualSource);
  const raw = session.getSnapshot().document!;
  session.toStructured(() => true);
  expect(stored().active?.content).toEqual(structured.content);
  expect(stored().active?.modeRecovery).toEqual({
    layout,
    content: raw.content,
  });
  session.edit((document) => ({
    ...document,
    layout: { ...layout, columns: 4 },
  }));
  await session.toRaw(() => true);
  expect(stored().active?.content).toEqual(raw.content);
  expect(stored().active?.layout).toEqual(layout);
  expect(stored().active?.modeRecovery?.layout.columns).toBe(4);
  expect(stored().replaced).toEqual(replaced);
  expect(io.render).toHaveBeenCalledOnce();
  session.stop();
  const loaded = new EditorSession({ ...io, withWriter: null });
  sessions.push(loaded);
  loaded.start();
  expect(loaded.getSnapshot().document).toEqual(stored().active);
});

test("both transition cancellations preserve active content, revision, recovery, and storage", async () => {
  const { session, io, stored } = setup();
  const before = session.getSnapshot();
  await session.toRaw(() => false);
  expect(session.getSnapshot().document).toEqual(before.document);
  expect(session.getSnapshot().revision).toBe(before.revision);
  expect(io.writeDraft).not.toHaveBeenCalled();
  await session.toRaw(() => true);
  session.editRaw(manualSource);
  const saved = stored();
  const revision = session.getSnapshot().revision;
  session.toStructured(() => false);
  expect(stored()).toEqual(saved);
  expect(session.getSnapshot().revision).toBe(revision);
  expect(session.getSnapshot().busy).toBe(false);
});

test.each(["raw", "structured"] as const)(
  "%s mode recovery-write failure stops conversion even with unsaved edits",
  async (target) => {
    const { session, io, stored } =
      target === "structured" ? await rawSession() : setup();
    vi.mocked(io.writeDraft).mockImplementation(() => {
      throw new Error("Quota");
    });
    if (target === "structured") session.editRaw(manualSource + "UNSAVED");
    else session.edit((document) => ({ ...document, title: "UNSAVED" }));
    const before = session.getSnapshot();
    const saved = stored();
    if (target === "raw") await session.toRaw(() => true);
    else session.toStructured(() => true);
    expect(session.getSnapshot().document).toEqual(before.document);
    expect(session.getSnapshot().replaced).toEqual(before.replaced);
    expect(session.getSnapshot().revision).toBe(before.revision);
    expect(session.getSnapshot().dirty).toBe(true);
    expect(session.getSnapshot().busy).toBe(false);
    expect(session.getSnapshot().error).toContain("Mode change stopped");
    expect(session.getSnapshot().error).toContain("Export JSON");
    expect(stored()).toEqual(saved);
    session.exportJson();
    expect(JSON.parse(vi.mocked(io.download).mock.calls[0][2])).toEqual(
      before.document,
    );
  },
);

test.each([
  null,
  { layout, content: { mode: "raw", source: "Other raw" } },
] as const)(
  "raw imports without structured recovery cannot return: %j",
  (modeRecovery) => {
    const { session, io } = setup({
      ...document(),
      content: { mode: "raw", source: manualSource },
      modeRecovery,
    });
    const confirm = vi.fn(() => true);
    session.toStructured(confirm);
    expect(confirm).not.toHaveBeenCalled();
    expect(io.writeDraft).not.toHaveBeenCalled();
    expect(session.getSnapshot().document?.content).toEqual({
      mode: "raw",
      source: manualSource,
    });
    expect(session.getSnapshot().error).toContain(
      "No structured recovery copy",
    );
  },
);

test("mode recovery survives JSON transfer in both directions without the replacement slot", async () => {
  const { session, io } = await rawSession();
  for (const mode of ["raw", "structured"] as const) {
    if (mode === "structured") session.toStructured(() => true);
    const expected = session.getSnapshot().document;
    session.exportJson();
    const json = vi.mocked(io.download).mock.lastCall![2];
    expect(json).not.toContain("Separate replacement");
    const target = setup();
    vi.mocked(target.io.readFile).mockResolvedValueOnce(json);
    await target.session.importFile(file(), () => true);
    expect(target.stored().active).toEqual(expected);
    if (mode === "raw") target.session.toStructured(() => true);
    else await target.session.toRaw(() => true);
    expect(
      target.session.getSnapshot().document?.modeRecovery?.content,
    ).toEqual(expected?.content);
  }
});

test.each(["edit", "replace", "same-id", "clear", "stop", "new-operation"])(
  "%s rejects a late conversion reply even when cancellation is ignored",
  async (action) => {
    const { session, io } = setup();
    const response = deferred<{
      documentId: string;
      revision: number;
      source: string;
    }>();
    const revision = session.getSnapshot().revision;
    vi.mocked(io.render).mockReturnValueOnce(response.promise);
    const confirm = vi.fn(() => true);
    const pending = session.toRaw(confirm);
    if (action === "edit")
      session.edit((document) => ({ ...document, title: "Edit" }));
    else if (action === "replace")
      session.replace({ ...document(), id: "replacement" });
    else if (action === "same-id") await session.importFile(file(), () => true);
    else if (action === "clear")
      session.replace(createDocument("clear", 2, layout));
    else if (action === "stop") session.stop();
    else await session.toRaw(() => true);
    const expected = session.getSnapshot().document;
    expect(vi.mocked(io.render).mock.calls[0][2].aborted).toBe(true);
    response.resolve({ documentId: "doc", revision, source: "STALE" });
    await pending;
    expect(session.getSnapshot().document).toEqual(expected);
    expect(confirm).not.toHaveBeenCalled();
  },
);

test("conversion validates render identity, source, size, and failures before confirmation", async () => {
  const { session, io } = setup();
  const revision = session.getSnapshot().revision;
  const confirm = vi.fn(() => true);
  for (const result of [
    { documentId: "wrong", revision, source: "BAD" },
    { documentId: "doc", revision: revision + 1, source: "BAD" },
    { documentId: "doc", revision, source: "x".repeat(500_001) },
    { documentId: "doc", revision, source: "bad\u0000" },
  ]) {
    vi.mocked(io.render).mockResolvedValueOnce(result);
    await session.toRaw(confirm);
    expect(session.getSnapshot().document).toEqual(document());
    expect(session.getSnapshot().busy).toBe(false);
  }
  vi.mocked(io.render).mockRejectedValueOnce(new Error("Offline"));
  await session.toRaw(confirm);
  expect(session.getSnapshot().error).toContain("Offline");
  expect(io.writeDraft).not.toHaveBeenCalled();
  expect(confirm).not.toHaveBeenCalled();
});

test("conversion refuses a combined source and recovery that exceed the canonical JSON limit", async () => {
  const original: Document = {
    ...document(),
    content: {
      mode: "structured",
      blocks: [0, 1, 2].map((index) => ({
        kind: "text",
        id: `text-${index}`,
        text: "x".repeat(180_000),
      })),
    },
  };
  const { session, io, stored } = setup(original);
  vi.mocked(io.render).mockResolvedValueOnce({
    documentId: original.id,
    revision: session.getSnapshot().revision,
    source: "x".repeat(480_000),
  });
  const confirm = vi.fn(() => true);
  await session.toRaw(confirm);
  expect(session.getSnapshot().document).toEqual(original);
  expect(stored().active).toEqual(original);
  expect(session.getSnapshot().error).toContain("1,000,000 JSON bytes");
  expect(confirm).not.toHaveBeenCalled();
  expect(io.writeDraft).not.toHaveBeenCalled();
});

test("raw edits enforce format limits and preserve in-memory source after a failed save", async () => {
  const { session, io, stored } = await rawSession();
  const before = session.getSnapshot().document;
  for (const source of ["x".repeat(500_001), "bad\u0000"]) {
    session.editRaw(source);
    expect(session.getSnapshot().document).toEqual(before);
  }
  vi.mocked(io.writeDraft).mockImplementationOnce(() => {
    throw new Error("Quota");
  });
  session.editRaw(manualSource + "incomplete{");
  expect(stored().active).toEqual(before);
  await session.exportTex();
  expect(vi.mocked(io.download).mock.lastCall![2]).toBe(
    manualSource + "incomplete{",
  );
  session.replace(createDocument("clear", 1, layout));
  expect(stored().replaced?.content).toEqual({
    mode: "raw",
    source: manualSource + "incomplete{",
  });
  session.restore();
  expect(stored().active?.modeRecovery).toEqual(before?.modeRecovery);
});

test("raw edits and both transitions require the retained writer lock", async () => {
  for (const active of [
    document(),
    {
      ...document(),
      content: { mode: "raw" as const, source: manualSource },
      modeRecovery: { layout, content: document().content },
    },
  ]) {
    const { session, io } = setup(active, null);
    await session.toRaw(() => true);
    session.toStructured(() => true);
    session.editRaw("Forbidden");
    expect(session.getSnapshot().document).toEqual(active);
    expect(io.render).not.toHaveBeenCalled();
    expect(io.writeDraft).not.toHaveBeenCalled();
  }
});

test("mode changes invalidate earlier file reads and raw edits keep invalidated imports out", async () => {
  const { session, io } = setup();
  for (const action of ["toRaw", "toStructured", "editRaw"] as const) {
    const read = deferred<string>();
    vi.mocked(io.readFile).mockReturnValueOnce(read.promise);
    const pending = session.importFile(file(), () => true);
    if (action === "toRaw") await session.toRaw(() => true);
    else if (action === "toStructured") session.toStructured(() => true);
    else {
      await session.toRaw(() => true);
      session.editRaw(manualSource);
    }
    const expected = session.getSnapshot().document;
    read.resolve(JSON.stringify({ ...document(), title: "Stale" }));
    await pending;
    expect(session.getSnapshot().document).toEqual(expected);
  }
});
