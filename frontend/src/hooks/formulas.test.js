import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
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

    const initialOrder = result.current.groupedFormulas[0].formulas.map(f => f.name);
    // initialOrder = ['Slope Formula', 'Intercept Form', 'Quadratic Formula']

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
});
