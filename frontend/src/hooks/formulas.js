import { useState, useEffect, useCallback } from 'react';

export function useFormulas() {
  const [classesData, setClassesData] = useState([]);
  const [selectedClasses, setSelectedClasses] = useState({});
  const [selectedCategories, setSelectedCategories] = useState({});
  const [formulaOrder, setFormulaOrder] = useState([]);

  useEffect(() => {
    fetch('/api/classes/')
      .then((res) => res.json())
      .then((data) => {
        setClassesData(data.classes || []);
      })
      .catch((err) => console.error('Failed to fetch classes', err));
  }, []);

  const addFormulasToOrder = useCallback((className, categoryName, formulas) => {
    setFormulaOrder(prev => {
      const newFormulas = formulas
        .filter(f => !prev.some(p => p.class === className && p.category === categoryName && p.name === f.name))
        .map(f => ({
          class: className,
          category: categoryName,
          name: f.name
        }));
      return [...prev, ...newFormulas];
    });
  }, []);

  const removeFormulasFromOrder = useCallback((className, categoryName) => {
    setFormulaOrder(prev => prev.filter(f => !(f.class === className && f.category === categoryName)));
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
              const catName = key.substring(className.length + 1);
              removeFormulasFromOrder(className, catName);
              delete updatedCategories[key];
            }
          });
          return updatedCategories;
        });
        setFormulaOrder(prev => prev.filter(f => f.class !== className));
      } else {
        newSelected[className] = true;
        const cls = classesData.find(c => c.name === className);
        if (cls && cls.categories && cls.categories.length > 0) {
          if (cls.is_special || (cls.categories.length === 1 && cls.categories[0].name === cls.name)) {
            cls.categories[0].formulas.forEach(f => {
              addFormulasToOrder(className, className, [{name: f.name}]);
            });
          }
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

  const reorderFormula = useCallback((oldIndex, newIndex) => {
    setFormulaOrder(prev => {
      const newOrder = [...prev];
      const [removed] = newOrder.splice(oldIndex, 1);
      newOrder.splice(newIndex, 0, removed);
      return newOrder;
    });
  }, []);

  const getSelectedFormulasList = () => {
    if (formulaOrder.length > 0) {
      return formulaOrder;
    }
    const formulas = [];
    classesData.forEach((cls) => {
      if (!selectedClasses[cls.name]) return;
      
      if (cls.is_special || (cls.categories.length === 1 && cls.categories[0].name === cls.name)) {
        cls.categories.forEach((cat) => {
          cat.formulas.forEach((f) => {
            formulas.push({
              class: cls.name,
              category: cls.name,
              name: f.name
            });
          });
        });
        return;
      }
      
      cls.categories.forEach((cat) => {
        const key = `${cls.name}:${cat.name}`;
        if (selectedCategories[key]) {
          cat.formulas.forEach((f) => {
            formulas.push({
              class: cls.name,
              category: cat.name,
              name: f.name
            });
          });
        }
      });
    });
    return formulas;
  };

  const clearSelections = () => {
    setSelectedClasses({});
    setSelectedCategories({});
    setFormulaOrder([]);
  };

  const selectedCount = getSelectedFormulasList().length;
  const hasSelectedClasses = Object.keys(selectedClasses).length > 0;

  return {
    classesData,
    selectedClasses,
    selectedCategories,
    formulaOrder,
    setFormulaOrder,
    toggleClass,
    toggleCategory,
    getSelectedFormulasList,
    clearSelections,
    reorderFormula,
    selectedCount,
    hasSelectedClasses
  };
}