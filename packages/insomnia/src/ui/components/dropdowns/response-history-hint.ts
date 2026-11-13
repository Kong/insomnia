export const HINT_DURATION_MS = 10_000;

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

interface HintTrigger {
  previousRequestId: string;
  requestId: string;
  previousActiveResponseId: string;
  activeResponseId: string;
  previousModified: number;
  modified: number;
  hasRestorableHistory: boolean;
  hintDismissed: boolean;
  alreadyShown: boolean;
}

/**
 * Navigating between requests, switching the shown response (including the
 * restore that happens when an older response is selected or the current one is
 * deleted), requests without a restorable snapshot, a dismissed hint, and a
 * hint already shown in this session must not trigger it. Only an actual edit of
 * the current request does.
 */
export const shouldShowResponseHistoryHint = ({
  previousRequestId,
  requestId,
  previousActiveResponseId,
  activeResponseId,
  previousModified,
  modified,
  hasRestorableHistory,
  hintDismissed,
  alreadyShown,
}: HintTrigger): boolean => {
  const isSameRequest = previousRequestId === requestId;
  const isSameResponse = previousActiveResponseId === activeResponseId;
  const isEdit = previousModified !== modified;

  return isSameRequest && isSameResponse && isEdit && hasRestorableHistory && !hintDismissed && !alreadyShown;
};
