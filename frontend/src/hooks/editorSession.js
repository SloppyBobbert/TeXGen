import { createContext, useContext, useMemo, useReducer } from 'react';

export const EditorSessionContext = createContext(null);

export function editorReducer(state, action) {
  if (action.type === 'replace') return action.value;
  if (action.type === 'patch') {
    const patch = typeof action.value === 'function' ? action.value(state) : action.value;
    return { ...state, ...patch };
  }
  throw new Error(`Unknown editor transition: ${action.type}`);
}

export function useEditorSession(initial) {
  const inherited = useContext(EditorSessionContext);
  // Standalone hook/component tests have no App. They use the same reducer, not a mirror.
  const [document, dispatch] = useReducer(editorReducer, initial, (value) => {
    if (inherited) return null;
    return typeof value === 'function' ? value() : value;
  });
  const actions = useMemo(() => ({
    update: (value) => dispatch({ type: 'patch', value }),
    replace: (value) => dispatch({ type: 'replace', value }),
  }), []);
  return inherited ?? { document, ...actions };
}

export function useEditorFields(session, names) {
  const { update } = session;
  return useMemo(() => Object.fromEntries(names.split(' ').map((name) => [name, (value) => update((state) => ({
    [name]: typeof value === 'function' ? value(state[name]) : value,
  }))])), [names, update]);
}
