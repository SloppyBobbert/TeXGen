import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { PdfPreview } from "./PdfPreview";
import { createDocument } from "./document";

const mocks = vi.hoisted(() => ({
  compile: vi.fn(),
  cancel: vi.fn(),
  open: vi.fn(),
  download: vi.fn(),
}));
vi.mock("./api", () => ({
  compileDocument: mocks.compile,
  cancelCompilation: mocks.cancel,
}));
vi.mock("./pdf", () => ({ openPdf: mocks.open }));
vi.mock("./browser-session", () => ({ download: mocks.download }));
vi.mock("./PdfPage", () => ({
  PdfPage: ({ page }: { page: number }) => <div>Rendered PDF page {page}</div>,
}));
const document = createDocument("preview-doc", 1, {
  paper: "A4",
  columns: 2,
  marginsMm: 5,
  fontPt: 9,
  spacingPt: 1,
  columnGapMm: 3,
});
const props = { document, revision: 1, enabled: true, writable: true };
function parsed(pages = 3) {
  return { document: { numPages: pages }, close: vi.fn() };
}
beforeEach(() => {
  vi.resetAllMocks();
  mocks.compile.mockResolvedValue(new Uint8Array([1, 2, 3]));
  mocks.cancel.mockResolvedValue(undefined);
  mocks.open.mockResolvedValue(parsed());
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

test("verified page counts warn without dropping pages and export exact bytes", async () => {
  render(<PdfPreview {...props} />);
  fireEvent.click(screen.getByRole("button", { name: "Compile PDF" }));
  await screen.findByText(/Actual page count: 3/);
  expect(screen.getByText(/All 3 pages are retained/)).toBeDefined();
  fireEvent.click(screen.getByRole("button", { name: "Next page" }));
  fireEvent.click(screen.getByRole("button", { name: "Next page" }));
  expect(screen.getByText("Rendered PDF page 3")).toBeDefined();
  fireEvent.click(screen.getByRole("button", { name: "Export PDF" }));
  expect(mocks.download).toHaveBeenCalledWith(
    "texgen-document.pdf",
    "application/pdf",
    new Uint8Array([1, 2, 3]),
  );
});

test.each([
  { failure: new Error("Download blocked"), message: "Download blocked" },
  { failure: null, message: "The download could not start." },
])(
  "a failed PDF download can be retried without losing the PDF or compiler error ($message)",
  async ({ failure, message }) => {
    const pdf = parsed();
    mocks.open.mockResolvedValueOnce(pdf);
    mocks.compile
      .mockResolvedValueOnce(new Uint8Array([1, 2, 3]))
      .mockRejectedValueOnce(new Error("Compiler unavailable"));
    render(<PdfPreview {...props} />);
    fireEvent.click(screen.getByRole("button", { name: "Compile PDF" }));
    await screen.findByText(/Actual page count: 3/);
    fireEvent.click(screen.getByRole("button", { name: "Next page" }));
    fireEvent.click(screen.getByRole("button", { name: "Compile PDF" }));
    await screen.findByText(/Compiler unavailable/);
    mocks.download.mockImplementationOnce(() => {
      throw failure;
    });
    fireEvent.click(screen.getByRole("button", { name: "Export PDF" }));
    expect(screen.getByText(/PDF export failed/).textContent).toContain(
      message,
    );
    expect(screen.getByText("Rendered PDF page 2")).toBeDefined();
    expect(pdf.close).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Export PDF" }));
    expect(screen.queryByText(/PDF export failed/)).toBeNull();
    expect(screen.getByText(/Compiler unavailable/)).toBeDefined();
    expect(mocks.download).toHaveBeenCalledTimes(2);
    expect(mocks.download).toHaveBeenLastCalledWith(
      "texgen-document.pdf",
      "application/pdf",
      new Uint8Array([1, 2, 3]),
    );
    expect(mocks.compile).toHaveBeenCalledTimes(2);
  },
);

test("exporting a retained PDF after document replacement still requires confirmation", async () => {
  const confirm = vi
    .spyOn(window, "confirm")
    .mockReturnValueOnce(false)
    .mockReturnValueOnce(true);
  const view = render(<PdfPreview {...props} />);
  fireEvent.click(screen.getByRole("button", { name: "Compile PDF" }));
  await screen.findByText(/Actual page count: 3/);
  view.rerender(
    <PdfPreview {...props} document={{ ...document, id: "replacement" }} />,
  );
  fireEvent.click(screen.getByRole("button", { name: "Export PDF" }));
  expect(mocks.download).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Export PDF" }));
  expect(confirm).toHaveBeenCalledTimes(2);
  expect(mocks.download).toHaveBeenCalledExactlyOnceWith(
    "texgen-document.pdf",
    "application/pdf",
    new Uint8Array([1, 2, 3]),
  );
});

test("editing marks the retained PDF outdated and failures do not replace it", async () => {
  const first = parsed();
  mocks.open
    .mockResolvedValueOnce(first)
    .mockRejectedValueOnce(new Error("Invalid PDF"));
  const view = render(<PdfPreview {...props} />);
  fireEvent.click(screen.getByRole("button", { name: "Compile PDF" }));
  await screen.findByText(/Actual page count: 3/);
  view.rerender(<PdfPreview {...props} revision={2} />);
  expect(screen.getByText(/This PDF is outdated/)).toBeDefined();
  fireEvent.click(screen.getByRole("button", { name: "Compile PDF" }));
  await screen.findByText(/Invalid PDF/);
  expect(
    screen.getByText(/Retained PDF: document preview-doc, revision 1/),
  ).toBeDefined();
  expect(first.close).not.toHaveBeenCalled();
});

test("a late parsed result after editing is closed instead of published", async () => {
  let resolve: ((pdf: ReturnType<typeof parsed>) => void) | undefined;
  mocks.open.mockReturnValue(
    new Promise((done) => {
      resolve = done;
    }),
  );
  const view = render(<PdfPreview {...props} />);
  fireEvent.click(screen.getByRole("button", { name: "Compile PDF" }));
  await waitFor(() => expect(mocks.open).toHaveBeenCalledOnce());
  view.rerender(<PdfPreview {...props} revision={2} />);
  const late = parsed();
  await act(async () => {
    resolve?.(late);
  });
  expect(late.close).toHaveBeenCalledOnce();
  expect(screen.getByText("No verified PDF is retained yet.")).toBeDefined();
  expect(mocks.cancel).toHaveBeenCalledOnce();
});

test("a late cancellation error cannot overwrite a newer verified operation", async () => {
  let reject: ((error: Error) => void) | undefined;
  mocks.cancel.mockReturnValueOnce(
    new Promise((_, fail) => {
      reject = fail;
    }),
  );
  mocks.compile.mockReturnValueOnce(new Promise(() => {}));
  render(<PdfPreview {...props} />);
  fireEvent.click(screen.getByRole("button", { name: "Compile PDF" }));
  fireEvent.click(screen.getByRole("button", { name: "Cancel compilation" }));
  fireEvent.click(screen.getByRole("button", { name: "Compile PDF" }));
  await screen.findByText(/Actual page count: 3/);
  await act(async () => {
    reject?.(new Error("Old cancellation failed."));
  });
  expect(screen.queryByText(/Old cancellation failed/)).toBeNull();
});

test("unavailable compilation and read-only ownership do not start a job", () => {
  const view = render(<PdfPreview {...props} enabled={false} />);
  fireEvent.click(screen.getByRole("button", { name: "Compile PDF" }));
  view.rerender(<PdfPreview {...props} writable={false} />);
  fireEvent.click(screen.getByRole("button", { name: "Compile PDF" }));
  expect(mocks.compile).not.toHaveBeenCalled();
});
