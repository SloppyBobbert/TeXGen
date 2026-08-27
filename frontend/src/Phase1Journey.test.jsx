import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import CreateCheatSheet from './components/CreateCheatSheet';
import AuthContext from './context/AuthContext';

vi.mock('react-pdf', () => ({
  Document: ({ children, onLoadSuccess }) => {
    React.useEffect(() => onLoadSuccess({ numPages: 1 }), [onLoadSuccess]);
    return <div data-testid="pdf-document">{children}</div>;
  },
  Page: () => <div data-testid="pdf-page" />,
  pdfjs: { GlobalWorkerOptions: { workerSrc: '' } },
}));

const classes = [{
  name: 'Physics 101',
  categories: [
    { name: 'Motion', formulas: [{ name: 'Velocity' }] },
    { name: 'Forces', formulas: [{ name: 'Newton Second Law' }] },
  ],
}];

const template = {
  title: 'Physics template',
  content: '\\documentclass{article}\nTemplate body',
  contentSource: 'generated',
  columns: 2,
  fontSize: '10pt',
  spacing: 'small',
  margins: '0.25in',
  orientation: 'portrait',
  selectedFormulas: [
    { class: 'Physics 101', category: 'Motion', name: 'Velocity' },
    { class: 'Physics 101', category: 'Forces', name: 'Newton Second Law' },
  ],
  compileHistory: [],
};
const deferred = () => {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
};

const renderEditor = (props) => render(
  <AuthContext.Provider value={{ authTokens: null }}>
    <CreateCheatSheet onReset={vi.fn()} {...props} />
  </AuthContext.Provider>,
);

