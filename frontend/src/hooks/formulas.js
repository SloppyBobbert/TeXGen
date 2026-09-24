import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useEditorSession } from './editorSession';
import { useApiRequest } from './useApiRequest';
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

function removeFromStorage(storageKey) {
  try {
    localStorage.removeItem(storageKey);
  } catch (cause) {
    console.error('Failed to clear formula storage', cause);
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
  return selections.map((selection) => indexes.byId.get(selection?.formula_id) || null).filter(Boolean);
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

function knownFormulaIds(classes) {
  return new Set(flattenGroupedFormulas(classes.flatMap((cls) => (cls.categories || []).map((category) => ({ formulas: category.formulas || [] })))).map(formulaId));
}

function selectionsForVisibleFormulas(selections, formulas, knownIds) {
  const remaining = canonicalSelections(formulas).map((selection) => selection.formula_id);
  const next = [];
  selections.forEach((selection) => {
    const id = selection?.formula_id;
    if (!knownIds.has(id)) {
      next.push(selection);
      return;
    }
    if (remaining.length) next.push({ formula_id: remaining.shift() });
  });
  return [...next, ...remaining.map((formula_id) => ({ formula_id }))];
}

function hasArray(object, key) {
  return Array.isArray(object?.[key]);
}

export function useFormulas(initialData, draftIdentity, onRemove) {
  const apiRequest = useApiRequest();
  const identity = draftIdentityFor(initialData, draftIdentity);
  const storageKey = storageKeyFor(initialData, draftIdentity);
  const [classesData, setClassesData] = useState([]);
  const { document, update, persistenceManaged } = useEditorSession({ selectedFormulas: [], formulaSelections: [] });
  const { selectedFormulas = [], formulaSelections = [] } = document;
  const { selectedClasses, selectedCategories, groupedFormulas } = useMemo(() => buildSelectionState(selectedFormulas), [selectedFormulas]);
  const [formulaSelectionError, setFormulaSelectionError] = useState(null);
  const [isFormulaSelectionInitialized, setIsFormulaSelectionInitialized] = useState(false);
  const initialLoadDone = useRef(false);
  const classesRequestRef = useRef(null);
  const skipNextPersist = useRef(false);

  useEffect(() => {
    if (initialLoadDone.current) return undefined;
    let cancelled = false;
    const v1 = identity == null ? { ok: true, draft: null } : readDraft(localStorage, identity);
    const legacy = identity == null ? null : loadFromStorage(storageKey);
    const initialCanonical = hasArray(initialData, 'formulaSelections') ? initialData.formulaSelections
      : (hasArray(initialData, 'formula_selections') ? initialData.formula_selections : null);
    const initialLegacy = hasArray(initialData, 'selectedFormulas') ? initialData.selectedFormulas
      : (hasArray(initialData, 'selected_formulas') ? initialData.selected_formulas : null);
    let classesRequest = classesRequestRef.current;
    if (!classesRequest) {
      classesRequest = apiRequest('/api/classes/').then((res) => res.json());
      classesRequestRef.current = classesRequest;
      const clearRequest = () => {
        if (classesRequestRef.current === classesRequest) classesRequestRef.current = null;
      };
      classesRequest.then(clearRequest, clearRequest);
    }

    classesRequest
      .then((data) => {
        if (cancelled || initialLoadDone.current) return;
        const classes = data.classes || [];
        const indexes = catalogIndexes(classes);
        let source = null;
        let records = [];
        let selections = [];
        let legacyRecordsResolved = false;
        let error = !v1.ok ? v1.error : null;

        if (persistenceManaged && initialCanonical !== null) {
          source = 'canonical';
          selections = initialCanonical;
        } else if (persistenceManaged && initialLegacy !== null) {
          source = 'legacy';
          records = initialLegacy;
        } else if (v1.ok && v1.draft) {
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
          records = resolved;
          if (resolved.length !== selections.length) error = error || { code: 'unresolved_formula_selection', message: 'Formula selections could not be resolved to the current catalog.', recoverable: true };
        } else if (source === 'legacy') {
          const resolved = resolveLegacy(records, indexes);
          if (resolved) {
            records = resolved;
            legacyRecordsResolved = true;
          }
          else if (records.length) error = error || { code: 'unresolved_legacy_formula', message: 'Legacy formula selections could not be resolved to stable formula IDs.', recoverable: true };
        }

        initialLoadDone.current = true;
        setClassesData(classes);
        update({ selectedFormulas: records, formulaSelections: source === 'canonical' ? selections : (legacyRecordsResolved ? canonicalSelections(records) : []) });
        setFormulaSelectionError(error);
        setIsFormulaSelectionInitialized(true);
      })
      .catch((cause) => {
        if (cancelled || initialLoadDone.current) return;
        console.error('Failed to fetch classes', cause);
        const fallback = initialLegacy || [];
        initialLoadDone.current = true;
        update({ selectedFormulas: fallback, formulaSelections: initialCanonical || canonicalSelections(fallback) });
        setIsFormulaSelectionInitialized(true);
      });
    return () => { cancelled = true; };
  }, [initialData, storageKey, identity, update, apiRequest, persistenceManaged]);

  useEffect(() => {
    if (persistenceManaged || !initialLoadDone.current || identity == null) return;
    if (skipNextPersist.current) {
      skipNextPersist.current = false;
      removeFromStorage(storageKey);
      return;
    }
    saveToStorage(storageKey, { selectedClasses, selectedCategories, groupedFormulas });
  }, [selectedClasses, selectedCategories, groupedFormulas, storageKey, identity, persistenceManaged]);

  const setGroupedFormulas = useCallback((value) => {
    update((state) => {
      const previous = buildSelectionState(state.selectedFormulas ?? []).groupedFormulas;
      const next = typeof value === 'function' ? value(previous) : value;
      const records = flattenGroupedFormulas(next);
      return { selectedFormulas: records, formulaSelections: selectionsForVisibleFormulas(state.formulaSelections ?? [], records, knownFormulaIds(classesData)) };
    });
  }, [classesData, update]);

  const addFormulasToOrder = useCallback((className, categoryName, formulas) => {
    setGroupedFormulas((prev) => {
      const next = [...prev];
      let index = next.findIndex((group) => group.class === className);
      if (index === -1) { next.push({ class: className, formulas: [] }); index = next.length - 1; }
      const group = { ...next[index], formulas: [...next[index].formulas] };
      group.formulas.push(...formulas.filter((formula) => !group.formulas.some((item) => formulaId(item) === formulaId(formula)))
        .map((formula) => ({ ...formula, id: formula.id, formula_id: formula.id, class: className, category: categoryName, name: formula.name })));
      next[index] = group;
      return next;
    });
  }, [setGroupedFormulas]);

  const requestRemoval = useCallback((next) => {
    const records = flattenGroupedFormulas(next);
    const remaining = new Set(records.map(formulaId));
    const removed = flattenGroupedFormulas(groupedFormulas).map(formulaId).filter((id) => !remaining.has(id));
    const canonical = selectionsForVisibleFormulas(formulaSelections, records, knownFormulaIds(classesData));
    const apply = () => setGroupedFormulas(next);
    if (onRemove && removed.length) onRemove(removed, apply, { records, canonical });
    else apply();
  }, [classesData, formulaSelections, groupedFormulas, onRemove, setGroupedFormulas]);

  const restoreSelections = useCallback((records, canonical) => {
    update({ selectedFormulas: records, formulaSelections: canonical ?? canonicalSelections(records) });
  }, [update]);

  const removeFormulasFromOrder = useCallback((className, categoryName) => {
    requestRemoval(groupedFormulas.map((group) => group.class === className
      ? { ...group, formulas: group.formulas.filter((formula) => formula.category !== categoryName) } : group).filter((group) => group.formulas.length));
  }, [groupedFormulas, requestRemoval]);

  const toggleClass = (className) => {
    if (selectedClasses[className]) {
      requestRemoval(groupedFormulas.filter((group) => group.class !== className));
      return;
    }
    const cls = classesData.find((item) => item.name === className);
    if (!cls) return;
    cls.categories?.forEach((category) => addFormulasToOrder(className, category.name, category.formulas || []));
  };

  const toggleCategory = (className, categoryName) => {
    const key = `${className}:${categoryName}`;
    if (selectedCategories[key]) { removeFormulasFromOrder(className, categoryName); return; }
    const category = classesData.find((item) => item.name === className)?.categories?.find((item) => item.name === categoryName);
    if (category) addFormulasToOrder(className, categoryName, category.formulas || []);
  };

  const removeClassFromOrder = useCallback((className) => {
    requestRemoval(groupedFormulas.filter((group) => group.class !== className));
  }, [groupedFormulas, requestRemoval]);
  const removeSingleFormula = useCallback((className, categoryName, formulaName, id) => {
    requestRemoval(groupedFormulas.map((group) => group.class !== className ? group : {
      ...group, formulas: group.formulas.filter((formula) => id ? formulaId(formula) !== id : !(formula.category === categoryName && formula.name === formulaName)),
    }).filter((group) => group.formulas.length));
  }, [groupedFormulas, requestRemoval]);
  const selectAllClasses = useCallback(() => {
    const next = classesData.map((cls) => ({ class: cls.name, formulas: (cls.categories || []).flatMap((category) => (category.formulas || []).map((formula) => ({ ...formula, id: formula.id, formula_id: formula.id, class: cls.name, category: category.name, name: formula.name }))) })).filter((group) => group.formulas.length);
    setGroupedFormulas(next);
  }, [classesData, setGroupedFormulas]);
  const deselectAllClasses = useCallback(() => { requestRemoval([]); }, [requestRemoval]);
  const reorderClass = useCallback((oldIndex, newIndex) => setGroupedFormulas((prev) => {
    const next = [...prev]; const [removed] = next.splice(oldIndex, 1); next.splice(newIndex, 0, removed);
    return next;
  }), [setGroupedFormulas]);
  const reorderFormula = useCallback((className, oldIndex, newIndex) => setGroupedFormulas((prev) => {
    const next = prev.map((group) => group.class !== className ? group : { ...group, formulas: [...group.formulas] });
    const group = next.find((item) => item.class === className); if (!group) return prev;
    const [removed] = group.formulas.splice(oldIndex, 1); group.formulas.splice(newIndex, 0, removed);
    return next;
  }), [setGroupedFormulas]);
  const getSelectedFormulasList = () => flattenGroupedFormulas(groupedFormulas);
  const getFormulaSelectionsList = () => formulaSelections;
  const clearSelections = () => { skipNextPersist.current = true; update({ selectedFormulas: [], formulaSelections: [] }); if (!persistenceManaged && identity != null) removeFromStorage(storageKey); };

  return { restoreSelections, classesData, selectedClasses, selectedCategories, groupedFormulas, formulaSelections, formulaSelectionError, toggleClass, toggleCategory, getSelectedFormulasList, getFormulaSelectionsList, clearSelections, reorderClass, reorderFormula, removeClassFromOrder, removeSingleFormula, selectAllClasses, deselectAllClasses, selectedCount: getSelectedFormulasList().length, hasSelectedClasses: Object.keys(selectedClasses).length > 0, isFormulaSelectionInitialized };
}
