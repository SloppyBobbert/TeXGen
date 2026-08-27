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
          formulas: [{ name: 'Slope Formula' }, { name: 'Intercept Form' }]
        },
        {
          name: 'Quadratics',
          formulas: [{ name: 'Quadratic Formula' }]
        }
      ]
    },
    {
      name: 'Geometry',
      categories: [
        {
          name: 'Shapes',
          formulas: [{ name: 'Area of Circle' }]
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
});