describe('phase 1 component persistence journey with mocked save callback', () => {
  beforeEach(() => {
    localStorage.clear();
    global.fetch = vi.fn((url, options = {}) => {
      if (url === '/api/classes/') {
        return Promise.resolve({ ok: true, json: async () => ({ classes }) });
      }

      if (url === '/api/compile/') {
        const body = JSON.parse(options.body);
        if (body.normalize_only) {
          return Promise.resolve({ ok: true, json: async () => ({ tex_code: `${body.content}\n% normalized` }) });
        }
        return Promise.resolve({ ok: true, blob: async () => new Blob(['pdf'], { type: 'application/pdf' }) });
      }

      throw new Error(`Unexpected request: ${url}`);
    });
    vi.stubGlobal('ResizeObserver', class {
      observe() {}
      disconnect() {}
    });
    vi.stubGlobal('requestAnimationFrame', (callback) => setTimeout(callback, 0));
    vi.stubGlobal('cancelAnimationFrame', clearTimeout);
    vi.stubGlobal('URL', { createObjectURL: vi.fn(() => 'blob:phase-1'), revokeObjectURL: vi.fn() });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  it('retains a normalized manual edit when remounted with supplied persisted data', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const firstDraftIdentity = 'template-draft';
    const { unmount } = renderEditor({ initialData: template, draftIdentity: firstDraftIdentity, onSave });

    await screen.findByLabelText('Physics 101');
    fireEvent.click(screen.getByRole('button', { name: /Show LaTeX editor/i }));
    fireEvent.change(screen.getByLabelText(/Generated LaTeX Code:/i), {
      target: { value: '\\documentclass{article}\nManual body' },
    });
    fireEvent.change(screen.getByLabelText(/Orientation:/i), { target: { value: 'landscape' } });
    fireEvent.change(screen.getByLabelText(/Spacing:/i), { target: { value: 'medium' } });
    fireEvent.click(screen.getByLabelText(/Motion \(1 formulas\)/i));

    fireEvent.click(screen.getByRole('button', { name: /Compile PDF/i }));

    await waitFor(() => expect(global.fetch).toHaveBeenCalledWith(
      '/api/compile/',
      expect.objectContaining({ body: JSON.stringify({
        content: '\\documentclass{article}\nManual body',
        columns: 2,
        font_size: '10pt',
        spacing: 'medium',
        margins: '0.25in',
        orientation: 'landscape',
        normalize_only: true,
      }) }),
    ));
    await waitFor(() => expect(global.fetch).toHaveBeenCalledWith(
      '/api/compile/',
      expect.objectContaining({ body: JSON.stringify({
        content: '\\documentclass{article}\nManual body\n% normalized',
        columns: 2,
        font_size: '10pt',
        spacing: 'medium',
        margins: '0.25in',
        orientation: 'landscape',
      }) }),
    ));
    expect(global.fetch).not.toHaveBeenCalledWith('/api/generate-sheet/', expect.anything());
    expect(await screen.findByTestId('pdf-document')).toBeInTheDocument();

    await waitFor(() => expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ compileSnapshot: expect.any(Object) }), false));
    const savedPayload = onSave.mock.calls.find(([, showFeedback]) => showFeedback === false)[0];
    expect(savedPayload).toMatchObject({
      content: expect.stringContaining('Manual body'),
      contentSource: 'manual',
      spacing: 'medium',
      orientation: 'landscape',
      selectedFormulas: [{ class: 'Physics 101', category: 'Forces', name: 'Newton Second Law' }],
    });
    expect(savedPayload.compileSnapshot).toMatchObject({ contentSource: 'manual', spacing: 'medium', orientation: 'landscape' });

    await waitFor(() => expect(localStorage.getItem(`cheatSheetLatex:${firstDraftIdentity}`)).not.toBeNull());
    expect(localStorage.getItem(`cheatSheetData:${firstDraftIdentity}`)).not.toBeNull();
    localStorage.removeItem(`cheatSheetLatex:${firstDraftIdentity}`);
    localStorage.removeItem(`cheatSheetData:${firstDraftIdentity}`);
    expect(localStorage.getItem(`cheatSheetLatex:${firstDraftIdentity}`)).toBeNull();
    expect(localStorage.getItem(`cheatSheetData:${firstDraftIdentity}`)).toBeNull();
    unmount();

    const savedServerSheet = {
      ...savedPayload,
      id: 42,
      draftId: 'server-sheet-42',
      compileHistory: [savedPayload.compileSnapshot],
    };
    renderEditor({ initialData: savedServerSheet, draftIdentity: 'server-sheet-42', onSave: vi.fn().mockResolvedValue(undefined) });

    await screen.findByLabelText('Physics 101');
    expect(screen.getByLabelText(/Orientation:/i)).toHaveValue('landscape');
    expect(screen.getByLabelText(/Spacing:/i)).toHaveValue('medium');
    expect(screen.getByLabelText(/Motion \(1 formulas\)/i)).not.toBeChecked();
    expect(screen.getByLabelText(/Forces \(1 formulas\)/i)).toBeChecked();
    expect(screen.getByRole('button', { name: /Snapshots \(1\)/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Show LaTeX editor/i }));
    expect(screen.getByLabelText(/Generated LaTeX Code:/i)).toHaveValue('\\documentclass{article}\nManual body\n% normalized');
  });

  it('waits for hydrated formulas before restoring exactly one preview and autosaving it', async () => {
    const classesRequest = deferred();
    const onSave = vi.fn().mockResolvedValue(undefined);
    const restored = {
      ...template,
      content: '\\documentclass{article}\nRestored body',
      compileHistory: [{ content: 'previous compile' }],
      selectedFormulas: [{ class: 'Physics 101', category: 'Motion', name: 'Velocity' }],
    };
    global.fetch = vi.fn((url) => {
      if (url === '/api/classes/') return classesRequest.promise;
      if (url === '/api/compile/') return Promise.resolve({ ok: true, blob: async () => new Blob(['pdf'], { type: 'application/pdf' }) });
      throw new Error(`Unexpected request: ${url}`);
    });

    renderEditor({ initialData: restored, draftIdentity: 'restored-sheet', onSave });
    expect(global.fetch).toHaveBeenCalledTimes(1);
    await act(async () => classesRequest.resolve({ ok: true, json: async () => ({ classes }) }));

    await waitFor(() => expect(global.fetch).toHaveBeenCalledWith('/api/compile/', expect.anything()));
    expect(global.fetch.mock.calls.filter(([url]) => url === '/api/compile/')).toHaveLength(1);
    await waitFor(() => expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
      selectedFormulas: restored.selectedFormulas,
    }), false));
    expect(onSave.mock.calls.filter(([, showFeedback]) => showFeedback === false)).toHaveLength(1);
  });
});
