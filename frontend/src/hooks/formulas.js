import { useState, useEffect, useCallback, useRef } from 'react';

const STORAGE_KEY = 'cheatSheetData';

function loadFromStorage() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      return JSON.parse(saved);
    }
  } catch (e) {
    console.error('Failed to load from localStorage', e);
  }
  return null;
}

function saveToStorage(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (e) {
    console.error('Failed to save to localStorage', e);
  }
}

function flattenGroupedFormulas(groupedFormulas = []) {
  return groupedFormulas.flatMap((group) => group?.formulas || []);
}

function normalizeSelectedFormulas(selectedFormulas = [], classesData = []) {
  const classMap = new Map(classesData.map((cls) => [cls.name, cls]));

  return selectedFormulas.map((formula) => {
    if (!formula?.class || !formula?.category || !formula?.name) return formula;

    const cls = classMap.get(formula.class);
    if (!cls?.categories?.length) return formula;

    const exactCategory = cls.categories.find((category) => category.name === formula.category);
    if (exactCategory?.formulas?.some((item) => item.name === formula.name)) {
      return formula;
    }

    for (const currentCategory of cls.categories) {
      if (currentCategory.formulas?.some((item) => item.name === formula.name)) {
        return {
          ...formula,
          category: currentCategory.name,
        };
      }
    }

    return formula;
  });
}

function buildSelectionState(selectedFormulas = []) {
  const groupedMap = new Map();
  const selectedClasses = {};
  const selectedCategories = {};

  selectedFormulas.forEach((formula) => {
    if (!formula?.class || !formula?.category || !formula?.name) return;

    selectedClasses[formula.class] = true;
    selectedCategories[`${formula.class}:${formula.category}`] = true;

    const formulas = groupedMap.get(formula.class) || [];
    formulas.push({
      class: formula.class,
      category: formula.category,
      name: formula.name,
    });
    groupedMap.set(formula.class, formulas);
  });

  return {
    selectedClasses,
    selectedCategories,
    groupedFormulas: Array.from(groupedMap.entries()).map(([className, formulas]) => ({
      class: className,
      formulas,
    })),
  };
}

