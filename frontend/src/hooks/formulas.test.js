import { renderHook, act, waitFor } from '@testing-library/react';
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

describe('useFormulas hook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    global.fetch = vi.fn().mockResolvedValue({
      json: vi.fn().mockResolvedValue(mockClassesData)
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('fetches classes data on mount', async () => {
    const { result } = renderHook(() => useFormulas());

    // Wait for the fetch to resolve and state to update
    await waitFor(() => {
      expect(result.current.classesData).toEqual(mockClassesData.classes);
    });
  });

  it('restores saved selections from localStorage after classes load', async () => {
    window.localStorage.setItem('cheatSheetData', JSON.stringify({
      selectedClasses: { Algebra: true },
      selectedCategories: {
        'Algebra:Linear Equations': true,
        'Algebra:Quadratics': true
      },
      groupedFormulas: [
        {
          class: 'Algebra',
          formulas: [
            { class: 'Algebra', category: 'Linear Equations', name: 'Slope Formula' },
            { class: 'Algebra', category: 'Quadratics', name: 'Quadratic Formula' }
          ]
        }
      ]
    }));

    const { result } = renderHook(() => useFormulas());

    await waitFor(() => {
      expect(result.current.classesData).toEqual(mockClassesData.classes);
      expect(result.current.selectedClasses).toEqual({ Algebra: true });
      expect(result.current.selectedCategories).toEqual({
        'Algebra:Linear Equations': true,
        'Algebra:Quadratics': true
      });
      expect(result.current.groupedFormulas).toEqual([
        {
          class: 'Algebra',
          formulas: [
            { class: 'Algebra', category: 'Linear Equations', name: 'Slope Formula' },
            { class: 'Algebra', category: 'Quadratics', name: 'Quadratic Formula' }
          ]
        }
      ]);
    });
  });

  it('toggles a full class selection', async () => {
    const { result } = renderHook(() => useFormulas());

    await waitFor(() => {
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

    await waitFor(() => {
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

    await waitFor(() => {
      expect(result.current.classesData.length).toBeGreaterThan(0);
    });

    act(() => {
      result.current.toggleClass('Algebra'); // adds 3 formulas
    });

    const initialOrder = result.current.groupedFormulas[0].formulas.map(f => f.name);
    expect(initialOrder).toEqual(['Slope Formula', 'Intercept Form', 'Quadratic Formula']);

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

    await waitFor(() => {
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

  it('clears selections and removes saved cheat sheet data', async () => {
    const { result } = renderHook(() => useFormulas());

    await waitFor(() => {
      expect(result.current.classesData.length).toBeGreaterThan(0);
    });

    act(() => {
      result.current.toggleClass('Algebra');
    });

    await waitFor(() => {
      expect(window.localStorage.getItem('cheatSheetData')).not.toBeNull();
    });

    act(() => {
      result.current.clearSelections();
    });

    await waitFor(() => {
      expect(window.localStorage.getItem('cheatSheetData')).toBeNull();
      expect(result.current.selectedClasses).toEqual({});
      expect(result.current.selectedCategories).toEqual({});
      expect(result.current.groupedFormulas).toEqual([]);
      expect(result.current.selectedCount).toBe(0);
    });
  });

  it('logs fetch failures and keeps classes data empty', async () => {
    const error = new Error('network down');
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    global.fetch = vi.fn().mockRejectedValue(error);

    const { result } = renderHook(() => useFormulas());

    await waitFor(() => {
      expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to fetch classes', error);
    });

    expect(result.current.classesData).toEqual([]);
  });
});
