import React, { useEffect, useState } from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter, Link } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App';
import AuthContext from './context/AuthContext';

const mocks = vi.hoisted(() => ({ childMount: vi.fn() }));

vi.mock('framer-motion', () => ({
  motion: new Proxy({}, { get: () => 'div' }),
}));

vi.mock('lucide-react', () => ({
  Home: () => null,
  LayoutDashboard: () => null,
  LogIn: () => null,
  LogOut: () => null,
  Palette: () => null,
}));

vi.mock('./components/CreateCheatSheet', () => ({
  default: function MockCreateCheatSheet({ initialData, isSaving, onReset, onRestoreSnapshot, onSave }) {
    const [localEdit, setLocalEdit] = useState('');
    useEffect(() => {
      mocks.childMount();
    }, []);

    const save = (title, content = `${title} content`) => onSave({
      title,
      content,
      contentSource: 'manual',
      orientation: 'landscape',
      selectedFormulas: [{ name: `${title} formula` }],
    });

    return (
      <section>
        <input aria-label="child local edit" value={localEdit} onChange={(event) => setLocalEdit(event.target.value)} />
        <output data-testid="sheet-state">{JSON.stringify(initialData)}</output>
        <output data-testid="saving-state">{String(isSaving)}</output>
        <button onClick={() => save('first')}>Save first</button>
        <button onClick={() => save('second')}>Save second</button>
        <button onClick={() => onSave({
          title: 'snapshot title',
          content: 'snapshot content',
          contentSource: 'generated',
          orientation: 'portrait',
          selectedFormulas: [{ formula_id: 'snapshot-formula', name: 'snapshot formula' }],
          compileSnapshot: {
            title: 'snapshot title',
            content: 'snapshot content',
            contentSource: 'generated',
            columns: 4,
            fontSize: '9pt',
            spacing: 'small',
            margins: '0.15in',
            orientation: 'portrait',
            selectedFormulas: [{ formula_id: 'snapshot-formula', name: 'snapshot formula' }],
          },
        }, false)}>Save snapshot</button>
        <button onClick={() => onSave({
          title: 'transient snapshot', content: 'transient content', contentSource: 'manual', pdfBlob: 'blob:top-level',
          compileSnapshot: {
            title: 'transient snapshot', content: 'transient content', contentSource: 'manual', columns: 4,
            fontSize: '9pt', spacing: 'small', margins: '0.15in', orientation: 'portrait', selectedFormulas: [],
            pdfBlob: 'blob:nested', nested: { pdfBlob: 'blob:deep', url: 'blob:also-deep' },
          },
        }, false)}>Save transient snapshot</button>
        <button onClick={() => onSave({
          title: 'blob:notes', content: 'blob:legitimate LaTeX text', contentSource: 'manual',
          selectedFormulas: [{ formula_id: 'blob-durable', name: 'blob:durable', pdfBlob: 'blob:transient', nested: { text: 'blob:keep', pdfBlob: 'blob:drop' } }],
          provenance: 'blob:durable provenance', pdfBlob: 'blob:top-level-pdf',
          compileSnapshot: {
            title: 'blob:notes', content: 'blob:legitimate LaTeX text', contentSource: 'manual', columns: 4,
            fontSize: '9pt', spacing: 'small', margins: '0.15in', orientation: 'portrait',
            selectedFormulas: [{ formula_id: 'blob-durable', name: 'blob:durable', pdfBlob: 'blob:transient', nested: { text: 'blob:keep', pdfBlob: 'blob:drop' } }],
            nested: { note: 'blob:durable nested text', pdfBlob: 'blob:nested-pdf' }, pdfBlob: 'blob:snapshot-pdf',
          },
        })}>Save durable blob text</button>
        <button onClick={() => onSave({
          title: 'formula save', content: 'formula content', contentSource: 'manual',
          selectedFormulas: [{ formula_id: 'formula-a', class: 'Math', category: 'Algebra', name: 'A', nested: { text: 'blob:keep', pdfBlob: 'blob:drop' } }],
        })}>Save formula A</button>
        <button onClick={() => onSave({
          selectedFormulas: [{ formula_id: 'formula-c', class: 'Math', category: 'Algebra', name: 'C', nested: { text: 'blob:local' } }],
        }, false)}>Save formula C locally</button>
        <button onClick={() => onRestoreSnapshot({ orientation: 'landscape' })}>Restore orientation</button>
        <button onClick={() => onRestoreSnapshot({ formulaSelections: [{ formula_id: 'canonical-first' }, { formula_id: 'canonical-second' }] })}>Restore canonical formulas</button>
        <button onClick={() => onRestoreSnapshot({ selectedFormulas: [{ id: 'legacy-first' }, { formula_id: 'legacy-second' }] })}>Restore legacy formulas</button>
        <button onClick={() => onRestoreSnapshot({ formulaSelections: [{ formula_id: 'canonical-wins' }], selectedFormulas: [{ formula_id: 'legacy-loses' }] })}>Restore conflicting formulas</button>
        <button onClick={() => onSave({})}>Save restored formulas</button>
        <button onClick={onReset}>Reset sheet</button>
        <Link to="/dashboard" aria-label="Open test dashboard">Dashboard</Link>
      </section>
    );
  },
}));

