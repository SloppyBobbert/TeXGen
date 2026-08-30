import { StrictMode } from 'react';
import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useFormulas } from './formulas';

// Mock the global fetch
const mockClassesData = {
  classes: [
    {
      name: 'Algebra',
      categories: [
        {
          name: 'Linear Equations',
          formulas: [{ id: 'slope', name: 'Slope Formula' }, { id: 'intercept', name: 'Intercept Form' }]
        },
        {
          name: 'Quadratics',
          formulas: [{ id: 'quadratic', name: 'Quadratic Formula' }]
        }
      ]
    },
    {
      name: 'Geometry',
      categories: [
        {
          name: 'Shapes',
          formulas: [{ id: 'circle', name: 'Area of Circle' }]
        }
      ]
    }
  ]
};
const deferred = () => {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
};

const mockLocalStorage = (() => {
  let store = {};
  return {
    getItem: (key) => store[key] ?? null,
    setItem: (key, value) => { store[key] = String(value); },
    removeItem: (key) => { delete store[key]; },
    clear: () => { store = {}; },
  };
})();

describe('useFormulas hook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLocalStorage.clear();
    vi.stubGlobal('localStorage', mockLocalStorage);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      json: vi.fn().mockResolvedValue(mockClassesData)
    }));
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    mockLocalStorage.clear();
  });

  it('fetches classes data on mount', async () => {
    const { result } = renderHook(() => useFormulas());

    // Wait for the fetch to resolve and state to update
    await vi.waitFor(() => {
      expect(result.current.classesData).toEqual(mockClassesData.classes);
    });
  });

  it('toggles a full class selection', async () => {
    const { result } = renderHook(() => useFormulas());

    await vi.waitFor(() => {
      expect(result.current.classesData.length).toBeGreaterThan(0);
    });

    act(() => {
      result.current.toggleClass('Algebra');
    });

    // Should have selected the class and all its categories
    expect(result.current.selectedClasses['Algebra']).toBe(true);
    expect(result.current.selectedCategories['Algebra:Linear Equations']).toBe(true);
    expect(result.current.selectedCategories['Algebra:Quadratics']).toBe(true);

    // Should have populated groupedFormulas
    const algebraGroup = result.current.groupedFormulas.find(g => g.class === 'Algebra');
    expect(algebraGroup).toBeDefined();
    expect(algebraGroup.formulas.length).toBe(3); // 2 linear + 1 quadratic

    // Toggle off
    act(() => {
      result.current.toggleClass('Algebra');
    });

    expect(result.current.selectedClasses['Algebra']).toBeUndefined();
    expect(result.current.selectedCategories['Algebra:Linear Equations']).toBeUndefined();
    expect(result.current.groupedFormulas.length).toBe(0);
  });

  it('toggles an individual category', async () => {
    const { result } = renderHook(() => useFormulas());

    await vi.waitFor(() => {
      expect(result.current.classesData.length).toBeGreaterThan(0);
    });

    // We don't need to select the class first to select a category under the hood logic
    // but typically UI relies on it. Let's just toggle category.
    act(() => {
      result.current.toggleCategory('Algebra', 'Quadratics');
    });

    expect(result.current.selectedCategories['Algebra:Quadratics']).toBe(true);
    const group = result.current.groupedFormulas.find(g => g.class === 'Algebra');
    expect(group.formulas.length).toBe(1);
    expect(group.formulas[0].name).toBe('Quadratic Formula');
  });

  it('handles reordering formulas within a class', async () => {
    const { result } = renderHook(() => useFormulas());

    await vi.waitFor(() => {
      expect(result.current.classesData.length).toBeGreaterThan(0);
    });

    act(() => {
      result.current.toggleClass('Algebra'); // adds 3 formulas
    });

    act(() => {
      // Move 'Quadratic Formula' (index 2) to 'Slope Formula' (index 0)
      result.current.reorderFormula('Algebra', 2, 0);
    });

    const newOrder = result.current.groupedFormulas[0].formulas.map(f => f.name);
    expect(newOrder[0]).toBe('Quadratic Formula');
    expect(newOrder[1]).toBe('Slope Formula');
    expect(newOrder[2]).toBe('Intercept Form');
  });

  it('calculates selected formula count', async () => {
    const { result } = renderHook(() => useFormulas());

    await vi.waitFor(() => {
      expect(result.current.classesData.length).toBeGreaterThan(0);
    });

    act(() => {
      result.current.toggleClass('Geometry'); // adds 1 formula
    });

    expect(result.current.selectedCount).toBe(1);

    act(() => {
      result.current.toggleClass('Algebra'); // adds 3 formulas
    });

    expect(result.current.selectedCount).toBe(4);
  });

  it('selects and deselects all classes in a single action', async () => {
    const { result } = renderHook(() => useFormulas());

    await vi.waitFor(() => {
      expect(result.current.classesData.length).toBeGreaterThan(0);
    });

    act(() => {
      result.current.selectAllClasses();
    });

    expect(result.current.selectedClasses.Algebra).toBe(true);
    expect(result.current.selectedClasses.Geometry).toBe(true);
    expect(result.current.selectedCategories['Algebra:Linear Equations']).toBe(true);
    expect(result.current.selectedCategories['Algebra:Quadratics']).toBe(true);
    expect(result.current.selectedCategories['Geometry:Shapes']).toBe(true);
    expect(result.current.selectedCount).toBe(4);

    act(() => {
      result.current.deselectAllClasses();
    });

    expect(result.current.selectedClasses).toEqual({});
    expect(result.current.selectedCategories).toEqual({});
    expect(result.current.groupedFormulas).toEqual([]);
    expect(result.current.selectedCount).toBe(0);
  });

  it('restores a newer matching draft over stale explicit selections', async () => {
    mockLocalStorage.setItem('cheatSheetData:draft-a', JSON.stringify({
      groupedFormulas: [{ class: 'Geometry', formulas: [{ class: 'Geometry', category: 'Shapes', name: 'Area of Circle' }] }],
    }));

    const { result } = renderHook(() => useFormulas({
      selectedFormulas: [{ class: 'Algebra', category: 'Quadratics', name: 'Quadratic Formula' }],
    }, 'draft-a'));
    await vi.waitFor(() => expect(result.current.groupedFormulas).toHaveLength(1));

    expect(result.current.groupedFormulas[0].formulas[0].name).toBe('Area of Circle');
  });

  it('uses explicit empty selections when only unrelated draft storage exists', async () => {
    mockLocalStorage.setItem('cheatSheetData:unrelated', JSON.stringify({
      groupedFormulas: [{ class: 'Algebra', formulas: [{ class: 'Algebra', category: 'Quadratics', name: 'Quadratic Formula' }] }],
    }));

    const { result } = renderHook(() => useFormulas({ selectedFormulas: [] }, 'draft-a'));
    await vi.waitFor(() => expect(result.current.classesData).toEqual(mockClassesData.classes));
    await act(async () => { await Promise.resolve(); });

    expect(result.current.groupedFormulas).toEqual([]);
  });

  it('restores only the draft matching the current draft identity', async () => {
    mockLocalStorage.setItem('cheatSheetData:matching', JSON.stringify({
      groupedFormulas: [{ class: 'Algebra', formulas: [{ class: 'Algebra', category: 'Quadratics', name: 'Quadratic Formula' }] }],
    }));
    mockLocalStorage.setItem('cheatSheetData:unrelated', JSON.stringify({
      groupedFormulas: [{ class: 'Geometry', formulas: [{ class: 'Geometry', category: 'Shapes', name: 'Area of Circle' }] }],
    }));

    const { result } = renderHook(() => useFormulas(undefined, 'matching'));
    await vi.waitFor(() => expect(result.current.groupedFormulas).toHaveLength(1));

    expect(result.current.groupedFormulas[0].formulas[0].name).toBe('Quadratic Formula');
    expect(mockLocalStorage.getItem('cheatSheetData:unrelated')).toContain('Area of Circle');
  });

  it('becomes ready only after matching draft hydration, including an explicit empty draft', async () => {
    const classes = deferred();
    vi.stubGlobal('fetch', vi.fn(() => classes.promise));
    mockLocalStorage.setItem('cheatSheetData:draft-a', JSON.stringify({ groupedFormulas: [] }));
    const { result } = renderHook(() => useFormulas({ selectedFormulas: [{ class: 'Geometry', category: 'Shapes', name: 'Area of Circle' }] }, 'draft-a'));

    expect(result.current.isFormulaSelectionInitialized).toBe(false);
    await act(async () => classes.resolve({ json: async () => mockClassesData }));
    await vi.waitFor(() => expect(result.current.isFormulaSelectionInitialized).toBe(true));
    expect(result.current.groupedFormulas).toEqual([]);
  });

  it('preserves raw authoritative formulas and becomes ready when class fetch fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    const rawFormula = { class: 'Missing class', category: 'Missing category', name: 'Formula' };
    const { result } = renderHook(() => useFormulas({ selectedFormulas: [rawFormula] }, 'draft-a'));

    await vi.waitFor(() => expect(result.current.isFormulaSelectionInitialized).toBe(true));
    expect(result.current.classesData).toEqual([]);
    expect(result.current.groupedFormulas).toEqual([{ class: 'Missing class', formulas: [rawFormula] }]);
  });

  it('does not hydrate state after unmount', async () => {
    const classes = deferred();
    vi.stubGlobal('fetch', vi.fn(() => classes.promise));
    const { result, unmount } = renderHook(() => useFormulas({ selectedFormulas: [] }, 'draft-a'));
    unmount();
    await act(async () => classes.resolve({ json: async () => mockClassesData }));
    expect(result.current.isFormulaSelectionInitialized).toBe(false);
  });

  it('removes one formula without removing its sibling category or class', async () => {
    const { result } = renderHook(() => useFormulas());
    await vi.waitFor(() => expect(result.current.classesData).toHaveLength(2));
    act(() => { result.current.toggleClass('Algebra'); });
    act(() => { result.current.removeSingleFormula('Algebra', 'Linear Equations', 'Slope Formula'); });

    expect(result.current.selectedClasses.Algebra).toBe(true);
    expect(result.current.selectedCategories['Algebra:Linear Equations']).toBe(true);
    expect(result.current.selectedCategories['Algebra:Quadratics']).toBe(true);
    expect(result.current.groupedFormulas[0].formulas.map((formula) => formula.name)).toEqual(['Intercept Form', 'Quadratic Formula']);
  });

  it('removes the empty category and class after its final formula is removed', async () => {
    const { result } = renderHook(() => useFormulas());
    await vi.waitFor(() => expect(result.current.classesData).toHaveLength(2));
    act(() => { result.current.toggleCategory('Geometry', 'Shapes'); });
    act(() => { result.current.removeSingleFormula('Geometry', 'Shapes', 'Area of Circle'); });

    expect(result.current.groupedFormulas).toEqual([]);
    expect(result.current.selectedClasses.Geometry).toBeUndefined();
    expect(result.current.selectedCategories['Geometry:Shapes']).toBeUndefined();
  });

  it('keeps a same-class sibling category when another category is removed', async () => {
    const { result } = renderHook(() => useFormulas());
    await vi.waitFor(() => expect(result.current.classesData).toHaveLength(2));
    act(() => { result.current.toggleClass('Algebra'); });
    act(() => { result.current.removeSingleFormula('Algebra', 'Quadratics', 'Quadratic Formula'); });

    expect(result.current.selectedClasses.Algebra).toBe(true);
    expect(result.current.selectedCategories['Algebra:Linear Equations']).toBe(true);
    expect(result.current.selectedCategories['Algebra:Quadratics']).toBeUndefined();
    expect(result.current.groupedFormulas[0].formulas.map((formula) => formula.name)).toEqual(['Slope Formula', 'Intercept Form']);
  });

  it('restores canonical IDs in their saved order', async () => {
    const { result } = renderHook(() => useFormulas({
      formula_selections: [{ formula_id: 'quadratic' }, { formula_id: 'slope' }],
    }, 'draft-a'));
    await vi.waitFor(() => expect(result.current.isFormulaSelectionInitialized).toBe(true));

    expect(result.current.getSelectedFormulasList().map((formula) => formula.name)).toEqual(['Quadratic Formula', 'Slope Formula']);
    expect(result.current.getFormulaSelectionsList()).toEqual([{ formula_id: 'quadratic' }, { formula_id: 'slope' }]);
  });

  it('resolves a historical category rename only when class and name are unambiguous', async () => {
    const { result } = renderHook(() => useFormulas({
      selected_formulas: [{ class: 'Algebra', category: 'Old Quadratics', name: 'Quadratic Formula' }],
    }, 'draft-a'));
    await vi.waitFor(() => expect(result.current.isFormulaSelectionInitialized).toBe(true));

    expect(result.current.getSelectedFormulasList()[0]).toMatchObject({ id: 'quadratic', category: 'Quadratics' });
  });

  it('honors an explicit empty canonical selection array', async () => {
    const { result } = renderHook(() => useFormulas({ formulaSelections: [] }, 'draft-a'));
    await vi.waitFor(() => expect(result.current.isFormulaSelectionInitialized).toBe(true));
    expect(result.current.getSelectedFormulasList()).toEqual([]);
    expect(result.current.getFormulaSelectionsList()).toEqual([]);
  });

  it('uses a valid matching v1 draft before legacy or initial data', async () => {
    mockLocalStorage.setItem('cheatSheetDraft:v1:string:draft-a', JSON.stringify({
      schema_version: 1, draft_identity: 'draft-a', base_revision: null, source_mode: 'empty', source_latex: '',
      formula_selections: [{ formula_id: 'circle' }],
      layout: { columns: 4, font_size: '9pt', spacing: 'small', margins: '0.15in', orientation: 'portrait' }, title: '', history: [],
    }));
    const { result } = renderHook(() => useFormulas({ formulaSelections: [{ formula_id: 'slope' }] }, 'draft-a'));
    await vi.waitFor(() => expect(result.current.isFormulaSelectionInitialized).toBe(true));
    expect(result.current.getFormulaSelectionsList()).toEqual([{ formula_id: 'circle' }]);
  });

  it('ignores a v1 draft for a different identity', async () => {
    mockLocalStorage.setItem('cheatSheetDraft:v1:string:other', JSON.stringify({ schema_version: 1 }));
    const { result } = renderHook(() => useFormulas({ formulaSelections: [{ formula_id: 'slope' }] }, 'draft-a'));
    await vi.waitFor(() => expect(result.current.isFormulaSelectionInitialized).toBe(true));
    expect(result.current.getFormulaSelectionsList()).toEqual([{ formula_id: 'slope' }]);
  });

  it('rejects a complete v1 envelope whose identity disagrees with its storage key', async () => {
    mockLocalStorage.setItem('cheatSheetDraft:v1:string:draft-a', JSON.stringify({
      schema_version: 1, draft_identity: 'other-draft', base_revision: null, source_mode: 'empty', source_latex: '',
      formula_selections: [{ formula_id: 'circle' }],
      layout: { columns: 4, font_size: '9pt', spacing: 'small', margins: '0.15in', orientation: 'portrait' }, title: '', history: [],
    }));
    const { result } = renderHook(() => useFormulas({ formulaSelections: [{ formula_id: 'slope' }] }, 'draft-a'));
    await vi.waitFor(() => expect(result.current.isFormulaSelectionInitialized).toBe(true));

    expect(result.current.getFormulaSelectionsList()).toEqual([{ formula_id: 'slope' }]);
    expect(result.current.formulaSelectionError.code).toBe('draft_identity_mismatch');
  });

  it('keeps unknown canonical input intact without displaying unknown records', async () => {
    const { result } = renderHook(() => useFormulas({
      formulaSelections: [{ formula_id: 'slope' }, { formula_id: 'gone' }],
    }, 'draft-a'));
    await vi.waitFor(() => expect(result.current.isFormulaSelectionInitialized).toBe(true));
    expect(result.current.getSelectedFormulasList().map((formula) => formula.id)).toEqual(['slope']);
    expect(result.current.getFormulaSelectionsList()).toEqual([{ formula_id: 'slope' }, { formula_id: 'gone' }]);
    expect(result.current.formulaSelectionError.code).toBe('unresolved_formula_selection');
  });

  it('projects known canonical formulas while retaining unknown IDs durably', async () => {
    const { result } = renderHook(() => useFormulas({
      formulaSelections: [{ formula_id: 'gone' }, { formula_id: 'slope' }],
    }, 'draft-a'));
    await vi.waitFor(() => expect(result.current.isFormulaSelectionInitialized).toBe(true));

    expect(result.current.getSelectedFormulasList().map((formula) => formula.id)).toEqual(['slope']);
    expect(result.current.getFormulaSelectionsList()).toEqual([{ formula_id: 'gone' }, { formula_id: 'slope' }]);
  });

  it('preserves unknown IDs while adding, removing, and reordering known formulas', async () => {
    const { result } = renderHook(() => useFormulas({
      formulaSelections: [{ formula_id: 'gone' }, { formula_id: 'slope' }],
    }, 'draft-a'));
    await vi.waitFor(() => expect(result.current.isFormulaSelectionInitialized).toBe(true));

    act(() => { result.current.toggleCategory('Algebra', 'Quadratics'); });
    expect(result.current.getFormulaSelectionsList()).toEqual([
      { formula_id: 'gone' }, { formula_id: 'slope' }, { formula_id: 'quadratic' },
    ]);

    act(() => { result.current.removeSingleFormula('Algebra', 'Linear Equations', 'Slope Formula'); });
    expect(result.current.getFormulaSelectionsList()).toEqual([{ formula_id: 'gone' }, { formula_id: 'quadratic' }]);

    act(() => { result.current.toggleCategory('Algebra', 'Linear Equations'); });
    act(() => { result.current.reorderFormula('Algebra', 1, 0); });
    expect(result.current.getFormulaSelectionsList()).toEqual([
      { formula_id: 'gone' }, { formula_id: 'slope' }, { formula_id: 'quadratic' }, { formula_id: 'intercept' },
    ]);
  });

  it('retains unknown IDs during select-all and removes them only on explicit clear', async () => {
    const { result } = renderHook(() => useFormulas({ formulaSelections: [{ formula_id: 'gone' }] }, 'draft-a'));
    await vi.waitFor(() => expect(result.current.isFormulaSelectionInitialized).toBe(true));

    act(() => { result.current.selectAllClasses(); });
    expect(result.current.getFormulaSelectionsList().map((selection) => selection.formula_id)).toEqual([
      'gone', 'slope', 'intercept', 'quadratic', 'circle',
    ]);
    act(() => { result.current.deselectAllClasses(); });
    expect(result.current.getFormulaSelectionsList()).toEqual([{ formula_id: 'gone' }]);
    act(() => { result.current.clearSelections(); });
    expect(result.current.getFormulaSelectionsList()).toEqual([]);
  });

  it('does not refetch classes after hydration when parent rerenders with new input', async () => {
    const { result, rerender } = renderHook(({ initialData }) => useFormulas(initialData, 'draft-a'), {
      initialProps: { initialData: { formulaSelections: [{ formula_id: 'slope' }] } },
    });
    await vi.waitFor(() => expect(result.current.isFormulaSelectionInitialized).toBe(true));
    rerender({ initialData: { formulaSelections: [{ formula_id: 'circle' }] } });

    expect(fetch).toHaveBeenCalledTimes(1);
    expect(result.current.getFormulaSelectionsList()).toEqual([{ formula_id: 'slope' }]);
  });

  it('reuses the pending classes request and hydrates the newest rerendered input', async () => {
    const classes = deferred();
    vi.stubGlobal('fetch', vi.fn(() => classes.promise));
    const { result, rerender } = renderHook(({ initialData }) => useFormulas(initialData, 'draft-a'), {
      initialProps: { initialData: { formulaSelections: [{ formula_id: 'slope' }] } },
    });

    rerender({ initialData: { formulaSelections: [{ formula_id: 'circle' }] } });
    expect(fetch).toHaveBeenCalledTimes(1);
    await act(async () => classes.resolve({ json: async () => mockClassesData }));
    await vi.waitFor(() => expect(result.current.isFormulaSelectionInitialized).toBe(true));

    expect(result.current.getFormulaSelectionsList()).toEqual([{ formula_id: 'circle' }]);
  });

  it('uses one pending classes request and hydrates in StrictMode', async () => {
    const classes = deferred();
    vi.stubGlobal('fetch', vi.fn(() => classes.promise));
    const { result } = renderHook(() => useFormulas({ formulaSelections: [{ formula_id: 'slope' }] }, 'draft-a'), {
      wrapper: StrictMode,
    });

    expect(fetch).toHaveBeenCalledTimes(1);
    await act(async () => classes.resolve({ json: async () => mockClassesData }));
    await vi.waitFor(() => expect(result.current.isFormulaSelectionInitialized).toBe(true));

    expect(result.current.getFormulaSelectionsList()).toEqual([{ formula_id: 'slope' }]);
  });

  it('preserves unresolved legacy records without emitting a partial canonical selection', async () => {
    const { result } = renderHook(() => useFormulas({ selectedFormulas: [
      { class: 'Algebra', category: 'Linear Equations', name: 'Slope Formula' },
      { class: 'Algebra', category: 'Linear Equations', name: 'Removed Formula' },
    ] }, 'draft-a'));
    await vi.waitFor(() => expect(result.current.isFormulaSelectionInitialized).toBe(true));
    expect(result.current.getSelectedFormulasList()).toHaveLength(2);
    expect(result.current.getFormulaSelectionsList()).toEqual([]);
    expect(result.current.formulaSelectionError.code).toBe('unresolved_legacy_formula');
  });

  it('migrates matching legacy formulas once and retains compatible records with canonical output', async () => {
    mockLocalStorage.setItem('cheatSheetData:draft-a', JSON.stringify({
      groupedFormulas: [{ class: 'Algebra', formulas: [{ class: 'Algebra', category: 'Quadratics', name: 'Quadratic Formula' }] }],
    }));
    const { result, unmount } = renderHook(() => useFormulas(undefined, 'draft-a'));
    await vi.waitFor(() => expect(result.current.isFormulaSelectionInitialized).toBe(true));
    expect(result.current.getSelectedFormulasList()[0]).toMatchObject({ id: 'quadratic', formula_id: 'quadratic', name: 'Quadratic Formula' });
    expect(result.current.getFormulaSelectionsList()).toEqual([{ formula_id: 'quadratic' }]);
    const v1 = JSON.parse(mockLocalStorage.getItem('cheatSheetDraft:v1:string:draft-a'));
    expect(v1.formula_selections).toEqual([{ formula_id: 'quadratic' }]);
    expect(mockLocalStorage.getItem('cheatSheetData:draft-a')).toContain('Quadratic Formula');
    unmount();
    const second = renderHook(() => useFormulas(undefined, 'draft-a'));
    await vi.waitFor(() => expect(second.result.current.isFormulaSelectionInitialized).toBe(true));
    expect(second.result.current.getFormulaSelectionsList()).toEqual([{ formula_id: 'quadratic' }]);
  });
});
