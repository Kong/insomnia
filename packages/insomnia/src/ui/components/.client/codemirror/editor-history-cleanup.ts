import { useEffect } from 'react';

import uiEventBus from '~/ui/event-bus';

import { purgeCachedEditorStates } from './editor-state-cache';

// Lifecycle cleanup for the shared editor-state cache: when a tab closes, drop the
// cached undo/redo history for the editors it owned, so closed tabs never crowd out
// still-open tabs (which is what caused undo to be lost when switching tabs).
//
// A tab's id is its resource id (e.g. the request id), and the editors inside embed
// that id in their historyKeys — `request-url-bar::<id>`, `<id>::render`,
// `auth::<id>::<field>`, `request-description::<id>`, etc. — so purging every cached
// key that contains a closed tab's id reclaims that tab's editors. (Key-value row
// keys are keyed on the pair id instead and are reclaimed on row delete; see the
// key-value editor.)
export const useEditorHistoryTabCleanup = () => {
  useEffect(() => {
    const handleCloseTab = (_organizationId: string, ids: string[] | 'all') => {
      // 'all' means every tab in the org closed — no live tab-scoped editors remain.
      if (ids === 'all') {
        purgeCachedEditorStates(() => true);
        return;
      }
      if (!ids.length) {
        return;
      }
      purgeCachedEditorStates(key => ids.some(id => key.includes(id)));
    };
    return uiEventBus.on('CLOSE_TAB', handleCloseTab);
  }, []);
};
