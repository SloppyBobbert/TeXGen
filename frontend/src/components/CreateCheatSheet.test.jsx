import React from 'react';
import { act, render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import CreateCheatSheet from './CreateCheatSheet';
import { useFormulas } from '../hooks/formulas';
import { useLatex } from '../hooks/latex';
import { useYouTubeResources } from '../hooks/youtubeResources';
import { CURATED_SUBJECT_VIDEOS } from '../data/subjectVideos';

// Mock the dependencies
vi.mock('../hooks/formulas');
vi.mock('../hooks/latex');
vi.mock('../hooks/youtubeResources');
vi.mock('react-pdf', () => ({
  Document: ({ children }) => <div data-testid="mock-document">{children}</div>,
  Page: () => <div data-testid="mock-page" />,
  pdfjs: { GlobalWorkerOptions: { workerSrc: '' } }
}));

describe('CreateCheatSheet Component', () => {
  const mockUseFormulas = {
    classesData: [
      {
        name: 'Math 101',
        categories: [
          { name: 'Algebra', formulas: [] }
        ]
      }
    ],
    selectedClasses: {},
    selectedCategories: {},
    groupedFormulas: [],
    toggleClass: vi.fn(),
    selectAllClasses: vi.fn(),
    deselectAllClasses: vi.fn(),
    toggleCategory: vi.fn(),
    getSelectedFormulasList: vi.fn(),
    formulaSelections: [],
    getFormulaSelectionsList: vi.fn().mockReturnValue([]),
    clearSelections: vi.fn(),
    reorderClass: vi.fn(),
    reorderFormula: vi.fn(),
    removeClassFromOrder: vi.fn(),
    removeSingleFormula: vi.fn(),
    selectedCount: 0,
    hasSelectedClasses: false
  };

  const mockUseLatex = {
    title: '',
    setTitle: vi.fn(),
    content: '',
    contentModified: false,
    contentSource: 'empty',
    canRegenerateFromSelections: true,
    hasLayoutChanges: false,
    handleContentChange: vi.fn(),
    columns: 4,
    setColumns: vi.fn(),
    fontSize: '9pt',
    setFontSize: vi.fn(),
    spacing: 'small',
    setSpacing: vi.fn(),
    margins: '0.15in',
    setMargins: vi.fn(),
    orientation: 'portrait',
    setOrientation: vi.fn(),
    pdfBlob: null,
    lastCompileSnapshot: null,
    isGenerating: false,
    isCompiling: false,
    isLoading: false,
    compileError: null,
    authenticationRequired: false,
    canGoBack: false,
    canGoForward: false,
    goBack: vi.fn(),
    goForward: vi.fn(),
    handleGenerateSheet: vi.fn(),
    handlePreview: vi.fn(),
    handleCompileOnly: vi.fn(),
    handleDownloadPDF: vi.fn(),
    handleDownloadTex: vi.fn(),
    clearLatex: vi.fn()
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    window.ResizeObserver = class ResizeObserver {
      observe = vi.fn();
      disconnect = vi.fn();
    };
    CURATED_SUBJECT_VIDEOS['Math 101'] = [];
    useFormulas.mockReturnValue(mockUseFormulas);
    useLatex.mockReturnValue(mockUseLatex);
    useYouTubeResources.mockReturnValue({ resources: [], isLoading: false, error: '', topicLimit: 6 });
  });

  it('renders correctly with default state', () => {
    render(<CreateCheatSheet onSave={vi.fn().mockResolvedValue(undefined)} onReset={vi.fn()} />);

    // Check title input
    expect(screen.getByLabelText(/Title:/i)).toBeInTheDocument();
    
    // Check initial text
    expect(screen.getByText(/Select a subject, pick categories, then compile/i)).toBeInTheDocument();
    expect(screen.getByText(/Your PDF will appear here/i)).toBeInTheDocument();
    expect(screen.getByText(/Compile will generate the first draft if the editor is still empty/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Generate \/ Regenerate/i }))
      .toHaveAccessibleDescription('Generate replaces editor source. Compile keeps it.');
    expect(screen.getByRole('button', { name: /Compile PDF/i }))
      .toHaveAccessibleDescription('Generate replaces editor source. Compile keeps it.');
  });

  it.each([[false, false], [true, false], [false, true], [true, true]])('enables only available history actions (back: %s, forward: %s)', (canGoBack, canGoForward) => {
    useLatex.mockReturnValue({ ...mockUseLatex, canGoBack, canGoForward });
    render(<CreateCheatSheet onSave={vi.fn()} onReset={vi.fn()} />);
    const back = screen.getByRole('button', { name: 'Back', exact: true });
    const forward = screen.getByRole('button', { name: 'Forward', exact: true });

    expect(back.disabled).toBe(!canGoBack);
    expect(forward.disabled).toBe(!canGoForward);
    fireEvent.click(back);
    fireEvent.click(forward);
    expect(mockUseLatex.goBack).toHaveBeenCalledTimes(canGoBack ? 1 : 0);
    expect(mockUseLatex.goForward).toHaveBeenCalledTimes(canGoForward ? 1 : 0);
  });

  it('generates selected formulas from the explicit generate action', () => {
    const handleGenerateSheetMock = vi.fn();
    const selectedFormulas = [{ name: 'test' }];

    useLatex.mockReturnValue({ ...mockUseLatex, handleGenerateSheet: handleGenerateSheetMock });
    useFormulas.mockReturnValue({ 
      ...mockUseFormulas, 
      selectedCount: 1, 
      getSelectedFormulasList: vi.fn().mockReturnValue(selectedFormulas) 
    });

    render(<CreateCheatSheet onSave={vi.fn().mockResolvedValue(undefined)} onReset={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: /Generate \/ Regenerate/i }));

    expect(handleGenerateSheetMock).toHaveBeenCalledWith(selectedFormulas);
  });

  it.each([
    ['subject', 'leftWidth', 280, 300, 220, 420],
    ['video', 'rightWidth', 300, 280, 240, 420],
    ['LaTeX', 'latexWidth', 430, 450, 320, 570],
  ])('resizes the %s panel with arrow keys and persists the result', (panel, field, initial, expected, minimum, maximum) => {
    localStorage.clear();
    const width = vi.spyOn(globalThis.HTMLElement.prototype, 'clientWidth', 'get').mockImplementation(function () {
      return this.classList.contains('center-panel') ? 840 : 1440;
    });
    try {
      useLatex.mockReturnValue({ ...mockUseLatex, content: 'source' });
      render(<CreateCheatSheet onSave={vi.fn()} onReset={vi.fn()} />);
      if (panel === 'LaTeX') fireEvent.click(screen.getByRole('button', { name: 'Show LaTeX editor' }));
      const resizer = screen.getByRole('button', { name: `Resize ${panel} panel` });
      const event = new window.KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true });
      fireEvent(resizer, event);
      expect(event.defaultPrevented).toBe(true);
      expect(JSON.parse(localStorage.getItem('editorPanelLayout'))[field]).toBe(expected);
      fireEvent.keyDown(resizer, { key: 'ArrowLeft' });
      expect(JSON.parse(localStorage.getItem('editorPanelLayout'))[field]).toBe(initial);
      const saved = localStorage.getItem('editorPanelLayout');
      fireEvent.keyDown(resizer, { key: 'Tab' });
      expect(localStorage.getItem('editorPanelLayout')).toBe(saved);
      const increase = panel === 'video' ? 'ArrowLeft' : 'ArrowRight';
      const decrease = panel === 'video' ? 'ArrowRight' : 'ArrowLeft';
      for (let i = 0; i < 30; i++) fireEvent.keyDown(resizer, { key: increase });
      expect(JSON.parse(localStorage.getItem('editorPanelLayout'))[field]).toBe(maximum);
      for (let i = 0; i < 30; i++) fireEvent.keyDown(resizer, { key: decrease });
      expect(JSON.parse(localStorage.getItem('editorPanelLayout'))[field]).toBe(minimum);
    } finally {
      width.mockRestore();
      localStorage.clear();
    }
  });

  it('shrinks the subject panel on first compile without hiding the compile controls', () => {
    const handleCompileOnlyMock = vi.fn();
    const selectedFormulas = [{ name: 'test' }];

    useLatex.mockReturnValue({ ...mockUseLatex, handleCompileOnly: handleCompileOnlyMock });
    useFormulas.mockReturnValue({
      ...mockUseFormulas,
      selectedCount: 1,
      getSelectedFormulasList: vi.fn().mockReturnValue(selectedFormulas),
    });

    render(<CreateCheatSheet onSave={vi.fn().mockResolvedValue(undefined)} onReset={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: /Compile PDF/i }));

    expect(document.querySelector('.app-body')).toHaveStyle('--app-body-columns: 220px 10px minmax(0, 1fr) 10px 300px');
    expect(screen.getByRole('button', { name: /Compile PDF/i })).toBeInTheDocument();
    expect(handleCompileOnlyMock).toHaveBeenCalledWith(selectedFormulas);
  });

  it('keeps the LaTeX editor closed when compiled content exists', () => {
    useLatex.mockReturnValue({
      ...mockUseLatex,
      content: '\\documentclass{article}',
      pdfBlob: new Blob(['pdf'], { type: 'application/pdf' }),
    });

    render(<CreateCheatSheet onSave={vi.fn().mockResolvedValue(undefined)} onReset={vi.fn()} />);

    expect(screen.getByRole('button', { name: /Show LaTeX editor/i })).toBeInTheDocument();
    expect(screen.queryByLabelText(/Generated LaTeX Code:/i)).not.toBeInTheDocument();
  });

  it('passes explicit initial data to useLatex without treating later props as manual edits', () => {
    const setOrientation = vi.fn();
    const handleContentChange = vi.fn();

    useLatex.mockReturnValue({
      ...mockUseLatex,
      setOrientation,
      handleContentChange,
    });

    const { rerender } = render(
      <CreateCheatSheet
        onSave={vi.fn().mockResolvedValue(undefined)}
        onReset={vi.fn()}
        initialData={{ content: 'saved source', orientation: 'landscape' }}
      />,
    );

    expect(useLatex).toHaveBeenLastCalledWith(expect.objectContaining({ content: 'saved source', orientation: 'landscape' }), undefined, [], { restoreSelections: undefined, formulaSelections: [], knownIds: new Set(), onDocumentChange: expect.any(Function) });
    expect(setOrientation).not.toHaveBeenCalled();
    expect(handleContentChange).not.toHaveBeenCalled();

    rerender(
      <CreateCheatSheet
        onSave={vi.fn().mockResolvedValue(undefined)}
        onReset={vi.fn()}
        initialData={{ content: 'new server source', orientation: 'portrait' }}
      />,
    );

    expect(useLatex).toHaveBeenLastCalledWith(expect.objectContaining({ content: 'new server source', orientation: 'portrait' }), undefined, [], { restoreSelections: undefined, formulaSelections: [], knownIds: new Set(), onDocumentChange: expect.any(Function) });
    expect(handleContentChange).not.toHaveBeenCalled();
  });

  it('offers source download after a first compile failure without a PDF', () => {
    useLatex.mockReturnValue({ ...mockUseLatex, content: 'recoverable source', compileError: 'Compile unavailable' });
    render(<CreateCheatSheet onSave={vi.fn()} onReset={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: '.tex', exact: true }));

    expect(mockUseLatex.handleDownloadTex).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('button', { name: 'Download PDF' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Print', exact: true })).toBeDisabled();
  });

  it('does not claim to show a previous PDF when the first compile fails', () => {
    useLatex.mockReturnValue({ ...mockUseLatex, content: 'source', compileError: 'Compile unavailable' });
    render(<CreateCheatSheet onSave={vi.fn()} onReset={vi.fn()} />);

    expect(screen.getByRole('alert')).toHaveTextContent('Compile failed. No PDF is available.');
    expect(screen.getByRole('alert')).toHaveTextContent('Compile unavailable');
    expect(screen.queryByTestId('mock-document')).not.toBeInTheDocument();
  });

  it('keeps a successful PDF visible alongside a compile error', () => {
    useLatex.mockReturnValue({
      ...mockUseLatex,
      pdfBlob: new Blob(['pdf'], { type: 'application/pdf' }),
      compileError: 'document.tex:7: error: missing brace',
    });

    render(<CreateCheatSheet onSave={vi.fn()} onReset={vi.fn()} />);

    expect(screen.getByRole('alert')).toHaveTextContent(/Latest compile failed\. Showing the last successful PDF/i);
    expect(screen.getByText(/missing brace/i)).toBeInTheDocument();
    expect(screen.getByTestId('mock-document')).toBeInTheDocument();
  });

  it('shows one session-expiry notice and retains the prior PDF after compile rejects stale credentials', () => {
    useLatex.mockReturnValue({
      ...mockUseLatex,
      pdfBlob: new Blob(['pdf'], { type: 'application/pdf' }),
      authenticationRequired: true,
      compileError: 'Your session has expired. Sign in again or sign out to compile as a guest.',
    });

    render(
      <MemoryRouter>
        <CreateCheatSheet onSave={vi.fn()} onReset={vi.fn()} />
      </MemoryRouter>,
    );

    expect(screen.getByRole('alert')).toHaveTextContent('Your session has expired. Sign in again or sign out to compile as a guest.');
    expect(screen.getByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '/login');
    expect(screen.getAllByText('Your session has expired. Sign in again or sign out to compile as a guest.')).toHaveLength(1);
    expect(screen.getByTestId('mock-document')).toBeInTheDocument();
  });

  it('autosaves the exact successful compile snapshot from the hook', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const formulaSelections = [{ formula_id: 'physics.motion.velocity' }];
    const snapshot = {
      title: 'Compiled title',
      content: '\\documentclass{article}\nCompiled source',
      contentSource: 'generated',
      columns: 2,
      fontSize: '11pt',
      spacing: 'large',
      margins: '0.5in',
      orientation: 'landscape',
      selectedFormulas: [{ class: 'Physics', category: 'Motion', name: 'Velocity' }],
      history: [{ content: 'Earlier source', timestamp: 1 }],
      compiledAt: 123456789,
      pdfBlob: 'blob:successful-compile',
    };

    useFormulas.mockReturnValue({
      ...mockUseFormulas,
      formulaSelections,
      getFormulaSelectionsList: vi.fn().mockReturnValue(formulaSelections),
    });
    useLatex.mockReturnValue({
      ...mockUseLatex,
      title: 'Current title should not be saved',
      content: 'Current source should not be saved',
      pdfBlob: snapshot.pdfBlob,
      lastCompileSnapshot: snapshot,
    });

    render(<CreateCheatSheet onSave={onSave} onReset={vi.fn()} />);

    await waitFor(() => expect(onSave).toHaveBeenCalledWith({
      ...snapshot,
      formulaSelections,
      compileSnapshot: snapshot,
    }, false));
  });

  it('saves canonical formula selections alongside legacy display records', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const selectedFormulas = [{ id: 'calculus.derivatives.chain-rule', class: 'Calculus', category: 'Derivatives', name: 'Chain Rule' }];
    const formulaSelections = [{ formula_id: 'calculus.derivatives.chain-rule' }];
    useFormulas.mockReturnValue({
      ...mockUseFormulas,
      selectedCount: 1,
      getSelectedFormulasList: vi.fn().mockReturnValue(selectedFormulas),
      formulaSelections,
      getFormulaSelectionsList: vi.fn().mockReturnValue(formulaSelections),
    });

    render(<CreateCheatSheet onSave={onSave} onReset={vi.fn()} />);

    fireEvent.click(screen.getAllByRole('button', { name: 'Save' })[0]);

    await waitFor(() => expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
      selectedFormulas,
      formulaSelections,
    })));
  });

  it('compiles existing manual content without regenerating', () => {
    const handleCompileOnlyMock = vi.fn();
    const handleGenerateSheetMock = vi.fn();
    const selectedFormulas = [{ name: 'test' }];

    useLatex.mockReturnValue({
      ...mockUseLatex,
      content: '\\documentclass{article}\n% manual source',
      contentModified: true,
      handleCompileOnly: handleCompileOnlyMock,
      handleGenerateSheet: handleGenerateSheetMock,
    });
    useFormulas.mockReturnValue({
      ...mockUseFormulas,
      selectedCount: 1,
      getSelectedFormulasList: vi.fn().mockReturnValue(selectedFormulas),
    });

    render(<CreateCheatSheet onSave={vi.fn()} onReset={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: /Compile PDF/i }));

    expect(handleCompileOnlyMock).toHaveBeenCalledWith(selectedFormulas);
    expect(handleGenerateSheetMock).not.toHaveBeenCalled();
  });

  it('compiles generated source without regenerating it', () => {
    const handleCompileOnlyMock = vi.fn();
    const handlePreviewMock = vi.fn();
    const selectedFormulas = [{ name: 'updated-formula' }];

    useLatex.mockReturnValue({
      ...mockUseLatex,
      contentModified: true,
      canRegenerateFromSelections: true,
      handleCompileOnly: handleCompileOnlyMock,
      handlePreview: handlePreviewMock,
    });
    useFormulas.mockReturnValue({
      ...mockUseFormulas,
      selectedCount: 1,
      getSelectedFormulasList: vi.fn().mockReturnValue(selectedFormulas),
    });

    render(<CreateCheatSheet onSave={vi.fn()} onReset={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: /Compile PDF/i }));

    expect(handlePreviewMock).not.toHaveBeenCalled();
    expect(handleCompileOnlyMock).toHaveBeenCalledWith(selectedFormulas);
  });

  it('compiles current source after class changes instead of regenerating it', () => {
    const handleCompileOnlyMock = vi.fn();
    const handlePreviewMock = vi.fn();
    const selectedFormulas = [{ class: 'Math 101', category: 'Algebra', name: 'updated-formula' }];

    useLatex.mockReturnValue({
      ...mockUseLatex,
      contentSource: 'generated',
      canRegenerateFromSelections: false,
      contentModified: false,
      handleCompileOnly: handleCompileOnlyMock,
      handlePreview: handlePreviewMock,
    });
    useFormulas.mockReturnValue({
      ...mockUseFormulas,
      selectedCount: 1,
      getSelectedFormulasList: vi.fn().mockReturnValue(selectedFormulas),
    });

    render(<CreateCheatSheet onSave={vi.fn()} onReset={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: /Compile PDF/i }));

    expect(handlePreviewMock).not.toHaveBeenCalled();
    expect(handleCompileOnlyMock).toHaveBeenCalledWith(selectedFormulas);
  });

  it('uses the compile fallback when the source is empty', () => {
    const handleCompileOnlyMock = vi.fn();
    const handlePreviewMock = vi.fn();
    const firstSelection = [{ class: 'Math 101', category: 'Algebra', name: 'first-formula' }];

    useLatex.mockReturnValue({
      ...mockUseLatex,
      contentSource: 'empty',
      handleCompileOnly: handleCompileOnlyMock,
      handlePreview: handlePreviewMock,
    });

    useFormulas.mockReturnValue({
      ...mockUseFormulas,
      selectedCount: 1,
      getSelectedFormulasList: vi.fn().mockReturnValue(firstSelection),
    });

    render(<CreateCheatSheet onSave={vi.fn()} onReset={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: /Compile PDF/i }));

    expect(handleCompileOnlyMock).toHaveBeenCalledWith(firstSelection);
    expect(handlePreviewMock).not.toHaveBeenCalled();
  });

  it('does not overwrite compiled manual LaTeX on later compile clicks', () => {
    const handleCompileOnlyMock = vi.fn();
    const handlePreviewMock = vi.fn();
    const selectedFormulas = [{ name: 'test' }];

    useLatex.mockReturnValue({
      ...mockUseLatex,
      content: '\\documentclass{article}\n% user edit',
      contentModified: false,
      canRegenerateFromSelections: false,
      handleCompileOnly: handleCompileOnlyMock,
      handlePreview: handlePreviewMock,
    });
    useFormulas.mockReturnValue({
      ...mockUseFormulas,
      selectedCount: 1,
      getSelectedFormulasList: vi.fn().mockReturnValue(selectedFormulas),
    });

    render(<CreateCheatSheet onSave={vi.fn()} onReset={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: /Compile PDF/i }));

    expect(handlePreviewMock).not.toHaveBeenCalled();
    expect(handleCompileOnlyMock).toHaveBeenCalledWith(selectedFormulas);
  });

  it('compiles on Ctrl+Enter and prevents the browser default action', () => {
    const handleCompileOnlyMock = vi.fn();
    const selectedFormulas = [{ name: 'test' }];

    useLatex.mockReturnValue({ ...mockUseLatex, handleCompileOnly: handleCompileOnlyMock });
    useFormulas.mockReturnValue({
      ...mockUseFormulas,
      selectedCount: 1,
      getSelectedFormulasList: vi.fn().mockReturnValue(selectedFormulas),
    });

    render(<CreateCheatSheet onSave={vi.fn().mockResolvedValue(undefined)} onReset={vi.fn()} />);

    const shortcutEvent = new window.KeyboardEvent('keydown', {
      key: 'Enter',
      ctrlKey: true,
      bubbles: true,
      cancelable: true,
    });

    window.dispatchEvent(shortcutEvent);

    expect(shortcutEvent.defaultPrevented).toBe(true);
    expect(handleCompileOnlyMock).toHaveBeenCalledWith(selectedFormulas);
  });

  it('saves on Ctrl+S and prevents the browser default action', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);

    render(<CreateCheatSheet onSave={onSave} onReset={vi.fn()} />);

    const shortcutEvent = new window.KeyboardEvent('keydown', {
      key: 's',
      ctrlKey: true,
      bubbles: true,
      cancelable: true,
    });

    window.dispatchEvent(shortcutEvent);

    expect(shortcutEvent.defaultPrevented).toBe(true);
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
  });

  it.each(['ctrlKey', 'metaKey'])('does not overlap pending saves from %s shortcuts', async (modifier) => {
    let finishSave;
    const pending = new Promise((resolve) => { finishSave = resolve; });
    const onSave = vi.fn().mockReturnValueOnce(pending).mockResolvedValue(undefined);
    render(<CreateCheatSheet onSave={onSave} onReset={vi.fn()} />);

    act(() => {
      fireEvent.keyDown(window, { key: 's', [modifier]: true });
      fireEvent.keyDown(window, { key: 's', [modifier]: true });
    });
    try {
      expect(onSave).toHaveBeenCalledTimes(1);
    } finally {
      await act(async () => finishSave());
    }

    fireEvent.keyDown(window, { key: 's', [modifier]: true });
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(2));
  });

  it('does not start a shortcut save while the parent is saving', () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(<CreateCheatSheet onSave={onSave} onReset={vi.fn()} isSaving />);
    const shortcut = new window.KeyboardEvent('keydown', { key: 's', ctrlKey: true, cancelable: true });

    fireEvent(window, shortcut);

    expect(shortcut.defaultPrevented).toBe(true);
    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByTitle('Save (Ctrl + S)')).toBeDisabled();
  });

  it('blocks a shortcut during a button save and allows retry after failure', async () => {
    let failSave;
    const pending = new Promise((_resolve, reject) => { failSave = reject; });
    const onSave = vi.fn().mockReturnValueOnce(pending).mockResolvedValue(undefined);
    render(<CreateCheatSheet onSave={onSave} onReset={vi.fn()} />);

    fireEvent.click(screen.getByTitle('Save (Ctrl + S)'));
    fireEvent.keyDown(window, { key: 's', metaKey: true });
    expect(onSave).toHaveBeenCalledTimes(1);
    await act(async () => failSave(new Error('Network unavailable')));
    expect(screen.getByRole('alert')).toHaveTextContent('Failed to save. Please try again.');

    fireEvent.keyDown(window, { key: 's', ctrlKey: true });
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(2));
    expect(screen.getByRole('alert')).toHaveTextContent('Cheat sheet saved successfully!');
  });

  it('ignores repeated shortcut keydown events', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);

    render(<CreateCheatSheet onSave={onSave} onReset={vi.fn()} />);

    const repeatedShortcutEvent = new window.KeyboardEvent('keydown', {
      key: 's',
      ctrlKey: true,
      bubbles: true,
      cancelable: true,
      repeat: true,
    });

    window.dispatchEvent(repeatedShortcutEvent);

    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(0));
    expect(repeatedShortcutEvent.defaultPrevented).toBe(false);
  });

  it('can open youtube resources when class is selected', () => {
    const mockDataWithClass = {
      ...mockUseFormulas,
      classesData: [
        {
          name: 'Calculus I',
          categories: []
        }
      ],
      selectedClasses: { 'Calculus I': true },
      hasSelectedClasses: true
    };
    useFormulas.mockReturnValue(mockDataWithClass);

    render(<CreateCheatSheet onSave={vi.fn()} onReset={vi.fn()} />);
    
    // Toggle class checkbox
    const checkbox = screen.getByLabelText('Calculus I');
    fireEvent.click(checkbox);
    
    expect(mockDataWithClass.toggleClass).toHaveBeenCalledWith('Calculus I');
  });

  it('shows curated videos before a YouTube search runs', () => {
    CURATED_SUBJECT_VIDEOS['Math 101'] = [
      { url: 'https://youtu.be/abc123abc12', title: 'Curated Algebra Video', channel: 'Teacher Tube', topic: 'Algebra' },
    ];

    useFormulas.mockReturnValue({
      ...mockUseFormulas,
      classesData: [
        {
          name: 'Math 101',
          categories: [{ name: 'Algebra', formulas: [] }],
        },
      ],
      selectedClasses: { 'Math 101': true },
      selectedCategories: { 'Math 101:Algebra': true },
      hasSelectedClasses: true,
    });

    render(<CreateCheatSheet onSave={vi.fn()} onReset={vi.fn()} />);

    expect(screen.getAllByRole('button', { name: /open curated algebra video/i }).length).toBeGreaterThan(0);
    expect(useYouTubeResources).toHaveBeenCalledWith(null);
  });

  it('only shows curated videos for matching selected sections', () => {
    CURATED_SUBJECT_VIDEOS['Math 101'] = [
      { url: 'https://youtu.be/abc123abc12', title: 'Geometry Curated Video', channel: 'Teacher Tube', category: 'Geometry' },
    ];

    useFormulas.mockReturnValue({
      ...mockUseFormulas,
      classesData: [
        {
          name: 'Math 101',
          categories: [{ name: 'Algebra', formulas: [] }, { name: 'Geometry', formulas: [] }],
        },
      ],
      selectedClasses: { 'Math 101': true },
      selectedCategories: { 'Math 101:Algebra': true },
      hasSelectedClasses: true,
    });

    render(<CreateCheatSheet onSave={vi.fn()} onReset={vi.fn()} />);

    expect(screen.queryByRole('button', { name: /open geometry curated video/i })).not.toBeInTheDocument();
  });

  it('shows one curated video per section until expanded', () => {
    CURATED_SUBJECT_VIDEOS['Math 101'] = [
      { url: 'https://youtu.be/abc123abc12', title: 'First Algebra Video', channel: 'Teacher Tube', categories: ['Algebra'] },
      { url: 'https://youtu.be/def456def45', title: 'Second Algebra Video', channel: 'Teacher Tube', categories: ['Algebra'] },
      { url: 'https://youtu.be/ghi789ghi78', title: 'Third Algebra Video', channel: 'Teacher Tube', categories: ['Algebra'] },
    ];

    useFormulas.mockReturnValue({
      ...mockUseFormulas,
      selectedClasses: { 'Math 101': true },
      selectedCategories: { 'Math 101:Algebra': true },
      hasSelectedClasses: true,
    });

    render(<CreateCheatSheet onSave={vi.fn()} onReset={vi.fn()} />);

    const rightPanel = within(document.querySelector('.right-panel'));
    expect(rightPanel.getByRole('button', { name: /open first algebra video/i })).toBeInTheDocument();
    expect(rightPanel.queryByRole('button', { name: /open second algebra video/i })).not.toBeInTheDocument();

    fireEvent.click(rightPanel.getByRole('button', { name: /show 2 more videos/i }));

    expect(rightPanel.getByRole('button', { name: /open second algebra video/i })).toBeInTheDocument();
    expect(rightPanel.getByRole('button', { name: /open third algebra video/i })).toBeInTheDocument();
  });

  it('keeps searched videos out of the subject selector', () => {
    useYouTubeResources.mockReturnValue({
      resources: [
        {
          className: 'Math 101',
          category: 'Algebra',
          title: 'API Algebra Video',
          channel: 'YouTube',
          videoId: 'api123api12',
        },
      ],
      isLoading: false,
      error: '',
      topicLimit: 6,
    });
    useFormulas.mockReturnValue({
      ...mockUseFormulas,
      selectedClasses: { 'Math 101': true },
      selectedCategories: { 'Math 101:Algebra': true },
      hasSelectedClasses: true,
    });

    render(<CreateCheatSheet onSave={vi.fn()} onReset={vi.fn()} />);

    expect(within(document.querySelector('.right-panel')).getByRole('button', { name: /open api algebra video/i })).toBeInTheDocument();
    expect(within(document.querySelector('.left-panel')).queryByRole('button', { name: /open api algebra video/i })).not.toBeInTheDocument();
  });

  it('searches YouTube only when the user asks for more videos', () => {
    const selectedData = {
      ...mockUseFormulas,
      classesData: [
        {
          name: 'Math 101',
          categories: [{ name: 'Algebra', formulas: [] }],
        },
      ],
      selectedClasses: { 'Math 101': true },
      selectedCategories: { 'Math 101:Algebra': true },
      hasSelectedClasses: true,
    };
    useFormulas.mockReturnValue(selectedData);

    render(<CreateCheatSheet onSave={vi.fn()} onReset={vi.fn()} />);

    expect(useYouTubeResources).toHaveBeenLastCalledWith(null);

    fireEvent.click(screen.getByRole('button', { name: /Search YouTube for more/i }));

    expect(useYouTubeResources).toHaveBeenLastCalledWith(expect.objectContaining({
      topics: [{ className: 'Math 101', category: 'Algebra' }],
    }));
  });

  it('searches YouTube only for the clicked section', () => {
    useFormulas.mockReturnValue({
      ...mockUseFormulas,
      classesData: [
        {
          name: 'Math 101',
          categories: [{ name: 'Algebra', formulas: [] }, { name: 'Geometry', formulas: [] }],
        },
      ],
      selectedClasses: { 'Math 101': true },
      selectedCategories: { 'Math 101:Algebra': true, 'Math 101:Geometry': true },
      hasSelectedClasses: true,
    });

    render(<CreateCheatSheet onSave={vi.fn()} onReset={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: /Search YouTube for more in Geometry/i }));

    expect(useYouTubeResources).toHaveBeenLastCalledWith(expect.objectContaining({
      topics: [{ className: 'Math 101', category: 'Geometry' }],
    }));
  });

  it('hides and restores the subjects panel from the toolbar', () => {
    render(<CreateCheatSheet onSave={vi.fn()} onReset={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: /Hide subjects/i }));

    expect(screen.queryByLabelText(/Title:/i)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Show subjects/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Show subjects/i }));

    expect(screen.getByLabelText(/Title:/i)).toBeInTheDocument();
  });

  it.each([false, true])('delegates confirmed Clear to its owner, or clears standalone hooks (managed: %s)', (managed) => {
    const verifyConfirm = vi.spyOn(window, 'confirm').mockImplementation(() => true);
    const mockClearLatex = vi.fn();
    const mockClearSelections = vi.fn();
    
    useLatex.mockReturnValue({ ...mockUseLatex, clearLatex: mockClearLatex });
    useFormulas.mockReturnValue({ ...mockUseFormulas, clearSelections: mockClearSelections });
    
    const mockReset = vi.fn();

    render(<CreateCheatSheet onSave={vi.fn()} onReset={managed ? mockReset : undefined} />);

    // We have two buttons with "Clear". Use the one with the correct text. Look by button text
    const clearButton = screen.getAllByRole('button', { name: /Clear/i })[0];
    fireEvent.click(clearButton);

    expect(verifyConfirm).toHaveBeenCalled();
    expect(mockClearLatex).toHaveBeenCalledTimes(managed ? 0 : 1);
    expect(mockClearSelections).toHaveBeenCalledTimes(managed ? 0 : 1);
    expect(mockReset).toHaveBeenCalledTimes(managed ? 1 : 0);
  });
});
