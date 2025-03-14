
import { ipcRenderer } from 'electron';

import type { HandleChannels, MainOnChannels } from '../../main/ipc/electron';
import { extractUndefinedVariableKey, RenderError } from '../../templating/render-error';

type IpcRendererChannel = HandleChannels | MainOnChannels;
// eslint-disable-next-line @typescript-eslint/ban-ts-comment -- see below
// @ts-ignore -- inso transpiles to commonjs so doesn't play nice with this
const worker = new Worker(new URL('./templating-worker.ts', import.meta.url), { type: 'module' });
const ipcRendererChannelWhitelist: IpcRendererChannel[] = [];

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
      const isTheResponseWeAreWaitingFor = event.data.id === id;
      if (isTheResponseWeAreWaitingFor) {
        worker.removeEventListener('message', messageHandler);
        if (event.data.err) {
          const error = new RenderError(event.data.err);
          error.type = 'render';
          const undefinedEnvironmentVariables = extractUndefinedVariableKey(input, newContext);
          if (undefinedEnvironmentVariables.length > 0) {
            error.extraInfo = {
              subType: 'environmentVariable',
              undefinedEnvironmentVariables,
            };
          }
          return reject(error);
        }
        return resolve(event.data.result);
      }
      // In the scope of a render, we are also interested in listening for requests to the main process
      // Question: is it necessary to add another communication mechanism for this or can it be a new plugin function?
      // Process ipcRenderer messages from worker
      if (event.data?.type === 'worker-ipcRenderer-request') {
        const { id, channel, args } = event.data;
        const responseType = 'worker-ipcRenderer-response';
        const isAllowedChannel = ipcRendererChannelWhitelist.includes(channel);
        if (!isAllowedChannel) {
          // (@kent) Can this be a reject error instead?
          return worker.postMessage(JSON.stringify({
            type: responseType,
            id,
            error: `Channel ${channel} is not allowed`,
          }));
        }
        // only allowed channel will be forwarded to main process
        try {
          // Forward the request to the main process
          const result = await ipcRenderer.invoke(channel, ...args);
          worker.postMessage(JSON.stringify({
            type: responseType,
            id,
            result,
          }));
        } catch (error) {
          worker.postMessage(JSON.stringify({
            type: responseType,
            id,
            error: error.message,
          }));
        }
      }
    };
    worker.addEventListener('message', messageHandler);
  });
}
