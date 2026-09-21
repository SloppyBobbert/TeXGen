import { StrictMode } from 'react';
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { EditorSessionContext, editorReducer, useEditorFields, useEditorSession } from './editorSession';

afterEach(cleanup);

const initialDocument = {
  draftId: 'first', title: 'Before', content: 'original', contentSource: 'generated',
  generatedSections: { version: 1, baseline: 'original' },
  formulaSelections: [{ formula_id: 'formula-a' }], selectedFormulas: [],
  history: [], historyIndex: -1,
};

function Owner({ children }) {
  const session = useEditorSession(initialDocument);
  return <EditorSessionContext.Provider value={session}>{children}</EditorSessionContext.Provider>;
}

function StrictOwner({ children }) {
  return <StrictMode><Owner>{children}</Owner></StrictMode>;
}

describe('editor session ownership', () => {
  it('publishes source, metadata, selections, and history together to all consumers', () => {
    const unusedInitializer = vi.fn(() => ({ content: 'wrong owner' }));
    const observations = [];
    const { result } = renderHook(() => {
      const first = useEditorSession(unusedInitializer);
      const second = useEditorSession(unusedInitializer);
      observations.push(second.document);
      return { first, second };
    }, { wrapper: StrictOwner });
    const destination = {
      content: 'remaining', generatedSections: null, contentSource: 'manual',
      formulaSelections: [], selectedFormulas: [],
      history: [{ content: 'original' }, { content: 'remaining' }], historyIndex: 1,
    };
    act(() => result.current.first.update(destination));
    expect(unusedInitializer).not.toHaveBeenCalled();
    expect(result.current.first.document).toBe(result.current.second.document);
    expect(result.current.second.document).toEqual({ ...initialDocument, ...destination });
    for (const document of observations) {
      expect(document).toEqual(document.content === 'original' ? initialDocument : { ...initialDocument, ...destination });
    }
  });

  it('replaces the document without carrying another draft history or selections', () => {
    const { result } = renderHook(() => useEditorSession(), { wrapper: Owner });
    const next = { draftId: 'second', title: 'New', content: '' };
    act(() => result.current.replace(next));
    expect(result.current.document).toEqual(next);
    expect(result.current.document.history).toBeUndefined();
    expect(result.current.document.formulaSelections).toBeUndefined();
  });

  it('applies queued field updates to the latest state with stable setters', () => {
    const { result } = renderHook(() => {
      const session = useEditorSession({ count: 0, content: 'keep' });
      return { session, fields: useEditorFields(session, 'count') };
    });
    const setter = result.current.fields.count;
    act(() => {
      setter((value) => value + 1);
      setter((value) => value + 1);
    });
    expect(result.current.session.document).toEqual({ count: 2, content: 'keep' });
    expect(result.current.fields.count).toBe(setter);
  });

  it('keeps standalone owners independent', () => {
    const first = renderHook(() => useEditorSession(initialDocument));
    const second = renderHook(() => useEditorSession(initialDocument));
    act(() => first.result.current.update({ content: 'changed' }));
    expect(second.result.current.document.content).toBe('original');
  });

  it('does not mutate the previous document during a functional transition', () => {
    const previous = Object.freeze({ content: 'before', columns: 2 });
    const next = editorReducer(previous, { type: 'patch', value: (state) => ({ columns: state.columns + 1 }) });
    expect(previous).toEqual({ content: 'before', columns: 2 });
    expect(next).toEqual({ content: 'before', columns: 3 });
  });
});
