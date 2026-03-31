import { useState, useEffect } from 'react';

export function useFormulas() {
  const [classesData, setClassesData] = useState([]);
  const [selectedClasses, setSelectedClasses] = useState({});
  const [selectedCategories, setSelectedCategories] = useState({});

  useEffect(() => {
    fetch('/api/classes/')
      .then((res) => res.json())
      .then((data) => {
        setClassesData(data.classes || []);
      })
      .catch((err) => console.error('Failed to fetch classes', err));
  }, []);

  const toggleClass = (className) => {
    setSelectedClasses((prev) => {
      const newSelected = { ...prev };
      if (newSelected[className]) {
        delete newSelected[className];
        // Clear all selected categories for this class when it is unchecked
        setSelectedCategories((prevCategories) => {
          const updatedCategories = { ...prevCategories };
          Object.keys(updatedCategories).forEach((key) => {
            if (key.startsWith(className + ':')) {
              delete updatedCategories[key];
            }
          });
          return updatedCategories;
        });
      } else {
        newSelected[className] = true;
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
      } else {
        newSelected[key] = true;
      }
      return newSelected;
    });
  };

  const getSelectedFormulasList = () => {
    const formulas = [];
    classesData.forEach((cls) => {
      if (!selectedClasses[cls.name]) return;
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
  };

  const selectedCount = getSelectedFormulasList().length;
  const hasSelectedClasses = Object.keys(selectedClasses).length > 0;

  return {
    classesData,
    selectedClasses,
    selectedCategories,
    toggleClass,
    toggleCategory,
    getSelectedFormulasList,
    clearSelections,
    selectedCount,
    hasSelectedClasses
  };
}
