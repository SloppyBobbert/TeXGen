import { renderHook, act, waitFor } from '@testing-library/react';
import { useLatex } from './latex';
import AuthContext from '../context/AuthContext';
import { vi, afterEach } from 'vitest';

// Mock localStorage
const mockLocalStorage = (() => {
  let store = {};
  return {
    getItem: (key) => store[key] ?? null,
    setItem: (key, value) => { store[key] = value.toString(); },
    removeItem: (key) => { delete store[key]; },
    clear: () => { store = {}; }
  };
})();
const deferred = () => {
  let resolve;
  const promise = new Promise((nextResolve) => { resolve = nextResolve; });
  return { promise, resolve };
};

describe('useLatex hook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLocalStorage.clear();
    vi.stubGlobal('localStorage', mockLocalStorage);
    vi.stubGlobal('URL', {
      createObjectURL: vi.fn(() => 'blob:test-url'),
      revokeObjectURL: vi.fn(),
    });
    vi.stubGlobal('fetch', vi.fn());
    vi.stubGlobal('alert', vi.fn());
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    mockLocalStorage.clear();
  });

  const wrapper = ({ children }) => (
    <AuthContext.Provider value={{ authTokens: { access: 'test-token' } }}>
      {children}
    </AuthContext.Provider>
  );
  const signedOutWrapper = ({ children }) => (
    <AuthContext.Provider value={{ authTokens: null }}>
      {children}
    </AuthContext.Provider>
  );

  test.each(['title', 'add selection', 'reorder selections'])('rejects pending generation after a newer %s edit', async (change) => {
    const first = { formula_id: 'test.first' };
    const second = { formula_id: 'test.second' };
    const selections = [first, second];
    const pending = deferred();
    const readBody = vi.fn(() => pending.promise);
    fetch.mockResolvedValue({ ok: true, json: readBody });
    const initial = { title: 'original title', content: 'manual source', contentSource: 'manual' };
    const { result, rerender } = renderHook(
      ({ selected }) => useLatex(initial, 'generation-edit', selected),
      { initialProps: { selected: selections }, wrapper: signedOutWrapper },
    );
    expect(result.current.canGoBack).toBe(false);
    let generation;
    act(() => { generation = result.current.handleGenerateSheet(selections); });
    await waitFor(() => expect(readBody).toHaveBeenCalledOnce());
    const signal = fetch.mock.calls[0][1].signal;
    if (change === 'title') act(() => result.current.setTitle('new user title'));
    else rerender({ selected: change === 'add selection' ? [...selections, { formula_id: 'test.third' }] : [second, first] });
    await act(async () => {
      pending.resolve({ tex_code: 'obsolete generation', generated_sections: null });
      await generation;
    });
    expect(result.current.title).toBe(change === 'title' ? 'new user title' : 'original title');
    expect(result.current.content).toBe('manual source');
    expect(result.current.canGoBack).toBe(false);
    expect(result.current.isGenerating).toBe(false);
    expect(signal.aborted).toBe(true);
  });

  test.each(['edit', 'unmount'])('aborts a pending PDF body after %s', async (change) => {
    const pending = deferred();
    const readBlob = vi.fn(() => pending.promise);
    fetch.mockResolvedValue({ ok: true, blob: readBlob });
    const { result, unmount } = renderHook(() => useLatex({ content: 'manual source', contentSource: 'manual' }, 'body-lifetime'), { wrapper });
    let compile;
    act(() => { compile = result.current.handleCompileOnly(); });
    await waitFor(() => expect(readBlob).toHaveBeenCalledOnce());
    const signal = fetch.mock.calls[0][1].signal;
    if (change === 'unmount') unmount();
    else act(() => result.current.handleContentChange('new source'));
    await act(async () => { pending.resolve(new Blob(['old PDF'])); await compile; });
    expect(signal.aborted).toBe(true);
    expect(URL.createObjectURL).not.toHaveBeenCalled();
  });

  test.each(['logout', 'account switch'])('ignores a pending PDF body after %s without changing source', async (change) => {
    let auth = { authTokens: { access: 'first' }, authSessionVersion: 1 };
    const sessionWrapper = ({ children }) => <AuthContext.Provider value={auth}>{children}</AuthContext.Provider>;
    const pending = deferred();
    const readBlob = vi.fn(() => pending.promise);
    fetch.mockResolvedValue({ ok: true, blob: readBlob });
    const { result, rerender } = renderHook(() => useLatex({ content: 'manual source', contentSource: 'manual' }, 'session-compile'), { wrapper: sessionWrapper });
    let compile;
    act(() => { compile = result.current.handleCompileOnly(); });
    await waitFor(() => expect(readBlob).toHaveBeenCalledOnce());
    auth = { authTokens: change === 'logout' ? null : { access: 'second' }, authSessionVersion: 2 };
    rerender();
    await act(async () => { pending.resolve(new Blob(['old PDF'])); await compile; });
    expect(result.current.content).toBe('manual source');
    expect(result.current.pdfBlob).toBeNull();
    expect(result.current.lastCompileSnapshot).toBeNull();
    expect(result.current.isCompiling).toBe(false);
    expect(URL.createObjectURL).not.toHaveBeenCalled();
    expect(fetch.mock.calls[0][1].signal.aborted).toBe(true);
  });

  test('keeps a pending compile valid across normal token refresh in the same session', async () => {
    let auth = { authTokens: { access: 'first' }, authSessionVersion: 1 };
    const sessionWrapper = ({ children }) => <AuthContext.Provider value={auth}>{children}</AuthContext.Provider>;
    const pending = deferred();
    const readBlob = vi.fn(() => pending.promise);
    fetch.mockResolvedValue({ ok: true, blob: readBlob });
    const { result, rerender } = renderHook(() => useLatex({ content: 'manual source', contentSource: 'manual' }, 'refreshed-compile'), { wrapper: sessionWrapper });
    let compile;
    act(() => { compile = result.current.handleCompileOnly(); });
    await waitFor(() => expect(readBlob).toHaveBeenCalledOnce());
    auth = { authTokens: { access: 'refreshed' }, authSessionVersion: 1 };
    rerender();
    await act(async () => { pending.resolve(new Blob(['current PDF'])); await compile; });
    expect(result.current.pdfBlob).toBe('blob:test-url');
    expect(result.current.lastCompileSnapshot.content).toBe('manual source');
  });

  test('confirms edited structured removal atomically and restores source and selections with undo', () => {
    const id = 'algebra-i.slope-formula';
    const block = (kind, body) => `% @texgen-section v1 begin ${kind}:${id}\n${body}% @texgen-section v1 end ${kind}:${id}\n`;
    const source = `HEADER\n${block('c', block('g', block('f', 'original\n')))}FOOTER`;
    const selection = [{ formula_id: id }];
    const restoreSelections = vi.fn();
    const apply = vi.fn();
    const { result } = renderHook(() => useLatex({ content: source, contentSource: 'generated', generatedSections: { version: 1, baseline: source } }, 'section-test', selection, { restoreSelections }), { wrapper });
    act(() => result.current.handleContentChange(source.replace('original', 'my work')));
    expect(result.current.contentSource).toBe('generated');
    act(() => result.current.requestRemoval([id], apply));
    expect(apply).not.toHaveBeenCalled();
    expect(result.current.pendingRemoval).toBeTruthy();
    act(() => result.current.cancelRemoval());
    expect(result.current.content).toContain('my work');
    expect(apply).not.toHaveBeenCalled();
    act(() => result.current.requestRemoval([id], apply));
    act(() => result.current.confirmRemoval());
    expect(apply).toHaveBeenCalledTimes(1);
    expect(result.current.content).toBe('HEADER\nFOOTER');
    act(() => { result.current.setColumns(2); result.current.setTitle('later title'); });
    act(() => result.current.goBack());
    expect(result.current.columns).toBe(4);
    expect(result.current.title).toBe('');
    expect(result.current.content).toContain('my work');
    expect(restoreSelections).toHaveBeenCalledWith(selection, undefined);
  });

  test.each(['removal', 'raw mode', 'generation', 'preview regeneration'])('persists %s recovery and undo cursor before any debounce timer', async (transition) => {
    vi.useFakeTimers();
    const id = 'algebra-i.slope-formula';
    const block = (kind, body) => `% @texgen-section v1 begin ${kind}:${id}\n${body}% @texgen-section v1 end ${kind}:${id}\n`;
    const source = `HEADER\n${block('c', block('g', block('f', 'original\n')))}FOOTER`;
    const edited = source.replace('original', 'manual work');
    const regenerated = source.replace('original', 'new generation');
    const metadata = { version: 1, baseline: source };
    const selections = [{ formula_id: id }];
    const identity = 'immediate-history';
    const restoreSelections = vi.fn();
    fetch.mockImplementation((url) => Promise.resolve(url === '/api/generate-sheet/'
      ? { ok: true, json: async () => ({ tex_code: regenerated, generated_sections: { version: 1, baseline: regenerated } }) }
      : { ok: true, blob: async () => new Blob(['pdf']) }));
    const first = renderHook(() => useLatex({ content: edited, contentSource: 'generated', generatedSections: metadata }, identity, selections, { restoreSelections, formulaSelections: selections }), { wrapper });
    if (transition === 'removal') {
      act(() => first.result.current.requestRemoval([id], vi.fn(), { records: [], canonical: [] }));
      act(() => first.result.current.confirmRemoval());
    } else if (transition === 'raw mode') {
      act(() => first.result.current.useRawSource());
    } else if (transition === 'generation') {
      await act(async () => first.result.current.handleGenerateSheet(selections));
    } else {
      await act(async () => first.result.current.handlePreview(null, { formulas: selections }));
    }
    const after = first.result.current.content;
    first.unmount();
    const saved = JSON.parse(localStorage.getItem(`cheatSheetLatex:${identity}`));
    expect(saved).toMatchObject({ content: after, historyIndex: 1 });
    expect(saved.history).toHaveLength(2);
    expect(saved.history[0]).toMatchObject({ content: edited, generatedSections: metadata, formulaSelections: selections });
    const second = renderHook(() => useLatex(undefined, identity, [], { restoreSelections }), { wrapper });
    expect(second.result.current.canGoBack).toBe(true);
    act(() => second.result.current.goBack());
    expect(second.result.current.content).toBe(edited);
    expect(second.result.current.generatedSections).toEqual(metadata);
    expect(restoreSelections).toHaveBeenLastCalledWith(selections, selections);
    second.unmount();
    const third = renderHook(() => useLatex(undefined, identity, [], { restoreSelections }), { wrapper });
    expect(third.result.current.content).toBe(edited);
    expect(third.result.current.canGoBack).toBe(false);
    expect(third.result.current.canGoForward).toBe(true);
    act(() => third.result.current.goForward());
    expect(third.result.current.content).toBe(after);
    third.unmount();
    expect(JSON.parse(localStorage.getItem(`cheatSheetLatex:${identity}`)).historyIndex).toBe(1);
  });

  test.each(['removal', 'raw mode', 'generation', 'preview regeneration'])('keeps source and metadata if %s recovery cannot be stored', async (transition) => {
    vi.useFakeTimers();
    const id = 'algebra-i.slope-formula';
    const block = (kind, body) => `% @texgen-section v1 begin ${kind}:${id}\n${body}% @texgen-section v1 end ${kind}:${id}\n`;
    const source = block('c', block('g', block('f', 'original\n')));
    const edited = source.replace('original', 'manual work');
    const metadata = { version: 1, baseline: source };
    const selections = [{ formula_id: id }];
    const apply = vi.fn();
    const onDocumentChange = vi.fn();
    fetch.mockResolvedValue({ ok: true, json: async () => ({ tex_code: source.replace('original', 'different generation'), generated_sections: { version: 1, baseline: source.replace('original', 'different generation') } }) });
    const { result, unmount } = renderHook(() => useLatex({ content: edited, contentSource: 'generated', generatedSections: metadata }, 'failed-recovery', selections, { onDocumentChange }), { wrapper });
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(mockLocalStorage, 'setItem').mockImplementation(() => { throw new Error('Storage full'); });
    if (transition === 'removal') {
      act(() => result.current.requestRemoval([id], apply, { records: [], canonical: [] }));
      act(() => result.current.confirmRemoval());
    } else if (transition === 'raw mode') {
      act(() => result.current.useRawSource());
    } else if (transition === 'generation') {
      await act(async () => result.current.handleGenerateSheet(selections));
    } else {
      await act(async () => result.current.handlePreview(null, { formulas: selections }));
    }
    expect(result.current.content).toBe(edited);
    expect(result.current.contentSource).toBe('generated');
    expect(result.current.generatedSections).toEqual(metadata);
    expect(result.current.canGoBack).toBe(false);
    expect(result.current.sectionMessage).toContain('Recovery could not be saved');
    expect(apply).not.toHaveBeenCalled();
    expect(onDocumentChange).not.toHaveBeenCalled();
    expect(fetch.mock.calls.some(([url]) => url === '/api/compile/')).toBe(false);
    unmount();
  });

  test.each(['goBack', 'goForward'])('failed %s persistence keeps source and history cursor unchanged', (direction) => {
    vi.useFakeTimers();
    const history = [{ content: 'before', contentSource: 'manual' }, { content: 'after', contentSource: 'manual' }];
    const index = direction === 'goBack' ? 1 : 0;
    localStorage.setItem('cheatSheetLatex:failed-navigation', JSON.stringify({ ...history[index], history, historyIndex: index }));
    const { result } = renderHook(() => useLatex(undefined, 'failed-navigation'), { wrapper });
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(mockLocalStorage, 'setItem').mockImplementation(() => { throw new Error('Storage full'); });
    act(() => result.current[direction]());
    expect(result.current.content).toBe(history[index].content);
    expect(result.current.canGoBack).toBe(index === 1);
    expect(result.current.canGoForward).toBe(index === 0);
    expect(JSON.parse(localStorage.getItem('cheatSheetLatex:failed-navigation')).historyIndex).toBe(index);
    expect(result.current.sectionMessage).toContain('Recovery could not be saved');
  });

  test('invalidates removal confirmation after an edit and raw mode never rewrites marked source', () => {
    const id = 'algebra-i.slope-formula';
    const block = (kind, body) => `% @texgen-section v1 begin ${kind}:${id}\n${body}% @texgen-section v1 end ${kind}:${id}\n`;
    const source = `HEADER\n${block('c', block('g', block('f', 'original\n')))}FOOTER`;
    const apply = vi.fn();
    const { result } = renderHook(() => useLatex({ content: source, contentSource: 'generated', generatedSections: { version: 1, baseline: source } }, 'stale-removal', [{ formula_id: id }]), { wrapper });
    act(() => result.current.handleContentChange(source.replace('original', 'edited')));
    act(() => result.current.requestRemoval([id], apply));
    act(() => result.current.handleContentChange(source.replace('original', 'newer edit')));
    act(() => result.current.confirmRemoval());
    expect(apply).not.toHaveBeenCalled();
    expect(result.current.content).toContain('newer edit');
    expect(result.current.sectionMessage).toContain('changed');
    const rawSource = result.current.content;
    act(() => result.current.useRawSource());
    expect(result.current.contentSource).toBe('manual');
    expect(result.current.content).toBe(rawSource);
    act(() => result.current.requestRemoval([id], apply));
    expect(apply).toHaveBeenCalledTimes(1);
    expect(result.current.content).toBe(rawSource);
    expect(result.current.pendingRemoval).toBeNull();
  });

  test('does not replace current source with a damaged browser history entry', () => {
    localStorage.setItem('cheatSheetLatex:damaged-history', JSON.stringify({ content: 'current work', contentSource: 'manual', history: [null, { content: 'current work' }], historyIndex: 1 }));
    const { result } = renderHook(() => useLatex(undefined, 'damaged-history'), { wrapper });
    act(() => result.current.goBack());
    expect(result.current.content).toBe('current work');
    expect(result.current.sectionMessage).toContain('damaged');
  });

  test('initializes with default values when no storage or initial data is provided', () => {
    const { result } = renderHook(() => useLatex(), { wrapper });

    expect(result.current.title).toBe('');
    expect(result.current.content).toBe('');
    expect(result.current.columns).toBe(4);
    expect(result.current.fontSize).toBe('9pt');
    expect(result.current.spacing).toBe('small');
    expect(result.current.margins).toBe('0.15in');
    expect(result.current.orientation).toBe('portrait'); // <-- Added orientation default
    expect(result.current.pdfBlob).toBeNull();
    expect(result.current.compileError).toBeNull();
  });

  test('loads initial data correctly', () => {
    const initialData = {
      title: 'Test Title',
      content: 'Test content',
      columns: 3,
      fontSize: '12pt',
      spacing: 'medium',
      margins: '0.5in',
      orientation: 'landscape' // <-- Added orientation custom data
    };

    const { result } = renderHook(() => useLatex(initialData), { wrapper });

    expect(result.current.title).toBe('Test Title');
    expect(result.current.content).toBe('Test content');
    expect(result.current.columns).toBe(3);
    expect(result.current.fontSize).toBe('12pt');
    expect(result.current.spacing).toBe('medium');
    expect(result.current.margins).toBe('0.5in');
    expect(result.current.orientation).toBe('landscape'); // <-- Added orientation assertion
  });

  test('treats persisted generated sheets as safe to regenerate', () => {
    const { result } = renderHook(() => useLatex({
      content: '\\documentclass{article}',
      contentSource: 'generated',
      selectedFormulas: [{ class: 'Algebra', category: 'Linear', name: 'Slope Formula' }],
    }), { wrapper });

    expect(result.current.canRegenerateFromSelections).toBe(true);
  });

  test('treats legacy non-empty sheets as manual without trusted provenance', () => {
    const { result } = renderHook(() => useLatex({
      content: '\\documentclass{article}',
      selectedFormulas: [{ class: 'Algebra', category: 'Linear', name: 'Slope Formula' }],
    }), { wrapper });

    expect(result.current.canRegenerateFromSelections).toBe(false);
  });

  test('restores saved manual provenance when provided', () => {
    const { result } = renderHook(() => useLatex({
      content: '\\documentclass{article}',
      contentSource: 'manual',
      selectedFormulas: [{ class: 'Algebra', category: 'Linear', name: 'Slope Formula' }],
    }), { wrapper });

    expect(result.current.canRegenerateFromSelections).toBe(false);
  });

  test('loads from local storage if available and initial content is null', () => {
    mockLocalStorage.setItem('cheatSheetLatex', JSON.stringify({
      title: 'Storage Title',
      content: 'Storage content'
    }));

    const { result } = renderHook(() => useLatex(), { wrapper });

    expect(result.current.title).toBe('Storage Title');
    expect(result.current.content).toBe('Storage content');
  });

  test('handles content changes correctly', () => {
    const { result } = renderHook(() => useLatex(), { wrapper });

    act(() => {
      result.current.handleContentChange('New latex content');
    });

    expect(result.current.content).toBe('New latex content');
    expect(result.current.contentModified).toBe(true);
    expect(result.current.compileError).toBeNull();
  });

  test('manual edits remain protected from selection regeneration after compile', async () => {
    const { result } = renderHook(() => useLatex(), { wrapper });

    act(() => {
      result.current.handleContentChange('\\documentclass{article}\n% custom manual edit');
    });

    expect(result.current.canRegenerateFromSelections).toBe(false);

    global.fetch.mockResolvedValueOnce({
      ok: true,
      blob: async () => new Blob(['fake pdf data'])
    });

    await act(async () => {
      await result.current.handleCompileOnly([{ class: 'Algebra', category: 'Linear', name: 'Slope Formula' }]);
    });

    expect(result.current.contentModified).toBe(false);
    expect(result.current.canRegenerateFromSelections).toBe(false);
  });

  test('history goBack and goForward work correctly', async () => {
    const { result } = renderHook(() => useLatex(), { wrapper });

    act(() => {
      result.current.handleContentChange('Initial Content');
    });

    global.fetch
      .mockResolvedValueOnce({ ok: true, json: async () => ({ tex_code: 'Gen 1' }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ tex_code: 'Compile 1' }), blob: async () => new Blob() })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ tex_code: 'Gen 2' }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ tex_code: 'Compile 2' }), blob: async () => new Blob() });

    await act(async () => {
      await result.current.handleGenerateSheet([{ formula_id: 'some-data' }]);
    });
    
    await act(async () => {
      await result.current.handleGenerateSheet([{ formula_id: 'more-data' }]);
    });

    act(() => {
      result.current.goBack();
    });

    expect(result.current.content).toBe('Gen 1');

    act(() => {
      result.current.goForward();
    });

    expect(result.current.content).toBe('Gen 2');
  });

  test('handleCompileOnly handles successful compilation', async () => {
    const { result } = renderHook(() => useLatex(), { wrapper });
    const selectedFormulas = [{ class: 'Algebra', category: 'Linear', name: 'Slope Formula' }];

    global.fetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ tex_code: 'generated content' })
      })
      .mockResolvedValueOnce({
        ok: true,
        blob: async () => new Blob(['fake pdf data'])
      });

    await act(async () => {
      await result.current.handleCompileOnly(selectedFormulas);
    });

    expect(global.fetch).toHaveBeenCalledTimes(2);
    expect(result.current.content).toBe('generated content');
    expect(result.current.pdfBlob).toBe('blob:test-url');
    expect(result.current.compileError).toBeNull();
  });

  test('handleCompileOnly handles errors', async () => {
    const { result } = renderHook(() => useLatex(), { wrapper });
    const selectedFormulas = [{ class: 'Algebra', category: 'Linear', name: 'Slope Formula' }];

    global.fetch
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ({ tex_code: 'generated content' })
    })
    .mockResolvedValueOnce({
      ok: false,
      json: async () => ({ details: 'Syntax error on line 1' }),
      blob: async () => new Blob()
    });

    await act(async () => {
      await result.current.handleCompileOnly(selectedFormulas);
    });

    expect(result.current.compileError).toContain('Syntax error');
    expect(result.current.isCompiling).toBe(false);
  });

  test('requires sign-in without fetching when compiling signed out', async () => {
    const { result } = renderHook(() => useLatex({ content: 'source' }), { wrapper: signedOutWrapper });

    await act(async () => { await result.current.handleCompileOnly(); });

    expect(global.fetch).not.toHaveBeenCalled();
    expect(result.current.authenticationRequired).toBe(true);
    expect(result.current.compileError).toBe('Sign in to compile or download PDFs.');
    expect(result.current.isCompiling).toBe(false);
  });

  test('requires sign-in without fetching when downloading a PDF signed out', async () => {
    const { result } = renderHook(() => useLatex({ content: 'source' }), { wrapper: signedOutWrapper });

    await act(async () => { await result.current.handleDownloadPDF(); });

    expect(global.fetch).not.toHaveBeenCalled();
    expect(result.current.authenticationRequired).toBe(true);
    expect(result.current.compileError).toBe('Sign in to compile or download PDFs.');
    expect(result.current.isLoading).toBe(false);
  });

  test('treats a compile 401 as sign-in required without compiler diagnostics', async () => {
    const { result } = renderHook(() => useLatex({ content: 'source' }), { wrapper });
    global.fetch.mockResolvedValueOnce({ ok: false, status: 401, text: async () => 'compiler diagnostic' });

    await act(async () => { await result.current.handleCompileOnly(); });

    expect(result.current.authenticationRequired).toBe(true);
    expect(result.current.compileError).toBe('Sign in to compile or download PDFs.');
  });

  test('generates source while signed out without starting compilation', async () => {
    const { result } = renderHook(() => useLatex(), { wrapper: signedOutWrapper });
    global.fetch.mockResolvedValueOnce({ ok: true, json: async () => ({ tex_code: 'generated source' }) });

    await act(async () => { await result.current.handleGenerateSheet([{ formula_id: 'first' }]); });

    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(global.fetch).toHaveBeenCalledWith('/api/generate-sheet/', expect.anything());
    expect(result.current.content).toBe('generated source');
    expect(result.current.contentSource).toBe('generated');
    expect(result.current.authenticationRequired).toBe(true);
    expect(result.current.compileError).toBe('Sign in to compile or download PDFs.');
  });

  test('sends canonical formula IDs under formula_selections only in selected order when generating', async () => {
    const { result } = renderHook(() => useLatex(), { wrapper });
    global.fetch
      .mockResolvedValueOnce({ ok: true, json: async () => ({ tex_code: 'generated source' }) })
      .mockResolvedValueOnce({ ok: true, blob: async () => new Blob(['pdf']) });

    await act(async () => {
      await result.current.handleGenerateSheet([{ id: 'second' }, { formula_id: 'first' }]);
    });

    const payload = JSON.parse(global.fetch.mock.calls[0][1].body);
    expect(payload.formula_selections).toEqual([
      { formula_id: 'second' },
      { formula_id: 'first' },
    ]);
    expect(payload).not.toHaveProperty('formulas');
  });

  test('sends legacy records under formulas only when canonical formula IDs are unavailable', async () => {
    const { result } = renderHook(() => useLatex(), { wrapper });
    const formulas = [{ class: 'Algebra', name: 'Slope' }, { class: 'Geometry', name: 'Area' }];
    global.fetch
      .mockResolvedValueOnce({ ok: true, json: async () => ({ tex_code: 'generated source' }) })
      .mockResolvedValueOnce({ ok: true, blob: async () => new Blob(['pdf']) });

    await act(async () => { await result.current.handleGenerateSheet(formulas); });

    const payload = JSON.parse(global.fetch.mock.calls[0][1].body);
    expect(payload.formulas).toEqual(formulas);
    expect(payload).not.toHaveProperty('formula_selections');
  });

  test('normalizes mixed selections to strict legacy records in selected order', async () => {
    const { result } = renderHook(() => useLatex(), { wrapper });
    const formulas = [
      { formula_id: 'canonical-id', class: 'Algebra', category: 'Linear', name: 'Slope', description: 'extra' },
      { class_name: 'Geometry', name: 'Area', source: 'catalog' },
    ];
    global.fetch
      .mockResolvedValueOnce({ ok: true, json: async () => ({ tex_code: 'generated source' }) })
      .mockResolvedValueOnce({ ok: true, blob: async () => new Blob(['pdf']) });

    await act(async () => { await result.current.handleGenerateSheet(formulas); });

    const payload = JSON.parse(global.fetch.mock.calls[0][1].body);
    expect(payload.formulas).toEqual([
      { class: 'Algebra', category: 'Linear', name: 'Slope' },
      { class_name: 'Geometry', name: 'Area' },
    ]);
    expect(payload).not.toHaveProperty('formula_selections');
  });

  test('rejects unresolved selections without making a generation request', async () => {
    const { result } = renderHook(() => useLatex(), { wrapper });

    await act(async () => {
      await result.current.handleCompileOnly([{ formula_id: 123, class: 'Algebra' }]);
    });

    expect(global.fetch).not.toHaveBeenCalled();
    expect(result.current.compileError).toBe('Unable to resolve selected formulas for generation.');
  });

  test('does not request generation for an empty public selection', async () => {
    const { result } = renderHook(() => useLatex(), { wrapper });

    await act(async () => { await result.current.handleGenerateSheet([]); });

    expect(global.fetch).not.toHaveBeenCalled();
  });

  test('handleDownloadTex works correctly', () => {
    const { result } = renderHook(() => useLatex({ content: 'Test Tex Data', title: 'FileTitle' }), { wrapper });
    
    // Mock the a element creation and click
    const mockClick = vi.fn();
    const mockElement = { click: mockClick, href: '', download: '' };
    vi.spyOn(document, 'createElement').mockReturnValue(mockElement);
    vi.spyOn(document.body, 'appendChild').mockImplementation(() => {});
    vi.spyOn(document.body, 'removeChild').mockImplementation(() => {});

    act(() => {
      result.current.handleDownloadTex();
    });

    expect(mockClick).toHaveBeenCalled();
    expect(mockElement.download).toBe('FileTitle.tex');
  });

  test('reports a failed generation request without replacing the source', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { result } = renderHook(() => useLatex({ content: 'manual source' }), { wrapper });
    fetch.mockResolvedValueOnce({ ok: false, status: 500, text: async () => 'Generation failed' });
    await act(async () => { await result.current.handleGenerateSheet([{ formula_id: 'test.formula' }]); });
    expect(fetch).toHaveBeenCalledOnce();
    expect(fetch).toHaveBeenCalledWith('/api/generate-sheet/', expect.objectContaining({ method: 'POST' }));
    expect(alert).toHaveBeenCalledWith('Failed to generate LaTeX. Is the backend running?');
    expect(result.current.content).toBe('manual source');
    expect(result.current.isGenerating).toBe(false);
  });

  test('reports a failed PDF download and clears loading state', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { result } = renderHook(() => useLatex({ content: 'manual source' }), { wrapper });
    fetch.mockResolvedValueOnce({ ok: false, status: 500, text: async () => 'Compile failed' });
    await act(async () => { await result.current.handleDownloadPDF(); });
    expect(fetch).toHaveBeenCalledOnce();
    expect(fetch).toHaveBeenCalledWith('/api/compile/', expect.objectContaining({ method: 'POST' }));
    expect(alert).toHaveBeenCalledWith('Failed to generate PDF. Check console for details.');
    expect(URL.createObjectURL).not.toHaveBeenCalled();
    expect(result.current.isLoading).toBe(false);
  });

  test('revokes a published PDF when clearing the document', async () => {
    const { result } = renderHook(() => useLatex({ content: 'manual source' }), { wrapper });
    fetch.mockResolvedValueOnce({ ok: true, blob: async () => new Blob(['pdf']) });
    await act(async () => { await result.current.handleCompileOnly(); });
    expect(result.current.pdfBlob).toBe('blob:test-url');
    expect(URL.revokeObjectURL).not.toHaveBeenCalled();
    act(() => { result.current.clearLatex(); });
    expect(URL.revokeObjectURL).toHaveBeenCalledExactlyOnceWith('blob:test-url');
    expect(result.current.pdfBlob).toBeNull();
    expect(result.current.content).toBe('');
  });

  test('keeps generated source and the previous PDF when the new preview fails', async () => {
    const { result } = renderHook(() => useLatex({ content: 'manual source' }), { wrapper });
    fetch.mockResolvedValueOnce({ ok: true, blob: async () => new Blob(['old pdf']) });
    await act(async () => { await result.current.handleCompileOnly(); });
    expect(result.current.pdfBlob).toBe('blob:test-url');
    fetch.mockResolvedValueOnce({ ok: true, json: async () => ({ tex_code: 'new generated source' }) })
      .mockResolvedValueOnce({ ok: false, status: 400, text: async () => 'Preview failed' });
    await act(async () => { await result.current.handleGenerateSheet([{ formula_id: 'test.formula' }]); });
    expect(fetch).toHaveBeenCalledTimes(3);
    expect(result.current.content).toBe('new generated source');
    expect(result.current.pdfBlob).toBe('blob:test-url');
    expect(result.current.compileError).toBe('Preview failed');
    expect(result.current.isGenerating).toBe(false);
    expect(result.current.isCompiling).toBe(false);
    expect(URL.revokeObjectURL).not.toHaveBeenCalled();
    expect(alert).not.toHaveBeenCalled();
  });

  test('keeps raw source and the existing PDF when compilation fails', async () => {
    const { result } = renderHook(() => useLatex({
      content: 'manual source',
      contentSource: 'manual',
    }), { wrapper });

    global.fetch.mockResolvedValueOnce({ ok: true, blob: async () => new Blob(['old pdf']) });
    await act(async () => { await result.current.handleCompileOnly(); });
    expect(result.current.pdfBlob).toBe('blob:test-url');

    act(() => { result.current.setColumns(3); });
    global.fetch.mockResolvedValueOnce({ ok: false, text: async () => 'Compile failed' });

    await act(async () => { await result.current.handleCompileOnly(); });

    expect(result.current.content).toBe('manual source');
    expect(result.current.contentSource).toBe('manual');
    expect(result.current.pdfBlob).toBe('blob:test-url');
    expect(result.current.compileError).toBe('Compile failed');
  });

  test('keeps the latest generated source and preview when an earlier preview blob resolves late', async () => {
    const firstBlob = deferred();
    const { result } = renderHook(() => useLatex(), { wrapper });
    global.fetch
      .mockResolvedValueOnce({ ok: true, json: async () => ({ tex_code: 'first source' }) })
      .mockResolvedValueOnce({ ok: true, blob: () => firstBlob.promise })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ tex_code: 'second source' }) })
      .mockResolvedValueOnce({ ok: true, blob: async () => new Blob(['second pdf']) });

    let firstGenerate;
    await act(async () => {
      firstGenerate = result.current.handleGenerateSheet([{ formula_id: 'first' }]);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(result.current.content).toBe('first source');
    expect(global.fetch).toHaveBeenCalledTimes(2);
    expect(result.current.isGenerating).toBe(false);
    expect(result.current.isCompiling).toBe(true);

    await act(async () => { await result.current.handleGenerateSheet([{ formula_id: 'second' }]); });
    await act(async () => {
      firstBlob.resolve(new Blob(['first pdf']));
      await firstGenerate;
    });

    expect(result.current.content).toBe('second source');
    expect(result.current.pdfBlob).toBe('blob:test-url');
    expect(result.current.isGenerating).toBe(false);
    expect(result.current.isCompiling).toBe(false);
  });

  test('does not compile or change loading state after an aborted regeneration resolves', async () => {
    const response = deferred();
    const { result } = renderHook(() => useLatex(), { wrapper });
    global.fetch.mockImplementationOnce(() => response.promise);

    let regeneration;
    await act(async () => {
      regeneration = result.current.handleGenerateSheet([{ formula_id: 'formula' }]);
      await Promise.resolve();
    });
    const signal = global.fetch.mock.calls[0][1].signal;

    act(() => { result.current.clearLatex(); });
    expect(signal.aborted).toBe(true);
    await act(async () => {
      response.resolve({ ok: true, json: async () => ({ tex_code: 'stale source' }) });
      await regeneration;
    });

    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(result.current.content).toBe('');
    expect(result.current.isGenerating).toBe(false);
    expect(result.current.isCompiling).toBe(false);
    expect(result.current.isLoading).toBe(false);
  });

  test('does not download a PDF when Clear occurs before the deferred response blob resolves', async () => {
    const pdfBlob = deferred();
    const mockClick = vi.fn();
    const { result } = renderHook(() => useLatex({ content: 'source', title: 'sheet' }), { wrapper });
    vi.spyOn(document, 'createElement').mockReturnValue({ click: mockClick });
    vi.spyOn(document.body, 'appendChild').mockImplementation(() => {});
    vi.spyOn(document.body, 'removeChild').mockImplementation(() => {});
    global.fetch.mockResolvedValueOnce({ ok: true, blob: () => pdfBlob.promise });

    let download;
    await act(async () => {
      download = result.current.handleDownloadPDF();
      await Promise.resolve();
    });
    act(() => { result.current.clearLatex(); });
    await act(async () => {
      pdfBlob.resolve(new Blob(['pdf']));
      await download;
    });

    expect(URL.createObjectURL).not.toHaveBeenCalled();
    expect(mockClick).not.toHaveBeenCalled();
  });

  test('keeps history-restored source marked modified when a pending compile resolves', async () => {
    const pendingCompile = deferred();
    const { result } = renderHook(() => useLatex({ content: 'original' }), { wrapper });
    global.fetch
      .mockResolvedValueOnce({ ok: true, json: async () => ({ tex_code: 'first history entry' }) })
      .mockResolvedValueOnce({ ok: true, blob: async () => new Blob(['first']) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ tex_code: 'second history entry' }) })
      .mockResolvedValueOnce({ ok: true, blob: async () => new Blob(['second']) })
      .mockResolvedValueOnce({ ok: true, blob: () => pendingCompile.promise });

    await act(async () => { await result.current.handleGenerateSheet([{ formula_id: 'one' }]); });
    await act(async () => { await result.current.handleGenerateSheet([{ formula_id: 'two' }]); });

    let compile;
    await act(async () => {
      compile = result.current.handleCompileOnly();
      await Promise.resolve();
    });
    act(() => { result.current.goBack(); });
    await act(async () => {
      pendingCompile.resolve(new Blob(['late compile']));
      await compile;
    });

    expect(result.current.content).toBe('first history entry');
    expect(result.current.contentSource).toBe('manual');
    expect(result.current.contentModified).toBe(true);
  });

  test('does not publish a pending compile PDF or snapshot after a manual edit', async () => {
    const pendingBlob = deferred();
    const { result } = renderHook(() => useLatex({ content: 'original', contentSource: 'manual' }), { wrapper });
    global.fetch.mockResolvedValueOnce({ ok: true, blob: () => pendingBlob.promise });

    let compile;
    await act(async () => {
      compile = result.current.handleCompileOnly();
      await Promise.resolve();
    });
    act(() => { result.current.handleContentChange('edited source'); });
    await act(async () => {
      pendingBlob.resolve(new Blob(['stale pdf']));
      await compile;
    });

    expect(result.current.content).toBe('edited source');
    expect(result.current.pdfBlob).toBeNull();
    expect(result.current.lastCompileSnapshot).toBeNull();
    expect(result.current.isCompiling).toBe(false);
  });

  test('ignores a generated source when a manual edit occurs before its response body resolves', async () => {
    const generated = deferred();
    const { result } = renderHook(() => useLatex(), { wrapper });
    global.fetch.mockResolvedValueOnce({ ok: true, json: () => generated.promise });

    let operation;
    await act(async () => {
      operation = result.current.handleGenerateSheet([{ formula_id: 'formula' }]);
      await Promise.resolve();
    });
    act(() => { result.current.handleContentChange('manual source'); });
    await act(async () => {
      generated.resolve({ tex_code: 'stale generated source' });
      await operation;
    });

    expect(result.current.content).toBe('manual source');
    expect(result.current.pdfBlob).toBeNull();
    expect(result.current.isGenerating).toBe(false);
  });

  test('does not compile normalized content after a manual edit during the normalize response body', async () => {
    const normalized = deferred();
    const { result } = renderHook(() => useLatex({ content: 'source' }), { wrapper });
    act(() => { result.current.setColumns(3); });
    global.fetch.mockResolvedValueOnce({ ok: true, json: () => normalized.promise });

    let operation;
    await act(async () => {
      operation = result.current.handleCompileOnly();
      await Promise.resolve();
    });
    act(() => { result.current.handleContentChange('manual source'); });
    await act(async () => {
      normalized.resolve({ tex_code: 'normalized source' });
      await operation;
    });

    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(result.current.content).toBe('manual source');
    expect(result.current.isCompiling).toBe(false);
  });

  test('does not publish a PDF when unmounted after compile headers and before the blob resolves', async () => {
    const pendingBlob = deferred();
    const { result, unmount } = renderHook(() => useLatex({ content: 'source' }), { wrapper });
    global.fetch.mockResolvedValueOnce({ ok: true, blob: () => pendingBlob.promise });

    let compile;
    await act(async () => {
      compile = result.current.handleCompileOnly();
      await Promise.resolve();
    });
    unmount();
    await act(async () => {
      pendingBlob.resolve(new Blob(['stale pdf']));
      await compile;
    });

    expect(URL.createObjectURL).not.toHaveBeenCalled();
  });

  test('uses current selections for automatic and restored preview snapshots', async () => {
    const selectedFormulas = [{ class: 'Algebra', category: 'Linear', name: 'Slope Formula' }];
    const { result } = renderHook(() => useLatex({ content: 'source', contentSource: 'manual' }, undefined, selectedFormulas), { wrapper });
    global.fetch
      .mockResolvedValueOnce({ ok: true, blob: async () => new Blob(['auto']) })
      .mockResolvedValueOnce({ ok: true, blob: async () => new Blob(['preview']) });

    await act(async () => { await result.current.handleCompileOnly(); });
    expect(result.current.lastCompileSnapshot.selectedFormulas).toEqual(selectedFormulas);

    await act(async () => { await result.current.handlePreview('restored source'); });
    expect(result.current.lastCompileSnapshot.selectedFormulas).toEqual(selectedFormulas);
  });

  test('does not start restored preview compilation without component orchestration', async () => {
    const selectedFormulas = [{ class: 'Physics', category: 'Motion', name: 'Velocity' }];
    const { result } = renderHook(() => useLatex({
      content: 'restored source',
      contentSource: 'manual',
      compileHistory: [{ content: 'older source' }],
    }, undefined, selectedFormulas), { wrapper });

    await act(async () => { await Promise.resolve(); });
    expect(global.fetch).not.toHaveBeenCalled();
    expect(result.current.lastCompileSnapshot).toBeNull();
  });

  test('debounces the newest layout after a pending compile and publishes only its snapshot', async () => {
    const pendingBlob = deferred();
    const selectedFormulas = [{ class: 'Geometry', category: 'Shapes', name: 'Area of Circle' }];
    const { result } = renderHook(() => useLatex({ content: 'source' }, undefined, selectedFormulas), { wrapper });
    vi.useFakeTimers();
    global.fetch.mockImplementation((_url, options) => {
      const body = JSON.parse(options.body);
      if (body.normalize_only) return Promise.resolve({ ok: true, json: async () => ({ tex_code: 'normalized source' }) });
      if (body.orientation === 'landscape') return Promise.resolve({ ok: true, blob: async () => new Blob(['new pdf']) });
      return Promise.resolve({ ok: true, blob: () => pendingBlob.promise });
    });

    let firstCompile;
    await act(async () => {
      firstCompile = result.current.handleCompileOnly();
      await Promise.resolve();
    });
    act(() => {
      result.current.setColumns(3);
      result.current.setOrientation('landscape');
    });
    await act(async () => { await vi.advanceTimersByTimeAsync(450); });
    expect(global.fetch.mock.calls.filter(([, options]) => JSON.parse(options.body).normalize_only)).toHaveLength(0);
    expect(global.fetch.mock.calls.every(([, options]) => JSON.parse(options.body).content === 'source')).toBe(true);
    await vi.waitFor(() => expect(global.fetch.mock.calls.filter(([, options]) => JSON.parse(options.body).orientation === 'landscape' && !JSON.parse(options.body).normalize_only)).toHaveLength(1));
    await act(async () => {
      pendingBlob.resolve(new Blob(['stale pdf']));
      await firstCompile;
    });
    expect(result.current.pdfBlob).toBe('blob:test-url');
    expect(result.current.lastCompileSnapshot.columns).toBe(3);
    expect(result.current.lastCompileSnapshot.orientation).toBe('landscape');
    expect(result.current.lastCompileSnapshot.selectedFormulas).toEqual(selectedFormulas);
    vi.useRealTimers();
  });

  test('does not start a stale PDF download after a manual edit while its blob is pending', async () => {
    const pendingBlob = deferred();
    const mockClick = vi.fn();
    const { result } = renderHook(() => useLatex({ content: 'source' }), { wrapper });
    vi.spyOn(document, 'createElement').mockReturnValue({ click: mockClick });
    vi.spyOn(document.body, 'appendChild').mockImplementation(() => {});
    vi.spyOn(document.body, 'removeChild').mockImplementation(() => {});
    global.fetch.mockResolvedValueOnce({ ok: true, blob: () => pendingBlob.promise });

    let download;
    await act(async () => {
      download = result.current.handleDownloadPDF();
      await Promise.resolve();
    });
    act(() => { result.current.handleContentChange('manual source'); });
    await act(async () => {
      pendingBlob.resolve(new Blob(['stale download']));
      await download;
    });

    expect(result.current.content).toBe('manual source');
    expect(URL.createObjectURL).not.toHaveBeenCalled();
    expect(mockClick).not.toHaveBeenCalled();
    expect(result.current.isLoading).toBe(false);
  });
});
