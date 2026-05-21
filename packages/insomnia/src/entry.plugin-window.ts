import { randomUUID } from 'node:crypto';

import { ipcRenderer } from 'electron';

import { initDatabase, initServices } from '~/insomnia-data';

import { pluginWindowDatabase } from './main/database.plugin-window';
import type { RenderTemplateArgs } from './plugins/bridge-types';
import { invokePluginMethod } from './plugins/invoke-method';
import { servicesProxy } from './ui/renderer-services-proxy';

interface PluginInvokeMessage {
  id: string;
  method: Parameters<typeof invokePluginMethod>[0];
  args: unknown;
}

interface PendingWorkerRequest {
  reject: (error: Error) => void;
  resolve: (value: string) => void;
}

type TemplatingWorkerRequest =
  | {
      id: string;
      type: 'reload';
    }
  | {
      id: string;
      type: 'render';
      args: RenderTemplateArgs;
    };

let templatingWorker: Worker | null = null;
const pendingTemplatingWorkerRequests = new Map<string, PendingWorkerRequest>();

function serializeInvocationError(error: unknown) {
  if (!(error instanceof Error)) {
    return { message: String(error) };
  }

  return {
    name: error.name,
    message: error.message,
    stack: error.stack,
    ...Object.fromEntries(Object.entries(error)),
  };
}

function normalizeWorkerError(error: unknown) {
  if (!error || typeof error !== 'object') {
    return new Error(String(error));
  }

  if (error instanceof Error) {
    return error;
  }

  const normalized = new Error('message' in error && typeof error.message === 'string' ? error.message : String(error));

  if ('name' in error && typeof error.name === 'string') {
    normalized.name = error.name;
  }
  if ('stack' in error && typeof error.stack === 'string') {
    normalized.stack = error.stack;
  }

  Object.assign(normalized, error);
  return normalized;
}

function resetTemplatingWorker(error = new Error('[plugin-window] templating worker restarted')) {
  templatingWorker?.terminate();
  templatingWorker = null;

  for (const [id, pending] of pendingTemplatingWorkerRequests) {
    pendingTemplatingWorkerRequests.delete(id);
    pending.reject(error);
  }
}

function getTemplatingWorker() {
  if (templatingWorker) {
    return templatingWorker;
  }

  templatingWorker = new Worker(new URL('entry.plugin-window-templating-worker.min.js', window.location.href), {
    name: 'plugin-templating-worker',
    type: 'module',
  });

  templatingWorker.addEventListener(
    'message',
    (event: MessageEvent<{ error?: unknown; id: string; result?: string }>) => {
      const pending = pendingTemplatingWorkerRequests.get(event.data.id);
      if (!pending) {
        return;
      }
      pendingTemplatingWorkerRequests.delete(event.data.id);

      if (event.data.error) {
        pending.reject(normalizeWorkerError(event.data.error));
      } else {
        pending.resolve(event.data.result || '');
      }
    },
  );
  templatingWorker.addEventListener('error', event => {
    console.error('[plugin-window] templating worker error:', event.message);
    resetTemplatingWorker(new Error(`[plugin-window] templating worker error: ${event.message}`));
  });

  return templatingWorker;
}

function renderTemplateInWorker(args: RenderTemplateArgs) {
  return new Promise<string>((resolve, reject) => {
    const id = randomUUID();
    pendingTemplatingWorkerRequests.set(id, { resolve, reject });
    getTemplatingWorker().postMessage({
      id,
      type: 'render',
      args,
    } satisfies TemplatingWorkerRequest);
  });
}

ipcRenderer.on('plugins.invoke', async (_event, { id, method, args }: PluginInvokeMessage) => {
  try {
    if (method === 'renderTemplate') {
      const result = await renderTemplateInWorker(args as RenderTemplateArgs);
      ipcRenderer.send('plugins.invokeResult', { id, result });
      return;
    }

    const result = await invokePluginMethod(method, args);
    if (method === 'reloadPlugins') {
      resetTemplatingWorker();
    }
    ipcRenderer.send('plugins.invokeResult', { id, result });
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error(`[plugin-window] Error in ${(error as any)?.method ?? method}: ${errMsg}`);
    ipcRenderer.send('plugins.invokeResult', { id, error: serializeInvocationError(error) });
  }
});

// Initialize database (via IPC proxy) and services before signalling readiness.
// getPlugins() calls services.settings.get(), which requires this to be done first.
(async () => {
  try {
    await initDatabase(pluginWindowDatabase);
    initServices(servicesProxy);
    ipcRenderer.send('plugins.windowReady');
  } catch (err) {
    console.error('[plugin-window] Initialization failed:', err);
  }
})();
