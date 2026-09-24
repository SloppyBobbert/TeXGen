import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App';
import AuthContext from './context/AuthContext';
import { writeDraft } from './storage/draftStore';

vi.mock('react-pdf', () => ({
  Document: ({ children }) => <div>{children}</div>,
  Page: () => <div />,
  pdfjs: { GlobalWorkerOptions: { workerSrc: '' } },
}));
const classes = [{ name: 'UNIT CIRCLE', categories: [{ name: 'UNIT CIRCLE', formulas: [{ id: 'trig.unit-circle', name: 'Unit circle' }] }] }];
const mount = (authenticated = false, route = '/') => render(
  <MemoryRouter initialEntries={[route]}>
    <AuthContext.Provider value={{ user: authenticated ? { username: 'tester' } : null, authTokens: authenticated ? { access: 'test-token' } : null }}>
      <App />
    </AuthContext.Provider>
  </MemoryRouter>,
);
const selection = () => screen.getByLabelText('UNIT CIRCLE');
const editor = () => {
  const toggle = screen.queryByRole('button', { name: /Show LaTeX editor/i });
  if (toggle) fireEvent.click(toggle);
  return screen.getByLabelText(/Generated LaTeX Code:/i);
};
const home = async () => {
  fireEvent.click(screen.getByRole('link', { name: 'Home' }));
  await screen.findByLabelText('UNIT CIRCLE');
};

