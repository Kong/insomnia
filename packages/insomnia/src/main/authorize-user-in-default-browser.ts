import { createServer, type Server } from 'node:http';

import { getOauthRedirectUrl } from '~/common/constants';
import type { DefaultBrowserRedirectParam } from '~/common/misc';

const { shell } = require('electron');

const CALLBACK_PAGE =
  '<!doctype html><title>Authorization complete</title><p>Authorization complete. You can close this tab.</p>';

let pendingOAuthResolver: ((param: DefaultBrowserRedirectParam) => void) | null = null;
let pendingOAuthRejector: ((err: Error) => void) | null = null;
let loopbackServer: Server | null = null;

function clearPendingResolverAndRejector() {
  pendingOAuthResolver = null;
  pendingOAuthRejector = null;
  loopbackServer?.close();
  loopbackServer = null;
}

// Receives the provider's redirect on 127.0.0.1 (RFC 8252), so no relay service sees the code
function listenForRedirect(expectedState: string | null) {
  const redirectUrl = new URL(getOauthRedirectUrl());
  const server = createServer((request, response) => {
    // A kept-alive socket would outlive server.close()
    response.shouldKeepAlive = false;
    const url = new URL(request.url ?? '/', redirectUrl);
    const isCallback =
      request.method === 'GET' &&
      request.headers.host === redirectUrl.host &&
      url.pathname === redirectUrl.pathname &&
      (!expectedState || url.searchParams.get('state') === expectedState);
    if (!isCallback) {
      response.writeHead(404).end();
      return;
    }
    response.writeHead(200, { 'Content-Type': 'text/html' }).end(CALLBACK_PAGE);
    onDefaultBrowserOAuthRedirect({ redirectUrl: url.toString() });
  });
  server.on('error', (err: NodeJS.ErrnoException) => {
    const reason = err.code === 'EADDRINUSE' ? `Port ${redirectUrl.port} is already in use` : err.message;
    cancelAuthorizationInDefaultBrowser(`Could not listen for the OAuth redirect: ${reason}`);
  });
  server.listen(Number(redirectUrl.port), redirectUrl.hostname);
  return server;
}

export async function authorizeUserInDefaultBrowser({
  url,
  openDefaultBrowser = true,
}: {
  url: string;
  openDefaultBrowser?: boolean;
}) {
  if (pendingOAuthRejector) {
    pendingOAuthRejector(new Error('Canceled by new OAuth request'));
    clearPendingResolverAndRejector();
  }

  return new Promise<DefaultBrowserRedirectParam>((resolve, reject) => {
    pendingOAuthResolver = resolve;
    pendingOAuthRejector = reject;
    loopbackServer = listenForRedirect(new URL(url).searchParams.get('state'));

    if (openDefaultBrowser) {
      shell.openExternal(url).catch((err: Error) => {
        reject(new Error(`Failed to open default browser: ${err?.message}`));
        clearPendingResolverAndRejector();
      });
    }
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
