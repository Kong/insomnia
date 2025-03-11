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
    const messageHandler = (event: MessageEvent) => {
      if (event.data.id === id) {
        worker.removeEventListener('message', messageHandler);
        if (event.data.err) {
          return reject(new Error(event.data.err));
        }
        return resolve(event.data.result);
      }
    };
    worker.addEventListener('message', messageHandler);
  });
}
