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
      
      // Check if this is a special class (no categories - like UNIT CIRCLE)
      if (cls.is_special || (cls.categories.length === 1 && cls.categories[0].name === cls.name)) {
        // For special classes, include all formulas directly
        cls.categories.forEach((cat) => {
          cat.formulas.forEach((f) => {
            formulas.push({
              class: cls.name,
              category: cls.name,  // Use class name as category for special
              name: f.name
            });
          });
        });
        return;
      }
      
      // Normal classes with categories
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