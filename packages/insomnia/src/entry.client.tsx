import './ui/renderer-listeners';
import './ui/log';

import { initDatabase, initServices, services } from 'insomnia-data';
import { startTransition, StrictMode } from 'react';
import { hydrateRoot } from 'react-dom/client';
import { HydratedRouter } from 'react-router/dom';

import { setVaultSessionData } from '~/common/account/session';
import { getInsomniaVaultKey, getInsomniaVaultSalt, PLAYWRIGHT_TEST } from '~/common/constants';
import { setTemplatingDbAuthToken } from '~/common/templating/liquid-extension-worker';
import { initRuntime } from '~/runtimes';
import { rendererRuntime } from '~/runtimes/runtime.renderer';
import { database as clientDatabase } from '~/ui/database.client';
import { applyColorScheme } from '~/ui/plugins/misc';
import { createServicesProxy } from '~/ui/services-proxy';
import { clearOAuthWindowSessionId } from '~/ui/spawn-oauth-window';
import { getInitialEntry } from '~/ui/utils/router';

import { HtmlElementWrapper } from './ui/components/html-element-wrapper';
import { showModal } from './ui/components/modals';
import { AlertModal } from './ui/components/modals/alert-modal';
import { PromptModal } from './ui/components/modals/prompt-modal';
import { WrapperModal } from './ui/components/modals/wrapper-modal';
import { registerSyncMergeConflictListener } from './ui/utils/insomnia-sync';


// Fetch the templating-db auth token once so it's available for every templating call in this window.
setTemplatingDbAuthToken(await window.main.templatingDb.getAuthToken());

// Initialize database for renderer process
await initDatabase(clientDatabase);
// Initialize services for renderer process.
// With contextIsolation the preload exposes a flat invoke (a Proxy can't cross
// the bridge), so rebuild the Proxy here. Without it, the Proxy is on window directly.
const dataServices =
  window._dataServices ?? (window._dataServicesInvoke ? createServicesProxy(window._dataServicesInvoke) : undefined);
if (!dataServices) {
  throw new Error(
    'Services bridge is not available. This entrypoint must run in an environment with the preload bridge.',
  );
}
initServices(dataServices);
initRuntime(rendererRuntime);

registerSyncMergeConflictListener();

try {
  window.showAlert = options => showModal(AlertModal, options);
  window.showPrompt = options =>
    showModal(PromptModal, {
      ...options,
      title: options?.title || '',
    });
  window.showWrapper = options =>
    showModal(WrapperModal, {
      ...options,
      title: options?.title || '',
      body: <HtmlElementWrapper el={options?.body} onUnmount={options?.onHide} />,
    });

} catch (e) {
  console.log('[init] Failed to register window helpers', e);
}

// Smoke tests seed a fixed vault key through the environment
const insomniaVaultKey = getInsomniaVaultKey() || '';
if (PLAYWRIGHT_TEST && insomniaVaultKey) {
  await setVaultSessionData(getInsomniaVaultSalt() || '', insomniaVaultKey);
}

const appSettings = await services.settings.getOrCreate();

if (appSettings.clearOAuth2SessionOnRestart) {
  await clearOAuthWindowSessionId();
}

applyColorScheme(appSettings);

const initialEntry = await getInitialEntry();

// `getInitialEntry` returns either a bare pathname string or an object carrying router
// `state` (e.g. `asyncTaskList`). Normalize both shapes, then set the URL and state before
// hydration. We use `history.replaceState` rather than assigning `window.location.pathname`
// (a full reload that would drop the `state`): in SPA mode `HydratedRouter` hydrates against
// the current `window.location` and reads `location.state` from `window.history.state.usr`.
if (initialEntry) {
  const { pathname, state } =
    typeof initialEntry === 'string' ? { pathname: initialEntry, state: undefined } : initialEntry;

  if (pathname !== window.location.pathname || state) {
    console.log('[entry.client] Initial entry:', pathname);
    window.history.replaceState({ ...window.history.state, usr: state }, '', pathname);
  }
}

startTransition(() => {
  hydrateRoot(
    document,
    <StrictMode>
      <HydratedRouter />
    </StrictMode>,
  );
});
