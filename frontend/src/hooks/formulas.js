import { useState, useEffect, useCallback, useRef } from 'react';
import { migrateLegacyDraft, readDraft } from '../storage/draftStore';

const STORAGE_KEY = 'cheatSheetData';

function draftIdentityFor(initialData, draftIdentity) {
  return draftIdentity ?? initialData?.id ?? initialData?.draftId;
}

function storageKeyFor(initialData, draftIdentity) {
  const identity = draftIdentityFor(initialData, draftIdentity);
  return identity == null ? STORAGE_KEY : `${STORAGE_KEY}:${identity}`;
}

function loadFromStorage(storageKey) {
  try {
    const saved = localStorage.getItem(storageKey);
    return saved ? JSON.parse(saved) : null;
  } catch (cause) {
    console.error('Failed to load from localStorage', cause);
    return null;
  }
}

function saveToStorage(storageKey, data) {
  try {
    localStorage.setItem(storageKey, JSON.stringify(data));
  } catch (cause) {
    console.error('Failed to save to localStorage', cause);
  }
}

function flattenGroupedFormulas(groupedFormulas = []) {
  return groupedFormulas.flatMap((group) => group?.formulas || []);
}

function formulaId(formula) {
  return typeof formula?.formula_id === 'string' ? formula.formula_id : formula?.id;
}

function catalogIndexes(classes) {
  const byId = new Map();
  const byExact = new Map();
  const byClassName = new Map();
  classes.forEach((cls) => cls.categories?.forEach((category) => category.formulas?.forEach((formula) => {
    const record = { ...formula, id: formula.id, formula_id: formula.id, class: cls.name, category: category.name, name: formula.name };
    const id = formulaId(record);
    if (typeof id === 'string' && id.length) byId.set(id, byId.has(id) ? null : record);
    const exactKey = `${cls.name}\u0000${category.name}\u0000${formula.name}`;
    byExact.set(exactKey, byExact.has(exactKey) ? null : record);
    const nameKey = `${cls.name}\u0000${formula.name}`;
    byClassName.set(nameKey, [...(byClassName.get(nameKey) || []), record]);
  })));
  return { byId, byExact, byClassName };
}

function resolveLegacyFormula(formula, indexes) {
  const id = formulaId(formula);
  if (id) return indexes.byId.get(id) || null;
  const exact = indexes.byExact.get(`${formula?.class}\u0000${formula?.category}\u0000${formula?.name}`);
  if (exact) return exact;
  const candidates = indexes.byClassName.get(`${formula?.class}\u0000${formula?.name}`) || [];
  return candidates.length === 1 ? candidates[0] : null;
}

function resolveCanonical(selections, indexes) {
  const records = selections.map((selection) => indexes.byId.get(selection?.formula_id) || null);
  return records.every(Boolean) ? records : null;
}

function resolveLegacy(selections, indexes) {
  const records = selections.map((formula) => resolveLegacyFormula(formula, indexes));
  return records.every(Boolean) ? records : null;
}

function buildSelectionState(selectedFormulas = []) {
  const groupedMap = new Map();
  const selectedClasses = {};
  const selectedCategories = {};
  selectedFormulas.forEach((formula) => {
    if (!formula?.class || !formula?.category || !formula?.name) return;
    selectedClasses[formula.class] = true;
    selectedCategories[`${formula.class}:${formula.category}`] = true;
    groupedMap.set(formula.class, [...(groupedMap.get(formula.class) || []), formula]);
  });
  return {
    selectedClasses,
    selectedCategories,
    groupedFormulas: Array.from(groupedMap, ([className, formulas]) => ({ class: className, formulas })),
  };
}

function canonicalSelections(formulas) {
  return formulas.map((formula) => formulaId(formula)).filter((id) => typeof id === 'string' && id.length)
    .map((id) => ({ formula_id: id }));
}

function hasArray(object, key) {
  return Array.isArray(object?.[key]);
}

