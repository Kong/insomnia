// A tiny in-memory signal used to focus the request URL bar right after a new request is created.
// We can't pass this through the router (the tab-navigation layer strips redirect search params),
// and a consume-on-render flag breaks under React StrictMode (the discarded first mount consumes it),
// so the create flow sets the flag, the URL bar reads it during render, and it's cleared only once the
// editor actually focuses itself (via OneLineEditor's onAutoFocus).
let pendingFocusUrlBar = false;

export const focusUrlBarOnNextRequest = () => {
  pendingFocusUrlBar = true;
};

export const shouldFocusUrlBar = (): boolean => pendingFocusUrlBar;

export const clearPendingFocusUrlBar = () => {
  pendingFocusUrlBar = false;
};
