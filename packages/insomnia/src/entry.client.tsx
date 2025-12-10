import './ui/renderer-listeners';
import './ui/log';

import { configureFetch } from 'insomnia-api';
import { startTransition, StrictMode } from 'react';
import { hydrateRoot } from 'react-dom/client';
import { HydratedRouter } from 'react-router/dom';

import { insomniaFetch } from '~/ui/insomnia-fetch';

import { migrateFromLocalStorage, type SessionData, setSessionData, setVaultSessionData } from './account/session';
import { getInsomniaSession, getInsomniaVaultKey, getInsomniaVaultSalt, getSkipOnboarding } from './common/constants';
import { settings } from './models';
import { initNewOAuthSession } from './network/o-auth-2/get-token';
import { init as initPlugins } from './plugins';
import { applyColorScheme } from './plugins/misc';
import { HtmlElementWrapper } from './ui/components/html-element-wrapper';
import { showModal } from './ui/components/modals';
import { AlertModal } from './ui/components/modals/alert-modal';
import { PromptModal } from './ui/components/modals/prompt-modal';
import { WrapperModal } from './ui/components/modals/wrapper-modal';
import { initializeSentry } from './ui/sentry';
import { getInitialEntry } from './utils/router';

initializeSentry();

// Force onlyResolveOnSuccess to true, will be removed after all usages are updated
configureFetch(options => insomniaFetch({ ...options, onlyResolveOnSuccess: true }));

await initPlugins();

await migrateFromLocalStorage();

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

const appSettings = await settings.getOrCreate();

if (appSettings.clearOAuth2SessionOnRestart) {
  initNewOAuthSession();
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
