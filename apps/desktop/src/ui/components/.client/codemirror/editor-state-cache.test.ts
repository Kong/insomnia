import { afterEach, describe, expect, it } from 'vitest';

import { getCachedEditorState, purgeCachedEditorStates, setCachedEditorState } from './editor-state-cache';

// The cache is a module-level singleton, so clear it between tests.
afterEach(() => {
  purgeCachedEditorStates(() => true);
});

const state = (history: string) => ({ history });

describe('purgeCachedEditorStates', () => {
  it('removes only the entries whose key matches the predicate and returns the count', () => {
    setCachedEditorState('request-url-bar::req_1', state('a'));
    setCachedEditorState('auth::req_1::token', state('b'));
    setCachedEditorState('request-url-bar::req_2', state('c'));

    const removed = purgeCachedEditorStates(key => key.includes('req_1'));

    expect(removed).toBe(2);
    expect(getCachedEditorState('request-url-bar::req_1')).toBeUndefined();
    expect(getCachedEditorState('auth::req_1::token')).toBeUndefined();
    // an unrelated tab's entry is untouched
    expect(getCachedEditorState('request-url-bar::req_2')).toEqual(state('c'));
  });

  it('purges a deleted row without touching sibling rows', () => {
    setCachedEditorState('key-value-editor__namepair_1', state('n1'));
    setCachedEditorState('key-value-editor__valuepair_1', state('v1'));
    setCachedEditorState('key-value-editor__namepair_2', state('n2'));

    purgeCachedEditorStates(key => key.includes('pair_1'));

    expect(getCachedEditorState('key-value-editor__namepair_1')).toBeUndefined();
    expect(getCachedEditorState('key-value-editor__valuepair_1')).toBeUndefined();
    expect(getCachedEditorState('key-value-editor__namepair_2')).toEqual(state('n2'));
  });

  it('purge-all clears the whole cache', () => {
    setCachedEditorState('a', state('1'));
    setCachedEditorState('b', state('2'));

    const removed = purgeCachedEditorStates(() => true);

    expect(removed).toBe(2);
    expect(getCachedEditorState('a')).toBeUndefined();
    expect(getCachedEditorState('b')).toBeUndefined();
  });

  it('returns 0 when nothing matches', () => {
    setCachedEditorState('keep-me', state('1'));
    expect(purgeCachedEditorStates(key => key.includes('nope'))).toBe(0);
    expect(getCachedEditorState('keep-me')).toEqual(state('1'));
  });
});
