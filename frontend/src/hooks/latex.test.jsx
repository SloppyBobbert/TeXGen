import { renderHook, act } from '@testing-library/react';
import { useLatex } from './latex';
import AuthContext from '../context/AuthContext';

// Mock localStorage
const mockLocalStorage = (() => {
  let store = {};
  return {
    getItem: (key) => store[key] || null,
    setItem: (key, value) => { store[key] = value.toString(); },
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
  beforeEach(() => {
    vi.clearAllMocks();
    mockLocalStorage.clear();
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
});
