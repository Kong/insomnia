import { serializeRenderContext } from '../../templating/render-context-serialization';
import { extractUndefinedVariableKey, RenderError } from '../../templating/render-error';
import type { RenderInputType } from '../../templating/types';

// eslint-disable-next-line @typescript-eslint/ban-ts-comment -- see below
// @ts-ignore -- inso transpiles to commonjs so doesn't play nice with this
const worker = new Worker(new URL('templating-worker.ts', import.meta.url), { type: 'module' });

// Triggered by a mistake in the work initialization code above
worker.addEventListener('error', event => {
  console.error('Error from worker:', event.message);
});

export function renderInWorker({ input, context, path, ignoreUndefinedEnvVariable }: RenderInputType): Promise<string> {
  const newContext = serializeRenderContext(context);

  // Id to avoid race conditions
  const id = window.crypto.randomUUID();
  const payloadWithHash = JSON.stringify({ id, input, context: newContext, path, ignoreUndefinedEnvVariable });
  worker.postMessage(payloadWithHash);
  return new Promise((resolve, reject) => {
    const messageHandler = (event: MessageEvent) => {
      if (event.data.id === id) {
        worker.removeEventListener('message', messageHandler);
        const workerError = event.data.err;
        if (workerError) {
          const error = new RenderError(workerError.message);
          if (error instanceof RenderError) {
            error.path = workerError.path || '';
            error.location = workerError.location;
          }
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
    };
    worker.addEventListener('message', messageHandler);
  });
}