vi.mock('react-pdf', () => ({
  Document: ({ children, onLoadSuccess }) => {
    useEffect(() => onLoadSuccess?.({ numPages: 1 }), [onLoadSuccess]);
    return <div>{children}</div>;
  },
  Page: () => <div />,
  pdfjs: { GlobalWorkerOptions: { workerSrc: '' } },
}));

vi.mock('./components/Dashboard', () => ({
  default: ({ onEditSheet }) => (
    <button onClick={() => onEditSheet({
      id: 77,
      title: 'edited sheet',
      latex_content: 'edited content',
      content_source: 'manual',
      columns: 2,
      margins: '0.25in',
      font_size: '10pt',
      spacing: 'normal',
      orientation: 'landscape',
      selected_formulas: [{ name: 'blob:durable', pdfBlob: 'blob:transient', nested: { text: 'blob:keep', pdfBlob: 'blob:drop' } }],
    })}>Edit sheet</button>
  ),
}));

vi.mock('./components/Login', () => ({ default: () => <div>Login</div> }));
vi.mock('./components/SignUp', () => ({ default: () => <div>Sign up</div> }));

const deferred = () => {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
};

const response = (data) => ({
  ok: true,
  json: vi.fn().mockResolvedValue(data),
  clone() {
    return { json: vi.fn().mockResolvedValue(data) };
  },
});

const renderApp = () => render(
  <BrowserRouter>
    <AuthContext.Provider value={{
      user: { username: 'tester' },
      authTokens: { access: 'token' },
      logoutUser: vi.fn(),
    }}>
      <App />
    </AuthContext.Provider>
  </BrowserRouter>,
);

const storedSheet = () => JSON.parse(localStorage.getItem('currentCheatSheet'));
const containsTransientBlob = (value) => {
  if (Array.isArray(value)) return value.some(containsTransientBlob);
  return value && typeof value === 'object' && Object.entries(value).some(([key, item]) => key === 'pdfBlob' || containsTransientBlob(item));
};
const failStorageWrite = (matches) => {
  const originalSetItem = globalThis.Storage.prototype.setItem;
  return vi.spyOn(globalThis.Storage.prototype, 'setItem').mockImplementation(function setItem(key, value) {
    if (matches(key)) throw new globalThis.DOMException('Storage full', 'QuotaExceededError');
    return originalSetItem.call(this, key, value);
  });
};

