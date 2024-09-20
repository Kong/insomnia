import { session } from 'electron/main';

import { type ChangeBufferEvent, database as db } from '../common/database';
import { settings } from '../models';
import { isSettings } from '../models/settings';
import { setDefaultProtocol } from '../utils/url/protocol';

// Update the proxy settings before making the request.
async function updateProxy() {
  const { proxyEnabled, httpProxy, httpsProxy, noProxy } = await settings.get();

  if (proxyEnabled) {
    // Supported values for proxyUrl are like: http://localhost:8888, https://localhost:8888 or localhost:8888
    // This function tries to parse the proxyUrl and return the hostname in order to allow all the above values to work.
    function parseProxyFromUrl(proxyUrl: string) {
      const url = new URL(setDefaultProtocol(proxyUrl));
      return `${url.hostname}${url.port ? `:${url.port}` : ''}`;
    }
    const proxyRules = [];
    if (httpProxy) {
      proxyRules.push(`http=${parseProxyFromUrl(httpProxy)}`);
    }
    if (httpsProxy) {
      proxyRules.push(`https=${parseProxyFromUrl(httpsProxy)}`);
    }

    session.defaultSession.resolveProxy;
    // Set proxy rules in the main session https://www.electronjs.org/docs/latest/api/structures/proxy-config
    session.defaultSession.setProxy({
      proxyRules: proxyRules.join(';'),
      proxyBypassRules: [
        noProxy,
        // getApiBaseURL(),
        // @TODO Add all our API urls here to bypass the proxy to work as before with axios.
        // We can add an option in settings to use the proxy for insomnia API requests and not include them here.
      ].join(','),
      mode: 'system',
    });
    return;
  }
  session.defaultSession.setProxy({ proxyRules: '', proxyBypassRules: '', mode: 'system' });
}

export async function watchProxySettings() {
  let old = await settings.get();
  updateProxy();
  db.onChange(async (changes: ChangeBufferEvent[]) => {
    for (const change of changes) {
      const [event, doc] = change;
      const isSettingsUpdate = isSettings(doc) && event === 'update';
      if (isSettingsUpdate) {
        const hasProxyChanged = old.proxyEnabled !== doc.proxyEnabled || old.httpProxy !== doc.httpProxy || old.httpsProxy !== doc.httpsProxy || old.noProxy !== doc.noProxy;
        if (hasProxyChanged) {
          updateProxy();
          old = doc;
        }
      }
    }
  });
}
