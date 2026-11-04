import path from 'node:path';

import { app, net, protocol } from 'electron';

import { resolveDbByKey } from './templating-worker-database';

export interface RegisterProtocolOptions {
  scheme: string;
}

const httpsScheme = 'https';
const httpScheme = 'http';
const templatingWorkerDatabaseInterface = 'insomnia-templating-worker-database';

export async function registerInsomniaProtocols() {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: httpsScheme,
      privileges: { secure: true, standard: true, supportFetchAPI: true },
    },
    {
      scheme: httpScheme,
      privileges: { secure: true, standard: true, supportFetchAPI: true },
    },
    {
      scheme: templatingWorkerDatabaseInterface,
      privileges: { secure: true, standard: true, supportFetchAPI: true, corsEnabled: true },
    },
  ]);

  await app.whenReady();

  if (!protocol.isProtocolHandled(httpsScheme)) {
    protocol.handle(httpsScheme, async request => {
      const url = new URL(request.url);
      if (url.hostname === 'insomnia-app.local') {
        const rootDir = path.resolve(__dirname, 'client');
        const filePath = path.join(rootDir, url.pathname.startsWith('/assets') ? url.pathname : 'index.html');
        console.log(`Loading index for: ${url.pathname} from: ${filePath}`);

        return await net.fetch(`file://${filePath}`, { bypassCustomProtocolHandlers: true });
      }

      return net.fetch(request, { bypassCustomProtocolHandlers: true });
    });
  }
  if (!protocol.isProtocolHandled(httpScheme)) {
    protocol.handle(httpScheme, async request => {
      return net.fetch(request, { bypassCustomProtocolHandlers: true });
    });
  }
  if (!protocol.isProtocolHandled(templatingWorkerDatabaseInterface)) {
    protocol.handle(templatingWorkerDatabaseInterface, resolveDbByKey);
  }
}
