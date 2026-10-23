import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { BrowserApp } from "./BrowserApp";
import { connect, getCatalog, renderDocument } from "./api";
import { decodeCatalog } from "./catalog";
import { createDocument } from "./document";
import { DRAFT_KEY, decodeDraft, encodeDraft } from "./draft";
import { COMPACT_CANDIDATE } from "./Editor";

vi.mock("./api", () => ({
  connect: vi.fn(),
  getCatalog: vi.fn(),
  renderDocument: vi.fn(),
}));
const catalog = {
  version: 1,
  subjects: [
    {
      id: "subject",
      label: "Algebra",
      categories: [
        {
          id: "topic",
          label: "Equations",
          formulas: [
            {
              id: "formula",
              label: "Example",
              body: { type: "math", latex: "a=b" },
            },
          ],
        },
      ],
    },
  ],
} as const;

beforeEach(() => {
  window.localStorage.clear();
  vi.mocked(connect).mockResolvedValue({
    status: "ready",
    version: "0.1.0",
    pdfCompilation: "disabled",
    compilerReason: "Unverified",
  });
  vi.mocked(getCatalog).mockResolvedValue(decodeCatalog(catalog));
  Object.defineProperty(navigator, "locks", {
    configurable: true,
    value: {
      request: async (
        _name: string,
        _options: unknown,
        callback: (lock: object) => Promise<void>,
      ) => callback({ name: DRAFT_KEY, mode: "exclusive" }),
    },
  });
  vi.spyOn(window, "confirm").mockReturnValue(true);
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.clearAllMocks();
  Reflect.deleteProperty(navigator, "locks");
});

