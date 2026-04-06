import { useState, useEffect, useCallback } from 'react';

export function useFormulas() {
  const [classesData, setClassesData] = useState([]);
  const [selectedClasses, setSelectedClasses] = useState({});
  const [selectedCategories, setSelectedCategories] = useState({});
  const [groupedFormulas, setGroupedFormulas] = useState([]);

  useEffect(() => {
    fetch('/api/classes/')
      .then((res) => res.json())
      .then((data) => setClassesData(data.classes || []))
      .catch((err) => console.error('Failed to fetch classes', err));
  }, []);

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

  const removeClassFromOrder = useCallback((className) => {
    setGroupedFormulas(prev => prev.filter(g => g.class !== className));
  }, []);

  const removeSingleFormula = useCallback((className, categoryName, formulaName) => {
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
        removeClassFromOrder(className);
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
    setSelectedClasses({});
    setSelectedCategories({});
    setGroupedFormulas([]);
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