export function useFormulas(initialData, draftIdentity) {
  const identity = draftIdentityFor(initialData, draftIdentity);
  const storageKey = storageKeyFor(initialData, draftIdentity);
  const [classesData, setClassesData] = useState([]);
  const [selectedClasses, setSelectedClasses] = useState({});
  const [selectedCategories, setSelectedCategories] = useState({});
  const [groupedFormulas, setGroupedFormulas] = useState([]);
  const [formulaSelections, setFormulaSelections] = useState([]);
  const [formulaSelectionError, setFormulaSelectionError] = useState(null);
  const [isFormulaSelectionInitialized, setIsFormulaSelectionInitialized] = useState(false);
  const initialLoadDone = useRef(false);
  const skipNextPersist = useRef(false);

  useEffect(() => {
    let cancelled = false;
    const v1 = identity == null ? { ok: true, draft: null } : readDraft(localStorage, identity);
    const legacy = identity == null ? null : loadFromStorage(storageKey);
    const initialCanonical = hasArray(initialData, 'formulaSelections') ? initialData.formulaSelections
      : (hasArray(initialData, 'formula_selections') ? initialData.formula_selections : null);
    const initialLegacy = hasArray(initialData, 'selectedFormulas') ? initialData.selectedFormulas
      : (hasArray(initialData, 'selected_formulas') ? initialData.selected_formulas : null);

    fetch('/api/classes/')
      .then((res) => res.json())
      .then((data) => {
        if (cancelled || initialLoadDone.current) return;
        const classes = data.classes || [];
        const indexes = catalogIndexes(classes);
        let source = null;
        let records = [];
        let selections = [];
        let legacyRecordsResolved = false;
        let error = !v1.ok ? v1.error : null;

        if (v1.ok && v1.draft) {
          source = 'canonical';
          selections = v1.draft.formula_selections;
        } else {
          let migration = null;
          if (identity != null) migration = migrateLegacyDraft(localStorage, identity, {
            resolveFormulaId: (formula) => resolveLegacyFormula(formula, indexes)?.id || null,
          });
          if (legacy) {
            source = 'legacy';
            records = flattenGroupedFormulas(legacy.groupedFormulas);
            if (migration?.ok && migration.migrated) selections = migration.draft.formula_selections;
            else if (migration && !migration.ok) error = migration.error;
          } else if (initialCanonical !== null) {
            source = 'canonical';
            selections = initialCanonical;
          } else if (initialLegacy !== null) {
            source = 'legacy';
            records = initialLegacy;
          }
        }

        if (source === 'canonical') {
          const resolved = resolveCanonical(selections, indexes);
          if (resolved) records = resolved;
          else if (selections.length) error = error || { code: 'unresolved_formula_selection', message: 'Formula selections could not be resolved to the current catalog.', recoverable: true };
        } else if (source === 'legacy') {
          const resolved = resolveLegacy(records, indexes);
          if (resolved) {
            records = resolved;
            legacyRecordsResolved = true;
          }
          else if (records.length) error = error || { code: 'unresolved_legacy_formula', message: 'Legacy formula selections could not be resolved to stable formula IDs.', recoverable: true };
        }

        const restored = buildSelectionState(records);
        initialLoadDone.current = true;
        setClassesData(classes);
        setSelectedClasses(restored.selectedClasses);
        setSelectedCategories(restored.selectedCategories);
        setGroupedFormulas(restored.groupedFormulas);
        setFormulaSelections(source === 'canonical' ? selections : (legacyRecordsResolved ? canonicalSelections(records) : []));
        setFormulaSelectionError(error);
        setIsFormulaSelectionInitialized(true);
      })
      .catch((cause) => {
        if (cancelled || initialLoadDone.current) return;
        console.error('Failed to fetch classes', cause);
        const fallback = initialLegacy || [];
        const restored = buildSelectionState(fallback);
        initialLoadDone.current = true;
        setSelectedClasses(restored.selectedClasses);
        setSelectedCategories(restored.selectedCategories);
        setGroupedFormulas(restored.groupedFormulas);
        setFormulaSelections(initialCanonical || canonicalSelections(fallback));
        setIsFormulaSelectionInitialized(true);
      });
    return () => { cancelled = true; };
  }, [initialData, storageKey, identity]);

  useEffect(() => {
    if (!initialLoadDone.current || identity == null) return;
    if (skipNextPersist.current) {
      skipNextPersist.current = false;
      localStorage.removeItem(storageKey);
      return;
    }
    saveToStorage(storageKey, { selectedClasses, selectedCategories, groupedFormulas });
  }, [selectedClasses, selectedCategories, groupedFormulas, storageKey, identity]);

  const updateFromGrouped = useCallback((next) => {
    const derived = buildSelectionState(flattenGroupedFormulas(next));
    setSelectedClasses(derived.selectedClasses);
    setSelectedCategories(derived.selectedCategories);
    setFormulaSelections(canonicalSelections(flattenGroupedFormulas(next)));
    return next;
  }, []);

  const addFormulasToOrder = useCallback((className, categoryName, formulas) => {
    setGroupedFormulas((prev) => {
      const next = [...prev];
      let index = next.findIndex((group) => group.class === className);
      if (index === -1) { next.push({ class: className, formulas: [] }); index = next.length - 1; }
      const group = { ...next[index], formulas: [...next[index].formulas] };
      group.formulas.push(...formulas.filter((formula) => !group.formulas.some((item) => formulaId(item) === formulaId(formula)))
        .map((formula) => ({ ...formula, id: formula.id, formula_id: formula.id, class: className, category: categoryName, name: formula.name })));
      next[index] = group;
      const derived = buildSelectionState(flattenGroupedFormulas(next));
      setSelectedClasses(derived.selectedClasses);
      setSelectedCategories(derived.selectedCategories);
      setFormulaSelections(canonicalSelections(flattenGroupedFormulas(next)));
      return next;
    });
  }, []);

  const removeFormulasFromOrder = useCallback((className, categoryName) => {
    setGroupedFormulas((prev) => updateFromGrouped(prev.map((group) => group.class === className
      ? { ...group, formulas: group.formulas.filter((formula) => formula.category !== categoryName) } : group).filter((group) => group.formulas.length)));
  }, [updateFromGrouped]);

  const toggleClass = (className) => {
    if (selectedClasses[className]) {
      setGroupedFormulas((prev) => updateFromGrouped(prev.filter((group) => group.class !== className)));
      return;
    }
    const cls = classesData.find((item) => item.name === className);
    if (!cls) return;
    setSelectedClasses((prev) => ({ ...prev, [className]: true }));
    cls.categories?.forEach((category) => addFormulasToOrder(className, category.name, category.formulas || []));
  };

  const toggleCategory = (className, categoryName) => {
    const key = `${className}:${categoryName}`;
    if (selectedCategories[key]) { removeFormulasFromOrder(className, categoryName); return; }
    const category = classesData.find((item) => item.name === className)?.categories?.find((item) => item.name === categoryName);
    if (category) addFormulasToOrder(className, categoryName, category.formulas || []);
  };

  const removeClassFromOrder = useCallback((className) => {
    setGroupedFormulas((prev) => updateFromGrouped(prev.filter((group) => group.class !== className)));
  }, [updateFromGrouped]);
  const removeSingleFormula = useCallback((className, categoryName, formulaName) => {
    setGroupedFormulas((prev) => updateFromGrouped(prev.map((group) => group.class !== className ? group : {
      ...group, formulas: group.formulas.filter((formula) => !(formula.category === categoryName && formula.name === formulaName)),
    }).filter((group) => group.formulas.length)));
  }, [updateFromGrouped]);
  const selectAllClasses = useCallback(() => {
    const next = classesData.map((cls) => ({ class: cls.name, formulas: (cls.categories || []).flatMap((category) => (category.formulas || []).map((formula) => ({ ...formula, id: formula.id, formula_id: formula.id, class: cls.name, category: category.name, name: formula.name }))) })).filter((group) => group.formulas.length);
    setGroupedFormulas(updateFromGrouped(next));
  }, [classesData, updateFromGrouped]);
  const deselectAllClasses = useCallback(() => { setGroupedFormulas(updateFromGrouped([])); }, [updateFromGrouped]);
  const reorderClass = useCallback((oldIndex, newIndex) => setGroupedFormulas((prev) => {
    const next = [...prev]; const [removed] = next.splice(oldIndex, 1); next.splice(newIndex, 0, removed); setFormulaSelections(canonicalSelections(flattenGroupedFormulas(next))); return next;
  }), []);
  const reorderFormula = useCallback((className, oldIndex, newIndex) => setGroupedFormulas((prev) => {
    const next = prev.map((group) => group.class !== className ? group : { ...group, formulas: [...group.formulas] });
    const group = next.find((item) => item.class === className); if (!group) return prev;
    const [removed] = group.formulas.splice(oldIndex, 1); group.formulas.splice(newIndex, 0, removed); setFormulaSelections(canonicalSelections(flattenGroupedFormulas(next))); return next;
  }), []);
  const getSelectedFormulasList = () => flattenGroupedFormulas(groupedFormulas);
  const getFormulaSelectionsList = () => formulaSelections;
  const clearSelections = () => { skipNextPersist.current = true; setGroupedFormulas(updateFromGrouped([])); if (identity != null) localStorage.removeItem(storageKey); };

  return { classesData, selectedClasses, selectedCategories, groupedFormulas, formulaSelections, formulaSelectionError, toggleClass, toggleCategory, getSelectedFormulasList, getFormulaSelectionsList, clearSelections, reorderClass, reorderFormula, removeClassFromOrder, removeSingleFormula, selectAllClasses, deselectAllClasses, selectedCount: getSelectedFormulasList().length, hasSelectedClasses: Object.keys(selectedClasses).length > 0, isFormulaSelectionInitialized };
}