export function useFormulas(initialData) {
  const [classesData, setClassesData] = useState([]);
  const [selectedClasses, setSelectedClasses] = useState({});
  const [selectedCategories, setSelectedCategories] = useState({});
  const [groupedFormulas, setGroupedFormulas] = useState([]);
  const initialLoadDone = useRef(false);
  const skipNextPersist = useRef(false);

  useEffect(() => {
    fetch('/api/classes/')
      .then((res) => res.json())
      .then((data) => {
        const classes = data.classes || [];
        setClassesData(classes);
        
        if (!initialLoadDone.current) {
          initialLoadDone.current = true;
          const saved = loadFromStorage();
          if (saved) {
            const normalizedFormulas = normalizeSelectedFormulas(
              flattenGroupedFormulas(saved.groupedFormulas || []),
              classes,
            );
            const restored = buildSelectionState(normalizedFormulas);
            setSelectedClasses(restored.selectedClasses);
            setSelectedCategories(restored.selectedCategories);
            setGroupedFormulas(restored.groupedFormulas);
          } else if (initialData?.selectedFormulas?.length) {
            const restored = buildSelectionState(normalizeSelectedFormulas(initialData.selectedFormulas, classes));
            setSelectedClasses(restored.selectedClasses);
            setSelectedCategories(restored.selectedCategories);
            setGroupedFormulas(restored.groupedFormulas);
          }
        }
      })
      .catch((err) => console.error('Failed to fetch classes', err));
  }, [initialData]);

  useEffect(() => {
    if (!initialLoadDone.current) return;

    if (skipNextPersist.current) {
      skipNextPersist.current = false;
      localStorage.removeItem(STORAGE_KEY);
      return;
    }

    saveToStorage({ selectedClasses, selectedCategories, groupedFormulas });
  }, [selectedClasses, selectedCategories, groupedFormulas]);

  const addFormulasToOrder = useCallback((className, categoryName, formulas) => {
    setGroupedFormulas(prev => {
      const newState = [...prev];
      let groupIndex = newState.findIndex(g => g.class === className);
      if (groupIndex === -1) {
        newState.push({ class: className, formulas: [] });
        groupIndex = newState.length - 1;
      }
      const group = { ...newState[groupIndex], formulas: [...newState[groupIndex].formulas] };
      const newFormulas = formulas
        .filter(f => !group.formulas.some(p => p.category === categoryName && p.name === f.name))
        .map(f => ({ class: className, category: categoryName, name: f.name }));
      group.formulas = [...group.formulas, ...newFormulas];
      newState[groupIndex] = group;
      return newState;
    });
  }, []);

  const removeFormulasFromOrder = useCallback((className, categoryName) => {
    setGroupedFormulas(prev => prev.map(g => {
        if (g.class !== className) return g;
        return { ...g, formulas: g.formulas.filter(f => f.category !== categoryName) };
      }).filter(g => g.formulas.length > 0)
    );
  }, []);

  const clearClassSelections = useCallback((className) => {
    setSelectedClasses((prev) => {
      const updated = { ...prev };
      delete updated[className];
      return updated;
    });

    setSelectedCategories((prev) => {
      const updated = { ...prev };
      Object.keys(updated).forEach((key) => {
        if (key.startsWith(`${className}:`)) {
          delete updated[key];
        }
      });
      return updated;
    });
  }, []);

  const removeClassFromOrder = useCallback((className) => {
    clearClassSelections(className);
    setGroupedFormulas(prev => prev.filter(g => g.class !== className));
  }, [clearClassSelections]);

  const removeSingleFormula = useCallback((className, categoryName, formulaName) => {
    setSelectedCategories((prev) => {
      const updated = { ...prev };
      delete updated[`${className}:${categoryName}`];
      return updated;
    });

    setGroupedFormulas(prev => prev.map(g => {
        if (g.class !== className) return g;
        return { ...g, formulas: g.formulas.filter(f => !(f.category === categoryName && f.name === formulaName)) };
      }).filter(g => g.formulas.length > 0)
    );
  }, []);

  const toggleClass = (className) => {
    setSelectedClasses((prev) => {
      const newSelected = { ...prev };
      if (newSelected[className]) {
        delete newSelected[className];
        setSelectedCategories((prevCategories) => {
          const updatedCategories = { ...prevCategories };
          Object.keys(updatedCategories).forEach((key) => {
            if (key.startsWith(className + ':')) {
              delete updatedCategories[key];
            }
          });
          return updatedCategories;
        });
        setGroupedFormulas((prevGrouped) => prevGrouped.filter((group) => group.class !== className));
      } else {
        newSelected[className] = true;
        const cls = classesData.find(c => c.name === className);
        if (cls && cls.categories && cls.categories.length > 0) {
          setSelectedCategories(prevCategories => {
            const updatedCategories = { ...prevCategories };
            cls.categories.forEach(cat => {
              updatedCategories[`${className}:${cat.name}`] = true;
            });
            return updatedCategories;
          });
          cls.categories.forEach(cat => {
            addFormulasToOrder(className, cat.name, cat.formulas);
          });
        }
      }
      return newSelected;
    });
  };

  const toggleCategory = (className, categoryName) => {
    const key = `${className}:${categoryName}`;
    setSelectedCategories((prev) => {
      const newSelected = { ...prev };
      if (newSelected[key]) {
        delete newSelected[key];
        removeFormulasFromOrder(className, categoryName);
      } else {
        newSelected[key] = true;
        const cls = classesData.find(c => c.name === className);
        if (cls) {
          const cat = cls.categories.find(c => c.name === categoryName);
          if (cat) {
            addFormulasToOrder(className, categoryName, cat.formulas);
          }
        }
      }
      return newSelected;
    });
  };

  const reorderClass = useCallback((oldIndex, newIndex) => {
    setGroupedFormulas(prev => {
      const newOrder = [...prev];
      const [removed] = newOrder.splice(oldIndex, 1);
      newOrder.splice(newIndex, 0, removed);
      return newOrder;
    });
  }, []);

  const reorderFormula = useCallback((className, oldIndex, newIndex) => {
    setGroupedFormulas(prev => {
      const newOrder = [...prev];
      const groupIndex = newOrder.findIndex(g => g.class === className);
      if (groupIndex === -1) return prev;
      const group = { ...newOrder[groupIndex], formulas: [...newOrder[groupIndex].formulas] };
      const [removed] = group.formulas.splice(oldIndex, 1);
      group.formulas.splice(newIndex, 0, removed);
      newOrder[groupIndex] = group;
      return newOrder;
    });
  }, []);

  const getSelectedFormulasList = () => groupedFormulas.flatMap(g => g.formulas);

  const clearSelections = () => {
    skipNextPersist.current = true;
    setSelectedClasses({});
    setSelectedCategories({});
    setGroupedFormulas([]);
    localStorage.removeItem(STORAGE_KEY);
  };

  const selectedCount = getSelectedFormulasList().length;
  const hasSelectedClasses = Object.keys(selectedClasses).length > 0;

  return {
    classesData,
    selectedClasses,
    selectedCategories,
    groupedFormulas,
    toggleClass,
    toggleCategory,
    getSelectedFormulasList,
    clearSelections,
    reorderClass,
    reorderFormula,
    removeClassFromOrder,
    removeSingleFormula,
    selectedCount,
    hasSelectedClasses
  };
}