describe('App save lifecycle regressions', () => {
  beforeEach(() => {
    localStorage.clear();
    window.history.replaceState({}, '', '/');
    mocks.childMount.mockClear();
    vi.stubGlobal('alert', vi.fn());
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  it('assigns a created sheet ID without remounting or overwriting a child-local edit', async () => {
    const create = deferred();
    vi.stubGlobal('fetch', vi.fn(() => create.promise));
    renderApp();

    fireEvent.change(screen.getByLabelText('child local edit'), { target: { value: 'unsaved child edit' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save first' }));
    await waitFor(() => expect(fetch).toHaveBeenCalledWith('/api/cheatsheets/', expect.objectContaining({ method: 'POST' })));

    await act(async () => create.resolve(response({ id: 41, title: 'first', latex_content: 'server content' })));

    await waitFor(() => expect(storedSheet()).toEqual(expect.objectContaining({ id: 41 })));
    expect(screen.getByLabelText('child local edit')).toHaveValue('unsaved child edit');
    expect(mocks.childMount).toHaveBeenCalledTimes(1);
  });

  it('keeps a matching unresolved legacy sheet on startup', () => {
    const legacy = { draftId: 'legacy-draft', title: 'Recover me', content: 'legacy source', contentSource: 'manual', columns: 4, fontSize: '9pt', spacing: 'small', margins: '0.15in', orientation: 'portrait', selectedFormulas: [{ name: 'display only' }], compileHistory: [] };
    localStorage.setItem('currentCheatSheet', JSON.stringify(legacy));

    renderApp();

    expect(JSON.parse(screen.getByTestId('sheet-state').textContent)).toEqual(expect.objectContaining({ title: 'Recover me', selectedFormulas: [{ name: 'display only' }] }));
    expect(JSON.parse(localStorage.getItem('currentCheatSheet'))).toEqual(legacy);
  });

  it('surfaces a canonical draft persistence failure instead of reporting a save', async () => {
    localStorage.setItem('currentCheatSheet', JSON.stringify({ id: 7, draftId: 'sheet-7', title: 'existing', content: '', contentSource: 'empty', columns: 4, fontSize: '9pt', spacing: 'small', margins: '0.15in', orientation: 'portrait', selectedFormulas: [], compileHistory: [] }));
    localStorage.setItem('cheatSheetDraft:v1:string:sheet-7', '{malformed');
    vi.stubGlobal('fetch', vi.fn());

    renderApp();
    fireEvent.click(screen.getByRole('button', { name: 'Save formula A' }));

    await waitFor(() => expect(alert).toHaveBeenCalledWith('Failed to save progress: Unable to save this browser draft.'));
    expect(fetch).not.toHaveBeenCalled();
  });

  it('does not crash or fetch when current sheet storage fails', async () => {
    vi.stubGlobal('fetch', vi.fn());
    failStorageWrite((key) => key === 'currentCheatSheet');

    renderApp();
    fireEvent.click(screen.getByRole('button', { name: 'Save formula A' }));

    await waitFor(() => expect(alert).toHaveBeenCalledWith('Failed to save progress: Unable to save this browser draft.'));
    expect(fetch).not.toHaveBeenCalled();
  });

  it('does not fetch when compile history sidecar storage fails', async () => {
    vi.stubGlobal('fetch', vi.fn());
    localStorage.setItem('currentCheatSheet', JSON.stringify({ id: 7, draftId: 'sheet-7', title: 'existing', content: '', contentSource: 'empty', columns: 4, fontSize: '9pt', spacing: 'small', margins: '0.15in', orientation: 'portrait', selectedFormulas: [], compileHistory: [] }));
    renderApp();
    failStorageWrite((key) => key.startsWith('cheatSheetCompileHistory:'));

    fireEvent.click(screen.getByRole('button', { name: 'Save formula A' }));

    await waitFor(() => expect(alert).toHaveBeenCalledWith('Failed to save progress: Unable to save this browser draft.'));
    expect(fetch).not.toHaveBeenCalled();
  });

  it('does not fetch when canonical draft storage fails', async () => {
    vi.stubGlobal('fetch', vi.fn());
    renderApp();
    failStorageWrite((key) => key.startsWith('cheatSheetDraft:v1:'));

    fireEvent.click(screen.getByRole('button', { name: 'Save formula A' }));

    await waitFor(() => expect(alert).toHaveBeenCalledWith('Failed to save progress: Unable to save this browser draft.'));
    expect(fetch).not.toHaveBeenCalled();
  });

  it('reports browser reconciliation failure after a successful server save', async () => {
    const save = deferred();
    vi.stubGlobal('fetch', vi.fn(() => save.promise));
    renderApp();

    fireEvent.click(screen.getByRole('button', { name: 'Save formula A' }));
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    failStorageWrite((key) => key === 'currentCheatSheet');
    await act(async () => save.resolve(response({ id: 12, schema_version: 1, revision: 1, source_mode: 'raw', source_latex: 'formula content', layout: { columns: 4, font_size: '9pt', spacing: 'small', margins: '0.15in', orientation: 'portrait' }, formula_selections: [{ formula_id: 'formula-a' }] })));

    await waitFor(() => expect(alert).toHaveBeenCalledWith('Saved to server, but failed to update this browser draft.'));
    expect(alert).not.toHaveBeenCalledWith('Progress saved!');
  });

  it.each([
    ['reset', async () => fireEvent.click(screen.getByRole('button', { name: 'Reset sheet' }))],
    ['edit', async () => {
      fireEvent.click(screen.getByRole('link', { name: 'Open test dashboard' }));
      await screen.findByRole('button', { name: 'Edit sheet' });
      fireEvent.click(screen.getByRole('button', { name: 'Edit sheet' }));
    }],
  ])('invalidates a stale save when the sheet is changed by %s', async (_name, changeSheet) => {
    const save = deferred();
    vi.stubGlobal('fetch', vi.fn(() => save.promise));
    renderApp();

    fireEvent.click(screen.getByRole('button', { name: 'Save first' }));
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    await changeSheet();
    const currentTitle = storedSheet().title;

    await act(async () => save.resolve(response({ id: 99, title: 'stale title', latex_content: 'stale content' })));
    await waitFor(() => expect(storedSheet().title).toBe(currentTitle));
    expect(storedSheet()).not.toEqual(expect.objectContaining({ id: 99, title: 'stale title' }));
    expect(alert).not.toHaveBeenCalled();
  });

  it('keeps the newest feedback save data, ID, and loading state when responses resolve out of order', async () => {
    localStorage.setItem('currentCheatSheet', JSON.stringify({
      id: 5, draftId: 'sheet-5', title: 'existing', content: '', contentSource: 'empty', columns: 4,
      fontSize: '9pt', spacing: 'small', margins: '0.15in', orientation: 'portrait', selectedFormulas: [], compileHistory: [],
    }));
    const first = deferred();
    const second = deferred();
    vi.stubGlobal('fetch', vi.fn().mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise));
    renderApp();

    fireEvent.click(screen.getByRole('button', { name: 'Save first' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save second' }));
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
    expect(screen.getByTestId('saving-state')).toHaveTextContent('true');

    await act(async () => second.resolve(response({ id: 5, title: 'second', latex_content: 'second server content', content_source: 'manual' })));
    await waitFor(() => expect(storedSheet()).toEqual(expect.objectContaining({ id: 5, title: 'second', content: 'second server content' })));
    expect(screen.getByTestId('saving-state')).toHaveTextContent('false');

    await act(async () => first.resolve(response({ id: 5, title: 'first', latex_content: 'first server content' })));
    await waitFor(() => expect(storedSheet().title).toBe('second'));
    expect(storedSheet().content).toBe('second server content');
    expect(screen.getByTestId('saving-state')).toHaveTextContent('false');
  });

  it('persists save metadata through reload and restores an orientation-only snapshot', async () => {
    vi.stubGlobal('fetch', vi.fn());
    const firstRender = renderApp();

    fireEvent.click(screen.getByRole('button', { name: 'Save snapshot' }));
    await waitFor(() => expect(storedSheet()).toEqual(expect.objectContaining({
      contentSource: 'generated', orientation: 'portrait', selectedFormulas: [{ formula_id: 'snapshot-formula', name: 'snapshot formula' }],
      compileHistory: [expect.objectContaining({ title: 'snapshot title', formulaSelections: [{ formula_id: 'snapshot-formula' }] })],
    })));
    firstRender.unmount();
    renderApp();

    expect(JSON.parse(screen.getByTestId('sheet-state').textContent)).toEqual(expect.objectContaining({
      contentSource: 'generated', orientation: 'portrait', selectedFormulas: [{ formula_id: 'snapshot-formula' }],
      compileHistory: [expect.objectContaining({ title: 'snapshot title' })],
    }));
    fireEvent.click(screen.getByRole('button', { name: 'Restore orientation' }));
    await waitFor(() => expect(storedSheet().orientation).toBe('landscape'));
  });

  it('restores canonical-only snapshot selections in order', async () => {
    renderApp();
    fireEvent.click(screen.getByRole('button', { name: 'Restore canonical formulas' }));

    await waitFor(() => expect(storedSheet()).toEqual(expect.objectContaining({
      formulaSelections: [{ formula_id: 'canonical-first' }, { formula_id: 'canonical-second' }],
      selectedFormulas: [{ formula_id: 'canonical-first' }, { formula_id: 'canonical-second' }],
    })));
  });

  it('derives canonical snapshot selections from legacy formula records', async () => {
    renderApp();
    fireEvent.click(screen.getByRole('button', { name: 'Restore legacy formulas' }));

    await waitFor(() => expect(storedSheet()).toEqual(expect.objectContaining({
      formulaSelections: [{ formula_id: 'legacy-first' }, { formula_id: 'legacy-second' }],
      selectedFormulas: [{ id: 'legacy-first' }, { formula_id: 'legacy-second' }],
    })));
  });

  it('uses canonical snapshot selections over conflicting legacy records', async () => {
    renderApp();
    fireEvent.click(screen.getByRole('button', { name: 'Restore conflicting formulas' }));

    await waitFor(() => expect(storedSheet().formulaSelections).toEqual([{ formula_id: 'canonical-wins' }]));
  });

  it('sends restored canonical selection IDs on the next save', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(response({ id: 8, schema_version: 1, revision: 1, source_mode: 'empty', source_latex: '', layout: { columns: 4, font_size: '9pt', spacing: 'small', margins: '0.15in', orientation: 'portrait' }, formula_selections: [{ formula_id: 'canonical-first' }, { formula_id: 'canonical-second' }] }))));
    renderApp();
    fireEvent.click(screen.getByRole('button', { name: 'Restore canonical formulas' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save restored formulas' }));

    await waitFor(() => expect(JSON.parse(fetch.mock.calls[0][1].body).formula_selections).toEqual([
      { formula_id: 'canonical-first' }, { formula_id: 'canonical-second' },
    ]));
  });

  it('strips transient blob URLs from saved sheets and compile history', async () => {
    vi.stubGlobal('fetch', vi.fn());
    localStorage.setItem('currentCheatSheet', JSON.stringify({
      id: 7, draftId: 'sheet-7', title: 'existing', content: '', contentSource: 'empty', columns: 4,
      fontSize: '9pt', spacing: 'small', margins: '0.15in', orientation: 'portrait', selectedFormulas: [], compileHistory: [],
    }));
    renderApp();

    fireEvent.click(screen.getByRole('button', { name: 'Save transient snapshot' }));
    await waitFor(() => expect(storedSheet().compileHistory).toHaveLength(1));
    expect(containsTransientBlob(storedSheet())).toBe(false);
    expect(containsTransientBlob(JSON.parse(localStorage.getItem('cheatSheetCompileHistory:7')))).toBe(false);
    expect(storedSheet()).toEqual(expect.objectContaining({ title: 'transient snapshot', content: 'transient content' }));
  });

  it('preserves durable blob-prefixed data while excluding pdfBlob from remote and local persistence', async () => {
    localStorage.setItem('currentCheatSheet', JSON.stringify({
      id: 7, draftId: 'sheet-7', title: 'existing', content: '', contentSource: 'empty', columns: 4,
      fontSize: '9pt', spacing: 'small', margins: '0.15in', orientation: 'portrait', selectedFormulas: [], compileHistory: [],
    }));
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(response({
      id: 7, title: 'blob:notes', latex_content: 'blob:legitimate LaTeX text', content_source: 'manual',
      columns: 4, font_size: '9pt', spacing: 'small', margins: '0.15in', orientation: 'portrait',
      selected_formulas: [{ name: 'blob:durable', pdfBlob: 'blob:response-transient', nested: { text: 'blob:keep', pdfBlob: 'blob:response-drop' } }],
    }))));
    renderApp();

    fireEvent.click(screen.getByRole('button', { name: 'Save durable blob text' }));
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    const requestBody = JSON.parse(fetch.mock.calls[0][1].body);
    expect(requestBody).toEqual(expect.objectContaining({
      title: 'blob:notes', source_latex: 'blob:legitimate LaTeX text', source_mode: 'raw',
      formula_selections: [{ formula_id: 'blob-durable' }],
      layout: { columns: 4, font_size: '9pt', spacing: 'small', margins: '0.15in', orientation: 'portrait' },
    }));
    expect(containsTransientBlob(requestBody)).toBe(false);
    await waitFor(() => expect(storedSheet().compileHistory).toHaveLength(1));
    const storedHistory = JSON.parse(localStorage.getItem('cheatSheetCompileHistory:7'));
    expect(storedSheet()).toEqual(expect.objectContaining({
      title: 'blob:notes', content: 'blob:legitimate LaTeX text', provenance: 'blob:durable provenance',
      selectedFormulas: [{ name: 'blob:durable', nested: { text: 'blob:keep' } }],
    }));
    expect(storedHistory[0]).toEqual(expect.objectContaining({
      content: 'blob:legitimate LaTeX text', nested: { note: 'blob:durable nested text' },
    }));
    expect(storedHistory[0].selectedFormulas).toEqual([{ formula_id: 'blob-durable', name: 'blob:durable', nested: { text: 'blob:keep' } }]);
    expect(containsTransientBlob(storedSheet())).toBe(false);
    expect(containsTransientBlob(storedHistory)).toBe(false);
  });

  it('sanitizes Dashboard server formulas before storing the editor sheet', async () => {
    renderApp();

    fireEvent.click(screen.getByRole('link', { name: 'Open test dashboard' }));
    await screen.findByRole('button', { name: 'Edit sheet' });
    fireEvent.click(screen.getByRole('button', { name: 'Edit sheet' }));

    await waitFor(() => expect(storedSheet().id).toBe(77));
    expect(storedSheet().selectedFormulas).toEqual([{ name: 'blob:durable', nested: { text: 'blob:keep' } }]);
    expect(containsTransientBlob(storedSheet())).toBe(false);
  });

  it('merges canonical server formulas only when the submitted selection remains current', async () => {
    const save = deferred();
    localStorage.setItem('currentCheatSheet', JSON.stringify({
      draftId: 'draft-7', title: 'existing', content: '', contentSource: 'empty', columns: 4,
      fontSize: '9pt', spacing: 'small', margins: '0.15in', orientation: 'portrait', selectedFormulas: [], compileHistory: [],
    }));
    vi.stubGlobal('fetch', vi.fn(() => save.promise));
    renderApp();

    fireEvent.click(screen.getByRole('button', { name: 'Save formula A' }));
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    expect(JSON.parse(fetch.mock.calls[0][1].body).formula_selections).toEqual([{ formula_id: 'formula-a' }]);
    await act(async () => save.resolve(response({ id: 7, schema_version: 1, revision: 2, source_mode: 'raw', source_latex: 'formula content', layout: { columns: 4, font_size: '9pt', spacing: 'small', margins: '0.15in', orientation: 'portrait' }, formula_selections: [{ formula_id: 'formula-b' }] })));

    await waitFor(() => expect(storedSheet().selectedFormulas).toEqual([{ formula_id: 'formula-b' }]));
    expect(storedSheet().id).toBe(7);
    expect(containsTransientBlob(storedSheet())).toBe(false);
  });

  it('retains an intervening local formula selection when a save response arrives', async () => {
    const save = deferred();
    localStorage.setItem('currentCheatSheet', JSON.stringify({
      id: 7, draftId: 'sheet-7', title: 'existing', content: '', contentSource: 'empty', columns: 4,
      fontSize: '9pt', spacing: 'small', margins: '0.15in', orientation: 'portrait', selectedFormulas: [], compileHistory: [],
    }));
    vi.stubGlobal('fetch', vi.fn(() => save.promise));
    renderApp();

    fireEvent.click(screen.getByRole('button', { name: 'Save formula A' }));
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByRole('button', { name: 'Save formula C locally' }));
    await act(async () => save.resolve(response({ id: 7, selected_formulas: null })));

    await waitFor(() => expect(storedSheet().selectedFormulas).toEqual([{ formula_id: 'formula-c', class: 'Math', category: 'Algebra', name: 'C', nested: { text: 'blob:local' } }]));
    expect(storedSheet().id).toBe(7);
    expect(containsTransientBlob(storedSheet())).toBe(false);
  });

  it('retains a local formula C when canonical server formula B resolves an earlier save of A', async () => {
    const save = deferred();
    vi.stubGlobal('fetch', vi.fn(() => save.promise));
    renderApp();

    fireEvent.click(screen.getByRole('button', { name: 'Save formula A' }));
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    expect(JSON.parse(fetch.mock.calls[0][1].body).formula_selections).toEqual([{ formula_id: 'formula-a' }]);

    fireEvent.click(screen.getByRole('button', { name: 'Save formula C locally' }));
    await act(async () => save.resolve(response({ id: 88, schema_version: 1, revision: 2, source_mode: 'raw', source_latex: 'formula content', layout: { columns: 4, font_size: '9pt', spacing: 'small', margins: '0.15in', orientation: 'portrait' }, formula_selections: [{ formula_id: 'formula-b' }] })));

    const formulaC = [{ formula_id: 'formula-c', class: 'Math', category: 'Algebra', name: 'C', nested: { text: 'blob:local' } }];
    await waitFor(() => expect(storedSheet()).toEqual(expect.objectContaining({ id: 88, selectedFormulas: formulaC })));
    expect(JSON.parse(screen.getByTestId('sheet-state').textContent)).toEqual(expect.objectContaining({ id: 88, selectedFormulas: formulaC }));
    expect(containsTransientBlob(storedSheet())).toBe(false);
    expect(storedSheet().selectedFormulas[0].nested.text).toBe('blob:local');
  });
});

describe('App recovery and remote persistence integration', () => {
  beforeEach(() => {
    localStorage.clear();
    window.history.replaceState({}, '', '/');
    vi.stubGlobal('alert', vi.fn());
    vi.stubGlobal('ResizeObserver', class {
      observe() {}
      disconnect() {}
    });
    vi.stubGlobal('requestAnimationFrame', (callback) => setTimeout(callback, 0));
    vi.stubGlobal('cancelAnimationFrame', clearTimeout);
    vi.stubGlobal('URL', Object.assign(class extends globalThis.URL {}, {
      createObjectURL: vi.fn(() => 'blob:app-test'),
      revokeObjectURL: vi.fn(),
    }));
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  it('saves a matching recovered draft through the API and reloads its mapped server state', async () => {
    const recoveredFormula = { formula_id: 'newton-second-law', class: 'Physics 101', category: 'Forces', name: 'Newton Second Law' };
    const savedResponse = {
      id: 42,
      title: 'Recovered mechanics',
      schema_version: 1,
      revision: 7,
      source_mode: 'raw',
      source_latex: '\\documentclass{article}\nRecovered body',
      layout: { columns: 2, margins: '0.25in', font_size: '10pt', spacing: 'medium', orientation: 'landscape' },
      formula_selections: [{ formula_id: 'newton-second-law' }],
      template_id: null,
    };
    localStorage.setItem('currentCheatSheet', JSON.stringify({
      id: 42,
      draftId: 'sheet-42',
      revision: 6,
      base_revision: 6,
      title: 'Stale server title',
      content: 'stale server content',
      contentSource: 'generated',
      columns: 4,
      fontSize: '9pt',
      spacing: 'small',
      margins: '0.15in',
      orientation: 'portrait',
      selectedFormulas: [recoveredFormula],
      formulaSelections: [{ formula_id: 'newton-second-law' }],
      compileHistory: [],
    }));
    localStorage.setItem('cheatSheetLatex:sheet-42', JSON.stringify({
      title: savedResponse.title,
      content: savedResponse.source_latex,
      contentSource: 'manual',
      columns: savedResponse.layout.columns,
      fontSize: savedResponse.layout.font_size,
      spacing: savedResponse.layout.spacing,
      margins: savedResponse.layout.margins,
      orientation: savedResponse.layout.orientation,
    }));
    localStorage.setItem('cheatSheetData:sheet-42', JSON.stringify({
      selectedClasses: { 'Physics 101': true },
      selectedCategories: { 'Physics 101:Forces': true },
      groupedFormulas: [{ class: 'Physics 101', formulas: [recoveredFormula] }],
    }));

    vi.stubGlobal('fetch', vi.fn((url, _options = {}) => {
      if (url === '/api/classes/') {
        return Promise.resolve({ ok: true, json: async () => ({ classes: [{ name: 'Physics 101', categories: [
          { name: 'Motion', formulas: [{ id: 'velocity', name: 'Velocity' }] },
          { name: 'Forces', formulas: [{ id: 'newton-second-law', name: 'Newton Second Law' }] },
        ] }] }) });
      }
      if (url === '/api/cheatsheets/42/') return Promise.resolve(response(savedResponse));
      throw new Error(`Unexpected request: ${url}`);
    }));

    vi.doUnmock('./components/CreateCheatSheet');
    vi.resetModules();
    const [{ default: RealApp }, { default: RealAuthContext }] = await Promise.all([
      import('./App'),
      import('./context/AuthContext'),
    ]);
    const renderRealApp = () => render(
      <BrowserRouter>
        <RealAuthContext.Provider value={{ user: { username: 'tester' }, authTokens: { access: 'token' }, logoutUser: vi.fn() }}>
          <RealApp />
        </RealAuthContext.Provider>
      </BrowserRouter>,
    );

    const firstRender = renderRealApp();
    await screen.findByLabelText('Physics 101');
    expect(screen.getByLabelText(/Motion \(1 formulas\)/i)).not.toBeChecked();
    expect(screen.getByLabelText(/Forces \(1 formulas\)/i)).toBeChecked();
    expect(screen.getByLabelText(/Orientation:/i)).toHaveValue('landscape');
    expect(screen.getByLabelText(/Spacing:/i)).toHaveValue('medium');

    fireEvent.click(screen.getByTitle('Save (Ctrl + S)'));
    await waitFor(() => expect(fetch).toHaveBeenCalledWith('/api/cheatsheets/42/', expect.objectContaining({
      method: 'PATCH',
      body: JSON.stringify({
        schema_version: 1,
        title: savedResponse.title,
        source_mode: 'raw',
        source_latex: savedResponse.source_latex,
        layout: { columns: 2, font_size: '10pt', spacing: 'medium', margins: '0.25in', orientation: 'landscape' },
        formula_selections: [{ formula_id: 'newton-second-law' }],
        template_id: null,
        revision: 6,
      }),
    })));
    await waitFor(() => expect(storedSheet()).toEqual(expect.objectContaining({
      id: 42,
      title: savedResponse.title,
      content: savedResponse.source_latex,
      contentSource: 'manual',
      columns: 2,
      fontSize: '10pt',
      spacing: 'medium',
      margins: '0.25in',
      orientation: 'landscape',
      selectedFormulas: [{ formula_id: 'newton-second-law' }],
      revision: 7,
      baseRevision: 7,
    })));

    firstRender.unmount();
    localStorage.removeItem('cheatSheetLatex:sheet-42');
    localStorage.removeItem('cheatSheetData:sheet-42');
    renderRealApp();
    await screen.findByLabelText('Physics 101');
    expect(screen.getByLabelText(/Forces \(1 formulas\)/i)).toBeChecked();
    expect(screen.getByLabelText(/Orientation:/i)).toHaveValue('landscape');
    expect(screen.getByLabelText(/Spacing:/i)).toHaveValue('medium');
  });

  it('aborts an in-flight save on unmount and ignores its later response', async () => {
    const save = deferred();
    const abort = vi.fn();
    vi.stubGlobal('fetch', vi.fn((_url, options) => {
      options.signal.addEventListener('abort', abort);
      return save.promise;
    }));
    const rendered = renderApp();

    fireEvent.click(screen.getByRole('button', { name: 'Save first' }));
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    const beforeUnmount = storedSheet();
    rendered.unmount();
    expect(abort).toHaveBeenCalledTimes(1);

    await act(async () => save.resolve(response({ id: 99, title: 'stale title', latex_content: 'stale content' })));
    expect(storedSheet()).toEqual(beforeUnmount);
    expect(alert).not.toHaveBeenCalled();
  });
});
