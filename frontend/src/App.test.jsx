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
          selectedFormulas: [{ name: 'snapshot formula' }],
          compileSnapshot: {
            title: 'snapshot title',
            content: 'snapshot content',
            contentSource: 'generated',
            columns: 4,
            fontSize: '9pt',
            spacing: 'small',
            margins: '0.15in',
            orientation: 'portrait',
            selectedFormulas: [{ name: 'snapshot formula' }],
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
          selectedFormulas: [{ name: 'blob:durable', pdfBlob: 'blob:transient', nested: { text: 'blob:keep', pdfBlob: 'blob:drop' } }],
          provenance: 'blob:durable provenance', pdfBlob: 'blob:top-level-pdf',
          compileSnapshot: {
            title: 'blob:notes', content: 'blob:legitimate LaTeX text', contentSource: 'manual', columns: 4,
            fontSize: '9pt', spacing: 'small', margins: '0.15in', orientation: 'portrait',
            selectedFormulas: [{ name: 'blob:durable', pdfBlob: 'blob:transient', nested: { text: 'blob:keep', pdfBlob: 'blob:drop' } }],
            nested: { note: 'blob:durable nested text', pdfBlob: 'blob:nested-pdf' }, pdfBlob: 'blob:snapshot-pdf',
          },
        })}>Save durable blob text</button>
        <button onClick={() => onSave({
          title: 'formula save', content: 'formula content', contentSource: 'manual',
          selectedFormulas: [{ class: 'Math', category: 'Algebra', name: 'A', nested: { text: 'blob:keep', pdfBlob: 'blob:drop' } }],
        })}>Save formula A</button>
        <button onClick={() => onSave({
          selectedFormulas: [{ class: 'Math', category: 'Algebra', name: 'C', nested: { text: 'blob:local' } }],
        }, false)}>Save formula C locally</button>
        <button onClick={() => onRestoreSnapshot({ orientation: 'landscape' })}>Restore orientation</button>
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
      contentSource: 'generated', orientation: 'portrait', selectedFormulas: [{ name: 'snapshot formula' }],
      compileHistory: [expect.objectContaining({ title: 'snapshot title' })],
    })));
    firstRender.unmount();
    renderApp();

    expect(JSON.parse(screen.getByTestId('sheet-state').textContent)).toEqual(expect.objectContaining({
      contentSource: 'generated', orientation: 'portrait', selectedFormulas: [{ name: 'snapshot formula' }],
      compileHistory: [expect.objectContaining({ title: 'snapshot title' })],
    }));
    fireEvent.click(screen.getByRole('button', { name: 'Restore orientation' }));
    await waitFor(() => expect(storedSheet().orientation).toBe('landscape'));
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
      title: 'blob:notes', latex_content: 'blob:legitimate LaTeX text',
      selected_formulas: [{ name: 'blob:durable', nested: { text: 'blob:keep' } }],
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
    expect(storedHistory[0].selectedFormulas).toEqual([{ name: 'blob:durable', nested: { text: 'blob:keep' } }]);
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
    const canonicalFormula = { class: 'Math', category: 'Canonical', name: 'B', nested: { text: 'blob:server', pdfBlob: 'blob:drop' }, pdfBlob: 'blob:transient' };
    localStorage.setItem('currentCheatSheet', JSON.stringify({
      draftId: 'draft-7', title: 'existing', content: '', contentSource: 'empty', columns: 4,
      fontSize: '9pt', spacing: 'small', margins: '0.15in', orientation: 'portrait', selectedFormulas: [], compileHistory: [],
    }));
    vi.stubGlobal('fetch', vi.fn(() => save.promise));
    renderApp();

    fireEvent.click(screen.getByRole('button', { name: 'Save formula A' }));
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    expect(JSON.parse(fetch.mock.calls[0][1].body).selected_formulas).toEqual([{ class: 'Math', category: 'Algebra', name: 'A', nested: { text: 'blob:keep' } }]);
    await act(async () => save.resolve(response({ id: 7, selected_formulas: [canonicalFormula] })));

    await waitFor(() => expect(storedSheet().selectedFormulas).toEqual([{ class: 'Math', category: 'Canonical', name: 'B', nested: { text: 'blob:server' } }]));
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

    await waitFor(() => expect(storedSheet().selectedFormulas).toEqual([{ class: 'Math', category: 'Algebra', name: 'C', nested: { text: 'blob:local' } }]));
    expect(storedSheet().id).toBe(7);
    expect(containsTransientBlob(storedSheet())).toBe(false);
  });

  it('retains a local formula C when canonical server formula B resolves an earlier save of A', async () => {
    const save = deferred();
    const canonicalFormula = {
      class: 'Math', category: 'Canonical', name: 'B', durable: 'blob:server value',
      nested: { text: 'blob:server nested', pdfBlob: 'blob:drop' }, pdfBlob: 'blob:transient',
    };
    vi.stubGlobal('fetch', vi.fn(() => save.promise));
    renderApp();

    fireEvent.click(screen.getByRole('button', { name: 'Save formula A' }));
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    expect(JSON.parse(fetch.mock.calls[0][1].body).selected_formulas).toEqual([
      { class: 'Math', category: 'Algebra', name: 'A', nested: { text: 'blob:keep' } },
    ]);

    fireEvent.click(screen.getByRole('button', { name: 'Save formula C locally' }));
    await act(async () => save.resolve(response({ id: 88, selected_formulas: [canonicalFormula] })));

    const formulaC = [{ class: 'Math', category: 'Algebra', name: 'C', nested: { text: 'blob:local' } }];
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
    const recoveredFormula = { class: 'Physics 101', category: 'Forces', name: 'Newton Second Law' };
    const savedResponse = {
      id: 42,
      title: 'Recovered mechanics',
      latex_content: '\\documentclass{article}\nRecovered body',
      content_source: 'manual',
      columns: 2,
      margins: '0.25in',
      font_size: '10pt',
      spacing: 'medium',
      orientation: 'landscape',
      selected_formulas: [recoveredFormula],
    };
    localStorage.setItem('currentCheatSheet', JSON.stringify({
      id: 42,
      draftId: 'sheet-42',
      title: 'Stale server title',
      content: 'stale server content',
      contentSource: 'generated',
      columns: 4,
      fontSize: '9pt',
      spacing: 'small',
      margins: '0.15in',
      orientation: 'portrait',
      selectedFormulas: [{ class: 'Physics 101', category: 'Motion', name: 'Velocity' }],
      compileHistory: [],
    }));
    localStorage.setItem('cheatSheetLatex:sheet-42', JSON.stringify({
      title: savedResponse.title,
      content: savedResponse.latex_content,
      contentSource: savedResponse.content_source,
      columns: savedResponse.columns,
      fontSize: savedResponse.font_size,
      spacing: savedResponse.spacing,
      margins: savedResponse.margins,
      orientation: savedResponse.orientation,
    }));
    localStorage.setItem('cheatSheetData:sheet-42', JSON.stringify({
      selectedClasses: { 'Physics 101': true },
      selectedCategories: { 'Physics 101:Forces': true },
      groupedFormulas: [{ class: 'Physics 101', formulas: [recoveredFormula] }],
    }));

    vi.stubGlobal('fetch', vi.fn((url, _options = {}) => {
      if (url === '/api/classes/') {
        return Promise.resolve({ ok: true, json: async () => ({ classes: [{ name: 'Physics 101', categories: [
          { name: 'Motion', formulas: [{ name: 'Velocity' }] },
          { name: 'Forces', formulas: [{ name: 'Newton Second Law' }] },
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
        title: savedResponse.title,
        latex_content: savedResponse.latex_content,
        content_source: 'manual',
        columns: 2,
        margins: '0.25in',
        font_size: '10pt',
        spacing: 'medium',
        orientation: 'landscape',
        selected_formulas: [recoveredFormula],
      }),
    })));
    await waitFor(() => expect(storedSheet()).toEqual(expect.objectContaining({
      id: 42,
      title: savedResponse.title,
      content: savedResponse.latex_content,
      contentSource: 'manual',
      columns: 2,
      fontSize: '10pt',
      spacing: 'medium',
      margins: '0.25in',
      orientation: 'landscape',
      selectedFormulas: [recoveredFormula],
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