describe('real App/editor recovery boundaries', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.spyOn(window, 'alert').mockImplementation(() => {});
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} });
    vi.stubGlobal('fetch', vi.fn(async (url) => {
      if (url === '/api/classes/') return { ok: true, json: async () => ({ classes }) };
      throw new Error(`Unexpected request: ${url}`);
    }));
  });
  afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); localStorage.clear(); });

  it.each([{ selectedFormulas: [] }, { selectedFormulas: [{ class: 'UNIT CIRCLE', category: 'UNIT CIRCLE', name: 'Unit circle' }] }])('preserves no-envelope name-only recovery until an explicit choice (%j)', async ({ selectedFormulas }) => {
    const records = [{ class: 'UNIT CIRCLE', category: 'UNIT CIRCLE', name: 'Unit circle' }];
    localStorage.setItem('currentCheatSheet', JSON.stringify({ draftId: 'legacy-only', title: 'Older', content: 'OLDER CURRENT', contentSource: 'manual', selectedFormulas }));
    const source = JSON.stringify({ content: 'NEW UNSAVED SIDECAR', contentSource: 'manual' });
    const formulas = JSON.stringify({ groupedFormulas: [{ class: 'UNIT CIRCLE', formulas: records }] });
    localStorage.setItem('cheatSheetLatex:legacy-only', source);
    localStorage.setItem('cheatSheetData:legacy-only', formulas);
    let view = mount();
    await screen.findByLabelText('UNIT CIRCLE');
    expect(localStorage.getItem('cheatSheetLatex:legacy-only')).toBe(source);
    expect(localStorage.getItem('cheatSheetData:legacy-only')).toBe(formulas);
    expect(localStorage.getItem('cheatSheetDraft:v1:string:legacy-only')).toBeNull();
    view.unmount();
    view = mount();
    await screen.findByLabelText('UNIT CIRCLE');
    fireEvent.click(screen.getByRole('button', { name: 'Restore older-format recovery' }));
    await waitFor(() => expect(selection()).toBeChecked());
    expect(editor()).toHaveValue('NEW UNSAVED SIDECAR');
    await waitFor(() => expect(JSON.parse(localStorage.getItem('cheatSheetDraft:v1:string:legacy-only')).formula_selections).toEqual([{ formula_id: 'trig.unit-circle' }]));
    view.unmount();
    mount();
    await screen.findByLabelText('UNIT CIRCLE');
    expect(selection()).toBeChecked();
    expect(editor()).toHaveValue('NEW UNSAVED SIDECAR');
  });

  it('upgrades pre-fix split storage without discarding newer sidecar edits', async () => {
    localStorage.setItem('currentCheatSheet', JSON.stringify({ draftId: 'upgrade', content: 'OLD SOURCE' }));
    writeDraft(localStorage, { schema_version: 1, draft_identity: 'upgrade', base_revision: null, title: 'Old title', source_mode: 'raw', source_latex: 'OLD SOURCE', formula_selections: [], layout: { columns: 4, font_size: '9pt', spacing: 'small', margins: '0.15in', orientation: 'portrait' }, history: [] });
    localStorage.setItem('cheatSheetLatex:upgrade', JSON.stringify({ title: 'New title', content: 'NEW SIDECAR SOURCE', contentSource: 'manual' }));
    localStorage.setItem('cheatSheetData:upgrade', JSON.stringify({ groupedFormulas: [{ class: 'UNIT CIRCLE', formulas: [{ formula_id: 'trig.unit-circle', class: 'UNIT CIRCLE', category: 'UNIT CIRCLE', name: 'Unit circle' }] }] }));
    const view = mount();
    await screen.findByLabelText('UNIT CIRCLE');
    expect(editor()).toHaveValue('OLD SOURCE');
    fireEvent.click(selection());
    fireEvent.click(selection());
    expect(JSON.parse(localStorage.getItem('cheatSheetLatex:upgrade')).content).toBe('NEW SIDECAR SOURCE');
    fireEvent.click(screen.getByRole('button', { name: 'Restore older-format recovery' }));
    await waitFor(() => expect(selection()).toBeChecked());
    expect(editor()).toHaveValue('NEW SIDECAR SOURCE');
    view.unmount();
    mount();
    await screen.findByLabelText('UNIT CIRCLE');
    expect(selection()).toBeChecked();
    expect(editor()).toHaveValue('NEW SIDECAR SOURCE');
  });

  it('does not resurrect stale sidecars over an explicit canonical clear and remembers the choice', async () => {
    localStorage.setItem('currentCheatSheet', JSON.stringify({ draftId: 'cleared-upgrade' }));
    writeDraft(localStorage, { schema_version: 1, draft_identity: 'cleared-upgrade', base_revision: 2, title: 'Cleared', source_mode: 'empty', source_latex: '', formula_selections: [], layout: { columns: 4, font_size: '9pt', spacing: 'small', margins: '0.15in', orientation: 'portrait' }, history: [] });
    localStorage.setItem('cheatSheetLatex:cleared-upgrade', JSON.stringify({ content: 'STALE SOURCE', contentSource: 'manual' }));
    localStorage.setItem('cheatSheetData:cleared-upgrade', JSON.stringify([{ formula_id: 'trig.unit-circle' }]));
    let view = mount();
    await screen.findByLabelText('UNIT CIRCLE');
    expect(selection()).not.toBeChecked();
    expect(screen.queryByRole('button', { name: /Show LaTeX editor/i })).not.toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem('cheatSheetLatex:cleared-upgrade')).content).toBe('STALE SOURCE');
    view.unmount();
    view = mount();
    await screen.findByLabelText('UNIT CIRCLE');
    fireEvent.click(screen.getByRole('button', { name: 'Keep canonical draft' }));
    view.unmount();
    mount();
    await screen.findByLabelText('UNIT CIRCLE');
    expect(selection()).not.toBeChecked();
    expect(screen.queryByRole('button', { name: 'Keep canonical draft' })).not.toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem('cheatSheetLatex:cleared-upgrade')).content).toBe('');
  });

  it.each([false, true])('hydrates a clean canonical copy idempotently (single-owner marker: %s)', async (marked) => {
    localStorage.setItem('currentCheatSheet', JSON.stringify({ draftId: 'clean-upgrade' }));
    writeDraft(localStorage, { schema_version: 1, draft_identity: 'clean-upgrade', session_snapshot: marked, base_revision: 2, title: 'Clean', source_mode: 'raw', source_latex: 'CANONICAL SOURCE', formula_selections: [], layout: { columns: 4, font_size: '9pt', spacing: 'small', margins: '0.15in', orientation: 'portrait' }, history: [] });
    localStorage.setItem('cheatSheetLatex:clean-upgrade', JSON.stringify({ content: marked ? 'STALE SIDECAR' : 'CANONICAL SOURCE', contentSource: 'manual' }));
    const view = mount();
    await screen.findByLabelText('UNIT CIRCLE');
    expect(editor()).toHaveValue('CANONICAL SOURCE');
    expect(screen.queryByRole('button', { name: 'Keep canonical draft' })).not.toBeInTheDocument();
    view.unmount();
    mount();
    await screen.findByLabelText('UNIT CIRCLE');
    expect(editor()).toHaveValue('CANONICAL SOURCE');
    expect(screen.queryByRole('button', { name: 'Keep canonical draft' })).not.toBeInTheDocument();
  });

  it('retains selections and explicit empty selections across routes and reload', async () => {
    let view = mount();
    await screen.findByLabelText('UNIT CIRCLE');
    fireEvent.click(selection());
    fireEvent.click(screen.getByRole('link', { name: 'Login' }));
    await home();
    expect(selection()).toBeChecked();
    view.unmount();
    view = mount();
    await screen.findByLabelText('UNIT CIRCLE');
    expect(selection()).toBeChecked();
    fireEvent.click(selection());
    fireEvent.click(screen.getByRole('link', { name: 'Login' }));
    await home();
    expect(selection()).not.toBeChecked();
    view.unmount();
    mount();
    await screen.findByLabelText('UNIT CIRCLE');
    expect(selection()).not.toBeChecked();
  });

  it('keeps unsynced Dashboard recovery across reload but refreshes a clean remote copy', async () => {
    let remote = { id: 42, schema_version: 1, revision: 1, title: 'Remote sheet', source_latex: 'SERVER COPY', source_mode: 'raw', formula_selections: [], layout: { columns: 4, font_size: '9pt', spacing: 'small', margins: '0.15in', orientation: 'portrait' } };
    let offline = true;
    fetch.mockImplementation(async (url, options = {}) => {
      if (url === '/api/classes/') return { ok: true, json: async () => ({ classes }) };
      if (url === '/api/cheatsheets/') return { ok: true, json: async () => [remote] };
      if (url === '/api/cheatsheets/42/' && options.method === 'PATCH') {
        if (offline) throw new Error('Offline');
        remote = { ...remote, ...JSON.parse(options.body), revision: remote.revision + 1 };
        return { ok: true, json: async () => remote };
      }
      if (url === '/api/compile/') return { ok: false, json: async () => ({ error: 'Preview unavailable' }) };
      throw new Error(`Unexpected request: ${url}`);
    });
    let view = mount(true, '/dashboard');
    fireEvent.click(await screen.findByRole('button', { name: 'Edit' }));
    await screen.findByLabelText('UNIT CIRCLE');
    expect(editor()).toHaveValue('SERVER COPY');
    fireEvent.change(editor(), { target: { value: 'UNSYNCED EDIT' } });
    fireEvent.click(screen.getByTitle('Save (Ctrl + S)'));
    await screen.findByText('Failed to save. Please try again.');
    fireEvent.click(screen.getByRole('link', { name: 'Dashboard' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Create New Sheet' }));
    await screen.findByLabelText('UNIT CIRCLE');
    expect(selection()).not.toBeChecked();
    expect(screen.queryByRole('button', { name: /Show LaTeX editor/i })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('link', { name: 'Dashboard' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Edit' }));
    await screen.findByLabelText('UNIT CIRCLE');
    expect(editor()).toHaveValue('UNSYNCED EDIT');
    view.unmount();
    view = mount(true, '/dashboard');
    fireEvent.click(await screen.findByRole('button', { name: 'Edit' }));
    await screen.findByLabelText('UNIT CIRCLE');
    expect(editor()).toHaveValue('UNSYNCED EDIT');
    offline = false;
    fireEvent.click(screen.getByTitle('Save (Ctrl + S)'));
    await screen.findByText('Cheat sheet saved successfully!');
    remote = { ...remote, revision: remote.revision + 1, source_latex: 'NEW SERVER COPY' };
    fireEvent.click(screen.getByRole('link', { name: 'Dashboard' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Edit' }));
    await screen.findByLabelText('UNIT CIRCLE');
    expect(editor()).toHaveValue('NEW SERVER COPY');
  });

  it.each(['SERVER COPY', 'UNSYNCED COPY'])('handles pre-fix remote recovery without guessing its sync state: %s', async (source) => {
    const layout = { columns: 4, font_size: '9pt', spacing: 'small', margins: '0.15in', orientation: 'portrait' };
    localStorage.setItem('currentCheatSheet', JSON.stringify({ id: 42, draftId: 'sheet-42' }));
    writeDraft(localStorage, { schema_version: 1, draft_identity: 'sheet-42', base_revision: 1, title: 'Remote', source_mode: 'raw', source_latex: source, formula_selections: [], layout, history: [] });
    fetch.mockImplementation(async (url) => {
      if (url === '/api/classes/') return { ok: true, json: async () => ({ classes }) };
      if (url === '/api/cheatsheets/') return { ok: true, json: async () => [{ id: 42, schema_version: 1, revision: 1, title: 'Remote', source_mode: 'raw', source_latex: 'SERVER COPY', formula_selections: [], layout }] };
      if (url === '/api/compile/') return { ok: false, json: async () => ({ error: 'Preview unavailable' }) };
      throw new Error(`Unexpected request: ${url}`);
    });
    mount(true, '/dashboard');
    fireEvent.click(await screen.findByRole('button', { name: 'Edit' }));
    await screen.findByLabelText('UNIT CIRCLE');
    expect(editor()).toHaveValue('SERVER COPY');
    if (source === 'UNSYNCED COPY') {
      expect(JSON.parse(localStorage.getItem('cheatSheetDraft:v1:string:sheet-42')).source_latex).toBe(source);
      fireEvent.click(screen.getByRole('button', { name: 'Restore older-format recovery' }));
      await screen.findByLabelText('UNIT CIRCLE');
      expect(editor()).toHaveValue(source);
    } else expect(screen.queryByRole('button', { name: 'Keep canonical draft' })).not.toBeInTheDocument();
  });

  it('recovers a newly created sheet by server identity after switching to another draft', async () => {
    localStorage.setItem('currentCheatSheet', JSON.stringify({ draftId: 'new-local', content: 'CREATE SOURCE', contentSource: 'manual' }));
    let remote;
    fetch.mockImplementation(async (url, options = {}) => {
      if (url === '/api/classes/') return { ok: true, json: async () => ({ classes }) };
      if (url === '/api/cheatsheets/' && options.method === 'POST') {
        remote = { ...JSON.parse(options.body), id: 81, revision: 1 };
        return { ok: true, json: async () => remote, clone: () => ({ json: async () => remote }) };
      }
      if (url === '/api/cheatsheets/') return { ok: true, json: async () => [remote] };
      if (url === '/api/compile/') return { ok: false, json: async () => ({ error: 'Preview unavailable' }) };
      throw new Error(`Unexpected request: ${url}`);
    });
    const view = mount(true);
    await screen.findByLabelText('UNIT CIRCLE');
    fireEvent.click(screen.getByTitle('Save (Ctrl + S)'));
    await screen.findByText('Cheat sheet saved successfully!');
    fireEvent.change(editor(), { target: { value: 'UNSYNCED NEW SHEET' } });
    fireEvent.click(selection());
    fireEvent.click(screen.getByRole('link', { name: 'Dashboard' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Create New Sheet' }));
    await screen.findByLabelText('UNIT CIRCLE');
    expect(selection()).not.toBeChecked();
    view.unmount();
    mount(true, '/dashboard');
    fireEvent.click(await screen.findByRole('button', { name: 'Edit' }));
    await screen.findByLabelText('UNIT CIRCLE');
    expect(editor()).toHaveValue('UNSYNCED NEW SHEET');
    expect(selection()).toBeChecked();
  });

  it.each([false, true, 'reopened'])('discards only confirmed Clear recovery across Dashboard/reload (first create: %s)', async (firstCreate) => {
    let remote = { id: 42, schema_version: 1, revision: 1, title: 'Remote', source_mode: 'raw', source_latex: 'SERVER COPY', formula_selections: [], layout: { columns: 4, font_size: '9pt', spacing: 'small', margins: '0.15in', orientation: 'portrait' } };
    let compileSucceeds = false;
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:test');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    const unrelatedKeys = ['cheatSheetDraft:v1:string:other', 'cheatSheetLatex:other', 'cheatSheetData:other', 'cheatSheetCompileHistory:other', 'cheatSheetContentSource:other', 'cheatSheetCompileHistory:99', 'cheatSheetContentSource:99'];
    unrelatedKeys.forEach((key) => localStorage.setItem(key, 'keep'));
    if (firstCreate) localStorage.setItem('currentCheatSheet', JSON.stringify({ draftId: 'first-local', content: 'SERVER COPY', contentSource: 'manual' }));
    fetch.mockImplementation(async (url, options = {}) => {
      if (url === '/api/classes/') return { ok: true, json: async () => ({ classes }) };
      if (url === '/api/cheatsheets/' && options.method === 'POST') {
        remote = { ...remote, ...JSON.parse(options.body) };
        return { ok: true, json: async () => remote, clone: () => ({ json: async () => remote }) };
      }
      if (url === '/api/cheatsheets/') return { ok: true, json: async () => [remote] };
      if (url === '/api/compile/') return compileSucceeds
        ? { ok: true, blob: async () => new Blob(['pdf']) }
        : { ok: false, json: async () => ({ error: 'Preview unavailable' }) };
      throw new Error(`Unexpected request: ${url}`);
    });
    let view = mount(true, firstCreate ? '/' : '/dashboard');
    if (!firstCreate) fireEvent.click(await screen.findByRole('button', { name: 'Edit' }));
    await screen.findByLabelText('UNIT CIRCLE');
    if (firstCreate) {
      fireEvent.click(screen.getByTitle('Save (Ctrl + S)'));
      await screen.findByText('Cheat sheet saved successfully!');
    }
    fireEvent.change(editor(), { target: { value: 'DISCARD UNSYNCED' } });
    fireEvent.click(selection());
    const identity = firstCreate ? 'first-local' : 'sheet-42';
    compileSucceeds = true;
    fireEvent.click(screen.getByRole('button', { name: /Compile PDF/i }));
    await waitFor(() => expect(JSON.parse(localStorage.getItem('cheatSheetCompileHistory:42'))).toEqual([
      expect.objectContaining({ content: 'DISCARD UNSYNCED', formulaSelections: [{ formula_id: 'trig.unit-circle' }] }),
    ]));
    compileSucceeds = false;
    fireEvent.click(screen.getByRole('button', { name: 'Snapshots (1)' }));
    expect(screen.getByRole('region', { name: 'Compile snapshots' })).toBeInTheDocument();
    const numericHistory = localStorage.getItem('cheatSheetCompileHistory:42');
    const numericSource = localStorage.getItem('cheatSheetContentSource:42');
    if (firstCreate === 'reopened') {
      fireEvent.click(screen.getByRole('link', { name: 'Dashboard' }));
      fireEvent.click(await screen.findByRole('button', { name: 'Create New Sheet' }));
      expect(localStorage.getItem('cheatSheetCompileHistory:42')).toBe(numericHistory);
      expect(localStorage.getItem('cheatSheetContentSource:42')).toBe(numericSource);
      view.unmount();
      view = mount(true, '/dashboard');
      fireEvent.click(await screen.findByRole('button', { name: 'Edit' }));
      await screen.findByLabelText('UNIT CIRCLE');
      expect(editor()).toHaveValue('DISCARD UNSYNCED');
    }
    const before = localStorage.getItem(`cheatSheetDraft:v1:string:${identity}`);
    window.confirm.mockReturnValueOnce(false);
    fireEvent.click(screen.getByRole('button', { name: /Clear/i }));
    expect(editor()).toHaveValue('DISCARD UNSYNCED');
    expect(localStorage.getItem(`cheatSheetDraft:v1:string:${identity}`)).toBe(before);
    expect(localStorage.getItem('cheatSheetCompileHistory:42')).toBe(numericHistory);
    fireEvent.click(screen.getByRole('button', { name: /Clear/i }));
    expect(localStorage.getItem('cheatSheetCompileHistory:42')).toBeNull();
    expect(localStorage.getItem('cheatSheetContentSource:42')).toBeNull();
    fireEvent.click(screen.getByRole('link', { name: 'Dashboard' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Edit' }));
    await screen.findByLabelText('UNIT CIRCLE');
    expect(editor()).toHaveValue('SERVER COPY');
    expect(selection()).not.toBeChecked();
    expect(screen.getByRole('button', { name: 'Snapshots' })).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Restore' })).not.toBeInTheDocument();
    if (firstCreate) {
      for (const prefix of ['cheatSheetDraft:v1:string:', 'cheatSheetLatex:', 'cheatSheetData:', 'cheatSheetCompileHistory:', 'cheatSheetContentSource:']) expect(localStorage.getItem(`${prefix}first-local`)).toBeNull();
    }
    unrelatedKeys.forEach((key) => expect(localStorage.getItem(key)).toBe('keep'));
    expect(fetch.mock.calls.some(([, options]) => options?.method === 'DELETE')).toBe(false);
    view.unmount();
    view = mount(true, '/dashboard');
    fireEvent.click(await screen.findByRole('button', { name: 'Edit' }));
    await screen.findByLabelText('UNIT CIRCLE');
    expect(editor()).toHaveValue('SERVER COPY');
    expect(selection()).not.toBeChecked();
    expect(screen.getByRole('button', { name: 'Snapshots' })).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Restore' })).not.toBeInTheDocument();
    expect(localStorage.getItem('cheatSheetCompileHistory:42')).toBeNull();
  });

  it.each(['manual', 'compile'])('does not report saved after %s persistence fails', async (mode) => {
    localStorage.setItem('currentCheatSheet', JSON.stringify({ draftId: 'failure-test', content: 'source to keep', contentSource: 'manual' }));
    fetch.mockImplementation(async (url) => {
      if (url === '/api/classes/') return { ok: true, json: async () => ({ classes }) };
      if (url === '/api/compile/') return { ok: true, blob: async () => new Blob(['pdf']) };
      throw new Error(`Unexpected request: ${url}`);
    });
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:test');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    mount(mode === 'compile');
    await screen.findByLabelText('UNIT CIRCLE');
    const setItem = window.Storage.prototype.setItem;
    vi.spyOn(window.Storage.prototype, 'setItem').mockImplementation(function (key, value) {
      if (key.startsWith('cheatSheetDraft:')) throw new window.DOMException('Full', 'QuotaExceededError');
      return setItem.call(this, key, value);
    });
    if (mode === 'manual') fireEvent.keyDown(window, { key: 's', ctrlKey: true });
    else fireEvent.click(screen.getByRole('button', { name: /Compile PDF/i }));
    await screen.findByText('Offline changes pending');
    expect(screen.queryByText('Cheat sheet saved successfully!')).not.toBeInTheDocument();
    expect(screen.queryByText('Saved just now')).not.toBeInTheDocument();
    expect(editor()).toHaveValue('source to keep');
  });

  it('keeps the first Generate usable when all writes fail, then allows saving again', async () => {
    mount();
    await screen.findByLabelText('UNIT CIRCLE');
    fireEvent.click(selection());
    const failure = vi.spyOn(window.Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('Storage full'); });
    fireEvent.click(screen.getByRole('button', { name: /Generate \/ Regenerate/i }));
    expect(screen.getByRole('heading', { name: 'Cheat Sheet Generator' })).toBeInTheDocument();
    failure.mockRestore();
    fireEvent.click(screen.getByTitle('Save (Ctrl + S)'));
    await screen.findByText('Cheat sheet saved successfully!');
    expect(JSON.parse(localStorage.getItem('currentCheatSheet')).formulaSelections).toEqual([{ formula_id: 'trig.unit-circle' }]);
  });

  it.each(['all', 'alias', 'cheatSheetCompileHistory:42', 'cheatSheetContentSource:42'])('reports incomplete Clear and keeps edits usable when removal fails: %s', async (failureAt) => {
    const compileHistory = [{ content: 'BROWSER ONLY', contentSource: 'manual', formulaSelections: [{ formula_id: 'trig.unit-circle' }] }];
    localStorage.setItem('currentCheatSheet', JSON.stringify({ id: 42, draftId: 'clear-test', content: 'old source', compileHistory }));
    localStorage.setItem('cheatSheetCompileHistory:42', JSON.stringify(compileHistory));
    localStorage.setItem('cheatSheetContentSource:42', 'manual');
    let view = mount();
    await screen.findByLabelText('UNIT CIRCLE');
    fireEvent.click(selection());
    const removeItem = window.Storage.prototype.removeItem;
    const failure = vi.spyOn(window.Storage.prototype, 'removeItem').mockImplementation(function (key) {
      if (failureAt === 'all' || key === (failureAt === 'alias' ? 'cheatSheetDraft:v1:string:sheet-42' : failureAt)) throw new Error('Removal blocked');
      return removeItem.call(this, key);
    });
    fireEvent.click(screen.getByRole('button', { name: /Clear/i }));
    expect(window.alert).toHaveBeenCalledWith(expect.stringContaining('Unable to discard all browser recovery data'));
    expect(selection()).toBeChecked();
    expect(editor()).toHaveValue('old source');
    expect(JSON.parse(localStorage.getItem('currentCheatSheet')).draftId).toBe('clear-test');
    if (failureAt === 'alias') expect(localStorage.getItem('cheatSheetDraft:v1:string:clear-test')).toBeNull();
    fireEvent.change(editor(), { target: { value: 'still editable' } });
    expect(editor()).toHaveValue('still editable');
    failure.mockRestore();
    fireEvent.click(screen.getByRole('button', { name: /Clear/i }));
    await waitFor(() => expect(selection()).not.toBeChecked());
    expect(JSON.parse(localStorage.getItem('currentCheatSheet')).content).toBe('');
    expect(JSON.parse(localStorage.getItem('currentCheatSheet')).draftId).not.toBe('clear-test');
    view.unmount();
    view = mount();
    await screen.findByLabelText('UNIT CIRCLE');
    expect(selection()).not.toBeChecked();
    expect(screen.queryByRole('button', { name: /Show LaTeX editor/i })).not.toBeInTheDocument();
  });

  it('reports failure to persist the empty draft after Clear without restoring discarded content', async () => {
    localStorage.setItem('currentCheatSheet', JSON.stringify({ draftId: 'clear-write-failure', content: 'discard me', contentSource: 'manual' }));
    const view = mount();
    await screen.findByLabelText('UNIT CIRCLE');
    const failure = vi.spyOn(window.Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('Storage full'); });
    fireEvent.click(screen.getByRole('button', { name: /Clear/i }));
    expect(window.alert).toHaveBeenCalledWith(expect.stringContaining('new empty draft could not be saved'));
    expect(localStorage.getItem('currentCheatSheet')).toBeNull();
    expect(localStorage.getItem('cheatSheetDraft:v1:string:clear-write-failure')).toBeNull();
    await screen.findByLabelText('UNIT CIRCLE');
    expect(selection()).not.toBeChecked();
    failure.mockRestore();
    view.unmount();
    mount();
    await screen.findByLabelText('UNIT CIRCLE');
    expect(screen.queryByRole('button', { name: /Show LaTeX editor/i })).not.toBeInTheDocument();
  });

  it('retains source when navigating immediately after input, then reloading', async () => {
    localStorage.setItem('currentCheatSheet', JSON.stringify({ draftId: 'source-test', content: 'seed source' }));
    let view = mount();
    await screen.findByLabelText('UNIT CIRCLE');
    fireEvent.change(editor(), { target: { value: 'EARLIER SOURCE' } });
    fireEvent.click(screen.getByTitle('Save (Ctrl + S)'));
    await screen.findByText('Cheat sheet saved successfully!');
    fireEvent.change(editor(), { target: { value: 'LATEST SOURCE' } });
    fireEvent.click(screen.getByRole('link', { name: 'Login' }));
    await home();
    expect(editor()).toHaveValue('LATEST SOURCE');
    view.unmount();
    view = mount();
    await screen.findByLabelText('UNIT CIRCLE');
    expect(editor()).toHaveValue('LATEST SOURCE');
  });
});
