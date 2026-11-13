export const HINT_DURATION_MS = 10_000;

/**
 * Dispatched after the request update action persists a change to fields the user
 * edits (URL, body, headers, parameters, auth). Sync, plugins and renames write the
 * request document too, but they never dispatch this.
 */
export const REQUEST_CONTENT_EDITED_EVENT = 'request-content-edited';

export interface RequestContentEditedDetail {
  requestId: string;
}

/**
 * Dismissing the hint is a local UI preference, so it lives in localStorage
 * instead of the synced settings document.
 */
const HINT_DISMISSED_STORAGE_KEY = 'responseHistoryHintDismissed';

export const isResponseHistoryHintDismissed = (): boolean => {
  try {
    return window.localStorage.getItem(HINT_DISMISSED_STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
};

export const dismissResponseHistoryHint = (): void => {
  try {
    window.localStorage.setItem(HINT_DISMISSED_STORAGE_KEY, 'true');
  } catch {
    // Storage can be unavailable (disabled or full). The caller still hides the
    // hint for this session, so dismissal degrades to session-scoped.
  }
};
