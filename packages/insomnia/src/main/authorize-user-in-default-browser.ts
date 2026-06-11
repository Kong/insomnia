import type { DefaultBrowserRedirectParam } from '~/common/misc';

const { shell } = require('electron');

let pendingOAuthResolver: ((param: DefaultBrowserRedirectParam) => void) | null = null;
let pendingOAuthRejector: ((err: Error) => void) | null = null;

function clearPendingResolverAndRejector() {
  pendingOAuthResolver = null;
  pendingOAuthRejector = null;
}

export async function authorizeUserInDefaultBrowser({ url }: { url: string }) {
  if (pendingOAuthRejector) {
    pendingOAuthRejector(new Error('Canceled by new OAuth request'));
    clearPendingResolverAndRejector();
  }

  return new Promise<DefaultBrowserRedirectParam>((resolve, reject) => {
    pendingOAuthResolver = resolve;
    pendingOAuthRejector = reject;

    shell.openExternal(url).catch((err: Error) => {
      reject(new Error(`Failed to open default browser: ${err?.message}`));
      clearPendingResolverAndRejector();
    });
  });
}

export function onDefaultBrowserOAuthRedirect(param: DefaultBrowserRedirectParam) {
  try {
    if (pendingOAuthResolver) {
      pendingOAuthResolver(param);
      clearPendingResolverAndRejector();
    }
  } catch {}
}

export function cancelAuthorizationInDefaultBrowser(reason = '') {
  try {
    if (pendingOAuthRejector) {
      pendingOAuthRejector(new Error(reason));
      clearPendingResolverAndRejector();
    }
  } catch {}
}
