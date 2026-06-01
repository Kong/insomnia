import './ui/renderer-listeners';
import './ui/log';

import { configureFetch } from 'insomnia-api';
import { startTransition, StrictMode } from 'react';
import { hydrateRoot } from 'react-dom/client';
import { HydratedRouter } from 'react-router/dom';

import { insomniaFetch } from '~/common/insomnia-fetch';
import { initDatabase, initServices, services } from '~/insomnia-data';
import { database as clientDatabase } from '~/ui/database.client';
import { clearOAuthWindowSessionId } from '~/ui/spawn-oauth-window';

import { migrateFromLocalStorage, type SessionData, setSessionData, setVaultSessionData } from './account/session';
import { getInsomniaSession, getInsomniaVaultKey, getInsomniaVaultSalt, getSkipOnboarding } from './common/constants';
import { applyColorScheme } from './plugins/misc';
import { registerSyncMergeConflictListener } from './sync/vcs/insomnia-sync';
import { HtmlElementWrapper } from './ui/components/html-element-wrapper';
import { showModal } from './ui/components/modals';
import { AlertModal } from './ui/components/modals/alert-modal';
import { PromptModal } from './ui/components/modals/prompt-modal';
import { WrapperModal } from './ui/components/modals/wrapper-modal';
import { initializeSentry } from './ui/sentry';
import { getInitialEntry } from './utils/router';

initializeSentry();

// Initialize database for renderer process
await initDatabase(clientDatabase);
// Initialize services for renderer process
if (!window._dataServices) {
  throw new Error(
    'window._dataServices is not available. This entrypoint must run in an environment with the preload bridge.',
  );
}
initServices(window._dataServices);
// Remove the global services reference after initialization to improve security by preventing unintended access from the global scope.
delete window._dataServices;

configureFetch(options => insomniaFetch({ ...options, onDeepLink: (uri: string) => window.main.openDeepLink(uri) }));

await migrateFromLocalStorage();
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

  // In order to run playwight tests that simulate a logged in user
  // we need to inject state into localStorage
  const skipOnboarding = getSkipOnboarding();
  if (skipOnboarding) {
    window.localStorage.setItem('hasSeenOnboardingV12', skipOnboarding.toString());
    window.localStorage.setItem('hasUserLoggedInBefore', skipOnboarding.toString());
  }
} catch (e) {
  console.log('[onboarding] Failed to parse session data', e);
}

// Workaround for iframe redirect issue caused by api.protocol.ts
// Problem: The https protocol handler (registerInsomniaProtocols) intercepts all https requests
// to solve CORS issues. However, when an iframe redirects from https://renderer.gist.build to
// https://code.gist.build, the protocol handler auto-follows the redirect but the iframe's
// location doesn't update. This causes the Customer.io SDK to fail origin validation.
//
// Solution: Intercept postMessage events from renderer.gist.build in the capture phase,
// stop propagation, and re-dispatch with origin changed to code.gist.build. This makes
// the SDK think the message came from the expected redirected URL.
window.addEventListener(
  'message',
  (event: MessageEvent) => {
    // If origin is renderer.gist.build (original URL), stop propagation and dispatch a new event
    if (event.origin === 'https://renderer.gist.build') {
      // Stop the original event from reaching other listeners
      event.stopImmediatePropagation();

      // Create and dispatch a new MessageEvent with modified origin
      // Note: 'ports' property is read-only and cannot be set, but the SDK doesn't use it
      const newEvent = new MessageEvent('message', {
        data: event.data,
        origin: 'https://code.gist.build',
        lastEventId: event.lastEventId,
        source: event.source,
      });

      window.dispatchEvent(newEvent);
      return;
    }
  },
  true, // Use capture phase to intercept before other listeners
);

// Check if there is a Session provided by an env variable and use this
const insomniaSession = getInsomniaSession();
const insomniaVaultKey = getInsomniaVaultKey() || '';
const insomniaVaultSalt = getInsomniaVaultSalt() || '';
if (insomniaSession) {
  try {
    const session = JSON.parse(insomniaSession) as SessionData;
    await setSessionData(
      session.id,
      session.accountId,
      session.firstName,
      session.lastName,
      session.email,
      session.symmetricKey,
      session.publicKey,
      session.encPrivateKey,
    );
    if (insomniaVaultSalt || insomniaVaultKey) {
      await setVaultSessionData(insomniaVaultSalt, insomniaVaultKey);
    }
  } catch (e) {
    console.log('[init] Failed to parse session data', e);
  }
}

const appSettings = await services.settings.getOrCreate();

if (appSettings.clearOAuth2SessionOnRestart) {
  await clearOAuthWindowSessionId();
}

applyColorScheme(appSettings);

const initialEntry = await getInitialEntry();

if (typeof initialEntry === 'string' && window.location.pathname !== initialEntry) {
  console.log('[entry.client] Initial entry:', initialEntry);
  window.location.pathname = initialEntry;
}

startTransition(() => {
  hydrateRoot(
    document,
    <StrictMode>
      <HydratedRouter />
    </StrictMode>,
  );
});
