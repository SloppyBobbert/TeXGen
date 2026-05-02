import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CreateCheatSheet from './CreateCheatSheet';
import { useFormulas } from '../hooks/formulas';
import { useLatex } from '../hooks/latex';

// Mock the dependencies
vi.mock('../hooks/formulas');
vi.mock('../hooks/latex');
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
    toggleCategory: vi.fn(),
    getSelectedFormulasList: vi.fn(),
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
    hasLayoutChanges: false,
    handleContentChange: vi.fn(),
    columns: 2,
    setColumns: vi.fn(),
    fontSize: '10pt',
    setFontSize: vi.fn(),
    spacing: 'medium',
    setSpacing: vi.fn(),
    margins: '0.25in',
    setMargins: vi.fn(),
    pdfBlob: null,
    isGenerating: false,
    isCompiling: false,
    isLoading: false,
    compileError: null,
    canGoBack: false,
    canGoForward: false,
    goBack: vi.fn(),
    goForward: vi.fn(),
    handleGenerateSheet: vi.fn(),
    handleCompileOnly: vi.fn(),
    handleDownloadPDF: vi.fn(),
    handleDownloadTex: vi.fn(),
    clearLatex: vi.fn()
  };

  beforeEach(() => {
    vi.clearAllMocks();
    useFormulas.mockReturnValue(mockUseFormulas);
    useLatex.mockReturnValue(mockUseLatex);
  });

  it('renders correctly with default state', () => {
    render(<CreateCheatSheet onSave={vi.fn()} onReset={vi.fn()} />);

    // Check title input
    expect(screen.getByLabelText(/Title:/i)).toBeInTheDocument();
    
    // Check initial text
    expect(screen.getByText(/Select a subject, pick categories, then compile/i)).toBeInTheDocument();
    expect(screen.getByText(/Your PDF will appear here/i)).toBeInTheDocument();
  });

  it('handles generating a cheat sheet', () => {
    const handleGenerateSheetMock = vi.fn();
    useLatex.mockReturnValue({ ...mockUseLatex, handleGenerateSheet: handleGenerateSheetMock });
    useFormulas.mockReturnValue({ 
      ...mockUseFormulas, 
      selectedCount: 1, 
      getSelectedFormulasList: vi.fn().mockReturnValue([{ name: 'test' }]) 
    });

    render(<CreateCheatSheet onSave={vi.fn()} onReset={vi.fn()} />);
    
    // Using role checking to reliably find the generate button which shouldn't be disabled
    const generateBtn = screen.getByRole('button', { name: /Generate Cheat Sheet/i });
    fireEvent.click(generateBtn);
    
    expect(handleGenerateSheetMock).toHaveBeenCalled();
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

  it('handles clearing data correctly', () => {
    const verifyConfirm = vi.spyOn(window, 'confirm').mockImplementation(() => true);
    const mockClearLatex = vi.fn();
    const mockClearSelections = vi.fn();
    
    useLatex.mockReturnValue({ ...mockUseLatex, clearLatex: mockClearLatex });
    useFormulas.mockReturnValue({ ...mockUseFormulas, clearSelections: mockClearSelections });
    
    const mockReset = vi.fn();

    render(<CreateCheatSheet onSave={vi.fn()} onReset={mockReset} />);

    // We have two buttons with "Clear". Use the one with the correct text. Look by button text
    const clearButton = screen.getAllByRole('button', { name: /Clear/i })[0];
    fireEvent.click(clearButton);

    expect(verifyConfirm).toHaveBeenCalled();
    expect(mockClearLatex).toHaveBeenCalled();
    expect(mockClearSelections).toHaveBeenCalled();
    expect(mockReset).toHaveBeenCalled();
  });
});