async function open() {
  render(<BrowserApp />);
  await screen.findByText("The protected server is ready. Version 0.1.0.");
}
async function create() {
  await open();
  fireEvent.change(screen.getByLabelText("New document page allowance"), {
    target: { value: "3" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Create document" }));
  expect(screen.getByLabelText("Document title")).toBeDefined();
}
function active() {
  return decodeDraft(window.localStorage.getItem(DRAFT_KEY)).active!;
}

test("new-document controls are in the sidebar before and after creation", async () => {
  await open();
  const allowance = screen.getByLabelText<HTMLInputElement>(
    "New document page allowance",
  );
  expect(allowance.closest(".library-column")).not.toBeNull();
  expect(
    document.getElementById("document-heading")?.closest(".creation-form"),
  ).not.toBeNull();
  expect(allowance.checkValidity()).toBe(false);
  fireEvent.change(allowance, { target: { value: "2" } });
  fireEvent.click(screen.getByRole("button", { name: "Create document" }));
  const replacementAllowance = screen.getByLabelText<HTMLInputElement>(
    "New document page allowance",
  );
  expect(replacementAllowance.closest(".library-column")).not.toBeNull();
  expect(replacementAllowance.closest(".structured-controls")).toBeNull();
  expect(active().pageAllowance).toBe(2);
  expect(replacementAllowance.value).toBe("");
});

test("failed first-document creation keeps the selected allowance for retry", async () => {
  await open();
  const write = vi
    .spyOn(Storage.prototype, "setItem")
    .mockImplementation(() => {
      throw new Error("Quota exceeded");
    });
  fireEvent.change(screen.getByLabelText("New document page allowance"), {
    target: { value: "2" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Create document" }));
  expect(screen.getByText(/Replacement stopped/)).toBeDefined();
  expect(window.localStorage.getItem(DRAFT_KEY)).toBeNull();
  expect(
    screen.getByLabelText<HTMLInputElement>("New document page allowance")
      .value,
  ).toBe("2");
  write.mockRestore();
  fireEvent.click(screen.getByRole("button", { name: "Create document" }));
  expect(active().pageAllowance).toBe(2);
  expect(
    screen.getByLabelText<HTMLInputElement>("New document page allowance")
      .value,
  ).toBe("");
});

test("the document title sits above class controls without inheriting their disabled fieldset", async () => {
  await create();
  const title = screen.getByLabelText("Document title");
  expect(title.closest(".library-column")).not.toBeNull();
  expect(title.closest("fieldset")).toBeNull();
  expect(screen.getByRole("heading", { name: "Select classes" })).toBeDefined();
});

test("the preview remains mounted when the source workspace is created or replaced", async () => {
  await open();
  const preview = screen.getByRole("region", {
    name: "PDF preview and export",
  });
  fireEvent.change(screen.getByLabelText("New document page allowance"), {
    target: { value: "2" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Create document" }));
  expect(screen.getByRole("region", { name: "PDF preview and export" })).toBe(
    preview,
  );
  fireEvent.change(screen.getByLabelText("New document page allowance"), {
    target: { value: "3" },
  });
  fireEvent.click(
    screen.getByRole("button", { name: "Clear and create document" }),
  );
  expect(screen.getByRole("region", { name: "PDF preview and export" })).toBe(
    preview,
  );
  expect(active().pageAllowance).toBe(3);
});

test("new documents require an explicit page allowance and leave legacy keys unread and unchanged", async () => {
  window.localStorage.setItem("selectedFormulas", "legacy-formulas");
  window.localStorage.setItem("latex", "legacy-source");
  const reads = vi.spyOn(Storage.prototype, "getItem");
  await open();
  const allowance = screen.getByLabelText<HTMLInputElement>(
    "New document page allowance",
  );
  expect(allowance.value).toBe("");
  expect(allowance.checkValidity()).toBe(false);
  fireEvent.click(screen.getByRole("button", { name: "Create document" }));
  expect(window.localStorage.getItem(DRAFT_KEY)).toBeNull();
  fireEvent.change(allowance, { target: { value: "3" } });
  fireEvent.click(screen.getByRole("button", { name: "Create document" }));
  expect(reads.mock.calls.every(([key]) => key === DRAFT_KEY)).toBe(true);
  expect(active().pageAllowance).toBe(3);
  expect(active().layout.paper).toBe("A4");
  expect(window.localStorage.getItem("selectedFormulas")).toBe(
    "legacy-formulas",
  );
  expect(window.localStorage.getItem("latex")).toBe("legacy-source");
});

test("local formula edits, line breaks, custom content, movement, and topic removal use stable blocks", async () => {
  await create();
  fireEvent.click(screen.getByLabelText("Example"));
  fireEvent.change(screen.getByLabelText("Block 1 LaTeX"), {
    target: { value: "x=1\\\\y=2" },
  });
  const content = active().content;
  expect(content.mode === "structured" && content.blocks[0].id).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Add text block" }));
  fireEvent.change(screen.getByLabelText("Block 2 text"), {
    target: { value: "Keep my notes" },
  });
  const textId = screen
    .getByLabelText("Block 2 text")
    .closest("li")
    ?.getAttribute("data-block-id");
  fireEvent.click(screen.getByRole("button", { name: "Move block 2 up" }));
  expect(
    screen
      .getByLabelText("Block 1 text")
      .closest("li")
      ?.getAttribute("data-block-id"),
  ).toBe(textId);
  fireEvent.click(screen.getByText("Remove Equations formulas"));
  expect(screen.queryByLabelText("Block 2 LaTeX")).toBeNull();
  expect(screen.getByLabelText<HTMLTextAreaElement>("Block 1 text").value).toBe(
    "Keep my notes",
  );
  expect(
    screen.getByText(/0 distinct catalog formulas selected/),
  ).toBeDefined();
  fireEvent.click(screen.getByLabelText("Example"));
  expect(
    screen.getByLabelText<HTMLTextAreaElement>("Block 2 LaTeX").value,
  ).toBe("a=b");
  expect(catalog.subjects[0].categories[0].formulas[0].body.latex).toBe("a=b");
});

test("all manual layout values and the page allowance survive reload", async () => {
  await create();
  for (const [label, value] of [
    ["Page allowance", "4"],
    ["Columns", "3"],
    ["Margins (mm)", "6"],
    ["Body font (pt)", "8.5"],
    ["Spacing (pt)", "0.5"],
    ["Column gap (mm)", "2"],
  ])
    fireEvent.change(screen.getByLabelText(label), { target: { value } });
  fireEvent.click(screen.getByRole("button", { name: "Apply layout" }));
  expect(active().layout).toEqual({
    paper: "A4",
    columns: 3,
    marginsMm: 6,
    fontPt: 8.5,
    spacingPt: 0.5,
    columnGapMm: 2,
  });
  cleanup();
  await open();
  expect(screen.getByLabelText<HTMLInputElement>("Page allowance").value).toBe(
    "4",
  );
  expect(screen.getByLabelText<HTMLInputElement>("Body font (pt)").value).toBe(
    "8.5",
  );
  fireEvent.click(
    screen.getByRole("button", { name: "Apply compact candidate" }),
  );
  expect(active().layout).toEqual(COMPACT_CANDIDATE);
  expect(active().pageAllowance).toBe(4);
});

test("connection failure and retry keep the same editor, title, blocks, and focus", async () => {
  await create();
  const title = screen.getByLabelText<HTMLInputElement>("Document title");
  fireEvent.change(title, { target: { value: "Manual title" } });
  fireEvent.click(screen.getByRole("button", { name: "Add text block" }));
  vi.mocked(connect).mockRejectedValueOnce(new Error("Connection interrupted"));
  fireEvent.click(screen.getByRole("button", { name: "Check connection" }));
  await screen.findByText("Connection interrupted");
  title.focus();
  expect(screen.getByLabelText("Document title")).toBe(title);
  expect(title.value).toBe("Manual title");
  fireEvent.click(screen.getByRole("button", { name: "Check connection" }));
  await screen.findByText("The protected server is ready. Version 0.1.0.");
  expect(screen.getByLabelText("Document title")).toBe(title);
  expect(document.activeElement).toBe(title);
  expect(screen.getByLabelText("Block 1 text")).toBeDefined();
});

test("save failure is visible and Clear stops without loss when recovery fails", async () => {
  await create();
  const saved = window.localStorage.getItem(DRAFT_KEY);
  const write = vi
    .spyOn(Storage.prototype, "setItem")
    .mockImplementation(() => {
      throw new Error("Quota exceeded");
    });
  fireEvent.change(screen.getByLabelText("Document title"), {
    target: { value: "In memory" },
  });
  expect(screen.getByText(/Draft save failed/)).toBeDefined();
  expect(
    screen.getByRole<HTMLButtonElement>("button", {
      name: "Export document JSON",
    }).disabled,
  ).toBe(false);
  fireEvent.change(screen.getByLabelText("New document page allowance"), {
    target: { value: "2" },
  });
  fireEvent.click(
    screen.getByRole("button", { name: "Clear and create document" }),
  );
  expect(screen.getByLabelText<HTMLInputElement>("Document title").value).toBe(
    "In memory",
  );
  expect(screen.getByText(/Replacement stopped/)).toBeDefined();
  expect(window.localStorage.getItem(DRAFT_KEY)).toBe(saved);
  expect(
    screen.getByLabelText<HTMLInputElement>("New document page allowance")
      .value,
  ).toBe("2");
  write.mockRestore();
  fireEvent.click(
    screen.getByRole("button", { name: "Clear and create document" }),
  );
  expect(active().pageAllowance).toBe(2);
  expect(
    decodeDraft(window.localStorage.getItem(DRAFT_KEY)).replaced?.title,
  ).toBe("In memory");
  expect(
    screen.getByLabelText<HTMLInputElement>("New document page allowance")
      .value,
  ).toBe("");
});

test("Clear requires confirmation and preserves the replaced document for restoration", async () => {
  await create();
  fireEvent.change(screen.getByLabelText("Document title"), {
    target: { value: "Recover me" },
  });
  fireEvent.change(screen.getByLabelText("New document page allowance"), {
    target: { value: "2" },
  });
  vi.mocked(window.confirm).mockReturnValueOnce(false);
  fireEvent.click(
    screen.getByRole("button", { name: "Clear and create document" }),
  );
  expect(active().title).toBe("Recover me");
  fireEvent.click(
    screen.getByRole("button", { name: "Clear and create document" }),
  );
  expect(active().title).toBe("");
  expect(active().pageAllowance).toBe(2);
  fireEvent.click(
    screen.getByRole("button", { name: "Restore last replaced document" }),
  );
  expect(active().title).toBe("Recover me");
  expect(active().pageAllowance).toBe(3);
});

test("a raw draft retains its source and recovery while structured controls stay disabled", async () => {
  const raw = {
    ...createDocument("raw", 3, COMPACT_CANDIDATE),
    content: {
      mode: "raw" as const,
      source: "% manual\r\n\\arbitrary{source}",
    },
    modeRecovery: {
      layout: COMPACT_CANDIDATE,
      content: { mode: "structured" as const, blocks: [] },
    },
  };
  window.localStorage.setItem(
    DRAFT_KEY,
    encodeDraft({ version: 1, active: raw, replaced: null }),
  );
  await open();
  expect(active()).toEqual(raw);
  expect(
    screen.getByLabelText<HTMLTextAreaElement>("Raw LaTeX source").readOnly,
  ).toBe(false);
  expect(
    screen.getByRole("button", { name: "Add text block" }).matches(":disabled"),
  ).toBe(true);
  expect(screen.getByLabelText("Columns").matches(":disabled")).toBe(true);
  expect(screen.getByText(/A mode-recovery copy is retained/)).toBeDefined();
});

test("raw editing saves source and confirmed returns retain manual source", async () => {
  await create();
  fireEvent.click(screen.getByRole("button", { name: "Add text block" }));
  fireEvent.change(screen.getByLabelText("Block 1 text"), {
    target: { value: "Structured notes" },
  });
  const structured = active();
  vi.mocked(renderDocument).mockImplementation(async (document, revision) => ({
    documentId: document.id,
    revision,
    source: "GENERATED",
  }));
  fireEvent.click(
    screen.getByRole("button", { name: "Open advanced raw editor" }),
  );
  const source =
    await screen.findByLabelText<HTMLTextAreaElement>("Raw LaTeX source");
  fireEvent.change(source, { target: { value: "% manual\n\\incomplete{é" } });
  const raw = active();
  expect(raw.modeRecovery?.content).toEqual(structured.content);
  vi.mocked(window.confirm).mockReturnValueOnce(false);
  fireEvent.click(
    screen.getByRole("button", { name: "Return to structured mode" }),
  );
  expect(active()).toEqual(raw);
  fireEvent.click(
    screen.getByRole("button", { name: "Return to structured mode" }),
  );
  expect(active().content).toEqual(structured.content);
  expect(active().modeRecovery?.content).toEqual(raw.content);
  fireEvent.change(screen.getByLabelText("Block 1 text"), {
    target: { value: "New structured notes" },
  });
  fireEvent.click(
    screen.getByRole("button", { name: "Restore raw mode recovery" }),
  );
  await screen.findByLabelText("Raw LaTeX source");
  expect(active().content).toEqual(raw.content);
  expect(renderDocument).toHaveBeenCalledOnce();
  expect(window.confirm).toHaveBeenLastCalledWith(
    expect.stringContaining("will not be merged"),
  );
});

test("raw imports without structured recovery cannot return; missing locks keep raw source read-only", async () => {
  Reflect.deleteProperty(navigator, "locks");
  window.localStorage.setItem(
    DRAFT_KEY,
    encodeDraft({
      version: 1,
      active: {
        ...createDocument("raw", 2, COMPACT_CANDIDATE),
        content: { mode: "raw", source: "% retained" },
      },
      replaced: null,
    }),
  );
  await open();
  expect(
    screen.getByLabelText<HTMLTextAreaElement>("Raw LaTeX source").readOnly,
  ).toBe(true);
  expect(
    screen.getByRole<HTMLButtonElement>("button", {
      name: "Return to structured mode",
    }).disabled,
  ).toBe(true);
  expect(screen.getByText(/No structured recovery copy exists/)).toBeDefined();
});

test("missing lock support shows a read-only document with exports but no writer controls", async () => {
  Reflect.deleteProperty(navigator, "locks");
  window.localStorage.setItem(
    DRAFT_KEY,
    encodeDraft({
      version: 1,
      active: createDocument("read", 2, COMPACT_CANDIDATE),
      replaced: null,
    }),
  );
  await open();
  expect(screen.getByText(/Web Locks are unavailable/)).toBeDefined();
  expect(screen.getByLabelText("Document title").matches(":disabled")).toBe(
    true,
  );
  expect(
    screen.getByLabelText("Import document JSON").matches(":disabled"),
  ).toBe(true);
  expect(
    screen.getByRole<HTMLButtonElement>("button", {
      name: "Export document JSON",
    }).disabled,
  ).toBe(false);
});

test("invalid JSON import leaves the editor unchanged before it asks for confirmation", async () => {
  await create();
  const before = active();
  fireEvent.change(screen.getByLabelText("Import document JSON"), {
    target: { files: [new File(["bad"], "bad.json")] },
  });
  await waitFor(() => expect(screen.getByText(/Import failed/)).toBeDefined());
  expect(active()).toEqual(before);
  expect(window.confirm).not.toHaveBeenCalled();
});

test("catalog boundary rejects malformed bodies, duplicate IDs, and invalid labels", () => {
  expect(() => decodeCatalog({ ...catalog, version: 2 })).toThrow();
  const badBody = structuredClone(catalog);
  Reflect.set(
    badBody.subjects[0].categories[0].formulas[0].body,
    "type",
    "unknown",
  );
  expect(() => decodeCatalog(badBody)).toThrow();
  const duplicate = structuredClone(catalog);
  Reflect.set(duplicate.subjects[0].categories[0], "id", "subject");
  expect(() => decodeCatalog(duplicate)).toThrow();
  expect(() => decodeCatalog({ version: 1, subjects: [] })).toThrow();
});
