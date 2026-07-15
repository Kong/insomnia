import { net } from 'electron/utility';
import { initDatabase, initServices } from 'insomnia-data';
import { createNedbDatabase, flushChangesImpl, servicesNodeImpl } from 'insomnia-data/node';

import { configureV3ClientDefaults } from './common/configure-v3-client';
import { setFetchImplementation } from './common/insomnia-fetch';
import { startDataProcessServer } from './data-process/server';

process.on('uncaughtException', err => {
  process.stdout.write(`[data-process] uncaughtException: ${err.stack ?? err.message}\n`);
});

process.on('unhandledRejection', reason => {
  const msg = reason instanceof Error ? (reason.stack ?? reason.message) : String(reason);
  process.stdout.write(`[data-process] unhandledRejection: ${msg}\n`);
});

process.parentPort.once('message', async (event: Electron.MessageEvent) => {
  const { dbPath } = event.data as { dbPath: string };

  const keepAlive = setInterval(() => {}, 30_000);

  try {
    const dataProcessDatabase = createNedbDatabase(nedbDatabase => ({
      ...nedbDatabase,
      init: async (config = {}, forceReset = false) => {
        await nedbDatabase.init({ dbPath, ...config }, forceReset);
      },
      flushChanges: async function (id = 0, fake = false) {
        const changes = await flushChangesImpl(id, fake);
        if (changes) {
          process.parentPort.postMessage({ type: 'db.changes', changes });
        }
      },
    }));

    await initDatabase(dataProcessDatabase);
    configureV3ClientDefaults();
    // net.fetch picks up the proxy + OS certs like the renderer; node fetch does neither.
    // only works post-ready, which is fine — nothing calls this earlier. 'omit' = no cookies, same as before.
    setFetchImplementation((input, init) =>
      net.fetch(input, { ...init, credentials: 'omit', bypassCustomProtocolHandlers: true }),
    );
    initServices(servicesNodeImpl);
    startDataProcessServer();
    process.parentPort.postMessage({ type: 'ready' });
  } catch (err) {
    clearInterval(keepAlive);
    const e = err instanceof Error ? err : new Error(String(err));
    process.stdout.write(`[data-process] init failed: ${e.stack ?? e.message}\n`);
    process.parentPort.postMessage({ type: 'error', message: e.message });
  }
});
