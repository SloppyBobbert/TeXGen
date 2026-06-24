import { renderHook, act } from '@testing-library/react';
import { useLatex } from './latex';
import AuthContext from '../context/AuthContext';

// Mock localStorage
const mockLocalStorage = (() => {
  let store = {};
  return {
    getItem: (key) => store[key] || null,
    setItem: (key, value) => { store[key] = value.toString(); },
    removeItem: (key) => { delete store[key]; },
    clear: () => { store = {}; }
  };
})();
Object.defineProperty(window, 'localStorage', { value: mockLocalStorage });

// Mock global URL
global.URL.createObjectURL = vi.fn(() => 'blob:test-url');
global.URL.revokeObjectURL = vi.fn();

// Mock fetch
global.fetch = vi.fn();

describe('useLatex hook', () => {
  let alertSpy;

  beforeEach(() => {
    vi.clearAllMocks();
    mockLocalStorage.clear();
    alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
  });

  afterEach(() => {
    alertSpy.mockRestore();
  });

  const wrapper = ({ children }) => (
    <AuthContext.Provider value={{ authTokens: { access: 'test-token' } }}>
      {children}
    </AuthContext.Provider>
  );

  test('initializes with default values when no storage or initial data is provided', () => {
    const { result } = renderHook(() => useLatex(), { wrapper });

    expect(result.current.title).toBe('');
    expect(result.current.content).toBe('');
    expect(result.current.columns).toBe(2);
    expect(result.current.fontSize).toBe('10pt');
    expect(result.current.spacing).toBe('large');
    expect(result.current.margins).toBe('0.25in');
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
      margins: '0.5in'
    };

    const { result } = renderHook(() => useLatex(initialData), { wrapper });

    expect(result.current.title).toBe('Test Title');
    expect(result.current.content).toBe('Test content');
    expect(result.current.columns).toBe(3);
    expect(result.current.fontSize).toBe('12pt');
    expect(result.current.spacing).toBe('medium');
    expect(result.current.margins).toBe('0.5in');
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
      await result.current.handleGenerateSheet(['some-data']);
    });
    
    await act(async () => {
      await result.current.handleGenerateSheet(['more-data']);
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

    // Mock normalize and compile fetch responses
    global.fetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ tex_code: 'normalized content' })
      })
      .mockResolvedValueOnce({
        ok: true,
        blob: async () => new Blob(['fake pdf data'])
      });

    await act(async () => {
      await result.current.handleCompileOnly();
    });

    expect(global.fetch).toHaveBeenCalledTimes(2);
    expect(result.current.content).toBe('normalized content');
    expect(result.current.pdfBlob).toBe('blob:test-url');
    expect(result.current.compileError).toBeNull();
  });

  test('handleCompileOnly handles errors', async () => {
    const { result } = renderHook(() => useLatex(), { wrapper });

    global.fetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ details: 'Syntax error on line 1' })
    });

    await act(async () => {
      await result.current.handleCompileOnly();
    });

    expect(result.current.compileError).toContain('Syntax error');
    expect(result.current.isCompiling).toBe(false);
  });

  test('auto-compiles after layout changes when content exists', async () => {
    vi.useFakeTimers();

    const { result } = renderHook(() => useLatex({ content: 'Original content' }), { wrapper });

    global.fetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ tex_code: 'Normalized content' })
      })
      .mockResolvedValueOnce({
        ok: true,
        blob: async () => new Blob(['pdf'])
      });

    act(() => {
      result.current.setColumns(3);
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(450);
    });

    expect(global.fetch).toHaveBeenCalledTimes(2);
    expect(result.current.content).toBe('Normalized content');
    expect(result.current.hasLayoutChanges).toBe(false);

    vi.useRealTimers();
  });

  test('handlePreview regenerates content before compiling when regenerateOptions are provided', async () => {
    const { result } = renderHook(() => useLatex({ content: 'Existing content', margins: '0.5in' }), { wrapper });

    global.fetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ tex_code: 'Regenerated content' })
      })
      .mockResolvedValueOnce({
        ok: true,
        blob: async () => new Blob(['pdf'])
      });

    await act(async () => {
      await result.current.handlePreview(null, {
        formulas: ['formula'],
        columns: 4,
        fontSize: '12pt',
        spacing: 'medium'
      });
    });

    expect(global.fetch).toHaveBeenCalledTimes(2);
    expect(global.fetch).toHaveBeenNthCalledWith(
      1,
      '/api/generate-sheet/',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          formulas: ['formula'],
          columns: 4,
          font_size: '12pt',
          spacing: 'medium',
          margins: '0.5in'
        })
      })
    );
    expect(global.fetch).toHaveBeenNthCalledWith(
      2,
      '/api/compile/',
      expect.objectContaining({
        body: JSON.stringify({
          content: 'Regenerated content',
          columns: 2,
          font_size: '10pt',
          spacing: 'large',
          margins: '0.5in'
        })
      })
    );
    expect(result.current.content).toBe('Regenerated content');
    expect(result.current.compileError).toBeNull();
  });

  test('handlePreview skips a second compile while one is already running', async () => {
    let resolveCompile;
    const compilePromise = new Promise((resolve) => {
      resolveCompile = resolve;
    });

    global.fetch.mockReturnValueOnce(compilePromise);

    const { result } = renderHook(() => useLatex({ content: 'Test content' }), { wrapper });

    let firstPreviewPromise;
    await act(async () => {
      firstPreviewPromise = result.current.handlePreview();
      await Promise.resolve();
      await result.current.handlePreview();
    });

    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(result.current.isCompiling).toBe(true);

    resolveCompile({
      ok: true,
      blob: async () => new Blob(['pdf'])
    });

    await act(async () => {
      await firstPreviewPromise;
    });

    expect(result.current.isCompiling).toBe(false);
  });

  test('handleGenerateSheet with no formulas does not fetch and alerts to select at least one formula', async () => {
    const { result } = renderHook(() => useLatex(), { wrapper });

    await act(async () => {
      await result.current.handleGenerateSheet([]);
    });

    expect(global.fetch).not.toHaveBeenCalled();
    expect(window.alert).toHaveBeenCalledWith('Please select at least one category first.');
    expect(result.current.isGenerating).toBe(false);
  });

  test('handleGenerateSheet surfaces generate failure and clears generating state', async () => {
    const { result } = renderHook(() => useLatex(), { wrapper });
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    global.fetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: 'Backend generation failed' })
    });

    await act(async () => {
      await result.current.handleGenerateSheet(['formula']);
    });

    expect(errorSpy).toHaveBeenCalledWith('Error generating sheet:', expect.any(Error));
    expect(window.alert).toHaveBeenCalledWith('Failed to generate LaTeX. Is the backend running?');
    expect(result.current.isGenerating).toBe(false);

    errorSpy.mockRestore();
  });

  test('handleDownloadPDF surfaces compile failure and does not click download link', async () => {
    const { result } = renderHook(() => useLatex({ content: 'Test content', title: 'FileTitle' }), { wrapper });
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const mockClick = vi.fn();
    const createElementSpy = vi.spyOn(document, 'createElement').mockReturnValue({
      click: mockClick,
      href: '',
      download: ''
    });
    const appendChildSpy = vi.spyOn(document.body, 'appendChild').mockImplementation(() => {});
    const removeChildSpy = vi.spyOn(document.body, 'removeChild').mockImplementation(() => {});

    global.fetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: 'Compile failed' })
    });

    await act(async () => {
      await result.current.handleDownloadPDF();
    });

    expect(errorSpy).toHaveBeenCalledWith('Error generating PDF:', expect.any(Error));
    expect(window.alert).toHaveBeenCalledWith('Failed to generate PDF. Check console for details.');
    expect(mockClick).not.toHaveBeenCalled();
    expect(result.current.isLoading).toBe(false);

    createElementSpy.mockRestore();
    appendChildSpy.mockRestore();
    removeChildSpy.mockRestore();
    errorSpy.mockRestore();
  });

  test('handleDownloadTex works correctly', () => {
    const { result } = renderHook(() => useLatex({ content: 'Test Tex Data', title: 'FileTitle' }), { wrapper });
    
    // Mock the a element creation and click
    const mockClick = vi.fn();
    const mockElement = { click: mockClick, href: '', download: '' };
    const createElementSpy = vi.spyOn(document, 'createElement').mockReturnValue(mockElement);
    const appendChildSpy = vi.spyOn(document.body, 'appendChild').mockImplementation(() => {});
    const removeChildSpy = vi.spyOn(document.body, 'removeChild').mockImplementation(() => {});

    act(() => {
      result.current.handleDownloadTex();
    });

    expect(mockClick).toHaveBeenCalled();
    expect(mockElement.download).toBe('FileTitle.tex');

    createElementSpy.mockRestore();
    appendChildSpy.mockRestore();
    removeChildSpy.mockRestore();
  });

  test('clearLatex revokes the existing preview object URL', async () => {
    const { result } = renderHook(() => useLatex({ content: 'Test content' }), { wrapper });

    global.fetch.mockResolvedValueOnce({
      ok: true,
      blob: async () => new Blob(['pdf'])
    });

    await act(async () => {
      await result.current.handlePreview();
    });

    expect(result.current.pdfBlob).toBe('blob:test-url');

    act(() => {
      result.current.clearLatex();
    });

    expect(global.URL.revokeObjectURL).toHaveBeenCalledWith('blob:test-url');
    expect(result.current.pdfBlob).toBeNull();
    expect(result.current.content).toBe('');
  });
});
