import { session } from 'electron/main';
import { models, services } from 'insomnia-data';
import { ProxyScopes } from 'insomnia-data/common';

import {
  getAIServiceURL,
  getApiBaseURL,
  getAppWebsiteBaseURL,
  getCioCdnUrl,
  getGitHubRestApiUrl,
  getKonnectApiUrl,
  getMockServiceURL,
  getSentryDsn,
} from '~/common/constants';
import { setDefaultProtocol } from '~/common/utils/url/protocol';

import { type ChangeBufferEvent, database as db } from '../common/database';
import { getUpdatesBaseURL } from './updates';

// Insomnia's own first-party integrations — fixed hosts, not user-configured targets like a
// self-hosted GitLab or MCP server. Bypassed unless `proxyScope` is 'all' (see below), so a
// user's proxy — typically set up for their own requests — doesn't also have to know how to
// route to these, matching how this traffic behaved before the app's proxy setting covered it.
function insomniaIntegrationHosts() {
  const urls = [
    // Insomnia's own backend/CDN
    getApiBaseURL(),
    getAppWebsiteBaseURL(),
    getMockServiceURL(),
    getAIServiceURL(),
    getUpdatesBaseURL,
    'https://static.insomnia.rest',

    // Kong Konnect
    getKonnectApiUrl(),

    // GitHub REST API — OAuth/repo listing (main/sync/git/providers/github.ts). This is the app
    // talking to GitHub on the user's behalf, so it's safe to bypass unconditionally.
    //
    // Actual git remote traffic (github.com, self-hosted GitLab, GitHub Enterprise, etc.) is
    // NOT listed here — it's handled directly in sync/git/http-client.ts, which treats all
    // git-sync traffic uniformly under `proxyScope` via its own dedicated direct session,
    // scoped to just those requests rather than this session-wide bypass list.
    getGitHubRestApiUrl(),

    // Analytics & error monitoring — main/analytics.ts (Segment, via net.fetch),
    // main/sentry.ts (Sentry, via @sentry/electron's own net.request-based transport)
    'https://api.segment.io',
    getSentryDsn(),

    // Customer.io — ui/hooks/use-cio.tsx's CDP client, plus the in-app messaging ("Gist")
    // widget iframe and the Google Fonts it loads (see main/api.protocol.ts)
    getCioCdnUrl(),
    'https://renderer.gist.build',
    'https://code.gist.build',
    'https://fonts.googleapis.com',
    'https://fonts.gstatic.com',
  ];
  return urls.flatMap(url => {
    try {
      const host = new URL(setDefaultProtocol(url)).host;
      // Leading-dot form also bypasses subdomains — needed for e.g. Insomnia Cloud's
      // per-mock-server `mock-<id>.mock.insomnia.run` hosts (see getMockServiceBinURL).
      // Same convention already documented on the `noProxy` setting in the UI.
      return [host, `.${host}`];
    } catch {
      return [];
    }
  });
}

// Update the proxy settings before making the request.
async function updateProxy() {
  const { proxyEnabled, httpProxy, httpsProxy, noProxy, proxyScope } = await services.settings.get();

  if (proxyEnabled) {
    try {
      // Supported values for proxyUrl are like: http://localhost:8888, https://localhost:8888 or localhost:8888
      // This function tries to parse the proxyUrl and return the host (host:port) in order to allow all the above values to work.
      // url.host keeps IPv6 brackets intact, url.hostname doesn't
      function parseProxyFromUrl(proxyUrl: string) {
        const url = new URL(setDefaultProtocol(proxyUrl));
        return url.host;
      }
      const proxyRules = [];
      if (httpProxy) {
        proxyRules.push(`http=${parseProxyFromUrl(httpProxy)}`);
      }
      if (httpsProxy) {
        proxyRules.push(`https=${parseProxyFromUrl(httpsProxy)}`);
      }

      const bypassRules =
        proxyScope === ProxyScopes.all
          ? (noProxy ?? '')
          : [noProxy, ...insomniaIntegrationHosts()].filter(Boolean).join(',');

      // Set proxy rules in the main session https://www.electronjs.org/docs/latest/api/structures/proxy-config
      await session.defaultSession.setProxy({
        proxyRules: proxyRules.join(';'),
        proxyBypassRules: bypassRules,
        mode: 'fixed_servers',
      });
      return;
    } catch (err) {
      // bad proxy settings shouldn't break startup — fall back to the system proxy
      console.warn('[proxy] Failed to apply proxy settings, falling back to system proxy', err);
    }
  }
  try {
    await session.defaultSession.setProxy({ proxyRules: '', proxyBypassRules: '', mode: 'system' });
  } catch (err) {
    console.warn('[proxy] Failed to reset proxy to system', err);
  }
}

export async function watchProxySettings() {
  let old = await services.settings.get();
  await updateProxy();
  db.onChange(async (changes: ChangeBufferEvent[]) => {
    for (const change of changes) {
      const [event, doc] = change;
      const isSettingsUpdate = models.settings.isSettings(doc) && event === 'update';
      if (isSettingsUpdate) {
        const hasProxyChanged =
          old.proxyEnabled !== doc.proxyEnabled ||
          old.httpProxy !== doc.httpProxy ||
          old.httpsProxy !== doc.httpsProxy ||
          old.noProxy !== doc.noProxy ||
          old.proxyScope !== doc.proxyScope;
        if (hasProxyChanged) {
          await updateProxy();
          old = doc;
        }
      }
    }
  });
}
