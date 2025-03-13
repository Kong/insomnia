
import { ipcRenderer } from 'electron';

import { extractUndefinedVariableKey, RenderError } from '../../templating/render-error';

// eslint-disable-next-line @typescript-eslint/ban-ts-comment -- see below
// @ts-ignore -- inso transpiles to commonjs so doesn't play nice with this
const worker = new Worker(new URL('./templating-worker.ts', import.meta.url), { type: 'module' });

// Triggered by a mistake in the work initialization code above
worker.addEventListener('error', event => {
  console.error('Error from worker:', event.message);
});

export function renderInWorker({ input, context, path, ignoreUndefinedEnvVariable }: { input: string; context: Record<string, any>; path: string; ignoreUndefinedEnvVariable: boolean }): Promise<string> {
  const newContext = {
    ...context,
    serializedFunctions: {
      requestId: context.getMeta().requestId,
      workspaceId: context.getMeta().workspaceId,
      environmentId: context.getEnvironmentId(),
      extraInfo: context.getExtraInfo(),
      globalEnvironmentId: context.getGlobalEnvironmentId(),
      keysContext: context.getKeysContext(),
      projectId: context.getProjectId(),
      purpose: context.getPurpose(),
    },
  };

  // Id to avoid race conditions
  const id = window.crypto.randomUUID();
  const payloadWithHash = JSON.stringify({ id, input, context: newContext, path, ignoreUndefinedEnvVariable });
  worker.postMessage(payloadWithHash);
  return new Promise((resolve, reject) => {
    const messageHandler = async (event: MessageEvent) => {
      if (event.data.id === id) {
        worker.removeEventListener('message', messageHandler);
        if (event.data.err) {
          const error = new RenderError(event.data.err);
          error.type = 'render';
          error.extraInfo = {
            subType: 'environmentVariable',
            undefinedEnvironmentVariables: extractUndefinedVariableKey(input, newContext),
          };
          return reject(error);
        }
        return resolve(event.data.result);
      } else {
        try {
          // Only process IPC request messages
          if (event.data.type === 'worker-ipc-request') {
            const { id, channel, args } = event.data;

            try {
              // Forward the request to the main process
              const result = await ipcRenderer.invoke(channel, ...args);
              worker.postMessage(JSON.stringify({
                type: 'worker-ipc-response',
                id,
                result,
              }));
            } catch (error) {
              worker.postMessage(JSON.stringify({
                type: 'worker-ipc-response',
                id,
                error: error.message,
              }));
            }
          }
        } catch (err) {
          console.error('Error handling worker message:', err);
        }
      };
    };
    worker.addEventListener('message', messageHandler);
  });
}
