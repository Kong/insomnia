import { session } from 'electron/main';
import { models, services } from 'insomnia-data';

import { type ChangeBufferEvent, database as db } from '../common/database';
import { setDefaultProtocol } from '../utils/url/protocol';

// Update the proxy settings before making the request.
async function updateProxy() {
  const { proxyEnabled, httpProxy, httpsProxy, noProxy } = await services.settings.get();

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

      // Set proxy rules in the main session https://www.electronjs.org/docs/latest/api/structures/proxy-config
      // no mode here — it overrides proxyRules ('system' ignores them)
      await session.defaultSession.setProxy({
        proxyRules: proxyRules.join(';'),
        proxyBypassRules: noProxy ?? '',
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
          old.noProxy !== doc.noProxy;
        if (hasProxyChanged) {
          await updateProxy();
          old = doc;
        }
      }
    }
  });
}
